const JIOSAAVN_AUTOCOMPLETE = 'https://www.jiosaavn.com/api.php';

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseSongPids(value) {
  return String(value || '')
    .split(',')
    .map((pid) => pid.trim())
    .filter(Boolean);
}

function normalizeItem(item, fallbackType) {
  const info = item?.more_info || {};
  const songPids = parseSongPids(info.song_pids || (fallbackType === 'song' ? item?.id : ''));

  return {
    id: String(item?.id || ''),
    type: item?.type || fallbackType,
    title: cleanText(item?.title),
    album: cleanText(item?.album || ''),
    artist: cleanText(info.primary_artists || item?.music || item?.description || ''),
    image: String(item?.image || ''),
    url: String(item?.url || ''),
    language: cleanText(info.language || ''),
    songPids
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = String(req.query?.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Missing search query. Use ?q=song+name' });
  }

  try {
    const url = new URL(JIOSAAVN_AUTOCOMPLETE);
    url.searchParams.set('__call', 'autocomplete.get');
    url.searchParams.set('_format', 'json');
    url.searchParams.set('_marker', '0');
    url.searchParams.set('cc', 'in');
    url.searchParams.set('includemetatags', '1');
    url.searchParams.set('query', query);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json,text/plain,*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }

    const data = await response.json();
    const songs = toArray(data?.songs?.data).map((item) => normalizeItem(item, 'song'));
    const albums = toArray(data?.albums?.data).map((item) => normalizeItem(item, 'album'));

    return res.status(200).json({
      query,
      results: [...songs, ...albums],
      source: 'autocomplete'
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(502).json({
      error: 'Search service temporarily unavailable',
      detail: error.message
    });
  }
}
