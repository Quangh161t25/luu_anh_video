import QRCode from 'qrcode';
import { IntegrationsConfig, GoogleSheetsConfig, SheetRecord, StoredFile, ApiLogEntry, StorageProvider } from '../types';

const CONFIG_STORAGE_KEY = 'cloudasset_integrations_config_v1';
const LOGS_STORAGE_KEY = 'cloudasset_api_logs_v1';
const FILES_STORAGE_KEY = 'cloudasset_files_v1';
const SHEET_RECORDS_STORAGE_KEY = 'cloudasset_sheet_records_v1';

export const DEFAULT_INTEGRATIONS_CONFIG: IntegrationsConfig = {
  catbox: {
    enabled: true,
    autoUploadToCatbox: true,
    userhash: '',
    defaultProvider: 'catbox',
    litterboxExpiry: '72h',
  },
  googleSheets: {
    enabled: true,
    autoSyncOnUpload: true,
    webhookUrl: '',
    spreadsheetId: '',
    sheetName: 'Assets Tracker',
  },
  discord: {
    enabled: false,
    autoSyncOnUpload: false,
    webhookUrl: '',
    channelName: 'General',
  },
  telegram: {
    enabled: false,
    autoSyncOnUpload: false,
    botToken: '',
    chatId: '',
  },
  customWebhook: {
    enabled: false,
    autoSyncOnUpload: false,
    targetUrl: '',
    secretToken: '',
    customHeaderKey: 'X-Webhook-Secret',
    customHeaderValue: '',
  },
};

export function loadIntegrationsConfig(): IntegrationsConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_INTEGRATIONS_CONFIG,
        ...parsed,
        catbox: { ...DEFAULT_INTEGRATIONS_CONFIG.catbox, ...(parsed.catbox || {}) },
        googleSheets: { ...DEFAULT_INTEGRATIONS_CONFIG.googleSheets, ...(parsed.googleSheets || {}) },
        discord: { ...DEFAULT_INTEGRATIONS_CONFIG.discord, ...(parsed.discord || {}) },
        telegram: { ...DEFAULT_INTEGRATIONS_CONFIG.telegram, ...(parsed.telegram || {}) },
        customWebhook: { ...DEFAULT_INTEGRATIONS_CONFIG.customWebhook, ...(parsed.customWebhook || {}) },
      };
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return DEFAULT_INTEGRATIONS_CONFIG;
}

export function saveIntegrationsConfig(config: IntegrationsConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

export function loadApiLogs(): ApiLogEntry[] {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading api logs:', e);
  }
  return [];
}

export function addApiLog(log: Omit<ApiLogEntry, 'id' | 'timestamp'>) {
  try {
    const logs = loadApiLogs();
    const newLog: ApiLogEntry = {
      ...log,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    // Keep last 100 logs
    const trimmed = logs.slice(0, 100);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('cloudasset:log_added', { detail: newLog }));
  } catch (e) {
    console.error('Error adding api log:', e);
  }
}

export function clearApiLogs() {
  localStorage.removeItem(LOGS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('cloudasset:logs_cleared'));
}

export function getLocalFiles(): StoredFile[] {
  try {
    const raw = localStorage.getItem(FILES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading local files:', e);
  }
  return [];
}

export function saveLocalFiles(files: StoredFile[]) {
  try {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
  } catch (e) {
    console.error('Error saving local files:', e);
  }
}

export async function fetchFiles(): Promise<StoredFile[]> {
  const localFiles = getLocalFiles();

  try {
    const res = await fetch('/api/files');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        // Merge server and local storage
        const map = new Map<string, StoredFile>();
        data.files.forEach((f: StoredFile) => map.set(f.id, f));
        localFiles.forEach((f) => {
          if (!map.has(f.id)) map.set(f.id, f);
        });
        const merged = Array.from(map.values());
        saveLocalFiles(merged);
        return merged;
      }
    }
  } catch (e) {
    // Backend API not reachable (e.g. running as static site on Vercel)
  }

  return localFiles;
}

