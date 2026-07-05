// ====================================================================
//  Mineradio+ Kugou Concept Edition (酷狗概念版)
//  Adapted from daaimengermengzhu/Mineradio-kugou feature/kugou-concept-login
// ====================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const KUGOU_LOGIN_BASE_URL = 'https://login-user.kugou.com';
const KUGOU_QR_PAGE_URL = 'https://h5.kugou.com/apps/loginQRCode/html/index.html';
const KUGOU_GATEWAY_BASE_URL = 'https://gateway.kugou.com';
const KUGOU_LYRICS_BASE_URL = 'https://lyrics.kugou.com';
const KUGOU_WEB_QR_APPID = '1014';
const KUGOU_LITE_APPID = '3116';
const KUGOU_LITE_CLIENTVER = '11083';
const KUGOU_QR_APPID = '1001';
const KUGOU_QR_SRC_APPID = '2919';
const KUGOU_ANDROID_SIGN_KEY = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';
const KUGOU_WEB_SIGN_KEY = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const KUGOU_LITE_SIGN_KEY_SALT = '185672dd44712f60bb1736df5a377e82';
const KUGOU_ANDROID_UA = 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi';

let kugouCookie = '';
let kugouVipProbeCache = { userId: '', checkedAt: 0, info: null };

var _parseCookieString = null;
var _normalizeCookieHeader = null;
var _rawCookieFallback = null;
var _requestText = null;
var _requestJson = null;

function md5(s) { return crypto.createHash('md5').update(String(s)).digest('hex'); }

// ---- cookie helpers ----
function kugouCookieObject() { return _parseCookieString ? _parseCookieString(kugouCookie) : {}; }
function kugouCookieUserId(obj) { obj = obj || kugouCookieObject(); return String(obj.userid || obj.userId || obj.user_id || obj.KG_UID || obj.kugou_userid || '').trim(); }
function kugouCookieToken(obj) { obj = obj || kugouCookieObject(); return String(obj.token || obj.Token || obj.kugou_token || obj.KG_TOKEN || obj.musicToken || '').trim(); }
function kugouDeviceId(obj) { obj = obj || kugouCookieObject(); return String(obj.KUGOU_API_GUID || obj.guid || '').trim(); }
function decodeKugouCookieValue(value) { var s = String(value); var raw = s; try { raw = decodeURIComponent(s); } catch(e) { raw = s; } try { var b = Buffer.from(s, 'base64').toString('utf8'); if (b.length > 0 && /[\x20-\x7e\u4e00-\u9fff]/.test(b)) return b; } catch(e) {} return raw; }
function kugouCookieNickname(obj, userId) { obj = obj || kugouCookieObject(); for (const k of ['nickname','nickName','nick','username','userName','kugou_nickname','m_name','name']) { const v = obj[k]; if (v) return v; } return userId ? ('酷狗概念版 ' + userId) : ''; }
function kugouCookieAvatar(obj) { obj = obj || kugouCookieObject(); for (const k of ['avatar','head_img','user_pic','pic','image','img']) { const v = obj[k]; if (v) return v; } return ''; }
function normalizeKugouCookieInput(cookieText) { var obj = _parseCookieString ? _parseCookieString(cookieText || '') : {}; if (!obj.userid && (obj.userId || obj.user_id || obj.KG_UID || obj.kugou_userid)) obj.userid = obj.userId || obj.user_id || obj.KG_UID || obj.kugou_userid; if (!obj.token && (obj.Token || obj.kugou_token || obj.KG_TOKEN || obj.musicToken)) obj.token = obj.Token || obj.kugou_token || obj.KG_TOKEN || obj.musicToken; return (_normalizeCookieHeader ? _normalizeCookieHeader(JSON.stringify(Object.keys(obj).map(function(k){return k+'='+obj[k]}).join('; '))) : _rawCookieFallback ? _rawCookieFallback(cookieText) : cookieText) || cookieText; }
function saveKugouCookie(c) { kugouCookie = (_normalizeCookieHeader ? _normalizeCookieHeader(c) : _rawCookieFallback ? _rawCookieFallback(c) : c) || ''; kugouVipProbeCache = { userId: '', checkedAt: 0, info: null }; try { const f = process.env.KUGOU_LITE_COOKIE_FILE || path.join(__dirname, '.kugou-cookie-concept'); fs.writeFileSync(f, kugouCookie); } catch(e) {} }
function getKugouCookie() { return kugouCookie; }

