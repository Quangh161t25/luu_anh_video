import QRCode from 'qrcode';
import { IntegrationsConfig, GoogleSheetsConfig, SheetRecord, StoredFile, ApiLogEntry, StorageProvider } from '../types';

const CONFIG_STORAGE_KEY = 'cloudasset_integrations_config_v1';
const LOGS_STORAGE_KEY = 'cloudasset_api_logs_v1';

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

export async function fetchFiles(): Promise<StoredFile[]> {
  const res = await fetch('/api/files');
  if (!res.ok) throw new Error('Không thể tải danh sách tài nguyên');
  const data = await res.json();
  return data.files || [];
}

export async function fetchFileById(id: string): Promise<StoredFile> {
  const res = await fetch(`/api/files/${id}`);
  if (!res.ok) throw new Error('Không tìm thấy file');
  const data = await res.json();
  return data.file;
}

export async function deleteFileFromServer(id: string): Promise<void> {
  const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Lỗi khi xoá file trên máy chủ');
}

export async function fetchSheetRecords(): Promise<SheetRecord[]> {
  const res = await fetch('/api/sheet-records');
  if (!res.ok) throw new Error('Không thể tải lịch sử Google Sheets');
  const data = await res.json();
  return data.records || [];
}

export async function clearSheetRecordsFromServer(): Promise<void> {
  const res = await fetch('/api/sheet-records/clear', { method: 'POST' });
  if (!res.ok) throw new Error('Lỗi khi xoá lịch sử Google Sheets');
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

// Upload file to server & Catbox
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
  const base64 = await fileToBase64(file);
  const cfg = loadIntegrationsConfig().catbox;
  const provider = options?.provider || cfg.defaultProvider || 'catbox';
  const userhash = options?.userhash ?? cfg.userhash;
  const litterboxExpiry = options?.litterboxExpiry || cfg.litterboxExpiry || '72h';

  // Extract dimensions if image
  let dimensions: { width: number; height: number } | undefined = undefined;
  if (file.type.startsWith('image/')) {
    dimensions = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(undefined);
      img.src = base64;
    });
  }

  // Extract video duration if video
  let duration: number | undefined = undefined;
  if (file.type.startsWith('video/')) {
    duration = await new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(Math.round(video.duration));
      video.onerror = () => resolve(undefined);
      video.src = base64;
    });
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      base64,
      mimeType: file.type,
      category: options?.category,
      tags: options?.tags || [],
      dimensions,
      duration,
      provider,
      userhash,
      litterboxExpiry,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Lỗi upload không xác định' }));
    throw new Error(err.error || `Upload failed with HTTP ${res.status}`);
  }

  const result = await res.json();
  const uploadedFile: StoredFile = result.file;

  if (result.externalUrl) {
    const serviceName: ApiLogEntry['service'] = 
      result.provider === 'uguu' ? 'Uguu.se' :
      result.provider === 'tmpfiles' ? 'TmpFiles' :
      result.provider === 'litterbox' ? 'Litterbox' :
      result.provider === '0x0' ? '0x0.st' : 'Catbox';

    addApiLog({
      service: serviceName,
      target: result.externalUrl,
      fileName: uploadedFile.name,
      status: 'success',
      httpCode: 200,
      message: `Đã tải lên và tạo link công khai toàn cầu (${serviceName}): ${result.externalUrl}`,
      payload: { provider: result.provider, externalUrl: result.externalUrl },
    });
  }

  return uploadedFile;
}

// Sync to Google Sheets
export async function syncToGoogleSheets(fileId: string, customConfig?: GoogleSheetsConfig): Promise<{ success: boolean; message: string; record?: SheetRecord }> {
  const config = customConfig || loadIntegrationsConfig().googleSheets;

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

    const data = await res.json();

    addApiLog({
      service: 'Google Sheets',
      target: config.webhookUrl ? 'Apps Script Webhook' : 'Internal Sheet Tracker',
      status: data.success ? 'success' : 'failed',
      httpCode: res.status,
      message: data.success ? 'Ghi link thành công vào Google Sheet' : (data.error || 'Lỗi gửi Google Sheet'),
      payload: { fileId, webhookUrl: config.webhookUrl ? '***' : undefined },
    });

    if (!data.success) {
      throw new Error(data.error || 'Lưu Google Sheets thất bại');
    }

    return {
      success: true,
      message: data.message || 'Đã lưu liên kết vào Google Sheets!',
      record: data.record,
    };
  } catch (err: any) {
    addApiLog({
      service: 'Google Sheets',
      target: config.webhookUrl ? 'Apps Script Webhook' : 'Internal Sheet Tracker',
      status: 'failed',
      message: err.message,
      payload: { fileId },
    });
    throw err;
  }
}

// Send to Discord
export async function sendToDiscord(fileId: string, message?: string, customWebhook?: string): Promise<void> {
  const config = loadIntegrationsConfig().discord;
  const webhookUrl = customWebhook || config.webhookUrl;
  if (!webhookUrl) {
    throw new Error('Chưa cấu hình URL Discord Webhook');
  }

  const res = await fetch('/api/integrations/discord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl, fileId, message }),
  });

  const data = await res.json();
  addApiLog({
    service: 'Discord',
    target: webhookUrl.slice(0, 35) + '...',
    status: data.success ? 'success' : 'failed',
    httpCode: res.status,
    message: data.success ? 'Đã gửi thông báo đến kênh Discord' : (data.error || 'Lỗi gửi Discord'),
    payload: { fileId },
  });

  if (!data.success) {
    throw new Error(data.error || 'Lỗi khi gửi Discord');
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

  const res = await fetch('/api/integrations/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken, chatId, fileId, customCaption }),
  });

  const data = await res.json();
  addApiLog({
    service: 'Telegram',
    target: `ChatID: ${chatId}`,
    status: data.success ? 'success' : 'failed',
    httpCode: res.status,
    message: data.success ? 'Đã gửi file đến Telegram' : (data.error || 'Lỗi gửi Telegram'),
    payload: { fileId, chatId },
  });

  if (!data.success) {
    throw new Error(data.error || 'Lỗi khi gửi Telegram');
  }
}

// Send to Custom Webhook
export async function sendToCustomWebhook(fileId: string, eventType?: string): Promise<void> {
  const config = loadIntegrationsConfig().customWebhook;
  if (!config.targetUrl) {
    throw new Error('Chưa cấu hình Target URL cho Custom Webhook');
  }

  const headers: Record<string, string> = {};
  if (config.customHeaderKey && config.customHeaderValue) {
    headers[config.customHeaderKey] = config.customHeaderValue;
  }
  if (config.secretToken) {
    headers['Authorization'] = `Bearer ${config.secretToken}`;
  }

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

  const data = await res.json();
  addApiLog({
    service: 'Custom Webhook',
    target: config.targetUrl.slice(0, 30) + '...',
    status: data.success ? 'success' : 'failed',
    httpCode: res.status,
    message: data.success ? `Webhook phản hồi HTTP ${data.status}` : (data.error || 'Lỗi gọi Webhook'),
    payload: { fileId, status: data.status },
  });

  if (!data.success) {
    throw new Error(data.error || `Webhook trả về mã lỗi HTTP ${data.status}`);
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
