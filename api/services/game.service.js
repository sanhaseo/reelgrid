const { CRITERIA_POOLS } = require('../criteriaPools');
const { checkIntersection } = require('./tmdb.service');

// Helper to generate dynamic title criteria
function generateDynamicTitleCriteria() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const size = 5;
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
    'actor', 'actor', 'actor', // 3x Actor
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

        // 1. Pick 5 types from the deck
        const randomFive = [...TYPE_DECK].sort(() => 0.5 - Math.random()).slice(0, 5);
        // Combine guaranteed actor with random 5, then shuffle position
        const shuffledTypes = ['actor', ...randomFive].sort(() => 0.5 - Math.random());

        let selected = [];
        const usedIds = new Set();

        for (const type of shuffledTypes) {
            let candidate;

            // Handle Dynamic/Special types
            if (type === 'title') {
                // Retry loop for unique title criteria
                let retries = 0;
                while (retries < 10) {
                    const r = Math.random();
                    if (r < 0.25) {
                        // 1/4 chance: One Word (Static)
                        candidate = CRITERIA_POOLS.title.find(t => t.id === 'one_word');
                    } else if (r < 0.5) {
                        // 1/4 chance: Two Words (Static)
                        candidate = CRITERIA_POOLS.title.find(t => t.id === 'two_word');
                    } else if (r < 0.75) {
                        // 1/4 chance: Three Words (Static)
                        candidate = CRITERIA_POOLS.title.find(t => t.id === 'three_word');
                    } else {
                        // 1/4 chance: Starts With (Dynamic)
                        candidate = generateDynamicTitleCriteria();
                    }

                    if (candidate && !usedIds.has(candidate.id)) {
                        break;
                    }
                    candidate = null;
                    retries++;
                }

                // Fallback: If we couldn't find a unique one (e.g. static ones used), force a random dynamic one
                if (!candidate) candidate = generateDynamicTitleCriteria();
            } else {
                // Direct map: type in TYPE_DECK matches keys in CRITERIA_POOLS
                const pool = CRITERIA_POOLS[type];

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
                // Store minimal movie data to save space, but use full poster path to match frontend (MovieService)
                possibleAnswers[r][c] = matches.map(m => ({
                    id: m.id,
                    title: m.title,
                    poster_path: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
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
