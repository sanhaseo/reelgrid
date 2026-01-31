import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie } from '../../../../services/movie.service';

@Component({
    selector: 'app-answers-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './answers-modal.component.html',
    styleUrl: './answers-modal.component.css'
})
export class AnswersModalComponent {
    @Input() answers: Movie[] | null = null;
    @Output() close = new EventEmitter<void>();

    onClose(): void {
        this.close.emit();
    }

    /* Prevent click outside from closing if clicked inside */
    stopPropagation(event: Event): void {
        event.stopPropagation();
    }
}
