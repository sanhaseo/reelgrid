function validateGuess(movie, rowCriterium, colCriterium) {
    const rowMatch = checkCriteria(movie, rowCriterium);
    const colMatch = checkCriteria(movie, colCriterium);
    return rowMatch && colMatch;
}

function checkCriteria(movie, criteria) {
    switch (criteria.type) {
        case 'director':
            return movie.director === criteria.value;

        case 'actor':
            return movie.cast?.includes(criteria.value) ?? false;

        case 'genre':
            return movie.genres.includes(criteria.value);

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
            const cleanTitle = movie.title ? movie.title.trim() : '';

            if (Array.isArray(criteria.value)) {
                if (criteria.idValue === 'ends_with' || (criteria.id && criteria.id.startsWith('ends_with'))) {
                    const titleForEndsWith = cleanTitle.toUpperCase().replace(/[^A-Z0-9]+$/, '');
                    return criteria.value.some((suffix) => titleForEndsWith.endsWith(suffix.toUpperCase()));
                }

                // Dynamic "Starts with..."
                let titleForStartsWith = cleanTitle.toUpperCase();
                if (titleForStartsWith.startsWith('A ')) titleForStartsWith = titleForStartsWith.substring(2).trim();
                else if (titleForStartsWith.startsWith('AN ')) titleForStartsWith = titleForStartsWith.substring(3).trim();
                else if (titleForStartsWith.startsWith('THE ')) titleForStartsWith = titleForStartsWith.substring(4).trim();

                return criteria.value.some((prefix) => titleForStartsWith.startsWith(prefix.toUpperCase()));
            }

            if (criteria.id === 'one_word' || criteria.id === 'two_word' || criteria.id === 'three_word' || criteria.id === 'four_word') {
                return cleanTitle.split(/\s+/).length === criteria.value;
            }
            if (criteria.id === 'five_plus_word') {
                return cleanTitle.split(/\s+/).length >= criteria.value;
            }
            return false;

        default:
            return false;
    }
}

function mapTMDBToMovie(data) {
    const director = data.credits?.crew?.find(c => c.job === 'Director')?.name || '';
    const cast = data.credits?.cast?.map(c => c.name) || [];
    // Map significant crew
    const crew = data.credits?.crew?.map(c => ({ job: c.job, name: c.name })) || [];

    // Extract US Certification
    let certification = '';
    const usRelease = data.release_dates?.results?.find(r => r.iso_3166_1 === 'US');
    if (usRelease) {
        // Try to find theatrical release first (type 3), then others
        const certEntry = usRelease.release_dates?.find(d => d.certification) || usRelease.release_dates?.[0];
        certification = certEntry ? certEntry.certification : '';
    }

    const keywords = data.keywords?.keywords?.map(k => k.id) || [];
    const production_companies = data.production_companies?.map(c => c.id) || [];

    const movieObj = {
        id: data.id,
        title: data.title,
        poster_path: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '',
        release_date: data.release_date,
        genres: data.genres?.map(g => g.id) || [],
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
    };

    return movieObj;
}

module.exports = {
    validateGuess,
    checkCriteria,
    mapTMDBToMovie
};
