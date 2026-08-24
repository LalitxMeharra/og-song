import crypto from 'crypto';

const DES_KEY = Buffer.from('38346591', 'utf-8');

function cleanText(value = '') {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function decryptUrl(encryptedUrl) {
  try {
    let cleaned = encryptedUrl.trim();
    let missing = cleaned.length % 4;
    if (missing) cleaned += '='.repeat(4 - missing);

    let encryptedBytes = Buffer.from(cleaned, 'base64');
    const remainder = encryptedBytes.length % 8;
    if (remainder !== 0) {
      encryptedBytes = encryptedBytes.subarray(0, encryptedBytes.length - remainder);
    }

    const decipher = crypto.createDecipheriv('des-ecb', DES_KEY, null);
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([decipher.update(encryptedBytes), decipher.final()]);

    const pad = decrypted[decrypted.length - 1];
    if (pad >= 1 && pad <= 8) {
      decrypted = decrypted.subarray(0, decrypted.length - pad);
    }

    return decrypted.toString('utf-8').trim();
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pid, action } = req.query;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://www.jiosaavn.com/'
  };

  // 1. DETAILS & STREAM/DOWNLOAD LINKS
  if (pid || action === 'details') {
    const songPid = pid;
    if (!songPid) return res.status(400).json({ error: 'Song PID required' });

    try {
      const response = await fetch(`https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${encodeURIComponent(songPid)}`, { headers });
      const data = await response.json();
      const songData = data?.[songPid] || {};

      const encryptedUrl = songData.encrypted_media_url || songData.more_info?.encrypted_media_url;
      if (!encryptedUrl) {
        return res.status(404).json({ error: 'Encrypted media URL not found' });
      }

      const decryptedUrl = decryptUrl(encryptedUrl);
      if (!decryptedUrl) {
        return res.status(500).json({ error: 'Decryption failed' });
      }

      const basePrefix = decryptedUrl.substring(0, decryptedUrl.lastIndexOf('_'));
      const ext = decryptedUrl.includes('.mp3') ? 'mp3' : 'mp4';

      return res.status(200).json({
        success: true,
        id: songPid,
        title: cleanText(songData.song || songData.title),
        artist: cleanText(songData.primary_artists || songData.more_info?.primary_artists),
        album: cleanText(songData.album),
        image: (songData.image || '').replace('50x50', '500x500').replace('150x150', '500x500'),
        duration: songData.duration || '0',
        links: {
          '320': `${basePrefix}_320.${ext}`,
          '160': `${basePrefix}_160.${ext}`,
          '96': `${basePrefix}_96.${ext}`
        }
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // 2. SEARCH HANDLER
  if (!q) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const url = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=${encodeURIComponent(q)}`;
    const response = await fetch(url, { headers });
    const data = await response.json();

    const songs = (data?.songs?.data || []).map((item) => {
      const info = item?.more_info || {};
      return {
        id: String(item.id || ''),
        pid: String(item.id || ''), // Direct song id is the PID
        title: cleanText(item.title),
        artist: cleanText(info.primary_artists || item.description || 'Unknown'),
        album: cleanText(item.album || 'Single'),
        image: String(item.image || '').replace('50x50', '500x500')
      };
    });

    return res.status(200).json({
      query: q,
      results: songs
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
