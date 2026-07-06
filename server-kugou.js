// ====================================================================
//  Mineradio+ Kugou Music Integration
//  Adapted from Mineradio-Kugou-Modified
// ====================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const KUGOU_GATEWAY_URL = 'https://gateway.kugou.com';
const KUGOU_LOGIN_BASE_URL = 'https://login-user.kugou.com';
const KUGOU_USER_SERVICE_URL = 'https://userservice.kugou.com';
const KUGOU_APPID = '3116';
const KUGOU_CLIENTVER = '11440';
const KUGOU_QR_APPID = '1001';
const KUGOU_QR_SRC_APPID = '2919';
const KUGOU_ANDROID_SIGN_KEY = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';
const KUGOU_WEB_SIGN_KEY = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const KUGOU_PLAY_KEY_SALT = 'kgcloudv2';
const KUGOU_RSA_PUBLIC_KEY = [
  '-----BEGIN PUBLIC KEY-----',
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDECi0Np2UR87scwrvTr72L6oO01rBbbBPriSDFPxr3Z5syug0O24QyQO8bg27+0+4kBzTBTBOZ/WWU0WryL1JSXRTXLgFVxtzIY41Pe7lPOgsfTCn5kZcvKhYKJesKnnJDNr5/abvTGf+rHG3YRwsCHcQ08/q6ifSioBszvb3QiwIDAQAB',
  '-----END PUBLIC KEY-----',
].join('\n');
const KUGOU_ANDROID_UA = 'Android15-1070-11440-46-0-DiscoveryDRADProtocol-wifi';
const KUGOU_DEFAULT_MID = crypto.createHash('md5').update((process.env.COMPUTERNAME || 'mineradio') + ':kugou').digest('hex');

// -- state --
let kgCookie = '';
let kugouVipProbeCache = { userId: '', checkedAt: 0, info: null };

