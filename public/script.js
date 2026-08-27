// --- GLOBAL STATE ---
let currentSongData = null;
let allSearchResults = [];
let currentSearchPage = 1;
const ITEMS_PER_PAGE = 10;

const audio = document.getElementById('audio');
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const miniPlayer = document.getElementById('miniPlayer');
const fullPlayer = document.getElementById('fullPlayer');
const dlModal = document.getElementById('dlModal');

// --- INIT APP ---
window.onload = () => {
  loadHomeData();
  renderFavorites();
};

// --- NAVIGATION SWITCHING ---
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    views.forEach(v => v.classList.remove('active'));
    
    const targetId = item.dataset.target;
    document.getElementById(targetId).classList.add('active');
    
    if(targetId === 'archiveView') renderArchive();
    if(targetId === 'homeView') renderFavorites();
  });
});

// --- MINI PLAYER <-> FULL PLAYER TOGGLE ---
miniPlayer.addEventListener('click', (e) => {
  if(e.target.id === 'mpPlayBtn') return; // Don't open if play button clicked
  fullPlayer.classList.add('open');
});

document.getElementById('closePlayerBtn').addEventListener('click', () => {
  fullPlayer.classList.remove('open');
});

// --- PLAY / PAUSE CONTROLS ---
function togglePlay() {
  if (audio.paused) {
    if (audio.src) audio.play();
  } else {
    audio.pause();
  }
}

document.getElementById('playBtn').addEventListener('click', togglePlay);
document.getElementById('mpPlayBtn').addEventListener('click', togglePlay);

audio.addEventListener('play', () => {
  document.getElementById('playBtn').textContent = '❚❚';
  document.getElementById('mpPlayBtn').textContent = '❚❚';
});

audio.addEventListener('pause', () => {
  document.getElementById('playBtn').textContent = '▶';
  document.getElementById('mpPlayBtn').textContent = '▶';
});

// --- LOAD HOME API ---
async function loadHomeData() {
  try {
    const res = await fetch('/api/home');
    const data = await res.json();
    
    const buildCards = (arr) => (arr || []).map(i => `
      <div class="card" onclick="openTrack('${i.id || i.perma_url || i.more_info?.song_pids}')">
        <img src="${(i.image || '').replace('150x150', '500x500')}" alt="Art" loading="lazy">
        <div class="card-title">${i.title || i.song || 'Unknown'}</div>
      </div>
    `).join('');

    document.getElementById('trendingGrid').innerHTML = buildCards(data.trending);
    document.getElementById('newReleasesGrid').innerHTML = buildCards(data.new_releases);
    document.getElementById('artistsGrid').innerHTML = buildCards(data.artists);
  } catch (err) {
    console.error("Home load failed", err);
  }
}

// --- SEARCH LOGIC & PAGINATION ---
const searchForm = document.getElementById('searchForm');
const qInput = document.getElementById('q');
const searchBtn = document.getElementById('searchBtn');
const resultsList = document.getElementById('resultsList');
const paginationControls = document.getElementById('paginationControls');

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = qInput.value.trim();
  if(!query) return;

  searchBtn.disabled = true;
  searchBtn.textContent = '...';
  resultsList.innerHTML = '';
  paginationControls.style.display = 'none';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`);
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Search failed');

    allSearchResults = data.results || [];
    if(!allSearchResults.length) {
      resultsList.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">No tracks found.</div>`;
      return;
    }

    currentSearchPage = 1;
    renderSearchPage();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'SEARCH';
  }
});

function renderSearchPage() {
  const totalPages = Math.ceil(allSearchResults.length / ITEMS_PER_PAGE);
  const start = (currentSearchPage - 1) * ITEMS_PER_PAGE;
  const pageItems = allSearchResults.slice(start, start + ITEMS_PER_PAGE);

  resultsList.innerHTML = pageItems.map(r => `
    <div class="result-card" onclick="openTrack('${r.pid}')">
      <img class="result-img" src="${r.image}" alt="Cover" loading="lazy">
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist} · ${r.album}</div>
      </div>
      <button class="btn-play-badge">PLAY</button>
    </div>
  `).join('');

  document.getElementById('pageIndicator').textContent = `PAGE ${currentSearchPage}/${totalPages}`;
  document.getElementById('prevPageBtn').disabled = currentSearchPage === 1;
  document.getElementById('nextPageBtn').disabled = currentSearchPage === totalPages;
  paginationControls.style.display = totalPages > 1 ? 'flex' : 'none';
}

document.getElementById('prevPageBtn').addEventListener('click', () => {
  if(currentSearchPage > 1) { currentSearchPage--; renderSearchPage(); }
});
document.getElementById('nextPageBtn').addEventListener('click', () => {
  const totalPages = Math.ceil(allSearchResults.length / ITEMS_PER_PAGE);
  if(currentSearchPage < totalPages) { currentSearchPage++; renderSearchPage(); }
});

