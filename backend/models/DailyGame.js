const mongoose = require('mongoose');

const DailyGameSchema = new mongoose.Schema({
    date: { type: String, unique: true }, // YYYY-MM-DD
    rowCriteria: mongoose.Schema.Types.Mixed,
    colCriteria: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DailyGame', DailyGameSchema);
