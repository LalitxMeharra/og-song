// --- GLOBAL STATE & ROUTER ---
let currentSongData = null;
let searchTimer = null;

// SMART HISTORY ROUTER (Step by Step Back + Exit Trap)
const Router = {
  init() {
    // Inject base state
    history.replaceState({ step: 'home', view: 'homeView' }, '');
    window.addEventListener('popstate', this.handleBack.bind(this));
  },
  navigate(viewId, isPlayer = false) {
    if (isPlayer) {
      document.getElementById('fullPlayer').classList.add('open');
      history.pushState({ step: 'player' }, '');
    } else {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(viewId).classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Update Bottom Nav if applicable
      document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        if(n.dataset.target === viewId) n.classList.add('active');
      });
      history.pushState({ step: 'view', view: viewId }, '');
    }
  },
  handleBack(e) {
    // If player was open, close it
    if (document.getElementById('fullPlayer').classList.contains('open')) {
      document.getElementById('fullPlayer').classList.remove('open');
    } 
    else if (e.state && e.state.view) {
      // Normal view switch
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(e.state.view).classList.add('active');
      
      document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        if(n.dataset.target === e.state.view) n.classList.add('active');
      });
    } 
    else {
      // TRAP: We reached the start of our app history! Show exit modal.
      history.pushState({ step: 'trap', view: 'homeView' }, ''); // push trap back
      document.getElementById('exitModal').style.display = 'flex';
    }
  }
};

// --- INIT APP ---
window.onload = () => {
  Router.init();
  loadHomeData();
  renderFavorites();
  renderLibrary();
  renderArchive();
};

function escapeHtml(s = '') { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

// BOTTOM NAV CLICKS
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const targetId = item.dataset.target;
    Router.navigate(targetId);
    if(targetId === 'archiveView') renderArchive();
    if(targetId === 'homeView') renderFavorites();
    if(targetId === 'playlistView') renderLibrary();
  });
});

// HOME DATA
async function loadHomeData() {
  try {
    const res = await fetch('/api/home');
    const data = await res.json();
    const buildCards = (arr) => (arr || []).map(i => {
      const type = i.type || (i.more_info && i.more_info.featured_station_type) || 'album';
      const title = escapeHtml(i.title || i.song || i.more_info?.station_display_text || i.more_info?.query || 'Unknown');
      const img = escapeHtml((i.image || '').replace('150x150', '500x500'));
      return `<div class="grid-card" onclick="handleCardClick('${i.id}', '${type}', '${title.replace(/'/g, "\\'")}', '${img}')"><img src="${img}" loading="lazy"><div class="grid-title">${title}</div></div>`;
    }).join('');

    document.getElementById('trendingGrid').innerHTML = buildCards(data.trending);
    document.getElementById('newReleasesGrid').innerHTML = buildCards(data.new_releases);
    document.getElementById('artistsGrid').innerHTML = buildCards(data.artists);
  } catch (err) { console.error(err); }
}

// 🚨 COLLECTION VIEW (Album/Artist Playlist Generator) 🚨
window.handleCardClick = async function(id, type, title, img) {
  if (type === 'song') {
    openTrack(id);
  } else {
    // Open Collection View Step
    document.getElementById('colImg').src = img;
    document.getElementById('colTitle').textContent = title;
    document.getElementById('colSubtitle').textContent = type.toUpperCase();
    document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px; font-family:'Space Mono';">Loading tracks...</div>`;
    Router.navigate('collectionView');

    // Fetch tracks using search API as fallback
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(title)}&_t=${Date.now()}`);
      const data = await res.json();
      if(data.results && data.results.length > 0) {
        document.getElementById('collectionList').innerHTML = data.results.map(r => `
          <div class="result-card" onclick="openTrack('${r.pid}')">
            <img class="result-img" src="${r.image}" alt="Cover">
            <div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div>
            <button class="btn-play-badge">PLAY</button>
          </div>
        `).join('');
      } else {
        document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px;">No tracks found.</div>`;
      }
    } catch(err) {
      document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px; color:var(--crimson);">Error loading tracks.</div>`;
    }
  }
};
document.getElementById('collectionBackBtn').addEventListener('click', () => history.back());

