import { DatePipe } from '@angular/common';
import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Document } from '../../../../core/documents/models';

@Component({
  selector: 'app-document-card',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './document-card.component.html',
  styleUrl: './document-card.component.scss',
})
export class DocumentCardComponent {
  document = input.required<Document>();

  open = output<string>();
  rename = output<{ id: string; title: string }>();
  remove = output<string>();

  titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  isEditing = signal(false);
  draftTitle = signal('');

  startEditing(): void {
    this.draftTitle.set(this.document().title);
    this.isEditing.set(true);
    setTimeout(() => this.titleInput()?.nativeElement.select());
  }

  confirmEdit(): void {
    const title = this.draftTitle().trim();
    if (title && title !== this.document().title) {
      this.rename.emit({ id: this.document().id, title });
    }
    this.isEditing.set(false);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  confirmDelete(): void {
    if (confirm(`Delete "${this.document().title}"?`)) {
      this.remove.emit(this.document().id);
    }
  }
}
