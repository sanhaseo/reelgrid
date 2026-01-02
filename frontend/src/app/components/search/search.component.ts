import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Movie, MovieService } from '../../services/movie.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent {
  query = '';
  results: Movie[] = [];
  searchSubject = new Subject<string>();

  @Output() movieSelected = new EventEmitter<Movie>();
  @Output() close = new EventEmitter<void>();

  constructor(private movieService: MovieService) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.movieService.searchMovies(query))
    ).subscribe(movies => {
      this.results = movies;
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.query);
  }

  selectMovie(movie: Movie): void {
    this.movieSelected.emit(movie);
  }

  closeModal(): void {
    this.close.emit();
  }
}