function getKugouLoginInfo() {
  const obj = kugouCookieObject(); const userId = kugouCookieUserId(obj); const token = kugouCookieToken(obj); const loggedIn = !!(userId && token); const nickname = kugouCookieNickname(obj, userId); const avatar = kugouCookieAvatar(obj);
  return { provider: 'kugou', platform: 'lite', loggedIn: !!loggedIn, preview: true, hasCookie: !!kugouCookie, userId: loggedIn ? userId : '', nickname: loggedIn ? nickname : '酷狗概念版', avatar: avatar || '', vipType: 0, isVip: false, isSvip: false, vipLevel: 'none', tokenReady: !!token, deviceReady: false };
}

// ---- GUID / Device ----
function createKugouGuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }
function calculateKugouMid(value) { return BigInt('0x' + md5(String(value || createKugouGuid()))).toString(10); }
function ensureKugouDeviceCookie() { var obj = kugouCookieObject(); var changed = false; if (!obj.KUGOU_API_GUID) { obj.KUGOU_API_GUID = process.env.KUGOU_API_GUID || obj.guid || createKugouGuid(); changed = true; } if (!obj.KUGOU_API_MID) { obj.KUGOU_API_MID = calculateKugouMid(obj.KUGOU_API_GUID); changed = true; } if (!obj.KUGOU_API_PLATFORM) { obj.KUGOU_API_PLATFORM = 'WEB'; changed = true; } if (!obj.KUGOU_API_DEV) { obj.KUGOU_API_DEV = 'WEB'; changed = true; } if (!obj.KUGOU_API_MAC) { obj.KUGOU_API_MAC = md5(process.env.COMPUTERNAME || 'mineradio'); changed = true; } if (changed) { var serialized = Object.keys(obj).map(function(k){return k+'='+obj[k]}).join('; '); kugouCookie = (_normalizeCookieHeader ? _normalizeCookieHeader(serialized) : serialized) || ''; try { var f = process.env.KUGOU_LITE_COOKIE_FILE || path.join(__dirname, '.kugou-cookie-concept'); fs.writeFileSync(f, kugouCookie); } catch(e) {} } return obj; }

// ---- formatting helpers ----
function firstKugouValue() { for (var i = 0; i < arguments.length; i++) { var v = arguments[i]; if (v != null && v !== '' && v !== 0 && v !== '0') return v; } return ''; }
function cleanKugouText(value) { return String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\\n/g, ' ').trim(); }
function normalizeKugouImage(url, size) { url = cleanKugouText(url); if (!url) return ''; if (url.startsWith('http')) return url; return 'https://' + url; }
function mapKugouArtists(raw, fallbackName) { if (!Array.isArray(raw)) return [{ id: '', name: cleanKugouText(fallbackName || '') }]; return raw.map(function(item) { return { id: String(firstKugouValue(item && item.id, item && item.ID, item && item.singerid) || ''), name: cleanKugouText(firstKugouValue(item && item.name, item && item.Name, item && item.singername) || '') }; }); }

