const mongoose = require('mongoose');

const DailyGameStatsSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    // 3x3 grid. Each cell: { total: Number, answers: { "MovieID": { count: Number, poster_path: String } } }
    cellStats: { type: mongoose.Schema.Types.Mixed, default: [] },
    totalCompletedGames: { type: Number, default: 0 }
});

module.exports = mongoose.model('DailyGameStats', DailyGameStatsSchema);
