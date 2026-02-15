import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Crown } from 'lucide-react';

const PanelSelector: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/auth');
      return;
    }

    const userData = JSON.parse(user);

    // Se não é admin, redireciona direto para VIP
    if (userData.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleAdminPanel = () => {
    navigate('/admin');
  };

  const handleVipPanel = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-white mb-3 italic uppercase tracking-tighter">
            Selecione seu Painel
          </h1>
          <p className="text-slate-400 text-lg">
            Escolha qual dashboard você deseja acessar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Admin Panel */}
          <button
            onClick={handleAdminPanel}
            className="group relative overflow-hidden rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-950 to-slate-950 p-8 transition-all duration-300 hover:border-brand-400 hover:shadow-2xl hover:shadow-brand-500/20 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-6 p-4 rounded-2xl bg-brand-500/10 group-hover:bg-brand-500/20 transition-colors">
                <Shield size={48} className="text-brand-400" />
              </div>

              <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wider">
                Painel Admin
              </h2>

              <p className="text-slate-400 text-sm text-center">
                Acesso completo ao sistema, gerenciamento de usuários e configurações avançadas
              </p>

              <div className="mt-6 inline-flex items-center gap-1 text-brand-400 text-sm font-bold">
                Acessar →
              </div>
            </div>
          </button>

          {/* VIP Panel */}
          <button
            onClick={handleVipPanel}
            className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950 to-slate-950 p-8 transition-all duration-300 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                <Crown size={48} className="text-emerald-400" />
              </div>

              <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wider">
                Painel VIP
              </h2>

              <p className="text-slate-400 text-sm text-center">
                Disparador Elite com todas as funcionalidades premium para envio em massa
              </p>

              <div className="mt-6 inline-flex items-center gap-1 text-emerald-400 text-sm font-bold">
                Acessar →
              </div>
            </div>
          </button>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              navigate('/auth');
            }}
            className="text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
          >
            Não é você? Fazer logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default PanelSelector;