function mapKugouSearchSong(record) {
  if (!record) return null;
  var fileName = cleanKugouText(firstKugouValue(record.FileName, record.filename, record.file_name));
  var title = cleanKugouText(firstKugouValue(record.SongName, record.songname, record.song_name, record.name, record.title));
  var singerName = cleanKugouText(firstKugouValue(record.SingerName, record.singername, record.singer_name, record.author_name));
  if (!title && fileName) { var parts = fileName.split(' - '); if (parts.length >= 2) { if (!singerName) singerName = parts[0].trim(); title = parts.slice(1).join(' - ').replace(/\\.(mp3|flac|m4a|ogg|wav)$/i, '').trim(); } else { title = fileName.replace(/\\.(mp3|flac|m4a|ogg|wav)$/i, '').trim(); } }
  var artists = mapKugouArtists(firstKugouValue(record.Singers, record.singers, record.authors), singerName);
  var hash = cleanKugouText(firstKugouValue(record.Hash, record.hash, record.FileHash, record.fileHash, record.filehash));
  var albumAudioId = cleanKugouText(firstKugouValue(record.AlbumID, record.album_id, record.albumid, record.audioid, record.AudioID, record.audio_id));
  var albumId = cleanKugouText(firstKugouValue(record.album_id, record.AlbumID, record.albumId));
  var duration = Number(firstKugouValue(record.Duration, record.duration, record.TimeLength, record.timelength, 0)) || 0;
  if (duration > 100000) duration = Math.round(duration / 1000);
  return { id: hash || albumAudioId, name: title, artist: artists.map(function(a){return a.name}).join(' / '), artists: artists, album: cleanKugouText(firstKugouValue(record.AlbumName, record.album_name, record.album)), cover: normalizeKugouImage(firstKugouValue(record.Image, record.image, record.cover, record.pic), 400), duration: duration, hash: hash, albumAudioId: albumAudioId, albumId: albumId, fee: Number(firstKugouValue(record.PayType, record.pay_type, record.privilege, 0)) || 0, provider: 'kugou', source: 'kugou' };
}
function extractKugouSearchList(body) { try { var d = JSON.parse(body); if (d && d.data && Array.isArray(d.data.lists)) return d.data.lists; if (d && d.data && Array.isArray(d.data.info)) return d.data.info; if (Array.isArray(d && d.lists)) return d.lists; } catch(e) { try { var j = JSON.parse(body.substring(body.indexOf('{'))); if (j && j.data && Array.isArray(j.data.lists)) return j.data.lists; } catch(e2) {} } return []; }
function mapKugouPlaylist(record) { var id = cleanKugouText(firstKugouValue(record.listid, record.specialid, record.global_collection_id, record.gid, record.id)); return { provider:'kugou', source:'kugou', id: id, name: cleanKugouText(firstKugouValue(record.name, record.specialname, record.title))||'', cover: normalizeKugouImage(firstKugouValue(record.pic, record.imgurl, record.cover), 400), trackCount: Number(firstKugouValue(record.song_count, record.songcount, record.count, 0))||0, playCount: Number(firstKugouValue(record.play_count, record.playcount, 0))||0, creator: cleanKugouText(firstKugouValue(record.nickname, record.username, '酷狗概念版')) }; }
function extractKugouPlaylistList(body) { try { var d = JSON.parse(body); if (d && d.data && Array.isArray(d.data.list)) return d.data.list; if (Array.isArray(d && d.list)) return d.list; } catch(e) {} return []; }

// ---- signature ----
function kugouWebSignature(params) { var keys = Object.keys(params || {}).sort(); return md5(KUGOU_WEB_SIGN_KEY + keys.map(function(k){return k+'='+(params[k]!=null?params[k]:'')}).join('') + KUGOU_WEB_SIGN_KEY); }
function kugouAndroidSignature(params, data) { var keys = Object.keys(params || {}).sort(); return md5(KUGOU_ANDROID_SIGN_KEY + keys.map(function(k){return k+'='+(params[k]!=null?params[k]:'')}).join('') + (data||'') + KUGOU_ANDROID_SIGN_KEY); }
function kugouSignKey(hash, mid, userid, appid) { return md5(String(hash) + KUGOU_LITE_SIGN_KEY_SALT + String(mid||'') + String(userid||'') + String(appid||KUGOU_LITE_APPID)); }

