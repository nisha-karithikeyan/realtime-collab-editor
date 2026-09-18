import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Document, Folder } from '../models';

export const DocumentsActions = createActionGroup({
  source: 'Documents',
  events: {
    // Navigation: which folder's contents are currently shown (null = root)
    'Folder Opened': props<{ folderId: string | null }>(),

    'Folders Requested': emptyProps(),
    'Folders Load Success': props<{ folders: Folder[] }>(),
    'Folders Load Failure': props<{ error: string }>(),

    'Documents Requested': props<{ folderId: string | null }>(),
    'Documents Load Success': props<{ folderId: string | null; documents: Document[] }>(),
    'Documents Load Failure': props<{ error: string }>(),

    'Folder Create Submitted': props<{ name: string; parent: string | null }>(),
    'Folder Create Success': props<{ folder: Folder }>(),
    'Folder Create Failure': props<{ error: string }>(),

    'Folder Rename Submitted': props<{ id: string; name: string }>(),
    'Folder Rename Success': props<{ folder: Folder }>(),
    'Folder Rename Failure': props<{ error: string }>(),

    'Folder Delete Submitted': props<{ id: string }>(),
    'Folder Delete Success': props<{ id: string }>(),
    'Folder Delete Failure': props<{ error: string }>(),

    'Document Create Submitted': props<{ title: string; folder: string | null }>(),
    'Document Create Success': props<{ document: Document }>(),
    'Document Create Failure': props<{ error: string }>(),

    'Document Rename Submitted': props<{ id: string; title: string }>(),
    'Document Rename Success': props<{ document: Document }>(),
    'Document Rename Failure': props<{ error: string }>(),

    'Document Delete Submitted': props<{ id: string }>(),
    'Document Delete Success': props<{ id: string }>(),
    'Document Delete Failure': props<{ error: string }>(),
  },
});
