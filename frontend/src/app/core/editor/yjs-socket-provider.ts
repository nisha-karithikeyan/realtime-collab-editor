import * as Y from 'yjs';
import { loadOfflineState, saveOfflineState } from './offline-store';

// TS's DOM lib types WebSocket.send() as wanting an ArrayBuffer-backed
// view specifically, but Uint8Array's buffer type is technically wider
// (ArrayBuffer | SharedArrayBuffer) - copy into a plain ArrayBuffer to
// satisfy that without an unsafe cast.
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'offline';

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

export type AwarenessMessage =
  | { type: 'cursor'; user: PresenceUser; anchor: number; head: number }
  | { type: 'presence-leave'; userId: string };

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;
const OFFLINE_SAVE_DEBOUNCE_MS = 800;

/**
 * Hand-rolled real-time provider (not `y-websocket`) matching the
 * server's protocol in realtime/consumers.py:
 *   - on connect, the server sends its full merged state first
 *   - the client applies it (merging with anything restored from
 *     IndexedDB, including offline-only edits) and echoes back its own
 *     full state so the server picks up what it's missing
 *   - after that, only incremental updates are exchanged
 *
 * This "exchange full state, then stream diffs" approach is what makes
 * the offline-edit-merges-on-reconnect story actually true: because CRDT
 * merges are commutative and idempotent, it doesn't matter how long a
 * client was offline or in what order updates arrive - the two docs
 * converge to the same state with no data loss and no manual conflict
 * resolution.
 */
export class YjsSocketProvider {
  readonly doc: Y.Doc;
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private offlineSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private hasSentLocalStateSinceConnect = false;

  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private awarenessListeners = new Set<(msg: AwarenessMessage) => void>();
  private _status: ConnectionStatus = 'connecting';

  constructor(
    private readonly documentId: string,
    private readonly wsUrl: string,
  ) {
    this.doc = new Y.Doc();
    this.doc.on('update', this.handleLocalUpdate);
    void this.init();
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onAwareness(listener: (msg: AwarenessMessage) => void): () => void {
    this.awarenessListeners.add(listener);
    return () => this.awarenessListeners.delete(listener);
  }

  sendAwareness(msg: AwarenessMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.doc.off('update', this.handleLocalUpdate);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.offlineSaveTimer) clearTimeout(this.offlineSaveTimer);
    this.ws?.close();
    this.statusListeners.clear();
    this.awarenessListeners.clear();
  }

  private async init(): Promise<void> {
    const offlineState = await loadOfflineState(this.documentId);
    if (offlineState && !this.destroyed) {
      Y.applyUpdate(this.doc, offlineState, 'offline-restore');
    }
    if (!this.destroyed) this.connect();
  }

  private connect(): void {
    if (this.destroyed) return;
    this.setStatus(this.reconnectAttempt === 0 ? 'connecting' : 'connecting');
    this.hasSentLocalStateSinceConnect = false;

    const ws = new WebSocket(this.wsUrl);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this.handleAwarenessMessage(event.data);
        return;
      }
      const update = new Uint8Array(event.data as ArrayBuffer);
      // origin='remote' so handleLocalUpdate (which only forwards our
      // own edits to the socket) ignores updates that came FROM the
      // socket - otherwise we'd echo the server's own data back at it.
      Y.applyUpdate(this.doc, update, 'remote');
      this.setStatus('connected');

      if (!this.hasSentLocalStateSinceConnect) {
        this.hasSentLocalStateSinceConnect = true;
        // Echo our full local state back (covers reconnect-with-
        // offline-edits: the server just sent us its state, now it
        // gets ours so both sides converge).
        ws.send(toArrayBuffer(Y.encodeStateAsUpdate(this.doc)));
      }
    };

    ws.onclose = () => {
      if (this.destroyed) return;
      this.setStatus('offline');
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private handleLocalUpdate = (update: Uint8Array, origin: unknown): void => {
    // Only forward genuinely local edits - not updates we just applied
    // FROM the server (origin 'remote') or from IndexedDB restore.
    if (origin === 'remote' || origin === 'offline-restore') {
      this.scheduleOfflineSave();
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(toArrayBuffer(update));
    }
    // Not connected: the edit is already applied to `doc` in memory
    // (that's how Yjs works - there's no separate "queue" to manage),
    // and gets flushed to IndexedDB below so it survives a reload. On
    // reconnect, connect()'s full-state echo sends this along.
    this.scheduleOfflineSave();
  };

  private scheduleOfflineSave(): void {
    if (this.offlineSaveTimer) clearTimeout(this.offlineSaveTimer);
    this.offlineSaveTimer = setTimeout(() => {
      void saveOfflineState(this.documentId, Y.encodeStateAsUpdate(this.doc));
    }, OFFLINE_SAVE_DEBOUNCE_MS);
  }

  private handleAwarenessMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as AwarenessMessage;
      this.awarenessListeners.forEach((listener) => listener(msg));
    } catch {
      // Malformed awareness frame - ignore, sync channel is unaffected.
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}
