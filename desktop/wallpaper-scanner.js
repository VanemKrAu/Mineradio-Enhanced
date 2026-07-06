const fs = require('fs');
const path = require('path');

const PREVIEW_NAMES = new Set(['preview.jpg', 'preview.jpeg', 'preview.png', 'preview.gif']);

function wallpaperKey(rootPath, folderName) {
  return rootPath + '::' + folderName;
}

function getFolderSize(folderPath, _depth) {
  if ((_depth || 0) > 8) return 0;
  let total = 0;
  let entries;
  try { entries = fs.readdirSync(folderPath, { withFileTypes: true }); }
  catch (_) { return 0; }
  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isFile() || entry.isSymbolicLink()) {
      try { total += fs.statSync(entryPath).size; } catch (_) {}
    } else if (entry.isDirectory()) {
      total += getFolderSize(entryPath, (_depth || 0) + 1);
    }
  }
  return total;
}

function readProjectMeta(folderPath) {
  try {
    var raw = fs.readFileSync(path.join(folderPath, 'project.json'), 'utf8');
    var json = JSON.parse(raw);
    return {
      title: String(json.title || '').trim(),
      type: String(json.type || 'scene').trim(),
      mainFile: String(json.file || 'scene.json').trim(),
      supportsVideo: !!json.supportsvideo,
      rating: String((json.contentrating || '')).trim(),
    };
  } catch (_) {
    return { title: '', type: '', mainFile: 'scene.json', supportsVideo: false, rating: '' };
  }
}

function scanLibrary(rootPath) {
  var entries;
  try { entries = fs.readdirSync(rootPath, { withFileTypes: true }); }
  catch (_) { return []; }
  const folders = entries.filter((entry) => entry.isDirectory());
  const wallpapers = [];
  for (const folder of folders) {
    const folderPath = path.join(rootPath, folder.name);
    let children;
    try {
      children = fs.readdirSync(folderPath, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    const preview = children.find((child) => child.isFile() && PREVIEW_NAMES.has(child.name.toLowerCase()));
    if (!preview) continue;
    const previewPath = path.join(folderPath, preview.name);

    // check for mp4 video
    var mp4Files = [];
    for (var ci = 0; ci < children.length; ci++) {
      var c = children[ci];
      if (c.isFile() && /\.mp4$/i.test(c.name)) mp4Files.push(c.name);
    }

    // check for scene.pkg
    var hasPkg = children.some(function(c) { return c.isFile() && c.name.toLowerCase() === 'scene.pkg'; });
    var hasGifPkg = children.some(function(c) { return c.isFile() && c.name.toLowerCase() === 'gifscene.pkg'; });

    let stat;
    try { stat = fs.statSync(folderPath); } catch (_) { continue; }
    var meta = readProjectMeta(folderPath);
    wallpapers.push({
      id: wallpaperKey(rootPath, folder.name),
      name: meta.title || folder.name,
      originalName: folder.name,
      rating: meta.rating,
      rootPath: rootPath,
      rootName: path.basename(rootPath) || rootPath,
      folderPath: folderPath,
      previewPath: previewPath,
      previewType: path.extname(preview.name).toLowerCase(),
      mp4Files: mp4Files,
      hasPkg: hasPkg,
      hasGifPkg: hasGifPkg,
      wallpaperType: meta.type || 'unknown',
      modifiedAt: stat.mtimeMs,
      birthtimeMs: stat.birthtimeMs || stat.mtimeMs,
      size: getFolderSize(folderPath),
    });
  }
  return wallpapers;
}

function scanLibraries(rootPaths) {
  const roots = Array.isArray(rootPaths) ? rootPaths.filter(function(p){ return p && String(p).trim(); }) : [];
  const result = [];
  for (const rootPath of roots) {
    try {
      result.push(...scanLibrary(rootPath));
    } catch (_) {}
  }
  return result;
}

function autoDetectRoots() {
  const roots = [];
  const found = new Set();

  function normalizeKey(p) {
    return path.normalize(String(p || '')).replace(/\\+$/, '').toLowerCase();
  }

  var steamPath = '';
  try {
    var { execFileSync } = require('child_process');
    var output = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8', timeout: 5000 });
    var match = output.match(/REG_SZ\s+(.+)/i);
    if (match) steamPath = match[1].trim();
  } catch (_) {}

  if (!steamPath || !fs.existsSync(steamPath)) {
    var common = [
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Steam'),
      'C:\\Steam', 'D:\\Steam',
    ];
    for (var i = 0; i < common.length; i++) {
      if (fs.existsSync(common[i])) { steamPath = common[i]; break; }
    }
  }

  var libraryKeys = new Set();
  var libraryPaths = [];
  if (steamPath) {
    var key = normalizeKey(steamPath);
    libraryKeys.add(key);
    libraryPaths.push(steamPath);
  }
  try {
    var vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    if (steamPath && fs.existsSync(vdfPath)) {
      var vdf = fs.readFileSync(vdfPath, 'utf8');
      var pathRe = /"path"\s*"([^"]+)"/g;
      var m;
      while ((m = pathRe.exec(vdf)) !== null) {
        var lib = m[1].replace(/\\\\/g, '\\');
        if (!lib) continue;
        var libKey = normalizeKey(lib);
        if (!libraryKeys.has(libKey)) {
          libraryKeys.add(libKey);
          libraryPaths.push(lib);
        }
      }
    }
  } catch (_) {}

  var WE_APPID = '431960';
  for (var j = 0; j < libraryPaths.length; j++) {
    var lib = libraryPaths[j];
    if (!lib) continue;
    var workshopContent = path.join(lib, 'steamapps', 'workshop', 'content', WE_APPID);
    if (!fs.existsSync(workshopContent)) continue;
    var ck = normalizeKey(workshopContent);
    if (!found.has(ck)) {
      found.add(ck);
      roots.push(workshopContent);
    }
  }

  return roots;
}

