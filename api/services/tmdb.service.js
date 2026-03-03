const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const getHeaders = () => ({
    'Authorization': `Bearer ${process.env.TMDB_API_KEY}`,
    'accept': 'application/json'
});

async function checkIntersection(rowCrit, colCrit) {
    const headers = getHeaders();
    // Add vote_count.gte=50 to filter out obscure movies (proxy for popularity threshold)
    let url = `${TMDB_BASE_URL}/discover/movie?include_adult=false&include_video=false&language=en-US&sort_by=popularity.desc&vote_count.gte=50&page=1`;

    const params = {
        with_people: [],
        with_genres: [],
        with_companies: [],
        with_keywords: [],
        others: []
    };

    let postProcessing = [];

    const extractParams = (c) => {
        switch (c.type) {
            case 'director':
            case 'actor':
                params.with_people.push(c.tmdbId);
                break;
            case 'genre':
                params.with_genres.push(c.value);
                break;
            case 'company':
                params.with_companies.push(c.tmdbId);
                break;
            case 'keyword':
                params.with_keywords.push(c.value);
                break;
            case 'year':
                const [start, end] = c.value.split('-');
                params.others.push(`primary_release_date.gte=${start}-01-01`);
                params.others.push(`primary_release_date.lte=${end}-12-31`);
                break;
            case 'rating':
                params.others.push(`certification_country=US&certification=${c.value}`);
                break;
            case 'runtime':
                if (c.value.min) params.others.push(`with_runtime.gte=${c.value.min}`);
                if (c.value.max) params.others.push(`with_runtime.lte=${c.value.max}`);
                break;
            case 'title':
                postProcessing.push(c);
                break;
        }
    };

    extractParams(rowCrit);
    extractParams(colCrit);

    if (params.with_people.length) url += `&with_people=${params.with_people.join(',')}`; // AND logic (default is AND for comma separated in Discover)
    if (params.with_genres.length) url += `&with_genres=${params.with_genres.join(',')}`;
    if (params.with_companies.length) url += `&with_companies=${params.with_companies.join(',')}`;
    if (params.with_keywords.length) url += `&with_keywords=${params.with_keywords.join(',')}`;
    if (params.others.length) url += `&${params.others.join('&')}`;

    try {
        const res = await fetch(url, { headers });
        const data = await res.json();
        let results = data.total_results > 0 ? data.results : null;

        if (results && postProcessing.length > 0) {
            results = results.filter(movie => {
                return postProcessing.every(criteria => {
                    const cleanTitle = movie.title ? movie.title.trim() : '';

                    if (criteria.idValue === 'starts_with') {
                        const prefixes = Array.isArray(criteria.value) ? criteria.value : criteria.value.split(',').map(s => s.trim());
                        return prefixes.some(p => cleanTitle.toUpperCase().startsWith(p.toUpperCase()));
                    }
                    if (criteria.idValue === 'word_count') {
                        return cleanTitle.split(/\s+/).length === criteria.value;
                    }
                    if (criteria.idValue === 'word_count_min') {
                        return cleanTitle.split(/\s+/).length >= criteria.value;
                    }
                    return false;
                });
            });
            // If filtering leaves no results, return null
            if (results.length === 0) return null;
        }

        return results;
    } catch (e) {
        console.error('Validation Error', e);
        return null;
    }
}

module.exports = {
    TMDB_BASE_URL,
    getHeaders,
    checkIntersection
};
