const express = require('express');
const router = express.Router();
const DailyGame = require('../models/DailyGame');
const DailyGameStats = require('../models/DailyGameStats');
const { generateBoard } = require('../services/game.service');

// Get Available Archive Dates
router.get('/archive', async (req, res) => {
    try {
        const games = await DailyGame.find({}, 'date').sort({ date: -1 });
        const availableDates = games.map(g => g.date);
        res.json({ availableDates });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch archive dates' });
    }
});

// Get Daily Game Setup (or specific archived date)
router.get('/setup', async (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const requestedDate = req.query.date || today;

    try {
        // 1. Check if the specific daily game exists
        let dailyGame = await DailyGame.findOne({ date: requestedDate });

        if (dailyGame) {
            return res.json({
                date: dailyGame.date,
                rowCriteria: dailyGame.rowCriteria,
                colCriteria: dailyGame.colCriteria,
                isNew: false
            });
        }

        // If a past date was requested but not found, return an error
        if (requestedDate !== today) {
            return res.status(404).json({ error: 'Archived game not found' });
        }

        // 2. If it's today and not found, generate new one
        const board = await generateBoard();
        if (!board) {
            return res.status(500).json({ error: 'Failed to generate valid board' });
        }

        // 3. Save it
        dailyGame = new DailyGame({
            date: today,
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria
        });
        await dailyGame.save();

        res.json({
            date: today,
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria,
            isNew: true
        });

    } catch (e) {
        console.error('Setup Error', e);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Submit Game Stat (Increment count for a guess)
router.post('/stats', async (req, res) => {
    const { row, col, movie, date } = req.body;
    if (!movie || !movie.id) {
        return res.status(400).json({ error: 'Invalid movie data' });
    }
    const today = date || new Date().toISOString().split('T')[0];

    try {
        let stats = await DailyGameStats.findOne({ date: today });

        if (!stats) {
            stats = new DailyGameStats({ date: today, cellStats: [], totalCompletedGames: 0 });
        }

        // Initialize grid if empty or partial
        if (!Array.isArray(stats.cellStats)) stats.cellStats = [];
        for (let r = 0; r < 3; r++) {
            if (!stats.cellStats[r]) stats.cellStats[r] = [];
            for (let c = 0; c < 3; c++) {
                if (!stats.cellStats[r][c]) {
                    stats.cellStats[r][c] = { total: 0, answers: {} };
                }
                // Double check answers object exists
                if (!stats.cellStats[r][c].answers) {
                    stats.cellStats[r][c].answers = {};
                }
            }
        }

        // Increment counts
        stats.cellStats[row][col].total = (stats.cellStats[row][col].total || 0) + 1;

        const movieId = movie.id.toString();

        let entry = stats.cellStats[row][col].answers[movieId];

        // Handle initialization
        if (!entry || typeof entry === 'number') {
            const currentCount = typeof entry === 'number' ? entry : 0;
            entry = {
                count: currentCount,
                poster_path: movie.poster_path, // Could be null, but stats should save it
                title: movie.title,
                release_date: movie.release_date
            };
        } else {
            // Guarantee existing stats get updated with title & release date if previously missing
            entry.title = entry.title || movie.title;
            entry.release_date = entry.release_date || movie.release_date;
        }

        entry.count++;
        stats.cellStats[row][col].answers[movieId] = entry;

        // Mark as modified for Mixed type
        stats.markModified('cellStats');

        await stats.save();
        res.json({
            success: true,
            cellStat: stats.cellStats[row][col]
        });
    } catch (e) {
        console.error('Stats Error', e);
        res.status(500).json({ error: 'Failed to update stats' });
    }
});

// Submit Game Completion
router.post('/complete', async (req, res) => {
    const { attempts, solvedCells, date } = req.body; // solvedCells: [{row, col}, ...]
    const today = date || new Date().toISOString().split('T')[0];

    // Only count as completed if player made at least one attempt
    if (!attempts || attempts <= 0) {
        return res.json({ success: true, ignored: true });
    }

    try {
        let stats = await DailyGameStats.findOne({ date: today });
        if (!stats) {
            stats = new DailyGameStats({ date: today, totalCompletedGames: 0, cellStats: [] });
        }

        // Initialize grid if empty (though stats usually exist by now)
        if (!Array.isArray(stats.cellStats)) stats.cellStats = [];
        for (let r = 0; r < 3; r++) {
            if (!stats.cellStats[r]) stats.cellStats[r] = [];
            for (let c = 0; c < 3; c++) {
                if (!stats.cellStats[r][c]) {
                    stats.cellStats[r][c] = { total: 0, completionCount: 0, answers: {} };
                }
            }
        }

        // Increment total completed games
        stats.totalCompletedGames = (stats.totalCompletedGames || 0) + 1;

        // Increment completionCount for solved cells
        if (Array.isArray(solvedCells)) {
            solvedCells.forEach(({ row, col }) => {
                if (stats.cellStats[row] && stats.cellStats[row][col]) {
                    stats.cellStats[row][col].completionCount = (stats.cellStats[row][col].completionCount || 0) + 1;
                }
            });
        }

        stats.markModified('cellStats');
        await stats.save();

        res.json({ success: true, totalCompletedGames: stats.totalCompletedGames });
    } catch (e) {
        console.error('Completion Submit Error', e);
        res.status(500).json({ error: 'Failed to submit completion' });
    }
});

// Get Daily Game Stats
router.get('/stats', async (req, res) => {
    const today = req.query.date || new Date().toISOString().split('T')[0];
    try {
        const stats = await DailyGameStats.findOne({ date: today });
        res.json({
            cellStats: stats ? stats.cellStats : [],
            totalCompletedGames: stats ? (stats.totalCompletedGames || 0) : 0
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Force Regenerate Daily Game (Protected by CRON_SECRET)
router.get('/regenerate', async (req, res) => {
    // Check for authorization (Vercel Cron sends this header)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const today = new Date().toISOString().split('T')[0];
    try {
        await DailyGame.deleteOne({ date: today });
        await DailyGameStats.deleteOne({ date: today }); // Reset stats for the new board
        const board = await generateBoard();
        if (!board) return res.status(500).json({ error: 'Failed' });

        const dailyGame = new DailyGame({
            date: today,
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria
        });
        await dailyGame.save();

        res.json({
            date: today,
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria
        });
    } catch (e) {
        res.status(500).json({ error: 'Regeneration Failed' });
    }
});

module.exports = router;
