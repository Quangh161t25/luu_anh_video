import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  Sparkles, 
  Code2, 
  HelpCircle, 
  Trash2, 
  Send,
  Database,
  Link2
} from 'lucide-react';
import { SheetRecord, IntegrationsConfig, StoredFile } from '../types';
import { 
  saveIntegrationsConfig, 
  exportRecordsToCSV, 
  copyRecordsToClipboardForSheets, 
  clearSheetRecordsFromServer, 
  syncToGoogleSheets 
} from '../utils/api';

interface GoogleSheetsTabProps {
  sheetRecords: SheetRecord[];
  files: StoredFile[];
  config: IntegrationsConfig;
  onUpdateConfig: (newConfig: IntegrationsConfig) => void;
  onRefreshRecords: () => void;
  onRefreshFiles: () => void;
}

export const GoogleSheetsTab: React.FC<GoogleSheetsTabProps> = ({
  sheetRecords,
  files,
  config,
  onUpdateConfig,
  onRefreshRecords,
  onRefreshFiles,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(config.googleSheets.webhookUrl || '');
  const [autoSync, setAutoSync] = useState(config.googleSheets.autoSyncOnUpload ?? true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedTsv, setCopiedTsv] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showCodeGuide, setShowCodeGuide] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const APPS_SCRIPT_CODE = `function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // Tự động tạo dòng tiêu đề nếu trang tính còn mới
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Thời gian",
      "Tên Tệp",
      "Phân loại",
      "Dung lượng",
      "Link Chia Sẻ",
      "Link Trực Tiếp",
      "Thẻ Tags"
    ]);
    sheet.getRange(1, 1, 1, 7).setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold");
  }
  
  sheet.appendRow([
    new Date().toLocaleString("vi-VN"),
    data.fileName || "File",
    data.category || "",
    data.fileSizeFormatted || data.fileSize || "",
    data.shareUrl || "",
    data.directUrl || "",
    data.tags || ""
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({ 
    status: "success", 
    row: sheet.getLastRow(),
    message: "Đã ghi dòng mới vào Google Sheet thành công!"
  })).setMimeType(ContentService.MimeType.JSON);
}`;

  const handleSaveSettings = () => {
    const updated: IntegrationsConfig = {
      ...config,
      googleSheets: {
        ...config.googleSheets,
        webhookUrl: webhookUrl.trim(),
        autoSyncOnUpload: autoSync,
        enabled: true,
      },
    };
    onUpdateConfig(updated);
    saveIntegrationsConfig(updated);
  };

  const handleTestWebhook = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Save setting first
      handleSaveSettings();

      const testPayload = {
        fileName: 'test_demo_sample.png',
        category: 'image',
        fileSizeFormatted: '1.45 MB',
        shareUrl: `${window.location.origin}/#view=test-demo`,
        directUrl: `${window.location.origin}/api/raw/test-demo/sample.png`,
        tags: 'test, demo, google_sheets',
      };

      const res = await fetch('/api/integrations/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim() || undefined,
          customData: testPayload,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: webhookUrl.trim()
            ? '✓ Kết nối Google Apps Script Webhook thành công! Đã ghi 1 dòng thử nghiệm vào Google Sheet của bạn.'
            : '✓ Đã ghi nhận bản ghi thử nghiệm vào Google Sheet Tracker nội bộ thành công!',
        });
        onRefreshRecords();
      } else {
        setTestResult({
          success: false,
          message: `Lỗi kết nối: ${data.error || 'Máy chủ webhook từ chối hoặc không phản hồi'}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Lỗi: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncAllFiles = async () => {
    if (files.length === 0) {
      alert('Chưa có tệp nào trong hệ thống để đồng bộ.');
      return;
    }

    setIsSyncingAll(true);
    try {
      for (const file of files) {
        await syncToGoogleSheets(file.id);
      }
      onRefreshRecords();
      onRefreshFiles();
      alert(`Đã đồng bộ thành công tất cả ${files.length} tệp vào Google Sheet!`);
    } catch (e: any) {
      alert(`Lỗi khi đồng bộ: ${e.message}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleCopyTsv = async () => {
    if (sheetRecords.length === 0) return;
    await copyRecordsToClipboardForSheets(sheetRecords);
    setCopiedTsv(true);
    setTimeout(() => setCopiedTsv(false), 2500);
  };

  const handleClearRecords = async () => {
    if (window.confirm('Bạn có chắc muốn xoá toàn bộ lịch sử bản ghi Google Sheets đã lưu?')) {
      await clearSheetRecordsFromServer();
      onRefreshRecords();
    }
  };

  const filteredRecords = sheetRecords.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.fileName.toLowerCase().includes(term) ||
      r.category.toLowerCase().includes(term) ||
      r.shareUrl.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-6 rounded-2xl border border-emerald-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Tự Động Lưu Link Về Google Sheets
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/40">
                  {webhookUrl ? 'Đã gán Webhook' : 'Bảng Tracker Kích Hoạt'}
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
                Mỗi khi bạn tải lên bất kỳ ảnh, video hoặc tập tin văn bản nào, hệ thống sẽ lập tức cấp link chia sẻ và tự động lưu tên tệp, loại, dung lượng cùng link trực tiếp về trang tính Google Sheets của bạn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => exportRecordsToCSV(sheetRecords)}
              disabled={sheetRecords.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              title="Tải file CSV mở ngay trong Google Sheets"
            >
              <Download className="w-4 h-4" />
              <span>Xuất CSV cho GG Sheet</span>
            </button>

            <button
              onClick={handleCopyTsv}
              disabled={sheetRecords.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Copy dữ liệu để dán (Ctrl+V) trực tiếp vào Google Sheets"
            >
              {copiedTsv ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedTsv ? 'Đã copy dữ liệu' : 'Copy dán vào Sheet'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Configuration & Webhook Connector Card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Cấu hình kết nối Google Sheet (Webhook)</h3>
          </div>

          <button
            onClick={() => setShowCodeGuide(!showCodeGuide)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showCodeGuide ? 'Ẩn hướng dẫn Apps Script' : 'Xem cách lấy Webhook URL Google Sheets (30 giây)'}</span>
          </button>
        </div>

        {/* Apps Script Guide Drawer */}
        {showCodeGuide && (
          <div className="bg-slate-950 p-5 rounded-2xl border border-indigo-500/30 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span>3 Bước kết nối trang tính Google Sheets của bạn vĩnh viễn:</span>
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-all"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Đã sao chép code' : 'Sao chép mã Apps Script'}</span>
              </button>
            </div>

            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Mở trang <strong>Google Sheets</strong> mới của bạn tại <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">sheets.new</a></li>
              <li>Vào menu <strong>Tiện ích mở rộng (Extensions)</strong> → chọn <strong>Apps Script</strong>.</li>
              <li>Xoá code cũ và dán đoạn mã bên dưới vào, sau đó nhấn <strong>Triển khai (Deploy)</strong> → <strong>Lần triển khai mới (New deployment)</strong> → Chọn loại <strong>Ứng dụng web (Web app)</strong>.</li>
              <li>Mục <em>"Ai có quyền truy cập" (Who has access)</em>: chọn <strong>Bất kỳ ai (Anyone)</strong>. Nhấn Triển khai và sao chép <strong>URL ứng dụng web</strong> dán vào ô bên dưới!</li>
            </ol>

            <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-48">
              <pre>{APPS_SCRIPT_CODE}</pre>
            </div>
          </div>
        )}

        {/* Input Webhook URL */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Google Apps Script Web App URL (Tùy chọn kết nối trực tiếp):</span>
            <span className="text-[11px] text-slate-400 font-normal">
              Nếu để trống, hệ thống sẽ lưu vào bảng Tracker nội bộ & xuất CSV bất kỳ lúc nào.
            </span>
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleSaveSettings}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 cursor-pointer transition-all whitespace-nowrap"
              >
                Lưu cấu hình
              </button>

              <button
                onClick={handleTestWebhook}
                disabled={isTesting}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
              >
                <Send className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Đang gửi test...' : 'Kiểm tra kết nối'}</span>
              </button>
            </div>
          </div>

          {/* Test result feedback banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 mt-2 ${
                testResult.success
                  ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Auto Sync Toggle & Bulk action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => {
                setAutoSync(e.target.checked);
                const updated: IntegrationsConfig = {
                  ...config,
                  googleSheets: {
                    ...config.googleSheets,
                    autoSyncOnUpload: e.target.checked,
                  },
                };
                onUpdateConfig(updated);
                saveIntegrationsConfig(updated);
              }}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-white font-medium">
              ⚡ Tự động ghi link vào Google Sheets ngay sau mỗi lần tải tệp lên
            </span>
          </label>

          <button
            onClick={handleSyncAllFiles}
            disabled={isSyncingAll || files.length === 0}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>Đồng bộ tất cả {files.length} tệp hiện có vào Sheet</span>
          </button>
        </div>
      </div>

      {/* Live Spreadsheet Viewer */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Spreadsheet Header Bar */}
        <div className="bg-emerald-900/40 border-b border-emerald-500/30 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Bảng Dữ Liệu Google Sheets (Live Data)</h3>
              <p className="text-[11px] text-emerald-300">
                {sheetRecords.length} dòng đã được ghi nhận tự động
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Lọc dữ liệu bảng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />

            {sheetRecords.length > 0 && (
              <button
                onClick={handleClearRecords}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition-colors"
                title="Xoá lịch sử bản ghi"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {filteredRecords.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">Chưa có bản ghi nào trong bảng Google Sheets</p>
            <p className="text-slate-500 mt-0.5">
              Khi bạn tải tệp lên hoặc bấm "Đồng bộ", các hàng mới sẽ tự động xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3 border-r border-slate-800 w-12 text-center text-slate-500">STT</th>
                  <th className="p-3 border-r border-slate-800">Thời Gian</th>
                  <th className="p-3 border-r border-slate-800">Tên Tệp</th>
                  <th className="p-3 border-r border-slate-800">Loại</th>
                  <th className="p-3 border-r border-slate-800">Dung Lượng</th>
                  <th className="p-3 border-r border-slate-800">Link Công Khai (Catbox)</th>
                  <th className="p-3 border-r border-slate-800">Trang Chia Sẻ</th>
                  <th className="p-3">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredRecords.map((rec, index) => {
                  const publicLink = rec.externalUrl || rec.directUrl;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 border-r border-slate-800 text-center text-slate-500 bg-slate-950/30">
                        {index + 1}
                      </td>

                      <td className="p-3 border-r border-slate-800 text-slate-400 whitespace-nowrap">
                        {new Date(rec.timestamp).toLocaleString('vi-VN')}
                      </td>

                      <td className="p-3 border-r border-slate-800 font-sans font-semibold text-white max-w-xs truncate">
                        {rec.fileName}
                      </td>

                      <td className="p-3 border-r border-slate-800">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-bold">
                          {rec.category}
                        </span>
                      </td>

                      <td className="p-3 border-r border-slate-800 text-slate-300 whitespace-nowrap">
                        {rec.fileSize}
                      </td>

                      {/* Public Link (Catbox / Direct) */}
                      <td className="p-3 border-r border-slate-800 max-w-xs truncate">
                        <a
                          href={publicLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                          title={publicLink}
                        >
                          <span className="truncate">{publicLink}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>

                      {/* Share Page Link */}
                      <td className="p-3 border-r border-slate-800 max-w-xs truncate">
                        <a
                          href={rec.shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:underline flex items-center gap-1"
                          title={rec.shareUrl}
                        >
                          <span className="truncate">{rec.shareUrl}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>

                      <td className="p-3 whitespace-nowrap font-sans">
                        {rec.status === 'synced' ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Thành công
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1 text-xs" title={rec.error}>
                            <AlertCircle className="w-3.5 h-3.5" /> Lỗi
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
