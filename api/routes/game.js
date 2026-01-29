const express = require('express');
const router = express.Router();
const DailyGame = require('../models/DailyGame');
const DailyGameStats = require('../models/DailyGameStats');
const { generateBoard } = require('../services/game.service');

// Get Daily Game Setup
router.get('/setup', async (req, res) => {
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
router.get('/answers', async (req, res) => {
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

// Submit Game Stat (Increment count for a guess)
router.post('/stats', async (req, res) => {
    const { row, col, movie } = req.body;
    if (!movie || !movie.title) {
        return res.status(400).json({ error: 'Invalid movie data' });
    }
    const today = new Date().toISOString().split('T')[0];
    const movieTitle = movie.title;

    try {
        let stats = await DailyGameStats.findOne({ date: today });

        if (!stats) {
            stats = new DailyGameStats({ date: today, cellStats: [] });
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
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path
            };
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

// Get Daily Game Stats
router.get('/stats', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const stats = await DailyGameStats.findOne({ date: today });
        res.json(stats ? stats.cellStats : []);
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
            colCriteria: board.colCriteria,
            possibleAnswers: board.possibleAnswers
        });
        await dailyGame.save();

        res.json({
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria
        });
    } catch (e) {
        res.status(500).json({ error: 'Regeneration Failed' });
    }
});

module.exports = router;
