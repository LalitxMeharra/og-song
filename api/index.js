import { Readable } from 'stream';

export const config = { api: { responseLimit: false } };

const DES_KEY_STRING = '38346591';

function desDecipher(encryptedBytes, keyBytes) {
  const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
  const FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
  const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
  const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
  const SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
  const E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
  const S_BOXES = [ [[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7],[0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8],[4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0],[15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13]], [[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10],[3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5],[0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15],[13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9]], [[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8],[13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1],[13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7],[1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12]], [[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15],[13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9],[10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4],[3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14]], [[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9],[14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6],[4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14],[11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3]], [[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11],[10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8],[9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6],[4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13]], [[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1],[13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6],[1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2],[6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12]], [[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7],[1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2],[7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8],[2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]] ];
  const P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];

  function bytesToBits(b) { let a=[]; for(let i=0;i<b.length;i++)for(let j=7;j>=0;j--)a.push((b[i]>>j)&1); return a; }
  function bitsToBytes(a) { let b=[]; for(let i=0;i<a.length;i+=8){let x=0;for(let j=0;j<8;j++)x=(x<<1)|a[i+j];b.push(x);} return b; }
  function permute(a,t) { return t.map(p=>a[p-1]); }

  const keyBits = bytesToBits(keyBytes);
  const pc1Bits = permute(keyBits, PC1);
  let C = pc1Bits.slice(0, 28), D = pc1Bits.slice(28, 56), subKeys = [];
  for (let r = 0; r < 16; r++) {
    const s = SHIFTS[r];
    C = C.slice(s).concat(C.slice(0, s)); D = D.slice(s).concat(D.slice(0, s));
    subKeys.push(permute(C.concat(D), PC2));
  }
  subKeys.reverse();

  const outBytes = [];
  for (let offset = 0; offset < encryptedBytes.length; offset += 8) {
    let bits = permute(bytesToBits(encryptedBytes.slice(offset, offset + 8)), IP);
    let L = bits.slice(0, 32), R = bits.slice(32, 64);
    for (let r = 0; r < 16; r++) {
      const ER = permute(R, E);
      const xor = ER.map((b, idx) => b ^ subKeys[r][idx]);
      let sOut = [];
      for (let s = 0; s < 8; s++) {
        const c = xor.slice(s * 6, (s + 1) * 6);
        const row = (c[0] << 1) | c[5];
        const col = (c[1] << 3) | (c[2] << 2) | (c[3] << 1) | c[4];
        const val = S_BOXES[s][row][col];
        for (let j = 3; j >= 0; j--) sOut.push((val >> j) & 1);
      }
      const newR = L.map((b, idx) => b ^ permute(sOut, P)[idx]);
      L = R; R = newR;
    }
    outBytes.push(...bitsToBytes(permute(R.concat(L), FP)));
  }
  return Buffer.from(outBytes);
}

function cleanText(value = '') {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').trim();
}

function decryptUrl(encryptedUrl) {
  try {
    if (!encryptedUrl) return null;
    let cleaned = String(encryptedUrl).trim().replace(/\s+/g, '');
    let missing = cleaned.length % 4;
    if (missing) cleaned += '='.repeat(4 - missing);

    let encryptedBytes = Buffer.from(cleaned, 'base64');
    const remainder = encryptedBytes.length % 8;
    if (remainder !== 0) encryptedBytes = encryptedBytes.subarray(0, encryptedBytes.length - remainder);

    const keyBytes = Buffer.from(DES_KEY_STRING, 'utf-8');
    const decrypted = desDecipher(encryptedBytes, keyBytes);

    const padLen = decrypted[decrypted.length - 1];
    let finalBytes = decrypted;
    if (padLen >= 1 && padLen <= 8) finalBytes = decrypted.subarray(0, decrypted.length - padLen);

    const finalUrl = finalBytes.toString('utf-8').trim();
    return finalUrl.startsWith('http') ? finalUrl : null;
  } catch (e) { return null; }
}

