let currentSongData = null;
let searchTimer = null;
let currentContextList = []; 
let currentTrackIndex = -1;

let currentArtistToken = '';
let currentArtistPage = 0;
let isSearchContext = false;
let currentCollectionInfo = null; 
let hasExtendedQueue = false;

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
    } else if (e.state && e.state.view) {
      this.switchUI(e.state.view);
    } else if (e.state && e.state.step === 'trap') {
      Router.navigate('homeView');
    }
  }
};

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
  t._h = setTimeout(() => t.classList.remove('show'), 2000);
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
    if(targetId === 'playlistView') renderLibrary();
  });
});

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
  hasExtendedQueue = false;
  if (type === 'song') {
    isSearchContext = false;
    openTrack(id);
  } else if (type === 'artist') {
    isSearchContext = false;
    currentArtistToken = id;
    currentArtistPage = 0;
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
  Router.navigate('collectionView');
}

function renderCollectionList(songs, isArtist) {
  let html = songs.map((r, index) => {
    const isPlaying = currentSongData && r.pid === currentSongData.pid;
    return `
    <div class="result-card" onclick="openTrack('${r.pid}')" style="${isPlaying ? 'border-color:var(--crimson); background:#fdf2f1;' : ''}">
      <div style="font-family:'Space Mono'; font-weight:900; font-size: 16px; color:var(--text-muted); width: 30px; text-align: center;">${index + 1}</div>
      <div class="result-info" style="padding-left: 10px;">
        <div class="result-title" style="${isPlaying ? 'color:var(--crimson);' : ''}">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      <button class="btn-play-badge">PLAY</button>
    </div>
  `}).join('');

  if(isArtist) {
    html += `
    <div style="display:flex; justify-content:space-between; padding: 20px 0; gap:10px;">
      <button class="btn-page" onclick="changeArtistPage(-1)" id="prevPageBtn" ${currentArtistPage === 0 ? 'disabled' : ''}>← PREV</button>
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
      document.getElementById('collectionList').innerHTML = `<div style="text-align:center; padding: 20px;">No more tracks.</div><button class="btn-page" onclick="changeArtistPage(-1)">← GO BACK</button>`;
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

let globalSearchResults = []; 
async function executeLiveSearch(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`);
    const data = await res.json();
    searchSpinner.style.display = 'none';

    globalSearchResults = data.results || [];
    if(!globalSearchResults.length) {
      document.getElementById('topMatchContainer').style.display = 'none';
      document.getElementById('resultsList').innerHTML = `<div style="padding:20px;text-align:center;">No results found.</div>`;
      return;
    }

    const top = globalSearchResults[0];
    document.getElementById('topMatchContainer').style.display = 'block';
    
    // Original Top Match Card design
    document.getElementById('topMatchCard').innerHTML = `
      <div class="top-match-card" onclick="playFromSearch('${top.pid}')">
        <img src="${top.image}">
        <div class="info">
          <div class="title">${top.title}</div>
          <div class="meta">${top.artist}</div>
        </div>
        <div class="top-match-badge">PLAY</div>
      </div>
    `;

    document.getElementById('otherResultsTitle').style.display = 'block';
    
    // Original Results List design
    document.getElementById('resultsList').innerHTML = globalSearchResults.slice(1).map((r, i) => `
      <div class="result-card" onclick="playFromSearch('${r.pid}')">
        <img class="result-img" src="${r.image}" alt="Cover">
        <div class="result-info">
          <div class="result-title">${r.title}</div>
          <div class="result-meta">${r.artist}</div>
        </div>
        <button class="btn-play-badge">PLAY</button>
      </div>
    `).join('');
  } catch (err) { searchSpinner.style.display = 'none'; }
}

window.playFromSearch = async function(pid) {
  const song = globalSearchResults.find(s => s.pid === pid);
  if(!song) return;
  
  isSearchContext = true;
  hasExtendedQueue = false;
  currentContextList = [song]; // Clear old queue and set new clicked song
  currentTrackIndex = 0;
  openTrack(pid);
};

