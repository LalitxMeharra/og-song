const form = document.getElementById('searchForm');
const queryInput = document.getElementById('query');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function renderResult(item) {
  const title = escapeHtml(item.title || 'Untitled');
  const artist = escapeHtml(item.artist || item.album || 'Unknown');
  const type = escapeHtml(item.type || 'result');
  const image = item.image ? escapeHtml(item.image) : '';
  const songPids = Array.isArray(item.songPids) ? item.songPids : [];
  const pidText = songPids.length ? `song_pids: ${escapeHtml(songPids.join(', '))}` : 'song_pids: not provided';
  const officialUrl = item.url ? escapeHtml(item.url) : '';

  return `
    <article class="card">
      ${image ? `<img class="cover" src="${image}" alt="" loading="lazy">` : `<div class="cover"></div>`}
      <div class="info">
        <p class="type">${type}</p>
        <h2 class="title">${title}</h2>
        <p class="meta">${artist}</p>
        <div class="pid">${pidText}</div>
      </div>
      ${officialUrl ? `<a class="link" href="${officialUrl}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}
    </article>`;
}

async function searchSongs(query) {
  statusEl.textContent = 'Searching...';
  resultsEl.innerHTML = '';

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Search failed');

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      statusEl.textContent = 'No results found.';
      resultsEl.innerHTML = '<div class="empty">Try another spelling or a different song name.</div>';
      return;
    }

    statusEl.textContent = `${results.length} result(s) found for “${data.query}”.`;
    resultsEl.innerHTML = results.map(renderResult).join('');
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Error: ${error.message}`;
    resultsEl.innerHTML = '<div class="empty">The search request could not be completed. Please try again.</div>';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (query) searchSongs(query);
});