export async function fetchFileById(id: string): Promise<StoredFile> {
  const files = await fetchFiles();
  const file = files.find((f) => f.id === id || f.shortCode === id);
  if (file) return file;

  try {
    const res = await fetch(`/api/files/${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.file) return data.file;
    }
  } catch (e) {}

  throw new Error('Không tìm thấy tệp');
}

export async function deleteFileFromServer(id: string): Promise<void> {
  const localFiles = getLocalFiles().filter((f) => f.id !== id);
  saveLocalFiles(localFiles);

  try {
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
  } catch (e) {
    // Ignore server error if on static hosting
  }
}

export async function fetchSheetRecords(): Promise<SheetRecord[]> {
  let localRecords: SheetRecord[] = [];
  try {
    const raw = localStorage.getItem(SHEET_RECORDS_STORAGE_KEY);
    if (raw) localRecords = JSON.parse(raw);
  } catch (e) {}

  try {
    const res = await fetch('/api/sheet-records');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        const map = new Map<string, SheetRecord>();
        data.records.forEach((r: SheetRecord) => map.set(r.id, r));
        localRecords.forEach((r) => {
          if (!map.has(r.id)) map.set(r.id, r);
        });
        const merged = Array.from(map.values());
        localStorage.setItem(SHEET_RECORDS_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (e) {}

  return localRecords;
}

export async function clearSheetRecordsFromServer(): Promise<void> {
  localStorage.removeItem(SHEET_RECORDS_STORAGE_KEY);
  try {
    await fetch('/api/sheet-records/clear', { method: 'POST' });
  } catch (e) {}
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Convert file to Base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// Direct Client-Side Cloud Uploaders (100% compatible with Vercel, no size limitations)

async function uploadDirectUguu(file: File): Promise<string> {
  const form = new FormData();
  form.append('files[]', file, file.name);

  const res = await fetch('https://uguu.se/upload.php', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`Uguu HTTP error ${res.status}`);
  const data = await res.json();
  if (data.success && data.files && data.files[0]?.url) {
    return data.files[0].url;
  }
  throw new Error(`Uguu upload failed: ${JSON.stringify(data)}`);
}

async function uploadDirectTmpFiles(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file, file.name);

  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`TmpFiles HTTP error ${res.status}`);
  const data = await res.json();
  if (data.status === 'success' && data.data?.url) {
    return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  }
  throw new Error(`TmpFiles upload failed: ${JSON.stringify(data)}`);
}

async function uploadDirectCatbox(file: File, userhash?: string): Promise<string> {
  // 1. Try our Catbox API proxy (/api/catbox) which avoids browser CORS completely
  try {
    const res = await fetch('/api/catbox', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-filename': encodeURIComponent(file.name),
        'x-userhash': userhash || '',
        'x-reqtype': 'fileupload',
      },
      body: file,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
    }
  } catch (proxyErr) {
    console.warn('Catbox API proxy failed, trying direct browser request:', proxyErr);
  }

  // 2. Direct browser upload fallback
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  if (userhash && userhash.trim()) {
    form.append('userhash', userhash.trim());
  }
  form.append('fileToUpload', file, file.name);

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
  });

  const text = (await res.text()).trim();
  if (res.ok && text.startsWith('http')) {
    return text;
  }
  throw new Error(`Catbox upload failed: ${text}`);
}

async function uploadDirectLitterbox(file: File, time = '72h'): Promise<string> {
  // 1. Try our Catbox API proxy (/api/catbox)
  try {
    const res = await fetch('/api/catbox', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-filename': encodeURIComponent(file.name),
        'x-reqtype': 'litterbox',
        'x-time': time,
      },
      body: file,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
    }
  } catch (proxyErr) {}

  // 2. Direct browser upload fallback
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('time', time);
  form.append('fileToUpload', file, file.name);

  const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    body: form,
  });

  const text = (await res.text()).trim();
  if (res.ok && text.startsWith('http')) {
    return text;
  }
  throw new Error(`Litterbox upload failed: ${text}`);
}

// Upload file to server & Cloud Storage with smart client-side direct fallback
export async function uploadFileToServer(
  file: File,
  options?: { 
    tags?: string[]; 
    category?: string;
    provider?: StorageProvider;
    userhash?: string;
    litterboxExpiry?: '1h' | '12h' | '24h' | '72h';
  }
): Promise<StoredFile> {
  const cfg = loadIntegrationsConfig().catbox;
  const requestedProvider = options?.provider || cfg.defaultProvider || 'catbox';
  const userhash = options?.userhash ?? cfg.userhash;
  const litterboxExpiry = options?.litterboxExpiry || cfg.litterboxExpiry || '72h';

  // Determine category
  let detectedCategory: StoredFile['category'] = (options?.category as any) || 'other';
  const lowerMime = (file.type || '').toLowerCase();
  const lowerName = file.name.toLowerCase();
  if (lowerMime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].some((ext) => lowerName.endsWith(ext))) {
    detectedCategory = 'image';
  } else if (lowerMime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'].some((ext) => lowerName.endsWith(ext))) {
    detectedCategory = 'video';
  } else if (lowerMime.startsWith('text/') || ['.txt', '.md', '.json', '.csv', '.log', '.js', '.ts', '.html', '.css', '.py', '.sh'].some((ext) => lowerName.endsWith(ext))) {
    detectedCategory = 'text';
  } else {
    detectedCategory = 'document';
  }

  // Extract dimensions or duration if possible
  let dimensions: { width: number; height: number } | undefined = undefined;
  let duration: number | undefined = undefined;
  let textSnippet: string | undefined = undefined;
  let lineCount: number | undefined = undefined;
  let wordCount: number | undefined = undefined;

  if (detectedCategory === 'text') {
    try {
      const text = await file.text();
      textSnippet = text.slice(0, 1000);
      const lines = text.split(/\r\n|\r|\n/);
      lineCount = lines.length;
      wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    } catch (e) {}
  }

  // Attempt Direct Cloud Upload (Uguu / Catbox / TmpFiles / Litterbox)
  let externalUrl: string | undefined = undefined;
  let actualProvider: StorageProvider = requestedProvider;

  if (requestedProvider === 'catbox') {
    let uploaded = false;
    // 1. Try Catbox direct
    try {
      externalUrl = await uploadDirectCatbox(file, userhash);
      actualProvider = 'catbox';
      uploaded = true;
    } catch (catboxErr: any) {
      console.warn('Catbox direct upload failed, trying Uguu CDN:', catboxErr.message);
    }
    // 2. Fallback to Uguu CDN
    if (!uploaded) {
      try {
        externalUrl = await uploadDirectUguu(file);
        actualProvider = 'uguu';
        uploaded = true;
      } catch (uguuErr: any) {
        console.warn('Uguu fallback failed, trying TmpFiles:', uguuErr.message);
        try {
          externalUrl = await uploadDirectTmpFiles(file);
          actualProvider = 'tmpfiles';
          uploaded = true;
        } catch (tmpErr) {}
      }
    }
  } else if (requestedProvider === 'uguu') {
    try {
      externalUrl = await uploadDirectUguu(file);
      actualProvider = 'uguu';
    } catch (err: any) {
      console.warn('Uguu direct failed, trying TmpFiles:', err.message);
      try {
        externalUrl = await uploadDirectTmpFiles(file);
        actualProvider = 'tmpfiles';
      } catch (tmpErr) {}
    }
  } else if (requestedProvider === 'tmpfiles') {
    try {
      externalUrl = await uploadDirectTmpFiles(file);
      actualProvider = 'tmpfiles';
    } catch (err: any) {
      console.warn('TmpFiles direct failed, trying Uguu:', err.message);
      try {
        externalUrl = await uploadDirectUguu(file);
        actualProvider = 'uguu';
      } catch (uguuErr) {}
    }
  } else if (requestedProvider === 'litterbox') {
    try {
      externalUrl = await uploadDirectLitterbox(file, litterboxExpiry);
      actualProvider = 'litterbox';
    } catch (err: any) {
      console.warn('Litterbox direct failed, trying Uguu:', err.message);
      try {
        externalUrl = await uploadDirectUguu(file);
        actualProvider = 'uguu';
      } catch (uguuErr) {}
    }
  }

  // If client-side cloud upload did not succeed (e.g. offline/local provider selected), try local server /api/upload
  if (!externalUrl && requestedProvider === 'local') {
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          base64,
          mimeType: file.type,
          category: detectedCategory,
          tags: options?.tags || [],
          dimensions,
          duration,
          provider: 'local',
        }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.file) {
          const serverFile = result.file;
          const currentLocal = getLocalFiles();
          saveLocalFiles([serverFile, ...currentLocal.filter((f) => f.id !== serverFile.id)]);
          return serverFile;
        }
      }
    } catch (e) {}
  }

  // Generate unique file ID & short code
  const id = (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
  const shortCode = Math.random().toString(36).substring(2, 8);
  const directLink = externalUrl || URL.createObjectURL(file);
  const shareLink = `${window.location.origin}/#view=${id}`;

  const newFile: StoredFile = {
    id,
    name: file.name,
    category: detectedCategory,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    sizeFormatted: formatBytes(file.size),
    diskFilename: `${id}_${file.name}`,
    uploadedAt: new Date().toISOString(),
    shortCode,
    tags: options?.tags || [],
    dimensions,
    duration,
    lineCount,
    wordCount,
    textSnippet,
    syncedToGoogleSheet: false,
    externalUrl,
    provider: actualProvider,
    directUrl: directLink,
    shareUrl: shareLink,
    downloadUrl: directLink,
    shortUrl: `${window.location.origin}/#view=${shortCode}`,
  };

  // Save to local storage for immediate persistence on Vercel
  const allFiles = getLocalFiles();
  saveLocalFiles([newFile, ...allFiles.filter((f) => f.id !== newFile.id)]);

  // If backend server is available, notify it in the background
  try {
    fetch('/api/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newFile) }).catch(() => {});
  } catch (e) {}

  if (externalUrl) {
    const serviceName: ApiLogEntry['service'] = 
      actualProvider === 'uguu' ? 'Uguu.se' :
      actualProvider === 'tmpfiles' ? 'TmpFiles' :
      actualProvider === 'litterbox' ? 'Litterbox' :
      actualProvider === '0x0' ? '0x0.st' : 'Catbox';

    addApiLog({
      service: serviceName,
      target: externalUrl,
      fileName: newFile.name,
      status: 'success',
      httpCode: 200,
      message: `Tạo link công khai trực tiếp (${serviceName}): ${externalUrl}`,
      payload: { provider: actualProvider, externalUrl },
    });
  }

  return newFile;
}

// Sync to Google Sheets
export async function syncToGoogleSheets(fileId: string, customConfig?: GoogleSheetsConfig): Promise<{ success: boolean; message: string; record?: SheetRecord }> {
  const config = customConfig || loadIntegrationsConfig().googleSheets;
  const files = await fetchFiles();
  const file = files.find((f) => f.id === fileId);

  const filePayload = file
    ? {
        fileId: file.id,
        fileName: file.name,
        category: file.category,
        mimeType: file.mimeType,
        fileSizeFormatted: file.sizeFormatted,
        fileSizeBytes: file.size,
        shareUrl: file.shareUrl,
        directUrl: file.externalUrl || file.directUrl,
        externalUrl: file.externalUrl || '',
        provider: file.provider || 'local',
        downloadUrl: file.downloadUrl,
        shortUrl: file.shortUrl,
        uploadedAt: file.uploadedAt,
        tags: file.tags.join(', '),
      }
    : null;

  const recordId = (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2));
  const timestamp = new Date().toISOString();

  // Try server endpoint first if available
  try {
    const res = await fetch('/api/integrations/google-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        webhookUrl: config.webhookUrl || undefined,
        spreadsheetId: config.spreadsheetId || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        addApiLog({
          service: 'Google Sheets',
          target: config.webhookUrl ? 'Apps Script Webhook' : 'Internal Sheet Tracker',
          status: 'success',
          httpCode: res.status,
          message: 'Ghi link thành công vào Google Sheet',
          payload: { fileId },
        });
        return data;
      }
    }
  } catch (e) {}

  // Client-side execution for Vercel static deployment
  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filePayload || { fileId }),
      });
    } catch (err: any) {
      console.warn('Apps Script direct POST notice:', err);
    }
  }

  const sheetRecord: SheetRecord = {
    id: recordId,
    fileId: file?.id || fileId || 'manual',
    timestamp,
    fileName: file?.name || 'File',
    category: file?.category || 'other',
    fileSize: file?.sizeFormatted || '0 B',
    shareUrl: file?.shareUrl || `${window.location.origin}/#view=${fileId}`,
    directUrl: file?.externalUrl || file?.directUrl || '',
    externalUrl: file?.externalUrl,
    status: 'synced',
    method: config.webhookUrl ? 'Apps Script Webhook' : 'Direct Sheet Record Engine',
  };

  const records = await fetchSheetRecords();
  const updatedRecords = [sheetRecord, ...records.filter((r) => r.id !== sheetRecord.id)];
  localStorage.setItem(SHEET_RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));

  if (file) {
    file.syncedToGoogleSheet = true;
    file.googleSheetSyncTime = timestamp;
    const allFiles = getLocalFiles();
    saveLocalFiles(allFiles.map((f) => (f.id === file.id ? { ...f, syncedToGoogleSheet: true, googleSheetSyncTime: timestamp } : f)));
  }

  addApiLog({
    service: 'Google Sheets',
    target: config.webhookUrl ? 'Apps Script Webhook' : 'Internal Sheet Tracker',
    status: 'success',
    httpCode: 200,
    message: 'Đã lưu liên kết vào Google Sheets!',
    payload: { fileId },
  });

  return {
    success: true,
    message: 'Đã lưu liên kết vào Google Sheets thành công!',
    record: sheetRecord,
  };
}

// Send to Discord
export async function sendToDiscord(fileId: string, message?: string, customWebhook?: string): Promise<void> {
  const config = loadIntegrationsConfig().discord;
  const webhookUrl = customWebhook || config.webhookUrl;
  if (!webhookUrl) {
    throw new Error('Chưa cấu hình URL Discord Webhook');
  }

  const files = await fetchFiles();
  const file = files.find((f) => f.id === fileId);
  const directUrl = file ? (file.externalUrl || file.directUrl) : '';
  const shareUrl = file ? file.shareUrl : '';

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
              { name: 'Nguồn lưu', value: (file.provider || 'CLOUD').toUpperCase(), inline: true },
              { name: '🔗 Link chia sẻ', value: `[Xem chi tiết](${shareUrl})`, inline: true },
              { name: '📥 Link công khai', value: `[Mở trực tiếp](${directUrl})`, inline: true },
            ],
            image: file.category === 'image' ? { url: directUrl } : undefined,
            footer: { text: 'CloudAsset Hub' },
          },
        ]
      : undefined,
  };

  try {
    const res = await fetch('/api/integrations/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, fileId, message }),
    });
    if (res.ok) {
      addApiLog({
        service: 'Discord',
        target: webhookUrl.slice(0, 35) + '...',
        status: 'success',
        httpCode: 200,
        message: 'Đã gửi thông báo đến kênh Discord',
        payload: { fileId },
      });
      return;
    }
  } catch (e) {}

  // Direct client-side POST to Discord
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  addApiLog({
    service: 'Discord',
    target: webhookUrl.slice(0, 35) + '...',
    status: res.ok ? 'success' : 'failed',
    httpCode: res.status,
    message: res.ok ? 'Đã gửi thông báo đến kênh Discord' : 'Lỗi gửi Discord',
    payload: { fileId },
  });

  if (!res.ok) {
    throw new Error(`Discord Webhook lỗi HTTP ${res.status}`);
  }
}