// ────────────────────────────────────────────
//  PKG Extraction & Scene Parsing
// ────────────────────────────────────────────

const REPKG_EXE = path.join(__dirname, '..', 'build', 'tools', 'RePKG.exe');

/**
 * Run RePKG to extract scene.pkg into cache directory.
 * Returns path to cache dir or empty string on failure.
 */
function extractPkgToCache(folderPath) {
  var pkgFile = path.join(folderPath, 'scene.pkg');
  if (!fs.existsSync(pkgFile)) return '';
  var cacheDir = path.join(folderPath, '_repkg_cache');
  var cacheMarker = path.join(cacheDir, '.done');

  if (fs.existsSync(cacheMarker)) return cacheDir;

  try {
    var { execFileSync } = require('child_process');
    execFileSync(REPKG_EXE, ['extract', '-s', '-o', cacheDir, pkgFile], {
      encoding: 'utf8', stdio: 'pipe', timeout: 60000
    });
    fs.writeFileSync(cacheMarker, Date.now().toString());
    return cacheDir;
  } catch (e) {
    console.warn('[RePKG] simple extract failed for', folderPath, ':', e.message);
    // try organized fallback
    try {
      var { execFileSync } = require('child_process');
      execFileSync(REPKG_EXE, ['extract', '-o', cacheDir, pkgFile], {
        encoding: 'utf8', stdio: 'pipe', timeout: 60000
      });
      fs.writeFileSync(cacheMarker, Date.now().toString());
      return cacheDir;
    } catch (e2) {
      console.warn('[RePKG] organized extract also failed:', e2.message);
      return '';
    }
  }
}

/**
 * Walk a directory recursively, return flat list of {name, path}.
 */
function walkDir(dir, base) {
  base = base || dir;
  var results = [];
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return results; }
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push.apply(results, walkDir(fullPath, base));
    } else if (entry.isFile()) {
      results.push({
        name: path.relative(base, fullPath).replace(/\\/g, '/'),
        path: fullPath,
        ext: path.extname(entry.name).toLowerCase()
      });
    }
  }
  return results;
}

/**
 * Parse a Wallpaper Engine scene.json and return simplified layer list.
 */