const audio = document.getElementById('audio');

function setupMediaSession(data) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: data.title,
      artist: data.artist,
      album: data.album || 'Single',
      artwork: [{ src: data.image, sizes: '500x500', type: 'image/jpeg' }]
    });
    navigator.mediaSession.setActionHandler('play', togglePlay);
    navigator.mediaSession.setActionHandler('pause', togglePlay);
    navigator.mediaSession.setActionHandler('previoustrack', playPrevSong);
    navigator.mediaSession.setActionHandler('nexttrack', playNextSong);
  }
}

async function openTrack(pid) {
  showToast('Connecting to stream...');
  
  // Set UI immediately to prevent "paused" look before load
  setPlayState(false); 
  
  try {
    const res = await fetch(`/api/details?pid=${encodeURIComponent(pid)}`);
    if(!res.ok) throw new Error('Network Issue');
    const data = await res.json();
    
    // Auto-skip loops removed. If track fails, it stops and alerts.
    if(!data.success) {
       showToast('Track unavailable right now.');
       return;
    }

    currentSongData = data;
    
    // Smart Queue Logic: only fetch if from Search
    if (isSearchContext) {
      fetch(`/api/recommend?lang=${data.language || 'hindi'}`)
        .then(r => r.json())
        .then(radioSongs => {
          if (radioSongs && radioSongs.length > 0) {
            currentContextList = [data, ...radioSongs.filter(s => s.pid !== data.pid)];
            currentTrackIndex = 0;
            renderPlayerQueue();
          }
        }).catch(() => { });
      isSearchContext = false; 
    } else {
      currentTrackIndex = currentContextList.findIndex(t => t.pid === pid);
      renderPlayerQueue();
    }

    // Refresh collection list if active
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

    Router.navigate('fullPlayer', true);

    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    document.getElementById('btn320').href = `/api/download?url=${encodeURIComponent(data.links['320'])}&filename=${safeTitle}&quality=320kbps`;
    document.getElementById('btn160').href = `/api/download?url=${encodeURIComponent(data.links['160'])}&filename=${safeTitle}&quality=160kbps`;
    document.getElementById('btn96').href = `/api/download?url=${encodeURIComponent(data.links['96'])}&filename=${safeTitle}&quality=96kbps`;

    audio.src = data.links['320'] || data.links['160'];
    audio.currentTime = 0;
    audio.volume = document.getElementById('vol').value / 100;
    audio.playbackRate = parseFloat(document.getElementById('speed').value);
    
    setupMediaSession(data);
    
    // Start Audio
    audio.play().catch(e => {
        console.error(e);
        setPlayState(false);
        showToast('Tap play to start audio');
    });

    saveToArchive(data);
    checkActionStates(data.pid);
  } catch (err) { 
    showToast('Network Error. Please try again.'); 
    setPlayState(false);
  }
}

// 🚨 SMART EXTEND QUEUE: Reverse Loop Logic (1-time extension) 🚨
window.extendQueue = async function() {
  if(hasExtendedQueue) {
    showToast('Queue already extended.');
    return;
  }
  const btn = document.getElementById('extQueueBtn');
  if(btn) { btn.disabled = true; btn.textContent = 'SCANNING...'; }
  
  let success = false;
  
  // Loops backwards from the last track to find valid recommendations
  for (let i = currentContextList.length - 1; i >= 0; i--) {
     const track = currentContextList[i];
     try {
       const res = await fetch(`/api/recommend?lang=${track.language || 'hindi'}`);
       if(!res.ok) continue;
       const newSongs = await res.json();
       const existingPids = new Set(currentContextList.map(s => s.pid));
       const unique = newSongs.filter(s => !existingPids.has(s.pid));
       
       if(unique.length > 0) {
         currentContextList.push(...unique);
         renderPlayerQueue();
         success = true;
         hasExtendedQueue = true; // Prevents endless loading
         break;
       }
     } catch(e) { continue; }
  }
  
  if(!success) { 
      if(btn) { btn.textContent = 'NO MATCHES'; btn.disabled = true; }
      showToast('No more related tracks found.');
  }
};

function renderPlayerQueue() {
  const queueEl = document.getElementById('playerQueueSection');
  if(!queueEl) {
      // If player queue section doesn't exist, inject it dynamically at bottom of full-player content
      const content = document.querySelector('.fp-content');
      if(content) {
          const qSec = document.createElement('div');
          qSec.id = 'playerQueueSection';
          qSec.style.width = '100%';
          qSec.style.maxWidth = '400px';
          qSec.style.marginTop = '20px';
          content.appendChild(qSec);
      }
  }

  const container = document.getElementById('playerQueueSection');
  if(!container) return;

  if(currentContextList.length <= 1 && !isSearchContext) { 
      container.innerHTML = ''; 
      return; 
  }

  let html = `<div style="font-family:'Space Mono'; font-weight:900; font-size:14px; color:var(--crimson); margin-bottom:12px; letter-spacing:1px; border-bottom:1px dashed var(--grid-line); padding-bottom:4px;">UP NEXT</div>`;
  
  html += currentContextList.map((r, index) => {
    const isPlaying = index === currentTrackIndex;
    return `
    <div class="result-card" onclick="openTrack('${r.pid}')" style="${isPlaying ? 'border-color:var(--crimson); background:#fdf2f1;' : 'background:transparent;'}">
      <img src="${r.image}" class="result-img" style="width:40px; height:40px;">
      <div class="result-info">
        <div class="result-title" style="${isPlaying ? 'color:var(--crimson);' : ''}">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
    </div>
  `}).join('');

  if(!hasExtendedQueue) {
    html += `<div style="text-align:center; padding: 16px;"><button class="btn-page" onclick="extendQueue()" id="extQueueBtn">LOAD MORE RELATED ↓</button></div>`;
  }
  
  container.innerHTML = html;
}

document.getElementById('closePlayerBtn').addEventListener('click', () => { document.getElementById('fullPlayer').classList.remove('open'); });

document.getElementById('miniPlayer').addEventListener('click', function(e) {
  if (e.target.closest('#mpPlayBtn')) return;
  Router.navigate('fullPlayer', true);
});

document.getElementById('mpPlayBtn').addEventListener('click', function(e) { e.stopPropagation(); togglePlay(); });
document.getElementById('playBtn').addEventListener('click', () => togglePlay());

function togglePlay() { 
  if (audio.paused && audio.src) { 
      audio.play().catch(()=>{}); 
  } else { 
      audio.pause(); 
  } 
}

// Proper UI State Sync matching Audio Element State
function setPlayState(isPlaying) {
  document.getElementById('playBtn').textContent = isPlaying ? '❚❚' : '▶';
  document.getElementById('mpPlayBtn').textContent = isPlaying ? '❚❚' : '▶';
  document.getElementById('discCover').classList.toggle('playing', isPlaying);
}

// Bind state purely to audio events
audio.addEventListener('play', () => setPlayState(true));
audio.addEventListener('pause', () => setPlayState(false));
audio.addEventListener('ended', () => { setPlayState(false); playNextSong(); });
audio.addEventListener('error', () => { 
    setPlayState(false); 
    showToast('Audio playback error.'); 
});

function playPrevSong() {
  if (currentContextList.length > 0 && currentTrackIndex > 0) {
    openTrack(currentContextList[currentTrackIndex - 1].pid);
  } else {
    audio.currentTime = 0;
  }
}

function playNextSong() {
  if (currentContextList.length > 0 && currentTrackIndex >= 0 && currentTrackIndex < currentContextList.length - 1) {
    openTrack(currentContextList[currentTrackIndex + 1].pid);
  } else {
    showToast('Vault Finished');
    setPlayState(false);
  }
}

