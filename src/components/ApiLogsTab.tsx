import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Filter, 
  Layers,
  Code2
} from 'lucide-react';
import { ApiLogEntry } from '../types';
import { loadApiLogs, clearApiLogs } from '../utils/api';

export const ApiLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null);

  const refreshLogs = () => {
    setLogs(loadApiLogs());
  };

  useEffect(() => {
    refreshLogs();
    const handleLogAdded = () => refreshLogs();
    window.addEventListener('cloudasset:log_added', handleLogAdded);
    window.addEventListener('cloudasset:logs_cleared', handleLogAdded);
    return () => {
      window.removeEventListener('cloudasset:log_added', handleLogAdded);
      window.removeEventListener('cloudasset:logs_cleared', handleLogAdded);
    };
  }, []);

  const handleClear = () => {
    if (window.confirm('Bạn có chắc muốn xoá toàn bộ nhật ký gọi API?')) {
      clearApiLogs();
      refreshLogs();
      setSelectedLog(null);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (selectedService === 'all') return true;
    return log.service.toLowerCase().includes(selectedService.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Nhật Ký Gọi API & Đồng Bộ Ngoài</h3>
            <p className="text-xs text-slate-400">
              Theo dõi lịch sử phát tín hiệu webhook, mã phản hồi HTTP và dữ liệu đã gửi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Service Filter */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Tất cả dịch vụ</option>
              <option value="google" className="bg-slate-900">Google Sheets</option>
              <option value="discord" className="bg-slate-900">Discord</option>
              <option value="telegram" className="bg-slate-900">Telegram</option>
              <option value="webhook" className="bg-slate-900">Custom Webhook</option>
            </select>
          </div>

          <button
            onClick={refreshLogs}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {logs.length > 0 && (
            <button
              onClick={handleClear}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition-colors"
              title="Xoá lịch sử"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Logs Table / List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-12 text-center text-slate-400 text-xs">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-slate-300">Chưa có nhật ký gọi API nào</p>
          <p className="text-slate-500 mt-0.5">
            Khi bạn tải file lên hoặc bấm "Thử nghiệm API", các sự kiện mạng sẽ được ghi nhận tại đây.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Thời Gian</th>
                  <th className="p-3">Dịch Vụ</th>
                  <th className="p-3">Đích Đến (Target)</th>
                  <th className="p-3">Mã HTTP / Trạng Thái</th>
                  <th className="p-3">Thông Điệp</th>
                  <th className="p-3 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN')} {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                    </td>

                    <td className="p-3 font-sans font-semibold text-white">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                        log.service === 'Google Sheets'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : log.service === 'Discord'
                          ? 'bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30'
                          : log.service === 'Telegram'
                          ? 'bg-[#229ED9]/20 text-[#229ED9] border border-[#229ED9]/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        {log.service}
                      </span>
                    </td>

                    <td className="p-3 text-slate-300 truncate max-w-xs">{log.target}</td>

                    <td className="p-3">
                      {log.status === 'success' ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{log.httpCode ? `HTTP ${log.httpCode}` : '200 OK'}</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 text-xs font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{log.httpCode ? `HTTP ${log.httpCode}` : 'Failed'}</span>
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-sans text-slate-300 max-w-sm truncate">
                      {log.message}
                    </td>

                    <td className="p-3 text-right">
                      {log.payload ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer"
                        >
                          Xem Payload
                        </button>
                      ) : (
                        <span className="text-slate-600">---</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Code2 className="w-5 h-5 text-sky-400" />
                <span>Chi tiết Payload - {selectedLog.service}</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-xs font-mono text-emerald-300 max-h-64 overflow-y-auto">
              <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
