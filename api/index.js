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

        const pad = decrypted[decrypted.length - 1];
        if (pad >= 1 && pad <= 8) {
            decrypted = decrypted.subarray(0, decrypted.length - pad);
        }

        return decrypted.toString('utf-8').trim();
    } catch (e) {
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const path = req.url.split('?')[0];
    const { query, songId } = req.query;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/'
    };

    // 1. SEARCH ENDPOINT (Uses autocomplete.get)
    if (path.includes('/search')) {
        if (!query) return res.status(400).json({ error: 'Query parameter is required' });

        try {
            const apiRes = await axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'autocomplete.get',
                    _format: 'json',
                    _marker: '0',
                    cc: 'in',
                    includeMetaTags: '1',
                    query: query
                },
                headers,
                timeout: 10000
            });

            const songs = apiRes.data?.songs?.data || [];
            const results = songs.map(item => ({
                id: item.id,
                title: (item.title || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
                artist: (item.more_info?.primary_artists || item.primary_artists || item.description || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                album: (item.album || item.more_info?.album || 'Single').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                image: (item.image || '').replace('50x50', '500x500')
            }));

            return res.json({ success: true, results });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // 2. GET SONG LINKS & DETAILS ENDPOINT (Uses song.getDetails with pid)
    else if (path.includes('/details')) {
        if (!songId) return res.status(400).json({ error: 'songId required' });

        try {
            const detailRes = await axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'song.getDetails',
                    cc: 'in',
                    _marker: '0',
                    _format: 'json',
                    pids: songId
                },
                headers,
                timeout: 10000
            });

            const songData = detailRes.data?.[songId] || {};
            const encryptedUrl = songData.encrypted_media_url || songData.more_info?.encrypted_media_url;

            if (!encryptedUrl) {
                return res.status(404).json({ success: false, error: 'Encrypted URL not found' });
            }

            const decryptedUrl = decryptUrl(encryptedUrl);
            if (!decryptedUrl) {
                return res.status(500).json({ success: false, error: 'Decryption failed' });
            }

            const basePrefix = decryptedUrl.substring(0, decryptedUrl.lastIndexOf('_'));
            const ext = decryptedUrl.includes('.mp3') ? 'mp3' : 'mp4';

            return res.json({
                success: true,
                title: (songData.song || songData.title || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                artist: (songData.primary_artists || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                album: (songData.album || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                links: {
                    '320': `${basePrefix}_320.${ext}`,
                    '160': `${basePrefix}_160.${ext}`,
                    '96': `${basePrefix}_96.${ext}`
                }
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(404).json({ error: 'Endpoint not found' });
};
