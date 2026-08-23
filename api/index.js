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

    // SEARCH ENDPOINT
    if (path.includes('/search')) {
        if (!query) return res.status(400).json({ error: 'Query required' });

        try {
            const apiRes = await axios.get('https://www.jiosaavn.com/api.php', {
                params: {
                    __call: 'search.getResults',
                    _format: 'json',
                    _marker: '0',
                    cc: 'in',
                    n: 15,
                    p: 1,
                    q: query
                },
                headers,
                timeout: 10000
            });

            const rawData = apiRes.data?.results || [];
            const results = [];

            for (const item of rawData) {
                const encryptedUrl = item.encrypted_media_url || item.more_info?.encrypted_media_url;
                if (!encryptedUrl) continue;

                const decryptedUrl = decryptUrl(encryptedUrl);
                if (!decryptedUrl) continue;

                const basePrefix = decryptedUrl.substring(0, decryptedUrl.lastIndexOf('_'));
                const ext = decryptedUrl.includes('.mp3') ? 'mp3' : 'mp4';

                results.push({
                    id: item.id,
                    title: (item.song || item.title || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
                    artist: (item.primary_artists || item.more_info?.primary_artists || 'Unknown').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                    album: (item.album || item.more_info?.album || 'Single').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
                    image: (item.image || '').replace('50x50', '500x500').replace('150x150', '500x500'),
                    duration: item.duration || item.more_info?.duration || '0',
                    media_url: {
                        '320': `${basePrefix}_320.${ext}`,
                        '160': `${basePrefix}_160.${ext}`,
                        '96': `${basePrefix}_96.${ext}`
                    }
                });
            }

            return res.json({ success: true, results });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    return res.status(404).json({ error: 'Endpoint not found' });
};
