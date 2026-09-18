import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Editor } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import StarterKit from '@tiptap/starter-kit';
import { Subscription, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from '../../core/auth/services/token-storage.service';
import { selectCurrentUser } from '../../core/auth/store/auth.selectors';
import { DocumentsApiService } from '../../core/documents/services/documents-api.service';
import { Backlink, Document as DocModel } from '../../core/documents/models';
import { PresenceUser, YjsSocketProvider } from '../../core/editor/yjs-socket-provider';
import { SlashCommandExtension } from '../../core/editor/slash-command-suggestion';
import { WikiLinkNode } from '../../core/editor/wiki-link-node';
import { createWikiLinkSuggestionExtension } from '../../core/editor/wiki-link-suggestion';
import { TagMark, extractTagsFromText } from '../../core/editor/tag-mark';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { PresenceBarComponent } from './components/presence-bar/presence-bar.component';
import { BacklinksPanelComponent } from './components/backlinks-panel/backlinks-panel.component';

const SAVE_METADATA_DEBOUNCE_MS = 1500;

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LoadingSkeletonComponent,
    PresenceBarComponent,
    BacklinksPanelComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  // Not `static: true`: the container sits inside a top-level @if/@else
  // block (for the loadFailed error state), and Ivy resolves "static"
  // purely from template structure - anything inside ANY @if/@else is
  // always non-static, regardless of which branch is actually active at
  // init. A static query there silently resolves to undefined.
  @ViewChild('editorContainer') editorContainer?: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(Store);
  private api = inject(DocumentsApiService);
  private tokenStorage = inject(TokenStorageService);

  // Angular reuses this component instance across navigations that only
  // change the `:id` param (e.g. clicking a wiki-link or a backlink) -
  // ngOnDestroy/ngOnInit do NOT re-fire in that case. So `documentId`
  // must track the route reactively, and every per-document resource
  // (editor, provider, timers, listeners) must be torn down and rebuilt
  // whenever it changes, not just once at construction.
  private documentId = this.route.snapshot.paramMap.get('id')!;
  private routeParamSub: Subscription | null = null;
  private viewReady = false;

  private tiptapEditor: Editor | null = null;
  private provider: YjsSocketProvider | null = null;
  private metadataSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private unsubscribeAwareness: (() => void) | null = null;
  private presenceUsers = new Map<string, PresenceUser>();

  currentUser = toSignal(this.store.select(selectCurrentUser), { initialValue: null });

  document = signal<DocModel | null>(null);
  loadFailed = signal(false);
  title = signal('');
  connectionStatus = signal<'connecting' | 'connected' | 'offline'>('connecting');
  presenceList = signal<PresenceUser[]>([]);
  backlinks = signal<Backlink[]>([]);
  tags = signal<string[]>([]);

  ngOnInit(): void {
    this.routeParamSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id')!;
      // Deliberately NOT updating this.documentId here: switchToDocument
      // needs the OLD id to still be in place when it flushes the
      // outgoing document's pending metadata save (tags/links), and only
      // updates it once that flush has been kicked off. Reassigning
      // early caused a real bug - a flushed save landing on the *new*
      // document's id instead of the one that was actually edited.
      if (this.viewReady) this.switchToDocument(id);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    // First load: paramMap's subscribe() callback above already fired
    // synchronously (before this), so kick off the editor mount now that
    // the container exists.
    this.switchToDocument(this.documentId);
  }

  ngOnDestroy(): void {
    this.routeParamSub?.unsubscribe();
    this.teardownCurrentDocument();
  }

  private async switchToDocument(id: string): Promise<void> {
    this.teardownCurrentDocument(); // flushes using the OLD this.documentId
    this.documentId = id;

    // Reset per-document UI state so stale content from the previous
    // document doesn't flash while the new one loads.
    this.document.set(null);
    this.loadFailed.set(false);
    this.title.set('');
    this.tags.set([]);
    this.backlinks.set([]);
    this.presenceUsers.clear();
    this.presenceList.set([]);
    this.connectionStatus.set('connecting');

    if (this.viewReady) this.setupEditor(id);

    try {
      const doc = await firstValueFrom(this.api.getDocument(id));
      if (id !== this.documentId) return; // navigated again before this resolved
      this.document.set(doc);
      this.title.set(doc.title);
      this.tags.set(doc.tags);
    } catch {
      if (id !== this.documentId) return;
      this.loadFailed.set(true);
      this.teardownCurrentDocument();
      return;
    }

    this.loadBacklinks(id);
  }

  private teardownCurrentDocument(): void {
    this.unsubscribeStatus?.();
    this.unsubscribeAwareness?.();
    this.unsubscribeStatus = null;
    this.unsubscribeAwareness = null;
    if (this.metadataSaveTimer) {
      // Flush rather than drop: this is what persists tags and outgoing
      // wiki-links. Client-side navigation (e.g. clicking a wiki-link)
      // doesn't kill in-flight requests the way a full page reload
      // would, so firing this now still completes normally even though
      // we can't await it in a synchronous lifecycle hook.
      clearTimeout(this.metadataSaveTimer);
      void this.saveMetadata();
    }
    this.tiptapEditor?.destroy();
    this.tiptapEditor = null;
    this.provider?.destroy();
    this.provider = null;
  }

  private setupEditor(id: string): void {
    if (!this.editorContainer) return;

    const token = this.tokenStorage.getAccessToken();
    const wsUrl = `${environment.wsBaseUrl}/documents/${id}/?token=${token}`;
    const provider = new YjsSocketProvider(id, wsUrl);
    this.provider = provider;

    this.unsubscribeStatus = provider.onStatusChange((status) => {
      this.connectionStatus.set(status);
    });

    this.unsubscribeAwareness = provider.onAwareness((msg) => {
      if (msg.type === 'cursor') {
        this.presenceUsers.set(msg.user.id, msg.user);
      } else if (msg.type === 'presence-leave') {
        this.presenceUsers.delete(msg.userId);
      }
      this.presenceList.set([...this.presenceUsers.values()]);
    });

    this.editorContainer.nativeElement.innerHTML = '';
    this.tiptapEditor = new Editor({
      element: this.editorContainer.nativeElement,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({ placeholder: "Type '/' for commands, '[[' to link a page…" }),
        Image,
        TagMark,
        WikiLinkNode.configure({
          onNavigate: (targetId) => this.router.navigate(['/documents', targetId]),
        }),
        SlashCommandExtension,
        createWikiLinkSuggestionExtension(async (query) => {
          const results = await firstValueFrom(this.api.searchDocumentsByTitle(query));
          return results
            .filter((d) => d.id !== this.documentId)
            .map((d) => ({ id: d.id, label: d.title }));
        }),
        Collaboration.configure({ document: provider.doc }),
      ],
      onUpdate: () => this.scheduleMetadataSave(),
      onSelectionUpdate: ({ editor }) => this.broadcastPresence(editor),
    });
  }

  private scheduleMetadataSave(): void {
    if (this.metadataSaveTimer) clearTimeout(this.metadataSaveTimer);
    this.metadataSaveTimer = setTimeout(() => this.saveMetadata(), SAVE_METADATA_DEBOUNCE_MS);
  }

  private async saveMetadata(): Promise<void> {
    if (!this.tiptapEditor) return;
    const id = this.documentId;

    const plainText = this.tiptapEditor.getText();
    const newTags = extractTagsFromText(plainText);
    if (JSON.stringify(newTags) !== JSON.stringify(this.tags())) {
      this.tags.set(newTags);
      await firstValueFrom(this.api.updateDocumentTags(id, newTags));
    }

    const targetIds: string[] = [];
    this.tiptapEditor.state.doc.descendants((node) => {
      if (node.type.name === 'wikiLink' && node.attrs['documentId']) {
        targetIds.push(node.attrs['documentId']);
      }
    });
    await firstValueFrom(this.api.setOutgoingLinks(id, [...new Set(targetIds)]));
  }

  private broadcastPresence(editor: Editor): void {
    const user = this.currentUser();
    if (!user || !this.provider) return;
    const { from, to } = editor.state.selection;
    this.provider.sendAwareness({
      type: 'cursor',
      user: { id: user.id, name: user.name || user.email, color: user.avatar_color },
      anchor: from,
      head: to,
    });
  }

  private async loadBacklinks(id: string): Promise<void> {
    try {
      const links = await firstValueFrom(this.api.backlinks(id));
      if (id !== this.documentId) return;
      this.backlinks.set(links);
    } catch {
      // Backlinks are supplementary - a failure here shouldn't block editing.
    }
  }

  onTitleBlur(): void {
    const trimmed = this.title().trim();
    if (!trimmed || trimmed === this.document()?.title) return;
    this.api.renameDocument(this.documentId, trimmed).subscribe();
  }

  openDocument(id: string): void {
    this.router.navigate(['/documents', id]);
  }
}
