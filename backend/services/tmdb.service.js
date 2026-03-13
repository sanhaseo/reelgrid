const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const getHeaders = () => ({
    'Authorization': `Bearer ${process.env.TMDB_API_KEY}`,
    'accept': 'application/json'
});

function buildTmdbUrlAndParams(rowCrit, colCrit) {
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

    return { url, postProcessing };
}

function filterMovieByTitle(movie, criteria) {
    const cleanTitle = movie.title ? movie.title.trim() : '';

    if (criteria.idValue === 'starts_with') {
        let titleForStartsWith = cleanTitle.toUpperCase();
        if (titleForStartsWith.startsWith('A ')) titleForStartsWith = titleForStartsWith.substring(2).trim();
        else if (titleForStartsWith.startsWith('AN ')) titleForStartsWith = titleForStartsWith.substring(3).trim();
        else if (titleForStartsWith.startsWith('THE ')) titleForStartsWith = titleForStartsWith.substring(4).trim();

        const prefixes = Array.isArray(criteria.value) ? criteria.value : criteria.value.split(',').map(s => s.trim());
        return prefixes.some(p => titleForStartsWith.startsWith(p.toUpperCase()));
    }
    if (criteria.idValue === 'ends_with') {
        // Strip trailing non-alphanumeric characters (like !, ?, etc.) for a fair endsWith check
        let titleForEndsWith = cleanTitle.toUpperCase().replace(/[^A-Z0-9]+$/, '');
        const suffixes = Array.isArray(criteria.value) ? criteria.value : criteria.value.split(',').map(s => s.trim());
        return suffixes.some(s => titleForEndsWith.endsWith(s.toUpperCase()));
    }
    if (criteria.idValue === 'word_count') {
        return cleanTitle.split(/\s+/).length === criteria.value;
    }
    if (criteria.idValue === 'word_count_min') {
        return cleanTitle.split(/\s+/).length >= criteria.value;
    }
    return false;
}

async function fetchWithPostProcessing(url, headers, postProcessing, minMatches) {
    let validMatches = [];
    let page = 1;
    const MAX_PAGES = 5;

    while (page <= MAX_PAGES) {
        const pageUrl = url.replace('page=1', `page=${page}`);
        const res = await fetch(pageUrl, { headers });
        const data = await res.json();

        if (!data.results || data.results.length === 0) break;

        const filtered = data.results.filter(movie => {
            return postProcessing.every(criteria => filterMovieByTitle(movie, criteria));
        });

        validMatches.push(...filtered);

        // Stop early if we have enough matches to consider the intersection solvable (at least minMatches)
        if (validMatches.length >= minMatches) break;

        // Stop if we've reached the last available page from TMDB
        if (page >= data.total_pages) break;

        page++;
    }

    return validMatches.length >= minMatches ? validMatches : null;
}

async function checkIntersection(rowCrit, colCrit, minMatches = 1) {
    const headers = getHeaders();
    try {
        const { url, postProcessing } = buildTmdbUrlAndParams(rowCrit, colCrit);

        if (postProcessing.length > 0) {
            return await fetchWithPostProcessing(url, headers, postProcessing, minMatches);
        }

        // Default behavior for criteria that are filtered natively by TMDB
        const res = await fetch(url, { headers });
        const data = await res.json();
        return data.total_results >= minMatches ? data.results : null;

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