// Send to Telegram
export async function sendToTelegram(fileId: string, customCaption?: string, customBotToken?: string, customChatId?: string): Promise<void> {
  const config = loadIntegrationsConfig().telegram;
  const botToken = customBotToken || config.botToken;
  const chatId = customChatId || config.chatId;

  if (!botToken || !chatId) {
    throw new Error('Chưa cấu hình Bot Token hoặc Chat ID của Telegram');
  }

  const files = await fetchFiles();
  const file = files.find((f) => f.id === fileId);
  const shareUrl = file ? file.shareUrl : '';
  const directUrl = file ? (file.externalUrl || file.directUrl) : '';

  const text = file
    ? `📁 *${file.name}*\n\n` +
      `📌 *Loại:* ${file.category}\n` +
      `💾 *Dung lượng:* ${file.sizeFormatted}\n` +
      `🌐 *Host:* ${(file.provider || 'Cloud').toUpperCase()}\n` +
      `🔗 *Link chia sẻ:* ${shareUrl}\n` +
      `📥 *Link công khai:* ${directUrl}\n` +
      (customCaption ? `\n💬 *Ghi chú:* ${customCaption}` : '')
    : `Tài nguyên mới: ${customCaption || ''}`;

  try {
    const res = await fetch('/api/integrations/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId, fileId, customCaption }),
    });
    if (res.ok) {
      addApiLog({
        service: 'Telegram',
        target: `ChatID: ${chatId}`,
        status: 'success',
        httpCode: 200,
        message: 'Đã gửi file đến Telegram',
        payload: { fileId, chatId },
      });
      return;
    }
  } catch (e) {}

  // Direct client-side POST to Telegram Bot API
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(telegramUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  const tgData: any = await res.json().catch(() => ({}));
  const isOk = res.ok && tgData.ok;

  addApiLog({
    service: 'Telegram',
    target: `ChatID: ${chatId}`,
    status: isOk ? 'success' : 'failed',
    httpCode: res.status,
    message: isOk ? 'Đã gửi file đến Telegram' : (tgData.description || 'Lỗi gửi Telegram'),
    payload: { fileId, chatId },
  });

  if (!isOk) {
    throw new Error(tgData.description || `Lỗi Telegram HTTP ${res.status}`);
  }
}

