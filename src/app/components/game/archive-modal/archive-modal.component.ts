import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-archive-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './archive-modal.component.html',
  styleUrl: './archive-modal.component.css'
})
export class ArchiveModalComponent {
  @Input() show = false;
  @Input() archiveDates: string[] = [];
  @Input() activeBoardDate = '';

  @Output() close = new EventEmitter<void>();
  @Output() dateSelected = new EventEmitter<string>();

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const d = new Date(`${dateString}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  onClose(): void {
    this.close.emit();
  }

  onDateSelect(date: string): void {
    this.dateSelected.emit(date);
  }
}
