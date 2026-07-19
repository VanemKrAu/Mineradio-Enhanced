// ====================================================================
//  Mineradio+ Qishui (汽水音乐) Integration
//  Based on APK version's Qishui implementation
// ====================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

// -- constants --
const QISHUI_API_BASE = 'https://api.qishui.com';
const QISHUI_WEB_BASE = 'https://www.qishui.com';
const QISHUI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const QISHUI_COOKIE_FILE = process.env.QISHUI_COOKIE_FILE || path.join(__dirname, '.qishui-cookie');
const QISHUI_CACHE_DIR = process.env.QISHUI_CACHE_DIR || path.join(__dirname, 'qs-cache');

// -- state --
let qsCookie = '';
let qsLoginInfo = null;

// -- external deps injected at init --
let _requestText = null;
let _requestJson = null;
let _normalizeCookieHeader = null;
let _rawCookieFallback = null;
let _parseCookieString = null;

// -- helpers --
function requestBuffer(targetUrl, opts, body) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (response.statusCode >= 400) {
          const err = new Error('HTTP ' + response.statusCode);
          err.statusCode = response.statusCode;
          err.body = buf.toString('utf8');
          reject(err);
          return;
        }
        resolve(buf);
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function qishuiMd5(text) { return crypto.createHash('md5').update(String(text)).digest('hex'); }

// -- cookie helpers --
function qishuiCookieObject() {
  return _parseCookieString ? _parseCookieString(qsCookie) : {};
}

function qishuiCookieSessionId(obj) {
  obj = obj || qishuiCookieObject();
  return obj.sessionid || obj.session_id || obj.sid || '';
}

function saveQishuiCookie(c) {
  qsCookie = (_normalizeCookieHeader && _normalizeCookieHeader(c)) || (_rawCookieFallback && _rawCookieFallback(c)) || String(c || '');
  qsLoginInfo = null;
  try {
    fs.writeFileSync(QISHUI_COOKIE_FILE, qsCookie);
  } catch (e) {}
}

function getQishuiCookie() { return qsCookie; }

function normalizeQishuiCookieInput(cookieText) {
  return (_normalizeCookieHeader && _normalizeCookieHeader(cookieText)) || (_rawCookieFallback && _rawCookieFallback(cookieText)) || cookieText || '';
}

// -- login info --
async function getQishuiLoginInfo() {
  if (qsLoginInfo) return qsLoginInfo;
  const sessionId = qishuiCookieSessionId();
  if (!sessionId) {
    return { provider: 'qishui', loggedIn: false, hasCookie: false, userId: '', nickname: '', avatar: '', vipType: 0 };
  }
  try {
    // Try to get user info from Qishui API
    const url = QISHUI_API_BASE + '/user/profile';
    const text = await _requestText(url, {
      headers: {
        'User-Agent': QISHUI_UA,
        'Cookie': 'sessionid=' + sessionId,
      },
    });
    const json = JSON.parse(text || '{}');
    const user = json.data || json.user || json || {};
    const userId = String(user.uid || user.user_id || user.id || '');
    const nickname = user.nickname || user.name || user.screen_name || '';
    const avatar = user.avatar || user.avatar_url || user.profile_image_url || '';
    const vipType = Number(user.vip_type || user.vipType || 0);
    qsLoginInfo = {
      provider: 'qishui',
      loggedIn: true,
      hasCookie: true,
      userId,
      nickname: nickname || ('QS_' + userId),
      avatar,
      vipType,
      isVip: vipType > 0,
    };
    return qsLoginInfo;
  } catch (e) {
    console.warn('[Qishui] Login info fetch failed:', e.message);
    // If API fails, assume logged in with sessionid
    qsLoginInfo = {
      provider: 'qishui',
      loggedIn: true,
      hasCookie: true,
      userId: '',
      nickname: '汽水音乐用户',
      avatar: '',
      vipType: 0,
      isVip: false,
    };
    return qsLoginInfo;
  }
}

// -- search --
async function handleQishuiSearch(keywords, limit) {
  const size = Math.min(Math.max(Number(limit) || 10, 1), 60);
  const kw = String(keywords || '').trim();
  if (!kw) return [];
  try {
    const sessionId = qishuiCookieSessionId();
    const url = QISHUI_API_BASE + '/search?keyword=' + encodeURIComponent(kw) + '&count=' + size + '&offset=0';
    const text = await _requestText(url, {
      headers: {
        'User-Agent': QISHUI_UA,
        'Cookie': sessionId ? 'sessionid=' + sessionId : '',
      },
    });
    const json = JSON.parse(text || '{}');
    const data = json.data || json.result || json || {};
    const songs = data.songs || data.song_list || data.tracks || [];
    return songs.map(s => ({
      id: String(s.id || s.song_id || s.track_id || ''),
      trackId: String(s.id || s.song_id || s.track_id || ''),
      name: s.title || s.name || s.song_name || '',
      artist: (s.artists || s.singers || []).map(a => a.name || a).join(' / ') || s.artist || s.singer || '',
      album: s.album || s.album_title || '',
      cover: s.cover || s.album_cover || s.pic || '',
      duration: Number(s.duration || 0),
      provider: 'qishui',
      source: 'qishui',
    })).filter(s => s.name);
  } catch (e) {
    console.warn('[Qishui] Search failed:', e.message);
    return [];
  }
}