// -- external deps injected at mount time --
let _parseCookieString = null;
let _normalizeCookieHeader = null;
let _rawCookieFallback = null;
let _requestText = null;
let _requestJson = null;

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
    req.setTimeout(10000, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function kugouMd5(text) { return crypto.createHash('md5').update(String(text)).digest('hex'); }
function kugouSigVal(value) { return kugouMd5(String(value) + KUGOU_ANDROID_SIGN_KEY); }
function kugouAndroidSignature(params, dataString) {
  const keys = Object.keys(params || {}).sort();
  const qs = keys.map(k => k + '=' + params[k]).join('&');
  const base = qs + (dataString || '') + KUGOU_ANDROID_SIGN_KEY;
  return kugouMd5(base);
}
function kugouWebSignature(params) {
  const keys = Object.keys(params || {}).sort();
  return kugouMd5(keys.map(k => k + '=' + params[k]).join('&') + KUGOU_WEB_SIGN_KEY);
}
function kugouRandomString(length, lower) {
  const chars = lower ? 'abcdefghijklmnopqrstuvwxyz0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < length; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}
function kugouCalculateMid(seed) {
  return kugouMd5(String(seed || (process.env.COMPUTERNAME || 'mineradio') + ':kugou'));
}

// -- cookie helpers --
function kugouCookieObject() { return _parseCookieString ? _parseCookieString(kgCookie) : {}; }
function kugouCookieUserId(obj) { obj = obj || kugouCookieObject(); return String(obj.userid || obj.user_id || obj.uid || obj.KugooID || '').replace(/\D/g, ''); }
function kugouCookieToken(obj) { obj = obj || kugouCookieObject(); return obj.token || obj.Token || obj.kg_token || obj.KuGoo || obj.t || ''; }
function kugouCookieMid(obj) { obj = obj || kugouCookieObject(); return obj.mid || obj.MID || obj.KUGOU_API_MID || KUGOU_DEFAULT_MID; }
function kugouCookieDfid(obj) { obj = obj || kugouCookieObject(); return obj.dfid || obj.KG_dfid || obj.kg_dfid || ''; }
function kugouCookieNickname(obj) { obj = obj || kugouCookieObject(); return obj.nickname || obj.user_name || obj.m_name || obj.name || ''; }
function kugouCookieAvatar(obj) { obj = obj || kugouCookieObject(); return obj.avatar || obj.head_img || obj.user_pic || obj.img || obj.pic || ''; }
function kugouCookieVipType(obj) { obj = obj || kugouCookieObject(); return Number(obj.viptype || obj.vip_type || obj.VipType || 0); }

function saveKugouCookie(c) {
  kgCookie = (_normalizeCookieHeader && _normalizeCookieHeader(c)) || (_rawCookieFallback && _rawCookieFallback(c)) || String(c || '');
  kugouVipProbeCache = { userId: '', checkedAt: 0, info: null };
  try {
    const f = process.env.KUGOU_COOKIE_FILE || path.join(__dirname, '.kugou-cookie');
    fs.writeFileSync(f, kgCookie);
  } catch (e) {}
}

function getKugouCookie() { return kgCookie; }

function normalizeKugouCookieInput(cookieText) {
  return (_normalizeCookieHeader && _normalizeCookieHeader(cookieText)) || (_rawCookieFallback && _rawCookieFallback(cookieText)) || cookieText || '';
}

function getKugouLoginInfo() {
  const obj = kugouCookieObject();
  const userId = kugouCookieUserId(obj);
  const token = kugouCookieToken(obj);
  const loggedIn = !!(userId && token);
  const vipType = loggedIn ? kugouCookieVipType(obj) : 0;
  return {
    provider: 'kugou', loggedIn, preview: true,
    hasCookie: !!kgCookie, userId: loggedIn ? userId : '',
    nickname: loggedIn ? (kugouCookieNickname(obj) || (userId ? "KG_"+userId : "酷狗音乐用户")) : '酷狗音乐',
    avatar: loggedIn ? kugouCookieAvatar(obj) : '',
    vipType, isVip: vipType >= 1, isSvip: vipType >= 2, vipLevel: vipType,
    playbackKeyReady: true
  };
}

// -- device registration --
async function kugouRegisterDevice(auth) {
  if (!auth || !auth.userId || !auth.token) return null;
  const mid = kugouCookieMid();
  const ts = String(Math.floor(Date.now() / 1000));
  const params = { platid: '2', appid: KUGOU_APPID, clientver: KUGOU_CLIENTVER, mid, token: auth.token, userid: auth.userId, ts };
  params.signature = kugouAndroidSignature(params);
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8', 'User-Agent': KUGOU_ANDROID_UA };
  const body = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  try {
    const text = await _requestText(KUGOU_USER_SERVICE_URL + '/v1/register_device?' + body, { method: 'GET', headers });
    const json = JSON.parse(text);
    if (json && json.status === 1) return json.data;
  } catch (e) { console.warn('[Kugou] register_device failed:', e.message); }
  return null;
}

function kugouCloudlistCookieHeader(obj) {
  obj = obj || kugouCookieObject();
  const mid = kugouCookieMid(obj);
  const token = kugouCookieToken(obj);
  const userId = kugouCookieUserId(obj);
  const dfid = kugouCookieDfid(obj);
  return 'kg_mid=' + mid + '; kg_dfid=' + dfid + '; userid=' + userId + '; token=' + token + '; appid=' + KUGOU_APPID + '; clientver=' + KUGOU_CLIENTVER;
}

function kugouCookieHeader() {
  return kugouCloudlistCookieHeader();
}

// -- gateway API --
async function kugouGatewayRequest(pathname, options) {
  options = options || {};
  const mid = kugouCookieMid();
  const ts = String(Math.floor(Date.now() / 1000));
  const baseParams = { platid: '2', appid: KUGOU_APPID, clientver: KUGOU_CLIENTVER, mid, ts };
  if (options.signParams) Object.assign(baseParams, options.signParams);
  baseParams.signature = kugouAndroidSignature(baseParams, options.dataString);
  const qs = Object.keys(baseParams).map(k => k + '=' + encodeURIComponent(baseParams[k])).join('&');
  const headers = Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8', 'User-Agent': KUGOU_ANDROID_UA }, options.headers || {});
  const url = KUGOU_GATEWAY_URL + pathname + '?' + qs;
  if (options.method === 'POST' || options.body) {
    return _requestJson(url, { method: options.method || 'POST', headers }, options.body);
  }
  return _requestJson(url, { method: options.method || 'GET', headers });
}

async function kugouCloudlistRequest(pathname, params, data) {
  params = params || {};
  params.appid = KUGOU_APPID;
  params.clientver = KUGOU_CLIENTVER;
  const ts = String(Math.floor(Date.now() / 1000));
  params.ts = ts;
  const mid = kugouCookieMid();
  params.mid = mid;
  const token = kugouCookieToken();
  if (token) params.token = token;
  const userId = kugouCookieUserId();
  if (userId) params.userid = userId;
  params.signature = kugouAndroidSignature(params, data ? (typeof data === 'string' ? data : JSON.stringify(data)) : '');
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8', 'User-Agent': KUGOU_ANDROID_UA, 'Cookie': kugouCloudlistCookieHeader() };
  const url = 'https://cloudlist.service.kugou.com' + pathname + '?' + qs;
  if (data) {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    return _requestJson(url, { method: 'POST', headers }, body);
  }
  return _requestJson(url, { method: 'GET', headers });
}

// -- helpers --
function kugouSafeGet(obj, pathKeys, fallback) {
  let v = obj;
  for (const k of (pathKeys || [])) { if (v == null) return fallback; v = v[k]; }
  return v != null ? v : fallback;
}
function kugouDeepFind(obj, names) {
  if (!obj || typeof obj !== 'object') return null;
  for (const n of names) { if (obj[n] != null) return obj[n]; }
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v && typeof v === 'object') { const r = kugouDeepFind(v, names); if (r != null) return r; }
  }
  return null;
}

