// api/index.js - Vercel serverless function
import axios from 'axios';
import CryptoJS from 'crypto-js';

const DES_KEY = process.env.DES_KEY || '38346591';

export default async function handler(req, res) {
    const { action, query, songId, quality } = req.query;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        switch (action) {
            case 'search':
                return await searchSong(req, res, query);
            case 'download':
                return await downloadSong(req, res, songId, quality);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function searchSong(req, res, query) {
    const url = 'https://www.jiosaavn.com/api.php';
    const params = {
        __call: 'autocomplete.get',
        _format: 'json',
        _marker: 0,
        cc: 'in',
        includeMetaTags: 1,
        query: query
    };

    const response = await axios.get(url, { params });
    const songs = response.data.songs?.data || [];
    
    const results = songs.map(song => ({
        id: song.id,
        title: song.title.replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
        artist: song.more_info?.primary_artists || 'Unknown',
        album: song.album || 'Unknown',
        image: song.image?.replace('50x50', '150x150') || '',
        vlink: song.more_info?.vlink || null,
        duration: song.duration || '0'
    }));

    return res.json({ success: true, results });
}

async function downloadSong(req, res, songId, quality = '320') {
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

    const response = await axios.get(url, { params });
    const songData = response.data[songId] || {};

    // 2. Get encrypted URL
    let encryptedUrl = songData.encrypted_media_url || songData.more_info?.encrypted_media_url;
    if (!encryptedUrl) {
        return res.status(404).json({ error: 'No encrypted URL found' });
    }

    // 3. Decrypt using DES
    const baseUrl = decryptUrl(encryptedUrl);
    const basePrefix = baseUrl.rsplit('_', 1)[0];
    const ext = baseUrl.includes('.mp3') ? 'mp3' : 'mp4';
    const downloadUrl = `${basePrefix}_${quality}.${ext}`;

    // 4. Stream the file (hide URL)
    const fileResponse = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream'
    });

    res.setHeader('Content-Disposition', `attachment; filename="${songData.title || 'song'}_${quality}.${ext}"`);
    res.setHeader('Content-Type', fileResponse.headers['content-type']);
    fileResponse.data.pipe(res);
}

function decryptUrl(encryptedUrl) {
    // Remove 'ID' prefix
    let data = encryptedUrl.startsWith('ID') ? encryptedUrl.slice(2) : encryptedUrl;

    // Fix base64 padding
    let missingPadding = data.length % 4;
    if (missingPadding) {
        data += '='.repeat(4 - missingPadding);
    }

    // DES decryption
    const key = CryptoJS.enc.Utf8.parse(DES_KEY);
    const decrypted = CryptoJS.DES.decrypt({ ciphertext: CryptoJS.enc.Base64.parse(data) }, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });

    let url = decrypted.toString(CryptoJS.enc.Utf8);
    // Remove padding if any
    return url.trim();
                  }
