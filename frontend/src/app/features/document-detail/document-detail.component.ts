import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Document } from '../../core/documents/models';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';

@Component({
  selector: 'app-document-detail',
  standalone: true,
  imports: [RouterLink, LoadingSkeletonComponent],
  templateUrl: './document-detail.component.html',
  styleUrl: './document-detail.component.scss',
})
export class DocumentDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  document = signal<Document | null>(null);
  loadFailed = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<Document>(`${environment.apiBaseUrl}/documents/${id}/`).subscribe({
      next: (doc) => this.document.set(doc),
      error: () => this.loadFailed.set(true),
    });
  }
}
