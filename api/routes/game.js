const express = require('express');
const router = express.Router();
const DailyGame = require('../models/DailyGame');
const DailyGameStats = require('../models/DailyGameStats');
const { generateBoard } = require('../services/game.service');
const { getMovieDetailsFromTMDB } = require('../services/validation.service');
const { validateGuess } = require('../../shared/validation');

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
    const { row, col, movieId, date } = req.body;

    // 1. Strict Input Validation (Prevent NoSQL Injection)
    const validIndexes = [0, 1, 2];
    if (!validIndexes.includes(row) || !validIndexes.includes(col)) {
        return res.status(400).json({ error: 'Invalid row or col index' });
    }

    if (!movieId) {
        return res.status(400).json({ error: 'Invalid movie data' });
    }

    const today = date || new Date().toISOString().split('T')[0];
    const movieIdStr = movieId.toString();

    try {
        // 2. Server-side Guess Validation
        // Fetch the day's criteria
        const dailyGame = await DailyGame.findOne({ date: today });
        if (!dailyGame) {
            return res.status(404).json({ error: 'Game board not found for this date' });
        }

        const rowCriterium = dailyGame.rowCriteria[row];
        const colCriterium = dailyGame.colCriteria[col];

        // Fetch full movie details from TMDB
        const fullMovie = await getMovieDetailsFromTMDB(movieIdStr);
        if (!fullMovie) {
            return res.status(404).json({ error: 'Movie not found in TMDB' });
        }

        // Validate
        const isValid = validateGuess(fullMovie, rowCriterium, colCriterium);
        if (!isValid) {
            return res.status(400).json({ error: 'Incorrect movie guess' });
        }

        // 3. Proceed with updating stats
        const updateDoc = {
            $inc: {
                [`cellStats.${row}.${col}.total`]: 1,
                [`cellStats.${row}.${col}.answers.${movieIdStr}.count`]: 1
            },
            $set: {
                [`cellStats.${row}.${col}.answers.${movieIdStr}.poster_path`]: fullMovie.poster_path,
                [`cellStats.${row}.${col}.answers.${movieIdStr}.title`]: fullMovie.title,
                [`cellStats.${row}.${col}.answers.${movieIdStr}.release_date`]: fullMovie.release_date
            }
        };

        let stats = await DailyGameStats.findOneAndUpdate(
            { date: today },
            updateDoc,
            { new: true }
        );

        if (!stats) {
            // Document doesn't exist yet for this date. Initialize grid safely.
            const emptyCellStats = Array(3).fill(null).map(() =>
                Array(3).fill(null).map(() => ({ total: 0, completionCount: 0, answers: {} }))
            );

            // Apply this guess's stats locally
            emptyCellStats[row][col].total = 1;
            emptyCellStats[row][col].answers[movieIdStr] = {
                count: 1,
                poster_path: fullMovie.poster_path,
                title: fullMovie.title,
                release_date: fullMovie.release_date
            };

            try {
                stats = await DailyGameStats.create({
                    date: today,
                    cellStats: emptyCellStats,
                    totalCompletedGames: 0
                });
            } catch (err) {
                // Handle duplicate key error if another concurrent request created it first
                if (err.code === 11000) {
                    stats = await DailyGameStats.findOneAndUpdate(
                        { date: today },
                        updateDoc,
                        { new: true }
                    );
                } else {
                    throw err;
                }
            }
        }

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

    let batchUpdate = {
        $inc: { totalCompletedGames: 1 }
    };

    if (Array.isArray(solvedCells) && solvedCells.length > 0) {
        solvedCells.forEach(({ row, col }) => {
            batchUpdate.$inc[`cellStats.${row}.${col}.completionCount`] = 1;
        });
    }

    try {
        let stats = await DailyGameStats.findOneAndUpdate(
            { date: today },
            batchUpdate,
            { new: true }
        );

        if (!stats) {
            // Highly unlikely to complete a game before any guesses are logged, but handle safely
            const emptyCellStats = Array(3).fill(null).map(() =>
                Array(3).fill(null).map(() => ({ total: 0, completionCount: 0, answers: {} }))
            );
            if (Array.isArray(solvedCells)) {
                solvedCells.forEach(({ row, col }) => {
                    emptyCellStats[row][col].completionCount = 1;
                });
            }

            try {
                stats = await DailyGameStats.create({
                    date: today,
                    cellStats: emptyCellStats,
                    totalCompletedGames: 1
                });
            } catch (err) {
                if (err.code === 11000) {
                    stats = await DailyGameStats.findOneAndUpdate(
                        { date: today },
                        batchUpdate,
                        { new: true }
                    );
                } else {
                    throw err;
                }
            }
        }

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
