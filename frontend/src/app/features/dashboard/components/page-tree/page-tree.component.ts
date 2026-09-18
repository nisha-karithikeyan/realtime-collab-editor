import { Component, computed, input, output } from '@angular/core';
import { DocumentTreeNode } from '../../../../core/documents/models';
import { PageTreeNodeComponent } from './page-tree-node.component';

interface TreeNode extends DocumentTreeNode {
  children: TreeNode[];
}

@Component({
  selector: 'app-page-tree',
  standalone: true,
  template: `
    <ul class="page-tree">
      @for (node of nodes(); track node.id) {
        <app-page-tree-node [node]="node" (open)="onOpen($event)"></app-page-tree-node>
      }
    </ul>
  `,
  styles: [
    `
      .page-tree {
        list-style: none;
        margin: 0;
        padding: 0;
      }
    `,
  ],
  imports: [PageTreeNodeComponent],
})
export class PageTreeRootComponent {
  flatNodes = input.required<DocumentTreeNode[]>({ alias: 'nodes' });
  open = output<string>();

  onOpen(documentId: string): void {
    this.open.emit(documentId);
  }

  nodes = computed<TreeNode[]>(() => {
    const byId = new Map<string, TreeNode>();
    for (const n of this.flatNodes()) byId.set(n.id, { ...n, children: [] });

    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parent_page && byId.has(node.parent_page)) {
        byId.get(node.parent_page)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  });
}
