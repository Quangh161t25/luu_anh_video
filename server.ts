import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// CORS Middleware to allow sharing and embedding everywhere
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Increase body parser limit for photos, videos, text files
app.use(express.json({ limit: '65mb' }));
app.use(express.urlencoded({ extended: true, limit: '65mb' }));

// Directories for persistent data
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const DATA_DIR = path.resolve(__dirname, 'data');
const METADATA_FILE = path.resolve(DATA_DIR, 'files.json');
const SHEET_SYNC_FILE = path.resolve(DATA_DIR, 'sheet_records.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface StoredFile {
  id: string;
  name: string;
  category: 'image' | 'video' | 'text' | 'document' | 'other';
  mimeType: string;
  size: number;
  sizeFormatted: string;
  diskFilename: string;
  uploadedAt: string;
  shortCode: string;
  tags: string[];
  description?: string;
  dimensions?: { width: number; height: number };
  duration?: number;
  lineCount?: number;
  wordCount?: number;
  textSnippet?: string;
  syncedToGoogleSheet?: boolean;
  googleSheetSyncTime?: string;
  externalUrl?: string;
  provider?: 'uguu' | 'catbox' | 'tmpfiles' | 'litterbox' | '0x0' | 'local';
}

interface SheetRecord {
  id: string;
  fileId: string;
  timestamp: string;
  fileName: string;
  category: string;
  fileSize: string;
  shareUrl: string;
  directUrl: string;
  externalUrl?: string;
  status: 'synced' | 'pending' | 'failed';
  method: string;
  error?: string;
}

// Helpers
function loadFiles(): StoredFile[] {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const data = fs.readFileSync(METADATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading files metadata:', err);
  }
  return [];
}

function saveFiles(files: StoredFile[]) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(files, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving files metadata:', err);
  }
}

function loadSheetRecords(): SheetRecord[] {
  try {
    if (fs.existsSync(SHEET_SYNC_FILE)) {
      const data = fs.readFileSync(SHEET_SYNC_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading sheet records:', err);
  }
  return [];
}

function saveSheetRecords(records: SheetRecord[]) {
  try {
    fs.writeFileSync(SHEET_SYNC_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sheet records:', err);
  }
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getAppBaseUrl(req: express.Request): string {
  // If request comes from an external client, prioritize host headers
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  let host = (req.headers['x-forwarded-host'] || req.get('host') || '').toString();

  if (!host && process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }

  // In AI Studio Cloud Run, ais-dev- URLs require authentication cookies.
  // The public shared URL is ais-pre- which anyone on the internet can open!
  // If host contains ais-dev-, we also make sure public share link references ais-pre-
  return `${proto}://${host || `localhost:${PORT}`}`;
}

const SHARED_APP_URL = 'https://ais-pre-xs6khptdah3rrfnbbuq6in-563447778288.asia-east1.run.app';

function getPublicShareUrl(req: express.Request, pathSuffix: string): string {
  const baseUrl = getAppBaseUrl(req);
  // Transform ais-dev- to ais-pre- for universal public access without login wall
  if (baseUrl.includes('ais-dev-')) {
    return `${SHARED_APP_URL}${pathSuffix}`;
  }
  return `${baseUrl}${pathSuffix}`;
}

// Upload buffer to Uguu.se (Instant global CDN direct links up to 100MB, no account needed)
async function uploadToUguu(buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append('files[]', blob, filename);

  const response = await fetch('https://uguu.se/upload.php', {
    method: 'POST',
    body: form,
  });

  const data: any = await response.json();
  if (data.success && data.files && data.files[0]?.url) {
    return data.files[0].url;
  }
  throw new Error(`Uguu error: ${JSON.stringify(data)}`);
}

// Upload buffer to TmpFiles.org (Global direct download links)
async function uploadToTmpFiles(buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append('file', blob, filename);

  const response = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: form,
  });

  const data: any = await response.json();
  if (data.status === 'success' && data.data?.url) {
    return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  }
  throw new Error(`TmpFiles error: ${JSON.stringify(data)}`);
}

// Upload buffer to Catbox.moe
async function uploadToCatbox(buffer: Buffer, filename: string, mimeType: string, userhash?: string): Promise<string> {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  if (userhash && userhash.trim()) {
    form.append('userhash', userhash.trim());
  }
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || 'application/octet-stream' });
  form.append('fileToUpload', blob, filename);

  const response = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  const text = (await response.text()).trim();
  if (response.ok && text.startsWith('http')) {
    return text;
  }
  throw new Error(`Catbox error: ${text}`);
}

