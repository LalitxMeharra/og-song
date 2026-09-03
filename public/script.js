let currentSongData = null;
let searchTimer = null;
let currentContextList = []; 
let currentTrackIndex = -1;

let currentArtistToken = '';
let currentArtistPage = 0;
let isSearchContext = false;
let currentCollectionInfo = null; 

const svgPlay = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const svgPause = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
const svgFavActive = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
const svgFavInactive = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
const svgLibActive = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const svgLibInactive = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

const Router = {
  init: function() {
    history.replaceState({ step: 'trap' }, '');
    history.pushState({ step: 'home', view: 'homeView' }, '');
    window.addEventListener('popstate', this.handleBack.bind(this));
  },
  navigate: function(viewId, isPlayer) {
    if (isPlayer) {
      const fp = document.getElementById('fullPlayer');
      if (fp) fp.classList.add('open');
      history.pushState({ step: 'player' }, '');
    } else {
      this.switchUI(viewId);
      history.pushState({ step: 'view', view: viewId }, '');
    }
  },
  switchUI: function(viewId) {
    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    const target = document.getElementById(viewId);
    if(target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    document.querySelectorAll('.nav-item').forEach(function(n) {
      n.classList.remove('active');
      if(n.dataset.target === viewId) n.classList.add('active');
    });
  },
  handleBack: function(e) {
    const fp = document.getElementById('fullPlayer');
    if (fp && fp.classList.contains('open')) {
      fp.classList.remove('open');
    } 
    else if (e.state && e.state.view) {
      this.switchUI(e.state.view);
    } 
    else if (e.state && e.state.step === 'trap') {
      const exitMod = document.getElementById('exitModal');
      if(exitMod) exitMod.style.display = 'flex';
      history.pushState({ step: 'home', view: 'homeView' }, '');
    }
  }
};

let isAppInitialized = false;
function initApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;
    Router.init();
    initMediaSession(); 
    loadHomeData();
    renderFavorites();
    renderLibrary();
    renderSavedCollections();
    renderArchive();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function escapeHtml(s) { return String(s || '').replace(/[&<>'"]/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }

function showToast(msg) {
  const t = document.getElementById('toast');
  const tm = document.getElementById('toastMsg');
  if(!t || !tm) return;
  tm.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(function() { t.classList.remove('show'); }, 2400);
}

function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

document.querySelectorAll('.nav-item').forEach(function(item) {
  item.addEventListener('click', function() {
    const targetId = item.dataset.target;
    Router.navigate(targetId);
    if(targetId === 'archiveView') renderArchive();
    if(targetId === 'homeView') renderFavorites();
    if(targetId === 'playlistView') { renderLibrary(); renderSavedCollections(); }
  });
});

const btnExitNo = document.getElementById('btnExitNo');
if (btnExitNo) btnExitNo.addEventListener('click', function() { 
  document.getElementById('exitModal').style.display = 'none';
});

const btnExitYes = document.getElementById('btnExitYes');
if (btnExitYes) btnExitYes.addEventListener('click', function() { 
  document.getElementById('exitModal').style.display = 'none'; 
  window.history.go(-2); 
});

async function loadHomeData() {
  try {
    const res = await fetch('/api/home');
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    
    const buildCards = function(arr) {
      if (!arr || !Array.isArray(arr)) return '';
      return arr.map(function(i) {
        const type = i.type || (i.more_info && i.more_info.featured_station_type) || 'album';
        let title = i.title || i.song || 'Unknown';
        if (typeof title === 'object' && title.text) title = title.text;
        title = escapeHtml(title);
        const img = escapeHtml((i.image || '').replace('150x150', '500x500'));
        return `<div class="grid-card" onclick="handleCardClick('${i.id}', '${type}', '${title.replace(/'/g, "\\'")}', '${img}')"><img src="${img}" loading="lazy"><div class="grid-title">${title}</div></div>`;
      }).join('');
    };

    const tGrid = document.getElementById('trendingGrid');
    const nGrid = document.getElementById('newReleasesGrid');
    const aGridHome = document.getElementById('artistsGridHome');
    const aGridExplore = document.getElementById('artistsGridExplore');
    
    if(tGrid) tGrid.innerHTML = buildCards(data.trending);
    if(nGrid) nGrid.innerHTML = buildCards(data.new_releases);
    
    const artistCards = buildCards(data.artists);
    if(aGridHome) aGridHome.innerHTML = artistCards;
    if(aGridExplore) aGridExplore.innerHTML = artistCards;
  } catch (err) { 
    console.error('Home Load Error:', err); 
  }
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
      const colList = document.getElementById('collectionList');
      
      if(data.topSongs && data.topSongs.length > 0) {
        currentContextList = data.topSongs; 
        renderCollectionList(currentContextList, true);
      } else {
        if(colList) colList.innerHTML = `<div class="state-empty">No tracks found.</div>`;
      }
    } catch(err) {
      const colList = document.getElementById('collectionList');
      if(colList) colList.innerHTML = `<div class="state-msg error">Error loading artist.</div>`;
    }
  } else {
    isSearchContext = false;
    currentCollectionInfo = { id, type, title, img };
    setupCollectionHeader(title, img, 'ALBUM / PLAYLIST');

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(title)}&_t=${Date.now()}`);
      const data = await res.json();
      const colList = document.getElementById('collectionList');
      
      if(data.results && data.results.length > 0) {
        currentContextList = data.results; 
        renderCollectionList(currentContextList, false);
      } else {
        if(colList) colList.innerHTML = `<div class="state-empty">No tracks found.</div>`;
      }
    } catch(err) {
      const colList = document.getElementById('collectionList');
      if(colList) colList.innerHTML = `<div class="state-msg error">Error loading collection.</div>`;
    }
  }
};

function setupCollectionHeader(title, img, subtitle) {
  const colImg = document.getElementById('colImg');
  const colTitle = document.getElementById('colTitle');
  const colSub = document.getElementById('colSubtitle');
  const colList = document.getElementById('collectionList');
  
  if(colImg) colImg.src = img;
  if(colTitle) colTitle.textContent = title;
  if(colSub) colSub.textContent = subtitle;
  if(colList) colList.innerHTML = `<div class="state-msg loading">Loading Tracks...</div>`;
  
  checkCollectionState();
  Router.navigate('collectionView');
}

function renderCollectionList(songs, isArtist) {
  let html = songs.map(function(r) {
    const isPlaying = currentSongData && r.pid === currentSongData.pid;
    return `
    <div class="result-card ${isPlaying ? 'active-track' : ''}" onclick="openTrack('${r.pid}')">
      <img src="${r.image}" class="result-img">
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      <div style="color:var(--text-muted);">${isPlaying ? svgPause : svgPlay}</div>
    </div>
  `}).join('');

  if(isArtist) {
    const disabledStyle = currentArtistPage === 0 ? 'disabled' : '';
    html += `
    <div style="display:flex; justify-content:space-between; padding: 20px 0; gap:10px;">
      <button class="btn-page premium-pill" onclick="changeArtistPage(-1)" id="prevPageBtn" ${disabledStyle}>← PREV</button>
      <div class="page-indicator">PAGE ${currentArtistPage + 1}</div>
      <button class="btn-page premium-pill" onclick="changeArtistPage(1)" id="nextPageBtn">NEXT →</button>
    </div>`;
  }
  const colList = document.getElementById('collectionList');
  if(colList) colList.innerHTML = html;
}

window.changeArtistPage = async function(direction) {
  currentArtistPage += direction;
  if(currentArtistPage < 0) currentArtistPage = 0;
  
  const colList = document.getElementById('collectionList');
  if(colList) colList.innerHTML = `<div class="state-msg loading">Loading Page ${currentArtistPage + 1}...</div>`;
  
  try {
    const res = await fetch(`/api/artist?token=${encodeURIComponent(currentArtistToken)}&page=${currentArtistPage}&_t=${Date.now()}`);
    const data = await res.json();
    if(data.topSongs && data.topSongs.length > 0) {
      currentContextList = data.topSongs; 
      renderCollectionList(currentContextList, true);
    } else {
      if(colList) colList.innerHTML = `<div class="state-empty">No more tracks on this page.</div>
      <button class="btn-page premium-pill" onclick="changeArtistPage(-1)">← GO BACK</button>`;
    }
  } catch(err) {
    if(colList) colList.innerHTML = `<div class="state-msg error">Error loading page.</div>`;
  }
};

const colBackBtn = document.getElementById('collectionBackBtn');
if (colBackBtn) colBackBtn.addEventListener('click', function() { Router.navigate('homeView'); });

const qInput = document.getElementById('q');
const searchSpinner = document.getElementById('searchSpinner');

if(qInput) {
  qInput.addEventListener('input', function(e) {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    
    const exploreArtistTitle = document.getElementById('exploreArtistTitle');
    const artistsGridExplore = document.getElementById('artistsGridExplore');
    const topContainer = document.getElementById('topMatchContainer');
    const otherTitle = document.getElementById('otherResultsTitle');
    const resList = document.getElementById('resultsList');

    if(!query) {
      if(topContainer) topContainer.style.display = 'none';
      if(otherTitle) otherTitle.style.display = 'none';
      if(resList) resList.innerHTML = '';
      if(exploreArtistTitle) exploreArtistTitle.style.display = 'flex';
      if(artistsGridExplore) artistsGridExplore.style.display = 'flex';
      return;
    }
    
    if(exploreArtistTitle) exploreArtistTitle.style.display = 'none';
    if(artistsGridExplore) artistsGridExplore.style.display = 'none';
    if(searchSpinner) searchSpinner.style.display = 'block';
    
    searchTimer = setTimeout(function() { executeLiveSearch(query); }, 500); 
  });
}

async function executeLiveSearch(query) {
  try {
    isSearchContext = true; 
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`);
    const data = await res.json();
    if(searchSpinner) searchSpinner.style.display = 'none';

    const results = data.results || [];
    const topContainer = document.getElementById('topMatchContainer');
    const resList = document.getElementById('resultsList');

    if(!results.length) {
      if(topContainer) topContainer.style.display = 'none';
      if(resList) resList.innerHTML = `<div class="state-empty">No results found.</div>`;
      return;
    }

    currentContextList = results; 
    const top = results[0];
    const topCard = document.getElementById('topMatchCard');
    
    if(topContainer && topCard) {
      topContainer.style.display = 'block';
      topCard.innerHTML = `
        <div class="top-match-card" onclick="openTrack('${top.pid}')">
          <img src="${top.image}">
          <div class="info">
            <div class="title">${top.title}</div>
            <div class="meta">${top.artist}</div>
          </div>
          <div style="color:var(--crimson);">${svgPlay}</div>
        </div>
      `;
    }

    const otherTitle = document.getElementById('otherResultsTitle');
    if(otherTitle) otherTitle.style.display = 'block';
    if(resList) {
      resList.innerHTML = results.slice(1).map(function(r) {
        return `
        <div class="result-card" onclick="openTrack('${r.pid}')">
          <img class="result-img" src="${r.image}" alt="Cover">
          <div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div>
          <div style="color:var(--text-muted);">${svgPlay}</div>
        </div>
      `}).join('');
    }
  } catch (err) { 
    if(searchSpinner) searchSpinner.style.display = 'none'; 
  }
}

const audio = document.getElementById('audio') || new Audio();

function initMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const actions = [
    ['play', function() { audio.play(); setPlayState(true); }],
    ['pause', function() { audio.pause(); setPlayState(false); }],
    ['previoustrack', function() {
      if (currentContextList.length > 0 && currentTrackIndex > 0) openTrack(currentContextList[currentTrackIndex - 1].pid);
      else audio.currentTime = 0; 
    }],
    ['nexttrack', function() { playNextSong(); }],
    ['seekto', function(details) { audio.currentTime = details.seekTime; }]
  ];
  for (let i = 0; i < actions.length; i++) {
    try { navigator.mediaSession.setActionHandler(actions[i][0], actions[i][1]); } catch (e) {}
  }
}

function updateMediaSessionMetadata(songData) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: songData.title || 'Unknown Track',
      artist: songData.artist || 'Unknown Artist',
      album: songData.album || 'FindXMusic Vault',
      artwork: [ { src: songData.image.replace('150x150', '500x500'), sizes: '512x512', type: 'image/jpeg' } ]
    });
  }
}

function updateMediaSessionPosition() {
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
    if(Number.isFinite(audio.duration) && audio.duration > 0 && Number.isFinite(audio.currentTime)) {
      try {
        navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: audio.currentTime });
      } catch(e) {} 
    }
  }
}

