const STORAGE_KEY = 'satelliteGame_v3_scores';
const MAX_SCORES = 10;

let scores = [];

export function initScoreboard() {
    loadScores();
}

function loadScores() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        scores = stored ? JSON.parse(stored) : [];
        scores.sort((a, b) => b.score - a.score);
    } catch (e) {
        scores = [];
    }
}

function saveScores() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch (e) {
    }
}

export function addScore(score, survivalTime, debrisAvoided = 0) {
    const entry = {
        score: score,
        survival: survivalTime,
        debrisAvoided: debrisAvoided,
        date: new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(new Date())
    };

    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    if (scores.length > MAX_SCORES) scores = scores.slice(0, MAX_SCORES);
    saveScores();

    const rank = scores.indexOf(entry) + 1;
    const isNewHighScore = rank === 1;
    return { score: entry, rank, isNewHighScore };
}

export function getAllScores()  { return [...scores]; }
export function getTopScore()  { return scores.length > 0 ? scores[0] : null; }
export function clearAllScores() {
    scores = [];
    localStorage.removeItem(STORAGE_KEY);
}

export function getScoreboardHTML() {
    let html = '<div class="scoreboard-content">';
    html += '<h3>High Scores</h3>';
    html += '<table class="scoreboard-table">';
    html += '<tr><th>RANK</th><th>Score</th><th>Time</th><th>Date</th></tr>';

    if (scores.length === 0) {
        html += '<tr><td colspan="4" style="text-align:center;color:#444;padding:10px">No records yet</td></tr>';
    } else {
        scores.forEach((s, i) => {
            const label = i === 0 ? '1ST' : i === 1 ? '2ND' : i === 2 ? '3RD' : `#${i + 1}`;
            html += `<tr>
                <td>${label}</td>
                <td><strong style="color:var(--yellow)">${s.score.toLocaleString()}</strong></td>
                <td>${s.survival}s</td>
                <td style="color:var(--text-dim)">${s.date}</td>
            </tr>`;
        });
    }

    html += '</table></div>';
    return html;
}