// -- download + decrypt --
async function handleQishuiDownload(trackId, force) {
  if (!trackId) return { url: '', error: 'MISSING_TRACK_ID' };
  const sessionId = qishuiCookieSessionId();
  if (!sessionId) return { url: '', error: 'NOT_LOGGED_IN' };

  // Check cache first
  const cacheFile = path.join(QISHUI_CACHE_DIR, trackId + '.m4a');
  if (!force && fs.existsSync(cacheFile)) {
    return { url: '/qs-cache/' + trackId + '.m4a', cached: true };
  }

  try {
    // Get song info
    const infoUrl = QISHUI_API_BASE + '/song/url?id=' + encodeURIComponent(trackId);
    const infoText = await _requestText(infoUrl, {
      headers: {
        'User-Agent': QISHUI_UA,
        'Cookie': 'sessionid=' + sessionId,
      },
    });
    const infoJson = JSON.parse(infoText || '{}');
    const data = infoJson.data || infoJson || {};
    const audioUrl = data.url || data.play_url || data.audio_url || '';

    if (!audioUrl) {
      return { url: '', error: 'NO_PLAYABLE_URL' };
    }

    // Download the audio
    const audioBuffer = await requestBuffer(audioUrl, {
      headers: { 'User-Agent': QISHUI_UA },
    });

    // Decrypt if needed (AES-128-ECB)
    let decryptedBuffer = audioBuffer;
    if (data.encrypted || data.is_encrypted) {
      const key = data.key || data.decrypt_key || 'qp75wpsj1unm3kio';
      const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null);
      decryptedBuffer = Buffer.concat([decipher.update(audioBuffer), decipher.final()]);
    }

    // Cache the file
    if (!fs.existsSync(QISHUI_CACHE_DIR)) {
      fs.mkdirSync(QISHUI_CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(cacheFile, decryptedBuffer);

    return { url: '/qs-cache/' + trackId + '.m4a', cached: false };
  } catch (e) {
    console.warn('[Qishui] Download failed:', e.message);
    return { url: '', error: e.message };
  }
}

// -- lyrics --
async function handleQishuiLyric(trackId) {
  if (!trackId) return { lyric: '', yrc: '' };
  try {
    const sessionId = qishuiCookieSessionId();
    const url = QISHUI_API_BASE + '/lyric?id=' + encodeURIComponent(trackId);
    const text = await _requestText(url, {
      headers: {
        'User-Agent': QISHUI_UA,
        'Cookie': sessionId ? 'sessionid=' + sessionId : '',
      },
    });
    const json = JSON.parse(text || '{}');
    const data = json.data || json || {};
    return {
      lyric: data.lyric || data.lrc || '',
      yrc: data.yrc || data.klyric || '',
    };
  } catch (e) {
    console.warn('[Qishui] Lyric failed:', e.message);
    return { lyric: '', yrc: '' };
  }
}

// -- user playlists --
async function handleQishuiUserPlaylists() {
  const info = await getQishuiLoginInfo();
  if (!info.loggedIn) return { loggedIn: false, provider: 'qishui', playlists: [] };
  try {
    const sessionId = qishuiCookieSessionId();
    const url = QISHUI_API_BASE + '/user/playlist';
    const text = await _requestText(url, {
      headers: {
        'User-Agent': QISHUI_UA,
        'Cookie': 'sessionid=' + sessionId,
      },
    });
    const json = JSON.parse(text || '{}');
    const data = json.data || json || {};
    const rawList = data.playlists || data.list || [];
    const playlists = rawList.map(pl => ({
      id: String(pl.id || pl.playlist_id || ''),
      name: pl.name || pl.title || '歌单',
      cover: pl.cover || pl.pic || '',
      count: Number(pl.track_count || pl.count || 0),
      playCount: Number(pl.play_count || 0),
    }));
    return { loggedIn: true, provider: 'qishui', userId: info.userId, playlists };
  } catch (e) {
    console.warn('[Qishui] User playlists failed:', e.message);
    return { loggedIn: true, provider: 'qishui', userId: info.userId, playlists: [] };
  }
}

// -- playlist tracks --
async function handleQishuiPlaylistTracks(id) {
  if (!id) return { tracks: [] };
  try {
    const sessionId = qishuiCookieSessionId();
    const url = QISHUI_API_BASE + '/playlist/detail?id=' + encodeURIComponent(id);
    const text = await _requestText(url, {
      headers: {
        'User-Agent': QISHUI_UA,
        'Cookie': sessionId ? 'sessionid=' + sessionId : '',
      },
    });
    const json = JSON.parse(text || '{}');
    const data = json.data || json || {};
    const rawTracks = data.tracks || data.songs || [];
    const tracks = rawTracks.map(t => ({
      id: String(t.id || t.song_id || t.track_id || ''),
      trackId: String(t.id || t.song_id || t.track_id || ''),
      name: t.title || t.name || '',
      artist: (t.artists || t.singers || []).map(a => a.name || a).join(' / ') || t.artist || '',
      album: t.album || t.album_title || '',
      cover: t.cover || t.album_cover || '',
      duration: Number(t.duration || 0),
      provider: 'qishui',
      source: 'qishui',
    }));
    return { tracks };
  } catch (e) {
    console.warn('[Qishui] Playlist tracks failed:', e.message);
    return { tracks: [] };
  }
}

// -- route mounting --
function mountRoutes(app, deps) {
  _requestText = deps.requestText;
  _requestJson = deps.requestJson;
  _normalizeCookieHeader = deps.normalizeCookieHeader;
  _rawCookieFallback = deps.rawCookieFallback;
  _parseCookieString = deps.parseCookieString;

  // Load saved cookie on init
  try {
    if (fs.existsSync(QISHUI_COOKIE_FILE)) qsCookie = fs.readFileSync(QISHUI_COOKIE_FILE, 'utf8').trim();
  } catch (e) { qsCookie = ''; }

  // Ensure cache dir exists
  try {
    if (!fs.existsSync(QISHUI_CACHE_DIR)) fs.mkdirSync(QISHUI_CACHE_DIR, { recursive: true });
  } catch (e) {}

  app.get('/api/qishui/login/status', async (_req, res) => {
    try { res.json(await getQishuiLoginInfo()); } catch (e) { res.json({ provider: 'qishui', loggedIn: false, error: e.message }); }
  });

  app.post('/api/qishui/login/cookie', (req, res) => {
    try {
      const body = req.body || {};
      const raw = body.cookie || body.data || body.text || '';
      const c = normalizeQishuiCookieInput(raw);
      if (!c) return res.json({ ok: false, error: 'EMPTY_COOKIE' });
      saveQishuiCookie(c);
      // Reset login info to force re-fetch
      qsLoginInfo = null;
      getQishuiLoginInfo().then(info => {
        res.json({ ok: true, loginInfo: info });
      }).catch(e => {
        res.json({ ok: true, loginInfo: { provider: 'qishui', loggedIn: true, hasCookie: true } });
      });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.post('/api/qishui/logout', (_req, res) => {
    qsCookie = '';
    qsLoginInfo = null;
    try { fs.unlinkSync(QISHUI_COOKIE_FILE); } catch (e) {}
    res.json({ ok: true });
  });

  app.get('/api/qishui/search', async (req, res) => {
    try {
      const songs = await handleQishuiSearch(req.query.keywords || '', req.query.limit || '20');
      res.json({ songs });
    } catch (e) { res.json({ songs: [], error: e.message }); }
  });

  app.get('/api/qishui/download', async (req, res) => {
    try {
      const result = await handleQishuiDownload(req.query.trackId || '', req.query.force === 'true');
      res.json(result);
    } catch (e) { res.json({ url: '', error: e.message }); }
  });

  app.get('/api/qishui/lyric', async (req, res) => {
    try {
      const result = await handleQishuiLyric(req.query.trackId || '');
      res.json(result);
    } catch (e) { res.json({ lyric: '', yrc: '' }); }
  });

  app.get('/api/qishui/user/playlists', async (_req, res) => {
    try { res.json(await handleQishuiUserPlaylists()); } catch (e) { res.json({ loggedIn: false, provider: 'qishui', playlists: [], error: e.message }); }
  });

  app.get('/api/qishui/playlist/tracks', async (req, res) => {
    try { res.json(await handleQishuiPlaylistTracks(req.query.id || '')); } catch (e) { res.json({ tracks: [], error: e.message }); }
  });
}

module.exports = {
  _initDeps: function(deps) {
    _requestText = deps.requestText;
    _requestJson = deps.requestJson;
    _normalizeCookieHeader = deps.normalizeCookieHeader;
    _rawCookieFallback = deps.rawCookieFallback;
    _parseCookieString = deps.parseCookieString;
    try {
      if (fs.existsSync(QISHUI_COOKIE_FILE)) qsCookie = fs.readFileSync(QISHUI_COOKIE_FILE, 'utf8').trim();
      else qsCookie = '';
    } catch (e) { qsCookie = ''; }
    try {
      if (!fs.existsSync(QISHUI_CACHE_DIR)) fs.mkdirSync(QISHUI_CACHE_DIR, { recursive: true });
    } catch (e) {}
  },
  getLoginInfo: getQishuiLoginInfo,
  handleSearch: handleQishuiSearch,
  handleDownload: handleQishuiDownload,
  handleLyric: handleQishuiLyric,
  handlePlaylists: handleQishuiUserPlaylists,
  handlePlaylistTracks: handleQishuiPlaylistTracks,
  saveCookie: saveQishuiCookie,
  normalizeCookie: normalizeQishuiCookieInput,
  getCacheDir: function() { return QISHUI_CACHE_DIR; },
};
