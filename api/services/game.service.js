const { CRITERIA_POOLS } = require('../criteriaPools');
const { checkIntersection } = require('./tmdb.service');

// Helper to generate dynamic title criteria
function generateDynamicTitleCriteria() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const size = 3;
    let chars = [];
    while (chars.length < size) {
        const char = alphabet[Math.floor(Math.random() * alphabet.length)];
        if (!chars.includes(char)) chars.push(char);
    }
    chars.sort();
    return {
        id: `starts_with_${chars.join('')}`,
        label: `Starts with ${chars.join(', ')}`,
        value: chars, // Array of letters
        type: 'title',
        idValue: 'starts_with'
    };
}

// Weighted Type Deck configuration
const TYPE_DECK = [
    'actor', 'actor', 'actor', 'actor', // 3x Actor
    'director', 'director',    // 2x Director
    'genre', 'genre',          // 2x Genre
    'title', 'title',          // 2x Title
    'company',
    'keyword',
    'year',
    'runtime',
    'rating'
];

async function generateBoard() {
    let attempts = 0;
    while (attempts < 500) {
        attempts++;
        console.log(`Attempt ${attempts}`);

        // 1. Pick 6 types from the deck
        const shuffledTypes = [...TYPE_DECK].sort(() => 0.5 - Math.random()).slice(0, 6);

        let selected = [];
        const usedIds = new Set();

        for (const type of shuffledTypes) {
            let candidate;

            // Handle Dynamic/Special types
            if (type === 'title') {
                // 50% chance of Dynamic, 50% chance of Static (if available)
                // Actually, let's mix dynamic and static.
                const staticTitles = CRITERIA_POOLS.title; // e.g. One Word
                const useDynamic = Math.random() > 0.5;

                if (useDynamic) {
                    candidate = generateDynamicTitleCriteria();
                } else if (staticTitles.length > 0) {
                    candidate = staticTitles[Math.floor(Math.random() * staticTitles.length)];
                } else {
                    candidate = generateDynamicTitleCriteria(); // Fallback
                }
            } else {
                // Map type to pool key
                const poolKey = type === 'year' ? 'decades' : type + 's'; // e.g. director -> directors
                const pool = CRITERIA_POOLS[poolKey] || CRITERIA_POOLS[type]; // fallback if key matches

                if (!pool || pool.length === 0) continue;

                // Try to find a unique candidate
                let retries = 0;
                while (retries < 10) {
                    const item = pool[Math.floor(Math.random() * pool.length)];
                    if (!usedIds.has(item.id)) {
                        candidate = item;
                        break;
                    }
                    retries++;
                }
            }

            if (candidate) {
                // Clone and ensure type is set
                const criteria = { ...candidate, type };
                selected.push(criteria);
                usedIds.add(criteria.id);
            }
        }

        if (selected.length < 6) continue;

        const rowCriteria = selected.slice(0, 3);
        const colCriteria = selected.slice(3, 6);

        let validBoard = true;
        let possibleAnswers = [[], [], []]; // 3x3 grid

        for (let r = 0; r < 3; r++) {
            possibleAnswers[r] = [];
            for (let c = 0; c < 3; c++) {
                const matches = await checkIntersection(rowCriteria[r], colCriteria[c]);
                if (!matches || matches.length <= 1) { // Ensure at least 2 potential answers for solvability
                    validBoard = false;
                    break;
                }
                // Store minimal movie data to save space
                possibleAnswers[r][c] = matches.map(m => ({
                    id: m.id,
                    title: m.title,
                    poster_path: m.poster_path,
                    release_date: m.release_date
                }));
            }
            if (!validBoard) break;
        }

        if (validBoard) {
            console.log('Generated valid board in ' + attempts + ' attempts');
            return { rowCriteria, colCriteria, possibleAnswers };
        }
    }
    return null;
}

module.exports = { generateBoard };
