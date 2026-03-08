const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../backend/config/db');
const tmdbRoutes = require('../backend/routes/tmdb');
const gameRoutes = require('../backend/routes/game');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
// Routes
const { generalLimiter } = require('../backend/middleware/rateLimiter');

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, Vercel, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', 1);

// Apply general rate limiting to all /api routes
app.use('/api', generalLimiter);

app.use('/api/tmdb', tmdbRoutes);
app.use('/api/game', gameRoutes);

// Serve Static Files (Frontend) - Local Dev Only
// In production, Vercel will handle this.
const frontendPath = path.join(__dirname, '../dist/reelgrid-app/browser');
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
