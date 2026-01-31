import { Component, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Criteria, Movie } from '../../../../services/movie.service';
import { GridCellComponent, RarityInfo } from '../../grid-cell/grid-cell.component';
import { BoardComponent } from '../../board/board.component';

export interface SummaryStatCell {
    movie: Movie;
    rarity: RarityInfo;
}

@Component({
    selector: 'app-summary-board',
    standalone: true,
    imports: [CommonModule, GridCellComponent, BoardComponent],
    templateUrl: './summary-board.component.html',
    styleUrl: './summary-board.component.css'
})
export class SummaryBoardComponent {
    @Input() gridData: any[][] = [];
    @Input() title: string = '';
    @Input() rowCriteria: Criteria[] = [];
    @Input() colCriteria: Criteria[] = [];
    @Input() customCellTemplate: TemplateRef<any> | null = null;
}
