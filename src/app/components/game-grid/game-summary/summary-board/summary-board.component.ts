import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie } from '../../../../services/movie.service';
import { GridCellComponent, RarityInfo } from '../../grid-cell/grid-cell.component';

export interface SummaryStatCell {
    movie: Movie;
    rarity: RarityInfo;
}

@Component({
    selector: 'app-summary-board',
    standalone: true,
    imports: [CommonModule, GridCellComponent],
    templateUrl: './summary-board.component.html',
    styleUrl: './summary-board.component.css'
})
export class SummaryBoardComponent {
    @Input() gridData: (SummaryStatCell | null)[][] = [];
    @Input() title: string = '';
}
