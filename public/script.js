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

        if (!data.success || data.results.length === 0) {
            resultsDiv.innerHTML = `<p style="text-align:center; padding:20px; color:#ff8888;">❌ No songs found for "${query}"</p>`;
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
                <button class="btn-play" onclick="playSong('${song.vlink}', '${song.title.replace(/'/g, "\\'")}')">▶️ Play</button>
                <button class="btn-download" onclick="downloadSong('${song.id}', '320')">320k</button>
                <button class="btn-download" onclick="downloadSong('${song.id}', '160')">160k</button>
                <button class="btn-download" onclick="downloadSong('${song.id}', '96')">96k</button>
            </div>
        </div>
    `).join('');
}

function playSong(vlink, title) {
    if (!vlink) {
        alert('Preview not available for this track.');
        return;
    }
    audioPlayer.src = vlink;
    audioPlayer.play();
    nowPlaying.textContent = `▶️ Playing: ${title}`;
    playerDiv.style.display = 'block';
}

function downloadSong(songId, quality) {
    window.location.href = `${API_URL}/download?songId=${songId}&quality=${quality}`;
}

closePlayer.addEventListener('click', () => {
    audioPlayer.pause();
    playerDiv.style.display = 'none';
});
