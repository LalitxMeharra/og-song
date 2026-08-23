// ============================================
// JioSaavn Downloader - Frontend Logic
// ============================================

const API_URL = '/api';

let currentSongId = null;
let currentVlink = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const playerDiv = document.getElementById('player');
const audioPlayer = document.getElementById('audioPlayer');
const nowPlaying = document.getElementById('nowPlaying');
const closePlayer = document.getElementById('closePlayer');

// Search
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

        if (!data.success || data.results.length === 0) {
            resultsDiv.innerHTML = `<p class="no-results">❌ No songs found for "${query}"</p>`;
            return;
        }

        renderResults(data.results);
    } catch (error) {
        resultsDiv.innerHTML = `<p class="no-results">❌ Error: ${error.message}</p>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function renderResults(songs) {
    resultsDiv.innerHTML = songs.map(song => `
        <div class="result-card" data-id="${song.id}">
            <img src="${song.image || 'https://c.saavncdn.com/default.jpg'}" alt="${song.title}">
            <div class="info">
                <div class="title">${song.title}</div>
                <div class="artist">${song.artist} · ${song.album}</div>
                <div class="duration">${song.duration || '0:00'}</div>
            </div>
            <div class="actions">
                <button class="btn-play" onclick="playSong('${song.id}', '${song.vlink}', '${song.title}', '${song.artist}')">▶️</button>
                <button class="btn-download" onclick="downloadSong('${song.id}', '320')">320</button>
                <button class="btn-download" onclick="downloadSong('${song.id}', '160')">160</button>
                <button class="btn-download" onclick="downloadSong('${song.id}', '96')">96</button>
            </div>
        </div>
    `).join('');
}

// Play Song
function playSong(songId, vlink, title, artist) {
    if (!vlink) {
        alert('Preview not available for this song');
        return;
    }
    currentVlink = vlink;
    audioPlayer.src = vlink;
    audioPlayer.play();
    nowPlaying.textContent = `▶️ ${title} - ${artist}`;
    playerDiv.style.display = 'block';
}

// Download Song
async function downloadSong(songId, quality) {
    try {
        const res = await fetch(`${API_URL}/download?songId=${songId}&quality=${quality}`);
        if (!res.ok) {
            const error = await res.json();
            alert(`Download failed: ${error.error || 'Unknown error'}`);
            return;
        }

        // Create download link (hidden)
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.headers.get('content-disposition')?.split('filename="')[1]?.replace('"', '') || `song_${quality}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert(`Download error: ${error.message}`);
    }
}

// Close Player
closePlayer.addEventListener('click', () => {
    audioPlayer.pause();
    playerDiv.style.display = 'none';
});

// Clear search with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        searchInput.value = '';
        resultsDiv.innerHTML = '';
        loadingDiv.style.display = 'none';
    }
});