async function openTrack(pid) {
  showToast('Decrypting HQ Stream...');
  try {
    const res = await fetch(`/api/details?pid=${encodeURIComponent(pid)}`);
    const data = await res.json();
    if(!data.success) throw new Error(data.error || 'Playback failed');

    currentSongData = data;
    
    if (isSearchContext) {
      isSearchContext = false; 
      fetch(`/api/recommend?pid=${data.pid}`)
        .then(function(r) { return r.json(); })
        .then(function(radioSongs) {
          if (radioSongs && radioSongs.length > 0) {
            currentContextList = [data].concat(radioSongs.filter(function(s) { return s.pid !== data.pid; }));
            currentTrackIndex = 0;
            renderPlayerQueue(); 
          }
        }).catch(function() { });
    } else {
      currentTrackIndex = currentContextList.findIndex(function(t) { return t.pid === pid; });
      renderPlayerQueue();
    }

    const cv = document.getElementById('collectionView');
    if (cv && cv.classList.contains('active')) {
      renderCollectionList(currentContextList, currentArtistToken !== '');
    }

    const pTitle = document.getElementById('pTitle');
    const pArtist = document.getElementById('pArtist');
    const pAlbum = document.getElementById('pAlbum');
    const pCover = document.getElementById('playerCover');
    const mpTitle = document.getElementById('mpTitle');
    const mpArtist = document.getElementById('mpArtist');
    const mpCover = document.getElementById('mpCover');
    const miniP = document.getElementById('miniPlayer');

    if(pTitle) pTitle.textContent = data.title;
    if(pArtist) pArtist.textContent = data.artist;
    if(pAlbum) pAlbum.textContent = data.album || 'Single';
    if(pCover) pCover.src = data.image;

    if(mpTitle) mpTitle.textContent = data.title;
    if(mpArtist) mpArtist.textContent = data.artist;
    if(mpCover) mpCover.src = data.image;
    if(miniP) miniP.style.display = 'flex';

    updateMediaSessionMetadata(data);
    Router.navigate('fullPlayer', true);

    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    const btn320 = document.getElementById('btn320');
    const btn160 = document.getElementById('btn160');
    const btn96 = document.getElementById('btn96');
    
    if(btn320) btn320.href = `/api/download?url=${encodeURIComponent(data.links['320'])}&filename=${safeTitle}&quality=320kbps`;
    if(btn160) btn160.href = `/api/download?url=${encodeURIComponent(data.links['160'])}&filename=${safeTitle}&quality=160kbps`;
    if(btn96) btn96.href = `/api/download?url=${encodeURIComponent(data.links['96'])}&filename=${safeTitle}&quality=96kbps`;

    audio.src = data.links['320'] || data.links['160'];
    audio.currentTime = 0;
    
    const vol = document.getElementById('vol');
    if(vol) audio.volume = vol.value / 100;
    
    const speed = document.getElementById('speed');
    if(speed) audio.playbackRate = parseFloat(speed.value);
    
    audio.play().then(function() { setPlayState(true); }).catch(function() { setPlayState(false); showToast('Tap play to start'); });

    saveToArchive(data);
    checkActionStates(data.pid);
  } catch (err) { showToast('Track Error: ' + err.message); }
}

function renderPlayerQueue() {
  const queueEl = document.getElementById('playerQueueList');
  if(!queueEl) return;
  if(currentContextList.length <= 1) { queueEl.innerHTML = ''; return; }

  let html = currentContextList.map(function(r, index) {
    const isPlaying = index === currentTrackIndex;
    return `
    <div class="result-card ${isPlaying ? 'active-track' : ''}" onclick="openTrack('${r.pid}')">
      <img src="${r.image}" class="result-img" style="width:40px; height:40px;">
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      <div style="color:var(--text-muted);">${isPlaying ? svgPause : svgPlay}</div>
    </div>
  `}).join('');

  html += `<div style="padding-top: 10px;"><button class="btn-page premium-pill" onclick="extendQueue()" id="extQueueBtn" style="border-radius:8px;">LOAD MORE RELATED ↓</button></div>`;
  queueEl.innerHTML = html;
}

window.extendQueue = async function() {
  const btn = document.getElementById('extQueueBtn');
  if(btn) { btn.disabled = true; btn.textContent = 'LOADING...'; }
  
  const lastTrack = currentContextList[currentContextList.length - 1];
  if(!lastTrack) return;

  try {
    const res = await fetch(`/api/recommend?pid=${lastTrack.pid}`);
    const newSongs = await res.json();
    
    const existingPids = new Set(currentContextList.map(function(s) { return s.pid; }));
    const unique = newSongs.filter(function(s) { return !existingPids.has(s.pid); });
    
    Array.prototype.push.apply(currentContextList, unique);
    renderPlayerQueue();
  } catch(e) {
    if(btn) { btn.textContent = 'ERROR'; btn.disabled = false; }
  }
};

