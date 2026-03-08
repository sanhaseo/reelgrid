const { TMDB_BASE_URL, getHeaders } = require('./tmdb.service');
const { mapTMDBToMovie } = require('../../shared/validation');
const cache = require('../utils/cache');

// Fetch full details including credits, release dates, keywords
async function getMovieDetailsFromTMDB(id) {
    const cacheKey = `movie_${id}`;
    const cachedMovie = cache.get(cacheKey);

    // If the frontend already looked up this movie recently via the proxy route, 
    // it will be instantly loaded from memory here.
    if (cachedMovie) {
        // console.log(`[CACHE HIT] Validation Service: ${id}`);
        return mapTMDBToMovie(cachedMovie);
    }

    const url = `${TMDB_BASE_URL}/movie/${id}?append_to_response=credits,release_dates,keywords`;
    try {
        // console.log(`[CACHE MISS] Fetching Validation Service TMDB: ${id}`);
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) return null;
        const data = await res.json();

        // Populate cache for 12 hours
        cache.set(cacheKey, data);

        return mapTMDBToMovie(data);
    } catch (e) {
        console.error('getMovieDetailsFromTMDB ERROR:', e);
        return null;
    }
}

module.exports = {
    getMovieDetailsFromTMDB
};
