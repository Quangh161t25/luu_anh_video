import React, { useState } from 'react';
import { 
  Webhook, 
  FileSpreadsheet, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ExternalLink, 
  Settings, 
  Power, 
  Radio, 
  Key, 
  ShieldCheck, 
  Layers,
  HelpCircle,
  Play,
  Globe2,
  Image as ImageIcon
} from 'lucide-react';
import { IntegrationsConfig, StorageProvider } from '../types';
import { saveIntegrationsConfig, uploadDirectImgbb } from '../utils/api';

interface IntegrationsHubProps {
  config: IntegrationsConfig;
  onUpdateConfig: (newConfig: IntegrationsConfig) => void;
  onOpenSheetsTab: () => void;
}

export const IntegrationsHub: React.FC<IntegrationsHubProps> = ({
  config,
  onUpdateConfig,
  onOpenSheetsTab,
}) => {
  // Modal states for configuring each service
  const [activeModal, setActiveModal] = useState<'imgbb' | 'catbox' | 'discord' | 'telegram' | 'webhook' | null>(null);

  // Form states for ImgBB
  const [imgbbApiKey, setImgbbApiKey] = useState(config.imgbb?.apiKey || '');

  // Form states for Catbox
  const [catboxUserhash, setCatboxUserhash] = useState(config.catbox?.userhash || '');
  const [catboxProvider, setCatboxProvider] = useState<StorageProvider>(config.catbox?.defaultProvider || 'catbox');
  const [catboxExpiry, setCatboxExpiry] = useState<'1h' | '12h' | '24h' | '72h'>(config.catbox?.litterboxExpiry || '72h');

  // Form states for Discord
  const [discordWebhook, setDiscordWebhook] = useState(config.discord.webhookUrl || '');
  const [discordAutoSync, setDiscordAutoSync] = useState(config.discord.autoSyncOnUpload ?? false);

  // Form states for Telegram
  const [telegramToken, setTelegramToken] = useState(config.telegram.botToken || '');
  const [telegramChatId, setTelegramChatId] = useState(config.telegram.chatId || '');
  const [telegramAutoSync, setTelegramAutoSync] = useState(config.telegram.autoSyncOnUpload ?? false);

  // Form states for Webhook
  const [webhookUrl, setWebhookUrl] = useState(config.customWebhook.targetUrl || '');
  const [webhookSecret, setWebhookSecret] = useState(config.customWebhook.secretToken || '');
  const [webhookHeaderKey, setWebhookHeaderKey] = useState(config.customWebhook.customHeaderKey || 'X-Secret-Key');
  const [webhookHeaderVal, setWebhookHeaderVal] = useState(config.customWebhook.customHeaderValue || '');
  const [webhookAutoSync, setWebhookAutoSync] = useState(config.customWebhook.autoSyncOnUpload ?? false);

  const [testStatus, setTestStatus] = useState<{ service: string; success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const saveConfig = (newCfg: IntegrationsConfig) => {
    onUpdateConfig(newCfg);
    saveIntegrationsConfig(newCfg);
  };

  const handleToggleService = (service: 'imgbb' | 'catbox' | 'googleSheets' | 'discord' | 'telegram' | 'customWebhook') => {
    const updated = {
      ...config,
      [service]: {
        ...(config as any)[service],
        enabled: !(config as any)[service]?.enabled,
      },
    };
    saveConfig(updated);
  };

  const handleSaveImgbb = () => {
    const updated: IntegrationsConfig = {
      ...config,
      imgbb: {
        ...config.imgbb,
        apiKey: imgbbApiKey.trim(),
        enabled: true,
      },
    };
    saveConfig(updated);
    setActiveModal(null);
  };

  const handleTestImgbb = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const testFile = new File([blob], 'test_ping.png', { type: 'image/png' });

      const res = await uploadDirectImgbb(testFile, imgbbApiKey.trim() || undefined);
      setTestStatus({
        service: 'imgbb',
        success: true,
        message: `✓ Kết nối ImgBB thành công! Link ảnh kiểm tra: ${res.url}`,
      });
    } catch (e: any) {
      setTestStatus({ service: 'imgbb', success: false, message: `Lỗi kết nối ImgBB: ${e.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCatbox = () => {
    const updated: IntegrationsConfig = {
      ...config,
      catbox: {
        ...config.catbox,
        userhash: catboxUserhash.trim(),
        defaultProvider: catboxProvider,
        litterboxExpiry: catboxExpiry,
        enabled: true,
      },
    };
    saveConfig(updated);
    setActiveModal(null);
  };

  const handleTestCatbox = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const sampleText = `CloudAsset Hub Ping Test - ${new Date().toISOString()}`;
      const base64 = btoa(sampleText);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'test_catbox_ping.txt',
          base64: `data:text/plain;base64,${base64}`,
          mimeType: 'text/plain',
          provider: catboxProvider,
          userhash: catboxUserhash.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.externalUrl) {
        setTestStatus({
          service: 'catbox',
          success: true,
          message: `✓ Kết nối ${data.provider.toUpperCase()} thành công! Link công khai thử nghiệm: ${data.externalUrl}`,
        });
      } else {
        setTestStatus({
          service: 'catbox',
          success: false,
          message: `Lỗi kết nối Catbox: ${data.error || 'Không nhận được URL công khai'}`,
        });
      }
    } catch (e: any) {
      setTestStatus({ service: 'catbox', success: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveDiscord = () => {
    const updated: IntegrationsConfig = {
      ...config,
      discord: {
        ...config.discord,
        webhookUrl: discordWebhook.trim(),
        autoSyncOnUpload: discordAutoSync,
        enabled: !!discordWebhook.trim(),
      },
    };
    saveConfig(updated);
    setActiveModal(null);
  };

  const handleTestDiscord = async () => {
    if (!discordWebhook.trim()) {
      alert('Vui lòng nhập Discord Webhook URL trước khi thử nghiệm.');
      return;
    }
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/integrations/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: discordWebhook.trim(),
          message: '🚀 **Kiểm tra kết nối thành công!** CloudAsset Hub đã liên kết với kênh Discord của bạn.',
        }),
      });
      const data = await res.json();
      setTestStatus({
        service: 'discord',
        success: data.success,
        message: data.success ? 'Đã gửi thông báo kiểm tra đến Discord thành công!' : (data.error || 'Lỗi gửi Discord'),
      });
    } catch (e: any) {
      setTestStatus({ service: 'discord', success: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveTelegram = () => {
    const updated: IntegrationsConfig = {
      ...config,
      telegram: {
        ...config.telegram,
        botToken: telegramToken.trim(),
        chatId: telegramChatId.trim(),
        autoSyncOnUpload: telegramAutoSync,
        enabled: !!(telegramToken.trim() && telegramChatId.trim()),
      },
    };
    saveConfig(updated);
    setActiveModal(null);
  };

  const handleTestTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      alert('Vui lòng nhập Bot Token và Chat ID trước.');
      return;
    }
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/integrations/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramToken.trim(),
          chatId: telegramChatId.trim(),
          customCaption: '🚀 *Kiểm tra kết nối thành công!* CloudAsset Hub đã kết nối Telegram.',
        }),
      });
      const data = await res.json();
      setTestStatus({
        service: 'telegram',
        success: data.success,
        message: data.success ? 'Đã gửi tin nhắn kiểm tra đến Telegram thành công!' : (data.error || 'Lỗi gửi Telegram'),
      });
    } catch (e: any) {
      setTestStatus({ service: 'telegram', success: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveWebhook = () => {
    const updated: IntegrationsConfig = {
      ...config,
      customWebhook: {
        ...config.customWebhook,
        targetUrl: webhookUrl.trim(),
        secretToken: webhookSecret.trim(),
        customHeaderKey: webhookHeaderKey.trim(),
        customHeaderValue: webhookHeaderVal.trim(),
        autoSyncOnUpload: webhookAutoSync,
        enabled: !!webhookUrl.trim(),
      },
    };
    saveConfig(updated);
    setActiveModal(null);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      alert('Vui lòng nhập Target URL trước.');
      return;
    }
    setIsTesting(true);
    setTestStatus(null);
    try {
      const headers: Record<string, string> = {};
      if (webhookHeaderKey && webhookHeaderVal) headers[webhookHeaderKey] = webhookHeaderVal;
      if (webhookSecret) headers['Authorization'] = `Bearer ${webhookSecret}`;

      const res = await fetch('/api/integrations/custom-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: webhookUrl.trim(),
          headers,
          eventType: 'test.ping',
          fallbackAsset: {
            name: 'sample_ping.txt',
            size: 1024,
            shareUrl: `${window.location.origin}/#test`,
          },
        }),
      });
      const data = await res.json();
      setTestStatus({
        service: 'webhook',
        success: data.success,
        message: data.success
          ? `✓ Webhook phản hồi HTTP ${data.status} thành công!`
          : `Lỗi: ${data.error || 'Endpoint không phản hồi 200 OK'}`,
      });
    } catch (e: any) {
      setTestStatus({ service: 'webhook', success: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 flex-shrink-0">
              <Webhook className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Trung Tâm Liên Kết API Ngoài (External Integrations Hub)
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
                Tự động gửi thông báo, hình ảnh và link chia sẻ tới <strong>Google Sheets</strong>, <strong>Discord</strong>, <strong>Telegram</strong> và các hệ thống tự động hoá (Zapier, Make.com, n8n, CRM) ngay khi có tệp mới được tải lên.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD -1: IMGBB IMAGE HOSTING */}
        <div className="bg-slate-900 rounded-2xl border border-pink-500/40 p-5 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center border border-pink-500/30">
                <ImageIcon className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                  {config.imgbb?.enabled !== false ? 'Đang Bật' : 'Đang Tắt'}
                </span>
                <button
                  onClick={() => handleToggleService('imgbb')}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    config.imgbb?.enabled !== false ? 'text-pink-400 hover:text-pink-300' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title="Bật/Tắt ImgBB"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h4 className="font-bold text-white text-base">ImgBB Image Hosting</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Lưu trữ hình ảnh <strong>vĩnh viễn</strong> lên CDN <code>i.ibb.co</code>. Tốc độ cực nhanh, hỗ trợ thumbnail và liên kết trực tiếp không bao giờ bị die link.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Giới hạn tệp:</span>
                <span className="text-pink-400 font-medium">32MB / ảnh (Vĩnh viễn)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">API Key:</span>
                <span className="text-white font-mono">{config.imgbb?.apiKey ? 'Đã gán Key riêng ✓' : 'Khóa mặc định (Miễn phí)'}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800 flex gap-2">
            <button
              onClick={() => setActiveModal('imgbb')}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài Đặt</span>
            </button>

            <button
              onClick={handleTestImgbb}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/40 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
              title="Thử nghiệm tải lên ImgBB"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Thử</span>
            </button>
          </div>
        </div>

        {/* CARD 0: CATBOX.MOE & PUBLIC HOSTING */}
        <div className="bg-slate-900 rounded-2xl border border-sky-500/40 p-5 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                <Globe2 className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  {config.catbox?.enabled !== false ? 'Đang Bật' : 'Đang Tắt'}
                </span>
                <button
                  onClick={() => handleToggleService('catbox')}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    config.catbox?.enabled !== false ? 'text-sky-400 hover:text-sky-300' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title="Bật/Tắt Catbox"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h4 className="font-bold text-white text-base">Catbox.moe & Public Hosting</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Tạo link trực tiếp công khai toàn cầu <code>files.catbox.moe/...</code>. Mở được trên mọi máy tính, điện thoại bên ngoài mà không cần tài khoản hay đăng nhập.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Mặc định:</span>
                <span className="text-sky-400 font-medium">🐱 Catbox (Vĩnh viễn)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tài khoản Userhash:</span>
                <span className="text-white font-mono">{config.catbox?.userhash ? 'Đã gán ✓' : 'Vô danh (Ẩn danh)'}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800 flex gap-2">
            <button
              onClick={() => setActiveModal('catbox')}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài Đặt</span>
            </button>

            <button
              onClick={handleTestCatbox}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
              title="Thử nghiệm tải lên Catbox"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Thử</span>
            </button>
          </div>
        </div>

        {/* CARD 1: GOOGLE SHEETS */}
        <div className="bg-slate-900 rounded-2xl border border-emerald-500/40 p-5 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <FileSpreadsheet className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {config.googleSheets.enabled ? 'Đang Bật' : 'Đang Tắt'}
                </span>
                <button
                  onClick={() => handleToggleService('googleSheets')}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    config.googleSheets.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title="Bật/Tắt đồng bộ Google Sheets"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h4 className="font-bold text-white text-base">Google Sheets</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Tự động lưu tên file, loại, dung lượng, link chia sẻ trực tiếp về bảng tính Google Sheets ngay sau khi tải lên.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Trạng thái:</span>
                <span className="text-emerald-400 font-medium">✓ Sẵn sàng</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tự động sau upload:</span>
                <span className="text-white font-medium">{config.googleSheets.autoSyncOnUpload ? 'Bật' : 'Tắt'}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800">
            <button
              onClick={onOpenSheetsTab}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Mở Bảng & Cấu Hình Google Sheets</span>
            </button>
          </div>
        </div>

        {/* CARD 2: DISCORD WEBHOOK */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700 p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center border border-[#5865F2]/30">
                <Send className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  config.discord.enabled && config.discord.webhookUrl
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}>
                  {config.discord.enabled && config.discord.webhookUrl ? 'Đang Bật' : 'Chưa Kết Nối'}
                </span>
                <button
                  onClick={() => handleToggleService('discord')}
                  disabled={!config.discord.webhookUrl}
                  className={`p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-30 ${
                    config.discord.enabled ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title="Bật/Tắt Discord"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h4 className="font-bold text-white text-base">Discord Webhook</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Tự động gửi thông báo với ảnh xem trước (embed), kích thước và link tải trực tiếp đến kênh Discord của bạn.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Webhook URL:</span>
                <span className="text-slate-300 font-mono truncate max-w-[140px]">
                  {config.discord.webhookUrl ? 'Đã cấu hình ✓' : 'Chưa có'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tự động sau upload:</span>
                <span className="text-white font-medium">{config.discord.autoSyncOnUpload ? 'Bật' : 'Tắt'}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800 flex gap-2">
            <button
              onClick={() => setActiveModal('discord')}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài Đặt</span>
            </button>

            {config.discord.webhookUrl && (
              <button
                onClick={handleTestDiscord}
                disabled={isTesting}
                className="px-3 py-2 rounded-xl bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-[#5865F2] border border-[#5865F2]/40 text-xs font-semibold transition-all cursor-pointer"
                title="Gửi thử nghiệm"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* CARD 3: TELEGRAM BOT */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700 p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#229ED9]/20 text-[#229ED9] flex items-center justify-center border border-[#229ED9]/30">
                <Send className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  config.telegram.enabled && config.telegram.botToken
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}>
                  {config.telegram.enabled && config.telegram.botToken ? 'Đang Bật' : 'Chưa Kết Nối'}
                </span>
                <button
                  onClick={() => handleToggleService('telegram')}
                  disabled={!config.telegram.botToken}
                  className={`p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-30 ${
                    config.telegram.enabled ? 'text-sky-400 hover:text-sky-300' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title="Bật/Tắt Telegram"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h4 className="font-bold text-white text-base">Telegram Bot API</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Gửi tin nhắn thông báo tệp mới kèm theo link chia sẻ trực tiếp tới nhóm hoặc kênh Telegram cá nhân qua Bot.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Bot Token:</span>
                <span className="text-slate-300 font-mono">
                  {config.telegram.botToken ? 'Đã cấu hình ✓' : 'Chưa có'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Chat ID:</span>
                <span className="text-white font-mono">{config.telegram.chatId || '---'}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800 flex gap-2">
            <button
              onClick={() => setActiveModal('telegram')}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài Đặt</span>
            </button>

            {config.telegram.botToken && (
              <button
                onClick={handleTestTelegram}
                disabled={isTesting}
                className="px-3 py-2 rounded-xl bg-[#229ED9]/20 hover:bg-[#229ED9]/30 text-[#229ED9] border border-[#229ED9]/40 text-xs font-semibold transition-all cursor-pointer"
                title="Gửi thử nghiệm"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* CARD 4: CUSTOM REST WEBHOOK */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700 p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <Webhook className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  config.customWebhook.enabled && config.customWebhook.targetUrl
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}>
                  {config.customWebhook.enabled && config.customWebhook.targetUrl ? 'Đang Bật' : 'Chưa Kết Nối'}
                </span>
                <button
                  onClick={() => handleToggleService('customWebhook')}
                  disabled={!config.customWebhook.targetUrl}
                  className={`p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-30 ${
                    config.customWebhook.enabled ? 'text-purple-400 hover:text-purple-300' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title="Bật/Tắt Custom Webhook"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h4 className="font-bold text-white text-base">Custom REST Webhook</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Bắn tín hiệu JSON payload (HTTP POST) tới Zapier, Make.com, n8n, hoặc API máy chủ riêng của bạn.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target Endpoint:</span>
                <span className="text-slate-300 font-mono truncate max-w-[140px]">
                  {config.customWebhook.targetUrl ? config.customWebhook.targetUrl : 'Chưa có'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Xác thực:</span>
                <span className="text-white font-mono">
                  {config.customWebhook.secretToken ? 'Bearer Token' : 'None'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800 flex gap-2">
            <button
              onClick={() => setActiveModal('webhook')}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài Đặt</span>
            </button>

            {config.customWebhook.targetUrl && (
              <button
                onClick={handleTestWebhook}
                disabled={isTesting}
                className="px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold transition-all cursor-pointer"
                title="Gửi thử nghiệm"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* CARD 5: SHORTENER API */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700 p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Tích Hợp Sẵn
              </span>
            </div>

            <h4 className="font-bold text-white text-base">URL Shortener Engine</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Hệ thống tự động cấp đường link ngắn gọn <code>/s/:code</code> để chia sẻ nhanh chóng qua tin nhắn SMS, Zalo, Facebook mà không bị gãy link.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Chuyển hướng tức thì, không quảng cáo</span>
          </div>
        </div>
      </div>

      {/* Test feedback toast */}
      {testStatus && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            testStatus.success
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {testStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{testStatus.message}</span>
          </div>
          <button onClick={() => setTestStatus(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* DISCORD CONFIG MODAL */}
      {activeModal === 'discord' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Send className="w-5 h-5 text-[#5865F2]" />
              <span>Cài đặt Discord Webhook</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Vào cài đặt kênh Discord của bạn → <strong>Integrations (Tích hợp)</strong> → <strong>Webhooks</strong> → Tạo webhook mới và dán URL vào đây.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Discord Webhook URL:</label>
                <input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordWebhook}
                  onChange={(e) => setDiscordWebhook(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={discordAutoSync}
                  onChange={(e) => setDiscordAutoSync(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Tự động gửi thông báo đến Discord ngay khi tải file lên</span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={handleTestDiscord}
                disabled={isTesting}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {isTesting ? 'Đang gửi test...' : 'Gửi thử nghiệm'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSaveDiscord}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  Lưu cài đặt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELEGRAM CONFIG MODAL */}
      {activeModal === 'telegram' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Send className="w-5 h-5 text-[#229ED9]" />
              <span>Cài đặt Telegram Bot API</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tạo Bot qua <strong>@BotFather</strong> trên Telegram để lấy Bot Token, và dùng <strong>@userinfobot</strong> để lấy Chat ID của bạn.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Bot Token:</label>
                <input
                  type="text"
                  placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz..."
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Chat ID (Người dùng hoặc Group):</label>
                <input
                  type="text"
                  placeholder="123456789 hoặc -100123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={telegramAutoSync}
                  onChange={(e) => setTelegramAutoSync(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>Tự động gửi thông báo đến Telegram ngay khi tải file lên</span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={handleTestTelegram}
                disabled={isTesting}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {isTesting ? 'Đang gửi test...' : 'Gửi thử nghiệm'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSaveTelegram}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/30 cursor-pointer"
                >
                  Lưu cài đặt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM WEBHOOK MODAL */}
      {activeModal === 'webhook' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Webhook className="w-5 h-5 text-purple-400" />
              <span>Cài đặt Custom REST Webhook</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hệ thống sẽ gửi yêu cầu <code>POST JSON</code> kèm theo chi tiết tệp tới URL của bạn.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Endpoint URL:</label>
                <input
                  type="url"
                  placeholder="https://api.yourdomain.com/webhooks/asset-uploaded"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Bearer Secret Token (Tùy chọn):</label>
                <input
                  type="password"
                  placeholder="Bearer token hoặc API secret..."
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Custom Header Key:</label>
                  <input
                    type="text"
                    placeholder="X-Custom-Secret"
                    value={webhookHeaderKey}
                    onChange={(e) => setWebhookHeaderKey(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Header Value:</label>
                  <input
                    type="text"
                    placeholder="secret-value"
                    value={webhookHeaderVal}
                    onChange={(e) => setWebhookHeaderVal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={webhookAutoSync}
                  onChange={(e) => setWebhookAutoSync(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span>Tự động gọi Webhook ngay khi tải file lên</span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={handleTestWebhook}
                disabled={isTesting}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {isTesting ? 'Đang gọi test...' : 'Gửi thử nghiệm'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSaveWebhook}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 cursor-pointer"
                >
                  Lưu cài đặt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATBOX & PUBLIC HOSTING CONFIG MODAL */}
      {activeModal === 'catbox' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-sky-400" />
              <span>Cài đặt Catbox.moe & Public Hosting</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Catbox.moe là dịch vụ lưu trữ tệp công khai miễn phí hàng đầu. Khi liên kết, bất kỳ ai có đường link đều xem hoặc tải được trực tiếp ở mọi mạng ngoài mà không bị giới hạn.
            </p>

            <div className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nguồn lưu trữ mặc định:</label>
                <select
                  value={catboxProvider}
                  onChange={(e: any) => setCatboxProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="catbox">🐱 Catbox.moe (Công khai vĩnh viễn - Tự động fallback Uguu)</option>
                  <option value="uguu">⚡ Uguu.se CDN (100MB, Cực nhanh, mở được 100% mọi nơi)</option>
                  <option value="tmpfiles">📦 TmpFiles.org (Trực tiếp toàn cầu không giới hạn)</option>
                  <option value="litterbox">⏱️ Litterbox (Tạm thời lên tới 1GB/tệp)</option>
                  <option value="local">💻 Máy chủ riêng (Local server)</option>
                </select>
              </div>

              {catboxProvider === 'litterbox' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Thời hạn lưu trữ Litterbox:</label>
                  <select
                    value={catboxExpiry}
                    onChange={(e: any) => setCatboxExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="72h">72 giờ (3 ngày - Khuyên dùng)</option>
                    <option value="24h">24 giờ (1 ngày)</option>
                    <option value="12h">12 giờ</option>
                    <option value="1h">1 giờ</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Catbox Userhash (Tùy chọn - nếu bạn có tài khoản Catbox):
                </label>
                <input
                  type="text"
                  placeholder="Để trống nếu muốn tải lên ẩn danh (Anonymous)"
                  value={catboxUserhash}
                  onChange={(e) => setCatboxUserhash(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Lấy Userhash tại <a href="https://catbox.moe" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">catbox.moe</a> nếu muốn quản lý tệp theo tài khoản.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={handleTestCatbox}
                disabled={isTesting}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-sky-400" />
                <span>{isTesting ? 'Đang test...' : 'Thử nghiệm upload'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSaveCatbox}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/30 cursor-pointer"
                >
                  Lưu cài đặt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMGBB CONFIG MODAL */}
      {activeModal === 'imgbb' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-pink-400" />
              <span>Cài đặt ImgBB Image Hosting</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              ImgBB hỗ trợ lưu trữ hình ảnh vĩnh viễn với mạng CDN phân phối tốc độ cao. Bạn có thể sử dụng khóa API mặc định hoặc nhập API Key cá nhân từ ImgBB.
            </p>

            <div className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  ImgBB API Key (Tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="Để trống nếu muốn dùng khóa mặc định hệ thống"
                  value={imgbbApiKey}
                  onChange={(e) => setImgbbApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Lấy API Key miễn phí tại <a href="https://api.imgbb.com" target="_blank" rel="noreferrer" className="text-pink-400 hover:underline">api.imgbb.com</a>.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={handleTestImgbb}
                disabled={isTesting}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-pink-400" />
                <span>{isTesting ? 'Đang test...' : 'Thử nghiệm upload'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSaveImgbb}
                  className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-lg shadow-pink-600/30 cursor-pointer"
                >
                  Lưu cài đặt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
