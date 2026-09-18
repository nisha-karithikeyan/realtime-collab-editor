import { Component, input, output, signal } from '@angular/core';
import { DocumentTreeNode } from '../../../../core/documents/models';

interface TreeNode extends DocumentTreeNode {
  children: TreeNode[];
}

@Component({
  selector: 'app-page-tree-node',
  standalone: true,
  imports: [PageTreeNodeComponent],
  template: `
    <li>
      <div class="row">
        @if (node().children.length > 0) {
          <button type="button" class="toggle" (click)="expanded.set(!expanded())">
            {{ expanded() ? '▾' : '▸' }}
          </button>
        } @else {
          <span class="toggle-spacer"></span>
        }
        <button type="button" class="title" (click)="open.emit(node().id)">
          📄 {{ node().title }}
        </button>
      </div>
      @if (expanded() && node().children.length > 0) {
        <ul>
          @for (child of node().children; track child.id) {
            <app-page-tree-node [node]="child" (open)="onOpen($event)"></app-page-tree-node>
          }
        </ul>
      }
    </li>
  `,
  styles: [
    `
      li {
        list-style: none;
      }
      ul {
        padding-left: 16px;
        margin: 0;
      }
      .row {
        display: flex;
        align-items: center;
      }
      .toggle,
      .toggle-spacer {
        width: 16px;
        flex-shrink: 0;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 0.7rem;
        color: #9ca3af;
      }
      .title {
        border: none;
        background: none;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 0.85rem;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;

        &:hover {
          background: #f3f4f6;
        }
      }
    `,
  ],
})
export class PageTreeNodeComponent {
  node = input.required<TreeNode>();
  open = output<string>();
  expanded = signal(true);

  onOpen(documentId: string): void {
    this.open.emit(documentId);
  }
}