const clsBtn = document.getElementById('closePlayerBtn');
if(clsBtn) clsBtn.addEventListener('click', function() { history.back(); });

const miniP = document.getElementById('miniPlayer');
if(miniP) miniP.addEventListener('click', function(e) {
  if (e.target.closest('#mpPlayBtn')) return;
  Router.navigate('fullPlayer', true);
});

const mpBtn = document.getElementById('mpPlayBtn');
if(mpBtn) mpBtn.addEventListener('click', function(e) { e.stopPropagation(); togglePlay(); });

const plBtn = document.getElementById('playBtn');
if(plBtn) plBtn.addEventListener('click', function() { togglePlay(); });

function togglePlay() { 
  if (audio.paused && audio.src) { audio.play(); setPlayState(true); } else { audio.pause(); setPlayState(false); } 
}

function setPlayState(isPlaying) {
  const pBtn = document.getElementById('playBtn');
  const mBtn = document.getElementById('mpPlayBtn');
  const dCov = document.getElementById('discCover');
  
  if(pBtn) pBtn.innerHTML = isPlaying ? svgPause : svgPlay;
  if(mBtn) mBtn.innerHTML = isPlaying ? svgPause : svgPlay;
  if(dCov) dCov.classList.toggle('playing', isPlaying);
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    updateMediaSessionPosition();
  }
}

const prBtn = document.getElementById('prevTrackBtn');
if(prBtn) prBtn.addEventListener('click', function() {
  if (currentContextList.length > 0 && currentTrackIndex > 0) {
    openTrack(currentContextList[currentTrackIndex - 1].pid);
  } else {
    audio.currentTime = 0;
    showToast('Playing from start');
  }
});

const nxBtn = document.getElementById('nextTrackBtn');
if(nxBtn) nxBtn.addEventListener('click', function() { playNextSong(); });

audio.addEventListener('play', function() { setPlayState(true); });
audio.addEventListener('pause', function() { setPlayState(false); });
audio.addEventListener('ended', function() { setPlayState(false); playNextSong(); });

const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');

function updateSeekFill() {
  if (!seek) return;
  const max = parseFloat(seek.max) || 100;
  const val = parseFloat(seek.value) || 0;
  const pct = max > 0 ? (val / max) * 100 : 0;
  seek.style.setProperty('--progress', pct + '%');
}

