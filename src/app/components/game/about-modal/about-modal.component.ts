import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-about-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './about-modal.component.html',
    styleUrl: './about-modal.component.css'
})
export class AboutModalComponent {
    @Input() show = false;
    @Output() close = new EventEmitter<void>();

    onClose(): void {
        this.close.emit();
    }
}
