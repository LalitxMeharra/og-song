/* ==========================================================================
   FINDXMUSIC : PREMIUM UI + CORE API ENGINE (MERGED)
   ========================================================================== */

let currentSongData = null;
let searchTimer = null;
let currentContextList = []; 
let currentTrackIndex = -1;

let currentArtistToken = '';
let currentArtistPage = 0;
let isSearchContext = false;
let currentCollectionInfo = null; 

// Premium SVG Icons
const playIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const pauseIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

const Router = {
  init() {
    history.replaceState({ step: 'trap' }, '');
    history.pushState({ step: 'home', view: 'homeView' }, '');
    window.addEventListener('popstate', this.handleBack.bind(this));
  },
  navigate(viewId, isPlayer = false) {
    if (isPlayer) {
      const fullPlayer = document.getElementById('fullPlayer');
      if(fullPlayer) fullPlayer.classList.add('open');
      history.pushState({ step: 'player' }, '');
    } else {
      this.switchUI(viewId);
      history.pushState({ step: 'view', view: viewId }, '');
    }
  },
  switchUI(viewId) {
    // Smooth transitions for new premium views and old views
    document.querySelectorAll('.view, .view-section').forEach(v => {
      v.classList.remove('active');
      v.classList.add('hidden');
      v.style.opacity = '0';
      v.style.transform = 'translateY(20px)';
    });
    
    const target = document.getElementById(viewId);
    if(target) {
      target.classList.remove('hidden');
      target.classList.add('active');
      setTimeout(() => {
          target.style.opacity = '1';
          target.style.transform = 'translateY(0)';
      }, 50);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.remove('active');
      if(n.dataset.target === viewId) n.classList.add('active');
    });
  },
  handleBack(e) {
    const fullPlayer = document.getElementById('fullPlayer');
    if (fullPlayer && fullPlayer.classList.contains('open')) {
      fullPlayer.classList.remove('open');
    } 
    else if (e.state && e.state.view) {
      this.switchUI(e.state.view);
    } 
    else if (e.state && e.state.step === 'trap') {
      const exitModal = document.getElementById('exitModal');
      if(exitModal) exitModal.style.display = 'flex';
      history.pushState({ step: 'home', view: 'homeView' }, '');
    }
  }
};

window.onload = () => {
  Router.init();
  initMediaSession(); 
  loadHomeData();
  renderFavorites();
  renderLibrary();
  renderSavedCollections();
  renderArchive();
  
  // Pause vinyl initially
  const spinningVinyl = document.querySelector('.spinning-vinyl');
  if(spinningVinyl) spinningVinyl.style.animationPlayState = 'paused';
};

function escapeHtml(s = '') { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
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

const btnExitNo = document.getElementById('btnExitNo');
const btnExitYes = document.getElementById('btnExitYes');
if(btnExitNo) btnExitNo.addEventListener('click', () => document.getElementById('exitModal').style.display = 'none');
if(btnExitYes) btnExitYes.addEventListener('click', () => { document.getElementById('exitModal').style.display = 'none'; window.history.go(-2); });

async function loadHomeData() {
  try {
    const res = await fetch('/api/home');
    const data = await res.json();
    const buildCards = (arr) => (arr || []).map(i => {
      const type = i.type || (i.more_info && i.more_info.featured_station_type) || 'album';
      const title = escapeHtml(i.title || i.song || i.more_info?.station_display_text || i.more_info?.query || 'Unknown');
      const img = escapeHtml((i.image || '').replace('150x150', '500x500'));
      return `<div class="grid-card track-card premium-card" onclick="handleCardClick('${i.id}', '${type}', '${title.replace(/'/g, "\\'")}', '${img}')"><div class="card-image-wrapper"><img src="${img}" loading="lazy"><div class="card-overlay-play">${playIconSVG}</div></div><div class="card-info"><div class="grid-title"><h3>${title}</h3></div></div></div>`;
    }).join('');

    if(document.getElementById('trendingGrid')) document.getElementById('trendingGrid').innerHTML = buildCards(data.trending);
    if(document.getElementById('newReleasesGrid')) document.getElementById('newReleasesGrid').innerHTML = buildCards(data.new_releases);
    if(document.getElementById('artistsGrid')) document.getElementById('artistsGrid').innerHTML = buildCards(data.artists);
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
      if(document.getElementById('collectionList')) document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px; color:var(--accent-primary);">Error loading artist.</div>`;
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
      if(document.getElementById('collectionList')) document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px; color:var(--accent-primary);">Error loading collection.</div>`;
    }
  }
};

