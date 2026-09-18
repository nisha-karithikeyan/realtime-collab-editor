import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  template: `
    @for (row of rowsArray(); track $index) {
      <div class="skeleton-row" [style.width.%]="row"></div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .skeleton-row {
        height: 14px;
        margin-bottom: 10px;
        border-radius: 6px;
        background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%);
        background-size: 400% 100%;
        animation: shimmer 1.4s ease infinite;
      }
      @keyframes shimmer {
        0% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0 50%;
        }
      }
      @media (prefers-color-scheme: dark) {
        .skeleton-row {
          background: linear-gradient(90deg, #2a2a2e 25%, #3a3a3f 37%, #2a2a2e 63%);
          background-size: 400% 100%;
        }
      }
    `,
  ],
})
export class LoadingSkeletonComponent {
  rows = input(3);
  widths = input<number[]>([90, 75, 60]);

  rowsArray(): number[] {
    const count = this.rows();
    const widths = this.widths();
    return Array.from({ length: count }, (_, i) => widths[i % widths.length]);
  }
}
