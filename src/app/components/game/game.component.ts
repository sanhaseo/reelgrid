import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie, Criteria, MovieService } from '../../services/movie.service';
import { SearchComponent } from '../search/search.component';
import { GridCellComponent } from './grid-cell/grid-cell.component';
import { BoardComponent } from './board/board.component';
import { calculateRarity, RarityInfo } from '../../utils/rarity';
import { GameSummaryComponent } from './game-summary/game-summary.component';
import { GameStatusComponent } from './game-status/game-status.component';
import { ArchiveModalComponent } from './archive-modal/archive-modal.component';
import { AboutModalComponent } from './about-modal/about-modal.component';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, SearchComponent, GridCellComponent, GameSummaryComponent, GameStatusComponent, BoardComponent, ArchiveModalComponent, AboutModalComponent],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent implements OnInit {
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
  totalCompletedGames = 0;
  boardDate = '';
  activeBoardDate = ''; // The 'YYYY-MM-DD' of the currently loaded board

  showArchiveModal = false;
  archiveDates: string[] = [];

  showAboutModal = false;

  @ViewChild('summarySection') summarySection!: ElementRef;

  // Store rarity info for filled cells: "Common", "Rare", etc.
  gridRarity: (RarityInfo | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ];

  selectedCriteria: Criteria | null = null;
  showCriteriaModal = false;

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

  formatDate(dateString: string): string {
    if (!dateString) return '';
    // Append T00:00:00 to parse correctly in local time zone without rolling back a day
    const d = new Date(`${dateString}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  ngOnInit(): void {
    this.loadBoard(); // Loads today's board by default
  }

  loadBoard(date?: string): void {
    this.isLoading = true;
    this.summaryStats = null;
    this.movieService.getGameSetup(date).subscribe({
      next: (setup) => {
        this.rowCriteria = setup.rowCriteria;
        this.colCriteria = setup.colCriteria;
        this.activeBoardDate = setup.date || this.getCurrentGameDate();
        this.boardDate = this.formatDate(this.activeBoardDate);
        this.isLoading = false;

        // Reset state memory before loading
        this.grid = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
        this.gridRarity = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
        this.guessesLeft = 10;
        this.gameOver = false;

        this.loadGameState();

        if (this.showArchiveModal) {
          this.showArchiveModal = false;
        }
      },
      error: (err) => {
        this.isLoading = false;
        alert('Failed to load board.');
        console.error(err);
      }
    });
  }

  getCurrentGameDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  saveGameState(): void {
    if (!this.activeBoardDate) return;

    const state = {
      date: this.activeBoardDate,
      grid: this.grid,
      gridRarity: this.gridRarity,
      guessesLeft: this.guessesLeft,
      gameOver: this.gameOver
    };
    localStorage.setItem(`cinegrid_state_v1_${this.activeBoardDate}`, JSON.stringify(state));
  }

  loadGameState(): void {
    if (!this.activeBoardDate) return;

    // Clean up generic state variable from previous versions
    localStorage.removeItem('cinegrid_state_v1');

    const saved = localStorage.getItem(`cinegrid_state_v1_${this.activeBoardDate}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.date === this.activeBoardDate) {
          this.grid = state.grid;
          this.gridRarity = state.gridRarity;
          this.guessesLeft = state.guessesLeft;
          this.gameOver = state.gameOver;

          if (this.gameOver) {
            this.fetchSummaryData(); // Fetch answers for past boards too
          }
        }
      } catch (e) {
        console.error('Failed to parse saved state', e);
        localStorage.removeItem(`cinegrid_state_v1_${this.activeBoardDate}`);
      }
    }
  }

  openArchiveModal(): void {
    this.movieService.getArchiveDates().subscribe(res => {
      this.archiveDates = res.availableDates;
      this.showArchiveModal = true;
    });
  }

  closeArchiveModal(): void {
    this.showArchiveModal = false;
  }

  openAboutModal(): void {
    this.showAboutModal = true;
  }

  closeAboutModal(): void {
    this.showAboutModal = false;
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
        this.boardDate = this.formatDate(setup.date || this.getCurrentGameDate());
        // Reset grid state
        this.grid = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
        this.guessesLeft = 10;
        this.gameOver = false;
        this.summaryStats = null;
        this.gridRarity = [
          [null, null, null],
          [null, null, null],
          [null, null, null]
        ];
        // Clear old local storage so they start fresh on the new board
        localStorage.removeItem('cinegrid_state_v1');
        this.saveGameState();
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
          this.saveGameState(); // Save early so grid updates

          // Submit stats asynchronously (only send necessary data)
          const statsPayload = {
            id: fullMovie.id,
            poster_path: fullMovie.poster_path,
            title: fullMovie.title,
            release_date: fullMovie.release_date
          };
          this.movieService.submitGuessStats(row, col, statsPayload).subscribe({
            next: (res: any) => {
              if (res.success && res.cellStat) {
                const total = res.cellStat.total - 1;
                const count = res.cellStat.answers[fullMovie.id].count - 1 || 0;
                const percent = total === 0 ? 0 : (count / total) * 100;
                this.gridRarity[row][col] = this.calculateRarity(percent);
                this.saveGameState(); // Save rarity badge
              }
            },
            error: (e) => console.error('Stats submit failed', e)
          });

          this.checkWinCondition();
        } else {
          this.incorrectCell = { row, col };
          setTimeout(() => this.incorrectCell = null, 500);

          if (this.guessesLeft <= 0 && !this.gameOver) {
            this.finishGame('loss');
          } else {
            this.saveGameState();
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

  private fetchSummaryData(): void {
    this.movieService.getDailyGameStats().subscribe(res => {
      this.summaryStats = res.cellStats;
      this.totalCompletedGames = res.totalCompletedGames;

      setTimeout(() => {
        this.summarySection?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
  }

  finishGame(result: 'win' | 'loss' | 'give-up'): void {
    this.gameOver = true;
    this.saveGameState();

    // Submit completion to backend
    const attemptsUsed = 10 - this.guessesLeft;
    const solvedCells: { row: number, col: number }[] = [];

    this.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          solvedCells.push({ row: r, col: c });
        }
      });
    });

    this.movieService.completeGame(attemptsUsed, solvedCells).subscribe(() => {
      this.fetchSummaryData();
    });
  }

  calculateRarity(percent: number): RarityInfo {
    return calculateRarity(percent);
  }

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
