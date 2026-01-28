import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie, Criteria, MovieService } from '../../services/movie.service';
import { SearchComponent } from '../search/search.component';
import { GridCellComponent, RarityInfo } from './grid-cell/grid-cell.component';
import { BoardComponent } from './board/board.component';
import { GameSummaryComponent } from './game-summary/game-summary.component';
import { GameStatusComponent } from './game-status/game-status.component';

@Component({
  selector: 'app-game-grid',
  standalone: true,
  imports: [CommonModule, SearchComponent, GridCellComponent, GameSummaryComponent, GameStatusComponent, BoardComponent],
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
  guessesLeft = 10;
  gameOver = false;
  summaryAnswers: Movie[][][] | null = null;
  summaryStats: any[][] | null = null;
  isLoading = true;
  isRegenerating = false;
  incorrectCell: { row: number, col: number } | null = null;

  @ViewChild('summarySection') summarySection!: ElementRef;

  // Store rarity info for filled cells: "Common", "Rare", etc.
  gridRarity: (RarityInfo | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ];

  constructor(private movieService: MovieService) { }

  getUsedMovieIds(): number[] {
    const ids: number[] = [];
    this.grid.forEach(row => {
      row.forEach(cell => {
        if (cell?.id) ids.push(cell.id);
      });
    });
    return ids;
  }

  ngOnInit(): void {
    this.movieService.getGameSetup().subscribe({
      next: (setup) => {
        this.rowCriteria = setup.rowCriteria;
        this.colCriteria = setup.colCriteria;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  onRegenerate(): void {
    const secret = prompt('Enter Admin Secret (CRON_SECRET) to force regeneration:');
    if (!secret) return;

    this.isRegenerating = true;
    this.movieService.regenerateBoard(secret).subscribe({
      next: (setup) => {
        this.isRegenerating = false;
        this.rowCriteria = setup.rowCriteria;
        this.colCriteria = setup.colCriteria;
        // Reset grid state
        this.grid = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
        this.guessesLeft = 10;
        this.gameOver = false;
        this.summaryAnswers = null; // Clear summary
        this.summaryStats = null;
        this.gridRarity = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
      },
      error: (err) => {
        this.isRegenerating = false;
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

        // Decrement guesses left on every attempt
        this.guessesLeft--;

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
          // If won, checkWinCondition will call finishGame('win') which sets gameOver = true.
          // We can check if game is over to prevent loss message below if they won on last life.
        } else {
          this.incorrectCell = { row, col };
          setTimeout(() => this.incorrectCell = null, 500);
        }

        if (this.guessesLeft <= 0 && !this.gameOver) {
          this.finishGame('loss');
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

    // Fetch answers for summary
    this.movieService.getDailyAnswers().subscribe(data => {
      this.summaryAnswers = data.possibleAnswers;

      // Scroll to summary after it renders
      setTimeout(() => {
        this.summarySection?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
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

  selectedCriteria: Criteria | null = null;
  showCriteriaModal = false;

  openCriteriaInfo(criteria: Criteria): void {
    this.selectedCriteria = criteria;
    this.showCriteriaModal = true;
  }

  closeCriteriaModal(): void {
    this.showCriteriaModal = false;
    this.selectedCriteria = null;
  }

  getCriteriaDescription(c: Criteria): string {
    switch (c.type) {
      case 'title':
        return 'Based on the word count of the title.';
      case 'actor':
        return `The movie must feature ${c.label} in the cast.`;
      case 'director':
        return `The movie must be directed by ${c.label}.`;
      case 'company':
        return `Produced by ${c.label}.`;
      case 'box_office':
        return 'Worldwide box office revenue > threshold.';
      case 'year':
        return 'Primary release date within the decade.';
      case 'rating':
        return `US Certification Rating (MPAA) is ${c.value}.`;
      case 'runtime':
        return 'Total runtime including credits.';
      case 'keyword':
        return `Must include the keyword (or belongs to franchise): ${c.label}.`;
      default:
        return 'Standard criteria.';
    }
  }
}