// -- QR Login --
async function handleKugouLoginQrKey() {
  const ts = String(Math.floor(Date.now() / 1000));
  const params = { platid: '2', appid: KUGOU_APPID, clientver: KUGOU_CLIENTVER, ts, mid: KUGOU_DEFAULT_MID };
  params.signature = kugouAndroidSignature(params);
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const url = KUGOU_LOGIN_BASE_URL + '/v1/get_qr_code?' + qs;
  try {
    const text = await _requestText(url, { headers: { 'User-Agent': KUGOU_ANDROID_UA } });
    const json = JSON.parse(text);
    if (json && json.status === 1 && json.data) {
      const qrKey = json.data.qrcode_key || json.data.qr_key || json.data.key || '';
      const qrUrl = json.data.qr_url || json.data.url || '';
      if (qrKey) {
        const QRCode = require('qrcode');
        const qrImage = await QRCode.toDataURL(qrUrl || ('https://login-user.kugou.com/v2/qr_code?key=' + qrKey));
        return { ok: true, qrKey, qrUrl, qrImage };
      }
    }
    return { ok: false, error: 'QR_GET_FAILED' };
  } catch (e) {
    console.warn('[Kugou] QR key failed:', e.message);
    return { ok: false, error: e.message };
  }
}

async function handleKugouLoginQrCheck(key) {
  if (!key) return { ok: false, error: 'MISSING_KEY' };
  const ts = String(Math.floor(Date.now() / 1000));
  const params = { platid: '2', appid: KUGOU_APPID, clientver: KUGOU_CLIENTVER, ts, mid: KUGOU_DEFAULT_MID, qrcode_key: key, op: '3' };
  params.signature = kugouAndroidSignature(params);
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const url = KUGOU_LOGIN_BASE_URL + '/v1/check_qr_code?' + qs;
  try {
    const text = await _requestText(url, { headers: { 'User-Agent': KUGOU_ANDROID_UA } });
    const json = JSON.parse(text);
    if (!json || json.status !== 1 || !json.data) return { ok: false, status: -1, message: 'QR expired or invalid' };
    const status = Number(json.data.status || json.data.qr_status || -1);
    if (status === 2) {
      const cookies = json.data.cookie || json.data.cookies || '';
      if (cookies) { saveKugouCookie(cookies); await kugouRegisterDevice(getKugouLoginInfo()); }
      return { ok: true, status: 2, message: '登录成功', loggedIn: true };
    }
    if (status === 1) return { ok: true, status: 1, message: '已扫描，请在手机上确认' };
    return { ok: true, status: 0, message: '等待扫码' };
  } catch (e) {
    console.warn('[Kugou] QR check failed:', e.message);
    return { ok: false, error: e.message };
  }
}

