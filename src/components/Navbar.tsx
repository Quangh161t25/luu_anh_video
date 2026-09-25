import React from 'react';
import { 
  Cloud, 
  FolderGit2, 
  UploadCloud, 
  TableProperties, 
  Webhook, 
  Activity, 
  HardDrive,
  FileCode2,
  ExternalLink
} from 'lucide-react';
import { StoredFile } from '../types';

interface NavbarProps {
  activeTab: 'manager' | 'upload' | 'sheets' | 'integrations' | 'logs';
  setActiveTab: (tab: 'manager' | 'upload' | 'sheets' | 'integrations' | 'logs') => void;
  files: StoredFile[];
  sheetRecordsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  files,
  sheetRecordsCount,
}) => {
  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const formatTotalSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white transition-all shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('manager')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-sky-100 to-indigo-200 bg-clip-text text-transparent">
                  CloudAsset Hub
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Sheets & API
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Quản lý tài nguyên & Liên kết API ngoài</p>
            </div>
          </div>

          {/* Center Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('manager')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'manager'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FolderGit2 className="w-4 h-4" />
              <span>Kho Tài Nguyên</span>
              {files.length > 0 && (
                <span className={`text-xs px-1.5 py-0.2 rounded-full ${activeTab === 'manager' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-700 text-slate-300'}`}>
                  {files.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Tải Lên Mới</span>
            </button>

            <button
              onClick={() => setActiveTab('sheets')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'sheets'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <TableProperties className="w-4 h-4 text-emerald-400" />
              <span>Google Sheets</span>
              {sheetRecordsCount > 0 && (
                <span className="text-xs px-1.5 py-0.2 rounded-full bg-emerald-700/80 text-emerald-100">
                  {sheetRecordsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'integrations'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Webhook className="w-4 h-4 text-purple-400" />
              <span>Liên Kết API Ngoài</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Activity className="w-4 h-4 text-sky-400" />
              <span>Nhật Ký</span>
            </button>
          </nav>

          {/* Right Status & Quick Action */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              <span>Lưu trữ: <strong className="text-white">{formatTotalSize(totalBytes)}</strong></span>
              <span className="text-slate-500">•</span>
              <span><strong>{files.length}</strong> tệp</span>
            </div>

            <button
              onClick={() => setActiveTab('upload')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white text-sm font-medium shadow-md shadow-sky-500/20 active:scale-95 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span className="hidden sm:inline">Tải Lên Ngay</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around py-2.5 border-t border-slate-800 text-xs overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('manager')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'manager' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Kho ({files.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'upload' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tải lên</span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'sheets' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-300'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5 text-emerald-300" />
            <span>GG Sheet ({sheetRecordsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'integrations' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300'
            }`}
          >
            <Webhook className="w-3.5 h-3.5 text-purple-400" />
            <span>API</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md whitespace-nowrap ${
              activeTab === 'logs' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Logs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
