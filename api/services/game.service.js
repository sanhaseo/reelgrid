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
        label: `Starts with ${chars.slice(0, -1).join(', ')}, or ${chars[chars.length - 1]}`,
        value: chars, // Array of letters
        type: 'title',
        idValue: 'starts_with'
    };
}

// Weighted Type Deck configuration
const TYPE_DECK = [
    'actor', 'actor', 'actor', // 3x Actor
    'genre', 'genre',          // 2x Genre
    'title', 'title',          // 2x Title
    'director',
    // 'company',
    'keyword',
    'year',
    // 'runtime',
    // 'rating'
];

function getShuffledTypes() {
    const randomFive = [...TYPE_DECK].sort(() => 0.5 - Math.random()).slice(0, 5);
    return ['actor', ...randomFive].sort(() => 0.5 - Math.random());
}

function getRandomCriteria(type, usedIds) {
    let candidate = null;

    if (type === 'title') {
        let retries = 0;
        while (retries < 10) {
            const r = Math.random();
            if (r < 0.16) {
                candidate = CRITERIA_POOLS.title.find(t => t.id === 'one_word');
            } else if (r < 0.33) {
                candidate = CRITERIA_POOLS.title.find(t => t.id === 'two_word');
            } else if (r < 0.5) {
                candidate = CRITERIA_POOLS.title.find(t => t.id === 'three_word');
            } else if (r < 0.66) {
                candidate = CRITERIA_POOLS.title.find(t => t.id === 'four_word');
            } else if (r < 0.83) {
                candidate = CRITERIA_POOLS.title.find(t => t.id === 'five_plus_word');
            } else {
                candidate = generateDynamicTitleCriteria();
            }

            if (candidate && !usedIds.has(candidate.id)) break;
            candidate = null;
            retries++;
        }
        if (!candidate) candidate = generateDynamicTitleCriteria();
    } else {
        const pool = CRITERIA_POOLS[type];
        if (!pool || pool.length === 0) return null;

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

    return candidate ? { ...candidate, type } : null;
}

function selectBoardCriteria(shuffledTypes) {
    let selected = [];
    const usedIds = new Set();

    for (const type of shuffledTypes) {
        const criteria = getRandomCriteria(type, usedIds);
        if (criteria) {
            selected.push(criteria);
            usedIds.add(criteria.id);
        }
    }
    return selected;
}

async function validateBoardIntersections(rowCriteria, colCriteria) {
    const minMatchesRequired = 3;
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const matches = await checkIntersection(rowCriteria[r], colCriteria[c], minMatchesRequired);
            if (!matches || matches.length < minMatchesRequired) {
                return false;
            }
        }
    }
    return true;
}

async function generateBoard() {
    let attempts = 0;
    while (attempts < 500) {
        attempts++;
        console.log(`Attempt ${attempts}`);

        const shuffledTypes = getShuffledTypes();
        const selected = selectBoardCriteria(shuffledTypes);

        if (selected.length < 6) continue;

        const rowCriteria = selected.slice(0, 3);
        const colCriteria = selected.slice(3, 6);

        // Prevent having a title critera in both rows and cols
        const hasRowTitle = rowCriteria.some(c => c.type === 'title');
        const hasColTitle = colCriteria.some(c => c.type === 'title');

        if (hasRowTitle && hasColTitle) {
            console.log('Skipping board: title criteria found in both row and column');
            continue;
        }

        const validBoard = await validateBoardIntersections(rowCriteria, colCriteria);

        if (validBoard) {
            console.log('Generated valid board in ' + attempts + ' attempts');
            return { rowCriteria, colCriteria };
        }
    }
    return null;
}

module.exports = { generateBoard };
