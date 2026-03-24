import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Users, DollarSign, Activity, LogOut, Search, Link,
  TrendingUp, UserCheck, BarChart3, Eye, Shield, MessageSquare,
  Wifi, WifiOff, ChevronDown, RefreshCw, Trash2, ToggleLeft,
  ToggleRight, X, Check, AlertCircle, Loader2, ArrowLeft, Gift, CheckCircle,
} from 'lucide-react';
import { fetchAPI } from '@/config/api';

type Tab = 'overview' | 'subscribers' | 'revenue' | 'logs';

interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: string;
  status: string;
  signup_date: string;
  last_login: string | null;
  plan_expires_at: string | null;
  messages_sent: number;
  instances_count: number;
  connected_instances: number;
  campaigns_count: number;
}

const PLAN_PRICES: Record<string, number> = {
  basic: 0,
  pro: 69.90,
  enterprise: 149.90,
  // fallback para planos antigos
  mensal: 69.90,
  trimestral: 149.90,
  anual: 599.90,
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual',
};

const PLAN_OPTIONS = ['basic', 'pro', 'enterprise'];

const STATUS_STYLES: Record<string, string> = {
  active:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  inactive:  'text-slate-400 bg-slate-500/10 border-slate-500/20',
  trial:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  cancelled: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab]       = useState<Tab>('overview');
  const [users, setUsers]               = useState<User[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterPlan, setFilterPlan]     = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingUser, setEditingUser]   = useState<User | null>(null);
  const [editPlan, setEditPlan]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [showInvite, setShowInvite]         = useState(false);
  const [invitePlan, setInvitePlan]         = useState('pro');
  const [inviteNote, setInviteNote]         = useState('');
  const [inviteDays, setInviteDays]         = useState(7);
  const [inviteLink, setInviteLink]         = useState('');
  const [inviteStep, setInviteStep]         = useState<'form'|'result'>('form');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copied, setCopied]                 = useState(false);
  const [inviteEmail, setInviteEmail]       = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('user');
    if (!token || !user) { navigate('/auth'); return; }
    try {
      const u = JSON.parse(user);
      if (u.role !== 'admin') navigate('/dashboard');
    } catch { navigate('/auth'); }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAPI('/auth/admin/users');
      // Garantir que todos os campos existem e não são undefined
      const safe: User[] = (Array.isArray(data) ? data : []).map((u: any) => ({
        id:                  String(u.id ?? ''),
        name:                u.name ?? u.fullName ?? u.email ?? 'Sem nome',
        email:               u.email ?? '',
        plan:                u.plan ?? 'basic',
        role:                u.role ?? 'user',
        status:              u.status ?? (u.isActive ? 'active' : 'inactive'),
        signup_date:         u.signup_date ?? u.createdAt ?? '',
        last_login:          u.last_login ?? u.lastLoginAt ?? null,
        plan_expires_at:     u.plan_expires_at ?? null,
        messages_sent:       Number(u.messages_sent ?? 0),
        instances_count:     Number(u.instances_count ?? 0),
        connected_instances: Number(u.connected_instances ?? 0),
        campaigns_count:     Number(u.campaigns_count ?? 0),
      }));
      setUsers(safe);
    } catch (e) {
      showToast('Erro ao carregar usuários', false);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggleStatus = async (u: User) => {
    const newActive = u.status !== 'active';
    try {
      await fetchAPI(`/auth/admin/users/${u.id}`, { method: 'PATCH', body: { isActive: newActive } });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: newActive ? 'active' : 'inactive' } : x));
      showToast(`${u.name} ${newActive ? 'ativado' : 'desativado'}`, true);
    } catch { showToast('Erro ao atualizar', false); }
  };

  const handleChangePlan = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await fetchAPI(`/auth/admin/users/${editingUser.id}`, { method: 'PATCH', body: { plan: editPlan } });
      setUsers(prev => prev.map(x => x.id === editingUser.id ? { ...x, plan: editPlan } : x));
      showToast(`Plano de ${editingUser.name} alterado para ${PLAN_LABELS[editPlan] ?? editPlan}`, true);
      setEditingUser(null);
    } catch { showToast('Erro ao salvar', false); }
    finally { setSaving(false); }
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await fetchAPI('/auth/admin/invite', {
        method: 'POST',
        body: { plan: invitePlan, note: inviteNote, expiresInDays: inviteDays, email: inviteEmail },
      });
      setInviteLink(res.link || '');
      setInviteStep('result');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao gerar link', false);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleDelete = async (u: User) => {
    try {
      await fetchAPI(`/auth/admin/users/${u.id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(x => x.id !== u.id));
      showToast(`${u.name} removido`, true);
      setConfirmDelete(null);
    } catch { showToast('Erro ao remover', false); }
  };

  // Métricas
  const activeUsers    = users.filter(u => u.status === 'active');
  // Receita: exclui usuários criados por convite (role='user' sem pagamento direto)
  // Para diferenciar: usuários pagantes têm planExpiresAt definido via payment webhook
  // Usuários de convite têm planExpiresAt definido via invite
  // Por ora calculamos todos os planos ativos exceto basic
  const paidUsers = activeUsers.filter(u => u.plan !== 'basic' && u.plan !== 'free');
  const totalRevenue = paidUsers.reduce((s, u) => s + (PLAN_PRICES[u.plan] ?? 0), 0);
  const avgTicket      = activeUsers.length > 0 ? totalRevenue / activeUsers.length : 0;
  const totalMessages  = users.reduce((s, u) => s + u.messages_sent, 0);
  const totalInstances = users.reduce((s, u) => s + u.instances_count, 0);
  const connectedInst  = users.reduce((s, u) => s + u.connected_instances, 0);

  const filtered = users.filter(u => {
    const name  = (u.name  || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const q     = searchTerm.toLowerCase();
    const matchSearch = !q || name.includes(q) || email.includes(q);
    const matchPlan   = filterPlan   === 'all' || u.plan   === filterPlan;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchPlan && matchStatus;
  });

  const tabs = [
    { id: 'overview'    as Tab, label: 'Visão Geral', icon: <LayoutGrid size={15} /> },
    { id: 'subscribers' as Tab, label: 'Usuários',    icon: <Users size={15} /> },
    { id: 'revenue'     as Tab, label: 'Receita',     icon: <DollarSign size={15} /> },
    { id: 'logs'        as Tab, label: 'Logs Live',   icon: <Activity size={15} /> },
  ];

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtBRL  = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  // ── OVERVIEW ────────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Visão Geral</h1>
        <p className="text-slate-500 text-sm mt-1">{users.length} usuários cadastrados no sistema</p>
      </div>

      {/* Cards métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Usuários Ativos',   val: activeUsers.length,           icon: <UserCheck size={18} />,     color: 'emerald' },
          { label: 'MRR',               val: fmtBRL(totalRevenue),         icon: <DollarSign size={18} />,    color: 'brand' },
          { label: 'Ticket Médio',      val: fmtBRL(avgTicket),            icon: <TrendingUp size={18} />,    color: 'amber' },
          { label: 'Msgs Enviadas',     val: totalMessages.toLocaleString(), icon: <MessageSquare size={18} />, color: 'indigo' },
        ].map((c, i) => (
          <div key={i} className="dashboard-card text-center py-6">
            <div className={`w-10 h-10 rounded-xl mx-auto mb-4 flex items-center justify-center border
              ${c.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                c.color === 'brand'   ? 'bg-brand-500/10   border-brand-500/20   text-brand-400'   :
                c.color === 'amber'   ? 'bg-amber-500/10   border-amber-500/20   text-amber-400'   :
                                        'bg-indigo-500/10  border-indigo-500/20  text-indigo-400'  }`}>
              {c.icon}
            </div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{c.label}</p>
            <p className="text-2xl font-black text-white">{c.val}</p>
          </div>
        ))}
      </div>

      {/* Segunda linha de stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Wifi size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Instâncias Conectadas</p>
            <p className="text-2xl font-black text-white">{connectedInst}<span className="text-slate-500 text-sm font-normal">/{totalInstances}</span></p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 flex-shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Campanhas</p>
            <p className="text-2xl font-black text-white">{users.reduce((s, u) => s + u.campaigns_count, 0).toLocaleString()}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
            <WifiOff size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Usuários Inativos</p>
            <p className="text-2xl font-black text-white">{users.filter(u => u.status !== 'active').length}</p>
          </div>
        </div>
      </div>

      {/* Últimos cadastros */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-white uppercase">Últimos Cadastros</h3>
          <button onClick={() => setActiveTab('subscribers')} className="text-[10px] font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest transition-all">
            Ver todos →
          </button>
        </div>
        <div className="space-y-2">
          {users.slice(0, 6).map(u => (
            <div key={u.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-all">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 font-black text-sm flex-shrink-0">
                {(u.name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{u.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${STATUS_STYLES[u.status] ?? STATUS_STYLES.inactive}`}>
                  {u.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
                <span className="text-[9px] font-black text-slate-500 uppercase">{PLAN_LABELS[u.plan] ?? u.plan}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── SUBSCRIBERS ─────────────────────────────────────────────────────────────
  const renderSubscribers = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Usuários</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} de {users.length} usuários</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowInvite(true); setInviteLink(''); setInviteStep('form'); setInviteNote(''); setInviteEmail(''); setCopied(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-black uppercase transition-all shadow-lg shadow-brand-600/20">
            <Link size={13} /> Gerar Convite
          </button>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase hover:bg-white/10 transition-all">
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full bg-[#0d1117] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-brand-500 transition-all" />
        </div>
        <div className="relative">
          <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
            className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none appearance-none pr-8 focus:border-brand-500 transition-all">
            <option value="all">Todos os planos</option>
            {PLAN_OPTIONS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none appearance-none pr-8 focus:border-brand-500 transition-all">
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="dashboard-card py-20 flex items-center justify-center gap-3 text-slate-400">
          <RefreshCw size={18} className="animate-spin text-brand-500" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="dashboard-card py-20 flex flex-col items-center justify-center gap-4 opacity-40">
          <Users size={48} strokeWidth={1} />
          <p className="text-xs font-black uppercase tracking-widest">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="dashboard-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  {['Usuário', 'Plano', 'Status', 'Instâncias', 'Msgs', 'Cadastro', 'Ações'].map(h => (
                    <th key={h} className="px-5 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-black flex-shrink-0">
                          {(u.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white whitespace-nowrap">{u.name}</p>
                          <p className="text-[10px] text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => { setEditingUser(u); setEditPlan(u.plan); }}
                        className="text-[9px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 border border-brand-500/20 px-2 py-1 rounded-lg hover:bg-brand-500/10 transition-all">
                        {PLAN_LABELS[u.plan] ?? u.plan}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => handleToggleStatus(u)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase transition-all ${STATUS_STYLES[u.status] ?? STATUS_STYLES.inactive}`}>
                        {u.status === 'active' ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                        {u.status === 'active' ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-white">{u.connected_instances}</span>
                        <span className="text-slate-500 text-xs">/{u.instances_count}</span>
                        {u.connected_instances > 0 && <Wifi size={10} className="text-emerald-400 ml-1" />}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-white whitespace-nowrap">
                      {u.messages_sent.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {fmtDate(u.signup_date)}
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => setConfirmDelete(u)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all">
                        <Trash2 size={13} />
                      </button>
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

  // ── REVENUE ─────────────────────────────────────────────────────────────────
  const renderRevenue = () => {
    const byPlan = PLAN_OPTIONS.map(p => ({
      plan: p, label: PLAN_LABELS[p], price: PLAN_PRICES[p],
      count: activeUsers.filter(u => u.plan === p).length,
      revenue: activeUsers.filter(u => u.plan === p).length * PLAN_PRICES[p],
    }));
    const arr = totalRevenue * 12;

    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Receita</h1>
          <p className="text-slate-500 text-sm mt-1">Faturamento recorrente por plano</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {byPlan.map((r, i) => (
            <div key={i} className="dashboard-card">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{r.label}</p>
              <p className="text-3xl font-black text-white mb-1">{fmtBRL(r.revenue)}</p>
              <p className="text-xs text-slate-500">{r.count} usuários × {fmtBRL(r.price)}/mês</p>
            </div>
          ))}
        </div>

        <div className="dashboard-card space-y-0">
          <h3 className="text-lg font-black text-white uppercase mb-6">Resumo Financeiro</h3>
          {[
            { label: 'Receita Mensal (MRR)',  val: fmtBRL(totalRevenue),    color: 'text-white' },
            { label: 'Projeção Anual (ARR)',  val: fmtBRL(arr),             color: 'text-emerald-400' },
            { label: 'Ticket Médio',          val: fmtBRL(avgTicket),       color: 'text-brand-400' },
            { label: 'Assinantes Ativos',     val: String(activeUsers.length), color: 'text-white' },
            { label: 'Total de Usuários',     val: String(users.length),    color: 'text-slate-300' },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center py-4 border-b border-white/5 last:border-0">
              <span className="text-sm text-slate-400 font-bold">{row.label}</span>
              <span className={`text-xl font-black ${row.color}`}>{row.val}</span>
            </div>
          ))}
        </div>

        {/* Distribuição visual */}
        <div className="dashboard-card">
          <h3 className="text-lg font-black text-white uppercase mb-6">Distribuição por Plano</h3>
          <div className="space-y-5">
            {byPlan.map(r => {
              const pct = activeUsers.length > 0 ? Math.round((r.count / activeUsers.length) * 100) : 0;
              return (
                <div key={r.plan}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-bold text-white">{r.label}</span>
                    <span className="text-xs font-black text-slate-500">{r.count} usuários ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border font-bold text-sm shadow-2xl transition-all ${
          toast.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {toast.ok ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Modal gerar convite */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1121] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {inviteStep === 'result' && (
                  <button onClick={() => setInviteStep('form')} className="text-slate-500 hover:text-white transition-all">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <h3 className="text-lg font-black text-white uppercase">
                  {inviteStep === 'form' ? 'Gerar Convite' : 'Link Gerado!'}
                </h3>
              </div>
              <button onClick={() => setShowInvite(false)} className="text-slate-500 hover:text-white transition-all">
                <X size={16} />
              </button>
            </div>

            {/* STEP FORM */}
            {inviteStep === 'form' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Plano de acesso</label>
                  <select value={invitePlan} onChange={e => setInvitePlan(e.target.value)}
                    className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-brand-500 transition-all">
                    <option value="basic">Basic — Gratuito</option>
                    <option value="pro">Pro — R$ 69,90/mês</option>
                    <option value="enterprise">Enterprise — R$ 149,90/mês</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email do convidado (opcional)</label>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="email@dele.com — envia o link direto"
                    className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-brand-500 transition-all placeholder:text-slate-600" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Observação (opcional)</label>
                  <input value={inviteNote} onChange={e => setInviteNote(e.target.value)}
                    placeholder="Ex: Parceiro, teste, influencer..."
                    className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-brand-500 transition-all placeholder:text-slate-600" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Validade do link</label>
                  <select value={inviteDays} onChange={e => setInviteDays(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-brand-500 transition-all">
                    <option value={1}>1 dia</option>
                    <option value={3}>3 dias</option>
                    <option value={7}>7 dias</option>
                    <option value={30}>30 dias</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowInvite(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-black text-sm uppercase hover:bg-white/5 transition-all">
                    Cancelar
                  </button>
                  <button onClick={generateInvite} disabled={generatingInvite}
                    className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-black text-sm uppercase transition-all flex items-center justify-center gap-2">
                    {generatingInvite
                      ? <><Loader2 size={13} className="animate-spin" /> Gerando...</>
                      : <><Link size={13} /> Gerar Link</>}
                  </button>
                </div>
              </div>
            )}

            {/* STEP RESULT */}
            {inviteStep === 'result' && (
              <div>
                {/* Info do convite */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <span className="text-emerald-400 font-black text-xs uppercase tracking-widest">Convite criado com sucesso</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Plano</span>
                      <span className="text-white font-bold">{PLAN_LABELS[invitePlan] ?? invitePlan}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Validade</span>
                      <span className="text-white font-bold">{inviteDays} dia{inviteDays > 1 ? 's' : ''}</span>
                    </div>
                    {inviteNote && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block">Obs</span>
                        <span className="text-white font-bold">{inviteNote}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Link */}
                <div className="mb-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Link de acesso</label>
                  <div className="bg-[#0d1117] border border-white/10 rounded-xl p-3">
                    <p className="text-brand-300 text-xs break-all font-mono leading-relaxed select-all">{inviteLink}</p>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`flex-1 py-3 rounded-xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-brand-600 hover:bg-brand-500 text-white'
                    }`}>
                    <Check size={13} /> {copied ? 'Copiado!' : 'Copiar Link'}
                  </button>
                  <button
                    onClick={() => { setInviteStep('form'); setInviteLink(''); setInviteNote(''); setCopied(false); }}
                    className="px-4 py-3 rounded-xl border border-white/10 text-slate-400 font-black text-sm uppercase hover:bg-white/5 transition-all">
                    Novo
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Modal editar plano */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1121] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-white uppercase">Alterar Plano</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-500 hover:text-white transition-all"><X size={16} /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Usuário: <strong className="text-white">{editingUser.name}</strong></p>
            <select value={editPlan} onChange={e => setEditPlan(e.target.value)}
              className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none mb-4 focus:border-brand-500 transition-all">
              {PLAN_OPTIONS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]} — {fmtBRL(PLAN_PRICES[p])}/mês</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-black text-sm uppercase hover:bg-white/5 transition-all">Cancelar</button>
              <button onClick={handleChangePlan} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-black text-sm uppercase transition-all disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1121] border border-rose-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Trash2 size={16} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase">Remover Usuário</h3>
                <p className="text-xs text-slate-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-5">Remover <strong className="text-white">{confirmDelete.name}</strong> e todos os seus dados?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-black text-sm uppercase hover:bg-white/5 transition-all">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm uppercase transition-all">Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#0b1121] border-r border-white/5 p-6 flex-col shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-600/30">
            <Shield size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-tight">Admin Panel</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">GlobalDisparos</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'
              }`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-6 pt-6 border-t border-white/5 space-y-2">
          <button onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all">
            <Eye size={14} />Ver Site
          </button>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/auth'); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-rose-400 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500/5 transition-all">
            <LogOut size={14} />Sair
          </button>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0b1121] border-t border-white/5 z-40 flex">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all ${activeTab === tab.id ? 'text-brand-400' : 'text-slate-600'}`}>
            {tab.icon}
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
        <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/auth'); }}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-slate-600 hover:text-rose-400 transition-all">
          <LogOut size={15} />
          <span className="text-[8px] font-black uppercase tracking-widest">Sair</span>
        </button>
      </div>

      {/* Main */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto pb-24 lg:pb-12">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'overview'    && renderOverview()}
          {activeTab === 'subscribers' && renderSubscribers()}
          {activeTab === 'revenue'     && renderRevenue()}
          {activeTab === 'logs'        && <LiveLogs />}
        </div>
      </main>
    </div>
  );
};


// ─── Componente de Logs em Tempo Real ──────────────────────────────────────
const LiveLogs: React.FC = () => {
  const [logs, setLogs] = React.useState<string[]>([]);
  const [connected, setConnected] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const wsRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    const wsUrl = window.location.origin.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/admin/logs/stream?token=' + token;

    // Fallback: polling de logs via API
    const pollLogs = async () => {
      try {
        const data = await fetchAPI('/admin/logs');
        if (data?.logs) {
          setLogs(data.logs);
          setConnected(true);
        }
      } catch { /* ignora */ }
    };

    pollLogs();
    const interval = setInterval(pollLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filtered = filter ? logs.filter(l => l.toLowerCase().includes(filter.toLowerCase())) : logs;

  const getColor = (line: string) => {
    if (line.includes('error') || line.includes('Error') || line.includes('❌')) return 'text-red-400';
    if (line.includes('warn') || line.includes('Warn') || line.includes('⚠️')) return 'text-yellow-400';
    if (line.includes('✅') || line.includes('info') || line.includes('Info')) return 'text-emerald-400';
    if (line.includes('[Campaign]')) return 'text-blue-400';
    if (line.includes('[Warmup]')) return 'text-purple-400';
    if (line.includes('[Webhook]')) return 'text-cyan-400';
    return 'text-slate-300';
  };

  return (
    <div className="space-y-4">
      <div className="dashboard-card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {connected ? 'Live — atualizando a cada 2s' : 'Conectando...'}
            </span>
          </div>
          <input
            type="text"
            placeholder="Filtrar logs..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full md:w-64 px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-brand-500/50"
          />
        </div>
        <div className="bg-black/60 rounded-xl p-4 h-[500px] overflow-y-auto font-mono text-xs border border-white/5">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-600">
              <Activity size={32} className="mr-2" /> Aguardando logs...
            </div>
          ) : (
            filtered.map((line, i) => (
              <div key={i} className={`py-0.5 ${getColor(line)}`}>
                {line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex justify-between items-center mt-3">
          <span className="text-[10px] text-slate-600">{filtered.length} linhas</span>
          <button
            onClick={() => setLogs([])}
            className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-all"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;