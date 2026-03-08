const express = require('express');
const router = express.Router();
const { TMDB_BASE_URL, getHeaders } = require('../services/tmdb.service');
const { tmdbSearchLimiter } = require('../middleware/rateLimiter');
const cache = require('../utils/cache');

// Proxy: Search Movies
router.get('/search', tmdbSearchLimiter, async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json({ results: [] });

    const cacheKey = `search_${query.toLowerCase()}`;
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
        // console.log(`[CACHE HIT] Search: ${query}`);
        return res.json(cachedResponse);
    }

    const headers = getHeaders();
    const url = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    try {
        // console.log(`[CACHE MISS] Fetching Search from TMDB: ${query}`);
        const response = await fetch(url, { headers });
        const data = await response.json();

        // Filter out results with low vote count (popularity proxy)
        if (data.results) {
            data.results = data.results.filter(movie => movie.vote_count >= 10);
        }

        // Cache search results for 2 hours (7200 seconds)
        cache.set(cacheKey, data, 7200);

        res.json(data);
    } catch (error) {
        console.error('Search Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch from TMDB' });
    }
});

// Proxy: Movie Details
router.get('/movie/:id', async (req, res) => {
    const { id } = req.params;

    const cacheKey = `movie_${id}`;
    const cachedMovie = cache.get(cacheKey);

    if (cachedMovie) {
        // console.log(`[CACHE HIT] Movie Details: ${id}`);
        return res.json(cachedMovie);
    }

    const headers = getHeaders();
    const url = `${TMDB_BASE_URL}/movie/${id}?append_to_response=credits,release_dates,keywords,production_companies`;

    try {
        // console.log(`[CACHE MISS] Fetching Movie Details from TMDB: ${id}`);
        const response = await fetch(url, { headers });
        const data = await response.json();

        // Use the global default TTL of 12 hours for movie specifics
        cache.set(cacheKey, data);

        res.json(data);
    } catch (error) {
        console.error('Details Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch from TMDB' });
    }
});

module.exports = router;
