import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  FileText, 
  Copy, 
  Check, 
  ExternalLink, 
  Trash2, 
  FileSpreadsheet, 
  QrCode, 
  ArrowUpDown, 
  RefreshCw, 
  Download,
  Share2,
  CheckSquare,
  Square,
  Sparkles,
  Tag
} from 'lucide-react';
import { StoredFile, FileCategory } from '../types';
import { deleteFileFromServer, syncToGoogleSheets } from '../utils/api';

interface AssetManagerProps {
  files: StoredFile[];
  onRefreshFiles: () => void;
  onOpenDetailModal: (file: StoredFile) => void;
  onOpenQrModal: (url: string, title: string) => void;
  onOpenUploadTab: () => void;
  onOpenSheetsTab: () => void;
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  files,
  onRefreshFiles,
  onOpenDetailModal,
  onOpenQrModal,
  onOpenUploadTab,
  onOpenSheetsTab,
}) => {
  const [activeCategory, setActiveCategory] = useState<FileCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size_desc' | 'size_asc' | 'name_asc'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [batchActionNotice, setBatchActionNotice] = useState<string | null>(null);

  // Filtered & Sorted files
  const filteredFiles = useMemo(() => {
    return files
      .filter((file) => {
        if (activeCategory !== 'all' && file.category !== activeCategory) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = file.name.toLowerCase().includes(q);
          const matchTag = file.tags && file.tags.some((t) => t.toLowerCase().includes(q));
          const matchType = file.mimeType.toLowerCase().includes(q);
          if (!matchName && !matchTag && !matchType) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        if (sortBy === 'oldest') return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        if (sortBy === 'size_desc') return b.size - a.size;
        if (sortBy === 'size_asc') return a.size - b.size;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [files, activeCategory, searchQuery, sortBy]);

  // Counts by category
  const counts = useMemo(() => {
    return {
      all: files.length,
      image: files.filter((f) => f.category === 'image').length,
      video: files.filter((f) => f.category === 'video').length,
      text: files.filter((f) => f.category === 'text').length,
      document: files.filter((f) => f.category === 'document' || f.category === 'other').length,
    };
  }, [files]);

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteFile = async (file: StoredFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm(`Bạn có chắc muốn xoá file "${file.name}"?`)) {
      try {
        await deleteFileFromServer(file.id);
        onRefreshFiles();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(file.id);
          return next;
        });
      } catch (err: any) {
        alert(err.message || 'Lỗi khi xoá file');
      }
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const handleBatchSyncSheets = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchSyncing(true);
    setBatchActionNotice(`Đang đồng bộ ${selectedIds.size} tệp vào Google Sheets...`);
    try {
      for (const id of Array.from(selectedIds)) {
        await syncToGoogleSheets(id).catch(console.error);
      }
      setBatchActionNotice(`Đã hoàn tất đồng bộ ${selectedIds.size} tệp vào Google Sheets! ✓`);
      onRefreshFiles();
      setTimeout(() => setBatchActionNotice(null), 3500);
    } catch (e: any) {
      setBatchActionNotice(`Lỗi đồng bộ: ${e.message}`);
    } finally {
      setIsBatchSyncing(false);
    }
  };

  const handleBatchCopyLinks = () => {
    const selectedFiles = files.filter((f) => selectedIds.has(f.id));
    const text = selectedFiles.map((f) => `${f.name}: ${f.shareUrl}`).join('\n');
    navigator.clipboard.writeText(text);
    setBatchActionNotice(`Đã sao chép liên kết của ${selectedFiles.length} tệp vào clipboard!`);
    setTimeout(() => setBatchActionNotice(null), 3000);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Bạn có chắc muốn xoá ${selectedIds.size} tệp đã chọn?`)) {
      for (const id of Array.from(selectedIds)) {
        await deleteFileFromServer(id).catch(console.error);
      }
      setSelectedIds(new Set());
      onRefreshFiles();
      setBatchActionNotice(`Đã xoá các tệp thành công.`);
      setTimeout(() => setBatchActionNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Pills & Top Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <span>Tất cả</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">{counts.all}</span>
          </button>

          <button
            onClick={() => setActiveCategory('image')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === 'image'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hình ảnh</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">{counts.image}</span>
          </button>

          <button
            onClick={() => setActiveCategory('video')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === 'video'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <VideoIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>Video</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">{counts.video}</span>
          </button>

          <button
            onClick={() => setActiveCategory('text')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === 'text'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Văn bản & Code</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">{counts.text}</span>
          </button>
        </div>

        {/* Right Search & Controls */}
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên file, thẻ tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-slate-900 text-white">Mới nhất</option>
              <option value="oldest" className="bg-slate-900 text-white">Cũ nhất</option>
              <option value="size_desc" className="bg-slate-900 text-white">Dung lượng giảm dần</option>
              <option value="size_asc" className="bg-slate-900 text-white">Dung lượng tăng dần</option>
              <option value="name_asc" className="bg-slate-900 text-white">Tên A-Z</option>
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Xem dạng lưới"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Xem danh sách bảng"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Actions Bar (visible when items selected) */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-950/80 border border-indigo-500/40 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 font-semibold text-indigo-300 hover:text-white"
            >
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              <span>Đã chọn {selectedIds.size} / {filteredFiles.length} tệp</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBatchSyncSheets}
              disabled={isBatchSyncing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all shadow cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Đồng bộ Google Sheets</span>
            </button>

            <button
              onClick={handleBatchCopyLinks}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép tất cả link</span>
            </button>

            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-medium transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xoá</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {batchActionNotice && (
        <div className="bg-slate-800 border border-indigo-500/50 text-indigo-200 text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between">
          <span>{batchActionNotice}</span>
          <button onClick={() => setBatchActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Empty State */}
      {filteredFiles.length === 0 && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center mb-4">
            <Filter className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white">Chưa có tài nguyên nào phù hợp</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
            {searchQuery
              ? 'Không tìm thấy tệp phù hợp với từ khoá tìm kiếm của bạn.'
              : 'Hãy tải lên tệp ảnh, video hoặc tập tin văn bản đầu tiên của bạn để lấy link chia sẻ và tự động lưu vào Google Sheets.'}
          </p>
          <button
            onClick={onOpenUploadTab}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            Tải Lên Tệp Ngay
          </button>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filteredFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles.map((file) => {
            const isSelected = selectedIds.has(file.id);
            const isCopied = copiedId === file.id;

            return (
              <div
                key={file.id}
                onClick={() => onOpenDetailModal(file)}
                className={`group bg-slate-900 rounded-2xl border overflow-hidden flex flex-col transition-all cursor-pointer relative hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Thumbnail Preview Area */}
                <div className="relative w-full aspect-video bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
                  {file.category === 'image' ? (
                    <img
                      src={file.directUrl}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : file.category === 'video' ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950">
                      <video
                        src={file.directUrl}
                        className="w-full h-full object-cover pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
                        preload="metadata"
                      />
                      <div className="absolute w-10 h-10 rounded-full bg-indigo-600/80 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <VideoIcon className="w-5 h-5" />
                      </div>
                      {file.duration !== undefined && file.duration > 0 && (
                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                          {Math.floor(file.duration / 60)}:{(file.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  ) : file.category === 'text' ? (
                    <div className="w-full h-full p-3 font-mono text-[10px] text-amber-300/80 bg-slate-950 overflow-hidden select-none flex flex-col justify-between">
                      <div className="line-clamp-4 leading-tight opacity-70">
                        {file.textSnippet || '// Plain text document'}
                      </div>
                      <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-800/60">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-amber-400" />
                          {file.lineCount ? `${file.lineCount} dòng` : 'Văn bản'}
                        </span>
                        <span>{file.wordCount ? `${file.wordCount} từ` : ''}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                      <FileSpreadsheet className="w-10 h-10 text-emerald-400 mb-1" />
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        {file.mimeType.split('/')[1] || 'File'}
                      </span>
                    </div>
                  )}

                  {/* Multi-select checkbox */}
                  <div
                    onClick={(e) => handleToggleSelect(file.id, e)}
                    className="absolute top-2 left-2 z-10 p-1 rounded-md bg-slate-900/80 hover:bg-slate-800 text-white transition-all backdrop-blur-sm cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    )}
                  </div>

                  {/* Google Sheets Synced Badge */}
                  {file.syncedToGoogleSheet && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSheetsTab();
                      }}
                      className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-semibold backdrop-blur-sm"
                      title="Đã lưu vào Google Sheets"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>GG Sheet</span>
                    </div>
                  )}

                  {/* Catbox / Public Host Badge */}
                  {file.externalUrl && (
                    <div
                      className="absolute bottom-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/90 border border-indigo-500/50 text-indigo-300 text-[10px] font-semibold backdrop-blur-sm"
                      title="Link công khai toàn cầu mở được mọi nơi"
                    >
                      <span>🐱 Catbox Công Khai</span>
                    </div>
                  )}
                </div>

                {/* Content Info */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-white text-xs truncate group-hover:text-indigo-300 transition-colors" title={file.name}>
                      {file.name}
                    </h4>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                      <span>{file.sizeFormatted}</span>
                      <span>•</span>
                      <span>{new Date(file.uploadedAt).toLocaleDateString('vi-VN')}</span>
                    </div>

                    {/* Tags */}
                    {file.tags && file.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {file.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-xs">
                    {/* Copy Public Link (Catbox) or Share Link */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLink(file.id, file.externalUrl || file.directUrl);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isCopied
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                          : file.externalUrl
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                          : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                      }`}
                      title={file.externalUrl ? 'Sao chép link công khai Catbox' : 'Sao chép link trực tiếp'}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Đã copy' : file.externalUrl ? 'Copy Link Catbox' : 'Copy Link'}</span>
                    </button>

                    {/* QR Code */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenQrModal(file.shareUrl, file.name);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Tạo mã QR chia sẻ"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => handleDeleteFile(file, e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Xoá tệp"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && filteredFiles.length > 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredFiles.length && filteredFiles.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Tên Tệp</th>
                  <th className="p-3">Loại</th>
                  <th className="p-3">Dung Lượng</th>
                  <th className="p-3">Ngày Tải</th>
                  <th className="p-3">GG Sheets</th>
                  <th className="p-3 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFiles.map((file) => {
                  const isSelected = selectedIds.has(file.id);
                  const isCopied = copiedId === file.id;

                  return (
                    <tr
                      key={file.id}
                      onClick={() => onOpenDetailModal(file)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e: any) => handleToggleSelect(file.id, e)}
                          className="rounded border-slate-700 bg-slate-800 text-indigo-600 cursor-pointer"
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                            {file.category === 'image' && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                            {file.category === 'video' && <VideoIcon className="w-4 h-4 text-sky-400" />}
                            {file.category === 'text' && <FileText className="w-4 h-4 text-amber-400" />}
                            {file.category === 'document' && <FileSpreadsheet className="w-4 h-4 text-indigo-400" />}
                          </div>
                          <div>
                            <span className="font-semibold text-white block max-w-xs truncate">{file.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">/s/{file.shortCode}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {file.category}
                        </span>
                      </td>

                      <td className="p-3 font-mono">{file.sizeFormatted}</td>

                      <td className="p-3 text-slate-400">{new Date(file.uploadedAt).toLocaleDateString('vi-VN')}</td>

                      <td className="p-3">
                        {file.syncedToGoogleSheet ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <Check className="w-3.5 h-3.5" /> Đã lưu
                          </span>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await syncToGoogleSheets(file.id);
                              onRefreshFiles();
                            }}
                            className="text-slate-400 hover:text-emerald-300 text-[11px] underline"
                          >
                            Đẩy lên Sheet
                          </button>
                        )}
                      </td>

                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyLink(file.id, file.shareUrl)}
                            className="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium transition-all"
                            title="Sao chép link"
                          >
                            {isCopied ? 'Đã chép' : 'Copy'}
                          </button>

                          <button
                            onClick={() => onOpenQrModal(file.shareUrl, file.name)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                            title="QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleDeleteFile(file, e)}
                            className="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400"
                            title="Xoá"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
