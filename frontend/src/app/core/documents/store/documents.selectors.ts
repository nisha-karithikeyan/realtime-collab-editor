import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DocumentsState } from './documents.reducer';

export const selectDocumentsState = createFeatureSelector<DocumentsState>('documents');

export const selectCurrentFolderId = createSelector(selectDocumentsState, (s) => s.currentFolderId);
export const selectAllFolders = createSelector(selectDocumentsState, (s) => s.folders);
export const selectDocuments = createSelector(selectDocumentsState, (s) => s.documents);
export const selectFoldersStatus = createSelector(selectDocumentsState, (s) => s.foldersStatus);
export const selectDocumentsStatus = createSelector(selectDocumentsState, (s) => s.documentsStatus);
export const selectDocumentsError = createSelector(selectDocumentsState, (s) => s.error);

// Subfolders of whichever folder is currently open (null = folders at root).
export const selectChildFolders = createSelector(
  selectAllFolders,
  selectCurrentFolderId,
  (folders, currentFolderId) => folders.filter((f) => f.parent === currentFolderId),
);

export const selectBreadcrumb = createSelector(
  selectAllFolders,
  selectCurrentFolderId,
  (folders, currentFolderId) => {
    const trail: typeof folders = [];
    const visited = new Set<string>();
    let node = folders.find((f) => f.id === currentFolderId) ?? null;
    // The backend rejects circular folder nesting, but `visited` guards
    // against a browser hang here too if client state ever drifts.
    while (node && !visited.has(node.id)) {
      visited.add(node.id);
      trail.unshift(node);
      node = folders.find((f) => f.id === node!.parent) ?? null;
    }
    return trail;
  },
);