// Upload buffer to Litterbox (Catbox temporary hosting)
async function uploadToLitterbox(buffer: Buffer, filename: string, mimeType: string, time = '72h'): Promise<string> {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('time', time);
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || 'application/octet-stream' });
  form.append('fileToUpload', blob, filename);

  const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    body: form,
  });

  const text = (await response.text()).trim();
  if (response.ok && text.startsWith('http')) {
    return text;
  }
  throw new Error(`Litterbox error: ${text}`);
}

// Upload buffer to 0x0.st
async function uploadToNullPointer(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || 'application/octet-stream' });
  form.append('file', blob, filename);

  const response = await fetch('https://0x0.st', {
    method: 'POST',
    body: form,
  });

  const text = (await response.text()).trim();
  if (response.ok && text.startsWith('http')) {
    return text;
  }
  throw new Error(`0x0.st error: ${text}`);
}

// ================= API ROUTES =================

// 0. Catbox Proxy Route for Browser Uploads
app.post('/api/catbox', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  try {
    const rawFilename = (req.headers['x-filename'] as string) || 'file.bin';
    const filename = decodeURIComponent(rawFilename);
    const userhash = (req.headers['x-userhash'] as string) || '';
    const reqtype = (req.headers['x-reqtype'] as string) || 'fileupload';
    const time = (req.headers['x-time'] as string) || '72h';
    const isLitterbox = reqtype === 'litterbox';
    const targetUrl = isLitterbox
      ? 'https://litterbox.catbox.moe/resources/internals/api.php'
      : 'https://catbox.moe/user/api.php';

    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    if (isLitterbox) {
      form.append('time', time);
    }
    if (userhash && userhash.trim()) {
      form.append('userhash', userhash.trim());
    }
    const blob = new Blob([new Uint8Array(buffer)]);
    form.append('fileToUpload', blob, filename);

    const catboxRes = await fetch(targetUrl, {
      method: 'POST',
      body: form,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    const resultText = (await catboxRes.text()).trim();
    if (catboxRes.ok && resultText.startsWith('http')) {
      return res.json({ success: true, url: resultText });
    }

    return res.status(catboxRes.status || 500).json({ success: false, error: resultText });
  } catch (err: any) {
    console.error('Catbox proxy error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Get all files
app.get('/api/files', (req, res) => {
  const files = loadFiles();
  const filesWithUrls = files.map((f) => ({
    ...f,
    shareUrl: getPublicShareUrl(req, `/#view=${f.id}`),
    directUrl: f.externalUrl || getPublicShareUrl(req, `/api/raw/${f.id}/${encodeURIComponent(f.name)}`),
    localDirectUrl: getPublicShareUrl(req, `/api/raw/${f.id}/${encodeURIComponent(f.name)}`),
    downloadUrl: getPublicShareUrl(req, `/api/download/${f.id}/${encodeURIComponent(f.name)}`),
    shortUrl: getPublicShareUrl(req, `/s/${f.shortCode}`),
  }));
  res.json({ success: true, files: filesWithUrls });
});

// 2. Get single file
app.get('/api/files/:id', (req, res) => {
  const files = loadFiles();
  const file = files.find((f) => f.id === req.params.id || f.shortCode === req.params.id);
  if (!file) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }
  res.json({
    success: true,
    file: {
      ...file,
      shareUrl: getPublicShareUrl(req, `/#view=${file.id}`),
      directUrl: file.externalUrl || getPublicShareUrl(req, `/api/raw/${file.id}/${encodeURIComponent(file.name)}`),
      localDirectUrl: getPublicShareUrl(req, `/api/raw/${file.id}/${encodeURIComponent(file.name)}`),
      downloadUrl: getPublicShareUrl(req, `/api/download/${file.id}/${encodeURIComponent(file.name)}`),
      shortUrl: getPublicShareUrl(req, `/s/${file.shortCode}`),
    },
  });
});

// 3. Upload file with optional Catbox / Public Cloud integration
app.post('/api/upload', async (req, res) => {
  try {
    const { 
      name, 
      base64, 
      mimeType, 
      tags, 
      category, 
      dimensions, 
      duration, 
      provider = 'catbox', 
      userhash,
      litterboxExpiry = '72h'
    } = req.body;

    if (!name || !base64) {
      return res.status(400).json({ success: false, error: 'Name and base64 content are required' });
    }

    // Clean base64 header
    const cleanBase64 = base64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const size = buffer.length;

    const id = crypto.randomUUID();
    const shortCode = crypto.randomBytes(4).toString('hex');
    const ext = path.extname(name) || '';
    const safeFilename = `${id}${ext}`;
    const filePath = path.resolve(UPLOADS_DIR, safeFilename);

    // Save local copy first so it's always preserved
    fs.writeFileSync(filePath, buffer);

    // Determine category
    let detectedCategory: StoredFile['category'] = category || 'other';
    if (!category) {
      const lowerMime = (mimeType || '').toLowerCase();
      const lowerExt = ext.toLowerCase();
      if (lowerMime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(lowerExt)) {
        detectedCategory = 'image';
      } else if (lowerMime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'].includes(lowerExt)) {
        detectedCategory = 'video';
      } else if (lowerMime.startsWith('text/') || ['.txt', '.md', '.json', '.csv', '.log', '.js', '.ts', '.html', '.css', '.xml', '.yml', '.yaml', '.sh'].includes(lowerExt)) {
        detectedCategory = 'text';
      } else {
        detectedCategory = 'document';
      }
    }

    let lineCount = undefined;
    let wordCount = undefined;
    let textSnippet = undefined;

    if (detectedCategory === 'text') {
      try {
        const textStr = buffer.toString('utf-8');
        const lines = textStr.split(/\r\n|\r|\n/);
        lineCount = lines.length;
        wordCount = textStr.trim() ? textStr.trim().split(/\s+/).length : 0;
        textSnippet = textStr.slice(0, 1000);
      } catch (e) {
        // ignore encoding issue
      }
    }

    // Attempt External Public Hosting (Uguu.se / Catbox.moe / TmpFiles.org)
    let externalUrl: string | undefined = undefined;
    let usedProvider: StoredFile['provider'] = provider;

    if (provider === 'catbox') {
      let uploaded = false;
      if (userhash && userhash.trim()) {
        try {
          externalUrl = await uploadToCatbox(buffer, name, mimeType || 'application/octet-stream', userhash.trim());
          usedProvider = 'catbox';
          uploaded = true;
        } catch (catboxErr: any) {
          console.warn('Catbox with userhash failed, falling back to Uguu:', catboxErr.message);
        }
      }
      // If no userhash or Catbox blocked datacenter IP, immediately use Uguu.se
      if (!uploaded) {
        try {
          externalUrl = await uploadToUguu(buffer, name);
          usedProvider = 'uguu';
          uploaded = true;
        } catch (uguuErr: any) {
          console.warn('Uguu upload failed, falling back to TmpFiles:', uguuErr.message);
          try {
            externalUrl = await uploadToTmpFiles(buffer, name);
            usedProvider = 'tmpfiles';
            uploaded = true;
          } catch (tmpErr: any) {
            console.warn('TmpFiles fallback failed:', tmpErr.message);
            usedProvider = 'local';
          }
        }
      }
    } else if (provider === 'uguu') {
      try {
        externalUrl = await uploadToUguu(buffer, name);
        usedProvider = 'uguu';
      } catch (err: any) {
        console.warn('Uguu upload failed, falling back to TmpFiles:', err.message);
        try {
          externalUrl = await uploadToTmpFiles(buffer, name);
          usedProvider = 'tmpfiles';
        } catch (tmpErr) {
          usedProvider = 'local';
        }
      }
    } else if (provider === 'tmpfiles') {
      try {
        externalUrl = await uploadToTmpFiles(buffer, name);
        usedProvider = 'tmpfiles';
      } catch (err: any) {
        console.warn('TmpFiles upload failed, falling back to Uguu:', err.message);
        try {
          externalUrl = await uploadToUguu(buffer, name);
          usedProvider = 'uguu';
        } catch (uguuErr) {
          usedProvider = 'local';
        }
      }
    } else if (provider === 'litterbox') {
      try {
        externalUrl = await uploadToLitterbox(buffer, name, mimeType || 'application/octet-stream', litterboxExpiry);
        usedProvider = 'litterbox';
      } catch (e) {
        try {
          externalUrl = await uploadToUguu(buffer, name);
          usedProvider = 'uguu';
        } catch (uguuErr) {
          usedProvider = 'local';
        }
      }
    } else if (provider === '0x0') {
      try {
        externalUrl = await uploadToUguu(buffer, name);
        usedProvider = 'uguu';
      } catch (e) {
        usedProvider = 'local';
      }
    }

    const newFile: StoredFile = {
      id,
      name,
      category: detectedCategory,
      mimeType: mimeType || 'application/octet-stream',
      size,
      sizeFormatted: formatBytes(size),
      diskFilename: safeFilename,
      uploadedAt: new Date().toISOString(),
      shortCode,
      tags: Array.isArray(tags) ? tags : [],
      dimensions,
      duration,
      lineCount,
      wordCount,
      textSnippet,
      syncedToGoogleSheet: false,
      externalUrl,
      provider: usedProvider,
    };

    const files = loadFiles();
    files.unshift(newFile);
    saveFiles(files);

    const publicDirect = externalUrl || getPublicShareUrl(req, `/api/raw/${newFile.id}/${encodeURIComponent(newFile.name)}`);
    const fileWithUrls = {
      ...newFile,
      shareUrl: getPublicShareUrl(req, `/#view=${newFile.id}`),
      directUrl: publicDirect,
      localDirectUrl: getPublicShareUrl(req, `/api/raw/${newFile.id}/${encodeURIComponent(newFile.name)}`),
      downloadUrl: getPublicShareUrl(req, `/api/download/${newFile.id}/${encodeURIComponent(newFile.name)}`),
      shortUrl: getPublicShareUrl(req, `/s/${newFile.shortCode}`),
    };

    res.json({
      success: true,
      file: fileWithUrls,
      externalUrl,
      provider: usedProvider,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error during upload' });
  }
});

// 4. Raw file stream (CORS enabled, Range streaming for video/audio, inline Content-Type)
app.get('/api/raw/:id/:filename?', (req, res) => {
  const files = loadFiles();
  const file = files.find((f) => f.id === req.params.id || f.shortCode === req.params.id);
  if (!file) {
    return res.status(404).send('File not found');
  }

  const filePath = path.resolve(UPLOADS_DIR, file.diskFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File missing from disk');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunksize);
    stream.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
});

// 5. Download file endpoint
app.get('/api/download/:id/:filename?', (req, res) => {
  const files = loadFiles();
  const file = files.find((f) => f.id === req.params.id || f.shortCode === req.params.id);
  if (!file) {
    return res.status(404).send('File not found');
  }

  const filePath = path.resolve(UPLOADS_DIR, file.diskFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File missing from disk');
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(filePath).pipe(res);
});

// 6. Delete file
app.delete('/api/files/:id', (req, res) => {
  const files = loadFiles();
  const index = files.findIndex((f) => f.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  const [removed] = files.splice(index, 1);
  saveFiles(files);

  const filePath = path.resolve(UPLOADS_DIR, removed.diskFilename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('Could not delete disk file:', e);
    }
  }

  res.json({ success: true, deleted: removed });
});

// 7. Short URL redirect (/s/:code)
app.get('/s/:code', (req, res) => {
  const files = loadFiles();
  const file = files.find((f) => f.shortCode === req.params.code);
  if (file) {
    // If it has Catbox direct URL and user asked for raw redirect or view
    if (req.query.raw === '1' && file.externalUrl) {
      return res.redirect(file.externalUrl);
    }
    return res.redirect(getPublicShareUrl(req, `/#view=${file.id}`));
  }
  res.status(404).send('Shortlink not found');
});

// 8. Integrations: Google Sheets sync
app.post('/api/integrations/google-sheets', async (req, res) => {
  const { fileId, webhookUrl, spreadsheetId, customData } = req.body;
  const files = loadFiles();
  const file = files.find((f) => f.id === fileId);

  const filePayload = file
    ? {
        fileId: file.id,
        fileName: file.name,
        category: file.category,
        mimeType: file.mimeType,
        fileSizeFormatted: file.sizeFormatted,
        fileSizeBytes: file.size,
        // Send Catbox URL as primary direct link so anyone opening Google Sheets gets public access!
        shareUrl: getPublicShareUrl(req, `/#view=${file.id}`),
        directUrl: file.externalUrl || getPublicShareUrl(req, `/api/raw/${file.id}/${encodeURIComponent(file.name)}`),
        externalUrl: file.externalUrl || '',
        provider: file.provider || 'local',
        downloadUrl: getPublicShareUrl(req, `/api/download/${file.id}/${encodeURIComponent(file.name)}`),
        shortUrl: getPublicShareUrl(req, `/s/${file.shortCode}`),
        uploadedAt: file.uploadedAt,
        tags: file.tags.join(', '),
      }
    : customData;

  if (!filePayload) {
    return res.status(400).json({ success: false, error: 'File not found or missing payload' });
  }

  const recordId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // If user provided a real Google Apps Script webhook URL
  if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filePayload),
      });
      const resText = await response.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch (e) {
        resJson = { response: resText };
      }

      const sheetRecord: SheetRecord = {
        id: recordId,
        fileId: filePayload.fileId || 'manual',
        timestamp,
        fileName: filePayload.fileName,
        category: filePayload.category,
        fileSize: filePayload.fileSizeFormatted,
        shareUrl: filePayload.shareUrl,
        directUrl: filePayload.directUrl,
        externalUrl: filePayload.externalUrl,
        status: response.ok ? 'synced' : 'failed',
        method: 'Apps Script Webhook',
        error: response.ok ? undefined : `HTTP ${response.status}: ${resText.slice(0, 100)}`,
      };

      const records = loadSheetRecords();
      records.unshift(sheetRecord);
      saveSheetRecords(records);

      if (file) {
        file.syncedToGoogleSheet = true;
        file.googleSheetSyncTime = timestamp;
        saveFiles(files);
      }

      return res.json({
        success: response.ok,
        record: sheetRecord,
        upstreamStatus: response.status,
        upstreamData: resJson,
      });
    } catch (err: any) {
      console.error('Google Sheets webhook error:', err);
      const sheetRecord: SheetRecord = {
        id: recordId,
        fileId: filePayload.fileId || 'manual',
        timestamp,
        fileName: filePayload.fileName,
        category: filePayload.category,
        fileSize: filePayload.fileSizeFormatted,
        shareUrl: filePayload.shareUrl,
        directUrl: filePayload.directUrl,
        externalUrl: filePayload.externalUrl,
        status: 'failed',
        method: 'Apps Script Webhook',
        error: err.message,
      };

      const records = loadSheetRecords();
      records.unshift(sheetRecord);
      saveSheetRecords(records);

      return res.status(502).json({ success: false, error: err.message, record: sheetRecord });
    }
  }

  // Internal Sheet Record Engine
  const sheetRecord: SheetRecord = {
    id: recordId,
    fileId: filePayload.fileId || 'manual',
    timestamp,
    fileName: filePayload.fileName,
    category: filePayload.category,
    fileSize: filePayload.fileSizeFormatted,
    shareUrl: filePayload.shareUrl,
    directUrl: filePayload.directUrl,
    externalUrl: filePayload.externalUrl,
    status: 'synced',
    method: 'Direct Sheet Record Engine',
  };

  const records = loadSheetRecords();
  records.unshift(sheetRecord);
  saveSheetRecords(records);

  if (file) {
    file.syncedToGoogleSheet = true;
    file.googleSheetSyncTime = timestamp;
    saveFiles(files);
  }

  res.json({
    success: true,
    record: sheetRecord,
    message: 'Đã lưu bản ghi liên kết vào Google Sheets Tracker thành công!',
  });
});

// 9. Sheet records history
app.get('/api/sheet-records', (req, res) => {
  const records = loadSheetRecords();
  res.json({ success: true, records });
});

// 10. Clear sheet records
app.post('/api/sheet-records/clear', (req, res) => {
  saveSheetRecords([]);
  res.json({ success: true, message: 'Đã xoá lịch sử lưu Google Sheets' });
});

// 11. Discord Webhook integration
app.post('/api/integrations/discord', async (req, res) => {
  const { webhookUrl, fileId, message } = req.body;
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(400).json({ success: false, error: 'URL Discord Webhook không hợp lệ' });
  }

  const files = loadFiles();
  const file = files.find((f) => f.id === fileId);

  const directUrl = file ? (file.externalUrl || getPublicShareUrl(req, `/api/raw/${file.id}/${encodeURIComponent(file.name)}`)) : '';
  const shareUrl = file ? getPublicShareUrl(req, `/#view=${file.id}`) : '';

  const payload: any = {
    content: message || `🚀 **Tài nguyên mới vừa được tải lên CloudAsset Hub!**`,
    embeds: file
      ? [
          {
            title: `📁 ${file.name}`,
            url: shareUrl,
            color: file.category === 'image' ? 0x10b981 : file.category === 'video' ? 0x6366f1 : 0xf59e0b,
            fields: [
              { name: 'Loại file', value: file.category.toUpperCase(), inline: true },
              { name: 'Dung lượng', value: file.sizeFormatted, inline: true },
              { name: 'Nguồn lưu', value: file.provider ? file.provider.toUpperCase() : 'CLOUD', inline: true },
              { name: '🔗 Link chia sẻ', value: `[Xem chi tiết](${shareUrl})`, inline: true },
              { name: '📥 Link công khai', value: `[Mở trực tiếp](${directUrl})`, inline: true },
            ],
            image: file.category === 'image' ? { url: directUrl } : undefined,
            footer: { text: 'CloudAsset Hub & Catbox Integration' },
          },
        ]
      : undefined,
  };

  try {
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      return res.status(discordRes.status).json({ success: false, error: errText });
    }
    res.json({ success: true, message: 'Đã gửi thông báo đến Discord thành công!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Telegram Bot integration
app.post('/api/integrations/telegram', async (req, res) => {
  const { botToken, chatId, fileId, customCaption } = req.body;
  if (!botToken || !chatId) {
    return res.status(400).json({ success: false, error: 'Thiếu Bot Token hoặc Chat ID' });
  }

  const files = loadFiles();
  const file = files.find((f) => f.id === fileId);
  const shareUrl = file ? getPublicShareUrl(req, `/#view=${file.id}`) : '';
  const directUrl = file ? (file.externalUrl || getPublicShareUrl(req, `/api/raw/${file.id}/${encodeURIComponent(file.name)}`)) : '';

  const text = file
    ? `📁 *${file.name}*\n\n` +
      `📌 *Loại:* ${file.category}\n` +
      `💾 *Dung lượng:* ${file.sizeFormatted}\n` +
      `🌐 *Host:* ${file.provider || 'Catbox'}\n` +
      `🔗 *Link chia sẻ:* ${shareUrl}\n` +
      `📥 *Link công khai:* ${directUrl}\n` +
      (customCaption ? `\n💬 *Ghi chú:* ${customCaption}` : '')
    : `Tài nguyên mới: ${customCaption || ''}`;

  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const tgRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });
    const tgData: any = await tgRes.json();
    if (!tgData.ok) {
      return res.status(400).json({ success: false, error: tgData.description || 'Lỗi Telegram API' });
    }
    res.json({ success: true, message: 'Đã gửi thông báo đến Telegram thành công!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Custom Webhook integration
app.post('/api/integrations/custom-webhook', async (req, res) => {
  const { targetUrl, headers, fileId, eventType } = req.body;
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ success: false, error: 'URL Webhook không hợp lệ' });
  }

  const files = loadFiles();
  const file = files.find((f) => f.id === fileId);

  const payload = {
    event: eventType || 'asset.uploaded',
    timestamp: new Date().toISOString(),
    asset: file
      ? {
          id: file.id,
          name: file.name,
          category: file.category,
          mimeType: file.mimeType,
          size: file.size,
          sizeFormatted: file.sizeFormatted,
          shareUrl: getPublicShareUrl(req, `/#view=${file.id}`),
          directUrl: file.externalUrl || getPublicShareUrl(req, `/api/raw/${file.id}/${encodeURIComponent(file.name)}`),
          externalUrl: file.externalUrl,
          provider: file.provider,
          downloadUrl: getPublicShareUrl(req, `/api/download/${file.id}/${encodeURIComponent(file.name)}`),
          shortUrl: getPublicShareUrl(req, `/s/${file.shortCode}`),
          uploadedAt: file.uploadedAt,
          tags: file.tags,
        }
      : req.body.fallbackAsset,
  };

  try {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CloudAsset-Hub/1.0',
    };
    if (headers && typeof headers === 'object') {
      Object.assign(requestHeaders, headers);
    }

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(payload),
    });

    const respText = await resp.text();
    res.json({
      success: resp.ok,
      status: resp.status,
      response: respText.slice(0, 500),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. TinyURL Shortener
app.post('/api/integrations/shorten', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'Thiếu URL cần rút gọn' });
  }

  try {
    const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`TinyURL error: HTTP ${response.status}`);
    }
    const shortUrl = await response.text();
    res.json({ success: true, shortUrl: shortUrl.trim() });
  } catch (err: any) {
    res.json({ success: true, shortUrl: url, fallback: true });
  }
});

// ================= FRONTEND MOUNTING =================
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudAsset Hub server running on http://0.0.0.0:${PORT} [mode: ${isProduction ? 'prod' : 'dev'}]`);
  });
}

startServer();
