import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie } from '../../../services/movie.service';

@Component({
  selector: 'app-game-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-summary.component.html',
  styleUrl: './game-summary.component.css'
})
export class GameSummaryComponent {
  @Input() summaryAnswers: Movie[][][] | null = null;
  @Input() summaryStats: any[][] | null = null;
  @Input() userGrid: (Movie | null)[][] = [];

  activeSummaryTab: 'stats' | 'answers' = 'stats';

  setActiveTab(tab: 'stats' | 'answers'): void {
    this.activeSummaryTab = tab;
  }

  getStatPercentage(row: number, col: number, movieTitle: string): number {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return 0;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return 0;

    const count = cellStat.answers[movieTitle] || 0;
    return Math.round((count / cellStat.total) * 100);
  }

  getTopAnswer(row: number, col: number): { title: string, percent: number } | null {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return null;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return null;

    let topTitle = '';
    let maxCount = -1;

    for (const [title, count] of Object.entries(cellStat.answers)) {
      if ((count as number) > maxCount) {
        maxCount = count as number;
        topTitle = title;
      }
    }

    if (!topTitle) return null;
    return {
      title: topTitle,
      percent: Math.round((maxCount / cellStat.total) * 100)
    };
  }

  getLeastPopular(row: number, col: number): { title: string, percent: number } | null {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return null;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return null;

    let minTitle = '';
    let minCount = Infinity;
    let hasEntries = false;

    for (const [title, count] of Object.entries(cellStat.answers)) {
      if ((count as number) > 0) {
        hasEntries = true;
        if ((count as number) < minCount) {
          minCount = count as number;
          minTitle = title;
        }
      }
    }

    if (!hasEntries || !minTitle) return null;
    return {
      title: minTitle,
      percent: Math.round((minCount / cellStat.total) * 100)
    };
  }
}
