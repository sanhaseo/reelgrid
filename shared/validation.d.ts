import { Movie, Criteria } from './types';

export function validateGuess(movie: Movie, rowCriterium: Criteria, colCriterium: Criteria): boolean;
export function checkCriteria(movie: Movie, criteria: Criteria): boolean;
export function mapTMDBToMovie(data: any): Movie;
