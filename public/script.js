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

window.onload = () => {
  loadHomeData();
  renderFavorites();
  renderLibrary();
  renderArchive();
};

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

// ROUTING
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
    if(item.dataset.target === 'playlistView') renderLibrary();
  });
});

// HOME DATA LOAD
async function loadHomeData() {
  try {
    const res = await fetch('/api/home');
    const data = await res.json();
    
    const buildCards = (arr) => (arr || []).map(i => {
      const id = i.id || '';
      const type = i.type || (i.more_info && i.more_info.featured_station_type) || 'album';
      const title = escapeHtml(i.title || i.song || i.more_info?.station_display_text || i.more_info?.query || 'Unknown');
      const img = escapeHtml((i.image || '').replace('150x150', '500x500'));
      return `<div class="grid-card" onclick="handleCardClick('${id}', '${type}', '${title.replace(/'/g, "\\'")}')"><img src="${img}" alt="Art" loading="lazy"><div class="grid-title">${title}</div></div>`;
    }).join('');

    document.getElementById('trendingGrid').innerHTML = buildCards(data.trending);
    document.getElementById('newReleasesGrid').innerHTML = buildCards(data.new_releases);
    document.getElementById('artistsGrid').innerHTML = buildCards(data.artists);
  } catch (err) {
    console.error("Home load failed", err);
  }
}

// 🚨 FIX: Redirecting Albums to Search Properly 🚨
window.handleCardClick = function(id, type, title) {
  if (type === 'song') {
    openTrack(id);
  } else {
    showToast(`Exploring ${title}...`);
    document.getElementById('q').value = title;
    switchView('searchView'); // Opens search view first
    document.getElementById('searchBtn').click(); // Triggers the API fetch
  }
};

