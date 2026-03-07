import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError } from 'rxjs';
import { Movie as SharedMovie, Criteria as SharedCriteria } from '@shared/types';
import { mapTMDBToMovie } from '@shared/validation';

export interface Movie extends SharedMovie { }
export interface Criteria extends SharedCriteria { }

@Injectable({
  providedIn: 'root'
})
export class MovieService {
  constructor(private http: HttpClient) { }

  getGameSetup(date?: string): Observable<{ date?: string, rowCriteria: Criteria[], colCriteria: Criteria[] }> {
    const url = date ? `/api/game/setup?date=${date}` : '/api/game/setup';
    return this.http.get<{ date?: string, rowCriteria: Criteria[], colCriteria: Criteria[] }>(url);
  }

  getArchiveDates(): Observable<{ availableDates: string[] }> {
    return this.http.get<{ availableDates: string[] }>('/api/game/archive');
  }



  regenerateBoard(secret: string): Observable<{ date?: string, rowCriteria: Criteria[], colCriteria: Criteria[] }> {
    return this.http.get<{ date?: string, rowCriteria: Criteria[], colCriteria: Criteria[] }>('/api/game/regenerate', {
      headers: { 'Authorization': `Bearer ${secret}` }
    });
  }

  submitGuessStats(row: number, col: number, movieId: number, date?: string): Observable<any> {
    return this.http.post('/api/game/stats', { row, col, movieId, date });
  }

  completeGame(attempts: number, solvedCells: { row: number, col: number }[], date?: string): Observable<any> {
    return this.http.post('/api/game/complete', { attempts, solvedCells, date });
  }

  getDailyGameStats(date?: string): Observable<{ cellStats: any[][], totalCompletedGames: number }> {
    const url = date ? `/api/game/stats?date=${date}` : '/api/game/stats';
    return this.http.get<{ cellStats: any[][], totalCompletedGames: number }>(url);
  }

  searchMovies(query: string): Observable<Movie[]> {
    if (!query) return of([]);
    // Call backend proxy
    const url = `/api/tmdb/search?query=${encodeURIComponent(query)}`;
    return this.http.get<any>(url).pipe(
      map(response => response.results.map((m: any) => ({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
        release_date: m.release_date,
        genres: m.genre_ids
      }))),
      catchError(error => {
        console.error('Search error', error);
        return of([]);
      })
    );
  }

  // Fetch full details including credits, release dates, keywords
  getMovieDetails(id: number): Observable<Movie | null> {
    const url = `/api/tmdb/movie/${id}`;
    return this.http.get<any>(url).pipe(
      map(data => {
        return mapTMDBToMovie(data);
      }),
      catchError((err) => {
        console.error('getMovieDetails ERROR:', err);
        return of(null);
      })
    );
  }

  // The validateGuess and checkCriteria logic has been moved to shared/validation.ts

}