function setupCollectionHeader(title, img, subtitle) {
  if(document.getElementById('colImg')) document.getElementById('colImg').src = img;
  if(document.getElementById('colTitle')) document.getElementById('colTitle').textContent = title;
  if(document.getElementById('colSubtitle')) document.getElementById('colSubtitle').textContent = subtitle;
  if(document.getElementById('collectionList')) document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 40px; font-family:'Inter'; color:var(--accent-primary);">Loading Tracks...</div>`;
  checkCollectionState();
  Router.navigate('collectionView');
}

function renderCollectionList(songs, isArtist) {
  let html = songs.map((r, index) => {
    const isPlaying = currentSongData && r.pid === currentSongData.pid;
    return `
    <div class="result-item playlist-item ${isPlaying ? 'active-playing' : ''}" onclick="openTrack('${r.pid}')">
      ${isPlaying ? `<div class="playing-indicator"><span class="bar bar1"></span><span class="bar bar2"></span><span class="bar bar3"></span></div>` : ''}
      <img src="${r.image}" class="result-img">
      <div class="result-info">
        <h4 class="result-title">${r.title}</h4>
        <p class="result-meta">${r.artist}</p>
      </div>
      <button class="circular-play-btn">${isPlaying ? pauseIconSVG : playIconSVG}</button>
    </div>
  `}).join('');

  if(isArtist) {
    html += `
    <div style="display:flex; justify-content:space-between; padding: 20px 10px; gap:10px;">
      <button class="btn-page premium-btn" onclick="changeArtistPage(-1)" id="prevPageBtn" ${currentArtistPage === 0 ? 'disabled style="opacity:0.5"' : ''}>← PREV</button>
      <div style="font-size:14px; font-weight:bold; align-self:center;">PAGE ${currentArtistPage + 1}</div>
      <button class="btn-page premium-btn" onclick="changeArtistPage(1)" id="nextPageBtn">NEXT →</button>
    </div>`;
  }
  if(document.getElementById('collectionList')) document.getElementById('collectionList').innerHTML = html;
}

window.changeArtistPage = async function(direction) {
  currentArtistPage += direction;
  if(currentArtistPage < 0) currentArtistPage = 0;
  
  if(document.getElementById('collectionList')) document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 40px; font-family:'Inter'; color:var(--accent-primary);">Loading Page ${currentArtistPage + 1}...</div>`;
  
  try {
    const res = await fetch(`/api/artist?token=${encodeURIComponent(currentArtistToken)}&page=${currentArtistPage}&_t=${Date.now()}`);
    const data = await res.json();
    if(data.topSongs && data.topSongs.length > 0) {
      currentContextList = data.topSongs; 
      renderCollectionList(currentContextList, true);
    } else {
      if(document.getElementById('collectionList')) document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px;">No more tracks on this page.</div>
      <button class="btn-page premium-btn" onclick="changeArtistPage(-1)">← GO BACK</button>`;
    }
  } catch(err) {
    if(document.getElementById('collectionList')) document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px; color:var(--accent-primary);">Error loading page.</div>`;
  }
};

const collectionBackBtn = document.getElementById('collectionBackBtn');
if(collectionBackBtn) collectionBackBtn.addEventListener('click', () => { Router.navigate('homeView'); });

// --- SEARCH LOGIC & CLEAR UX ---
const qInput = document.getElementById('search-input') || document.getElementById('q');
const searchSpinner = document.getElementById('searchSpinner');
const clearBtn = document.querySelector('.clear-search');

if(qInput) {
  qInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    
    // Clear button logic
    if (clearBtn) {
      if (query.length > 0) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    if(!query) {
      if(document.getElementById('topMatchContainer')) document.getElementById('topMatchContainer').style.display = 'none';
      if(document.getElementById('otherResultsTitle')) document.getElementById('otherResultsTitle').style.display = 'none';
      if(document.getElementById('resultsList')) document.getElementById('resultsList').innerHTML = '';
      return;
    }
    if(searchSpinner) searchSpinner.style.display = 'block';
    searchTimer = setTimeout(() => executeLiveSearch(query), 500); 
  });
}

