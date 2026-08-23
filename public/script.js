const API_URL = '/api';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const playerDiv = document.getElementById('player');
const audioPlayer = document.getElementById('audioPlayer');
const nowPlaying = document.getElementById('nowPlaying');
const closePlayer = document.getElementById('closePlayer');

let currentResults = [];

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    loadingDiv.style.display = 'block';
    resultsDiv.innerHTML = '';

    try {
        const res = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (!data.success || !data.results || data.results.length === 0) {
            resultsDiv.innerHTML = `<p style="text-align:center; padding:20px; color:#ff8888;">❌ Koi gaana nahi mila "${query}" ke liye</p>`;
            return;
        }

        currentResults = data.results;
        renderResults(data.results);
    } catch (error) {
        resultsDiv.innerHTML = `<p style="text-align:center; padding:20px; color:#ff8888;">❌ Error: ${error.message}</p>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function renderResults(songs) {
    resultsDiv.innerHTML = songs.map((song, index) => `
        <div class="result-card">
            <img src="${song.image || 'https://c.saavncdn.com/default.jpg'}" alt="${song.title}">
            <div class="info">
                <div class="title">${song.title}</div>
                <div class="artist">${song.artist} · ${song.album}</div>
            </div>
            <div class="actions">
                <button class="btn-play" onclick="playAudio(${index})">▶️ Play</button>
                <button class="btn-download" onclick="downloadFile(${index}, '320')">320k</button>
                <button class="btn-download" onclick="downloadFile(${index}, '160')">160k</button>
                <button class="btn-download" onclick="downloadFile(${index}, '96')">96k</button>
            </div>
        </div>
    `).join('');
}

function playAudio(index) {
    const song = currentResults[index];
    if (!song) return;

    audioPlayer.src = song.media_url['96'] || song.media_url['160'];
    audioPlayer.play();
    nowPlaying.textContent = `▶️ ${song.title} - ${song.artist}`;
    playerDiv.style.display = 'block';
}

async function downloadFile(index, quality) {
    const song = currentResults[index];
    if (!song) return;

    const fileUrl = song.media_url[quality];
    const safeTitle = song.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeTitle}_${quality}kbps.mp4`;

    try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
    } catch (e) {
        // Fallback direct download
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

closePlayer.addEventListener('click', () => {
    audioPlayer.pause();
    playerDiv.style.display = 'none';
});
