import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '@/config/api';
import { QrCode, Loader2, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { initSocket, onQRCode, onInstanceConnected, removeQRListener, removeInstanceConnectedListener } from '@/utils/socketClient';

interface ConnectWhatsAppProps {
  instanceId: string | number;
  onConnected?: () => void;
}

const ConnectWhatsApp: React.FC<ConnectWhatsAppProps> = ({ instanceId, onConnected }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const statusPollRef = useRef<NodeJS.Timeout | null>(null);
  const qrPollRef = useRef<NodeJS.Timeout | null>(null);
  const callbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAll();
    };
  }, []);

  const clearAll = () => {
    if (statusPollRef.current) { clearInterval(statusPollRef.current); statusPollRef.current = null; }
    if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
    if (callbackTimerRef.current) { clearTimeout(callbackTimerRef.current); callbackTimerRef.current = null; }
    removeQRListener();
    removeInstanceConnectedListener();
  };

  // Polling de status — verifica direto na Evolution API a cada 3s
  const startStatusPolling = () => {
    if (statusPollRef.current) clearInterval(statusPollRef.current);
    statusPollRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const data = await fetchAPI(`/instances/${instanceId}/check-status`);
        if (data?.status === 'connected') {
          if (!mountedRef.current) return;
          setConnected(true);
          setQrCode(null);
          clearAll();
          if (onConnected) { callbackTimerRef.current = setTimeout(onConnected, 1500); }
        }
      } catch { /* ignora */ }
    }, 3000);
  };

  // Polling de QR — busca QR a cada 3s até ter imagem
  const startQRPolling = () => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    let attempts = 0;
    qrPollRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      attempts++;
      try {
        const data = await fetchAPI(`/instances/${instanceId}/qr`);
        if (data?.status === 'connected') {
          setConnected(true);
          setQrCode(null);
          clearAll();
          if (onConnected) { callbackTimerRef.current = setTimeout(onConnected, 1500); }
          return;
        }
        if (data?.qrCode) {
          setQrCode(data.qrCode);
          setLoading(false);
          clearInterval(qrPollRef.current!);
          qrPollRef.current = null;
          startStatusPolling();
        }
      } catch { /* ignora */ }
      if (attempts > 30) {
        clearInterval(qrPollRef.current!);
        qrPollRef.current = null;
        if (mountedRef.current) { setLoading(false); setError('QR Code não disponível. Tente novamente.'); }
      }
    }, 3000);
  };

  const connect = async () => {
    clearAll();
    setLoading(true);
    setError('');
    setQrCode(null);
    setConnected(false);

    // Inicializa socket para receber eventos em tempo real
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      if (token) {
        initSocket(token);
        // Socket como canal primário
        onQRCode((data) => {
          if (data.instanceId === Number(instanceId) && mountedRef.current) {
            setQrCode(data.qrCode);
            setLoading(false);
            if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
            startStatusPolling();
          }
        });
        onInstanceConnected((data) => {
          if (data.instanceId === Number(instanceId) && mountedRef.current) {
            setConnected(true);
            setQrCode(null);
            clearAll();
            if (onConnected) { callbackTimerRef.current = setTimeout(onConnected, 1500); }
          }
        });
      }
    } catch { /* socket opcional */ }

    try {
      const res = await fetchAPI(`/instances/${instanceId}/connect`, { method: 'POST' });

      if (res?.status === 'connected' || res?.qrCode === null && res?.message?.includes('conectado')) {
        setConnected(true);
        setLoading(false);
        clearAll();
        if (onConnected) { callbackTimerRef.current = setTimeout(onConnected, 1500); }
        return;
      }

      if (res?.qrCode) {
        setQrCode(res.qrCode);
        setLoading(false);
        startStatusPolling();
        return;
      }

      // QR ainda não disponível — começa polling
      startQRPolling();

    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Erro ao conectar');
        setLoading(false);
      }
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    await connect();
    setRetrying(false);
  };

  return (
    <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-white uppercase flex items-center gap-2">
          <QrCode size={24} />
          Conectar WhatsApp
        </h2>
        {(qrCode || connected) && (
          <button onClick={() => { clearAll(); setQrCode(null); setLoading(false); setError(''); }}
            className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Botão inicial */}
      {!qrCode && !connected && !loading && (
        <button onClick={connect}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95">
          <QrCode size={20} /> Gerar QR Code
        </button>
      )}

      {/* Loading */}
      {loading && !qrCode && (
        <div className="text-center py-8">
          <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-white font-bold text-lg">Gerando QR Code...</p>
          <p className="text-slate-400 text-sm mt-2">Aguarde alguns segundos</p>
        </div>
      )}

      {/* QR Code */}
      {qrCode && !connected && (
        <div className="text-center space-y-4">
          <div className="bg-white p-4 rounded-2xl inline-block">
            <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64" />
          </div>
          <div>
            <p className="text-white font-black text-lg mb-1">Escaneie o QR Code</p>
            <p className="text-slate-400 text-sm">WhatsApp → Aparelhos Conectados → Conectar Aparelho</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 size={12} className="animate-spin" />
            <span>Aguardando conexão...</span>
          </div>
          <button onClick={handleRetry} disabled={retrying}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-400 underline mx-auto transition-colors">
            <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
            QR expirou? Gerar novo
          </button>
        </div>
      )}

      {/* Conectado */}
      {connected && (
        <div className="text-center py-8 space-y-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6">
          <CheckCircle2 size={56} className="text-emerald-500 mx-auto animate-bounce" />
          <p className="text-emerald-400 font-black text-xl uppercase tracking-widest">✅ Conectado!</p>
          <p className="text-emerald-300 text-sm">WhatsApp conectado e pronto para uso</p>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mt-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-rose-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-rose-400 text-sm">{error}</p>
            <button onClick={connect} className="text-xs text-rose-400 underline mt-2 hover:text-rose-300">
              Tentar novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectWhatsApp;