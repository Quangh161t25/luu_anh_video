import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { generateQrCode } from '../utils/api';

interface QrModalProps {
  url: string | null;
  title?: string;
  onClose: () => void;
}

export const QrModal: React.FC<QrModalProps> = ({ url, title, onClose }) => {
  if (!url) return null;

  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQrCode(url).then(setQrSrc);
  }, [url]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="font-bold text-white text-sm truncate max-w-[220px]" title={title}>
            Mã QR: {title || 'Chia sẻ liên kết'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-white rounded-2xl mx-auto inline-block shadow-inner border border-slate-200">
          {qrSrc ? (
            <img src={qrSrc} alt="QR Code" className="w-56 h-56" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-500 text-xs">
              Đang tạo QR...
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Quét mã bằng camera điện thoại để mở tệp ngay lập tức
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Đã chép link' : 'Copy link'}</span>
          </button>

          {qrSrc && (
            <a
              href={qrSrc}
              download="qrcode_asset.png"
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Tải ảnh QR</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
