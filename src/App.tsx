/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { AssetManager } from './components/AssetManager';
import { UploadZone } from './components/UploadZone';
import { GoogleSheetsTab } from './components/GoogleSheetsTab';
import { IntegrationsHub } from './components/IntegrationsHub';
import { ApiLogsTab } from './components/ApiLogsTab';
import { AssetDetailModal } from './components/AssetDetailModal';
import { QrModal } from './components/QrModal';
import { StoredFile, SheetRecord, IntegrationsConfig } from './types';
import { 
  fetchFiles, 
  fetchSheetRecords, 
  loadIntegrationsConfig, 
  saveIntegrationsConfig 
} from './utils/api';
import { 
  Loader2, 
  FileSpreadsheet, 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Share2,
  HardDrive
} from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [sheetRecords, setSheetRecords] = useState<SheetRecord[]>([]);
  const [config, setConfig] = useState<IntegrationsConfig>(loadIntegrationsConfig());
  const [activeTab, setActiveTab] = useState<'manager' | 'upload' | 'sheets' | 'integrations' | 'logs'>('manager');
  
  const [selectedFileForDetail, setSelectedFileForDetail] = useState<StoredFile | null>(null);
  const [qrModalData, setQrModalData] = useState<{ url: string; title: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load data from server
  const loadInitialData = useCallback(async () => {
    try {
      const [filesData, recordsData] = await Promise.all([
        fetchFiles().catch(() => []),
        fetchSheetRecords().catch(() => []),
      ]);
      setFiles(filesData);
      setSheetRecords(recordsData);

      // Check if URL hash has #view=id
      const hash = window.location.hash;
      if (hash.startsWith('#view=')) {
        const fileId = hash.replace('#view=', '');
        const target = filesData.find((f: StoredFile) => f.id === fileId || f.shortCode === fileId);
        if (target) {
          setSelectedFileForDetail(target);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Listen to window hash changes for deep linking
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#view=')) {
        const fileId = hash.replace('#view=', '');
        const target = files.find((f) => f.id === fileId || f.shortCode === fileId);
        if (target) setSelectedFileForDetail(target);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [loadInitialData, files]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleUploadSuccess = (newFile: StoredFile) => {
    setFiles((prev) => [newFile, ...prev.filter((f) => f.id !== newFile.id)]);
    // Also fetch sheet records to reflect newly synced rows
    fetchSheetRecords().then(setSheetRecords).catch(console.error);
    showToast(`Đã tải lên tệp "${newFile.name}" thành công! ✓`);
  };

  const handleRefreshRecords = async () => {
    try {
      const records = await fetchSheetRecords();
      setSheetRecords(records);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefreshFiles = async () => {
    try {
      const filesData = await fetchFiles();
      setFiles(filesData);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        files={files}
        sheetRecordsCount={sheetRecords.length}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/60 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs font-medium">Đang khởi tạo hệ thống lưu trữ & liên kết API...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: KHO TÀI NGUYÊN (ASSET MANAGER) */}
            {activeTab === 'manager' && (
              <AssetManager
                files={files}
                onRefreshFiles={handleRefreshFiles}
                onOpenDetailModal={(file) => setSelectedFileForDetail(file)}
                onOpenQrModal={(url, title) => setQrModalData({ url, title })}
                onOpenUploadTab={() => setActiveTab('upload')}
                onOpenSheetsTab={() => setActiveTab('sheets')}
              />
            )}

            {/* TAB 2: TẢI LÊN MỚI (UPLOAD CENTER) */}
            {activeTab === 'upload' && (
              <UploadZone
                onUploadSuccess={handleUploadSuccess}
                config={config}
                onOpenSheetsTab={() => setActiveTab('sheets')}
                onOpenDetailModal={(file) => setSelectedFileForDetail(file)}
              />
            )}

            {/* TAB 3: GOOGLE SHEETS SYNC */}
            {activeTab === 'sheets' && (
              <GoogleSheetsTab
                sheetRecords={sheetRecords}
                files={files}
                config={config}
                onUpdateConfig={setConfig}
                onRefreshRecords={handleRefreshRecords}
                onRefreshFiles={handleRefreshFiles}
              />
            )}

            {/* TAB 4: TRUNG TÂM LIÊN KẾT API NGOÀI (EXTERNAL INTEGRATIONS HUB) */}
            {activeTab === 'integrations' && (
              <IntegrationsHub
                config={config}
                onUpdateConfig={setConfig}
                onOpenSheetsTab={() => setActiveTab('sheets')}
              />
            )}

            {/* TAB 5: NHẬT KÝ SỰ KIỆN API (LOGS) */}
            {activeTab === 'logs' && <ApiLogsTab />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">CloudAsset Hub & Link Exchanger</span>
            <span>•</span>
            <span>Tập trung hoá lưu trữ & Chia sẻ liên kết</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button onClick={() => setActiveTab('sheets')} className="hover:text-emerald-400 transition-colors cursor-pointer">
              Đồng bộ Google Sheets
            </button>
            <span>•</span>
            <button onClick={() => setActiveTab('integrations')} className="hover:text-indigo-400 transition-colors cursor-pointer">
              Discord & Telegram API
            </button>
            <span>•</span>
            <button onClick={() => setActiveTab('upload')} className="hover:text-white transition-colors cursor-pointer">
              Tải lên
            </button>
          </div>
        </div>
      </footer>

      {/* Detail & Share Modal */}
      {selectedFileForDetail && (
        <AssetDetailModal
          file={selectedFileForDetail}
          onClose={() => {
            setSelectedFileForDetail(null);
            // clear hash without reload
            if (window.location.hash.startsWith('#view=')) {
              history.pushState('', document.title, window.location.pathname + window.location.search);
            }
          }}
          config={config}
          onFileUpdated={() => {
            handleRefreshFiles();
            handleRefreshRecords();
          }}
          onOpenSheetsTab={() => {
            setSelectedFileForDetail(null);
            setActiveTab('sheets');
          }}
        />
      )}

      {/* Standalone QR Code Modal */}
      {qrModalData && (
        <QrModal
          url={qrModalData.url}
          title={qrModalData.title}
          onClose={() => setQrModalData(null)}
        />
      )}
    </div>
  );
}
