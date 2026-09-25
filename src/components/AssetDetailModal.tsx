import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  FileSpreadsheet, 
  QrCode, 
  Share2, 
  Send, 
  Code, 
  FileText, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Calendar, 
  HardDrive, 
  Eye,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { StoredFile, IntegrationsConfig } from '../types';
import { 
  generateQrCode, 
  syncToGoogleSheets, 
  sendToDiscord, 
  sendToTelegram, 
  sendToCustomWebhook 
} from '../utils/api';

interface AssetDetailModalProps {
  file: StoredFile | null;
  onClose: () => void;
  config: IntegrationsConfig;
  onFileUpdated: () => void;
  onOpenSheetsTab: () => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  file,
  onClose,
  config,
  onFileUpdated,
  onOpenSheetsTab,
}) => {
  if (!file) return null;

  const [activeTab, setActiveTab] = useState<'preview' | 'links' | 'sync' | 'qr'>('preview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetSuccessMessage, setSheetSuccessMessage] = useState<string | null>(null);
  const [apiActionMessage, setApiActionMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [isSendingApi, setIsSendingApi] = useState(false);

  useEffect(() => {
    generateQrCode(file.shareUrl).then(setQrDataUrl);
  }, [file.shareUrl]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSyncToSheets = async () => {
    setIsSyncingSheet(true);
    setSheetSuccessMessage(null);
    try {
      const res = await syncToGoogleSheets(file.id);
      setSheetSuccessMessage(res.message);
      onFileUpdated();
    } catch (err: any) {
      alert(`Lỗi đồng bộ Google Sheets: ${err.message}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleSendDiscord = async () => {
    if (!config.discord.webhookUrl) {
      alert('Vui lòng vào tab "Liên Kết API Ngoài" để cài đặt Discord Webhook URL trước.');
      return;
    }
    setIsSendingApi(true);
    try {
      await sendToDiscord(file.id);
      setApiActionMessage({ text: 'Đã gửi thông báo tới Discord thành công! ✓', success: true });
    } catch (e: any) {
      setApiActionMessage({ text: `Lỗi Discord: ${e.message}`, success: false });
    } finally {
      setIsSendingApi(false);
      setTimeout(() => setApiActionMessage(null), 3500);
    }
  };

  const handleSendTelegram = async () => {
    if (!config.telegram.botToken || !config.telegram.chatId) {
      alert('Vui lòng vào tab "Liên Kết API Ngoài" để cài đặt Telegram Bot Token & Chat ID trước.');
      return;
    }
    setIsSendingApi(true);
    try {
      await sendToTelegram(file.id);
      setApiActionMessage({ text: 'Đã gửi thông báo tới Telegram thành công! ✓', success: true });
    } catch (e: any) {
      setApiActionMessage({ text: `Lỗi Telegram: ${e.message}`, success: false });
    } finally {
      setIsSendingApi(false);
      setTimeout(() => setApiActionMessage(null), 3500);
    }
  };

  const handleSendWebhook = async () => {
    if (!config.customWebhook.targetUrl) {
      alert('Vui lòng vào tab "Liên Kết API Ngoài" để cài đặt Target URL Webhook trước.');
      return;
    }
    setIsSendingApi(true);
    try {
      await sendToCustomWebhook(file.id);
      setApiActionMessage({ text: 'Đã kích hoạt Custom Webhook thành công! ✓', success: true });
    } catch (e: any) {
      setApiActionMessage({ text: `Lỗi Webhook: ${e.message}`, success: false });
    } finally {
      setIsSendingApi(false);
      setTimeout(() => setApiActionMessage(null), 3500);
    }
  };

  const markdownEmbed = file.category === 'image'
    ? `![${file.name}](${file.directUrl})`
    : `[📥 Tải ${file.name}](${file.directUrl})`;

  const htmlEmbed = file.category === 'image'
    ? `<img src="${file.directUrl}" alt="${file.name}" style="max-width: 100%;" />`
    : file.category === 'video'
    ? `<video controls width="100%" poster="">\n  <source src="${file.directUrl}" type="${file.mimeType}">\n</video>`
    : `<a href="${file.directUrl}" target="_blank" rel="noopener">${file.name}</a>`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              {file.category === 'image' && <ImageIcon className="w-5 h-5 text-emerald-400" />}
              {file.category === 'video' && <VideoIcon className="w-5 h-5 text-sky-400" />}
              {file.category === 'text' && <FileText className="w-5 h-5 text-amber-400" />}
              {file.category === 'document' && <FileSpreadsheet className="w-5 h-5 text-indigo-400" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-base truncate" title={file.name}>
                {file.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono">{file.sizeFormatted}</span>
                <span>•</span>
                <span className="uppercase font-semibold text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                  {file.category}
                </span>
                <span>•</span>
                <span>{new Date(file.uploadedAt).toLocaleString('vi-VN')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={file.downloadUrl}
              download={file.name}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Tải tệp xuống máy"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-900 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Xem trước</span>
          </button>

          <button
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'links'
                ? 'border-indigo-500 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Các loại liên kết</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'sync'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Google Sheets & API</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'qr'
                ? 'border-indigo-500 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Mã QR</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 flex items-center justify-center min-h-[300px] max-h-[480px] overflow-hidden">
                {file.category === 'image' && (
                  <img
                    src={file.directUrl}
                    alt={file.name}
                    className="max-h-[450px] max-w-full object-contain rounded-lg shadow-lg"
                  />
                )}

                {file.category === 'video' && (
                  <video
                    src={file.directUrl}
                    controls
                    autoPlay={false}
                    className="max-h-[450px] max-w-full rounded-lg shadow-lg"
                  />
                )}

                {file.category === 'text' && (
                  <div className="w-full max-h-[450px] overflow-y-auto bg-slate-900 rounded-xl p-4 font-mono text-xs text-amber-200 border border-slate-800">
                    <pre className="whitespace-pre-wrap">{file.textSnippet || '// Plain text'}</pre>
                  </div>
                )}

                {file.category === 'document' && (
                  <div className="text-center p-8 text-slate-400">
                    <FileSpreadsheet className="w-16 h-16 text-indigo-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-white">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">Định dạng {file.mimeType}</p>
                  </div>
                )}
              </div>

              {/* Quick links banner below preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-slate-400 block font-medium">Link chia sẻ trực tiếp:</span>
                    <span className="text-xs text-indigo-300 truncate block font-mono">{file.shareUrl}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(file.shareUrl, 'share')}
                    className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer flex-shrink-0"
                  >
                    {copiedKey === 'share' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-slate-400 block font-medium">Link Raw (Trực tiếp file):</span>
                    <span className="text-xs text-emerald-300 truncate block font-mono">{file.directUrl}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(file.directUrl, 'direct')}
                    className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex-shrink-0"
                  >
                    {copiedKey === 'direct' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL LINK TYPES */}
          {activeTab === 'links' && (
            <div className="space-y-4">
              {/* 1. Public Catbox URL (Universal Public Link) */}
              <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 text-emerald-400" />
                    <span>1. Link Công Khai Toàn Cầu (Catbox / Public Direct) ⭐ KHUYÊN DÙNG ĐỂ CHIA SẺ</span>
                  </label>
                  <a
                    href={file.externalUrl || file.directUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    Mở thử ngay <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400">
                  Link này mở trực tiếp 100% trên mọi trình duyệt, thiết bị di động bên ngoài mà không bị màn hình đăng nhập chặn.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={file.externalUrl || file.directUrl}
                    className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg px-3 py-1.5 text-xs text-emerald-200 font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(file.externalUrl || file.directUrl, 'publicUrl')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-md flex-shrink-0"
                  >
                    {copiedKey === 'publicUrl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'publicUrl' ? 'Đã sao chép' : 'Copy Link Công Khai'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Share Page URL */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>2. Link Trang Xem Chia Sẻ (Xem online & phát media)</span>
                  </label>
                  <a
                    href={file.shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    Mở tab mới <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={file.shareUrl}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(file.shareUrl, 'fullShare')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all flex-shrink-0"
                  >
                    {copiedKey === 'fullShare' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'fullShare' ? 'Đã sao chép' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Download Link */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>3. Link Tải Xuống Trực Tiếp</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={file.downloadUrl}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(file.downloadUrl, 'downloadUrl')}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all flex-shrink-0"
                  >
                    {copiedKey === 'downloadUrl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'downloadUrl' ? 'Đã sao chép' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* 4. Short URL */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>4. Link Rút Gọn Nhanh ({file.shortUrl})</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={file.shortUrl}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(file.shortUrl, 'shortUrl')}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all flex-shrink-0"
                  >
                    {copiedKey === 'shortUrl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'shortUrl' ? 'Đã sao chép' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* 4. Markdown & HTML Embeds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-sky-400" />
                    <span>Mã Markdown</span>
                  </label>
                  <textarea
                    rows={2}
                    readOnly
                    value={markdownEmbed}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono resize-none focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(markdownEmbed, 'md')}
                    className="w-full py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-all"
                  >
                    {copiedKey === 'md' ? '✓ Đã sao chép Markdown' : 'Sao chép Markdown'}
                  </button>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mã HTML Embed</span>
                  </label>
                  <textarea
                    rows={2}
                    readOnly
                    value={htmlEmbed}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono resize-none focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(htmlEmbed, 'html')}
                    className="w-full py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-all"
                  >
                    {copiedKey === 'html' ? '✓ Đã sao chép HTML' : 'Sao chép HTML'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE SHEETS & API ACTIONS */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              {/* Google Sheets Card */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950 p-5 rounded-2xl border border-emerald-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Đồng bộ Google Sheets</h4>
                      <p className="text-xs text-slate-400">
                        {file.syncedToGoogleSheet
                          ? `✓ Đã lưu thành công vào bảng tính lúc: ${new Date(file.googleSheetSyncTime || file.uploadedAt).toLocaleString('vi-VN')}`
                          : 'Chưa đẩy bản ghi này vào Google Sheets'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onOpenSheetsTab}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Mở bảng Sheet <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {sheetSuccessMessage && (
                  <div className="bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    <span>{sheetSuccessMessage}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleSyncToSheets}
                    disabled={isSyncingSheet}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSheet ? 'Đang đẩy...' : 'Đẩy lại vào Google Sheets ngay'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const rowText = `${file.name}\t${file.category}\t${file.sizeFormatted}\t${file.shareUrl}\t${file.directUrl}`;
                      copyToClipboard(rowText, 'sheetRow');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-all"
                  >
                    {copiedKey === 'sheetRow' ? '✓ Đã chép dòng TSV' : 'Copy 1 dòng để dán vào Sheet'}
                  </button>
                </div>
              </div>

              {/* External APIs Trigger Card */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span>Kích hoạt phát tín hiệu API ngoài</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Gửi thông báo có link tệp này tới các nền tảng tự động hoá bạn đã kết nối:
                </p>

                {apiActionMessage && (
                  <div
                    className={`text-xs p-3 rounded-xl flex items-center gap-2 ${
                      apiActionMessage.success
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <span>{apiActionMessage.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={handleSendDiscord}
                    disabled={isSendingApi}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-[#5865F2] border border-[#5865F2]/40 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                  >
                    <span>Gửi tới Discord</span>
                  </button>

                  <button
                    onClick={handleSendTelegram}
                    disabled={isSendingApi}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#229ED9]/20 hover:bg-[#229ED9]/30 text-[#229ED9] border border-[#229ED9]/40 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                  >
                    <span>Gửi tới Telegram</span>
                  </button>

                  <button
                    onClick={handleSendWebhook}
                    disabled={isSendingApi}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                  >
                    <span>Gọi Custom Webhook</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: QR CODE */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="p-4 bg-white rounded-2xl shadow-xl border border-slate-200">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-500 text-xs">
                    Đang tạo QR...
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-white">Quét mã QR để mở trên điện thoại</p>
                <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
                  Người dùng quét mã này sẽ lập tức được chuyển hướng tới trang xem tệp hoặc tải về trực tiếp.
                </p>
              </div>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`QR_${file.name}.png`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải ảnh mã QR (.PNG)</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
