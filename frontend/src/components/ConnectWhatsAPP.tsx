import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '@/config/api';
import { QrCode, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ConnectWhatsAppProps {
  instanceId: number;
  onConnected?: () => void;
}

const ConnectWhatsApp: React.FC<ConnectWhatsAppProps> = ({ instanceId, onConnected }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timer | null>(null);

  const connect = async () => {
    setLoading(true);
    setError('');
    setQrCode(null);

    try {
      // Verificar token
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Você precisa fazer login primeiro');
        setLoading(false);
        return;
      }

      // Iniciar conexão
      await fetchAPI(`/instances/${instanceId}/connect`, {
        method: 'POST'
      });

      // Poll para QR Code a cada 1 segundo - Timeout estendido para 5 minutos
      let attempts = 0;
      const maxAttempts = 300; // 5 minutos (300 * 1s)

      intervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const data = await fetchAPI(`/instances/${instanceId}/qr`);
          if (data.qrCode) {
            setQrCode(data.qrCode);
            setLoading(false);
          }

          if (attempts >= maxAttempts) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (!qrCode) {
              setError('Tempo esgotado. Tente novamente.');
              setLoading(false);
            }
          }
          console.log(`Tentativa ${attempts}: aguardando QR code...`);
        } catch (pollError) {
          // QR ainda não disponível, continuar tentando
        }
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      setError(error.message || 'Erro ao conectar WhatsApp');
      setLoading(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const disconnect = async () => {
    try {
      await fetchAPI(`/instances/${instanceId}`, {
        method: 'DELETE'
      });
      setConnected(false);
      setQrCode(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Auto-reload na conexão bem-sucedida
  useEffect(() => {
    if (connected) {
      setTimeout(() => {
        if (onConnected) onConnected();
      }, 2000);
    }
  }, [connected, onConnected]);

  return (
    <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-white uppercase flex items-center gap-2">
          <QrCode size={24} />
          Conectar WhatsApp
        </h2>
        {(qrCode || connected) && (
          <button
            onClick={() => {
              if (intervalRef.current) clearInterval(intervalRef.current);
              setQrCode(null);
              setLoading(false);
              setError('');
            }}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {!qrCode && !connected && !loading && (
        <button
          onClick={connect}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
        >
          <QrCode size={20} />
          Gerar QR Code
        </button>
      )}

      {loading && !qrCode && (
        <div className="text-center py-8">
          <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-white font-bold text-lg">Gerando QR Code...</p>
          <p className="text-slate-400 text-sm mt-2">Aguarde alguns segundos</p>
        </div>
      )}

      {qrCode && !connected && (
        <div className="text-center space-y-4">
          <div className="bg-white p-4 rounded-2xl inline-block">
            <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64" />
          </div>
          <div>
            <p className="text-white font-black text-lg mb-1">QR Code Gerado!</p>
            <p className="text-slate-400 text-sm font-medium">
              Escaneie o código com seu WhatsApp
            </p>
            <p className="text-slate-600 text-xs mt-3">
              WhatsApp → Aparelhos Conectados → Conectar Aparelho
            </p>
          </div>
        </div>
      )}

      {connected && (
        <div className="text-center py-8 space-y-4">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
          <div>
            <p className="text-white font-bold text-lg">WhatsApp Conectado!</p>
            <p className="text-slate-400 text-sm mt-1">Pronto para disparos</p>
          </div>
          <button
            onClick={disconnect}
            className="w-full mt-4 bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 border border-rose-500/30 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
          >
            Desconectar
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mt-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-rose-500 text-sm font-medium">Erro</p>
            <p className="text-rose-400 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectWhatsApp;