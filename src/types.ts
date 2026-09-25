export type FileCategory = 'image' | 'video' | 'text' | 'document' | 'other';
export type StorageProvider = 'uguu' | 'catbox' | 'tmpfiles' | 'litterbox' | '0x0' | 'local';

export interface StoredFile {
  id: string;
  name: string;
  category: FileCategory;
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
  shareUrl: string;
  directUrl: string;
  downloadUrl: string;
  shortUrl: string;
  externalUrl?: string;
  provider?: StorageProvider;
}

export interface SheetRecord {
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

export interface CatboxConfig {
  enabled: boolean;
  autoUploadToCatbox: boolean;
  userhash?: string;
  defaultProvider: StorageProvider;
  litterboxExpiry: '1h' | '12h' | '24h' | '72h';
}

export interface GoogleSheetsConfig {
  enabled: boolean;
  autoSyncOnUpload: boolean;
  webhookUrl: string;
  spreadsheetId?: string;
  sheetName?: string;
  lastTestSuccess?: boolean;
  lastTestMessage?: string;
}

export interface DiscordConfig {
  enabled: boolean;
  autoSyncOnUpload: boolean;
  webhookUrl: string;
  channelName?: string;
}

export interface TelegramConfig {
  enabled: boolean;
  autoSyncOnUpload: boolean;
  botToken: string;
  chatId: string;
}

export interface CustomWebhookConfig {
  enabled: boolean;
  autoSyncOnUpload: boolean;
  targetUrl: string;
  secretToken?: string;
  customHeaderKey?: string;
  customHeaderValue?: string;
}

export interface IntegrationsConfig {
  catbox: CatboxConfig;
  googleSheets: GoogleSheetsConfig;
  discord: DiscordConfig;
  telegram: TelegramConfig;
  customWebhook: CustomWebhookConfig;
}

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  service: 'Catbox' | 'Uguu.se' | 'TmpFiles' | 'Litterbox' | '0x0.st' | 'Google Sheets' | 'Discord' | 'Telegram' | 'Custom Webhook' | 'TinyURL';
  target: string;
  fileName?: string;
  status: 'success' | 'failed' | 'pending';
  httpCode?: number;
  message: string;
  payload?: any;
}
