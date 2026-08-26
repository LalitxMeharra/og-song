const searchForm = document.getElementById('searchForm');
const qInput = document.getElementById('q');
const searchBtn = document.getElementById('searchBtn');
const resultsArea = document.getElementById('resultsArea');

const searchView = document.getElementById('searchView');
const playerView = document.getElementById('playerView');
const backBtn = document.getElementById('backBtn');

// Custom Audio Controls
const audio = document.getElementById('audio');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');
const vol = document.getElementById('vol');
const muteBtn = document.getElementById('muteBtn');
const volIcon = document.getElementById('volIcon');
const speed = document.getElementById('speed');

// Player Card Display
const coverImg = document.getElementById('coverImg');
const coverEq = document.getElementById('coverEq');
const pTitle = document.getElementById('pTitle');
const pArtist = document.getElementById('pArtist');
const pAlbum = document.getElementById('pAlbum');

// Download Anchors
const btn320 = document.getElementById('btn320');
const btn160 = document.getElementById('btn160');
const btn96 = document.getElementById('btn96');

// ============================================================
// API ENDPOINT - SIRF YAHI CHANGE HUA HAI
// ============================================================
const API_BASE = '/api/songbackend.php';

function toast(msg) {
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

function escapeHtml(s = '') {
  return String(s).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

// ============================================================
// SEARCH - UPDATED URL
// ============================================================
async function performSearch(e) {
  if (e) e.preventDefault();
  const query = qInput.value.trim();
  if (!query) return;

  searchBtn.disabled = true;
  searchBtn.innerHTML = `Searching...`;
  resultsArea.innerHTML = '';

  try {
    // 🔥 UPDATED: PHP backend endpoint
    const response = await fetch(`${API_BASE}?action=search&q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Search failed');

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      resultsArea.innerHTML = `<div class="empty">No songs found for "${escapeHtml(query)}"</div>`;
      return;
    }

    let html = `
      <div class="status-line">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <b>${results.length}</b> result(s) found for “${escapeHtml(data.query)}”.
      </div>
      <div class="results">`;

    results.forEach((r, i) => {
      html += `
        <div class="result-card" style="animation-delay:${i * 0.04}s" onclick="openSong('${r.pid}')">
          <img class="art" src="${escapeHtml(r.image || 'https://c.saavncdn.com/default.jpg')}" alt="Cover" loading="lazy">
          <div class="r-info">
            <div class="r-title">${escapeHtml(r.title)}</div>
            <div class="r-sub">${escapeHtml(r.artist)} · ${escapeHtml(r.album)}</div>
          </div>
          <button class="btn-play">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Play
          </button>
        </div>`;
    });

    html += `</div>`;
    resultsArea.innerHTML = html;
  } catch (err) {
    resultsArea.innerHTML = `<div class="empty">Error: ${escapeHtml(err.message)}</div>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2.4"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      Search`;
  }
}

// ============================================================
// OPEN SONG - UPDATED URL
// ============================================================
async function openSong(songPid) {
  toast('Decrypting & Loading HQ Audio...');

  try {
    // 🔥 UPDATED: PHP backend endpoint
    const res = await fetch(`${API_BASE}?action=details&pid=${encodeURIComponent(songPid)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to get stream');
    }

    // Set Track Info
    pTitle.textContent = data.title;
    pArtist.textContent = data.artist;
    pAlbum.textContent = data.album;
    coverImg.src = data.image || '';

    // Set Audio Source
    audio.src = data.links['320'] || data.links['160'];
    audio.currentTime = 0;
    audio.volume = vol.value / 100;
    audio.playbackRate = parseFloat(speed.value);
    
    seek.value = 0;
    updateSeekFill(0);
    curTime.textContent = '0:00';
    durTime.textContent = '0:00';

    // 🔥 UPDATED: Download URLs with PHP endpoint
    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    btn320.href = `${API_BASE}?action=download&url=${encodeURIComponent(data.links['320'])}&filename=${encodeURIComponent(safeTitle)}&quality=320kbps`;
    btn160.href = `${API_BASE}?action=download&url=${encodeURIComponent(data.links['160'])}&filename=${encodeURIComponent(safeTitle)}&quality=160kbps`;
    btn96.href = `${API_BASE}?action=download&url=${encodeURIComponent(data.links['96'])}&filename=${encodeURIComponent(safeTitle)}&quality=96kbps`;

    // Switch View
    searchView.style.display = 'none';
    playerView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    audio.play().then(() => {
      setPlayingUI(true);
    }).catch(() => {
      setPlayingUI(false);
      toast('Tap play to start stream');
    });
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ============================================================
// PLAYER CONTROLS - SAME
// ============================================================
function setPlayingUI(isPlaying) {
  playIcon.innerHTML = isPlaying
    ? `<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>`
    : `<path d="M8 5v14l11-7z"/>`;
  coverEq.classList.toggle('active', isPlaying);
  coverEq.classList.toggle('paused', !isPlaying);
}

playBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play();
    setPlayingUI(true);
  } else {
    audio.pause();
    setPlayingUI(false);
  }
});

document.getElementById('rewindBtn').addEventListener('click', () => {
  audio.currentTime = Math.max(0, audio.currentTime - 10);
});

document.getElementById('fwdBtn').addEventListener('click', () => {
  audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
});

audio.addEventListener('loadedmetadata', () => {
  durTime.textContent = fmtTime(audio.duration);
  seek.max = audio.duration || 100;
});

audio.addEventListener('timeupdate', () => {
  if (!seek._dragging) {
    seek.value = audio.currentTime;
    updateSeekFill((audio.currentTime / (audio.duration || 1)) * 100);
  }
  curTime.textContent = fmtTime(audio.currentTime);
});

audio.addEventListener('play', () => setPlayingUI(true));
audio.addEventListener('pause', () => setPlayingUI(false));
audio.addEventListener('ended', () => setPlayingUI(false));

seek.addEventListener('input', () => {
  seek._dragging = true;
  updateSeekFill((seek.value / (audio.duration || seek.max)) * 100);
  curTime.textContent = fmtTime(seek.value);
});

seek.addEventListener('change', () => {
  audio.currentTime = parseFloat(seek.value);
  seek._dragging = false;
});

function updateSeekFill(pct) {
  seek.style.background = `linear-gradient(90deg, var(--accent) ${pct}%, var(--line) ${pct}%)`;
}

vol.addEventListener('input', () => {
  audio.volume = vol.value / 100;
  audio.muted = false;
  updateVolIcon();
});

function updateVolIcon() {
  const v = audio.muted ? 0 : audio.volume;
  volIcon.innerHTML = v === 0
    ? `<path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M17 9l4 6M21 9l-4 6" stroke-linecap="round"/>`
    : `<path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16 8a5 5 0 010 8" stroke-linecap="round"/>`;
}

muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  updateVolIcon();
});

speed.addEventListener('change', () => {
  audio.playbackRate = parseFloat(speed.value);
});

backBtn.addEventListener('click', () => {
  audio.pause();
  audio.src = '';
  setPlayingUI(false);
  playerView.style.display = 'none';
  searchView.style.display = 'block';
});

searchForm.addEventListener('submit', performSearch);
