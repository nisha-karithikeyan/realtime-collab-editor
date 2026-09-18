import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Backlink,
  Comment,
  Document,
  DocumentTreeNode,
  Folder,
  GraphData,
  Paginated,
  TagGroup,
} from '../models';

@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  listFolders(): Observable<Folder[]> {
    return this.http
      .get<Paginated<Folder>>(`${this.baseUrl}/folders/`)
      .pipe(map((page) => page.results));
  }

  createFolder(name: string, parent: string | null = null): Observable<Folder> {
    return this.http.post<Folder>(`${this.baseUrl}/folders/`, { name, parent });
  }

  renameFolder(id: string, name: string): Observable<Folder> {
    return this.http.patch<Folder>(`${this.baseUrl}/folders/${id}/`, { name });
  }

  deleteFolder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/folders/${id}/`);
  }

  /** `folderId` of null lists documents at the root (not in any folder). */
  listDocuments(folderId: string | null): Observable<Document[]> {
    const params = new HttpParams().set('folder', folderId ?? 'root');
    return this.http
      .get<Paginated<Document>>(`${this.baseUrl}/documents/`, { params })
      .pipe(map((page) => page.results));
  }

  createDocument(title: string, folder: string | null = null): Observable<Document> {
    return this.http.post<Document>(`${this.baseUrl}/documents/`, { title, folder });
  }

  renameDocument(id: string, title: string): Observable<Document> {
    return this.http.patch<Document>(`${this.baseUrl}/documents/${id}/`, { title });
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/documents/${id}/`);
  }

  getDocument(id: string): Observable<Document> {
    return this.http.get<Document>(`${this.baseUrl}/documents/${id}/`);
  }

  updateDocumentTags(id: string, tags: string[]): Observable<Document> {
    return this.http.patch<Document>(`${this.baseUrl}/documents/${id}/`, { tags });
  }

  /** Flat list of every owned document, for the sidebar page tree. */
  pageTree(): Observable<DocumentTreeNode[]> {
    return this.http.get<DocumentTreeNode[]>(`${this.baseUrl}/documents/page-tree/`);
  }

  tagBrowser(): Observable<TagGroup[]> {
    return this.http.get<TagGroup[]>(`${this.baseUrl}/documents/tags/`);
  }

  setOutgoingLinks(documentId: string, toDocumentIds: string[]): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/documents/${documentId}/links/`, {
      to_document_ids: toDocumentIds,
    });
  }

  backlinks(documentId: string): Observable<Backlink[]> {
    return this.http.get<Backlink[]>(`${this.baseUrl}/documents/${documentId}/backlinks/`);
  }

  searchDocumentsByTitle(query: string): Observable<Document[]> {
    return this.http
      .get<Paginated<Document>>(`${this.baseUrl}/documents/`, {
        params: new HttpParams().set('search', query),
      })
      .pipe(map((page) => page.results));
  }

  listComments(documentId: string): Observable<Comment[]> {
    return this.http
      .get<Paginated<Comment>>(`${this.baseUrl}/comments/`, {
        params: new HttpParams().set('document', documentId),
      })
      .pipe(map((page) => page.results));
  }

  createComment(
    documentId: string,
    blockId: string,
    body: string,
    parentComment: number | null = null,
  ): Observable<Comment> {
    return this.http.post<Comment>(`${this.baseUrl}/comments/`, {
      document: documentId,
      block_id: blockId,
      body,
      parent_comment: parentComment,
    });
  }

  resolveComment(id: number, resolved: boolean): Observable<Comment> {
    return this.http.patch<Comment>(`${this.baseUrl}/comments/${id}/`, { resolved });
  }

  graph(): Observable<GraphData> {
    return this.http.get<GraphData>(`${this.baseUrl}/documents/graph/`);
  }
}