// -- playlist mapping --
function mapKugouPlaylist(raw) {
  return {
    id: String(raw.id || raw.list_id || raw.special_id || ''),
    name: String(raw.name || raw.list_name || raw.special_name || '歌单'),
    cover: String(raw.cover || raw.img || raw.pic || raw.imgurl || ''),
    count: Number(raw.count || raw.total || raw.song_count || raw.filecount || 0),
    playCount: Number(raw.play_count || raw.playcount || raw.listen_num || 0),
  };
}
function cleanKugouTrackText(value) { return String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim(); }
function mapKugouTrack(raw) {
  return {
    id: String(raw.hash || raw.HASH || raw.song_hash || ''),
    name: cleanKugouTrackText(raw.songname || raw.name || raw.song_name || raw.filename || ''),
    artist: cleanKugouTrackText(raw.singername || raw.singer || raw.author_name || ''),
    album: cleanKugouTrackText(raw.album_name || raw.album || ''),
    cover: String(raw.cover || raw.img || raw.album_cover || ''),
    duration: Number(raw.duration || raw.timelength || raw.time || 0),
    hash: String(raw.hash || raw.HASH || ''),
    albumAudioId: String(raw.album_audio_id || raw.audio_id || raw.aid || ''),
    albumId: String(raw.album_id || raw.AlbumID || ''),
    qualityHashes: raw.qualityHashes || raw.quality_hashes || {},
    provider: 'kugou',
  };
}
function kugouHashForQuality(hash, qualityPreference, qualityHashes) {
  const qh = qualityHashes || {};
  const tiers = ['jymaster', 'hires', 'lossless', 'exhigh', 'standard'];
  if (qualityPreference && qh[qualityPreference]) return qh[qualityPreference];
  for (const t of tiers) { if (qh[t]) return qh[t]; }
  return hash;
}
function sortKugouCloudTracks(rawTracks) {
  return (rawTracks || []).sort((a, b) => {
    const fa = Number(a.fsort || a.sort || a.position || 0);
    const fb = Number(b.fsort || b.sort || b.position || 0);
    if (fa !== fb) return fa - fb;
    return (Number(b.collecttime || 0) - Number(a.collecttime || 0));
  });
}

// -- playlist handlers --
async function handleKugouUserPlaylists() {
  const info = getKugouLoginInfo();
  if (!info.loggedIn) return { loggedIn: false, provider: 'kugou', playlists: [] };
  const mid = kugouCookieMid();
  const ts = String(Math.floor(Date.now() / 1000));
  const params = { platid: '2', appid: KUGOU_APPID, clientver: KUGOU_CLIENTVER, mid, userid: info.userId, token: kugouCookieToken(), ts, pagesize: '200', page: '1' };
  params.signature = kugouAndroidSignature(params);
  try {
    const json = await kugouGatewayRequest('/v7/get_all_list', { signParams: { userid: info.userId, token: kugouCookieToken() } });
    const rawList = kugouSafeGet(json, ['data', 'info'], []) || kugouSafeGet(json, ['data', 'list'], []);
    const seen = new Set();
    const playlists = [];
    for (const raw of rawList) {
      const pl = mapKugouPlaylist(raw);
      if (pl.id && !seen.has(pl.id)) { seen.add(pl.id); playlists.push(pl); }
    }
    return { loggedIn: true, provider: 'kugou', userId: info.userId, playlists };
  } catch (e) { console.warn('[Kugou] playlists failed:', e.message); return { loggedIn: true, provider: 'kugou', userId: info.userId, playlists: [] }; }
}