function parseSceneJson(scenePath, cacheDir) {
  var scene;
  try {
    scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  } catch (_) {
    return null;
  }

  var layers = [];

  function resolveFilePath(rawPath) {
    var ext = path.extname(rawPath).toLowerCase();
    if (ext === '.tex') return rawPath.replace(/\.tex$/i, '.png');
    return rawPath;
  }

  /** Resolve model JSON -> texture PNG (via material JSON or name fallback) */
  function resolveObjectTexture(modelPath) {
    try {
      // In -s flat mode, 'models/foo.json' becomes just 'foo.json'
      var modelFull = path.join(cacheDir, modelPath);
      if (!fs.existsSync(modelFull)) {
        // try basename (flat extract)
        var modelFlat = path.join(cacheDir, path.basename(modelPath));
        if (!fs.existsSync(modelFlat)) return '';
        modelFull = modelFlat;
      }
      var model = JSON.parse(fs.readFileSync(modelFull, 'utf8'));

      if (model.material) {
        var matFull = path.join(cacheDir, model.material);
        if (!fs.existsSync(matFull)) {
          // try basename (flat extract)
          var matFlat = path.join(cacheDir, path.basename(model.material));
          if (fs.existsSync(matFlat)) matFull = matFlat;
        }
        if (fs.existsSync(matFull)) {
          try {
            var mat = JSON.parse(fs.readFileSync(matFull, 'utf8'));
            if (Array.isArray(mat.passes) && mat.passes.length) {
              var texNames = mat.passes[0].textures;
              if (Array.isArray(texNames)) {
                for (var ti = 0; ti < texNames.length; ti++) {
                  var tName = texNames[ti]; if (!tName) continue;
                  var exts = ['.png', '.jpg', '.jpeg'];
                  for (var ei = 0; ei < exts.length; ei++) {
                    var cand = path.join(cacheDir, tName + exts[ei]);
                    if (fs.existsSync(cand)) return path.relative(cacheDir, cand).replace(/\\/g, '/');
                  }
                }
              }
            }
          } catch (_) {}
        }

        // fallback: derive texture name from material ref path (e.g. "materials/foo.json" -> "foo.png")
        var baseName = path.basename(model.material, '.json');
        if (baseName) {
          var exts = ['.png', '.jpg', '.jpeg'];
          for (var ei = 0; ei < exts.length; ei++) {
            var cand = path.join(cacheDir, baseName + exts[ei]);
            if (fs.existsSync(cand)) return path.relative(cacheDir, cand).replace(/\\/g, '/');
          }
        }
      }

      // fallback: derive from model JSON file name
      var modelBase = path.basename(modelPath, '.json');
      if (modelBase) {
        var exts = ['.png', '.jpg', '.jpeg'];
        for (var ei = 0; ei < exts.length; ei++) {
          var cand = path.join(cacheDir, modelBase + exts[ei]);
          if (fs.existsSync(cand)) return path.relative(cacheDir, cand).replace(/\\/g, '/');
        }
      }
    } catch (_) {}
    return '';
  }

  function parseVec3(v) {
    if (Array.isArray(v)) return v.map(Number);
    if (typeof v === 'string') return v.trim().split(/\s+/).map(Number);
    return [0, 0, 0];
  }

  // 2D scene: scene.layers
  if (Array.isArray(scene.layers)) {
    function processLayer(layer) {
      var type = (layer.type || 'image').toLowerCase();
      if (type === 'composition' && Array.isArray(layer.layers)) {
        for (var k = 0; k < layer.layers.length; k++) processLayer(layer.layers[k]);
        return;
      }
      if (type === 'camera' || type === 'sound') return;
      if (layer.visible === false) return;

      var entry = {
        name: layer.name || '', type: type,
        visible: layer.visible !== false,
        opacity: typeof layer.opacity === 'number' ? Math.min(1, Math.max(0, layer.opacity)) : 1,
        blending: layer.blending || 'opaque',
        origin: Array.isArray(layer.origin) ? layer.origin.slice(0, 2).map(Number) : [0.5, 0.5],
        scale: Array.isArray(layer.scale) ? layer.scale.slice(0, 2).map(Number) : [1, 1],
        angles: Array.isArray(layer.angles) ? layer.angles.slice(0, 3).map(Number) : [0, 0, 0],
        tint: Array.isArray(layer.tint) ? layer.tint.slice(0, 3).map(Number) : [1, 1, 1],
        effects: Array.isArray(layer.effects) ? layer.effects : [],
      };

      if (layer.file) {
        var resolved = resolveFilePath(layer.file);
        if (fs.existsSync(path.join(cacheDir, resolved))) entry.imageFile = resolved;
      }
      if (type === 'fullscreen' && layer.file && /\.mp4$/i.test(layer.file)) {
        if (fs.existsSync(path.join(cacheDir, layer.file))) entry.videoFile = layer.file;
      }
      if (Array.isArray(layer.textures)) {
        entry.textures = [];
        for (var t = 0; t < layer.textures.length; t++) {
          var tr = resolveFilePath(layer.textures[t]);
          if (fs.existsSync(path.join(cacheDir, tr))) entry.textures.push(tr);
        }
      }
      if (type === 'particle') entry.particleSystem = layer.particleSystem || null;
      layers.push(entry);
    }
    for (var i = 0; i < scene.layers.length; i++) processLayer(scene.layers[i]);
  }

  // 3D scene: scene.objects
  if (Array.isArray(scene.objects)) {
    var BLEND = { 0: 'opaque', 1: 'additive', 2: 'multiply', 3: 'screen', 4: 'overlay' };
    for (var oi = 0; oi < scene.objects.length; oi++) {
      var obj = scene.objects[oi];
      if (!obj.image) continue;
      if (obj.visible === false) continue;

      var texFile = resolveObjectTexture(obj.image);
      var origin = parseVec3(obj.origin);
      var scale = parseVec3(obj.scale);
      var angles = parseVec3(obj.angles);

      layers.push({
        name: obj.name || '', type: 'image', visible: true, opacity: 1,
        blending: BLEND[obj.colorBlendMode] || 'opaque',
        copybackground: !!obj.copybackground,
        origin: origin.length >= 2 ? [origin[0], origin[1]] : [0.5, 0.5],
        scale: scale.length >= 2 ? [scale[0], scale[1]] : [1, 1],
        angles: angles.length >= 3 ? angles : [0, 0, 0],
        tint: [1, 1, 1],
        effects: Array.isArray(obj.effects) ? obj.effects : [],
        imageFile: texFile || '',
      });
    }
  }

  return layers;
}

