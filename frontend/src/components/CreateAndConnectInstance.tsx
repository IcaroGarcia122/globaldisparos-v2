import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '@/config/api';
import { Loader2, AlertCircle, CheckCircle2, QrCode, ArrowLeft } from 'lucide-react';
import { initSocket, onQRCode, onInstanceConnected } from '@/utils/socketClient';

interface CreateAndConnectInstanceProps {
  onSuccess?: (instanceId: number) => void;
  onBack?: () => void;
}

type Phase = 'idle' | 'creating' | 'connecting' | 'qr-ready' | 'connected' | 'error';

interface State {
  phase: Phase;
  instanceId?: number;
  qrCode?: string;
  errorMessage?: string;
  phoneNumber?: string;
}

const CreateAndConnectInstance: React.FC<CreateAndConnectInstanceProps> = ({ onSuccess, onBack }) => {
  const [instanceName, setInstanceName] = useState('');
  const [accountAge, setAccountAge] = useState(30);
  const [state, setState] = useState<State>({ phase: 'idle' });

  const qrPollRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollRef = useRef<NodeJS.Timeout | null>(null);
  const instanceIdRef = useRef<number | null>(null);

  // Limpa polls ao desmontar
  useEffect(() => {
    return () => {
      if (qrPollRef.current) clearInterval(qrPollRef.current);
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, []);

  // Inicia socket e escuta eventos quando tiver instanceId
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token');
    if (!token) return;
    initSocket(token);

    if (!state.instanceId) return;

    // Escuta QR via socket
    onQRCode((data) => {
      if (data.instanceId === state.instanceId) {
        setState(prev => ({ ...prev, phase: 'qr-ready', qrCode: data.qrCode }));
        if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
      }
    });

    // Escuta conexão via socket
    onInstanceConnected((data) => {
      if (data.instanceId === state.instanceId) {
        setState(prev => ({ ...prev, phase: 'connected', phoneNumber: data.phoneNumber }));
        if (statusPollRef.current) { clearInterval(statusPollRef.current); statusPollRef.current = null; }
        if (onSuccess) onSuccess(data.instanceId);
      }
    });
  }, [state.instanceId]);

  // Polling de status como fallback (verifica direto na Evolution)
  const startStatusPolling = (instanceId: number) => {
    if (statusPollRef.current) clearInterval(statusPollRef.current);

    statusPollRef.current = setInterval(async () => {
      try {
        const data = await fetchAPI(`/instances/${instanceId}/check-status`);
        if (data?.status === 'connected') {
          setState(prev => ({ ...prev, phase: 'connected', phoneNumber: data.phoneNumber }));
          clearInterval(statusPollRef.current!);
          statusPollRef.current = null;
          if (onSuccess) onSuccess(instanceId);
        }
      } catch { /* ignora */ }
    }, 3000);
  };

  // Polling de QR como fallback
  const startQRPolling = (instanceId: number) => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);

    qrPollRef.current = setInterval(async () => {
      try {
        const data = await fetchAPI(`/instances/${instanceId}/qr`);
        if (data?.status === 'connected') {
          setState(prev => ({ ...prev, phase: 'connected', phoneNumber: data.phoneNumber }));
          clearInterval(qrPollRef.current!);
          qrPollRef.current = null;
          if (onSuccess) onSuccess(instanceId);
          return;
        }
        if (data?.qrCode) {
          setState(prev => ({ ...prev, phase: 'qr-ready', qrCode: data.qrCode }));
          clearInterval(qrPollRef.current!);
          qrPollRef.current = null;
          // Começa polling de status para detectar quando escanear
          startStatusPolling(instanceId);
        }
      } catch { /* ignora */ }
    }, 3000);
  };

  const handleCreate = async () => {
    if (!instanceName.trim()) return;

    setState({ phase: 'creating' });

    try {
      // 1. Cria instância no banco
      const instance = await fetchAPI('/instances', {
        method: 'POST',
        body: { name: instanceName.trim(), accountAge }
      });

      const instanceId = instance.id || instance.data?.id;
      instanceIdRef.current = instanceId;
      setState({ phase: 'connecting', instanceId });

      // 2. Conecta (gera QR na Evolution)
      const connectData = await fetchAPI(`/instances/${instanceId}/connect`, { method: 'POST' });

      if (connectData?.qrCode) {
        // QR disponível imediatamente
        setState(prev => ({ ...prev, phase: 'qr-ready', qrCode: connectData.qrCode }));
        startStatusPolling(instanceId);
      } else if (connectData?.status === 'connected') {
        // Já estava conectada
        setState(prev => ({ ...prev, phase: 'connected' }));
        if (onSuccess) onSuccess(instanceId);
      } else {
        // QR ainda não disponível — polling
        startQRPolling(instanceId);
      }
    } catch (err: any) {
      setState({ phase: 'error', errorMessage: err.message || 'Erro ao criar instância' });
    }
  };

  const handleRetry = async () => {
    const instanceId = instanceIdRef.current;
    if (!instanceId) { setState({ phase: 'idle' }); return; }

    setState(prev => ({ ...prev, phase: 'connecting' }));

    try {
      const connectData = await fetchAPI(`/instances/${instanceId}/connect`, { method: 'POST' });
      if (connectData?.qrCode) {
        setState(prev => ({ ...prev, phase: 'qr-ready', qrCode: connectData.qrCode }));
        startStatusPolling(instanceId);
      } else {
        startQRPolling(instanceId);
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, phase: 'error', errorMessage: err.message }));
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="dashboard-card">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Criar Nova Instância</h2>
            <p className="text-slate-500 text-sm">Conecte um número WhatsApp</p>
          </div>
        </div>
      </div>

      {/* IDLE — formulário */}
      {state.phase === 'idle' && (
        <div className="dashboard-card space-y-5">
          <h3 className="text-sm font-black text-white uppercase">Nova Instância WhatsApp</h3>

          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Nome da Instância</label>
            <input
              type="text"
              value={instanceName}
              onChange={e => setInstanceName(e.target.value)}
              placeholder="ex: vendas, suporte, icaro..."
              className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-brand-500/50 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Idade da Conta (dias)</label>
            <input
              type="number"
              value={accountAge}
              onChange={e => setAccountAge(Number(e.target.value))}
              min={0}
              className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-brand-500/50 focus:outline-none text-sm"
            />
            <p className="text-xs text-slate-600 mt-1">Usado para calcular limites anti-ban (0 = conta nova)</p>
          </div>

          <button
            onClick={handleCreate}
            disabled={!instanceName.trim()}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-black text-sm uppercase rounded-xl transition-all disabled:opacity-40"
          >
            + Criar Instância
          </button>
        </div>
      )}

      {/* CREATING / CONNECTING */}
      {(state.phase === 'creating' || state.phase === 'connecting') && (
        <div className="dashboard-card flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 size={36} className="animate-spin text-brand-500" />
          <p className="text-white font-black text-sm uppercase">
            {state.phase === 'creating' ? 'Criando instância...' : 'Gerando QR Code...'}
          </p>
          <p className="text-slate-500 text-xs text-center">
            Conectando à Evolution API.<br />Aguarde alguns segundos.
          </p>
        </div>
      )}

      {/* QR READY */}
      {state.phase === 'qr-ready' && state.qrCode && (
        <div className="dashboard-card flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <QrCode size={20} className="text-brand-500" />
            <h3 className="text-sm font-black text-white uppercase">Escaneie o QR Code</h3>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-lg">
            <img src={state.qrCode} alt="QR Code WhatsApp" className="w-56 h-56 object-contain" />
          </div>

          <div className="text-center space-y-1">
            <p className="text-slate-300 text-sm font-semibold">Abra o WhatsApp no seu celular</p>
            <p className="text-slate-500 text-xs">Menu → Dispositivos Conectados → Conectar Dispositivo</p>
          </div>

          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Loader2 size={14} className="animate-spin" />
            <span>Aguardando conexão...</span>
          </div>

          <button
            onClick={handleRetry}
            className="text-xs text-slate-500 hover:text-brand-400 underline transition-colors"
          >
            QR expirou? Gerar novo
          </button>
        </div>
      )}

      {/* CONNECTED */}
      {state.phase === 'connected' && (
        <div className="dashboard-card flex flex-col items-center py-10 gap-4">
          <CheckCircle2 size={48} className="text-emerald-400" />
          <h3 className="text-lg font-black text-white uppercase">Conectado!</h3>
          {state.phoneNumber && (
            <p className="text-slate-400 text-sm">{state.phoneNumber}</p>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-black text-sm uppercase rounded-xl transition-all"
            >
              Voltar
            </button>
          )}
        </div>
      )}

      {/* ERROR */}
      {state.phase === 'error' && (
        <div className="dashboard-card space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertCircle size={20} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{state.errorMessage || 'Erro desconhecido'}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setState({ phase: 'idle' })}
              className="flex-1 py-3 border border-white/10 text-slate-400 font-black text-sm uppercase rounded-xl hover:border-white/20 transition-all"
            >
              Recomeçar
            </button>
            {instanceIdRef.current && (
              <button
                onClick={handleRetry}
                className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white font-black text-sm uppercase rounded-xl transition-all"
              >
                Tentar Novamente
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateAndConnectInstance;