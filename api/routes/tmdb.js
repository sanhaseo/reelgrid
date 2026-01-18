const express = require('express');
const router = express.Router();
const { TMDB_BASE_URL, getHeaders } = require('../services/tmdb.service');

// Proxy: Search Movies
router.get('/search', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json({ results: [] });

    const headers = getHeaders();
    const url = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    try {
        const response = await fetch(url, { headers });
        const data = await response.json();

        // Filter out results with low vote count (popularity proxy)
        if (data.results) {
            data.results = data.results.filter(movie => movie.vote_count >= 10);
        }

        res.json(data);
    } catch (error) {
        console.error('Search Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch from TMDB' });
    }
});

// Proxy: Movie Details
router.get('/movie/:id', async (req, res) => {
    const { id } = req.params;
    const headers = getHeaders();
    const url = `${TMDB_BASE_URL}/movie/${id}?append_to_response=credits,release_dates,keywords,production_companies`;

    try {
        const response = await fetch(url, { headers });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Details Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch from TMDB' });
    }
});

module.exports = router;
