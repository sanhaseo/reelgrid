const mongoose = require('mongoose');

const DailyGameStatsSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    // 3x3 grid. Each cell: { total: Number, completionCount: Number }
    // Note: The specific movie answers and their individual counts have been moved to the GuessStat collection
    // to prevent this document from exceeding the 16MB MongoDB limit.
    cellStats: { type: mongoose.Schema.Types.Mixed, default: [] },
    totalCompletedGames: { type: Number, default: 0 }
});

module.exports = mongoose.model('DailyGameStats', DailyGameStatsSchema);
