import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '@/config/api';
import { QrCode, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { initSocket, getSocket, onQRCode, onInstanceConnected, removeQRListener, removeInstanceConnectedListener, waitForSocketConnection } from '@/utils/socketClient';

interface ConnectWhatsAppProps {
  instanceId: string | number;
  onConnected?: () => void;
}

const ConnectWhatsApp: React.FC<ConnectWhatsAppProps> = ({ instanceId, onConnected }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const statusCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inicializa Socket.IO quando o componente monta
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        initSocket(token);
        console.log('✅ Socket.IO inicializado');
      }
    } catch (err) {
      console.warn('⚠️ Erro ao inicializar Socket.IO:', err);
    }
  }, []);

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

      console.log(`🔗 Iniciando conexão para instância ${instanceId}`);

      // 1. Inicializa Socket.IO se não estiver já
      initSocket(token);

      // 2. Aguarda conexão do Socket.IO
      console.log(`⏳ Aguardando conexão Socket.IO...`);
      try {
        await waitForSocketConnection();
        console.log(`✅ Socket.IO conectado!`);
      } catch (socketError: any) {
        console.warn(`⚠️ Socket.IO timeout, continuando mesmo assim:`, socketError.message);
        // Continua mesmo com erro de socket - pode ainda funcionar
      }

      // 3. Registra listeners para QR e conexão
      onQRCode((data) => {
        if (data.instanceId === Number(instanceId)) {
          console.log(`✅ QR Code recebido via WebSocket para instância ${instanceId}!`);
          setQrCode(data.qrCode);
          setLoading(false);
          // Limpar polling quando QR é recebido via WebSocket
          if (qrPollRef.current) {
            clearInterval(qrPollRef.current);
            qrPollRef.current = null;
          }
        }
      });

      // Escutar evento de conexão bem-sucedida
      onInstanceConnected((data) => {
        if (data.instanceId === Number(instanceId)) {
          console.log(`✅✅✅ CONEXÃO ESTABELECIDA COM SUCESSO! ✅✅✅ Número: ${data.phoneNumber}`);
          setConnected(true);
          setQrCode(null);
          setError('');
          removeQRListener();
          removeInstanceConnectedListener();
          
          if (statusCheckRef.current) {
            clearInterval(statusCheckRef.current);
            statusCheckRef.current = null;
          }

          if (onConnected) {
            onConnected();
          }
        }
      });

      // 4. Chamar endpoint para iniciar conexão
      const connectResponse = await fetchAPI(`/instances/${instanceId}/connect`, {
        method: 'POST'
      });
      
      console.log('✅ Conexão iniciada, aguardando QR code via WebSocket...', connectResponse);

      // Se a resposta já tem QR code, usa imediatamente
      if (connectResponse?.qrCode) {
        console.log(`✅ QR Code retornado imediatamente da resposta POST!`);
        setQrCode(connectResponse.qrCode);
        setLoading(false);
        if (qrPollRef.current) {
          clearInterval(qrPollRef.current);
          qrPollRef.current = null;
        }
        return;
      }

      // Busca o QR code imediatamente após conexão iniciada
      // (pode não vir imediatamente via WebSocket, então faz fallback com polling)
      let qrAttempts = 0;
      const maxQRAttempts = 45; // 45 tentativas = até 90 segundos com backoff
      
      qrPollRef.current = setInterval(async () => {
        qrAttempts++;
        try {
          const qrResponse = await fetchAPI(`/instances/${instanceId}/qr`, {
            method: 'GET'
          });
          
          console.log(`[QR-FETCH] Tentativa ${qrAttempts}/${maxQRAttempts}: status=${qrResponse?.status}, hasQR=${!!qrResponse?.qrCode}`);
          
          if (qrResponse?.qrCode) {
            console.log(`✅ QR Code obtido via polling (tentativa ${qrAttempts})!`);
            setQrCode(qrResponse.qrCode);
            setLoading(false);
            if (qrPollRef.current) {
              clearInterval(qrPollRef.current);
              qrPollRef.current = null;
            }
          } else if (qrResponse?.status === 'awaiting') {
            // QR ainda não pronto, mas está aguardando
            console.log(`⏳ QR aguardando (tentativa ${qrAttempts}/${maxQRAttempts})...`);
          } else if (qrAttempts >= maxQRAttempts) {
            // Após max tentativas, parar
            console.warn(`⚠️ QR code não gerado após ${qrAttempts} tentativas (${qrAttempts * 2}s)`);
            if (qrPollRef.current) {
              clearInterval(qrPollRef.current);
              qrPollRef.current = null;
            }
            setLoading(false);
          }
        } catch (error: any) {
          console.warn(`⚠️ Erro ao buscar QR via polling (tentativa ${qrAttempts}):`, error?.message);
          if (qrAttempts >= maxQRAttempts) {
            if (qrPollRef.current) {
              clearInterval(qrPollRef.current);
              qrPollRef.current = null;
            }
            setError('Erro ao obter QR Code. Tente novamente.');
            setLoading(false);
          }
        }
      }, 2000); // Polling a cada 2 segundos

      // Timeout de 5 minutos inicia apenas depois que começou o loading
      const timeoutMs = 300000; // 5 minutos
      const timeoutHandle = setTimeout(() => {
        if (loading) {
          console.error('❌ Timeout de 5 minutos excedido');
          setError('Tempo esgotado. QR code não foi gerado. Tente novamente.');
          setLoading(false);
          if (qrPollRef.current) {
            clearInterval(qrPollRef.current);
            qrPollRef.current = null;
          }
          removeQRListener();
          removeInstanceConnectedListener();
        }
      }, timeoutMs);

    } catch (error: any) {
      console.error('❌ Erro ao conectar:', error);
      setError(error.message || 'Erro ao conectar WhatsApp');
      setLoading(false);
      removeQRListener();
      removeInstanceConnectedListener();
    }
  };

  const disconnect = async () => {
    try {
      await fetchAPI(`/instances/${instanceId}`, {
        method: 'DELETE'
      });
      setConnected(false);
      setQrCode(null);
      removeQRListener();
      removeInstanceConnectedListener();
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
    }
  };

  // Verifica o status de conexão da instância
  const checkConnectionStatus = async () => {
    try {
      const response = await fetchAPI(`/instances/${instanceId}`, {
        method: 'GET'
      });
      
      if (response && response.status === 'connected') {
        console.log('✅✅✅ CONEXÃO ESTABELECIDA COM SUCESSO! ✅✅✅');
        setConnected(true);
        // Limpar polling quando conexão é estabelecida
        if (qrPollRef.current) clearInterval(qrPollRef.current);
        setError('');
        
        // Para o polling de verificação
        if (statusCheckRef.current) {
          clearInterval(statusCheckRef.current);
          statusCheckRef.current = null;
        }
      }
    } catch (error: any) {
      console.warn('⏳ Aguardando conexão...', error.message);
    }
  };

  // Quando QR code é gerado, começa a verificar o status de conexão
  useEffect(() => {
    if (qrCode && !connected) {
      console.log('🔍 Começando a monitorar status de conexão...');
      
      if (statusCheckRef.current) {
        clearInterval(statusCheckRef.current);
      }
      
      // Verifica status a cada 2 segundos
      statusCheckRef.current = setInterval(() => {
        checkConnectionStatus();
      }, 2000);
    }
    
    return () => {
      if (statusCheckRef.current) {
        clearInterval(statusCheckRef.current);
      }
    };
  }, [qrCode, connected]);

  // Auto-reload na conexão bem-sucedida
  useEffect(() => {
    if (connected) {
      console.log('🎉 Conexão bem-sucedida, fechando modal em 2 segundos...');
      const timer = setTimeout(() => {
        if (onConnected) onConnected();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [connected, onConnected]);

  // Cleanup quando componente desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
      if (qrPollRef.current) clearInterval(qrPollRef.current);
    };
  }, [instanceId]);

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
              if (qrPollRef.current) clearInterval(qrPollRef.current);
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
        <div className="text-center py-8 space-y-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6">
          <CheckCircle2 size={56} className="text-emerald-500 mx-auto animate-bounce" />
          <div>
            <p className="text-emerald-400 font-black text-2xl uppercase tracking-widest">
              ✅ Conexão Estabelecida com Sucesso!
            </p>
            <p className="text-emerald-300 text-sm mt-2 font-medium">
              Seu WhatsApp foi conectado e está pronto para uso
            </p>
          </div>
          <button
            onClick={disconnect}
            className="w-full mt-6 bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 border border-rose-500/30 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
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