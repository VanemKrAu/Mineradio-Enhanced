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
    let stat;
    try { stat = fs.statSync(folderPath); } catch (_) { continue; }
    wallpapers.push({
      id: wallpaperKey(rootPath, folder.name),
      name: folder.name,
      rootPath: rootPath,
      rootName: path.basename(rootPath) || rootPath,
      folderPath: folderPath,
      previewPath: previewPath,
      previewType: path.extname(preview.name).toLowerCase(),
      modifiedAt: stat.mtimeMs,
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

module.exports = { scanLibrary, scanLibraries };
