const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('./config/db');
const tmdbRoutes = require('./routes/tmdb');
const gameRoutes = require('./routes/game');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/game', gameRoutes);

// Serve Static Files (Frontend) - Local Dev Only
// In production, Vercel will handle this.
const frontendPath = path.join(__dirname, '../frontend/dist/cine-grid-app/browser');
app.use(express.static(frontendPath));

// Fallback for SPA routing
app.get('*splat', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start Server
if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
