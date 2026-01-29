const mongoose = require('mongoose');

const DailyGameStatsSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    // 3x3 grid. Each cell: { total: Number, answers: { "MovieID": { count: Number, title: String, poster_path: String, id: Number } } }
    cellStats: { type: mongoose.Schema.Types.Mixed, default: [] }
});

module.exports = mongoose.model('DailyGameStats', DailyGameStatsSchema);
