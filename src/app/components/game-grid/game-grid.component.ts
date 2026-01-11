import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie, Criteria, MovieService } from '../../services/movie.service';
import { SearchComponent } from '../search/search.component';

@Component({
  selector: 'app-game-grid',
  standalone: true,
  imports: [CommonModule, SearchComponent],
  templateUrl: './game-grid.component.html',
  styleUrl: './game-grid.component.css' // Angular 17+ uses styleUrl (singular)
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

  constructor(private movieService: MovieService) { }

  ngOnInit(): void {
    this.movieService.getGameSetup().subscribe(setup => {
      this.rowCriteria = setup.rowCriteria;
      this.colCriteria = setup.colCriteria;
    });
  }

  onRegenerate(): void {
    this.movieService.regenerateBoard().subscribe(setup => {
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
      setTimeout(() => this.message = '', 3000);
    });
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

  finishGame(result: 'win' | 'loss'): void {
    this.gameOver = true;
    this.message = result === 'win' ? 'You Won!' : 'Game Over!';

    // Prepare game data
    const gameData = {
      result,
      score: 9 - (9 - this.lives), // Simple score calculation
      gridState: this.grid,
      rowCriteria: this.rowCriteria,
      colCriteria: this.colCriteria
    };

    this.movieService.saveGame(gameData).subscribe({
      next: (res) => console.log('Game saved:', res),
      error: (err) => console.error('Failed to save game:', err)
    });
  }
}
