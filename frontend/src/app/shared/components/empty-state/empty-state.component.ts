import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state" role="status">
      <p class="title">{{ title() }}</p>
      @if (subtitle()) {
        <p class="subtitle">{{ subtitle() }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .empty-state {
        text-align: center;
        padding: 48px 16px;
        color: var(--text-muted, #6b7280);
      }
      .title {
        font-size: 1.05rem;
        font-weight: 600;
        margin: 0 0 4px;
        color: var(--text, #111827);
      }
      .subtitle {
        margin: 0 0 16px;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  title = input.required<string>();
  subtitle = input<string>('');
}