// --- OPEN TRACK (DETAILS & STREAMING) ---
async function openTrack(pid) {
  showToast('Decrypting audio stream...');
  try {
    const res = await fetch(`/api/details?pid=${encodeURIComponent(pid)}`);
    const data = await res.json();
    if(!data.success) throw new Error(data.error || 'Playback failed');

    currentSongData = data;

    // Full Player Meta
    document.getElementById('pTitle').textContent = data.title;
    document.getElementById('pArtist').textContent = data.artist;
    document.getElementById('playerCover').src = data.image;

    // Mini Player Meta
    document.getElementById('mpTitle').textContent = data.title;
    document.getElementById('mpArtist').textContent = data.artist;
    document.getElementById('mpCover').src = data.image;
    miniPlayer.style.display = 'flex';

    // Download Links Setup
    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    document.getElementById('btn320').href = `/api/download?url=${encodeURIComponent(data.links['320'])}&filename=${safeTitle}&quality=320kbps`;
    document.getElementById('btn160').href = `/api/download?url=${encodeURIComponent(data.links['160'])}&filename=${safeTitle}&quality=160kbps`;
    document.getElementById('btn96').href = `/api/download?url=${encodeURIComponent(data.links['96'])}&filename=${safeTitle}&quality=96kbps`;

    // Audio Engine
    audio.src = data.links['320'] || data.links['160'];
    audio.currentTime = 0;
    audio.play();

    saveToArchive(data);
    checkFavoriteState(data.pid);
  } catch (err) {
    showToast('Track Error: ' + err.message);
  }
}

// --- AUDIO PROGRESS SYNC ---
const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');

function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

audio.addEventListener('loadedmetadata', () => {
  durTime.textContent = fmtTime(audio.duration);
  seek.max = audio.duration || 100;
});

audio.addEventListener('timeupdate', () => {
  if (!seek._dragging) seek.value = audio.currentTime;
  curTime.textContent = fmtTime(audio.currentTime);
});

seek.addEventListener('input', () => { seek._dragging = true; curTime.textContent = fmtTime(seek.value); });
seek.addEventListener('change', () => { audio.currentTime = parseFloat(seek.value); seek._dragging = false; });

document.getElementById('rewindBtn').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
document.getElementById('fwdBtn').addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });

// --- LOCAL STORAGE: ARCHIVE (HISTORY) ---
function saveToArchive(song) {
  let archive = JSON.parse(localStorage.getItem('og_archive') || '[]');
  archive = archive.filter(s => s.pid !== song.pid);
  archive.unshift(song);
  if(archive.length > 40) archive.pop();
  localStorage.setItem('og_archive', JSON.stringify(archive));
}

function renderArchive() {
  const archive = JSON.parse(localStorage.getItem('og_archive') || '[]');
  const list = document.getElementById('archiveList');
  if(!archive.length) {
    list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">No playback history found.</div>`;
    return;
  }
  
  list.innerHTML = archive.map(r => `
    <div class="result-card" onclick="openTrack('${r.pid}')">
      <img class="result-img" src="${r.image}" alt="Cover">
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      <button class="btn-play-badge">PLAY</button>
    </div>
  `).join('');
}

// --- LOCAL STORAGE: FAVORITES ---
const favBtn = document.getElementById('favBtn');
favBtn.addEventListener('click', () => {
  if(!currentSongData) return;
  let favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const exists = favs.find(s => s.pid === currentSongData.pid);
  
  if(exists) {
    favs = favs.filter(s => s.pid !== currentSongData.pid);
    favBtn.textContent = '♡';
    favBtn.classList.remove('active');
    showToast('Removed from favorites');
  } else {
    favs.unshift(currentSongData);
    favBtn.textContent = '♥';
    favBtn.classList.add('active');
    showToast('Added to favorites ❤️');
  }
  localStorage.setItem('og_favorites', JSON.stringify(favs));
  renderFavorites();
});

function checkFavoriteState(pid) {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  if(favs.find(s => s.pid === pid)) {
    favBtn.textContent = '♥';
    favBtn.classList.add('active');
  } else {
    favBtn.textContent = '♡';
    favBtn.classList.remove('active');
  }
}

function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const grid = document.getElementById('favoritesGrid');
  if(!favs.length) {
    grid.innerHTML = `<p style="font-size:11px;color:var(--text-muted);padding:10px;">No favorite tracks yet.</p>`;
    return;
  }
  
  grid.innerHTML = favs.map(i => `
    <div class="card" onclick="openTrack('${i.pid}')">
      <img src="${i.image}" alt="Art">
      <div class="card-title">${i.title}</div>
    </div>
  `).join('');
}

// --- DOWNLOAD MODAL POPUP ---
document.getElementById('openDlModal').addEventListener('click', () => dlModal.style.display = 'flex');
document.getElementById('closeDlModal').addEventListener('click', () => dlModal.style.display = 'none');
dlModal.addEventListener('click', (e) => { if(e.target === dlModal) dlModal.style.display = 'none'; });

// --- TOAST NOTIFICATIONS ---
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2300);
}
