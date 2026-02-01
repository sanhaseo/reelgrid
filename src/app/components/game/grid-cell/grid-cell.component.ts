import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie } from '../../../services/movie.service';

export interface RarityInfo {
  label: string;
  colorClass: string;
  percent: number;
}

@Component({
  selector: 'app-grid-cell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grid-cell.component.html',
  styleUrl: './grid-cell.component.css'
})
export class GridCellComponent {
  @Input() movie: Movie | null = null;
  @Input() rarity: RarityInfo | null = null;
  @Input() isIncorrect: boolean = false;
  @Input() isSelected: boolean = false;
}
