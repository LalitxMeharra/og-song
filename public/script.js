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
    const response = await fetch(`/api?action=search&q=${encodeURIComponent(query)}`);
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
  statusEl.textContent = 'Decrypting & Loading Track...';

  try {
    const res = await fetch(`/api?action=details&pid=${encodeURIComponent(songPid)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to get song stream');
    }

    currentTrackData = data;

    playerCover.src = data.image || '';
    playerTitle.textContent = data.title;
    playerArtist.textContent = data.artist;
    playerAlbum.textContent = data.album;
    
    mainAudio.src = data.links['320'] || data.links['160'];
    mainAudio.play();

    searchView.style.display = 'none';
    playerView.style.display = 'flex';
    window.scrollTo(0, 0);
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    statusEl.textContent = '';
  }
}

// MULTI-DOWNLOAD ENGINE FOR ANDROID/DESKTOP
function downloadDirect(quality, btnElement) {
  if (!currentTrackData || !currentTrackData.links[quality]) {
    alert('Download link not ready');
    return;
  }

  // 1. Temporary visual indicator
  const origHTML = btnElement.innerHTML;
  btnElement.innerHTML = `<span>⏳ ...</span><small>Starting</small>`;
  btnElement.style.opacity = '0.7';

  const cdnUrl = currentTrackData.links[quality];
  const safeTitle = currentTrackData.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
  
  // 2. Anti-cache unique timestamp to avoid mobile socket reuse lock
  const downloadUrl = `/api?action=download&url=${encodeURIComponent(cdnUrl)}&filename=${encodeURIComponent(safeTitle)}&quality=${encodeURIComponent(quality + 'kbps')}&_t=${Date.now()}`;

  // 3. Isolated Hidden iFrame Launcher (Bypasses Chrome JS Lock)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = '0';
  iframe.style.display = 'none';
  iframe.src = downloadUrl;

  document.body.appendChild(iframe);

  // 4. Auto-destroy iframe and restore button immediately
  setTimeout(() => {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
    btnElement.innerHTML = origHTML;
    btnElement.style.opacity = '1';
  }, 2000);
}

backBtn.addEventListener('click', () => {
  mainAudio.pause();
  mainAudio.src = '';
  playerView.style.display = 'none';
  searchView.style.display = 'block';
  statusEl.textContent = '';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (query) searchSongs(query);
});
