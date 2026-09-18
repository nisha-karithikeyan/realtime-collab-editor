import { UpperCasePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { PresenceUser } from '../../../../core/editor/yjs-socket-provider';

@Component({
  selector: 'app-presence-bar',
  standalone: true,
  template: `
    <div class="presence-bar" [class.offline]="status() === 'offline'">
      <span class="status-dot" [attr.data-status]="status()"></span>
      <span class="status-label">{{ statusLabel() }}</span>
      @if (users().length > 0) {
        <div class="avatars">
          @for (user of users(); track user.id) {
            <span class="avatar" [style.background]="user.color" [title]="user.name">{{
              user.name.charAt(0) | uppercase
            }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .presence-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.8rem;
        color: #6b7280;
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #22c55e;
        display: inline-block;
      }
      .status-dot[data-status='connecting'] {
        background: #f59e0b;
      }
      .status-dot[data-status='offline'] {
        background: #ef4444;
      }
      .avatars {
        display: flex;
      }
      .avatar {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        color: #fff;
        font-size: 0.7rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: -6px;
        border: 2px solid #fff;
      }
      .avatar:first-child {
        margin-left: 0;
      }
    `,
  ],
  imports: [UpperCasePipe],
})
export class PresenceBarComponent {
  status = input.required<'connecting' | 'connected' | 'offline'>();
  users = input<PresenceUser[]>([]);

  statusLabel(): string {
    switch (this.status()) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting…';
      case 'offline':
        return 'Offline — changes saved locally';
    }
  }
}
