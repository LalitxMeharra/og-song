// --- GLOBAL STATE --
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
  renderArchive();
};

// --- UTILITIES ---
function escapeHtml(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

// --- NAVIGATION SWITCHING ---
function switchView(targetId) {
  navItems.forEach(n => {
    n.classList.remove('active');
    if(n.dataset.target === targetId) n.classList.add('active');
  });
  views.forEach(v => v.classList.remove('active'));
  document.getElementById(targetId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    switchView(item.dataset.target);
    if(item.dataset.target === 'archiveView') renderArchive();
    if(item.dataset.target === 'homeView') renderFavorites();
  });
});

// --- HOME DATA & THE ALBUM BUG FIX ---
async function loadHomeData() {
  try {
    const res = await fetch('/api/home');
    const data = await res.json();
    
    const buildCards = (arr) => (arr || []).map(i => {
      const id = i.id || '';
      // Determine if it's a song, album, or artist
      const type = i.type || (i.more_info && i.more_info.featured_station_type) || 'album';
      // Get the cleanest title possible
      const title = escapeHtml(i.title || i.song || i.more_info?.station_display_text || i.more_info?.query || 'Unknown');
      const img = escapeHtml((i.image || '').replace('150x150', '500x500'));
      
      return `
      <div class="grid-card" onclick="handleCardClick('${id}', '${type}', '${title.replace(/'/g, "\\'")}')">
        <img src="${img}" alt="Art" loading="lazy">
        <div class="grid-title">${title}</div>
      </div>
      `;
    }).join('');

    document.getElementById('trendingGrid').innerHTML = buildCards(data.trending);
    document.getElementById('newReleasesGrid').innerHTML = buildCards(data.new_releases);
    document.getElementById('artistsGrid').innerHTML = buildCards(data.artists);
  } catch (err) {
    console.error("Home load failed", err);
  }
}

