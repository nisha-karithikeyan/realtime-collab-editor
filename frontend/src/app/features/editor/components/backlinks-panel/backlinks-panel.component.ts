import { Component, input, output } from '@angular/core';
import { Backlink } from '../../../../core/documents/models';

@Component({
  selector: 'app-backlinks-panel',
  standalone: true,
  template: `
    <div class="backlinks">
      <h3>Backlinks</h3>
      @if (backlinks().length === 0) {
        <p class="empty">No pages link here yet.</p>
      } @else {
        <ul>
          @for (link of backlinks(); track link.id) {
            <li>
              <button type="button" (click)="open.emit(link.id)">{{ link.title }}</button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .backlinks {
        border-top: 1px solid #e5e7eb;
        margin-top: 32px;
        padding-top: 16px;
      }
      h3 {
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #6b7280;
        margin: 0 0 10px;
      }
      .empty {
        font-size: 0.85rem;
        color: #9ca3af;
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      button {
        border: none;
        background: none;
        color: #6366f1;
        cursor: pointer;
        padding: 4px 0;
        font-size: 0.9rem;
        text-align: left;

        &:hover {
          text-decoration: underline;
        }
      }
    `,
  ],
})
export class BacklinksPanelComponent {
  backlinks = input.required<Backlink[]>();
  open = output<string>();
}
