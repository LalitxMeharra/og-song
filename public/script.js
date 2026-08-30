let currentSongData = null;
let searchTimer = null;
let currentContextList = []; 
let currentTrackIndex = -1;

let currentArtistToken = '';
let currentArtistPage = 0;
let isSearchContext = false;
let currentCollectionInfo = null; 

const Router = {
  init() {
    history.replaceState({ step: 'trap' }, '');
    history.pushState({ step: 'home', view: 'homeView' }, '');
    window.addEventListener('popstate', this.handleBack.bind(this));
  },
  navigate(viewId, isPlayer = false) {
    if (isPlayer) {
      document.getElementById('fullPlayer').classList.add('open');
      history.pushState({ step: 'player' }, '');
    } else {
      this.switchUI(viewId);
      history.pushState({ step: 'view', view: viewId }, '');
    }
  },
  switchUI(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if(target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.remove('active');
      if(n.dataset.target === viewId) n.classList.add('active');
    });
  },
  handleBack(e) {
    if (document.getElementById('fullPlayer').classList.contains('open')) {
      document.getElementById('fullPlayer').classList.remove('open');
    } 
    else if (e.state && e.state.view) {
      this.switchUI(e.state.view);
    } 
    else if (e.state && e.state.step === 'trap') {
      document.getElementById('exitModal').style.display = 'flex';
      history.pushState({ step: 'home', view: 'homeView' }, '');
    }
  }
};

window.onload = () => {
  Router.init();
  initMediaSession(); // Initialize handlers strictly ONCE
  loadHomeData();
  renderFavorites();
  renderLibrary();
  renderSavedCollections();
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

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const targetId = item.dataset.target;
    Router.navigate(targetId);
    if(targetId === 'archiveView') renderArchive();
    if(targetId === 'homeView') renderFavorites();
    if(targetId === 'playlistView') { renderLibrary(); renderSavedCollections(); }
  });
});

document.getElementById('btnExitNo').addEventListener('click', () => document.getElementById('exitModal').style.display = 'none');
document.getElementById('btnExitYes').addEventListener('click', () => { document.getElementById('exitModal').style.display = 'none'; window.history.go(-2); });

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

window.handleCardClick = async function(id, type, title, img) {
  if (type === 'song') {
    isSearchContext = false;
    openTrack(id);
  } else if (type === 'artist') {
    isSearchContext = false;
    currentArtistToken = id;
    currentArtistPage = 0;
    currentCollectionInfo = { id, type, title, img };
    setupCollectionHeader(title, img, 'ARTIST RADAR');

    try {
      const res = await fetch(`/api/artist?token=${encodeURIComponent(id)}&page=0&_t=${Date.now()}`);
      const data = await res.json();
      if(data.topSongs && data.topSongs.length > 0) {
        currentContextList = data.topSongs; 
        renderCollectionList(currentContextList, true);
      } else {
        document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px;">No tracks found.</div>`;
      }
    } catch(err) {
      document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px; color:var(--crimson);">Error loading artist.</div>`;
    }
  } else {
    isSearchContext = false;
    currentCollectionInfo = { id, type, title, img };
    setupCollectionHeader(title, img, 'ALBUM / PLAYLIST');

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(title)}&_t=${Date.now()}`);
      const data = await res.json();
      if(data.results && data.results.length > 0) {
        currentContextList = data.results; 
        renderCollectionList(currentContextList, false);
      } else {
        document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px;">No tracks found.</div>`;
      }
    } catch(err) {
      document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px; color:var(--crimson);">Error loading collection.</div>`;
    }
  }
};

function setupCollectionHeader(title, img, subtitle) {
  document.getElementById('colImg').src = img;
  document.getElementById('colTitle').textContent = title;
  document.getElementById('colSubtitle').textContent = subtitle;
  document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 40px; font-family:'Space Mono'; color:var(--crimson);">Loading Tracks...</div>`;
  checkCollectionState();
  Router.navigate('collectionView');
}

function renderCollectionList(songs, isArtist) {
  let html = songs.map((r, index) => {
    const isPlaying = currentSongData && r.pid === currentSongData.pid;
    return `
    <div class="result-card ${isPlaying ? 'active-track' : ''}" onclick="openTrack('${r.pid}')" style="border:none; border-bottom:1px dashed var(--grid-line); box-shadow:none; padding: 12px 4px; background: transparent; border-radius: 0;">
      <img src="${r.image}" class="result-img">
      <div class="result-info" style="padding-left: 10px;">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      ${isPlaying ? `<div class="playing-icon" style="color:var(--crimson);">▶</div>` : `<div style="font-size:16px; color:var(--text-muted);">⚬</div>`}
    </div>
  `}).join('');

  if(isArtist) {
    html += `
    <div style="display:flex; justify-content:space-between; padding: 20px 10px; gap:10px;">
      <button class="btn-page" onclick="changeArtistPage(-1)" id="prevPageBtn" ${currentArtistPage === 0 ? 'disabled style="opacity:0.5"' : ''}>← PREV</button>
      <div style="font-size:14px; font-weight:bold; align-self:center;">PAGE ${currentArtistPage + 1}</div>
      <button class="btn-page" onclick="changeArtistPage(1)" id="nextPageBtn">NEXT →</button>
    </div>`;
  }
  document.getElementById('collectionList').innerHTML = html;
}