async function handleKugouPlaylistTracks(id) {
  if (!id) return { error: 'Missing playlist id', tracks: [] };
  const info = getKugouLoginInfo();
  const tracks = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const json = await kugouCloudlistRequest('/v4/get_list_all_file', { listid: String(id), pagesize: '200', page: String(page) });
      const rawTracks = kugouSafeGet(json, ['data', 'info'], []) || kugouSafeGet(json, ['data', 'list'], []);
      if (!rawTracks.length) break;
      const sorted = sortKugouCloudTracks(rawTracks).slice(0, 200);
      for (const t of sorted) tracks.push(mapKugouTrack(t));
      if (rawTracks.length < 200) break;
    }
  } catch (e) { console.warn('[Kugou] playlist tracks failed:', e.message); }
  return { tracks };
}

// -- search --
async function handleKugouSearch(keywords, limit) {
  var size = Math.min(Math.max(Number(limit) || 10, 1), 60);
  var kw = String(keywords || '').trim();
  if (!kw) return [];
  try {
    var qs = 'keyword=' + encodeURIComponent(kw) + '&page=1&pagesize=' + size + '&platform=WebFilter';
    var text = await _requestText('http://songsearch.kugou.com/song_search_v2?' + qs, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    var body = JSON.parse(text || '{}');
    var lists = (body && body.data && body.data.lists) || [];
    return lists.map(function(s) {
      var name = s.SongName || s.songname || s.Song||'';
      var artist = s.SingerName || s.singername || s.Singer||'';
      var hash = s.HQFileHash || s.SQFileHash || s.FileHash || s.hash || '';
      return { name: name, artist: artist, id: hash, hash: hash, album: s.AlbumName || s.album_name || '', duration: Number(s.HQDuration || s.SQDuration || s.duration || 0), provider: 'kugou', source: 'kugou' };
    }).filter(function(s) { return s.name; });
  } catch(e) { console.warn('[Kugou] search failed:', e.message); return []; }
}

// -- song URL --
function kugouPlayableUrlFromResponse(json) {
  if (!json) return '';
  const data = json.data || json;
  const urls = data.play_urls || data.play_url || data.url || [];
  if (typeof urls === 'string') return urls;
  if (Array.isArray(urls) && urls.length) return String(urls[0] || '');
  return String(data.url || data.play_url || '');
}

async function kugouTrackercdnPlayUrl(hash, options) {
  options = options || {};
  const mid = kugouCookieMid();
  const userId = kugouCookieUserId();
  const ts = String(Math.floor(Date.now() / 1000));
  const base = hash + KUGOU_PLAY_KEY_SALT + KUGOU_APPID + mid + userId;
  const sign = kugouMd5(base);
  const params = {
    appid: KUGOU_APPID, clientver: KUGOU_CLIENTVER, mid, userid: userId,
    token: kugouCookieToken(), ts, hash, sign,
    behavior: options.behavior || 'play',
  };
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const headers = { 'User-Agent': KUGOU_ANDROID_UA, 'Cookie': kugouCloudlistCookieHeader() };
  const url = 'https://trackercdn.kugou.com/i/v2/?' + qs;
  try {
    const text = await _requestText(url, { headers });
    const clean = text.replace(/<!--KG_TAG_RES_START-->[\s\S]*?<!--KG_TAG_RES_END-->/g, '').trim();
    return JSON.parse(clean);
  } catch (e) { console.warn('[Kugou] trackercdn failed:', e.message); return null; }
}

function decodeKugouLyricContent(raw) {
  try { return Buffer.from(String(raw || ''), 'base64').toString('utf8'); }
  catch (e) { return ''; }
}

async function handleKugouLyric(hash, duration) {
  if (!hash) return { lrc: '', tlyric: '' };
  try {
    // Search for lyric ID
    var searchUrl = 'https://krcs.kugou.com/search?ver=1&man=yes&client=pc&keyword=&duration=' + (duration||0) + '&hash=' + hash;
    var searchText = await _requestText(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    var searchJson = JSON.parse(searchText || '{}');
    var candidates = (searchJson && searchJson.candidates) || [];
    if (!candidates.length) return { lrc: '', tlyric: '' };
    var best = candidates[0];
    var dur = Number(duration) || 0;
    if (dur > 0) {
      for (var i = 0; i < candidates.length; i++) {
        var cd = Math.abs((Number(candidates[i].duration || 0) / 1000) - dur);
        var bd = Math.abs((Number(best.duration || 0) / 1000) - dur);
        if (cd < bd) best = candidates[i];
      }
    }
    var id = best.id || '';
    var accesskey = best.accesskey || '';
    if (!id || !accesskey) return { lrc: '', tlyric: '' };
    // Download lyric
    var dlUrl = 'https://krcs.kugou.com/download?ver=1&client=pc&id=' + id + '&accesskey=' + accesskey;
    var dlText = await _requestText(dlUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    var dlJson = JSON.parse(dlText || '{}');
    var content = decodeKugouLyricContent(dlJson.content || dlJson.data || '');
    var tcontent = decodeKugouLyricContent(dlJson.tcontent || dlJson.tdata || '');
    return { lrc: content, tlyric: tcontent };
  } catch (e) { console.warn('[Kugou] lyric failed:', e.message); return { lrc: '', tlyric: '' }; }
}

// -- VIP probe --
async function getKugouLoginInfoFresh() {
  const info = getKugouLoginInfo();
  if (!info.loggedIn) return info;
  if (kugouVipProbeCache.userId === info.userId && kugouVipProbeCache.checkedAt && (Date.now() - kugouVipProbeCache.checkedAt) < 300000) {
    return Object.assign({}, info, kugouVipProbeCache.info || {});
  }
  kugouVipProbeCache = { userId: info.userId, checkedAt: Date.now(), info: {} };
  // Fetch user profile (nickname + avatar) from Kugou API
  try {
    var obj = kugouCookieObject();
    var ts = String(Math.floor(Date.now() / 1000));
    var p = { appid: KUGOU_APPID, clientver: KUGOU_CLIENTVER, mid: kugouCookieMid(), userid: info.userId, token: kugouCookieToken(obj), ts: ts };
    p.signature = kugouAndroidSignature(p);
    var qs = Object.keys(p).map(function(k) { return k + '=' + encodeURIComponent(p[k] || ''); }).join('&');
    var userText = await _requestText(KUGOU_USER_SERVICE_URL + '/v2/user/info?' + qs, { headers: { 'User-Agent': KUGOU_ANDROID_UA } });
    var userJson = JSON.parse(userText);
    if (userJson && userJson.status === 1 && userJson.data) {
      kugouVipProbeCache.info.nickname = userJson.data.nickname || userJson.data.user_name || '';
      kugouVipProbeCache.info.avatar = userJson.data.avatar || userJson.data.head_img || userJson.data.img || '';
    }
  } catch(e) { console.warn('[Kugou] user info fetch failed:', e.message); }
  try {
    const playlistsResult = await handleKugouUserPlaylists();
    const pls = (playlistsResult && playlistsResult.playlists) || [];
    if (pls.length) {
      const tracksResult = await handleKugouPlaylistTracks(pls[0].id);
      const tracks = (tracksResult && tracksResult.tracks) || [];
      if (tracks.length) {
        const track = tracks[0];
        const json = await kugouTrackercdnPlayUrl(track.hash, { behavior: 'play' });
        const url = kugouPlayableUrlFromResponse(json);
        if (url) kugouVipProbeCache.info = { playbackKeyReady: true, isVip: true };
      }
    }
  } catch (e) {}
  return Object.assign({}, info, kugouVipProbeCache.info || {});
}

async function handleKugouSongUrl(hash, albumAudioId, albumId, qualityPreference, qualityHashes) {
  if (!hash) return { url: '', trial: false };
  const useHash = qualityPreference && qualityHashes ? kugouHashForQuality(hash, qualityPreference, qualityHashes) : hash;
  try {
    const json = await kugouTrackercdnPlayUrl(useHash, { behavior: 'play' });
    const url = kugouPlayableUrlFromResponse(json);
    if (url) return { url, trial: false, level: qualityPreference || 'standard' };
    return { url: '', trial: false, error: 'NO_PLAYABLE_URL' };
  } catch (e) {
    return { url: '', trial: false, error: e.message };
  }
}

// -- route mounting --
function mountRoutes(app, deps) {
  _parseCookieString = deps.parseCookieString;
  _normalizeCookieHeader = deps.normalizeCookieHeader;
  _rawCookieFallback = deps.rawCookieFallback;
  _requestText = deps.requestText;
  _requestJson = deps.requestJson;

  // Load saved cookie on init
  try {
    const cf = process.env.KUGOU_COOKIE_FILE || path.join(__dirname, '.kugou-cookie');
    if (fs.existsSync(cf)) kgCookie = fs.readFileSync(cf, 'utf8').trim();
  } catch (e) { kgCookie = ''; }

  app.get('/api/kugou/login/status', async (_req, res) => {
    try { res.json(await getKugouLoginInfoFresh()); } catch (e) { res.json(getKugouLoginInfo()); }
  });
  app.get('/api/kugou/login/qr/key', async (_req, res) => {
    try { res.json(await handleKugouLoginQrKey()); } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  app.get('/api/kugou/login/qr/check', async (req, res) => {
    try { res.json(await handleKugouLoginQrCheck(req.query.key)); } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  app.post('/api/kugou/login/cookie', (req, res) => {
    try {
      const body = req.body || {};
      const raw = body.cookie || body.text || '';
      const c = normalizeKugouCookieInput(raw);
      if (!c) return res.json({ ok: false, error: 'EMPTY_COOKIE' });
      saveKugouCookie(c);
      const info = getKugouLoginInfo();
      if (!info.loggedIn) return res.json({ ok: false, error: 'COOKIE_INVALID', message: 'Cookie 无效，请确认已登录酷狗音乐后重新导入' });
      res.json({ ok: true, loginInfo: info });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  app.post('/api/kugou/logout', (_req, res) => {
    kgCookie = ''; kugouVipProbeCache = { userId: '', checkedAt: 0, info: null };
    try { fs.unlinkSync(process.env.KUGOU_COOKIE_FILE || path.join(__dirname, '.kugou-cookie')); } catch (e) {}
    res.json({ ok: true });
  });
  app.get('/api/kugou/user/playlists', async (_req, res) => {
    try { res.json(await handleKugouUserPlaylists()); } catch (e) { res.json({ loggedIn: false, provider: 'kugou', playlists: [], error: e.message }); }
  });
  app.get('/api/kugou/playlist/tracks', async (req, res) => {
    try { res.json(await handleKugouPlaylistTracks(req.query.id)); } catch (e) { res.json({ error: e.message, tracks: [] }); }
  });
  app.get('/api/kugou/song/url', async (req, res) => {
    try {
      const data = await handleKugouSongUrl(req.query.hash, req.query.albumAudioId, req.query.albumId, req.query.quality, req.query.qualityHashes ? JSON.parse(req.query.qualityHashes) : null);
      res.json(data);
    } catch (e) { res.json({ url: '', trial: false, error: e.message }); }
  });
  app.get('/api/kugou/lyric', async (req, res) => {
    try { res.json(await handleKugouLyric(req.query.hash, req.query.duration)); } catch (e) { res.json({ lrc: '', tlyric: '' }); }
  });
}


module.exports = {
  _initDeps: function(deps) {
    _parseCookieString = deps.parseCookieString;
    _normalizeCookieHeader = deps.normalizeCookieHeader;
    _rawCookieFallback = deps.rawCookieFallback;
    _requestText = deps.requestText;
    _requestJson = deps.requestJson;
    try {
      const cf = process.env.KUGOU_COOKIE_FILE || require('path').join(__dirname, '.kugou-cookie');
      if (require('fs').existsSync(cf)) kgCookie = require('fs').readFileSync(cf, 'utf8').trim();
      else kgCookie = '';
    } catch (e) { kgCookie = ''; }
  },
  getLoginInfo: getKugouLoginInfo,
  getLoginInfoFresh: getKugouLoginInfoFresh,
  handleQrKey: handleKugouLoginQrKey,
  handleQrCheck: handleKugouLoginQrCheck,
  handlePlaylists: handleKugouUserPlaylists,
  handlePlaylistTracks: handleKugouPlaylistTracks,
  handleSongUrl: handleKugouSongUrl,
  handleLyric: handleKugouLyric,
  handleSearch: handleKugouSearch,
  saveCookie: saveKugouCookie,
  normalizeCookie: normalizeKugouCookieInput
};

