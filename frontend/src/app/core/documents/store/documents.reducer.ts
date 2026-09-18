import { createReducer, on } from '@ngrx/store';
import { Document, Folder } from '../models';
import { DocumentsActions } from './documents.actions';

export interface DocumentsState {
  currentFolderId: string | null;
  folders: Folder[];
  documents: Document[];
  foldersStatus: 'idle' | 'loading' | 'loaded' | 'error';
  documentsStatus: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
}

export const initialDocumentsState: DocumentsState = {
  currentFolderId: null,
  folders: [],
  documents: [],
  foldersStatus: 'idle',
  documentsStatus: 'idle',
  error: null,
};

export const documentsReducer = createReducer(
  initialDocumentsState,

  on(DocumentsActions.folderOpened, (state, { folderId }) => ({
    ...state,
    currentFolderId: folderId,
  })),

  on(DocumentsActions.foldersRequested, (state) => ({ ...state, foldersStatus: 'loading' as const })),
  on(DocumentsActions.foldersLoadSuccess, (state, { folders }) => ({
    ...state,
    folders,
    foldersStatus: 'loaded' as const,
  })),
  on(DocumentsActions.foldersLoadFailure, (state, { error }) => ({
    ...state,
    foldersStatus: 'error' as const,
    error,
  })),

  on(DocumentsActions.documentsRequested, (state) => ({
    ...state,
    documentsStatus: 'loading' as const,
  })),
  on(DocumentsActions.documentsLoadSuccess, (state, { documents }) => ({
    ...state,
    documents,
    documentsStatus: 'loaded' as const,
  })),
  on(DocumentsActions.documentsLoadFailure, (state, { error }) => ({
    ...state,
    documentsStatus: 'error' as const,
    error,
  })),

  on(DocumentsActions.folderCreateSuccess, (state, { folder }) => ({
    ...state,
    folders: [...state.folders, folder],
  })),

  on(DocumentsActions.folderRenameSuccess, (state, { folder }) => ({
    ...state,
    folders: state.folders.map((f) => (f.id === folder.id ? folder : f)),
  })),

  on(DocumentsActions.folderDeleteSuccess, (state, { id }) => ({
    ...state,
    folders: state.folders.filter((f) => f.id !== id),
  })),

  on(DocumentsActions.documentCreateSuccess, (state, { document }) => ({
    ...state,
    documents: [document, ...state.documents],
  })),

  on(DocumentsActions.documentRenameSuccess, (state, { document }) => ({
    ...state,
    documents: state.documents.map((d) => (d.id === document.id ? document : d)),
  })),

  on(DocumentsActions.documentDeleteSuccess, (state, { id }) => ({
    ...state,
    documents: state.documents.filter((d) => d.id !== id),
  })),

  on(
    DocumentsActions.folderCreateFailure,
    DocumentsActions.folderRenameFailure,
    DocumentsActions.folderDeleteFailure,
    DocumentsActions.documentCreateFailure,
    DocumentsActions.documentRenameFailure,
    DocumentsActions.documentDeleteFailure,
    (state, { error }) => ({ ...state, error }),
  ),
);