// The Smart Interceptor for Album/Artist clicks
window.handleCardClick = function(id, type, title) {
  if (type === 'song') {
    openTrack(id);
  } else {
    // Redirect Albums/Playlists/Artists to the Search View to fetch their songs!
    showToast(`Exploring ${title}...`);
    document.getElementById('q').value = title;
    document.getElementById('searchBtn').click();
    switchView('searchView');
  }
};

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
      resultsList.innerHTML = `<div style="padding:24px;text-align:center;font-family:'Space Mono';border:2px dashed var(--border-dark);">No tracks found for "${escapeHtml(query)}"</div>`;
      return;
    }

    currentSearchPage = 1;
    renderSearchPage();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = '探索 SEARCH';
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
      <button class="btn-play-badge">再生 PLAY</button>
    </div>
  `).join('');

  document.getElementById('pageIndicator').textContent = `PAGE ${currentSearchPage} / ${totalPages}`;
  document.getElementById('prevPageBtn').disabled = currentSearchPage === 1;
  document.getElementById('nextPageBtn').disabled = currentSearchPage === totalPages;
  paginationControls.style.display = totalPages > 1 ? 'flex' : 'none';
}

document.getElementById('prevPageBtn').addEventListener('click', () => {
  if(currentSearchPage > 1) { currentSearchPage--; renderSearchPage(); document.getElementById('searchView').scrollIntoView({behavior:'smooth'}); }
});
document.getElementById('nextPageBtn').addEventListener('click', () => {
  const totalPages = Math.ceil(allSearchResults.length / ITEMS_PER_PAGE);
  if(currentSearchPage < totalPages) { currentSearchPage++; renderSearchPage(); document.getElementById('searchView').scrollIntoView({behavior:'smooth'}); }
});

// --- OPEN TRACK (DETAILS & STREAMING) ---
async function openTrack(pid) {
  showToast('Decrypting HQ Stream...');
  try {
    const res = await fetch(`/api/details?pid=${encodeURIComponent(pid)}`);
    const data = await res.json();
    if(!data.success) throw new Error(data.error || 'Playback failed');

    currentSongData = data;

    // Full Player Meta
    document.getElementById('pTitle').textContent = data.title;
    document.getElementById('pArtist').textContent = data.artist;
    document.getElementById('pAlbum').textContent = data.album || 'Single';
    document.getElementById('playerCover').src = data.image;

    // Mini Player Meta
    document.getElementById('mpTitle').textContent = data.title;
    document.getElementById('mpArtist').textContent = data.artist;
    document.getElementById('mpCover').src = data.image;
    miniPlayer.style.display = 'flex';

    // Download Links
    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    document.getElementById('btn320').href = `/api/download?url=${encodeURIComponent(data.links['320'])}&filename=${safeTitle}&quality=320kbps`;
    document.getElementById('btn160').href = `/api/download?url=${encodeURIComponent(data.links['160'])}&filename=${safeTitle}&quality=160kbps`;
    document.getElementById('btn96').href = `/api/download?url=${encodeURIComponent(data.links['96'])}&filename=${safeTitle}&quality=96kbps`;

    // Audio Engine
    audio.src = data.links['320'] || data.links['160'];
    audio.currentTime = 0;
    audio.volume = document.getElementById('vol').value / 100;
    audio.playbackRate = parseFloat(document.getElementById('speed').value);
    
    audio.play().then(() => {
      setPlayState(true);
      fullPlayer.classList.add('open');
    }).catch(() => {
      setPlayState(false);
      showToast('Tap play to start stream');
    });

    saveToArchive(data);
    checkFavoriteState(data.pid);
  } catch (err) {
    showToast('Track Error: ' + err.message);
  }
}

// --- PLAYER TOGGLES & TRANSPORT CONTROLS ---
miniPlayer.addEventListener('click', (e) => {
  if(e.target.id === 'mpPlayBtn') return; 
  fullPlayer.classList.add('open');
});
document.getElementById('closePlayerBtn').addEventListener('click', () => fullPlayer.classList.remove('open'));

function togglePlay() {
  if (audio.paused && audio.src) { audio.play(); setPlayState(true); } 
  else { audio.pause(); setPlayState(false); }
}

document.getElementById('playBtn').addEventListener('click', togglePlay);
document.getElementById('mpPlayBtn').addEventListener('click', togglePlay);

function setPlayState(isPlaying) {
  document.getElementById('playBtn').textContent = isPlaying ? '❚❚' : '▶';
  document.getElementById('mpPlayBtn').textContent = isPlaying ? '❚❚' : '▶';
  document.getElementById('discCover').classList.toggle('playing', isPlaying);
}

audio.addEventListener('play', () => setPlayState(true));
audio.addEventListener('pause', () => setPlayState(false));
audio.addEventListener('ended', () => setPlayState(false));

// --- TIME, SEEK, VOL & SPEED ---
const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');

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

document.getElementById('vol').addEventListener('input', (e) => { audio.volume = e.target.value / 100; });
document.getElementById('speed').addEventListener('change', (e) => { audio.playbackRate = parseFloat(e.target.value); });

// --- LOCAL STORAGE: ARCHIVE (HISTORY) ---
function saveToArchive(song) {
  let archive = JSON.parse(localStorage.getItem('og_archive') || '[]');
  archive = archive.filter(s => s.pid !== song.pid);
  archive.unshift(song);
  if(archive.length > 50) archive.pop();
  localStorage.setItem('og_archive', JSON.stringify(archive));
}

function renderArchive() {
  const archive = JSON.parse(localStorage.getItem('og_archive') || '[]');
  const list = document.getElementById('archiveList');
  if(!archive.length) {
    list.innerHTML = `<div style="padding:24px;text-align:center;font-family:'Space Mono';border:2px dashed var(--border-dark);">No playback history found.</div>`;
    return;
  }
  
  list.innerHTML = archive.map(r => `
    <div class="result-card" onclick="openTrack('${r.pid}')">
      <img class="result-img" src="${r.image}" alt="Cover">
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      <button class="btn-play-badge">再生 PLAY</button>
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
    favBtn.textContent = '♡'; favBtn.classList.remove('active');
    showToast('Removed from favorites');
  } else {
    favs.unshift(currentSongData);
    favBtn.textContent = '♥'; favBtn.classList.add('active');
    showToast('Added to favorites ♥');
  }
  localStorage.setItem('og_favorites', JSON.stringify(favs));
  renderFavorites();
});

function checkFavoriteState(pid) {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  if(favs.find(s => s.pid === pid)) {
    favBtn.textContent = '♥'; favBtn.classList.add('active');
  } else {
    favBtn.textContent = '♡'; favBtn.classList.remove('active');
  }
}

function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const grid = document.getElementById('favoritesGrid');
  if(!favs.length) {
    grid.innerHTML = `<div style="font-family:'Space Mono';font-size:12px;color:var(--text-muted);padding:10px;">No favorite tracks yet. Play a track and click ♡</div>`;
    return;
  }
  
  grid.innerHTML = favs.map(i => `
    <div class="grid-card" onclick="openTrack('${i.pid}')">
      <img src="${i.image}" alt="Art">
      <div class="grid-title">${i.title}</div>
    </div>
  `).join('');
}

// --- DOWNLOAD MODAL POPUP ---
document.getElementById('openDlModal').addEventListener('click', () => dlModal.style.display = 'flex');
document.getElementById('closeDlModal').addEventListener('click', () => dlModal.style.display = 'none');
dlModal.addEventListener('click', (e) => { if(e.target === dlModal) dlModal.style.display = 'none'; });
