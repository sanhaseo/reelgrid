import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie, Criteria } from '../../../services/movie.service';
import { SummaryBoardComponent, SummaryStatCell } from './summary-board/summary-board.component';
import { RarityInfo } from '../grid-cell/grid-cell.component';

@Component({
  selector: 'app-game-summary',
  standalone: true,
  imports: [CommonModule, SummaryBoardComponent],
  templateUrl: './game-summary.component.html',
  styleUrl: './game-summary.component.css'
})
export class GameSummaryComponent {
  @Input() summaryAnswers: Movie[][][] | null = null;
  @Input() summaryStats: any[][] | null = null;
  @Input() userGrid: (Movie | null)[][] = [];
  @Input() rowCriteria: Criteria[] = [];
  @Input() colCriteria: Criteria[] = [];

  selectedAnswers: Movie[] | null = null;
  showModal = false;

  activeSummaryTab: 'stats' | 'answers' = 'stats';
  activeStatView: 'popular' | 'rare' = 'popular';

  setActiveTab(tab: 'stats' | 'answers'): void {
    this.activeSummaryTab = tab;
  }

  setStatView(view: 'popular' | 'rare'): void {
    this.activeStatView = view;
  }

  getPopularGrid(): (SummaryStatCell | null)[][] {
    return this.computeGrid('popular');
  }

  getRareGrid(): (SummaryStatCell | null)[][] {
    return this.computeGrid('rare');
  }

  private computeGrid(type: 'popular' | 'rare'): (SummaryStatCell | null)[][] {
    if (!this.summaryStats) return [[null, null, null], [null, null, null], [null, null, null]];

    const grid: (SummaryStatCell | null)[][] = [];
    for (let i = 0; i < 3; i++) {
      const row: (SummaryStatCell | null)[] = [];
      for (let j = 0; j < 3; j++) {
        let stat = type === 'popular' ? this.getTopAnswer(i, j) : this.getLeastPopular(i, j);

        // If rare is duplicate of top, keep it? User said "separate boards", implies showing what is rare.
        // If rare == top, it means only 1 answer exists (or flat).
        // Usually we show it even if duplicate on a separate board.
        // But if it's null, we return null.

        if (stat) {
          let movie = this.findMovieObject(i, j, stat.title);

          if (!movie && stat.poster_path) {
            // Fallback: Use metadata from stats if not found in daily solutions
            movie = {
              id: 0,
              title: stat.title,
              poster_path: stat.poster_path,
              release_date: '',
              genres: []
            } as Movie;
          }

          if (movie) {
            const rarityInfo = this.getRarityInfo(stat.percent, type === 'popular');
            row.push({ movie, rarity: rarityInfo });
          } else {
            row.push(null);
          }
        } else {
          row.push(null);
        }
      }
      grid.push(row);
    }
    return grid;
  }

  private findMovieObject(row: number, col: number, title: string): Movie | null {
    if (!this.summaryAnswers || !this.summaryAnswers[row] || !this.summaryAnswers[row][col]) return null;
    // Search in partial answers? Or do we need full details?
    // summaryAnswers has Movie objects.
    // Normalize title compare? Or exact match from stats key.
    return this.summaryAnswers[row][col].find(m => m.title === title) || null;
  }

  private getRarityInfo(percent: number, isPopular: boolean): RarityInfo {
    // Simplistic mapping
    return {
      label: isPopular ? 'Popular' : 'Rare',
      percent: percent,
      colorClass: this.getRarityColorClass(percent)
    };
  }

  private getRarityColorClass(percent: number): string {
    if (percent <= 1) return 'legendary';
    if (percent <= 5) return 'epic';
    if (percent <= 15) return 'rare';
    if (percent <= 30) return 'uncommon';
    return 'common';
  }

  getStatPercentage(row: number, col: number, movieTitle: string): number {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return 0;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return 0;

    const entry = cellStat.answers[movieTitle];
    const count = typeof entry === 'object' ? entry.count : (entry || 0);
    return Math.round((count / cellStat.total) * 100);
  }

  getTopAnswer(row: number, col: number): { title: string, percent: number, poster_path?: string } | null {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return null;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return null;

    let topTitle = '';
    let maxCount = -1;
    let topPoster = '';

    for (const [title, entry] of Object.entries(cellStat.answers)) {
      const count = typeof entry === 'object' ? (entry as any).count : (entry as number);
      if (count > maxCount) {
        maxCount = count;
        topTitle = title;
        if (typeof entry === 'object') {
          topPoster = (entry as any).poster_path;
        }
      }
    }

    if (!topTitle) return null;
    return {
      title: topTitle,
      percent: Math.round((maxCount / cellStat.total) * 100),
      poster_path: topPoster
    };
  }

  getLeastPopular(row: number, col: number): { title: string, percent: number, poster_path?: string } | null {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return null;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return null;

    let minTitle = '';
    let minCount = Infinity;
    let minPoster = '';
    let hasEntries = false;

    for (const [title, entry] of Object.entries(cellStat.answers)) {
      const count = typeof entry === 'object' ? (entry as any).count : (entry as number);

      if (count > 0) {
        hasEntries = true;
        if (count < minCount) {
          minCount = count;
          minTitle = title;
          if (typeof entry === 'object') {
            minPoster = (entry as any).poster_path;
          }
        }
      }
    }

    if (!hasEntries || !minTitle) return null;
    return {
      title: minTitle,
      percent: Math.round((minCount / cellStat.total) * 100),
      poster_path: minPoster
    };
  }

  openAnswersModal(movies: Movie[]): void {
    this.selectedAnswers = movies;
    this.showModal = true;
  }

  closeAnswersModal(): void {
    this.showModal = false;
    this.selectedAnswers = null;
  }

  getImageUrl(posterPath: string | null): string {
    if (!posterPath) return '';
    if (posterPath.startsWith('http')) return posterPath;
    return `https://image.tmdb.org/t/p/w200${posterPath}`;
  }
}
