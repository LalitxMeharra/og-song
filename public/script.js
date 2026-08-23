const API_URL = '/api';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const playerDiv = document.getElementById('player');
const audioPlayer = document.getElementById('audioPlayer');
const nowPlaying = document.getElementById('nowPlaying');
const closePlayer = document.getElementById('closePlayer');

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

        renderResults(data.results);
    } catch (error) {
        resultsDiv.innerHTML = `<p style="text-align:center; padding:20px; color:#ff8888;">❌ Search Error: ${error.message}</p>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function renderResults(songs) {
    resultsDiv.innerHTML = songs.map(song => `
        <div class="result-card">
            <img src="${song.image || 'https://c.saavncdn.com/default.jpg'}" alt="${song.title}">
            <div class="info">
                <div class="title">${song.title}</div>
                <div class="artist">${song.artist} · ${song.album}</div>
            </div>
            <div class="actions">
                <button class="btn-play" onclick="playAudio('${song.id}')">▶️ Play</button>
                <button class="btn-download" onclick="downloadAudio('${song.id}', '320')">320k</button>
                <button class="btn-download" onclick="downloadAudio('${song.id}', '160')">160k</button>
                <button class="btn-download" onclick="downloadAudio('${song.id}', '96')">96k</button>
            </div>
        </div>
    `).join('');
}

async function fetchSongDetails(songId) {
    const res = await fetch(`${API_URL}/details?songId=${songId}`);
    const data = await res.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to get song links');
    }
    return data;
}

async function playAudio(songId) {
    try {
        nowPlaying.textContent = `⏳ Loading track...`;
        playerDiv.style.display = 'block';

        const data = await fetchSongDetails(songId);
        const streamUrl = data.links['96'] || data.links['160'];

        audioPlayer.src = streamUrl;
        audioPlayer.play();
        nowPlaying.textContent = `▶️ ${data.title} - ${data.artist}`;
    } catch (e) {
        alert(`Play error: ${e.message}`);
        playerDiv.style.display = 'none';
    }
}

async function downloadAudio(songId, quality) {
    try {
        const data = await fetchSongDetails(songId);
        const fileUrl = data.links[quality];
        const safeTitle = data.title.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeTitle}_${quality}kbps.mp4`;

        // Direct fetch & download trigger (prevents black screen player)
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
        alert(`Download error: ${e.message}`);
    }
}

closePlayer.addEventListener('click', () => {
    audioPlayer.pause();
    playerDiv.style.display = 'none';
});
