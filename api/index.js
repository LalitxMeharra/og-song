const axios = require('axios');
const CryptoJS = require('crypto-js');

const DES_KEY = process.env.DES_KEY || '38346591';

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, query, songId, quality } = req.query;

    try {
        if (action === 'search') {
            return await handleSearch(req, res, query);
        } else if (action === 'download') {
            return await handleDownload(req, res, songId, quality);
        } else {
            return res.status(400).json({ error: 'Invalid action. Use ?action=search&query=... or ?action=download&songId=...&quality=...' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

async function handleSearch(req, res, query) {
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    const url = 'https://www.jiosaavn.com/api.php';
    const params = {
        __call: 'autocomplete.get',
        _format: 'json',
        _marker: 0,
        cc: 'in',
        includeMetaTags: 1,
        query: query
    };

    try {
        const response = await axios.get(url, { params, timeout: 10000 });
        const songs = response.data?.songs?.data || [];
        
        const results = songs.map(song => ({
            id: song.id,
            title: song.title?.replace(/&quot;/g, '"').replace(/&#039;/g, "'") || 'Unknown',
            artist: song.more_info?.primary_artists || song.primary_artists || 'Unknown',
            album: song.album || 'Unknown',
            image: song.image?.replace('50x50', '150x150') || '',
            vlink: song.more_info?.vlink || null,
            duration: song.duration || '0'
        }));

        return res.json({ success: true, results });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleDownload(req, res, songId, quality = '320') {
    if (!songId) {
        return res.status(400).json({ error: 'songId parameter is required' });
    }

    try {
        // 1. Get song details
        const url = 'https://www.jiosaavn.com/api.php';
        const params = {
            __call: 'song.getDetails',
            cc: 'in',
            _marker: 0,
            _format: 'json',
            api_version: 4,
            ctx: 'wap6',
            pids: songId
        };

        const response = await axios.get(url, { params, timeout: 10000 });
        const songData = response.data?.[songId] || {};

        // 2. Get encrypted URL
        let encryptedUrl = songData.encrypted_media_url || songData.more_info?.encrypted_media_url;
        if (!encryptedUrl) {
            return res.status(404).json({ error: 'No encrypted URL found for this song' });
        }

        // 3. Decrypt
        const baseUrl = decryptUrl(encryptedUrl);
        if (!baseUrl) {
            return res.status(500).json({ error: 'Decryption failed' });
        }

        const basePrefix = baseUrl.rsplit('_', 1)[0];
        const ext = baseUrl.includes('.mp3') ? 'mp3' : 'mp4';
        const downloadUrl = `${basePrefix}_${quality}.${ext}`;

        // 4. Fetch and stream the file
        const fileResponse = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 30000
        });

        const filename = `${songData.title || 'song'}_${quality}.${ext}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', fileResponse.headers['content-type'] || 'audio/mpeg');
        fileResponse.data.pipe(res);
        
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

function decryptUrl(encryptedUrl) {
    try {
        let data = encryptedUrl.startsWith('ID') ? encryptedUrl.slice(2) : encryptedUrl;

        // Fix base64 padding
        let missingPadding = data.length % 4;
        if (missingPadding) {
            data += '='.repeat(4 - missingPadding);
        }

        const key = CryptoJS.enc.Utf8.parse(DES_KEY);
        const decrypted = CryptoJS.DES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(data) },
            key,
            { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
        );

        let url = decrypted.toString(CryptoJS.enc.Utf8);
        return url.trim();
    } catch (e) {
        console.error('Decryption error:', e.message);
        return null;
    }
}

// Helper: rsplit polyfill
String.prototype.rsplit = function(sep, maxsplit) {
    const split = this.split(sep);
    return maxsplit ? [split.slice(0, -maxsplit).join(sep), split.slice(-maxsplit).join(sep)] : split;
};