function buildKugouLoginUrl(pathname, params) { var signed = Object.assign({}, params||{}); if (!signed.signature) signed.signature = kugouWebSignature(signed); return KUGOU_LOGIN_BASE_URL + pathname + '?' + Object.keys(signed).map(function(k){return k+'='+encodeURIComponent(signed[k]||'')}).join('&'); }
function kugouDefaultParams(params) { var obj = ensureKugouDeviceCookie(); return Object.assign({}, params||{}, { appid: KUGOU_QR_APPID, type:'web', plat:'web', mid: obj.KUGOU_API_MID||'', dfid:'', token: kugouCookieToken(obj), userid: kugouCookieUserId(obj) }); }
async function kugouLoginRequest(pathname, params) { var rp = kugouDefaultParams(params); var text = await _requestText(buildKugouLoginUrl(pathname, rp), {headers:{'User-Agent':KUGOU_ANDROID_UA}}); try { return JSON.parse(text); } catch(e) { return JSON.parse(text.substring(text.indexOf('{'))); } }
function kugouApiCookieHeader() { var obj = ensureKugouDeviceCookie(); return Object.keys(obj).filter(function(k){return k!=='token'&&k!=='userid'}).map(function(k){return k+'='+obj[k]}).join('; ') + '; token=' + kugouCookieToken(obj) + '; userid=' + kugouCookieUserId(obj); }

async function kugouApiRequest(pathname, params, opts) {
  opts = opts||{}; var rp = opts.clearDefaultParams ? Object.assign({},params||{}) : kugouDefaultParams(params);
  if (opts.addKey !== false && rp.hash) { rp.key = kugouSignKey(rp.hash, rp.mid, rp.userid, rp.appid); }
  rp.signature = kugouAndroidSignature(rp, opts.data);
  var qs = Object.keys(rp).map(function(k){return k+'='+encodeURIComponent(rp[k]||'')}).join('&');
  var headers = {'User-Agent':KUGOU_ANDROID_UA, 'dfid':rp.dfid||'-', 'mid':rp.mid||'', 'clienttime':rp.clienttime||'', 'kg-rc':'1', 'kg-thash':'5d816a0', 'kg-rec':'1', 'kg-rf':'B9EDA08A64250DEFFBCADDEE00F8F25F'}; if (opts.headers) Object.assign(headers, opts.headers);
  if (opts.cookie !== false) headers['Cookie'] = kugouApiCookieHeader();
  var url = KUGOU_GATEWAY_BASE_URL + pathname + '?' + qs;
  var text = await _requestText(url, {method: opts.method||'GET', headers: headers}, opts.data);
  try { return JSON.parse(text); } catch(e) { try { return JSON.parse(text.substring(text.indexOf('{'))); } catch(e2) { return {}; } }
}

// ---- handlers ----
function kugouQrLoginUrl(key) { return KUGOU_QR_PAGE_URL + '?qrcode=' + encodeURIComponent(key) + '&appid=' + KUGOU_WEB_QR_APPID + '&src_appid=' + KUGOU_QR_SRC_APPID; }
function pickKugouQrKey(body) { if (!body||!body.data) return ''; return String(body.data.qrcode||body.data.qrcode_key||body.data.key||body.data.qrkey||''); }

function buildQrLoginUrl(pathname, params) {
  var p = Object.assign({}, params);
  if (!p.signature) p.signature = kugouWebSignature(p);
  var qs = Object.keys(p).sort().map(function(k){return k+'='+encodeURIComponent(p[k]||'')}).join('&');
  return KUGOU_LOGIN_BASE_URL + pathname + '?' + qs;
}

function qrLoginDefaultParams(extra) {
  var obj = ensureKugouDeviceCookie();
  var ts = Math.floor(Date.now()/1000);
  return Object.assign({
    dfid: '-', mid: 'undefined', uuid: '-',
    appid: 1001, type: 1, plat: 4,
    srcappid: KUGOU_QR_SRC_APPID,
    clienttime: ts,
    clientver: 20489,
  }, extra || {});
}

