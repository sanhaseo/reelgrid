const mongoose = require('mongoose');

const DailyGameStatsSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    // 3x3 grid. Each cell: { total: Number, answers: { "Movie Title": { count: Number, poster_path: String, id: Number } } }
    cellStats: { type: mongoose.Schema.Types.Mixed, default: [] }
});

module.exports = mongoose.model('DailyGameStats', DailyGameStatsSchema);