async function safeFetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    const jsonStart = text.indexOf('{');
    const arrayStart = text.indexOf('[');
    let start = jsonStart;
    if (arrayStart > -1 && (jsonStart === -1 || arrayStart < jsonStart)) start = arrayStart;
    if (start > -1) return JSON.parse(text.slice(start));
    throw new Error('Invalid JSON');
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const q = req.query.q || urlObj.searchParams.get('q') || '';
  const pid = req.query.pid || urlObj.searchParams.get('pid') || '';
  const action = req.query.action || urlObj.searchParams.get('action') || pathname.split('/').pop();

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://www.jiosaavn.com/',
    'Accept': 'application/json',
    'Cookie': 'L=hindi; DL=english;'
  };

  try {
    // 1. HOME API
    if (action === 'home' || pathname.includes('/home')) {
      const homeUrl = `https://www.jiosaavn.com/api.php?__call=webapi.getLaunchData&api_version=4&_format=json&_marker=0&cc=in`;
      const rawData = await safeFetchJSON(homeUrl, { headers });

      const customArtists = [
        { id: "LlRWpHzy3Hk_", title: "Arijit Singh", image: "https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg", type: "artist" },
        { id: "QigrV5leMIs_", title: "Dhanda Nyoliwala", image: "https://c.saavncdn.com/artists/Dhanda_Nyoliwala_000_20240820133551_500x500.jpg", type: "artist" },
        { id: "zWdhMOxbrU8_", title: "Masoom Sharma", image: "https://c.saavncdn.com/artists/Masoom_Sharma_003_20250619064935_500x500.jpg", type: "artist" },
        { id: "ylevcL-ZuH8_", title: "Sidhu Moose Wala", image: "https://c.saavncdn.com/artists/Sidhu_Moose_Wala_004_20250617183705_500x500.jpg", type: "artist" },
        { id: "frMkfb2B4E8_", title: "Karan Aujla", image: "https://c.saavncdn.com/artists/Karan_Aujla_004_20260810121947_500x500.jpg", type: "artist" },
        { id: "06QxyAvVpB4_", title: "Yo Yo Honey Singh", image: "https://c.saavncdn.com/artists/Yo_Yo_Honey_Singh_004_20260811095253_500x500.jpg", type: "artist" },
        { id: "oIVHdWIO5F8_", title: "Diljit Dosanjh", image: "https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg", type: "artist" },
        { id: "sF6m,UAR8co_", title: "Hansraj Raghuwanshi", image: "https://c.saavncdn.com/artists/Hansraj_Raghuwanshi_001_20220916054832_500x500.jpg", type: "artist" }
      ];

      const normalize = (arr) => {
        if (!arr || !Array.isArray(arr)) return [];
        return arr.map(item => {
          let t = 'Unknown';
          if (item.title) t = item.title.text || item.title;
          else if (item.song) t = item.song;
          
          let i = '';
          if (Array.isArray(item.image)) i = item.image[0];
          else if (item.image) i = item.image;
          
          return {
            id: item.id || item.perma_url || '',
            title: t,
            type: item.type || (item.more_info && item.more_info.featured_station_type) || 'album',
            image: i.replace('50x50', '500x500').replace('150x150', '500x500')
          };
        });
      };

      return res.status(200).json({
        trending: normalize(rawData.new_trending),
        new_releases: normalize(rawData.new_albums),
        artists: customArtists
      });
    }

    // 2. SEARCH API
    if (action === 'search' || pathname.includes('/search')) {
      if (!q) return res.status(400).json({ error: 'Missing query' });
      const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(q)}&n=25&p=1&_format=json&_marker=0&cc=in`;
      const data = await safeFetchJSON(searchUrl, { headers });

      const resultsMap = new Map();
      for (const item of (data.results || [])) {
        const itemPid = String(item.id || item.more_info?.song_pids || '').split(',')[0].trim();
        if (!itemPid || resultsMap.has(itemPid)) continue;

        let artistName = item.primary_artists || item?.more_info?.primary_artists || item.singers || item?.subtitle || item?.description || 'Unknown Artist';
        if (typeof artistName === 'string' && artistName.includes(' · ')) artistName = artistName.split(' · ')[1];
        
        resultsMap.set(itemPid, {
          pid: itemPid,
          title: cleanText(item.title || item.song),
          artist: cleanText(artistName),
          album: cleanText(item.more_info?.album || item.album || 'Single'),
          image: String(item.image || '').replace('50x50', '500x500').replace('150x150', '500x500')
        });
        if (resultsMap.size === 50) break;
      }
      return res.status(200).json({ results: Array.from(resultsMap.values()) });
    }

    // 3. ARTIST TOP SONGS API
    if (action === 'artist' || pathname.includes('/artist')) {
      const token = req.query.token || urlObj.searchParams.get('token');
      const page = parseInt(req.query.page || '0', 10);
      if (!token) return res.status(400).json({ error: 'Missing artist token' });

      let artistUrl = `https://www.jiosaavn.com/api.php?__call=webapi.get&token=${encodeURIComponent(token)}&type=artist&p=${page}&n_song=50&n_album=0&sub_type=songs&more=true&category=&sort_order=&includeMetaTags=0&ctx=wap6dot0&api_version=4&_format=json&_marker=0`;
      if (page === 0) {
        artistUrl = `https://www.jiosaavn.com/api.php?__call=webapi.get&token=${encodeURIComponent(token)}&type=artist&p=0&n_song=50&n_album=0&sub_type=&category=&sort_order=&includeMetaTags=0&ctx=wap6dot0&api_version=4&_format=json&_marker=0`;
      }

      const data = await safeFetchJSON(artistUrl, { headers });
      let rawSongs = [];
      if (data.topSongs) {
        if (Array.isArray(data.topSongs)) rawSongs = data.topSongs;
        else if (Array.isArray(data.topSongs.data)) rawSongs = data.topSongs.data;
        else if (Array.isArray(data.topSongs.songs)) rawSongs = data.topSongs.songs;
        else if (typeof data.topSongs === 'object') rawSongs = Object.values(data.topSongs);
      } else if (data.songs) {
        rawSongs = Array.isArray(data.songs) ? data.songs : Object.values(data.songs);
      } else if (Array.isArray(data)) {
        rawSongs = data;
      }

      if (!rawSongs || rawSongs.length === 0) return res.status(404).json({ error: 'No songs found' });

      const topSongs = rawSongs.map(song => {
        let artistName = song.subtitle || song.singers || 'Unknown Artist';
        if (artistName.includes(' - ')) artistName = artistName.split(' - ')[0];
        return {
          pid: String(song.id || song.perma_url || '').split(',')[0].trim(),
          title: cleanText(song.title || song.song),
          artist: cleanText(artistName),
          image: String(song.image || '').replace('50x50', '500x500').replace('150x150', '500x500')
        };
      });

      return res.status(200).json({
        name: data.name || data.title || '',
        image: String(data.image || '').replace('50x50', '500x500').replace('150x150', '500x500'),
        subtitle: data.subtitle || 'Artist Radar',
        topSongs: topSongs
      });
    }

    // 4. RECOMMEND API
    if (action === 'recommend' || pathname.includes('/recommend')) {
      const targetPid = req.query.pid || urlObj.searchParams.get('pid');
      if (!targetPid) return res.status(400).json({ error: 'Missing song pid' });

      try {
        const recoUrl = `https://jiosaavn-plugin-api.vercel.app/api/recommendations?id=${encodeURIComponent(targetPid)}&limit=25`;
        const recoRes = await fetch(recoUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36",
                "Accept": "application/json"
            }
        });
        
        if (!recoRes.ok) throw new Error("Plugin API failed");
        
        const data = await recoRes.json();
        const tracks = data.tracks || [];

        const radioSongs = tracks.map(song => {
          return {
            pid: String(song.identifier || song.id || '').split(',')[0].trim(),
            title: cleanText(song.title || 'Unknown'),
            artist: cleanText(song.author || 'Unknown Artist'),
            image: String(song.artworkUrl || song.image || song.thumbnail || '').replace('50x50', '500x500').replace('150x150', '500x500')
          };
        });

        return res.status(200).json(radioSongs.filter(s => s.pid));
      } catch (err) {
        return res.status(500).json({ error: 'Recommendation failed: ' + err.message });
      }
    }

    // 5. DETAILS API
    if (action === 'details' || pathname.includes('/details') || (pid && !q)) {
      const targetPid = String(pid || '').split(',')[0].trim();
      const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${encodeURIComponent(targetPid)}`;
      const data = await safeFetchJSON(detailsUrl, { headers });
      
      let songData = data?.[targetPid];
      if (!songData) {
        const keys = Object.keys(data || {});
        if (keys.length > 0) songData = data[keys[0]];
      }
      if (!songData) return res.status(404).json({ error: 'Song details not found' });

      const encryptedUrl = songData.encrypted_media_url || songData.more_info?.encrypted_media_url;
      const decryptedUrl = decryptUrl(encryptedUrl);
      if (!decryptedUrl) return res.status(500).json({ error: 'Decryption failed' });

      const basePrefix = decryptedUrl.substring(0, decryptedUrl.lastIndexOf('_'));
      const ext = decryptedUrl.includes('.mp3') ? 'mp3' : 'mp4';

      return res.status(200).json({
        success: true,
        pid: targetPid,
        title: cleanText(songData.song || songData.title),
        artist: cleanText(songData.primary_artists || songData.more_info?.primary_artists),
        album: cleanText(songData.album || songData.more_info?.album),
        language: songData.language || 'hindi',
        image: (songData.image || songData.more_info?.image || '').replace('50x50', '500x500').replace('150x150', '500x500'),
        links: {
          '320': `${basePrefix}_320.${ext}`,
          '160': `${basePrefix}_160.${ext}`,
          '96': `${basePrefix}_96.${ext}`
        }
      });
    }

    // 6. DOWNLOAD PROXY
    if (pathname.includes('/download') || action === 'download') {
      const downloadUrl = req.query.url || urlObj.searchParams.get('url');
      const filename = req.query.filename || urlObj.searchParams.get('filename');
      const quality = req.query.quality || urlObj.searchParams.get('quality');

      if (!downloadUrl) return res.status(400).json({ error: 'Missing url parameter' });
      const cdnUrl = decodeURIComponent(downloadUrl);
      const safeBase = (filename || 'song').replace(/[^\w\s.-]/g, '').trim() || 'song';
      const finalName = `${safeBase}_${quality || '320kbps'}.mp4`;

      const upstream = await fetch(cdnUrl, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } });
      if (!upstream.ok || !upstream.body) return res.status(502).json({ error: 'Upstream stream failed' });

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalName)}"; filename*=UTF-8''${encodeURIComponent(finalName)}`);
      
      const nodeStream = Readable.fromWeb(upstream.body);
      return nodeStream.pipe(res);
    }

    return res.status(400).json({ error: 'Invalid action or endpoint' });
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}