// Send to Custom Webhook
export async function sendToCustomWebhook(fileId: string, eventType?: string): Promise<void> {
  const config = loadIntegrationsConfig().customWebhook;
  if (!config.targetUrl) {
    throw new Error('Chưa cấu hình Target URL cho Custom Webhook');
  }

  const files = await fetchFiles();
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
          shareUrl: file.shareUrl,
          directUrl: file.externalUrl || file.directUrl,
          externalUrl: file.externalUrl,
          provider: file.provider,
          downloadUrl: file.downloadUrl,
          shortUrl: file.shortUrl,
          uploadedAt: file.uploadedAt,
          tags: file.tags,
        }
      : { id: fileId },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.customHeaderKey && config.customHeaderValue) {
    headers[config.customHeaderKey] = config.customHeaderValue;
  }
  if (config.secretToken) {
    headers['Authorization'] = `Bearer ${config.secretToken}`;
  }

  try {
    const res = await fetch('/api/integrations/custom-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: config.targetUrl,
        headers,
        fileId,
        eventType: eventType || 'asset.uploaded',
      }),
    });
    if (res.ok) {
      addApiLog({
        service: 'Custom Webhook',
        target: config.targetUrl.slice(0, 30) + '...',
        status: 'success',
        httpCode: 200,
        message: 'Webhook gửi thành công',
        payload: { fileId },
      });
      return;
    }
  } catch (e) {}

  // Direct client fetch
  const res = await fetch(config.targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  addApiLog({
    service: 'Custom Webhook',
    target: config.targetUrl.slice(0, 30) + '...',
    status: res.ok ? 'success' : 'failed',
    httpCode: res.status,
    message: res.ok ? `Webhook phản hồi HTTP ${res.status}` : 'Lỗi gọi Webhook',
    payload: { fileId, status: res.status },
  });

  if (!res.ok) {
    throw new Error(`Webhook trả về mã lỗi HTTP ${res.status}`);
  }
}

// Auto dispatch all enabled integrations after upload
export async function autoDispatchIntegrations(file: StoredFile, config: IntegrationsConfig): Promise<{
  sheetsSuccess?: boolean;
  sheetsError?: string;
  discordSuccess?: boolean;
  telegramSuccess?: boolean;
  webhookSuccess?: boolean;
}> {
  const result: any = {};

  // 1. Google Sheets (Highest Priority according to User Request)
  if (config.googleSheets.enabled && config.googleSheets.autoSyncOnUpload) {
    try {
      await syncToGoogleSheets(file.id, config.googleSheets);
      result.sheetsSuccess = true;
    } catch (e: any) {
      result.sheetsSuccess = false;
      result.sheetsError = e.message;
    }
  }

  // 2. Discord
  if (config.discord.enabled && config.discord.autoSyncOnUpload && config.discord.webhookUrl) {
    try {
      await sendToDiscord(file.id);
      result.discordSuccess = true;
    } catch (e) {
      result.discordSuccess = false;
    }
  }

  // 3. Telegram
  if (config.telegram.enabled && config.telegram.autoSyncOnUpload && config.telegram.botToken && config.telegram.chatId) {
    try {
      await sendToTelegram(file.id);
      result.telegramSuccess = true;
    } catch (e) {
      result.telegramSuccess = false;
    }
  }

  // 4. Custom Webhook
  if (config.customWebhook.enabled && config.customWebhook.autoSyncOnUpload && config.customWebhook.targetUrl) {
    try {
      await sendToCustomWebhook(file.id);
      result.webhookSuccess = true;
    } catch (e) {
      result.webhookSuccess = false;
    }
  }

  return result;
}

