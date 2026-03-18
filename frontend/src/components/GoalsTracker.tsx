import React, { useState, useEffect } from 'react';
import { fetchAPI } from '@/config/api';

const GoalsTracker: React.FC = () => {
  const [totalMessagesSent, setTotalMessagesSent] = useState(0);
  const [loading, setLoading] = useState(true);

  const plaques = [
    {
      title: 'Placa de 10k',
      subtitle: 'Iniciante PRO',
      image: 'https://i.ibb.co/ym0R0PTf/Design-sem-nome-1.png',
      desc: 'Concedida ao atingir 10 mil disparos entregues.',
      target: 10000,
      color: 'border-slate-400/30'
    },
    {
      title: 'Placa de 100k',
      subtitle: 'Expert Global',
      image: 'https://i.ibb.co/9HNDWPXS/Design-sem-nome.png',
      desc: 'Concedida ao atingir 100 mil disparos entregues.',
      target: 100000,
      color: 'border-brand-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
    },
    {
      title: 'Placa de 1 Milhão',
      subtitle: 'Lenda das Vendas',
      image: 'https://i.ibb.co/Xx2H9Z6v/Design-sem-nome-2.png',
      desc: 'O ápice da escala. Um milhão de mensagens enviadas.',
      target: 1000000,
      color: 'border-brand-600 shadow-[0_0_40px_rgba(37,99,235,0.3)]'
    }
  ];

  // Carregar estatísticas
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const response = await fetchAPI('/stats/user').catch(() => ({ totalMessagesSent: 0 }));
        const msgCount = response?.totalMessagesSent || response?.messagesSent || 0;
        setTotalMessagesSent(msgCount);
      } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
        setTotalMessagesSent(0);
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Poll para atualizações a cada 10 segundos
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <span className="text-slate-400">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-10">
      <header className="dashboard-card">
        <span className="bg-brand-500/10 text-brand-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Recompensas</span>
        <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Minhas Conquistas</h1>
        <p className="text-slate-500 text-sm mt-1">Acompanhe seu progresso e desbloqueie placas físicas exclusivas.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
        {plaques.map((plaque, idx) => {
          const isUnlocked = totalMessagesSent >= plaque.target;
          const progress = Math.min((totalMessagesSent / plaque.target) * 100, 100);

          return (
            <div 
              key={idx} 
              className={`dashboard-card !p-4 border ${isUnlocked ? 'border-yellow-400/50 shadow-lg shadow-yellow-500/10' : plaque.color} relative overflow-hidden group hover:scale-105 transition-transform duration-500`}
            >
              {isUnlocked && (
                <div className="absolute top-3 right-3 z-10 bg-yellow-400 text-black text-[8px] font-black uppercase px-2 py-1 rounded-full tracking-widest flex items-center gap-1">
                  ⭐ Desbloqueada
                </div>
              )}
              <div className="bg-[#1c2433] rounded-3xl p-5 md:p-6 h-full flex flex-col">
                <div className="aspect-square rounded-2xl overflow-hidden mb-6 relative">
                  <img 
                    src={plaque.image} 
                    alt={plaque.title} 
                    className={`w-full h-full object-cover transition-all duration-700 ${isUnlocked ? 'filter-none opacity-100' : 'filter grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100'}`}
                  />
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center group-hover:bg-transparent transition-all">
                      <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 group-hover:hidden">
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">🔒 Bloqueada</span>
                      </div>
                    </div>
                  )}
                  {isUnlocked && (
                    <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent pointer-events-none" />
                  )}
                </div>
                <h3 className={`text-lg md:text-xl font-black italic uppercase tracking-tighter mb-1 ${isUnlocked ? 'text-yellow-300' : 'text-white'}`}>{plaque.title}</h3>
                <div className="text-brand-500 text-[9px] font-black uppercase tracking-widest mb-4">{plaque.subtitle}</div>
                <div className="flex-1 text-[11px] text-slate-500 font-medium leading-relaxed mb-4">{plaque.desc}</div>
                <div className={`text-[9px] mb-4 italic ${isUnlocked ? 'text-yellow-400 font-black' : 'text-slate-600'}`}>
                  {isUnlocked ? '✅ Meta atingida!' : `${totalMessagesSent.toLocaleString()} / ${plaque.target.toLocaleString()} mensagens`}
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ${isUnlocked ? 'bg-yellow-400' : 'bg-brand-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Support message */}
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center">
        <p className="text-sm text-slate-300 font-medium leading-relaxed">
          🎁 <span className="font-black text-white">Ao bater alguma das metas, mande uma mensagem pro WhatsApp de suporte</span> (<a href="https://wa.me/5542999538607" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-400 font-black">42 99953-8607</a>) <span className="font-black text-white">para resgatar sua placa!</span>
        </p>
      </div>
    </div>
  );
};

export default GoalsTracker;