window.changeArtistPage = async function(direction) {
  currentArtistPage += direction;
  if(currentArtistPage < 0) currentArtistPage = 0;
  
  document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 40px; font-family:'Space Mono'; color:var(--crimson);">Loading Page ${currentArtistPage + 1}...</div>`;
  
  try {
    const res = await fetch(`/api/artist?token=${encodeURIComponent(currentArtistToken)}&page=${currentArtistPage}&_t=${Date.now()}`);
    const data = await res.json();
    if(data.topSongs && data.topSongs.length > 0) {
      currentContextList = data.topSongs; 
      renderCollectionList(currentContextList, true);
    } else {
      document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px;">No more tracks on this page.</div>
      <button class="btn-page" onclick="changeArtistPage(-1)">← GO BACK</button>`;
    }
  } catch(err) {
    document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px; color:var(--crimson);">Error loading page.</div>`;
  }
};

document.getElementById('collectionBackBtn').addEventListener('click', () => { Router.navigate('homeView'); });

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
  searchTimer = setTimeout(() => executeLiveSearch(query), 500); 
});

async function executeLiveSearch(query) {
  try {
    isSearchContext = true; 
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`);
    const data = await res.json();
    searchSpinner.style.display = 'none';

    const results = data.results || [];
    if(!results.length) {
      document.getElementById('topMatchContainer').style.display = 'none';
      document.getElementById('resultsList').innerHTML = `<div style="padding:20px;text-align:center;">No results found.</div>`;
      return;
    }

    currentContextList = results; 

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

    document.getElementById('otherResultsTitle').style.display = 'block';
    document.getElementById('resultsList').innerHTML = results.slice(1).map((r, i) => `
      <div class="result-card" onclick="openTrack('${r.pid}')">
        <img class="result-img" src="${r.image}" alt="Cover">
        <div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div>
        <button class="btn-play-badge">PLAY</button>
      </div>
    `).join('');
  } catch (err) { searchSpinner.style.display = 'none'; }
}

const audio = document.getElementById('audio');

// ==========================================
// 🚨 NOTIFICATION BAR (MEDIA SESSION)
// ==========================================

function initMediaSession() {
  if (!('mediaSession' in navigator)) return;

  const actions = [
    ['play', () => { audio.play(); setPlayState(true); }],
    ['pause', () => { audio.pause(); setPlayState(false); }],
    ['previoustrack', () => {
      if (currentContextList.length > 0 && currentTrackIndex > 0) {
        openTrack(currentContextList[currentTrackIndex - 1].pid);
      } else { audio.currentTime = 0; }
    }],
    ['nexttrack', () => playNextSong()],
    ['seekto', (details) => { audio.currentTime = details.seekTime; }],
    ['seekbackward', null],
    ['seekforward', null]
  ];

  for (const [action, handler] of actions) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (e) {
      console.warn(`Unsupported media action: ${action}`);
    }
  }
}

function updateMediaSessionMetadata(songData) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: songData.title || 'Unknown Track',
      artist: songData.artist || 'Unknown Artist',
      album: songData.album || 'OG-SONG DL Vault',
      artwork: [
        { src: songData.image.replace('150x150', '500x500'), sizes: '512x512', type: 'image/jpeg' }
      ]
    });
  }
}

function updateMediaSessionPosition() {
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    if(Number.isFinite(audio.duration) && audio.duration > 0 && Number.isFinite(audio.currentTime)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate,
          position: audio.currentTime
        });
      } catch(e) {} 
    }
  }
}

// ==========================================

async function openTrack(pid) {
  showToast('Decrypting HQ Stream...');
  try {
    const res = await fetch(`/api/details?pid=${encodeURIComponent(pid)}`);
    const data = await res.json();
    if(!data.success) throw new Error(data.error || 'Playback failed');

    currentSongData = data;
    
    if (isSearchContext) {
      isSearchContext = false; 
      fetch(`/api/recommend?lang=${data.language || 'hindi'}`)
        .then(r => r.json())
        .then(radioSongs => {
          if (radioSongs && radioSongs.length > 0) {
            currentContextList = [data, ...radioSongs.filter(s => s.pid !== data.pid)];
            currentTrackIndex = 0;
            renderPlayerQueue(); 
          }
        }).catch(() => { });
    } else {
      currentTrackIndex = currentContextList.findIndex(t => t.pid === pid);
      renderPlayerQueue();
    }

    if (document.getElementById('collectionView').classList.contains('active')) {
      renderCollectionList(currentContextList, currentArtistToken !== '');
    }

    document.getElementById('pTitle').textContent = data.title;
    document.getElementById('pArtist').textContent = data.artist;
    document.getElementById('pAlbum').textContent = data.album || 'Single';
    document.getElementById('playerCover').src = data.image;

    document.getElementById('mpTitle').textContent = data.title;
    document.getElementById('mpArtist').textContent = data.artist;
    document.getElementById('mpCover').src = data.image;
    document.getElementById('miniPlayer').style.display = 'flex';

    // UPDATE PREMIUM NOTIFICATION ART & TITLE
    updateMediaSessionMetadata(data);

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

function renderPlayerQueue() {
  const queueEl = document.getElementById('playerQueueList');
  if(!queueEl) return;
  if(currentContextList.length <= 1) { queueEl.innerHTML = ''; return; }

  let html = currentContextList.map((r, index) => {
    const isPlaying = index === currentTrackIndex;
    return `
    <div class="result-card ${isPlaying ? 'active-track' : ''}" onclick="openTrack('${r.pid}')" style="border:none; border-bottom:1px dashed var(--grid-line); box-shadow:none; padding: 8px 4px; background: transparent; border-radius: 0;">
      <img src="${r.image}" class="result-img" style="width:36px; height:36px;">
      <div class="result-info" style="padding-left: 10px;">
        <div class="result-title" style="${isPlaying ? 'color:var(--crimson);' : ''}">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      ${isPlaying ? `<div class="playing-icon" style="color:var(--crimson);">▶</div>` : ``}
    </div>
  `}).join('');

  html += `<div style="text-align:center; padding: 12px;"><button class="btn-page" onclick="extendQueue()" id="extQueueBtn" style="padding:10px; font-size:12px;">LOAD MORE RELATED ↓</button></div>`;
  queueEl.innerHTML = html;
}

window.extendQueue = async function() {
  const btn = document.getElementById('extQueueBtn');
  if(btn) { btn.disabled = true; btn.textContent = 'LOADING...'; }
  
  const lastTrack = currentContextList[currentContextList.length - 1];
  if(!lastTrack) return;

  try {
    const res = await fetch(`/api/recommend?lang=${lastTrack.language || 'hindi'}`);
    const newSongs = await res.json();
    
    const existingPids = new Set(currentContextList.map(s => s.pid));
    const unique = newSongs.filter(s => !existingPids.has(s.pid));
    
    currentContextList.push(...unique);
    renderPlayerQueue();
  } catch(e) {
    if(btn) { btn.textContent = 'ERROR'; btn.disabled = false; }
  }
};

document.getElementById('closePlayerBtn').addEventListener('click', () => history.back());

document.getElementById('miniPlayer').addEventListener('click', function(e) {
  if (e.target.closest('#mpPlayBtn')) return;
  Router.navigate('fullPlayer', true);
});

document.getElementById('mpPlayBtn').addEventListener('click', function(e) { e.stopPropagation(); togglePlay(); });
document.getElementById('playBtn').addEventListener('click', () => togglePlay());

function togglePlay() { 
  if (audio.paused && audio.src) { audio.play(); setPlayState(true); } else { audio.pause(); setPlayState(false); } 
}

function setPlayState(isPlaying) {
  document.getElementById('playBtn').textContent = isPlaying ? '❚❚' : '▶';
  document.getElementById('mpPlayBtn').textContent = isPlaying ? '❚❚' : '▶';
  document.getElementById('discCover').classList.toggle('playing', isPlaying);
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    // Update position here so it stays synced when pausing/playing
    updateMediaSessionPosition();
  }
}

document.getElementById('prevTrackBtn').addEventListener('click', () => {
  if (currentContextList.length > 0 && currentTrackIndex > 0) {
    openTrack(currentContextList[currentTrackIndex - 1].pid);
  } else {
    audio.currentTime = 0;
    showToast('Playing from start');
  }
});

document.getElementById('nextTrackBtn').addEventListener('click', () => playNextSong());

audio.addEventListener('play', () => setPlayState(true));
audio.addEventListener('pause', () => setPlayState(false));
audio.addEventListener('ended', () => { setPlayState(false); playNextSong(); });

const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');

audio.addEventListener('loadedmetadata', () => { 
  durTime.textContent = fmtTime(audio.duration); 
  seek.max = audio.duration || 100; 
  updateMediaSessionPosition();
});

audio.addEventListener('timeupdate', () => { 
  if (!seek._dragging) seek.value = audio.currentTime; 
  curTime.textContent = fmtTime(audio.currentTime); 
  // Omitted updateMediaSessionPosition() here to prevent freezing the notification seekbar
});

seek.addEventListener('input', () => { 
  seek._dragging = true; 
  curTime.textContent = fmtTime(seek.value); 
});

seek.addEventListener('change', () => { 
  audio.currentTime = parseFloat(seek.value); 
  seek._dragging = false; 
  updateMediaSessionPosition(); 
});

document.getElementById('vol').addEventListener('input', (e) => { 
  audio.volume = e.target.value / 100; 
});

document.getElementById('speed').addEventListener('change', (e) => { 
  audio.playbackRate = parseFloat(e.target.value); 
  updateMediaSessionPosition();
});

function playNextSong() {
  if (currentContextList.length > 0 && currentTrackIndex >= 0 && currentTrackIndex < currentContextList.length - 1) {
    openTrack(currentContextList[currentTrackIndex + 1].pid);
  } else {
    showToast('Playlist Finished');
  }
}

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
  list.innerHTML = archive.map(r => `<div class="result-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_archive')||'[]'); openTrack('${r.pid}')"><img class="result-img" src="${r.image}" alt="Cover"><div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div><button class="btn-play-badge">PLAY</button></div>`).join('');
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
  if(!favs.length) { grid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:10px;">No favorites yet.</div>`; return; }
  grid.innerHTML = favs.map(i => `<div class="grid-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_favorites')||'[]'); openTrack('${i.pid}')"><img src="${i.image}" alt="Art"><div class="grid-title">${i.title}</div></div>`).join('');
}

