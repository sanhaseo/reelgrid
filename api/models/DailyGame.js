const mongoose = require('mongoose');

const DailyGameSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    rowCriteria: mongoose.Schema.Types.Mixed,
    colCriteria: mongoose.Schema.Types.Mixed,
    possibleAnswers: mongoose.Schema.Types.Mixed, // 3x3 grid of movie arrays
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DailyGame', DailyGameSchema);
