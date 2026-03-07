const mongoose = require('mongoose');

const GuessStatSchema = new mongoose.Schema({
    date: { type: String, required: true }, // YYYY-MM-DD
    row: { type: Number, required: true },
    col: { type: Number, required: true },
    movieId: { type: String, required: true },
    count: { type: Number, default: 0 },
    movieDetails: {
        title: String,
        poster_path: String,
        release_date: String
    }
});

// Create a compound unique index to prevent duplicates and speed up upserts
GuessStatSchema.index({ date: 1, row: 1, col: 1, movieId: 1 }, { unique: true });

// Index for querying the top answers for a specific cell on a given day efficiently
GuessStatSchema.index({ date: 1, row: 1, col: 1, count: -1 });

module.exports = mongoose.model('GuessStat', GuessStatSchema);
