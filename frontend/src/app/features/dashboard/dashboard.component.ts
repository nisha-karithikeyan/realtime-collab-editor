import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthActions } from '../../core/auth/store/auth.actions';
import { selectCurrentUser } from '../../core/auth/store/auth.selectors';
import { DocumentsActions } from '../../core/documents/store/documents.actions';
import {
  selectBreadcrumb,
  selectChildFolders,
  selectDocuments,
  selectDocumentsError,
  selectDocumentsStatus,
  selectFoldersStatus,
} from '../../core/documents/store/documents.selectors';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { DocumentCardComponent } from './components/document-card/document-card.component';
import { FolderItemComponent } from './components/folder-item/folder-item.component';
import { PageTreeRootComponent } from './components/page-tree/page-tree.component';
import { DocumentsApiService } from '../../core/documents/services/documents-api.service';
import { DocumentTreeNode } from '../../core/documents/models';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    FolderItemComponent,
    DocumentCardComponent,
    PageTreeRootComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private store = inject(Store);
  private router = inject(Router);
  private docsApi = inject(DocumentsApiService);

  pageTree = signal<DocumentTreeNode[]>([]);

  user = toSignal(this.store.select(selectCurrentUser), { initialValue: null });
  breadcrumb = toSignal(this.store.select(selectBreadcrumb), { initialValue: [] });
  folders = toSignal(this.store.select(selectChildFolders), { initialValue: [] });
  documents = toSignal(this.store.select(selectDocuments), { initialValue: [] });
  foldersStatus = toSignal(this.store.select(selectFoldersStatus), { initialValue: 'idle' as const });
  documentsStatus = toSignal(this.store.select(selectDocumentsStatus), {
    initialValue: 'idle' as const,
  });
  error = toSignal(this.store.select(selectDocumentsError), { initialValue: null });

  ngOnInit(): void {
    this.store.dispatch(DocumentsActions.foldersRequested());
    this.store.dispatch(DocumentsActions.folderOpened({ folderId: null }));
    this.loadPageTree();
  }

  private async loadPageTree(): Promise<void> {
    this.pageTree.set(await firstValueFrom(this.docsApi.pageTree()));
  }

  get currentFolderId(): string | null {
    const trail = this.breadcrumb();
    return trail.length ? trail[trail.length - 1].id : null;
  }

  get isLoading(): boolean {
    return this.foldersStatus() === 'loading' || this.documentsStatus() === 'loading';
  }

  get isEmpty(): boolean {
    return (
      !this.isLoading &&
      this.foldersStatus() === 'loaded' &&
      this.documentsStatus() === 'loaded' &&
      this.folders().length === 0 &&
      this.documents().length === 0
    );
  }

  openFolder(folderId: string | null): void {
    this.store.dispatch(DocumentsActions.folderOpened({ folderId }));
  }

  createFolder(): void {
    const name = prompt('Folder name');
    if (name?.trim()) {
      this.store.dispatch(
        DocumentsActions.folderCreateSubmitted({ name: name.trim(), parent: this.currentFolderId }),
      );
    }
  }

  createDocument(): void {
    this.store.dispatch(
      DocumentsActions.documentCreateSubmitted({
        title: 'Untitled document',
        folder: this.currentFolderId,
      }),
    );
    setTimeout(() => this.loadPageTree(), 400);
  }

  renameFolder(event: { id: string; name: string }): void {
    this.store.dispatch(DocumentsActions.folderRenameSubmitted(event));
  }

  deleteFolder(id: string): void {
    this.store.dispatch(DocumentsActions.folderDeleteSubmitted({ id }));
  }

  renameDocument(event: { id: string; title: string }): void {
    this.store.dispatch(DocumentsActions.documentRenameSubmitted(event));
  }

  deleteDocument(id: string): void {
    this.store.dispatch(DocumentsActions.documentDeleteSubmitted({ id }));
  }

  openDocument(id: string): void {
    this.router.navigate(['/documents', id]);
  }

  logout(): void {
    this.store.dispatch(AuthActions.loggedOut());
  }
}
