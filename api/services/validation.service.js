const { TMDB_BASE_URL, getHeaders } = require('./tmdb.service');
const { mapTMDBToMovie } = require('../../shared/validation');

// Fetch full details including credits, release dates, keywords
async function getMovieDetailsFromTMDB(id) {
    const url = `${TMDB_BASE_URL}/movie/${id}?append_to_response=credits,release_dates,keywords`;
    try {
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) return null;
        const data = await res.json();

        return mapTMDBToMovie(data);
    } catch (e) {
        console.error('getMovieDetailsFromTMDB ERROR:', e);
        return null;
    }
}

module.exports = {
    getMovieDetailsFromTMDB
};
