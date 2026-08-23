const axios = require('axios');
const crypto = require('crypto');

const DES_KEY = Buffer.from('38346591', 'utf-8');

function decryptUrl(encryptedUrl) {
    try {
        let cleaned = encryptedUrl.trim();
        let missing = cleaned.length % 4;
        if (missing) {
            cleaned += '='.repeat(4 - missing);
        }

        let encryptedBytes = Buffer.from(cleaned, 'base64');
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

        return decrypted.toString('utf-8').trim();
    } catch (e) {
        return null;
    }
}

async function getMediaStreamUrl(songId, quality = '320') {
    const detailRes = await axios.get('https://www.jiosaavn.com/api.php', {
        params: {
            __call: 'song.getDetails',
            cc: 'in',
            _marker: 0,
            _format: 'json',
            pids: songId
        },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36'
        },
        timeout: 10000
    });

    const songData = detailRes.data?.[songId] || {};
    const encryptedUrl = songData.encrypted_media_url || songData.more_info?.encrypted_media_url;

    if (!encryptedUrl) return null;

    const baseUrl = decryptUrl(encryptedUrl);
    if (!baseUrl) return null;

    const basePrefix = baseUrl.substring(0, baseUrl.lastIndexOf('_'));
    const ext = baseUrl.includes('.mp3') ? 'mp3' : 'mp4';
    
    return {
        url: `${basePrefix}_${quality}.${ext}`,
        title: (songData.song || songData.title || 'song').replace(/[^a-zA-Z0-9_\- ]/g, ''),
        ext: ext
    };
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const path = req.url.split('?')[0];
    const { query, songId, quality = '320' } = req.query;

    if (path.includes('/search')) {
        if (!query) return res.status(400).json({ error: 'Query parameter required' });

        try {
            const apiRes = await axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'autocomplete.get',
                    _format: 'json',
                    _marker: 0,
                    cc: 'in',
                    includeMetaTags: 1,
                    query: query
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            const songs = apiRes.data?.songs?.data || [];
            const results = songs.map(song => ({
                id: song.id,
                title: (song.title || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                artist: (song.more_info?.primary_artists || song.primary_artists || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                album: (song.album || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                image: (song.image || '').replace('50x50', '500x500'),
                duration: song.duration || '0'
            }));

            return res.json({ success: true, results });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    } 
    
    else if (path.includes('/stream') || path.includes('/download')) {
        if (!songId) return res.status(400).json({ error: 'songId required' });

        try {
            const media = await getMediaStreamUrl(songId, quality);
            if (!media) return res.status(404).json({ error: 'Song media stream not found' });

            const fileStream = await axios({
                method: 'get',
                url: media.url,
                responseType: 'stream',
                timeout: 30000
            });

            if (path.includes('/download')) {
                const filename = `${media.title}_${quality}kbps.${media.ext}`;
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            }

            res.setHeader('Content-Type', fileStream.headers['content-type'] || 'audio/mp4');
            return fileStream.data.pipe(res);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(404).json({ error: 'Endpoint not found' });
};
