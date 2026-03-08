const rateLimit = require('express-rate-limit');

// 1. General Fallback Rate Limiter (All /api routes)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// 2. Strict TMDB Proxy Limiter
// Prevents exhausting the TMDB API quota via malicious search spam
const tmdbSearchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 searches per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Search rate limit exceeded. Please try again in a minute.' }
});

// 3. Strict Game Stats Limiter
// Prevents artificially inflating game completion data
const statsSubmitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 stat submissions per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Stats submission limit exceeded. Please try again later.' }
});

module.exports = {
    generalLimiter,
    tmdbSearchLimiter,
    statsSubmitLimiter
};
