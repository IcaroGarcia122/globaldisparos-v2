import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Users, DollarSign, Activity, LogOut, Plus, Search,
  TrendingUp, UserCheck, UserX, ChevronDown, BarChart3, Eye,
} from 'lucide-react';
import { fetchAPI } from '@/config/api';

type Tab = 'overview' | 'subscribers' | 'revenue';

interface Subscriber {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  plan: string;
  status: string;
  price: number;
  signup_date: string;
  last_login: string | null;
  messages_sent: number;
}

const PLAN_PRICES: Record<string, number> = {
  mensal: 69.90,
  trimestral: 149.90,
  anual: 299.00,
};

const PLAN_LABELS: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  inactive: { label: 'Inativo', color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' },
  trial: { label: 'Trial', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  cancelled: { label: 'Cancelado', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchSubscribers();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
      navigate('/auth');
      return;
    }

    try {
      const userData = JSON.parse(user);
      if (userData.role !== 'admin') {
        navigate('/dashboard');
      }
    } catch {
      navigate('/auth');
    }
  };

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const data = await fetchAPI('/auth/admin/users');
      setSubscribers(data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  // Computed metrics
  const activeSubscribers = subscribers.filter(s => s.status === 'active');
  const totalRevenue = activeSubscribers.reduce((sum, s) => sum + PLAN_PRICES[s.plan], 0);
  const mrr = totalRevenue;
  const planCounts = {
    mensal: activeSubscribers.filter(s => s.plan === 'mensal').length,
    trimestral: activeSubscribers.filter(s => s.plan === 'trimestral').length,
    anual: activeSubscribers.filter(s => s.plan === 'anual').length,
  };
  const totalMessages = subscribers.reduce((sum, s) => sum + s.messages_sent, 0);
  const avgTicket = activeSubscribers.length > 0 ? totalRevenue / activeSubscribers.length : 0;

  const filteredSubscribers = subscribers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'all' || s.plan === filterPlan;
    return matchesSearch && matchesPlan;
  });

  const tabs = [
    { id: 'overview' as Tab, label: 'Visão Geral', icon: <LayoutGrid size={18} /> },
    { id: 'subscribers' as Tab, label: 'Assinantes', icon: <Users size={18} /> },
    { id: 'revenue' as Tab, label: 'Receita', icon: <DollarSign size={18} /> },
  ];

  const renderOverview = () => (
    <div className="animate-fade-in space-y-8">
      <div className="text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter">Visão Geral</h1>
        <p className="text-slate-500 text-sm mt-1">Métricas em tempo real do seu negócio.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'ASSINANTES ATIVOS', val: activeSubscribers.length, icon: <UserCheck size={18} />, color: 'text-emerald-500' },
          { label: 'RECEITA MENSAL (MRR)', val: `R$ ${mrr.toFixed(2).replace('.', ',')}`, icon: <DollarSign size={18} />, color: 'text-brand-500' },
          { label: 'TICKET MÉDIO', val: `R$ ${avgTicket.toFixed(2).replace('.', ',')}`, icon: <TrendingUp size={18} />, color: 'text-amber-500' },
          { label: 'TOTAL DE MENSAGENS', val: totalMessages.toLocaleString(), icon: <Activity size={18} />, color: 'text-indigo-500' },
        ].map((card, i) => (
          <div key={i} className="dashboard-card hover:scale-105 transition-transform text-center">
            <div className="flex justify-center mb-6">
              <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 ${card.color}`}>
                {card.icon}
              </div>
            </div>
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{card.label}</div>
            <div className="text-3xl md:text-4xl font-black text-white italic tracking-tighter">{card.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Plan distribution */}
        <div className="dashboard-card">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-8">Distribuição por Plano</h3>
          <div className="space-y-6">
            {Object.entries(planCounts).map(([plan, count]) => {
              const total = activeSubscribers.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={plan} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">{PLAN_LABELS[plan]} — R$ {PLAN_PRICES[plan].toFixed(2).replace('.', ',')}</span>
                    <span className="text-xs font-black text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent subscribers */}
        <div className="dashboard-card">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-8">Últimos Assinantes</h3>
          {subscribers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 opacity-30">
              <Users size={48} strokeWidth={1} className="text-slate-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Nenhum assinante</span>
            </div>
          ) : (
            <div className="space-y-3">
              {subscribers.slice(0, 5).map(sub => (
                <div key={sub.id} className="flex items-center justify-between px-5 py-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-500/20 text-sm font-black">
                      {sub.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{sub.name}</div>
                      <div className="text-[10px] text-slate-500">{sub.email}</div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_LABELS[sub.status]?.color || 'text-slate-500'}`}>
                    {PLAN_LABELS[sub.plan]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSubscribers = () => (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter">Assinantes</h1>
          <p className="text-slate-500 text-sm mt-1">{subscribers.length} assinantes cadastrados.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1c2433] border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-sm font-medium text-white outline-none focus:border-brand-500/40 transition-all placeholder:text-slate-700"
          />
        </div>
        <div className="relative">
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="bg-[#1c2433] border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none appearance-none cursor-pointer pr-12 focus:border-brand-500/40 transition-all"
          >
            <option value="all">Todos os planos</option>
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
          </select>
          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="dashboard-card py-20 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSubscribers.length === 0 ? (
        <div className="dashboard-card py-20 flex flex-col items-center justify-center gap-4 opacity-30">
          <Users size={64} strokeWidth={1} className="text-slate-600" />
          <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600 italic">
            {searchTerm || filterPlan !== 'all' ? 'Nenhum resultado encontrado.' : 'Nenhum assinante cadastrado.'}
          </span>
        </div>
      ) : (
        <div className="dashboard-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Nome</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Plano</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Msgs</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map(sub => (
                  <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-500 text-xs font-black shrink-0">
                          {sub.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-white whitespace-nowrap">{sub.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{sub.email}</td>
                    <td className="px-6 py-4">
                      <span className="text-[9px] font-black uppercase tracking-widest text-brand-500">{PLAN_LABELS[sub.plan]}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_LABELS[sub.status]?.color || 'text-slate-500'}`}>
                        {STATUS_LABELS[sub.status]?.label || sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-white">{sub.messages_sent.toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(sub.signup_date).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderRevenue = () => {
    const revenueByPlan = Object.entries(planCounts).map(([plan, count]) => ({
      plan: PLAN_LABELS[plan],
      count,
      revenue: count * PLAN_PRICES[plan],
    }));
    const totalMonthly = revenueByPlan.reduce((sum, r) => sum + r.revenue, 0);

    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter">Receita</h1>
          <p className="text-slate-500 text-sm mt-1">Visão detalhada do faturamento.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {revenueByPlan.map((r, i) => (
            <div key={i} className="dashboard-card hover:scale-105 transition-transform">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{r.plan}</div>
              <div className="text-3xl md:text-4xl font-black text-white italic tracking-tighter mb-2">
                R$ {r.revenue.toFixed(2).replace('.', ',')}
              </div>
              <div className="text-xs text-slate-500 font-bold">{r.count} assinantes × R$ {PLAN_PRICES[Object.keys(PLAN_LABELS).find(k => PLAN_LABELS[k] === r.plan) || 'mensal'].toFixed(2).replace('.', ',')}</div>
            </div>
          ))}
        </div>

        <div className="dashboard-card">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Resumo Financeiro</h3>
          </div>
          <div className="space-y-6">
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-sm font-bold text-slate-400">Receita Mensal Recorrente (MRR)</span>
              <span className="text-xl font-black text-white italic">R$ {totalMonthly.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-sm font-bold text-slate-400">Projeção Anual (ARR)</span>
              <span className="text-xl font-black text-emerald-500 italic">R$ {(totalMonthly * 12).toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-white/5">
              <span className="text-sm font-bold text-slate-400">Ticket Médio</span>
              <span className="text-xl font-black text-brand-500 italic">R$ {avgTicket.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between items-center py-4">
              <span className="text-sm font-bold text-slate-400">Total de Assinantes Ativos</span>
              <span className="text-xl font-black text-white italic">{activeSubscribers.length}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-72 bg-[#0b1121] border-r border-white/5 p-8 flex-col shrink-0">
        <div className="flex items-center gap-4 mb-20 cursor-pointer">
          <div className="w-12 h-12 bg-brand-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl shadow-brand-600/30 shrink-0">
            <BarChart3 size={22} />
          </div>
          <div className="text-xl font-black italic tracking-tighter uppercase text-white flex flex-col leading-none">
            Admin<span className="text-brand-600 -mt-1 tracking-[0.4em] text-[10px]">PANEL</span>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-brand-600 text-white shadow-2xl shadow-brand-600/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-8 pt-8 border-t border-white/5 space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full text-slate-500 hover:text-white font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
          >
            <Eye size={14} />
            Ver Site
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-slate-500 hover:text-rose-500 font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0b1121] border-t border-white/5 z-50 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-4 transition-all ${activeTab === tab.id ? 'text-brand-500' : 'text-slate-600'}`}
          >
            {tab.icon}
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center gap-1 py-4 text-slate-600 hover:text-rose-500 transition-all"
        >
          <LogOut size={18} />
          <span className="text-[8px] font-black uppercase tracking-widest">Sair</span>
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 lg:p-16 overflow-y-auto pb-24 lg:pb-16">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'subscribers' && renderSubscribers()}
          {activeTab === 'revenue' && renderRevenue()}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
