import { Component, Input, OnChanges, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie, Criteria } from '../../../services/movie.service';
import { SummaryBoardComponent, SummaryStatCell } from './summary-board/summary-board.component';
import { calculateRarity, RarityInfo } from '../../../utils/rarity';
import { AnswersModalComponent } from './answers-modal/answers-modal.component';

@Component({
  selector: 'app-game-summary',
  standalone: true,
  imports: [CommonModule, SummaryBoardComponent, AnswersModalComponent],
  templateUrl: './game-summary.component.html',
  styleUrl: './game-summary.component.css'
})
export class GameSummaryComponent implements OnInit, OnDestroy {
  @Input() summaryAnswers: Movie[][][] | null = null;
  @Input() summaryStats: any[][] | null = null;
  @Input() totalCompletedGames = 0;
  @Input() userGrid: (Movie | null)[][] = [];
  @Input() rowCriteria: Criteria[] = [];
  @Input() colCriteria: Criteria[] = [];

  selectedAnswers: Movie[] | null = null;
  showModal = false;

  activeSummaryTab: 'results' | 'stats' = 'results';
  activeStatView: 'popular' | 'rare' | 'answers' | 'frequency' = 'popular';

  timeUntilNextGame: string = '00:00:00';
  private timerInterval: any;

  ngOnInit(): void {
    this.updateTimer();
    this.timerInterval = setInterval(() => this.updateTimer(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private updateTimer(): void {
    const now = new Date();
    // Midnight UTC of next day
    const nextGame = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const diff = nextGame.getTime() - now.getTime();

    if (diff <= 0) {
      this.timeUntilNextGame = '00:00:00';
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');
    this.timeUntilNextGame = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  setActiveTab(tab: 'results' | 'stats'): void {
    this.activeSummaryTab = tab;
  }

  setStatView(view: 'popular' | 'rare' | 'answers' | 'frequency'): void {
    this.activeStatView = view;
  }

  getPopularGrid(): (SummaryStatCell | null)[][] {
    return this.computeGrid('popular');
  }

  getRareGrid(): (SummaryStatCell | null)[][] {
    return this.computeGrid('rare');
  }

  getFrequencyGrid(): any[][] {
    if (!this.summaryStats || this.totalCompletedGames === 0) {
      return this.createEmptyGrid();
    }

    const grid: any[][] = [];
    for (let r = 0; r < 3; r++) {
      const row: any[] = [];
      for (let c = 0; c < 3; c++) {
        const cellStat = this.summaryStats[r][c];
        // total correctly answered for this cell
        const totalCorrect = cellStat?.completionCount || 0;
        const percent = (totalCorrect / this.totalCompletedGames) * 100;
        row.push({ percent });
      }
      grid.push(row);
    }
    return grid;
  }

  private createEmptyGrid() {
    return [
      [null, null, null],
      [null, null, null],
      [null, null, null]
    ];
  }

  private computeGrid(type: 'popular' | 'rare'): (SummaryStatCell | null)[][] {
    if (!this.summaryStats) return [[null, null, null], [null, null, null], [null, null, null]];

    const grid: (SummaryStatCell | null)[][] = [];
    for (let i = 0; i < 3; i++) {
      const row: (SummaryStatCell | null)[] = [];
      for (let j = 0; j < 3; j++) {
        let stat = type === 'popular' ? this.getTopAnswer(i, j) : this.getLeastPopular(i, j);

        if (stat) {
          let movie = this.findMovieObject(i, j, stat.id);

          if (!movie && stat.poster_path) {
            // Fallback: Use metadata from stats if not found in daily solutions
            movie = {
              id: stat.id,
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

  private findMovieObject(row: number, col: number, id: number): Movie | null {
    if (!this.summaryAnswers || !this.summaryAnswers[row] || !this.summaryAnswers[row][col]) return null;
    return this.summaryAnswers[row][col].find(m => m.id === id) || null;
  }

  private getRarityInfo(percent: number, isPopular: boolean): RarityInfo {
    return calculateRarity(percent);
  }

  getStatPercentage(row: number, col: number, movieId: string): number {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return 0;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return 0;

    const entry = cellStat.answers[movieId];
    const count = typeof entry === 'object' ? entry.count : (entry || 0);
    return Math.round((count / cellStat.total) * 100);
  }

  getTopAnswer(row: number, col: number): { title: string, id: number, percent: number, poster_path?: string } | null {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return null;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return null;

    let topTitle = '';
    let topId = 0;
    let maxCount = -1;
    let topPoster = '';

    for (const [key, entry] of Object.entries(cellStat.answers)) {
      const count = typeof entry === 'object' ? (entry as any).count : (entry as number);
      if (count > maxCount) {
        maxCount = count;
        // Key is ID now
        topId = parseInt(key) || (typeof entry === 'object' ? (entry as any).id : 0);

        if (typeof entry === 'object') {
          topPoster = (entry as any).poster_path;
        } else {
          // Legacy fallback if needed
        }
      }
    }

    if (!topTitle && !topId) return null;
    return {
      id: topId,
      title: topTitle,
      percent: Math.round((maxCount / cellStat.total) * 100),
      poster_path: topPoster
    };
  }

  getLeastPopular(row: number, col: number): { title: string, id: number, percent: number, poster_path?: string } | null {
    if (!this.summaryStats || !this.summaryStats[row] || !this.summaryStats[row][col]) return null;

    const cellStat = this.summaryStats[row][col];
    if (!cellStat || cellStat.total === 0) return null;

    let minTitle = '';
    let minId = 0;
    let minCount = Infinity;
    let minPoster = '';
    let hasEntries = false;

    for (const [key, entry] of Object.entries(cellStat.answers)) {
      const count = typeof entry === 'object' ? (entry as any).count : (entry as number);

      if (count > 0) {
        hasEntries = true;
        if (count < minCount) {
          minCount = count;
          minId = parseInt(key) || (typeof entry === 'object' ? (entry as any).id : 0);

          if (typeof entry === 'object') {
            minPoster = (entry as any).poster_path;
          }
        }
      }
    }

    if (!hasEntries || (!minTitle && !minId)) return null;
    return {
      id: minId,
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

  shareResults(): void {
    if (!this.userGrid) return;

    let emojiGrid = '';
    let correctCount = 0;
    const totalCells = 9;

    for (let i = 0; i < 3; i++) {
      let rowStr = '';
      for (let j = 0; j < 3; j++) {
        const cell = this.userGrid[i][j];
        if (cell) {
          rowStr += '🟩';
          correctCount++;
        } else {
          rowStr += '❌';
        }
      }
      emojiGrid += rowStr + '\n';
    }

    const today = new Date().toLocaleDateString();
    const shareText = `CineGrid ${today}\n\n${emojiGrid}\nScore: ${correctCount}/${totalCells}\nhttps://example.com`;

    navigator.clipboard.writeText(shareText).then(() => {
      // Show temporary toast or feedback
      this.showToast = true;
      setTimeout(() => this.showToast = false, 2000);
    });
  }

  showToast = false;
}
