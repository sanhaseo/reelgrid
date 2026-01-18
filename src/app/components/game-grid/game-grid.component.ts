import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie, Criteria, MovieService } from '../../services/movie.service';
import { SearchComponent } from '../search/search.component';
import { GridCellComponent, RarityInfo } from './grid-cell/grid-cell.component';
import { GameSummaryComponent } from './game-summary/game-summary.component';

@Component({
  selector: 'app-game-grid',
  standalone: true,
  imports: [CommonModule, SearchComponent, GridCellComponent, GameSummaryComponent],
  templateUrl: './game-grid.component.html',
  styleUrl: './game-grid.component.css'
})
export class GameGridComponent implements OnInit {
  rowCriteria: Criteria[] = [];
  colCriteria: Criteria[] = [];
  grid: (Movie | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ];

  selectedCell: { row: number, col: number } | null = null;
  isSearchOpen = false;
  lives = 9;
  gameOver = false;
  message = '';
  summaryAnswers: Movie[][][] | null = null;
  summaryStats: any[][] | null = null;

  // Store rarity info for filled cells: "Common", "Rare", etc.
  gridRarity: (RarityInfo | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ];

  constructor(private movieService: MovieService) { }

  ngOnInit(): void {
    this.movieService.getGameSetup().subscribe(setup => {
      this.rowCriteria = setup.rowCriteria;
      this.colCriteria = setup.colCriteria;
    });
  }

  onRegenerate(): void {
    const secret = prompt('Enter Admin Secret (CRON_SECRET) to force regeneration:');
    if (!secret) return;

    this.movieService.regenerateBoard(secret).subscribe({
      next: (setup) => {
        this.rowCriteria = setup.rowCriteria;
        this.colCriteria = setup.colCriteria;
        // Reset grid state
        this.grid = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
        this.lives = 9;
        this.gameOver = false;
        this.message = 'New board generated!';
        this.summaryAnswers = null; // Clear summary
        this.summaryStats = null;
        this.gridRarity = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
        setTimeout(() => this.message = '', 3000);
      },
      error: (err) => {
        console.error('Regen Error', err);
        if (err.status === 401) {
          alert('Invalid Secret! Access Denied.');
        } else {
          alert('Failed to regenerate board.');
        }
      }
    });
  }

  onGiveUp(): void {
    if (this.gameOver) return;
    this.finishGame('give-up');
  }

  onCellClick(row: number, col: number): void {
    if (this.grid[row][col] || this.gameOver) return;

    this.selectedCell = { row, col };
    this.isSearchOpen = true;
  }

  onMovieSelected(movie: Movie): void {
    if (!this.selectedCell) return;

    // Check if movie is already used
    if (this.grid.some(row => row.some(cell => cell?.id === movie.id))) {
      this.message = `You already used ${movie.title}!`;
      setTimeout(() => this.message = '', 3000);
      this.closeSearch();
      return;
    }

    // Fetch full details (cast/crew) before validation
    this.movieService.getMovieDetails(movie.id).subscribe(fullMovie => {
      if (!fullMovie) {
        this.closeSearch();
        return;
      }

      if (this.selectedCell) {
        const { row, col } = this.selectedCell;
        const rowCrit = this.rowCriteria[row];
        const colCrit = this.colCriteria[col];

        if (this.movieService.validateGuess(fullMovie, rowCrit, colCrit)) {
          this.grid[row][col] = fullMovie;

          // Submit stats asynchronously
          this.movieService.submitGuessStats(row, col, fullMovie.title).subscribe({
            next: (res: any) => {
              if (res.success && res.cellStat) {
                const total = res.cellStat.total;
                const count = res.cellStat.answers[fullMovie.title] || 0;
                const percent = (count / total) * 100;
                this.gridRarity[row][col] = this.calculateRarity(percent);
              }
            },
            error: (e) => console.error('Stats submit failed', e)
          });

          this.checkWinCondition();
        } else {
          this.lives--;
          this.message = `Incorrect! ${movie.title} does not match.`;
          setTimeout(() => this.message = '', 3000);
          if (this.lives <= 0) {
            this.finishGame('loss');
          }
        }
      }
      this.closeSearch();
    });
  }

  closeSearch(): void {
    this.isSearchOpen = false;
    this.selectedCell = null;
  }

  checkWinCondition(): void {
    const allFilled = this.grid.every(row => row.every(cell => cell !== null));
    if (allFilled) {
      this.finishGame('win');
    }
  }

  finishGame(result: 'win' | 'loss' | 'give-up'): void {
    this.gameOver = true;
    if (result === 'win') this.message = 'You Won!';
    else if (result === 'loss') this.message = 'Game Over!';
    else this.message = 'You Gave Up!';

    // Fetch answers for summary
    this.movieService.getDailyAnswers().subscribe(data => {
      this.summaryAnswers = data.possibleAnswers;
    });

    // Fetch stats
    this.movieService.getDailyGameStats().subscribe(stats => {
      this.summaryStats = stats;
    });
  }

  calculateRarity(percent: number): RarityInfo {
    if (percent < 5) return { label: 'Legendary', colorClass: 'legendary', percent: Math.round(percent) };
    if (percent < 10) return { label: 'Epic', colorClass: 'epic', percent: Math.round(percent) };
    if (percent < 25) return { label: 'Rare', colorClass: 'rare', percent: Math.round(percent) };
    if (percent < 50) return { label: 'Uncommon', colorClass: 'uncommon', percent: Math.round(percent) };
    return { label: 'Common', colorClass: 'common', percent: Math.round(percent) };
  }
}