// 🚨 LIVE SEARCH ENGINE (Letter by Letter) 🚨
const qInput = document.getElementById('q');
const searchSpinner = document.getElementById('searchSpinner');

qInput.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const query = e.target.value.trim();
  
  if(!query) {
    document.getElementById('topMatchContainer').style.display = 'none';
    document.getElementById('otherResultsTitle').style.display = 'none';
    document.getElementById('resultsList').innerHTML = '';
    return;
  }

  searchSpinner.style.display = 'block';
  // Debounce (wait 500ms before fetching)
  searchTimer = setTimeout(() => executeLiveSearch(query), 500);
});

async function executeLiveSearch(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`);
    const data = await res.json();
    searchSpinner.style.display = 'none';

    const results = data.results || [];
    if(!results.length) {
      document.getElementById('topMatchContainer').style.display = 'none';
      document.getElementById('resultsList').innerHTML = `<div style="padding:20px;text-align:center;">No results found.</div>`;
      return;
    }

    // TOP MATCH (1st Result)
    const top = results[0];
    document.getElementById('topMatchContainer').style.display = 'block';
    document.getElementById('topMatchCard').innerHTML = `
      <div class="top-match-card" onclick="openTrack('${top.pid}')">
        <img src="${top.image}">
        <div class="info">
          <div class="title">${top.title}</div>
          <div class="meta">${top.artist}</div>
        </div>
        <div class="top-match-badge">PLAY</div>
      </div>
    `;

    // OTHER RESULTS
    document.getElementById('otherResultsTitle').style.display = 'block';
    document.getElementById('resultsList').innerHTML = results.slice(1).map(r => `
      <div class="result-card" onclick="openTrack('${r.pid}')">
        <img class="result-img" src="${r.image}" alt="Cover">
        <div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div>
        <button class="btn-play-badge">PLAY</button>
      </div>
    `).join('');
  } catch (err) {
    searchSpinner.style.display = 'none';
  }
}

// --- OPEN TRACK (DETAILS & STREAMING) ---
const audio = document.getElementById('audio');
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
    document.getElementById('miniPlayer').style.display = 'flex';

    // Step-by-Step Push State for Player
    Router.navigate('fullPlayer', true);

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
  } catch (err) { showToast('Track Error: ' + err.message); }
}

document.getElementById('closePlayerBtn').addEventListener('click', () => history.back());
document.getElementById('miniPlayer').addEventListener('click', (e) => { if(e.target.id !== 'mpPlayBtn') Router.navigate('fullPlayer', true); });

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

// --- STORAGE MANAGERS ---
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
    <div class="result-card" onclick="openTrack('${r.pid}')"><img class="result-img" src="${r.image}" alt="Cover"><div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div><button class="btn-play-badge">PLAY</button></div>
  `).join('');
}

function toggleStorage(key, btnElem, activeIcon, inactiveIcon, addMsg, removeMsg) {
  if(!currentSongData) return;
  let items = JSON.parse(localStorage.getItem(key) || '[]');
  if(items.find(s => s.pid === currentSongData.pid)) {
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
    <div class="result-card" onclick="openTrack('${r.pid}')"><img class="result-img" src="${r.image}" alt="Cover"><div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div><button class="btn-play-badge">PLAY</button></div>
  `).join('');
}

// MODALS
document.getElementById('openDlModal').addEventListener('click', () => document.getElementById('dlModal').style.display = 'flex');
document.getElementById('closeDlModal').addEventListener('click', () => document.getElementById('dlModal').style.display = 'none');

// EXIT MODAL ACTIONS
document.getElementById('btnExitNo').addEventListener('click', () => {
  document.getElementById('exitModal').style.display = 'none';
});
document.getElementById('btnExitYes').addEventListener('click', () => {
  window.history.go(-2); // Escapes the trap
});