window.switchLibTab = function(tab) {
  document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'));
  if(tab === 'songs') {
    document.getElementById('tabSongs').classList.add('active');
    document.getElementById('playlistGrid').style.display = 'flex';
    document.getElementById('savedCollectionsGrid').style.display = 'none';
  } else {
    document.getElementById('tabCollections').classList.add('active');
    document.getElementById('playlistGrid').style.display = 'none';
    document.getElementById('savedCollectionsGrid').style.display = 'flex';
  }
}

function renderLibrary() {
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  const list = document.getElementById('playlistGrid');
  if(!libs.length) { list.innerHTML = `<div style="padding:24px;text-align:center;border:2px dashed var(--border-dark);">No saved songs.</div>`; return; }
  list.innerHTML = libs.map(r => `<div class="result-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_library')||'[]'); openTrack('${r.pid}')"><img class="result-img" src="${r.image}" alt="Cover"><div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div><button class="btn-play-badge">PLAY</button></div>`).join('');
}

window.toggleCollectionSave = function() {
  if(!currentCollectionInfo) return;
  let cols = JSON.parse(localStorage.getItem('og_collections') || '[]');
  const btn = document.getElementById('saveCollectionBtn');
  
  if(cols.find(c => c.id === currentCollectionInfo.id)) {
    cols = cols.filter(c => c.id !== currentCollectionInfo.id);
    btn.textContent = '+ Save Collection'; btn.classList.remove('saved');
    showToast('Collection Removed');
  } else {
    cols.unshift(currentCollectionInfo);
    btn.textContent = '✓ Saved'; btn.classList.add('saved');
    showToast('Collection Saved');
  }
  localStorage.setItem('og_collections', JSON.stringify(cols));
  renderSavedCollections();
}