if(clearBtn) {
  clearBtn.addEventListener('click', () => {
    if(qInput) qInput.value = '';
    clearBtn.classList.add('hidden');
    if(qInput) {
        qInput.focus();
        qInput.dispatchEvent(new Event('input'));
    }
  });
}

async function executeLiveSearch(query) {
  try {
    isSearchContext = true; 
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`);
    const data = await res.json();
    if(searchSpinner) searchSpinner.style.display = 'none';

    const results = data.results || [];
    if(!results.length) {
      if(document.getElementById('topMatchContainer')) document.getElementById('topMatchContainer').style.display = 'none';
      if(document.getElementById('resultsList')) document.getElementById('resultsList').innerHTML = `<div style="padding:20px;text-align:center;">No results found.</div>`;
      return;
    }

    currentContextList = results; 
    const top = results[0];
    
    if(document.getElementById('topMatchContainer')) {
      document.getElementById('topMatchContainer').style.display = 'block';
      document.getElementById('topMatchCard').innerHTML = `
        <div class="result-item" onclick="openTrack('${top.pid}')" style="background: rgba(230,57,70,0.1); border-color: var(--accent-primary);">
          <img src="${top.image}">
          <div class="result-info">
            <h4 class="title">${top.title}</h4>
            <p class="meta">${top.artist}</p>
          </div>
          <button class="circular-play-btn">${playIconSVG}</button>
        </div>
      `;
    }

    if(document.getElementById('otherResultsTitle')) document.getElementById('otherResultsTitle').style.display = 'block';
    if(document.getElementById('resultsList')) {
      document.getElementById('resultsList').innerHTML = results.slice(1).map((r, i) => `
        <div class="result-item" onclick="openTrack('${r.pid}')">
          <img class="result-img" src="${r.image}" alt="Cover">
          <div class="result-info"><h4 class="result-title">${r.title}</h4><p class="result-meta">${r.artist}</p></div>
          <button class="circular-play-btn">${playIconSVG}</button>
        </div>
      `).join('');
    }
  } catch (err) { if(searchSpinner) searchSpinner.style.display = 'none'; }
}

const audio = document.getElementById('audio') || new Audio();

function initMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const actions = [
    ['play', () => { audio.play(); setPlayState(true); }],
    ['pause', () => { audio.pause(); setPlayState(false); }],
    ['previoustrack', () => {
      if (currentContextList.length > 0 && currentTrackIndex > 0) openTrack(currentContextList[currentTrackIndex - 1].pid);
      else audio.currentTime = 0;
    }],
    ['nexttrack', () => playNextSong()],
    ['seekto', (details) => { audio.currentTime = details.seekTime; }]
  ];
  for (const [action, handler] of actions) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) { }
  }
}

function updateMediaSessionMetadata(songData) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: songData.title || 'Unknown Track',
      artist: songData.artist || 'Unknown Artist',
      album: songData.album || 'FindXMusic Dojo',
      artwork: [{ src: songData.image.replace('150x150', '500x500'), sizes: '512x512', type: 'image/jpeg' }]
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

async function openTrack(pid) {
  showToast('Striking target URL...');
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

    if (document.getElementById('collectionView') && document.getElementById('collectionView').classList.contains('active')) {
      renderCollectionList(currentContextList, currentArtistToken !== '');
    }

    // Populate track info in both old and new player formats
    const titleEls = document.querySelectorAll('#pTitle, #mpTitle, .player-track-info h4');
    const artistEls = document.querySelectorAll('#pArtist, #mpArtist, .player-track-info p');
    const imgEls = document.querySelectorAll('#playerCover, #mpCover, .spinning-vinyl img');
    
    titleEls.forEach(el => el.textContent = data.title);
    artistEls.forEach(el => el.textContent = data.artist);
    imgEls.forEach(el => el.src = data.image);

    updateMediaSessionMetadata(data);
    
    // Auto-open player info (if applicable)
    if(document.getElementById('miniPlayer')) document.getElementById('miniPlayer').style.display = 'flex';

    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    // Link downloads to the new premium button if ID matches or old buttons
    const dlBtn320 = document.getElementById('btn320') || document.querySelector('.download-btn');
    if(dlBtn320) dlBtn320.onclick = () => window.location.href = `/api/download?url=${encodeURIComponent(data.links['320'])}&filename=${safeTitle}&quality=320kbps`;

    audio.src = data.links['320'] || data.links['160'];
    audio.currentTime = 0;
    
    const volCtrl = document.getElementById('vol');
    if(volCtrl) audio.volume = volCtrl.value / 100;
    
    const speedCtrl = document.getElementById('speed');
    if(speedCtrl) audio.playbackRate = parseFloat(speedCtrl.value);
    
    audio.play().then(() => setPlayState(true)).catch(() => { setPlayState(false); showToast('Tap play to start'); });

    saveToArchive(data);
    checkActionStates(data.pid);
  } catch (err) { showToast('Error: ' + err.message); }
}

function renderPlayerQueue() {
  const queueEl = document.getElementById('playerQueueList');
  if(!queueEl) return;
  if(currentContextList.length <= 1) { queueEl.innerHTML = ''; return; }

  let html = currentContextList.map((r, index) => {
    const isPlaying = index === currentTrackIndex;
    return `
    <div class="result-item playlist-item ${isPlaying ? 'active-playing' : ''}" onclick="openTrack('${r.pid}')">
      ${isPlaying ? `<div class="playing-indicator"><span class="bar bar1"></span><span class="bar bar2"></span><span class="bar bar3"></span></div>` : ''}
      <img src="${r.image}" class="result-img" style="width:36px; height:36px;">
      <div class="result-info">
        <h4 class="result-title">${r.title}</h4>
        <p class="result-meta">${r.artist}</p>
      </div>
    </div>
  `}).join('');

  html += `<div style="text-align:center; padding: 12px;"><button class="btn-page premium-btn" onclick="extendQueue()" id="extQueueBtn">LOAD MORE ↓</button></div>`;
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
  } catch(e) { if(btn) { btn.textContent = 'ERROR'; btn.disabled = false; } }
};

const closePlayerBtn = document.getElementById('closePlayerBtn');
if(closePlayerBtn) closePlayerBtn.addEventListener('click', () => history.back());

const playerControls = document.querySelectorAll('.play-pause-btn, #mpPlayBtn, #playBtn');
playerControls.forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); }));

function togglePlay() { 
  if (audio.paused && audio.src) { audio.play(); setPlayState(true); } else { audio.pause(); setPlayState(false); } 
}

function setPlayState(isPlaying) {
  // Target old logic
  const playBtn = document.getElementById('playBtn');
  const mpPlayBtn = document.getElementById('mpPlayBtn');
  if(playBtn) playBtn.textContent = isPlaying ? '❚❚' : '▶';
  if(mpPlayBtn) mpPlayBtn.textContent = isPlaying ? '❚❚' : '▶';
  
  const discCover = document.getElementById('discCover');
  if(discCover) discCover.classList.toggle('playing', isPlaying);

  // Target New Premium Logic
  const premiumPlayBtn = document.querySelector('.play-pause-btn');
  if(premiumPlayBtn) premiumPlayBtn.innerHTML = isPlaying ? pauseIconSVG : playIconSVG;
  
  const spinningVinyl = document.querySelector('.spinning-vinyl');
  if(spinningVinyl) spinningVinyl.style.animationPlayState = isPlaying ? 'running' : 'paused';
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    updateMediaSessionPosition();
  }
}

const prevBtns = document.querySelectorAll('#prevTrackBtn, .prev-btn');
prevBtns.forEach(btn => btn.addEventListener('click', () => {
  if (currentContextList.length > 0 && currentTrackIndex > 0) openTrack(currentContextList[currentTrackIndex - 1].pid);
  else { audio.currentTime = 0; showToast('Playing from start'); }
}));

const nextBtns = document.querySelectorAll('#nextTrackBtn, .next-btn');
nextBtns.forEach(btn => btn.addEventListener('click', () => playNextSong()));

audio.addEventListener('play', () => setPlayState(true));
audio.addEventListener('pause', () => setPlayState(false));
audio.addEventListener('ended', () => { setPlayState(false); playNextSong(); });

// DYNAMIC PROGRESS BAR SYNC
const seek = document.getElementById('seek');
const curTime = document.querySelectorAll('#curTime, .time-current');
const durTime = document.querySelectorAll('#durTime, .time-total');
const progressBarFill = document.querySelector('.progress-bar-fill');
const progressContainer = document.querySelector('.player-progress-container');

audio.addEventListener('loadedmetadata', () => { 
  durTime.forEach(el => el.textContent = fmtTime(audio.duration)); 
  if(seek) seek.max = audio.duration || 100; 
  updateMediaSessionPosition();
});

audio.addEventListener('timeupdate', () => { 
  if (!seek || !seek._dragging) {
    if(seek) seek.value = audio.currentTime;
    if(progressBarFill && audio.duration) {
      progressBarFill.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
    }
  }
  curTime.forEach(el => el.textContent = fmtTime(audio.currentTime)); 
});

if(seek) {
  seek.addEventListener('input', () => { 
    seek._dragging = true; 
    curTime.forEach(el => el.textContent = fmtTime(seek.value)); 
  });
  seek.addEventListener('change', () => { 
    audio.currentTime = parseFloat(seek.value); 
    seek._dragging = false; 
    updateMediaSessionPosition(); 
  });
}

// Click to seek on new premium bar
if(progressContainer) {
  progressContainer.addEventListener('click', (e) => {
    if(audio.duration) {
      const clickPosition = e.offsetX;
      const totalWidth = progressContainer.clientWidth;
      audio.currentTime = (clickPosition / totalWidth) * audio.duration;
    }
  });
}

function playNextSong() {
  if (currentContextList.length > 0 && currentTrackIndex >= 0 && currentTrackIndex < currentContextList.length - 1) {
    openTrack(currentContextList[currentTrackIndex + 1].pid);
  } else { showToast('Playlist Finished'); }
}

// --- LOCAL STORAGE DATA HANDLING ---
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
  if(!list) return;
  if(!archive.length) { list.innerHTML = `<div style="padding:24px;text-align:center;">No playback history.</div>`; return; }
  list.innerHTML = archive.map(r => `<div class="result-item" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_archive')||'[]'); openTrack('${r.pid}')"><img class="result-img" src="${r.image}" alt="Cover"><div class="result-info"><h4 class="result-title">${r.title}</h4><p class="result-meta">${r.artist}</p></div><button class="circular-play-btn">${playIconSVG}</button></div>`).join('');
}

function toggleStorage(key, btnElem, activeIcon, inactiveIcon, addMsg, removeMsg, isPremiumSvg = false) {
  if(!currentSongData) return;
  let items = JSON.parse(localStorage.getItem(key) || '[]');
  if(items.find(s => s.pid === currentSongData.pid)) {
    items = items.filter(s => s.pid !== currentSongData.pid);
    if(isPremiumSvg) btnElem.style.color = 'var(--text-muted)';
    else { btnElem.textContent = inactiveIcon; btnElem.classList.remove('active'); }
    showToast(removeMsg);
  } else {
    items.unshift(currentSongData);
    if(isPremiumSvg) btnElem.style.color = 'var(--accent-primary)';
    else { btnElem.textContent = activeIcon; btnElem.classList.add('active'); }
    showToast(addMsg);
  }
  localStorage.setItem(key, JSON.stringify(items));
}

// Binding old and new favorite/library buttons
const favBtns = document.querySelectorAll('#favBtn, .fav-btn');
favBtns.forEach(btn => btn.addEventListener('click', function() { 
  const isSVG = this.classList.contains('fav-btn');
  toggleStorage('og_favorites', this, '♥', '♡', 'Added to Favorites', 'Removed from Favorites', isSVG); 
  renderFavorites(); 
}));

const libBtns = document.querySelectorAll('#libBtn, .add-btn');
libBtns.forEach(btn => btn.addEventListener('click', function() { 
  const isSVG = this.classList.contains('add-btn');
  toggleStorage('og_library', this, '✓', '+', 'Added to Library', 'Removed from Library', isSVG); 
  renderLibrary(); 
}));

function checkActionStates(pid) {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  
  document.querySelectorAll('#favBtn, .fav-btn').forEach(btn => {
    const isSVG = btn.classList.contains('fav-btn');
    if(favs.find(s => s.pid === pid)) {
      if(isSVG) btn.style.color = 'var(--accent-primary)'; else { btn.textContent = '♥'; btn.classList.add('active'); }
    } else {
      if(isSVG) btn.style.color = 'var(--text-muted)'; else { btn.textContent = '♡'; btn.classList.remove('active'); }
    }
  });

  document.querySelectorAll('#libBtn, .add-btn').forEach(btn => {
    const isSVG = btn.classList.contains('add-btn');
    if(libs.find(s => s.pid === pid)) {
      if(isSVG) btn.style.color = 'var(--accent-primary)'; else { btn.textContent = '✓'; btn.classList.add('active'); }
    } else {
      if(isSVG) btn.style.color = 'var(--text-muted)'; else { btn.textContent = '+'; btn.classList.remove('active'); }
    }
  });
}

function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const grid = document.getElementById('favoritesGrid');
  if(!grid) return;
  if(!favs.length) { grid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:10px;">No favorites yet.</div>`; return; }
  grid.innerHTML = favs.map(i => `<div class="grid-card track-card premium-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_favorites')||'[]'); openTrack('${i.pid}')"><div class="card-image-wrapper"><img src="${i.image}" alt="Art"><div class="card-overlay-play">${playIconSVG}</div></div><div class="card-info"><h3>${i.title}</h3></div></div>`).join('');
}

function renderLibrary() {
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  const list = document.getElementById('playlistGrid');
  if(!list) return;
  if(!libs.length) { list.innerHTML = `<div style="padding:24px;text-align:center;">No saved songs.</div>`; return; }
  list.innerHTML = libs.map(r => `<div class="result-item" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_library')||'[]'); openTrack('${r.pid}')"><img class="result-img" src="${r.image}" alt="Cover"><div class="result-info"><h4 class="result-title">${r.title}</h4><p class="result-meta">${r.artist}</p></div><button class="circular-play-btn">${playIconSVG}</button></div>`).join('');
}

function renderSavedCollections() {
  const cols = JSON.parse(localStorage.getItem('og_collections') || '[]');
  const grid = document.getElementById('savedCollectionsGrid');
  if(!grid) return;
  if(!cols.length) { grid.innerHTML = `<div style="padding:24px;text-align:center;">No saved collections.</div>`; return; }
  grid.innerHTML = cols.map(c => `
    <div class="result-item" onclick="handleCardClick('${c.id}', '${c.type}', '${c.title.replace(/'/g, "\\'")}', '${c.img}')">
      <img class="result-img" src="${c.img}" alt="Cover">
      <div class="result-info"><h4 class="result-title">${c.title}</h4><p class="result-meta">${c.type.toUpperCase()}</p></div>
      <button class="circular-play-btn">${playIconSVG}</button>
    </div>
  `).join('');
}