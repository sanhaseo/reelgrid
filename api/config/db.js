const mongoose = require('mongoose');

// Mongoose Connection Event Listeners
mongoose.connection.on('connected', () => {
    console.log('MongoDB connection established successfully');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error encountered:', err);
    // Mongoose driver will often automatically attempt to reconnect on transient errors
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected! The driver will attempt to recover the connection automatically in the background...');
});

const connectDB = async () => {
    // Retry configurations
    const MAX_RETRIES = 5;
    const RETRY_INTERVAL_MS = 5000;

    // Mongoose connection pool options for resiliency
    const options = {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging for 30s
        heartbeatFrequencyMS: 10000,    // Ping MongoDB every 10s to ensure socket is alive
        retryWrites: true               // Automatically retry failed writes 
    };

    let retries = 0;

    const connectWithRetry = async () => {
        try {
            await mongoose.connect(process.env.MONGODB_URI, options);
        } catch (err) {
            retries++;
            console.error(`MongoDB connection attempt ${retries} failed:`, err.message);

            if (retries < MAX_RETRIES) {
                console.log(`Retrying MongoDB connection in ${RETRY_INTERVAL_MS / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
                return connectWithRetry();
            } else {
                console.error(`MongoDB connection utterly failed after ${MAX_RETRIES} attempts. Triggering fatal exit.`);
                process.exit(1);
            }
        }
    };

    await connectWithRetry();
};

module.exports = connectDB;
