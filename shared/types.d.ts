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
    count?: number;
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
    idValue?: string;
    tmdbId?: number;
    image?: string;
}
