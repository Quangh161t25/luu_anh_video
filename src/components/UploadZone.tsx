import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  FileText, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Globe2
} from 'lucide-react';
import { StoredFile, IntegrationsConfig, StorageProvider } from '../types';
import { uploadFileToServer, autoDispatchIntegrations } from '../utils/api';

interface UploadZoneProps {
  onUploadSuccess: (newFile: StoredFile) => void;
  config: IntegrationsConfig;
  onOpenSheetsTab: () => void;
  onOpenDetailModal: (file: StoredFile) => void;
}

interface UploadTask {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
  status: 'queued' | 'uploading' | 'syncing' | 'completed' | 'error';
  progress: number;
  result?: StoredFile;
  sheetSynced?: boolean;
  error?: string;
  copiedKey?: string;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onUploadSuccess,
  config,
  onOpenSheetsTab,
  onOpenDetailModal,
}) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [autoSyncSheets, setAutoSyncSheets] = useState(config.googleSheets.autoSyncOnUpload ?? true);
  const [autoDispatchApis, setAutoDispatchApis] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<StorageProvider>(config.catbox?.defaultProvider || 'catbox');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newTasks: UploadTask[] = fileArray.map((f) => {
      let previewUrl: string | undefined = undefined;
      if (f.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(f);
      }
      return {
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name,
        size: f.size,
        previewUrl,
        status: 'queued',
        progress: 0,
      };
    });

    setTasks((prev) => [...newTasks, ...prev]);

    // Start uploading each task
    newTasks.forEach((task) => {
      executeUpload(task);
    });
  }, [tagsInput, autoSyncSheets, autoDispatchApis, config, selectedProvider]);

  const executeUpload = async (task: UploadTask) => {
    // 1. Mark uploading
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: 'uploading', progress: 30 } : t))
    );

    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      // Upload to server & Catbox
      const uploadedFile = await uploadFileToServer(task.file, { 
        tags: parsedTags,
        provider: selectedProvider,
        userhash: config.catbox?.userhash,
        litterboxExpiry: config.catbox?.litterboxExpiry || '72h',
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'syncing', progress: 75, result: uploadedFile } : t
        )
      );

      // Auto-sync to Google Sheet and other external APIs
      let sheetSuccess = false;
      if (autoSyncSheets || autoDispatchApis) {
        const effectiveConfig: IntegrationsConfig = {
          ...config,
          googleSheets: {
            ...config.googleSheets,
            enabled: autoSyncSheets,
            autoSyncOnUpload: autoSyncSheets,
          },
        };

        const dispatchResult = await autoDispatchIntegrations(uploadedFile, effectiveConfig);
        sheetSuccess = !!dispatchResult.sheetsSuccess;
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'completed',
                progress: 100,
                result: { ...uploadedFile, syncedToGoogleSheet: sheetSuccess },
                sheetSynced: sheetSuccess,
              }
            : t
        )
      );

      onUploadSuccess(uploadedFile);
    } catch (err: any) {
      console.error('Task error:', err);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: 'error', progress: 0, error: err.message || 'Lỗi tải lên' }
            : t
        )
      );
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleCopyLink = (taskId: string, url: string, key = 'copied') => {
    navigator.clipboard.writeText(url);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, copiedKey: key } : t))
    );
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, copiedKey: undefined } : t))
      );
    }, 2000);
  };

  const clearCompletedTasks = () => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explainer */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 p-6 rounded-2xl border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-indigo-600/30 text-indigo-400 rounded-lg border border-indigo-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Tải Lên & Tạo Link Chia Sẻ Công Khai Toàn Cầu
              </h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Tích hợp API <strong>Catbox.moe</strong> để cấp link công khai trực tiếp (mở được ngay trên mọi thiết bị và ứng dụng ngoài không cần đăng nhập). Tự động đồng bộ link về <strong>Google Sheets</strong> và thông báo API.
            </p>
          </div>

          {/* Quick status pill for Google Sheet */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white block">Tự động lưu GG Sheets</span>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {config.googleSheets.webhookUrl ? 'Đang kết nối Webhook' : 'Sẵn sàng ghi bản ghi'}
                </span>
              </div>
            </div>
            <button
              onClick={onOpenSheetsTab}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer whitespace-nowrap"
            >
              Xem Sheet
            </button>
          </div>
        </div>

        {/* Upload Provider Selector & Options */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Hosting Provider Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Nguồn Lưu Trữ & Tạo Link:</span>
              </span>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedProvider('imgbb')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedProvider === 'imgbb'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="ImgBB: Lưu trữ ảnh vĩnh viễn, CDN i.ibb.co tốc độ cao, hỗ trợ tạo thumbnail tự động"
                >
                  🖼️ ImgBB (Ảnh vĩnh viễn)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('catbox')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedProvider === 'catbox'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Catbox.moe: Tự động dùng Userhash hoặc liên kết Uguu/TmpFiles công khai"
                >
                  🐱 Catbox.moe
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('uguu')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedProvider === 'uguu'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Uguu.se: CDN công khai toàn cầu 100MB, tốc độ cực nhanh, mở được mọi nơi"
                >
                  ⚡ Uguu CDN (Khuyên dùng)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('tmpfiles')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedProvider === 'tmpfiles'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="TmpFiles.org: Tải lên không giới hạn, link trực tiếp toàn cầu"
                >
                  📦 TmpFiles
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider('local')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedProvider === 'local'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Chỉ lưu trên máy chủ riêng"
                >
                  💻 Nội bộ
                </button>
              </div>
            </div>

            {/* Tag input */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Gắn thẻ:</span>
              <input
                type="text"
                placeholder="vd: banner, clip, tailieu"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="px-2.5 py-1 bg-slate-800/90 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSyncSheets}
                onChange={(e) => setAutoSyncSheets(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span className="text-emerald-300 font-medium">
                ⚡ Tự động ghi link công khai vào Google Sheets ngay sau khi upload
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoDispatchApis}
                onChange={(e) => setAutoDispatchApis(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span>Gửi thông báo tới Discord / Telegram / Custom Webhook</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer group select-none ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700 hover:border-indigo-500/80 bg-slate-900/50 hover:bg-slate-800/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,video/*,text/*,.txt,.md,.json,.csv,.log,.js,.ts,.html,.css,.py,.pdf,.docx"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
          }}
        />

        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all shadow-lg mb-4">
            <Upload className="w-8 h-8 transition-transform group-hover:-translate-y-1" />
          </div>

          <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">
            Kéo thả tập tin vào đây hoặc nhấp để duyệt
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Hỗ trợ tải lên ảnh, video và tập tin văn bản • Tự động tạo link công khai Catbox & lưu vào Google Sheets
          </p>

          {/* Supported Format Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Ảnh (JPG, PNG, GIF, WEBP)</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs">
              <VideoIcon className="w-3.5 h-3.5" />
              <span>Video (MP4, WEBM, MOV)</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <FileText className="w-3.5 h-3.5" />
              <span>Văn bản (TXT, MD, JSON, CSV)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Tasks List */}
      {tasks.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Tiến trình tải lên & đồng bộ</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {tasks.length} tệp
              </span>
            </div>
            <button
              onClick={clearCompletedTasks}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Xoá tệp đã xong
            </button>
          </div>

          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-600 transition-colors"
              >
                {/* Left: preview/icon + info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {task.previewUrl ? (
                    <img
                      src={task.previewUrl}
                      alt={task.name}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0 text-slate-300">
                      {task.file.type.startsWith('video/') ? (
                        <VideoIcon className="w-6 h-6 text-sky-400" />
                      ) : task.file.type.startsWith('text/') || task.name.endsWith('.txt') ? (
                        <FileText className="w-6 h-6 text-amber-400" />
                      ) : (
                        <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{task.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{(task.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>•</span>

                      {task.status === 'uploading' && (
                        <span className="text-sky-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Đang đẩy lên {selectedProvider.toUpperCase()}...
                        </span>
                      )}
                      {task.status === 'syncing' && (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu Google Sheets & API...
                        </span>
                      )}
                      {task.status === 'completed' && (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành
                        </span>
                      )}
                      {task.status === 'error' && (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {task.error || 'Thất bại'}
                        </span>
                      )}

                      {task.result?.externalUrl && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          {task.result.provider ? task.result.provider.toUpperCase() : 'PUBLIC'} ✓
                        </span>
                      )}

                      {task.sheetSynced && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          GG Sheet ✓
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {(task.status === 'uploading' || task.status === 'syncing') && (
                      <div className="w-full bg-slate-700/60 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action buttons when completed */}
                {task.status === 'completed' && task.result && (
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/50 flex-wrap">
                    {/* Primary Public Direct Link (Catbox) */}
                    {task.result.externalUrl ? (
                      <button
                        onClick={() => handleCopyLink(task.id, task.result!.externalUrl!, 'catbox')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                        title="Sao chép link công khai Catbox mở được mọi nơi"
                      >
                        {task.copiedKey === 'catbox' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{task.copiedKey === 'catbox' ? 'Đã sao chép link' : 'Copy Link Công Khai'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCopyLink(task.id, task.result!.directUrl, 'direct')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                        title="Sao chép Direct URL"
                      >
                        {task.copiedKey === 'direct' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{task.copiedKey === 'direct' ? 'Đã sao chép' : 'Copy Direct URL'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCopyLink(task.id, task.result!.shareUrl, 'share')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all cursor-pointer"
                      title="Sao chép link trang chia sẻ"
                    >
                      {task.copiedKey === 'share' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Trang Xem</span>
                    </button>

                    <button
                      onClick={() => onOpenDetailModal(task.result!)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all cursor-pointer"
                      title="Xem chi tiết & mã nhúng"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Xem</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
