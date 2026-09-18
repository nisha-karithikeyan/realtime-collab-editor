import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Document, Folder, Paginated } from '../models';

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
}