/**
 * Extract and parse a scene wallpaper from its PKG.
 * Returns a rich scene descriptor object.
 */
function extractWallpaperScene(folderPath) {
  var result = {
    ok: false,
    folderPath: folderPath,
    cacheDir: '',
    project: null,
    scene: null,
    layers: [],
    textures: [],
    videos: [],
    audio: [],
    error: '',
  };

  // read project.json first
  try {
    var projectRaw = fs.readFileSync(path.join(folderPath, 'project.json'), 'utf8');
    result.project = JSON.parse(projectRaw);
  } catch (_) {}

  // extract PKG
  var cacheDir = extractPkgToCache(folderPath);
  if (!cacheDir) {
    result.error = 'PKG extraction failed or no scene.pkg found';
    return result;
  }
  result.cacheDir = cacheDir;
  result.ok = true;

  // walk extracted files
  var allFiles = walkDir(cacheDir);
  for (var i = 0; i < allFiles.length; i++) {
    var f = allFiles[i];
    if (f.ext === '.png' || f.ext === '.jpg' || f.ext === '.jpeg' || f.ext === '.gif' || f.ext === '.webp') {
      result.textures.push(f);
    } else if (f.ext === '.mp4' || f.ext === '.webm') {
      result.videos.push(f);
    } else if (f.ext === '.ogg' || f.ext === '.mp3' || f.ext === '.wav') {
      result.audio.push(f);
    }
  }

  // find and parse scene.json
  var sceneFile = (result.project && result.project.file) ? result.project.file : 'scene.json';
  var scenePath = path.join(cacheDir, sceneFile);
  if (!fs.existsSync(scenePath)) {
    // try common alternatives
    var alts = ['scene.json', 'Scene.json'];
    for (var a = 0; a < alts.length; a++) {
      var altPath = path.join(cacheDir, alts[a]);
      if (fs.existsSync(altPath)) { scenePath = altPath; break; }
    }
  }

  if (fs.existsSync(scenePath)) {
    try {
      result.scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
      // extract scene resolution for layer coordinate normalization
      if (result.scene && result.scene.general && result.scene.general.orthogonalprojection) {
        result.sceneWidth = result.scene.general.orthogonalprojection.width || 1920;
        result.sceneHeight = result.scene.general.orthogonalprojection.height || 1080;
      }
    } catch (_) {}
    result.layers = parseSceneJson(scenePath, cacheDir) || [];
  }
  if (!result.sceneWidth) { result.sceneWidth = 1920; result.sceneHeight = 1080; }

  // if no layers parsed, fall back to flat image list
  if (result.layers.length === 0 && result.textures.length > 0) {
    // sort by file size descending to find main background
    result.textures.sort(function(a, b) {
      try { return fs.statSync(b.path).size - fs.statSync(a.path).size; }
      catch(_) { return 0; }
    });
    var mainTex = result.textures[0];
    result.layers.push({
      name: 'main',
      type: 'image',
      visible: true,
      opacity: 1,
      blending: 'opaque',
      origin: [0.5, 0.5],
      scale: [1, 1],
      angles: [0, 0, 0],
      tint: [1, 1, 1],
      effects: [],
      imageFile: mainTex.name,
    });
  }

  return result;
}

