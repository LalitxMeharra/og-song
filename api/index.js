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
    if (!encryptedUrl) return null;

    let cleaned = String(encryptedUrl).trim().replace(/\s+/g, '');
    let missing = cleaned.length % 4;
    if (missing) cleaned += '='.repeat(4 - missing);

    let encryptedBytes = Buffer.from(cleaned, 'base64');
    
    // 8-byte block alignment for DES ECB
    const remainder = encryptedBytes.length % 8;
    if (remainder !== 0) {
      encryptedBytes = encryptedBytes.subarray(0, encryptedBytes.length - remainder);
    }

    const decipher = crypto.createDecipheriv('des-ecb', DES_KEY, null);
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([decipher.update(encryptedBytes), decipher.final()]);

    // PKCS7 Unpadding
    const pad = decrypted[decrypted.length - 1];
    if (pad >= 1 && pad <= 8) {
      decrypted = decrypted.subarray(0, decrypted.length - pad);
    }

    const finalUrl = decrypted.toString('utf-8').trim();
    return finalUrl.startsWith('http') ? finalUrl : null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q, pid, song_pids, songId, action } = req.query;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://www.jiosaavn.com/'
  };

  // 1. DETAILS & DOWNLOAD LINKS
  if (pid || song_pids || songId || action === 'details') {
    // Extract first clean PID even if passed as comma separated or with different param names
    let targetPid = String(pid || song_pids || songId || '').trim();
    if (targetPid.includes(',')) {
      targetPid = targetPid.split(',')[0].trim();
    }

    if (!targetPid) return res.status(400).json({ error: 'Valid Song PID required' });

    try {
      const response = await fetch(`https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${encodeURIComponent(targetPid)}`, { headers });
      const rawText = await response.text();
      
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        // Fallback cleanup if response contains unwanted prefixes
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          data = JSON.parse(rawText.substring(jsonStart, jsonEnd + 1));
        } else {
          throw new Error('Invalid JSON from JioSaavn');
        }
      }

      // Check key as targetPid or first item in data object
      let songData = data?.[targetPid];
      if (!songData) {
        const keys = Object.keys(data || {});
        if (keys.length > 0 && typeof data[keys[0]] === 'object') {
          songData = data[keys[0]];
        }
      }

      if (!songData) {
        return res.status(404).json({ error: 'Song details not found for PID: ' + targetPid });
      }

      const encryptedUrl = songData.encrypted_media_url || songData.more_info?.encrypted_media_url;
      if (!encryptedUrl) {
        return res.status(404).json({ error: 'Encrypted media URL not found' });
      }

      const decryptedUrl = decryptUrl(encryptedUrl);
      if (!decryptedUrl) {
        return res.status(500).json({ error: 'Decryption failed for media stream' });
      }

      const basePrefix = decryptedUrl.substring(0, decryptedUrl.lastIndexOf('_'));
      const ext = decryptedUrl.includes('.mp3') ? 'mp3' : 'mp4';

      return res.status(200).json({
        success: true,
        id: targetPid,
        title: cleanText(songData.song || songData.title),
        artist: cleanText(songData.primary_artists || songData.more_info?.primary_artists),
        album: cleanText(songData.album || songData.more_info?.album),
        image: (songData.image || songData.more_info?.image || '').replace('50x50', '500x500').replace('150x150', '500x500'),
        duration: songData.duration || songData.more_info?.duration || '0',
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

    const results = [];

    // Extract from Songs
    if (data?.songs?.data && Array.isArray(data.songs.data)) {
      for (const item of data.songs.data) {
        const itemPid = String(item.id || item.more_info?.song_pids || '').split(',')[0].trim();
        if (!itemPid) continue;

        results.push({
          id: itemPid,
          pid: itemPid,
          title: cleanText(item.title),
          artist: cleanText(item.more_info?.primary_artists || item.description || 'Unknown'),
          album: cleanText(item.album || 'Single'),
          image: String(item.image || '').replace('50x50', '500x500')
        });
      }
    }

    // Extract from Albums if songs list is short
    if (data?.albums?.data && Array.isArray(data.albums.data)) {
      for (const item of data.albums.data) {
        const itemPid = String(item.more_info?.song_pids || item.id || '').split(',')[0].trim();
        if (!itemPid) continue;

        results.push({
          id: itemPid,
          pid: itemPid,
          title: cleanText(item.title),
          artist: cleanText(item.music || item.description || 'Album Track'),
          album: cleanText(item.title || 'Album'),
          image: String(item.image || '').replace('50x50', '500x500')
        });
      }
    }

    return res.status(200).json({
      query: q,
      results: results
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
