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

// Download Anchors
const btn320 = document.getElementById('btn320');
const btn160 = document.getElementById('btn160');
const btn96 = document.getElementById('btn96');

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

    // Fill UI Info
    playerCover.src = data.image || '';
    playerTitle.textContent = data.title;
    playerArtist.textContent = data.artist;
    playerAlbum.textContent = data.album;
    
    // Play Stream (320kbps fallback 160kbps)
    mainAudio.src = data.links['320'] || data.links['160'];
    mainAudio.play();

    // Direct Native Backend Attachment Download Links
    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    
    btn320.href = `/api?action=download&url=${encodeURIComponent(data.links['320'])}&filename=${encodeURIComponent(safeTitle)}&quality=320kbps`;
    btn160.href = `/api?action=download&url=${encodeURIComponent(data.links['160'])}&filename=${encodeURIComponent(safeTitle)}&quality=160kbps`;
    btn96.href = `/api?action=download&url=${encodeURIComponent(data.links['96'])}&filename=${encodeURIComponent(safeTitle)}&quality=96kbps`;

    // Switch View
    searchView.style.display = 'none';
    playerView.style.display = 'flex';
    window.scrollTo(0, 0);
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    statusEl.textContent = '';
  }
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
