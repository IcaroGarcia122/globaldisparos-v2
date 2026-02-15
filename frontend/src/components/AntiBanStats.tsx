import React, { useState, useEffect } from 'react';
import { fetchAPI } from '@/config/api';
import { Shield, TrendingUp, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AntiBanStatsProps {
  instanceId: number;
}

const AntiBanStats: React.FC<AntiBanStatsProps> = ({ instanceId }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchAPI(`/stats/instance/${instanceId}`);
        setStats(data);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [instanceId]);

  if (loading) {
    return (
      <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
        <p className="text-slate-400 text-center">Carregando estatísticas...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
        <p className="text-slate-400 text-center">Nenhuma estatística disponível</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
      <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
        <Shield size={24} className="text-brand-500" />
        Estatísticas Anti-Ban
      </h2>

      <div className="space-y-4">
        {/* Status Geral */}
        <div className="bg-[#060b16] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Status
            </span>
            {stats.isPossiblyBanned ? (
              <AlertTriangle size={20} className="text-rose-500" />
            ) : (
              <CheckCircle2 size={20} className="text-emerald-500" />
            )}
          </div>
          <p className={`text-2xl font-black ${stats.isPossiblyBanned ? 'text-rose-500' : 'text-emerald-500'}`}>
            {stats.isPossiblyBanned ? 'ALERTA DE BAN!' : 'SAUDÁVEL'}
          </p>
        </div>

        {/* Categoria da Conta */}
        <div className="bg-[#060b16] border border-white/5 rounded-xl p-4">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
            Categoria da Conta
          </span>
          <p className="text-xl font-black text-white uppercase">
            {stats.ageCategory === 'new' && '🆕 NOVA'}
            {stats.ageCategory === 'medium' && '📊 MÉDIA'}
            {stats.ageCategory === 'old' && '⭐ ANTIGA'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {stats.accountAge || 0} dias de idade
          </p>
        </div>

        {/* Limite Diário */}
        <div className="bg-[#060b16] border border-white/5 rounded-xl p-4">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2">
            <TrendingUp size={14} />
            Limite Diário
          </span>
          <div className="flex items-end gap-2 mb-2">
            <p className="text-3xl font-black text-white">
              {stats.dailyUsed || 0}
            </p>
            <p className="text-lg font-bold text-slate-600 mb-1">
              / {stats.dailyLimit || 0}
            </p>
          </div>
          <div className="w-full bg-[#1c2433] rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (stats.dailyUsed / stats.dailyLimit) * 100 > 80
                  ? 'bg-rose-500'
                  : 'bg-brand-500'
              }`}
              style={{
                width: `${Math.min((stats.dailyUsed / stats.dailyLimit) * 100, 100)}%`
              }}
            />
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Restante: {stats.dailyRemaining || 0} mensagens
          </p>
        </div>

        {/* Range de Delay */}
        <div className="bg-[#060b16] border border-white/5 rounded-xl p-4">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2 flex items-center gap-2">
            <Clock size={14} />
            Intervalo Entre Mensagens
          </span>
          <p className="text-2xl font-black text-white">
            {stats.delayRange || '3-10s'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Delays randômicos humanizados
          </p>
        </div>

        {/* Taxa de Erro */}
        <div className="bg-[#060b16] border border-white/5 rounded-xl p-4">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
            Taxa de Erro
          </span>
          <p className={`text-2xl font-black ${
            parseFloat(stats.errorRate) > 70 ? 'text-rose-500' : 'text-emerald-500'
          }`}>
            {stats.errorRate || '0%'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Limite seguro: 70%
          </p>
        </div>

        {/* Alerta de Ban */}
        {stats.isPossiblyBanned && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} className="text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-rose-500 font-black text-sm uppercase tracking-widest">
                  ⚠️ POSSÍVEL BAN DETECTADO!
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  Alta taxa de erros detectada. Recomendamos pausar os disparos e aguardar 24-48h antes de retomar.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AntiBanStats;