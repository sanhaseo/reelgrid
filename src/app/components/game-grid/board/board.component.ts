import { Component, Input, Output, EventEmitter, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Criteria } from '../../../services/movie.service';

@Component({
    selector: 'app-board',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './board.component.html',
    styleUrl: './board.component.css'
})
export class BoardComponent {
    @Input() rowCriteria: Criteria[] = [];
    @Input() colCriteria: Criteria[] = [];
    @Input() gridData: any[][] = [];
    @Input() cellTemplate!: TemplateRef<any>;

    @Output() criteriaClick = new EventEmitter<Criteria>();
    @Output() cellClick = new EventEmitter<{ row: number, col: number }>();

    onCriteriaClick(c: Criteria): void {
        this.criteriaClick.emit(c);
    }

    onCellClick(row: number, col: number): void {
        this.cellClick.emit({ row, col });
    }
}
