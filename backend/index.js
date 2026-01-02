const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const headers = {
    'Authorization': `Bearer ${process.env.TMDB_API_KEY}`,
    'accept': 'application/json'
};

const { CRITERIA_POOLS } = require('./criteriaPools');

// Validation Helper
async function checkIntersection(rowCrit, colCrit) {
    // Add vote_count.gte=50 to filter out obscure movies (proxy for popularity threshold)
    let url = `${TMDB_BASE_URL}/discover/movie?include_adult=false&include_video=false&language=en-US&sort_by=popularity.desc&vote_count.gte=50&page=1`;

    const params = {
        with_people: [],
        with_genres: [],
        with_companies: [],
        with_keywords: [],
        others: []
    };

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
        return data.total_results > 0;
    } catch (e) {
        console.error('Validation Error', e);
        return false;
    }
}

// Proxy: Search Movies
app.get('/api/tmdb/search', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json({ results: [] });

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
app.get('/api/tmdb/movie/:id', async (req, res) => {
    const { id } = req.params;
    const url = `${TMDB_BASE_URL}/movie/${id}?append_to_response=credits,release_dates,keywords,production_companies`; // Include production_companies explicitly if needed, though usually in base details
    // Note: production_companies is part of the main response, keywords/credits/release_dates need append

    try {
        const response = await fetch(url, { headers });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Details Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch from TMDB' });
    }
});

app.get('/api/game/setup', async (req, res) => {
    const flatPool = [
        ...CRITERIA_POOLS.directors.map(i => ({ ...i, type: 'director' })),
        ...CRITERIA_POOLS.actors.map(i => ({ ...i, type: 'actor' })),
        ...CRITERIA_POOLS.genres.map(i => ({ ...i, type: 'genre' })),
        ...CRITERIA_POOLS.decades.map(i => ({ ...i, type: 'year' })),
        ...CRITERIA_POOLS.rating.map(i => ({ ...i, type: 'rating' })),
        ...CRITERIA_POOLS.companies.map(i => ({ ...i, type: 'company' })),
        ...CRITERIA_POOLS.keywords.map(i => ({ ...i, type: 'keyword' }))
    ];

    let attempts = 0;
    while (attempts < 20) { // Increased attempts to handle constraints + validation
        attempts++;

        // Select 6 criteria obeying constraints: Actor <= 3, Others <= 1
        let selected = [];
        let typeCounts = {};
        const shuffled = [...flatPool].sort(() => 0.5 - Math.random());

        for (const item of shuffled) {
            if (selected.length >= 6) break;

            const count = typeCounts[item.type] || 0;
            const limit = item.type === 'actor' ? 3 : 1;

            if (count < limit) {
                selected.push(item);
                typeCounts[item.type] = count + 1;
            }
        }

        if (selected.length < 6) continue;

        const rowCriteria = selected.slice(0, 3);
        const colCriteria = selected.slice(3, 6);

        let validBoard = true;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const hasMatch = await checkIntersection(rowCriteria[r], colCriteria[c]);
                if (!hasMatch) {
                    validBoard = false;
                    break;
                }
            }
            if (!validBoard) break;
        }

        if (validBoard) {
            console.log('Generated valid board in ' + attempts + ' attempts');
            return res.json({ rowCriteria, colCriteria });
        }
    }

    res.status(500).json({ error: 'Failed to generate valid board' });
});

// Serve Static Files (Frontend)
// This is only used in local development. In production, Vercel will handle this.
const frontendPath = path.join(__dirname, '../frontend/dist/cine-grid-app/browser');
app.use(express.static(frontendPath));

// Fallback for SPA routing
app.get('*splat', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start Server (Conditional: If run directly, listen. If exported, do nothing.)
if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
