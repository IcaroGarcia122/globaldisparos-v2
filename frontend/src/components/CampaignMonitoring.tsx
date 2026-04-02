import React, { useState, useEffect } from 'react';
import { fetchAPI } from '@/config/api';
import {
  Pause, Play, X, AlertCircle, CheckCircle2, Loader2, BarChart3,
  MessageSquare, Users, Zap, Clock, TrendingUp, Activity
} from 'lucide-react';

interface CampaignProgress {
  campaignId: string;
  status: string;
  totalContacts: number;
  messagesSent: number;
  messagesFailed: number;
  messagesRemaining: number;
  isPaused: boolean;
  campaign?: {
    id: string;
    name: string;
    message: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
  };
}

interface CampaignMonitoringProps {
  campaignId: string;
  onClose: () => void;
}

const CampaignMonitoring: React.FC<CampaignMonitoringProps> = ({ campaignId, onClose }) => {
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [editingMessage, setEditingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Polling para atualizar progresso
  useEffect(() => {
    let stopped = false;
    let interval: NodeJS.Timeout | null = null;

    const loadProgress = async () => {
      try {
        const data = await fetchAPI(`/campaigns/${campaignId}/progress`);
        if (stopped) return;
        setProgress(data);
        setLoading(false);
        setError('');
        if (data.campaign?.message) {
          setNewMessage(data.campaign.message);
        }
        // Para polling quando campanha finalizar
        if (['completed', 'cancelled', 'failed'].includes(data?.status || data?.campaign?.status)) {
          if (interval) { clearInterval(interval); interval = null; }
        }
      } catch (err) {
        if (stopped) return;
        console.error('Erro ao carregar progresso:', err);
        setError('Erro ao carregar progresso da campanha');
        setLoading(false);
      }
    };

    // Carrega imediatamente
    loadProgress();

    // Polling a cada 2 segundos
    interval = setInterval(loadProgress, 2000);

    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };
  }, [campaignId]);

  const handlePauseCampaign = async () => {
    setActionLoading(true);
    try {
      await fetchAPI(`/campaigns/${campaignId}/pause`, { method: 'POST' });
    } catch (err: any) {
      setError(err.message || 'Erro ao pausar campanha');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeCampaign = async () => {
    setActionLoading(true);
    try {
      await fetchAPI(`/campaigns/${campaignId}/start`, { method: 'POST' });
    } catch (err: any) {
      setError(err.message || 'Erro ao retomar campanha');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCampaign = async () => {
    if (!confirm('Tem certeza que deseja cancelar esta campanha?')) return;

    setActionLoading(true);
    try {
      await fetchAPI(`/campaigns/${campaignId}/cancel`, { method: 'POST' });
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar campanha');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-center max-w-md">
          <Loader2 size={48} className="animate-spin text-brand-500 mx-auto mb-4" />
          <p className="text-white font-black text-sm uppercase tracking-widest">Carregando campanha...</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-center max-w-md border border-rose-500/20">
          <AlertCircle size={48} className="text-rose-500 mx-auto mb-4" />
          <p className="text-white font-black text-sm uppercase tracking-widest mb-4">Campanha não encontrada</p>
          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-black text-[11px] uppercase tracking-widest"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const successRate = progress.totalContacts > 0
    ? ((progress.messagesSent / progress.totalContacts) * 100).toFixed(1)
    : 0;

  const failureRate = progress.totalContacts > 0
    ? ((progress.messagesFailed / progress.totalContacts) * 100).toFixed(1)
    : 0;

  const isRunning = progress.status === 'running' && !progress.isPaused;
  const isCompleted = progress.status === 'completed';
  const isCancelled = progress.status === 'cancelled';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-white/10 max-w-3xl w-full my-12">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600/20 to-purple-600/20 border-b border-white/10 px-6 md:px-8 py-6 flex items-start justify-between">
          <div>
            <span className="bg-brand-500/20 text-brand-400 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-2 inline-block tracking-widest">
              {isCompleted ? '✅ Concluída' : isCancelled ? '❌ Cancelada' : isRunning ? '🚀 Em Execução' : '⏸️ Pausada'}
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase mb-2">
              {progress.campaign?.name || 'Campanha'}
            </h2>
            <p className="text-slate-400 text-sm">
              Monitoramento em tempo real de disparo de mensagens
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          {/* Mensagem de Erro */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-rose-500 font-black text-sm uppercase">{error}</p>
              </div>
            </div>
          )}

          {/* Estatísticas Principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total */}
            <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total</p>
                <Users size={16} className="text-slate-600" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-white">{progress.totalContacts}</p>
            </div>

            {/* Enviadas */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 hover:border-emerald-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Enviadas</p>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-emerald-400">{progress.messagesSent}</p>
              <p className="text-[10px] text-emerald-600 mt-1">{successRate}%</p>
            </div>

            {/* Falhadas */}
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 hover:border-rose-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Falhadas</p>
                <AlertCircle size={16} className="text-rose-500" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-rose-400">{progress.messagesFailed}</p>
              <p className="text-[10px] text-rose-600 mt-1">{failureRate}%</p>
            </div>

            {/* Restantes */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Restantes</p>
                <Clock size={16} className="text-blue-500" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-blue-400">{progress.messagesRemaining}</p>
              <p className="text-[10px] text-blue-600 mt-1">{((progress.messagesRemaining / progress.totalContacts) * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progresso Geral</p>
              <p className="text-sm font-black text-white">
                {((progress.messagesSent / progress.totalContacts) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-500 flex items-center justify-end pr-2"
                style={{
                  width: `${(progress.messagesSent / progress.totalContacts) * 100}%`,
                }}
              >
                {progress.messagesSent > 0 && (
                  <Zap size={12} className="text-white" />
                )}
              </div>
            </div>
          </div>

          {/* Mensagem da Campanha */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={14} />
                Mensagem
              </p>
              {!isCompleted && !isCancelled && (
                <button
                  onClick={() => setEditingMessage(!editingMessage)}
                  className="text-[9px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-all"
                >
                  {editingMessage ? 'Cancelar' : 'Editar'}
                </button>
              )}
            </div>

            {editingMessage ? (
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isRunning}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-4 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all resize-none min-h-24 disabled:opacity-50"
                placeholder="Digite a nova mensagem..."
              />
            ) : (
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 min-h-24 flex items-start">
                <p className="text-white text-sm whitespace-pre-wrap">{progress.campaign?.message}</p>
              </div>
            )}
          </div>

          {/* Status Live */}
          <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            <div className="flex-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</p>
              <p className="text-sm text-white font-medium mt-1">
                {isRunning
                  ? '🚀 Enviando mensagens...'
                  : isCompleted
                    ? '✅ Campanha concluída com sucesso!'
                    : isCancelled
                      ? '❌ Campanha foi cancelada'
                      : '⏸️ Campanha em pausa'}
              </p>
            </div>
            <Activity size={16} className="text-brand-500 flex-shrink-0" />
          </div>

          {/* Ações */}
          <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-white/5">
            {isRunning ? (
              <button
                onClick={handlePauseCampaign}
                disabled={actionLoading}
                className="flex-1 bg-yellow-600/20 hover:bg-yellow-600/30 disabled:opacity-50 text-yellow-500 border border-yellow-500/30 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Pausando...
                  </>
                ) : (
                  <>
                    <Pause size={16} />
                    Pausar Campanha
                  </>
                )}
              </button>
            ) : !isCompleted && !isCancelled ? (
              <button
                onClick={handleResumeCampaign}
                disabled={actionLoading}
                className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-50 text-emerald-500 border border-emerald-500/30 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Retomando...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Retomar Campanha
                  </>
                )}
              </button>
            ) : null}

            {!isCompleted && !isCancelled && (
              <button
                onClick={handleCancelCampaign}
                disabled={actionLoading}
                className="flex-1 bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-50 text-rose-500 border border-rose-500/30 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <X size={16} />
                    Cancelar Campanha
                  </>
                )}
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-white border border-white/10 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignMonitoring;
