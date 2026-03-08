const express = require('express');
const router = express.Router();
const DailyGame = require('../models/DailyGame');
const DailyGameStats = require('../models/DailyGameStats');
const GuessStat = require('../models/GuessStat');
const { statsSubmitLimiter } = require('../middleware/rateLimiter');
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

        // Calculate tomorrow relative to UTC
        let tomorrowObj = new Date();
        tomorrowObj.setUTCDate(tomorrowObj.getUTCDate() + 1);
        const tomorrow = tomorrowObj.toISOString().split('T')[0];

        // If a past date was requested but it doesn't exist, return an error.
        // We only allow lazy-generation if the requested date is Today or Tomorrow (for early timezones).
        if (requestedDate !== today && requestedDate !== tomorrow) {
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
router.post('/stats', statsSubmitLimiter, async (req, res) => {
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
        let stats = await DailyGameStats.findOneAndUpdate(
            { date: today },
            { $inc: { [`cellStats.${row}.${col}.total`]: 1 } },
            { new: true }
        );

        if (!stats) {
            // Document doesn't exist yet for this date. Initialize grid safely.
            const emptyCellStats = Array(3).fill(null).map(() =>
                Array(3).fill(null).map(() => ({ total: 0, completionCount: 0 }))
            );

            // Apply this guess's stats locally
            emptyCellStats[row][col].total = 1;

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
                        { $inc: { [`cellStats.${row}.${col}.total`]: 1 } },
                        { new: true }
                    );
                } else {
                    throw err;
                }
            }
        }

        // Upsert into GuessStat collection
        const guessStat = await GuessStat.findOneAndUpdate(
            { date: today, row, col, movieId: movieIdStr },
            {
                $inc: { count: 1 },
                $set: {
                    movieDetails: {
                        title: fullMovie.title,
                        poster_path: fullMovie.poster_path,
                        release_date: fullMovie.release_date
                    }
                }
            },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            cellStat: {
                total: stats.cellStats[row][col].total,
                answers: {
                    [movieIdStr]: {
                        count: guessStat.count,
                        poster_path: fullMovie.poster_path,
                        title: fullMovie.title,
                        release_date: fullMovie.release_date
                    }
                }
            }
        });
    } catch (e) {
        console.error('Stats Error', e);
        res.status(500).json({ error: 'Failed to update stats' });
    }
});

// Submit Game Completion
router.post('/complete', statsSubmitLimiter, async (req, res) => {
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
                Array(3).fill(null).map(() => ({ total: 0, completionCount: 0 }))
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
        const cellStats = stats ? stats.cellStats : [];

        if (stats) {
            // Retrieve top 100 answers for each cell to display in the UI summary using an aggregation pipeline
            const topGuesses = await GuessStat.aggregate([
                { $match: { date: today } },
                { $sort: { count: -1 } },
                {
                    $group: {
                        _id: { row: "$row", col: "$col" },
                        guesses: { $push: "$$ROOT" }
                    }
                },
                {
                    $project: {
                        guesses: { $slice: ["$guesses", 100] }
                    }
                }
            ]);

            // Reassemble the dictionary shape the frontend expects
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    if (!cellStats[r][c].answers) cellStats[r][c].answers = {};
                }
            }

            topGuesses.forEach(group => {
                const row = group._id.row;
                const col = group._id.col;
                group.guesses.forEach(guess => {
                    cellStats[row][col].answers[guess.movieId] = {
                        count: guess.count,
                        poster_path: guess.movieDetails.poster_path,
                        title: guess.movieDetails.title,
                        release_date: guess.movieDetails.release_date
                    };
                });
            });
        }

        res.json({
            cellStats: cellStats,
            totalCompletedGames: stats ? (stats.totalCompletedGames || 0) : 0
        });
    } catch (e) {
        console.error('Fetch Stats Error', e);
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

    // Always generate the board for "Tomorrow" since the cron job 
    // runs 16 hours ahead of the UTC midnight rollover.
    let targetDateObj = new Date();
    targetDateObj.setUTCDate(targetDateObj.getUTCDate() + 1);

    const targetDateStr = targetDateObj.toISOString().split('T')[0];

    try {
        await DailyGame.deleteOne({ date: targetDateStr });
        await DailyGameStats.deleteOne({ date: targetDateStr }); // Reset stats for the new board
        const board = await generateBoard();
        if (!board) return res.status(500).json({ error: 'Failed' });

        const dailyGame = new DailyGame({
            date: targetDateStr,
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria
        });
        await dailyGame.save();

        res.json({
            date: targetDateStr,
            rowCriteria: board.rowCriteria,
            colCriteria: board.colCriteria
        });
    } catch (e) {
        res.status(500).json({ error: 'Regeneration Failed' });
    }
});

module.exports = router;