audio.addEventListener('loadedmetadata', function() { 
  if(durTime) durTime.textContent = fmtTime(audio.duration); 
  if(seek) seek.max = audio.duration || 100; 
  updateSeekFill();
  updateMediaSessionPosition();
});

audio.addEventListener('timeupdate', function() { 
  if (seek && !seek._dragging) { seek.value = audio.currentTime; updateSeekFill(); }
  if(curTime) curTime.textContent = fmtTime(audio.currentTime); 
});

if(seek) {
  seek.addEventListener('input', function() { 
    seek._dragging = true; 
    updateSeekFill();
    if(curTime) curTime.textContent = fmtTime(seek.value); 
  });
  seek.addEventListener('change', function() { 
    audio.currentTime = parseFloat(seek.value); 
    seek._dragging = false; 
    updateSeekFill();
    updateMediaSessionPosition(); 
  });
}

const vCtrl = document.getElementById('vol');
if(vCtrl) vCtrl.addEventListener('input', function(e) { audio.volume = e.target.value / 100; });

const sCtrl = document.getElementById('speed');
if(sCtrl) sCtrl.addEventListener('change', function(e) { 
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
  archive = archive.filter(function(s) { return s.pid !== song.pid; });
  archive.unshift(song);
  if(archive.length > 50) archive.pop();
  localStorage.setItem('og_archive', JSON.stringify(archive));
}

function renderArchive() {
  const archive = JSON.parse(localStorage.getItem('og_archive') || '[]');
  const list = document.getElementById('archiveList');
  if(!list) return;
  if(!archive.length) { list.innerHTML = `<div class="state-empty">No playback history.</div>`; return; }
  list.innerHTML = archive.map(function(r) { return `<div class="result-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_archive')||'[]'); openTrack('${r.pid}')"><img class="result-img" src="${r.image}" alt="Cover"><div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div><div style="color:var(--text-muted);">${svgPlay}</div></div>`; }).join('');
}

function toggleStorage(key, btnElem, activeIcon, inactiveIcon, addMsg, removeMsg) {
  if(!currentSongData || !btnElem) return;
  let items = JSON.parse(localStorage.getItem(key) || '[]');
  if(items.find(function(s) { return s.pid === currentSongData.pid; })) {
    items = items.filter(function(s) { return s.pid !== currentSongData.pid; });
    btnElem.innerHTML = inactiveIcon; btnElem.classList.remove('active');
    showToast(removeMsg);
  } else {
    items.unshift(currentSongData);
    btnElem.innerHTML = activeIcon; btnElem.classList.add('active');
    showToast(addMsg);
  }
  localStorage.setItem(key, JSON.stringify(items));
}

const fBtn = document.getElementById('favBtn');
if(fBtn) fBtn.addEventListener('click', function() { toggleStorage('og_favorites', fBtn, svgFavActive, svgFavInactive, 'Added to Favorites', 'Removed from Favorites'); renderFavorites(); });

const lBtn = document.getElementById('libBtn');
if(lBtn) lBtn.addEventListener('click', function() { toggleStorage('og_library', lBtn, svgLibActive, svgLibInactive, 'Added to Library', 'Removed from Library'); renderLibrary(); });

function checkActionStates(pid) {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  const fb = document.getElementById('favBtn'); 
  const lb = document.getElementById('libBtn');
  if(fb) { if(favs.find(function(s) { return s.pid === pid; })) { fb.innerHTML = svgFavActive; fb.classList.add('active'); } else { fb.innerHTML = svgFavInactive; fb.classList.remove('active'); } }
  if(lb) { if(libs.find(function(s) { return s.pid === pid; })) { lb.innerHTML = svgLibActive; lb.classList.add('active'); } else { lb.innerHTML = svgLibInactive; lb.classList.remove('active'); } }
}

function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const grid = document.getElementById('favoritesGrid');
  if(!grid) return;
  if(!favs.length) { grid.innerHTML = `<div class="state-empty">No favorites yet.</div>`; return; }
  grid.innerHTML = favs.map(function(i) { return `<div class="grid-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_favorites')||'[]'); openTrack('${i.pid}')"><img src="${i.image}" alt="Art"><div class="grid-title">${i.title}</div></div>`; }).join('');
}