// backward-compatible simple extraction (returns path to best PNG)
function extractWallpaperTexture(folderPath) {
  var scene = extractWallpaperScene(folderPath);
  if (!scene.ok) return '';

  // 优先返回视频文件（PKG 内嵌 MP4）
  if (scene.videos && scene.videos.length > 0) {
    console.log('[Wallpaper] extractWallpaperTexture: found video, returning:', scene.videos[0].path);
    return scene.videos[0].path;
  }

  // find largest texture as the "main" image
  var bestPath = '';
  var bestSize = 0;
  for (var i = 0; i < scene.textures.length; i++) {
    try {
      var st = fs.statSync(scene.textures[i].path);
      if (st.size > bestSize) {
        bestSize = st.size;
        bestPath = scene.textures[i].path;
      }
    } catch (_) {}
  }
  return bestPath;
}

function clearWallpaperCache(roots) {
  var cleaned = 0, bytes = 0;
  for (var r = 0; r < roots.length; r++) {
    try {
      var entries = fs.readdirSync(roots[r], { withFileTypes: true });
      for (var e = 0; e < entries.length; e++) {
        if (!entries[e].isDirectory()) continue;
        var cacheDir = path.join(roots[r], entries[e].name, '_repkg_cache');
        if (fs.existsSync(cacheDir)) {
          try {
            var files = fs.readdirSync(cacheDir);
            for (var f = 0; f < files.length; f++) {
              var fp = path.join(cacheDir, files[f]);
              try { bytes += fs.statSync(fp).size; } catch(__) {}
              try { fs.unlinkSync(fp); cleaned++; } catch(__) {}
            }
            try { fs.rmdirSync(cacheDir); } catch(__) {}
          } catch(__) {}
        }
      }
    } catch(__) {}
  }
  return { cleaned: cleaned, bytes: bytes };
}

function pickBestTexture(files, dir) {
  var best = { path: '', size: 0 };
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (!/\.png$/i.test(f)) continue;
    var fp = path.join(dir, f);
    var stat = fs.statSync(fp);
    if (stat.size > best.size) { best.size = stat.size; best.path = fp; }
  }
  return best.path;
}

module.exports = {
  scanLibrary,
  scanLibraries,
  autoDetectRoots,
  extractWallpaperTexture,
  extractWallpaperScene,
  clearWallpaperCache,
};
