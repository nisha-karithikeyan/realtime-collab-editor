import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Folder } from '../../../../core/documents/models';

@Component({
  selector: 'app-folder-item',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './folder-item.component.html',
  styleUrl: './folder-item.component.scss',
})
export class FolderItemComponent {
  folder = input.required<Folder>();

  open = output<string>();
  rename = output<{ id: string; name: string }>();
  remove = output<string>();

  nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  isEditing = signal(false);
  draftName = signal('');

  startEditing(): void {
    this.draftName.set(this.folder().name);
    this.isEditing.set(true);
    setTimeout(() => this.nameInput()?.nativeElement.select());
  }

  confirmEdit(): void {
    const name = this.draftName().trim();
    if (name && name !== this.folder().name) {
      this.rename.emit({ id: this.folder().id, name });
    }
    this.isEditing.set(false);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  confirmDelete(): void {
    if (confirm(`Delete "${this.folder().name}" and everything inside it?`)) {
      this.remove.emit(this.folder().id);
    }
  }
}