// SEARCH LOGIC
const searchForm = document.getElementById('searchForm');
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = document.getElementById('q').value.trim();
  if(!query) return;

  const searchBtn = document.getElementById('searchBtn');
  searchBtn.disabled = true; searchBtn.textContent = '...';
  document.getElementById('resultsList').innerHTML = '';
  document.getElementById('paginationControls').style.display = 'none';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`);
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Search failed');

    allSearchResults = data.results || [];
    if(!allSearchResults.length) {
      document.getElementById('resultsList').innerHTML = `<div style="padding:24px;text-align:center;border:2px dashed var(--border-dark);">No tracks found for "${escapeHtml(query)}"</div>`;
      return;
    }

    currentSearchPage = 1;
    renderSearchPage();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  } finally {
    searchBtn.disabled = false; searchBtn.textContent = 'SEARCH';
  }
});

function renderSearchPage() {
  const totalPages = Math.ceil(allSearchResults.length / ITEMS_PER_PAGE);
  const start = (currentSearchPage - 1) * ITEMS_PER_PAGE;
  const pageItems = allSearchResults.slice(start, start + ITEMS_PER_PAGE);

  document.getElementById('resultsList').innerHTML = pageItems.map(r => `
    <div class="result-card" onclick="openTrack('${r.pid}')">
      <img class="result-img" src="${r.image}" alt="Cover" loading="lazy">
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist} · ${r.album}</div>
      </div>
      <button class="btn-play-badge">PLAY</button>
    </div>
  `).join('');

  document.getElementById('pageIndicator').textContent = `PAGE ${currentSearchPage} / ${totalPages}`;
  document.getElementById('prevPageBtn').disabled = currentSearchPage === 1;
  document.getElementById('nextPageBtn').disabled = currentSearchPage === totalPages;
  document.getElementById('paginationControls').style.display = totalPages > 1 ? 'flex' : 'none';
}

document.getElementById('prevPageBtn').addEventListener('click', () => { if(currentSearchPage > 1) { currentSearchPage--; renderSearchPage(); window.scrollTo({top:0, behavior:'smooth'}); }});
document.getElementById('nextPageBtn').addEventListener('click', () => { if(currentSearchPage < Math.ceil(allSearchResults.length / ITEMS_PER_PAGE)) { currentSearchPage++; renderSearchPage(); window.scrollTo({top:0, behavior:'smooth'}); }});


// 🚨 FIX: ANDROID HARDWARE BACK BUTTON 🚨
function openFullPlayer() {
  fullPlayer.classList.add('open');
  history.pushState({ playerOpen: true }, '');
}

window.addEventListener('popstate', (e) => {
  if (fullPlayer.classList.contains('open')) {
    fullPlayer.classList.remove('open');
  }
});

document.getElementById('closePlayerBtn').addEventListener('click', () => {
  fullPlayer.classList.remove('open');
  if (history.state && history.state.playerOpen) history.back();
});

// OPEN TRACK
async function openTrack(pid) {
  showToast('Decrypting HQ Stream...');
  try {
    const res = await fetch(`/api/details?pid=${encodeURIComponent(pid)}`);
    const data = await res.json();
    if(!data.success) throw new Error(data.error || 'Playback failed');

    currentSongData = data;

    document.getElementById('pTitle').textContent = data.title;
    document.getElementById('pArtist').textContent = data.artist;
    document.getElementById('pAlbum').textContent = data.album || 'Single';
    document.getElementById('playerCover').src = data.image;

    document.getElementById('mpTitle').textContent = data.title;
    document.getElementById('mpArtist').textContent = data.artist;
    document.getElementById('mpCover').src = data.image;
    miniPlayer.style.display = 'flex';

    // 🚨 FIX: IMMEDIATELY OPEN FULL PLAYER ON SONG CLICK 🚨
    openFullPlayer();

    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    document.getElementById('btn320').href = `/api/download?url=${encodeURIComponent(data.links['320'])}&filename=${safeTitle}&quality=320kbps`;
    document.getElementById('btn160').href = `/api/download?url=${encodeURIComponent(data.links['160'])}&filename=${safeTitle}&quality=160kbps`;
    document.getElementById('btn96').href = `/api/download?url=${encodeURIComponent(data.links['96'])}&filename=${safeTitle}&quality=96kbps`;

    audio.src = data.links['320'] || data.links['160'];
    audio.currentTime = 0;
    audio.volume = document.getElementById('vol').value / 100;
    audio.playbackRate = parseFloat(document.getElementById('speed').value);
    
    audio.play().then(() => setPlayState(true)).catch(() => { setPlayState(false); showToast('Tap play to start'); });

    saveToArchive(data);
    checkActionStates(data.pid);
  } catch (err) {
    showToast('Track Error: ' + err.message);
  }
}

miniPlayer.addEventListener('click', (e) => { if(e.target.id !== 'mpPlayBtn') openFullPlayer(); });

function togglePlay() {
  if (audio.paused && audio.src) { audio.play(); setPlayState(true); } else { audio.pause(); setPlayState(false); }
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

const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');

audio.addEventListener('loadedmetadata', () => { durTime.textContent = fmtTime(audio.duration); seek.max = audio.duration || 100; });
audio.addEventListener('timeupdate', () => { if (!seek._dragging) seek.value = audio.currentTime; curTime.textContent = fmtTime(audio.currentTime); });
seek.addEventListener('input', () => { seek._dragging = true; curTime.textContent = fmtTime(seek.value); });
seek.addEventListener('change', () => { audio.currentTime = parseFloat(seek.value); seek._dragging = false; });

document.getElementById('rewindBtn').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
document.getElementById('fwdBtn').addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
document.getElementById('vol').addEventListener('input', (e) => { audio.volume = e.target.value / 100; });
document.getElementById('speed').addEventListener('change', (e) => { audio.playbackRate = parseFloat(e.target.value); });

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
  if(!archive.length) { list.innerHTML = `<div style="padding:24px;text-align:center;border:2px dashed var(--border-dark);">No playback history.</div>`; return; }
  list.innerHTML = archive.map(r => `
    <div class="result-card" onclick="openTrack('${r.pid}')">
      <img class="result-img" src="${r.image}" alt="Cover">
      <div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div>
      <button class="btn-play-badge">PLAY</button>
    </div>
  `).join('');
}

function toggleStorage(key, btnElem, activeIcon, inactiveIcon, addMsg, removeMsg) {
  if(!currentSongData) return;
  let items = JSON.parse(localStorage.getItem(key) || '[]');
  const exists = items.find(s => s.pid === currentSongData.pid);
  if(exists) {
    items = items.filter(s => s.pid !== currentSongData.pid);
    btnElem.textContent = inactiveIcon; btnElem.classList.remove('active');
    showToast(removeMsg);
  } else {
    items.unshift(currentSongData);
    btnElem.textContent = activeIcon; btnElem.classList.add('active');
    showToast(addMsg);
  }
  localStorage.setItem(key, JSON.stringify(items));
}

document.getElementById('favBtn').addEventListener('click', () => { toggleStorage('og_favorites', document.getElementById('favBtn'), '♥', '♡', 'Added to Favorites ♥', 'Removed from Favorites'); renderFavorites(); });
document.getElementById('libBtn').addEventListener('click', () => { toggleStorage('og_library', document.getElementById('libBtn'), '✓', '+', 'Added to Library ✓', 'Removed from Library'); renderLibrary(); });

function checkActionStates(pid) {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  const fb = document.getElementById('favBtn'); const lb = document.getElementById('libBtn');
  if(favs.find(s => s.pid === pid)) { fb.textContent = '♥'; fb.classList.add('active'); } else { fb.textContent = '♡'; fb.classList.remove('active'); }
  if(libs.find(s => s.pid === pid)) { lb.textContent = '✓'; lb.classList.add('active'); } else { lb.textContent = '+'; lb.classList.remove('active'); }
}

function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const grid = document.getElementById('favoritesGrid');
  if(!favs.length) { grid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:10px;">No favorite tracks yet. Play a track and click ♡</div>`; return; }
  grid.innerHTML = favs.map(i => `<div class="grid-card" onclick="openTrack('${i.pid}')"><img src="${i.image}" alt="Art"><div class="grid-title">${i.title}</div></div>`).join('');
}

function renderLibrary() {
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  const list = document.getElementById('playlistGrid');
  if(!libs.length) { list.innerHTML = `<div style="padding:24px;text-align:center;border:2px dashed var(--border-dark);">Your library is empty. Click + to add tracks.</div>`; return; }
  list.innerHTML = libs.map(r => `
    <div class="result-card" onclick="openTrack('${r.pid}')">
      <img class="result-img" src="${r.image}" alt="Cover">
      <div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div>
      <button class="btn-play-badge">PLAY</button>
    </div>
  `).join('');
}

document.getElementById('openDlModal').addEventListener('click', () => document.getElementById('dlModal').style.display = 'flex');
document.getElementById('closeDlModal').addEventListener('click', () => document.getElementById('dlModal').style.display = 'none');
document.getElementById('dlModal').addEventListener('click', (e) => { if(e.target === document.getElementById('dlModal')) document.getElementById('dlModal').style.display = 'none'; });