document.getElementById('prevTrackBtn').addEventListener('click', playPrevSong);
document.getElementById('nextTrackBtn').addEventListener('click', playNextSong);

const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');
audio.addEventListener('loadedmetadata', () => { durTime.textContent = fmtTime(audio.duration); seek.max = audio.duration || 100; });
audio.addEventListener('timeupdate', () => { if (!seek._dragging) seek.value = audio.currentTime; curTime.textContent = fmtTime(audio.currentTime); });
seek.addEventListener('input', () => { seek._dragging = true; curTime.textContent = fmtTime(seek.value); });
seek.addEventListener('change', () => { audio.currentTime = parseFloat(seek.value); seek._dragging = false; });
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
    <div class="result-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_archive')||'[]'); openTrack('${r.pid}')">
      <img class="result-img" src="${r.image}" alt="Cover">
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      <button class="btn-play-badge">PLAY</button>
    </div>
  `).join('');
}

function toggleStorage(key, btnElem, activeClass, inactiveClass, addMsg, removeMsg) {
  if(!currentSongData) return;
  let items = JSON.parse(localStorage.getItem(key) || '[]');
  if(items.find(s => s.pid === currentSongData.pid)) {
    items = items.filter(s => s.pid !== currentSongData.pid);
    btnElem.classList.remove('active');
    showToast(removeMsg);
  } else {
    items.unshift(currentSongData);
    btnElem.classList.add('active');
    showToast(addMsg);
  }
  localStorage.setItem(key, JSON.stringify(items));
}

document.getElementById('favBtn').addEventListener('click', () => { toggleStorage('og_favorites', document.getElementById('favBtn'), 'active', '', 'Saved to Favorites', 'Removed from Favorites'); renderFavorites(); });
document.getElementById('libBtn').addEventListener('click', () => { toggleStorage('og_library', document.getElementById('libBtn'), 'active', '', 'Added to Library', 'Removed from Library'); renderLibrary(); });

function checkActionStates(pid) {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  const fb = document.getElementById('favBtn'); const lb = document.getElementById('libBtn');
  if(favs.find(s => s.pid === pid)) { fb.classList.add('active'); } else { fb.classList.remove('active'); }
  if(libs.find(s => s.pid === pid)) { lb.classList.add('active'); } else { lb.classList.remove('active'); }
}

function renderFavorites() {
  const favs = JSON.parse(localStorage.getItem('og_favorites') || '[]');
  const grid = document.getElementById('favoritesGrid');
  if(!favs.length) { grid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:10px;">No favorites yet.</div>`; return; }
  grid.innerHTML = favs.map(i => `<div class="grid-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_favorites')||'[]'); openTrack('${i.pid}')"><img src="${i.image}" alt="Art"><div class="grid-title">${i.title}</div></div>`).join('');
}

function renderLibrary() {
  const libs = JSON.parse(localStorage.getItem('og_library') || '[]');
  const list = document.getElementById('playlistGrid');
  if(!libs.length) { list.innerHTML = `<div style="padding:24px;text-align:center;border:2px dashed var(--border-dark);">No saved songs.</div>`; return; }
  
  list.innerHTML = libs.map(r => `
    <div class="result-card" onclick="isSearchContext=false; currentContextList=JSON.parse(localStorage.getItem('og_library')||'[]'); openTrack('${r.pid}')">
      <img class="result-img" src="${r.image}" alt="Cover">
      <div class="result-info">
        <div class="result-title">${r.title}</div>
        <div class="result-meta">${r.artist}</div>
      </div>
      <button class="btn-play-badge">PLAY</button>
    </div>
  `).join('');
}

document.getElementById('openDlModal').addEventListener('click', () => document.getElementById('dlModal').style.display = 'flex');
document.getElementById('closeDlModal').addEventListener('click', () => document.getElementById('dlModal').style.display = 'none');
