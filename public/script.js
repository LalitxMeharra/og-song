const form = document.getElementById('searchForm');
const queryInput = document.getElementById('query');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

// Player View Elements
const searchView = document.getElementById('searchView');
const playerView = document.getElementById('playerView');
const backBtn = document.getElementById('backBtn');
const playerCover = document.getElementById('playerCover');
const playerTitle = document.getElementById('playerTitle');
const playerArtist = document.getElementById('playerArtist');
const playerAlbum = document.getElementById('playerAlbum');
const mainAudio = document.getElementById('mainAudio');

let currentTrackData = null;
let isDownloading = false;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function renderResult(item) {
  const title = escapeHtml(item.title || 'Untitled');
  const artist = escapeHtml(item.artist || 'Unknown');
  const image = item.image ? escapeHtml(item.image) : '';
  const pid = escapeHtml(item.pid);

  return `
    <article class="card" onclick="openSongPlayer('${pid}')">
      ${image ? `<img class="cover" src="${image}" alt="" loading="lazy">` : `<div class="cover"></div>`}
      <div class="info">
        <h2 class="title">${title}</h2>
        <p class="meta">${artist}</p>
      </div>
      <button class="play-action-btn">▶ Play</button>
    </article>`;
}

async function searchSongs(query) {
  statusEl.textContent = 'Searching...';
  resultsEl.innerHTML = '';

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Search failed');

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      statusEl.textContent = 'No results found.';
      resultsEl.innerHTML = '<div class="empty">Try another song or artist name.</div>';
      return;
    }

    statusEl.textContent = `${results.length} result(s) found for “${data.query}”.`;
    resultsEl.innerHTML = results.map(renderResult).join('');
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    resultsEl.innerHTML = '<div class="empty">Unable to fetch songs. Try again.</div>';
  }
}

async function openSongPlayer(songPid) {
  if (isDownloading) {
    alert('Please wait for current download to finish!');
    return;
  }

  statusEl.textContent = 'Decrypting & Loading Track...';

  try {
    const res = await fetch(`/api/details?pid=${encodeURIComponent(songPid)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to get song stream');
    }

    currentTrackData = data;

    // Fill UI
    playerCover.src = data.image || '';
    playerTitle.textContent = data.title;
    playerArtist.textContent = data.artist;
    playerAlbum.textContent = data.album;
    
    // Load full decoded stream
    mainAudio.src = data.links['320'] || data.links['160'];
    mainAudio.play();

    // Toggle Views
    searchView.style.display = 'none';
    playerView.style.display = 'flex';
    window.scrollTo(0, 0);
    statusEl.textContent = 'Ready to download!';
  } catch (err) {
    alert(`Error: ${err.message}`);
    statusEl.textContent = 'Error loading song';
  }
}

async function triggerDownload(quality) {
  if (isDownloading) {
    alert('Download already in progress!');
    return;
  }

  if (!currentTrackData || !currentTrackData.links[quality]) {
    alert('Download link not ready! Please play the song first.');
    return;
  }

  const downloadUrl = currentTrackData.links[quality];
  const safeTitle = currentTrackData.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeTitle}_${quality}kbps.mp3`;

  // Show downloading status
  statusEl.textContent = `Downloading ${quality}kbps...`;
  isDownloading = true;

  try {
    // Use backend proxy to download
    const response = await fetch(`/api/download?action=download&url=${encodeURIComponent(downloadUrl)}&quality=${quality}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Download failed');
    }

    // Get the blob from response
    const blob = await response.blob();
    
    // Create download link
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      statusEl.textContent = `✅ ${quality}kbps download complete!`;
      isDownloading = false;
    }, 2000);
    
  } catch (error) {
    console.error('Download error:', error);
    statusEl.textContent = `❌ Download failed: ${error.message}`;
    isDownloading = false;
    alert(`Download failed: ${error.message}\n\nTry again or use another quality.`);
  }
}

backBtn.addEventListener('click', () => {
  if (isDownloading) {
    if (!confirm('Download in progress. Are you sure you want to go back?')) {
      return;
    }
  }
  
  mainAudio.pause();
  mainAudio.src = '';
  currentTrackData = null;
  isDownloading = false;
  playerView.style.display = 'none';
  searchView.style.display = 'block';
  statusEl.textContent = 'Type a song name and search.';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (query) searchSongs(query);
});

// Make functions globally accessible
window.openSongPlayer = openSongPlayer;
window.triggerDownload = triggerDownload;

// Initial status
statusEl.textContent = 'Type a song name and search.';