async function handleKugouQrKey() {
  try {
    var p = qrLoginDefaultParams({ qrcode_txt: 'https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=1005&' });
    var url = buildQrLoginUrl('/v2/qrcode', p);
    var reqHeaders = { 'User-Agent': KUGOU_ANDROID_UA, dfid: '-', mid: 'undefined', clienttime: String(p.clienttime), 'kg-rc': '1', 'kg-thash': '5d816a0', 'kg-rec': '1', 'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F' };
    var text = await _requestText(url, { headers: reqHeaders });
    var body = JSON.parse(text);
    var key = pickKugouQrKey(body); if (!key) return {ok:false, error:'QR_KEY_FAILED', debug: String(text).substring(0,200)};
    var QRCode = require('qrcode'); var qrImage = await QRCode.toDataURL(kugouQrLoginUrl(key));
    return {ok:true, key:key, qrImage:qrImage, qrLoginUrl:kugouQrLoginUrl(key)};
  } catch(e) { return {ok:false, error:e.message}; }
}

async function handleKugouQrCheck(key) {
  if (!key) return {ok:false, error:'MISSING_KEY'};
  try {
    var p = qrLoginDefaultParams({ qrcode: key });
    var url = buildQrLoginUrl('/v2/get_userinfo_qrcode', p);
    var reqHeaders2 = { 'User-Agent': KUGOU_ANDROID_UA, dfid: '-', mid: 'undefined', clienttime: String(p.clienttime), 'kg-rc': '1', 'kg-thash': '5d816a0', 'kg-rec': '1', 'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F' };
    var text = await _requestText(url, { headers: reqHeaders2 });
    var body = JSON.parse(text);
    if (body && body.data && body.data.status === 4) {
      var obj = kugouCookieObject();
      obj.token = body.data.token || body.data.Token || '';
      obj.userid = body.data.userid || body.data.userId || '';
      obj.nickname = body.data.nickname || '';
      obj.avatar = body.data.avatar || body.data.head_img || body.data.pic || body.data.user_pic || '';
      kugouCookie = Object.keys(obj).map(function(k){return k+'='+(obj[k]||'')}).join('; ');
      try { var f = process.env.KUGOU_LITE_COOKIE_FILE||path.join(__dirname,'.kugou-cookie-concept'); fs.writeFileSync(f, kugouCookie); } catch(e) {}
      ensureKugouDeviceCookie(); var info = getKugouLoginInfo();
      return {ok:true, status:4, message:'登录成功', loggedIn:true, loginInfo:info};
    }
    if (body && body.data && (body.data.status === 3||body.data.status === 2)) return {ok:true, status:body.data.status, message:'已扫描，请在手机上确认'};
    return {ok:true, status:0, message:'等待扫码'};
  } catch(e) { return {ok:false, error:e.message}; }
}

async function handleKugouSearch(keywords, limit) {
  var size = Math.min(Math.max(Number(limit)||10,1),60);
  try { var body = await kugouApiRequest('/v6/search/complex', {keyword:String(keywords||'').trim(), page:1, pagesize:size, platform:'AndroidFilter', cursor:0}, {headers:{'x-router':'complexsearch.kugou.com'}}); return (extractKugouSearchList(body)||[]).map(mapKugouSearchSong).filter(Boolean); }
  catch(e){console.warn('[KugouSearch]',e.message);return[];}
}

async function handleKugouUserPlaylists() {
  try { var body = await kugouApiRequest('/v7/get_all_list', {pagesize:'200', page:'1'}); return (extractKugouPlaylistList(body)||[]).map(mapKugouPlaylist); }
  catch(e){console.warn('[KugouPlaylists]',e.message);return[];}
}

