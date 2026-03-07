const NodeCache = require('node-cache');

// Create a single shared cache instance with a default TTL of 12 hours (43200 seconds)
// and check for expired keys every 10 minutes
const cache = new NodeCache({ stdTTL: 43200, checkperiod: 600 });

module.exports = cache;