// Generate QR Code data URL
export async function generateQrCode(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 280,
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
  });
}

// Export sheet records to CSV for Google Sheets
export function exportRecordsToCSV(records: SheetRecord[]) {
  const headers = ['Thời gian', 'Tên File', 'Loại', 'Dung lượng', 'Link Công Khai (Catbox)', 'Link Chia Sẻ', 'Trạng thái', 'Phương thức'];
  const rows = records.map((r) => [
    `"${new Date(r.timestamp).toLocaleString('vi-VN')}"`,
    `"${r.fileName.replace(/"/g, '""')}"`,
    `"${r.category}"`,
    `"${r.fileSize}"`,
    `"${r.externalUrl || r.directUrl}"`,
    `"${r.shareUrl}"`,
    `"${r.status}"`,
    `"${r.method}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Google_Sheets_Assets_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Copy table formatted as TSV for direct Ctrl+V into Google Sheets
export async function copyRecordsToClipboardForSheets(records: SheetRecord[]): Promise<void> {
  const headers = ['Thời gian\tTên File\tLoại\tDung lượng\tLink Công Khai (Catbox)\tLink Chia Sẻ\tTrạng thái'];
  const rows = records.map((r) =>
    [
      new Date(r.timestamp).toLocaleString('vi-VN'),
      r.fileName,
      r.category,
      r.fileSize,
      r.externalUrl || r.directUrl,
      r.shareUrl,
      r.status,
    ].join('\t')
  );

  const tsv = [headers, ...rows].join('\n');
  await navigator.clipboard.writeText(tsv);
}
