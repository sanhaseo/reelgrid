import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError } from 'rxjs';

export interface Movie {
  id: number;
  title: string;
  poster_path: string;
  release_date: string;
  genres: number[];
  runtime?: number;
  revenue?: number;
  certification?: string;
  cast?: string[];
  crew?: { job: string, name: string }[];
  director?: string;
  collection?: string;
  keywords?: number[];
  production_companies?: number[];
  credits?: any; // To store raw credits response
}

export type CriteriaType =
  | 'genre'
  | 'actor'
  | 'year'
  | 'director'
  | 'box_office'
  | 'runtime'
  | 'rating'
  | 'company' // Production Company (bonus) or Franchise
  | 'collection'
  | 'keyword'
  | 'title';

export interface Criteria {
  id: string;
  type: CriteriaType;
  label: string;
  value: any;
  tmdbId?: number;
}

export interface GameState {
  grid: (Movie | null)[][];
  rowCriteria: Criteria[];
  colCriteria: Criteria[];
}

@Injectable({
  providedIn: 'root'
})
export class MovieService {
  constructor(private http: HttpClient) { }

  getGameSetup(): Observable<{ rowCriteria: Criteria[], colCriteria: Criteria[] }> {
    return this.http.get<{ rowCriteria: Criteria[], colCriteria: Criteria[] }>('/api/game/setup');
  }



  regenerateBoard(secret: string): Observable<{ rowCriteria: Criteria[], colCriteria: Criteria[] }> {
    return this.http.get<{ rowCriteria: Criteria[], colCriteria: Criteria[] }>('/api/game/regenerate', {
      headers: { 'Authorization': `Bearer ${secret}` }
    });
  }

  getDailyAnswers(): Observable<{ possibleAnswers: Movie[][][] }> {
    return this.http.get<{ possibleAnswers: Movie[][][] }>('/api/game/answers');
  }

  submitGuessStats(row: number, col: number, movieTitle: string): Observable<any> {
    return this.http.post('/api/game/stats', { row, col, movieTitle });
  }

  getDailyGameStats(): Observable<any[][]> {
    return this.http.get<any[][]>('/api/game/stats');
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
        const director = data.credits.crew?.find((c: any) => c.job === 'Director')?.name || '';
        const cast = data.credits.cast?.map((c: any) => c.name) || [];
        // Map significant crew
        const crew = data.credits.crew?.map((c: any) => ({ job: c.job, name: c.name })) || [];

        // Extract US Certification
        let certification = '';
        const usRelease = data.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
        if (usRelease) {
          // Try to find theatrical release first (type 3), then others
          const certEntry = usRelease.release_dates.find((d: any) => d.certification) || usRelease.release_dates[0];
          certification = certEntry ? certEntry.certification : '';
        }

        const keywords = data.keywords?.keywords?.map((k: any) => k.id) || [];
        const production_companies = data.production_companies?.map((c: any) => c.id) || [];

        const movieObj = {
          id: data.id,
          title: data.title,
          poster_path: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '',
          release_date: data.release_date,
          genres: data.genres.map((g: any) => g.id),
          runtime: data.runtime,
          revenue: data.revenue,
          certification,
          director,
          cast,
          crew,
          collection: data.belongs_to_collection?.name,
          keywords,
          production_companies,
          credits: data.credits
        } as Movie;

        return movieObj;
      }),
      catchError((err) => {
        console.error('getMovieDetails ERROR:', err);
        return of(null);
      })
    );
  }

  validateGuess(movie: Movie, rowCriterium: Criteria, colCriterium: Criteria): boolean {
    const rowMatch = this.checkCriteria(movie, rowCriterium);
    const colMatch = this.checkCriteria(movie, colCriterium);
    return rowMatch && colMatch;
  }

  private checkCriteria(movie: Movie, criteria: Criteria): boolean {
    switch (criteria.type) {
      case 'director':
        return movie.director === criteria.value;

      case 'actor':
        return movie.cast?.includes(criteria.value) ?? false;

      case 'genre':
        return movie.genres.includes(criteria.value as number);

      case 'year':
        if (!movie.release_date) return false;
        const year = parseInt(movie.release_date.split('-')[0]);
        if (typeof criteria.value === 'string' && criteria.value.includes('-')) {
          const [start, end] = criteria.value.split('-').map(Number);
          return year >= start && year <= end;
        }
        return year === criteria.value;



      case 'runtime':
        if (!movie.runtime) return false;
        if (criteria.value.min) return movie.runtime >= criteria.value.min;
        if (criteria.value.max) return movie.runtime <= criteria.value.max;
        return false;

      case 'rating':
        return movie.certification === criteria.value;

      case 'collection': // Franchise
        return !!movie.collection && movie.collection.includes(criteria.value);

      case 'keyword': // Source material etc
        return movie.keywords?.includes(criteria.value) ?? false;

      case 'company':
        return movie.production_companies?.includes(criteria.tmdbId || criteria.value) ?? false;

      case 'title':
        const cleanTitle = this.normalizeTitle(movie.title);

        if (Array.isArray(criteria.value)) {
          // Dynamic "Starts with..."
          return criteria.value.some((prefix: string) => cleanTitle.toUpperCase().startsWith(prefix.toUpperCase()));
        }



        if (criteria.id === 'one_word' || criteria.id === 'two_word') {
          return cleanTitle.split(/\s+/).length === (criteria.value as number);
        }
        return false;

      default:
        return false;
    }
  }

  private normalizeTitle(title: string): string {
    return title.replace(/^(The|A|An)\s+/i, '').trim();
  }
}
