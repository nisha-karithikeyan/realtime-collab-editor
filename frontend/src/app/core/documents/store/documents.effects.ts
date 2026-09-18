import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, switchMap } from 'rxjs';
import { extractErrorMessage } from '../../http/extract-error-message';
import { DocumentsApiService } from '../services/documents-api.service';
import { DocumentsActions } from './documents.actions';

@Injectable()
export class DocumentsEffects {
  private actions$ = inject(Actions);
  private api = inject(DocumentsApiService);

  loadFolders$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.foldersRequested),
      switchMap(() =>
        this.api.listFolders().pipe(
          map((folders) => DocumentsActions.foldersLoadSuccess({ folders })),
          catchError((error) =>
            of(DocumentsActions.foldersLoadFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  loadDocuments$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.documentsRequested),
      switchMap(({ folderId }) =>
        this.api.listDocuments(folderId).pipe(
          map((documents) => DocumentsActions.documentsLoadSuccess({ folderId, documents })),
          catchError((error) =>
            of(DocumentsActions.documentsLoadFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  // Re-fetch the document list whenever the open folder changes, so the
  // dashboard doesn't need to remember to dispatch both actions itself.
  reloadDocumentsOnFolderChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.folderOpened),
      map(({ folderId }) => DocumentsActions.documentsRequested({ folderId })),
    ),
  );

  createFolder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.folderCreateSubmitted),
      exhaustMap(({ name, parent }) =>
        this.api.createFolder(name, parent).pipe(
          map((folder) => DocumentsActions.folderCreateSuccess({ folder })),
          catchError((error) =>
            of(DocumentsActions.folderCreateFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  renameFolder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.folderRenameSubmitted),
      exhaustMap(({ id, name }) =>
        this.api.renameFolder(id, name).pipe(
          map((folder) => DocumentsActions.folderRenameSuccess({ folder })),
          catchError((error) =>
            of(DocumentsActions.folderRenameFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  deleteFolder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.folderDeleteSubmitted),
      exhaustMap(({ id }) =>
        this.api.deleteFolder(id).pipe(
          map(() => DocumentsActions.folderDeleteSuccess({ id })),
          catchError((error) =>
            of(DocumentsActions.folderDeleteFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  createDocument$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.documentCreateSubmitted),
      exhaustMap(({ title, folder }) =>
        this.api.createDocument(title, folder).pipe(
          map((document) => DocumentsActions.documentCreateSuccess({ document })),
          catchError((error) =>
            of(DocumentsActions.documentCreateFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  renameDocument$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.documentRenameSubmitted),
      exhaustMap(({ id, title }) =>
        this.api.renameDocument(id, title).pipe(
          map((document) => DocumentsActions.documentRenameSuccess({ document })),
          catchError((error) =>
            of(DocumentsActions.documentRenameFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  deleteDocument$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.documentDeleteSubmitted),
      exhaustMap(({ id }) =>
        this.api.deleteDocument(id).pipe(
          map(() => DocumentsActions.documentDeleteSuccess({ id })),
          catchError((error) =>
            of(DocumentsActions.documentDeleteFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );
}
