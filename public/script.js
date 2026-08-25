const searchForm = document.getElementById('searchForm');
const qInput = document.getElementById('q');
const searchBtn = document.getElementById('searchBtn');
const resultsBlock = document.getElementById('resultsBlock');
const resultsList = document.getElementById('resultsList');

const searchView = document.getElementById('searchView');
const playerView = document.getElementById('playerView');
const backBtn = document.getElementById('backBtn');

// Audio Controls
const audio = document.getElementById('audio');
const playBtn = document.getElementById('playBtn');
const discCover = document.getElementById('discCover');
const seek = document.getElementById('seek');
const curTime = document.getElementById('curTime');
const durTime = document.getElementById('durTime');
const vol = document.getElementById('vol');
const speed = document.getElementById('speed');

// Player Elements
const playerCover = document.getElementById('playerCover');
const pTitle = document.getElementById('pTitle');
const pArtist = document.getElementById('pArtist');
const pAlbum = document.getElementById('pAlbum');

// Download Anchors
const btn320 = document.getElementById('btn320');
const btn160 = document.getElementById('btn160');
const btn96 = document.getElementById('btn96');

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
  return String(s).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

// 1. SEARCH LOGIC
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = qInput.value.trim();
  if (!query) return;

  searchBtn.disabled = true;
  searchBtn.textContent = '探しています...';
  resultsList.innerHTML = '';

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Search failed');

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      resultsList.innerHTML = `<div style="padding:24px;text-align:center;font-family:'Space Mono';border:2px dashed var(--border-dark);">No tracks found for "${escapeHtml(query)}"</div>`;
      resultsBlock.style.display = 'block';
      return;
    }

    resultsList.innerHTML = results.map(r => `
      <div class="result-card" onclick="openTrack('${r.pid}')">
        <img class="result-img" src="${escapeHtml(r.image || '')}" alt="Cover" loading="lazy">
        <div class="result-info">
          <div class="result-title">${escapeHtml(r.title)}</div>
          <div class="result-meta">${escapeHtml(r.artist)} · ${escapeHtml(r.album)}</div>
        </div>
        <button class="btn-play-badge">再生 PLAY</button>
      </div>
    `).join('');

    resultsBlock.style.display = 'block';
  } catch (err) {
    toast(`Error: ${err.message}`);
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = '探索 SEARCH';
  }
});

// 2. OPEN TRACK IN CYBER DOJO PLAYER
async function openTrack(songPid) {
  toast('Decrypting & Loading HQ Stream...');

  try {
    const res = await fetch(`/api/details?pid=${encodeURIComponent(songPid)}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to decrypt');

    // UI Meta Info
    pTitle.textContent = data.title;
    pArtist.textContent = data.artist;
    pAlbum.textContent = data.album;
    playerCover.src = data.image || '';

    // Audio Engine Setup
    audio.src = data.links['320'] || data.links['160'];
    audio.currentTime = 0;
    audio.volume = vol.value / 100;
    audio.playbackRate = parseFloat(speed.value);

    // Working Native Backend Download Proxy URLs
    const safeTitle = data.title.replace(/[^\w\s.-]/g, '').trim() || 'song';
    btn320.href = `/api/download?url=${encodeURIComponent(data.links['320'])}&filename=${encodeURIComponent(safeTitle)}&quality=320kbps`;
    btn160.href = `/api/download?url=${encodeURIComponent(data.links['160'])}&filename=${encodeURIComponent(safeTitle)}&quality=160kbps`;
    btn96.href = `/api/download?url=${encodeURIComponent(data.links['96'])}&filename=${encodeURIComponent(safeTitle)}&quality=96kbps`;

    searchView.style.display = 'none';
    playerView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    audio.play().then(() => {
      setPlayState(true);
    }).catch(() => {
      setPlayState(false);
      toast('Tap play to start stream');
    });
  } catch (err) {
    alert('Track Error: ' + err.message);
  }
}

function setPlayState(isPlaying) {
  playBtn.textContent = isPlaying ? '❚❚' : '▶';
  discCover.classList.toggle('playing', isPlaying);
}

// 3. PLAYER CONTROLS
playBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play();
    setPlayState(true);
  } else {
    audio.pause();
    setPlayState(false);
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
  if (!seek._dragging) seek.value = audio.currentTime;
  curTime.textContent = fmtTime(audio.currentTime);
});

audio.addEventListener('play', () => setPlayState(true));
audio.addEventListener('pause', () => setPlayState(false));
audio.addEventListener('ended', () => setPlayState(false));

seek.addEventListener('input', () => {
  seek._dragging = true;
  curTime.textContent = fmtTime(seek.value);
});

seek.addEventListener('change', () => {
  audio.currentTime = parseFloat(seek.value);
  seek._dragging = false;
});

vol.addEventListener('input', () => {
  audio.volume = vol.value / 100;
});

speed.addEventListener('change', () => {
  audio.playbackRate = parseFloat(speed.value);
});

backBtn.addEventListener('click', () => {
  audio.pause();
  audio.src = '';
  setPlayState(false);
  playerView.style.display = 'none';
  searchView.style.display = 'block';
});