window.switchLibTab = function(tab) {
  document.querySelectorAll('.lib-tab').forEach(function(t) { t.classList.remove('active'); });
  const tSongs = document.getElementById('tabSongs');
  const tCols = document.getElementById('tabCollections');
  const pGrid = document.getElementById('playlistGrid');
  const sGrid = document.getElementById('savedCollectionsGrid');
  
  if(tab === 'songs') {
    if(tSongs) tSongs.classList.add('active');
    if(pGrid) pGrid.style.display = 'flex';
    if(sGrid) sGrid.style.display = 'none';
  } else {
    if(tCols) tCols.classList.add('active');
    if(pGrid) pGrid.style.display = 'none';
    if(sGrid) sGrid.style.display = 'flex';
  }
}

function renderLibrary() {
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  const list = document.getElementById('playlistGrid');
  if(!list) return;
  if(!libs.length) { list.innerHTML = `<div class="state-empty">No saved songs.</div>`; return; }
  list.innerHTML = libs.map(function(r) { return `<div class="result-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_library')||'[]'); openTrack('${r.pid}')"><img class="result-img" src="${r.image}" alt="Cover"><div class="result-info"><div class="result-title">${r.title}</div><div class="result-meta">${r.artist}</div></div><div style="color:var(--text-muted);">${svgPlay}</div></div>`; }).join('');
}

window.toggleCollectionSave = function() {
  if(!currentCollectionInfo) return;
  let cols = JSON.parse(localStorage.getItem('og_collections') || '[]');
  const btn = document.getElementById('saveCollectionBtn');
  
  if(cols.find(function(c) { return c.id === currentCollectionInfo.id; })) {
    cols = cols.filter(function(c) { return c.id !== currentCollectionInfo.id; });
    if(btn) { btn.textContent = '+ Save Collection'; btn.classList.remove('saved'); }
    showToast('Collection Removed');
  } else {
    cols.unshift(currentCollectionInfo);
    if(btn) { btn.textContent = '✓ Saved'; btn.classList.add('saved'); }
    showToast('Collection Saved');
  }
  localStorage.setItem('og_collections', JSON.stringify(cols));
  renderSavedCollections();
}

function checkCollectionState() {
  if(!currentCollectionInfo) return;
  const cols = JSON.parse(localStorage.getItem('og_collections') || '[]');
  const btn = document.getElementById('saveCollectionBtn');
  if(!btn) return;
  if(cols.find(function(c) { return c.id === currentCollectionInfo.id; })) {
    btn.textContent = '✓ Saved'; btn.classList.add('saved');
  } else {
    btn.textContent = '+ Save Collection'; btn.classList.remove('saved');
  }
}

function renderSavedCollections() {
  const cols = JSON.parse(localStorage.getItem('og_collections') || '[]');
  const grid = document.getElementById('savedCollectionsGrid');
  if(!grid) return;
  if(!cols.length) { grid.innerHTML = `<div class="state-empty">No saved collections.</div>`; return; }
  
  grid.innerHTML = cols.map(function(c) { return `
    <div class="result-card" onclick="handleCardClick('${c.id}', '${c.type}', '${c.title.replace(/'/g, "\\'")}', '${c.img}')">
      <img class="result-img" src="${c.img}" alt="Cover">
      <div class="result-info"><div class="result-title">${c.title}</div><div class="result-meta">${c.type.toUpperCase()}</div></div>
      <div style="color:var(--text-muted);">${svgPlay}</div>
    </div>
  `; }).join('');
}

const oDlMod = document.getElementById('openDlModal');
if(oDlMod) oDlMod.addEventListener('click', function() {
  const el = document.getElementById('dlModal');
  if(el) el.style.display = 'flex';
});

const cDlMod = document.getElementById('closeDlModal');
if(cDlMod) cDlMod.addEventListener('click', function() {
  const el = document.getElementById('dlModal');
  if(el) el.style.display = 'none';
});