async function handleKugouPlaylistTracks(id) {
  if (!id) return [];
  try { var body = await kugouApiRequest('/v2/get_list_all_file', {listid:String(id), pagesize:'200', page:'1'}); var list = []; try { var d = JSON.parse(body); if (d&&d.data&&Array.isArray(d.data.lists)) list=d.data.lists; } catch(e){} return (list||[]).map(function(t){var h=t.hash||t.Hash||t.fileHash||'';return{id:h,name:t.songname||t.name||t.filename||'',artist:t.singername||t.singer||'',album:t.album_name||'',duration:Number(t.duration||t.timelength||0),hash:h,albumAudioId:t.album_audio_id||t.audioid||'',albumId:t.album_id||t.AlbumID||'',provider:'kugou'};}); }
  catch(e){console.warn('[KugouTracks]',e.message);return[];}
}

async function handleKugouSongUrl(params) {
  if (!params||!params.hash) return {url:'',trial:false};
  try {
    var mid = ensureKugouDeviceCookie().KUGOU_API_MID||'';
    var body = await kugouApiRequest('/v5/url', {hash:params.hash, appid:KUGOU_LITE_APPID, mid:mid, pid:'1', userid:kugouCookieUserId(), token:kugouCookieToken()}, {addKey:true, headers:{'x-router':'trackercdn.kugou.com'}});
    var url=''; if(body&&body.data){if(typeof body.data.url==='string')url=body.data.url;else if(body.data.play_url)url=body.data.play_url;}
    return url?{url:url,trial:false,level:params.quality||'standard'}:{url:'',trial:false};
  } catch(e){return{url:'',trial:false,error:e.message};}
}

async function handleKugouLyric(hash, duration) {
  if (!hash) return{lrc:'',tlyric:''};
  try {
    var text = await kugouApiRequest('/v2/searchLyric', {keyword:hash, pagesize:'5', page:'1'}, {headers:{'x-router':KUGOU_LYRICS_BASE_URL}});
    var candidates=[]; try{var d=typeof text==='object'?text:JSON.parse(text);if(d&&d.data&&Array.isArray(d.data.lists))candidates=d.data.lists;}catch(e){}
    if(!candidates.length) return{lrc:'',tlyric:''};
    var best=candidates[0];
    if(duration){var dur=Number(duration)/1000;for(var i=0;i<candidates.length;i++){if(Math.abs((Number(candidates[i].duration||0)/1000)-dur)<Math.abs((Number(best.duration||0)/1000)-dur))best=candidates[i];}}
    var id=best.id||best.ID||'',accesskey=best.accesskey||best.access_key||''; if(!id||!accesskey) return{lrc:'',tlyric:''};
    var dl=await kugouApiRequest('/v2/downloadLyric',{id:String(id),accesskey:accesskey,clientver:KUGOU_LITE_CLIENTVER,fmt:'lrc'},{addKey:false,headers:{'x-router':KUGOU_LYRICS_BASE_URL}});
    return{lrc:(dl&&dl.data&&(dl.data.lrctxt||dl.data.content||''))||'', tlyric:(dl&&dl.data&&(dl.data.tlrctxt||dl.data.tcontent||''))||''};
  } catch(e){return{lrc:'',tlyric:'',error:e.message};}
}

function init(deps) {
  _parseCookieString = deps.parseCookieString;
  _normalizeCookieHeader = deps.normalizeCookieHeader;
  _rawCookieFallback = deps.rawCookieFallback;
  _requestText = deps.requestText;
  _requestJson = deps.requestJson;
  try { var cf = process.env.KUGOU_LITE_COOKIE_FILE || path.join(__dirname, '.kugou-cookie-concept'); if (fs.existsSync(cf)) kugouCookie = fs.readFileSync(cf, 'utf8').trim(); } catch(e) { kugouCookie = ''; }
}

module.exports = { init, getKugouLoginInfo, handleKugouQrKey, handleKugouQrCheck, handleKugouSearch, handleKugouUserPlaylists, handleKugouPlaylistTracks, handleKugouSongUrl, handleKugouLyric, saveKugouCookie: saveKugouCookie, normalizeKugouCookieInput: normalizeKugouCookieInput };
