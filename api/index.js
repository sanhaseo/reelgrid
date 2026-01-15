const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const mongoose = require('mongoose');
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));



// Daily Game Schema
const DailyGameSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    rowCriteria: mongoose.Schema.Types.Mixed,
    colCriteria: mongoose.Schema.Types.Mixed,
    possibleAnswers: mongoose.Schema.Types.Mixed, // 3x3 grid of movie arrays
    createdAt: { type: Date, default: Date.now }
});
const DailyGame = mongoose.model('DailyGame', DailyGameSchema);

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
        // Return results if there are any, otherwise null
        return data.total_results > 0 ? data.results : null;
    } catch (e) {
        console.error('Validation Error', e);
        return null;
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

// Helper: Generate a valid board
async function generateBoard() {
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
    while (attempts < 50) {
        attempts++;
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
        let possibleAnswers = [[], [], []]; // 3x3 grid

        for (let r = 0; r < 3; r++) {
            possibleAnswers[r] = [];
            for (let c = 0; c < 3; c++) {
                const matches = await checkIntersection(rowCriteria[r], colCriteria[c]);
                if (!matches || matches.length === 0) {
                    validBoard = false;
                    break;
                }
                // Store minimal movie data to save space
                possibleAnswers[r][c] = matches.map(m => ({
                    id: m.id,
                    title: m.title,
                    poster_path: m.poster_path,
                    release_date: m.release_date
                }));
            }
            if (!validBoard) break;
        }

        if (validBoard) {
            console.log('Generated valid board in ' + attempts + ' attempts');
            return { rowCriteria, colCriteria, possibleAnswers };
        }
    }
    return null;
}

// Get Daily Game Setup
app.get('/api/game/setup', async (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // 1. Check if daily game exists
        let dailyGame = await DailyGame.findOne({ date: today });

        if (dailyGame) {
            return res.json({
                rowCriteria: dailyGame.rowCriteria,
                colCriteria: dailyGame.colCriteria,
                isNew: false
            });
        }

        // 2. If not, generate new one
        const board = await generateBoard();
        if (!board) {
            return res.status(500).json({ error: 'Failed to generate valid board' });
        }

        // 3. Save it
        dailyGame = new DailyGame({
            date: today,
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria,
            possibleAnswers: board.possibleAnswers
        });
        await dailyGame.save();

        // Don't send possibleAnswers to frontend!
        res.json({
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria,
            isNew: true
        });

    } catch (e) {
        console.error('Setup Error', e);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get Daily Game Answers (Reveal Solution)
app.get('/api/game/answers', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const dailyGame = await DailyGame.findOne({ date: today });
        if (!dailyGame) {
            return res.status(404).json({ error: 'No game found for today' });
        }
        res.json({ possibleAnswers: dailyGame.possibleAnswers });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch answers' });
    }
});

// Force Regenerate Daily Game (Protected by CRON_SECRET)
app.post('/api/game/regenerate', async (req, res) => {
    // Check for authorization (Vercel Cron sends this header)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const today = new Date().toISOString().split('T')[0];
    try {
        await DailyGame.deleteOne({ date: today });
        const board = await generateBoard();
        if (!board) return res.status(500).json({ error: 'Failed' });

        const dailyGame = new DailyGame({
            date: today,
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria,
            possibleAnswers: board.possibleAnswers
        });
        await dailyGame.save();

        // Return board without answers for the response (or with them if this is strictly admin)
        // For debugging regen, we might want to see them, but let's effectively clean it for consistency
        res.json({
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria
        });
    } catch (e) {
        res.status(500).json({ error: 'Regeneration Failed' });
    }
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
