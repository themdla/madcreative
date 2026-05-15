import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(rootDir, 'media.config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const sourceDir = path.join(rootDir, config.sourceDir);
const outputFile = path.join(rootDir, config.outputFile);
const imageExtensions = new Set(config.imageExtensions.map(ext => ext.toLowerCase()));
const videoExtensions = new Set(config.videoExtensions.map(ext => ext.toLowerCase()));
const posterSuffixes = ['-poster', '_poster', ' poster'];

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function labelFromSegment(segment) {
  return segment
    .replace(/^\d+[-_\s]+/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
    .replace(/\b3d\b/gi, '3D');
}

function titleFromFile(filePath) {
  return labelFromSegment(path.basename(filePath, path.extname(filePath)));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findFiles(dir) {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(dir, entry.name);
    if (entry.name.startsWith('.')) return [];
    if (entry.isDirectory()) return findFiles(entryPath);
    return entryPath;
  }));
  return files.flat();
}

async function readSidecar(filePath) {
  const sidecarPath = filePath.replace(path.extname(filePath), '.json');
  if (!(await exists(sidecarPath))) return {};
  try {
    return JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid media sidecar JSON: ${path.relative(rootDir, sidecarPath)}\n${error.message}`);
  }
}

async function findPosterForVideo(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  for (const imageExt of imageExtensions) {
    for (const suffix of ['-poster', '_poster']) {
      const posterPath = path.join(dir, `${base}${suffix}${imageExt}`);
      if (await exists(posterPath)) {
        return toPosix(path.relative(rootDir, posterPath));
      }
    }
  }
  return undefined;
}

function isPosterAsset(filePath) {
  const base = path.basename(filePath, path.extname(filePath)).toLowerCase();
  return posterSuffixes.some(suffix => base.endsWith(suffix));
}

function sortByConfiguredSection(a, b) {
  const sectionKeys = Object.keys(config.sections);
  const aSection = a.pathParts[0];
  const bSection = b.pathParts[0];
  const sectionDiff = sectionKeys.indexOf(aSection) - sectionKeys.indexOf(bSection);
  if (sectionDiff !== 0) return sectionDiff;
  return a.src.localeCompare(b.src, undefined, { numeric: true, sensitivity: 'base' });
}

const files = await findFiles(sourceDir);
const media = [];

for (const filePath of files) {
  const ext = path.extname(filePath).toLowerCase();
  const isImage = imageExtensions.has(ext);
  const isVideo = videoExtensions.has(ext);
  if (!isImage && !isVideo) continue;
  if (isImage && isPosterAsset(filePath)) continue;

  const relativePath = path.relative(sourceDir, filePath);
  const pathParts = relativePath.split(path.sep);
  const sectionKey = pathParts[0];
  const section = config.sections[sectionKey];
  if (!section) continue;

  const sidecar = await readSidecar(filePath);
  const folderTags = pathParts.slice(1, -1).map(labelFromSegment).filter(Boolean);
  const tags = [section.label, ...folderTags, ...(sidecar.tags || [])]
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index);

  const poster = isVideo ? await findPosterForVideo(filePath) : undefined;
  media.push({
    src: toPosix(path.relative(rootDir, filePath)),
    title: sidecar.title || titleFromFile(filePath),
    category: section.category,
    tags,
    alt: sidecar.alt || sidecar.title || titleFromFile(filePath),
    type: isVideo ? 'video' : 'image',
    ...(poster ? { poster } : {}),
    ...(sidecar.featured === false ? { featured: false } : {}),
    pathParts
  });
}

media.sort(sortByConfiguredSection);

const publicMedia = media.map(({ pathParts, ...item }) => item);
const output = `window.MAD_CREATIVE_MEDIA = ${JSON.stringify(publicMedia, null, 2)};\n`;

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, output);

console.log(`Wrote ${publicMedia.length} media item${publicMedia.length === 1 ? '' : 's'} to ${config.outputFile}`);
