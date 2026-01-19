const { CRITERIA_POOLS } = require('../criteriaPools');
const { checkIntersection } = require('./tmdb.service');

async function generateBoard() {
    const flatPool = [
        ...CRITERIA_POOLS.directors.map(i => ({ ...i, type: 'director' })),
        ...CRITERIA_POOLS.actors.map(i => ({ ...i, type: 'actor' })),
        ...CRITERIA_POOLS.genres.map(i => ({ ...i, type: 'genre' })),
        ...CRITERIA_POOLS.decades.map(i => ({ ...i, type: 'year' })),
        ...CRITERIA_POOLS.rating.map(i => ({ ...i, type: 'rating' })),
        ...CRITERIA_POOLS.runtime.map(i => ({ ...i, type: 'runtime' })),
        ...CRITERIA_POOLS.companies.map(i => ({ ...i, type: 'company' })),
        ...CRITERIA_POOLS.keywords.map(i => ({ ...i, type: 'keyword' }))
    ];

    let attempts = 0;
    while (attempts < 500) {
        attempts++;
        console.log(`Attempt ${attempts}`);
        let selected = [];
        let typeCounts = {};
        const shuffled = [...flatPool].sort(() => 0.5 - Math.random());

        for (const item of shuffled) {
            if (selected.length >= 6) break;
            const count = typeCounts[item.type] || 0;
            const limit = item.type === 'actor' ? 2 : 1;

            if (count < limit) {
                selected.push(item);
                typeCounts[item.type] = count + 1;
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