function checkCollectionState() {
  if(!currentCollectionInfo) return;
  const cols = JSON.parse(localStorage.getItem('og_collections') || '[]');
  const btn = document.getElementById('saveCollectionBtn');
  if(cols.find(c => c.id === currentCollectionInfo.id)) {
    btn.textContent = '✓ Saved'; btn.classList.add('saved');
  } else {
    btn.textContent = '+ Save Collection'; btn.classList.remove('saved');
  }
}

function renderSavedCollections() {
  const cols = JSON.parse(localStorage.getItem('og_collections') || '[]');
  const grid = document.getElementById('savedCollectionsGrid');
  if(!cols.length) { grid.innerHTML = `<div style="padding:24px;text-align:center;border:2px dashed var(--border-dark);">No saved collections.</div>`; return; }
  
  grid.innerHTML = cols.map(c => `
    <div class="result-card" onclick="handleCardClick('${c.id}', '${c.type}', '${c.title.replace(/'/g, "\\'")}', '${c.img}')">
      <img class="result-img" src="${c.img}" alt="Cover">
      <div class="result-info"><div class="result-title">${c.title}</div><div class="result-meta">${c.type.toUpperCase()}</div></div>
      <button class="btn-play-badge">OPEN</button>
    </div>
  `).join('');
}

document.getElementById('openDlModal').addEventListener('click', () => document.getElementById('dlModal').style.display = 'flex');
document.getElementById('closeDlModal').addEventListener('click', () => document.getElementById('dlModal').style.display = 'none');
