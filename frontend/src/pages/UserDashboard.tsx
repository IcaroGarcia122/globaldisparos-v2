import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import HelpCenterTab from '@/components/HelpCenterTab';
import ConnectWhatsApp from '@/components/ConnectWhatsAPP';
import CreateInstance from '@/components/CreateInstance';
import CampaignDispatcher from '@/components/CampaignDispatcher';
import { fetchAPI } from '@/config/api';
import { useBackendAuth } from '@/hooks/useBackendAuth';
import {
  LayoutGrid, Send, Users, Clock, MessageSquare, Flame, Star, Plus, Zap, Shield, Play,
  ChevronRight, Download, Search, RefreshCw, Upload, ChevronDown, BarChart3,
  CheckCircle2, XCircle, AlertCircle, Menu, X, LogOut, Settings, Activity, CreditCard, User,
  HelpCircle, BookOpen, Headphones, MessageCircle, Smartphone, ShieldCheck, ChevronUp
} from 'lucide-react';

type Tab = 'dashboard' | 'disparo' | 'contatos' | 'logs' | 'grupos' | 'aquecimento' | 'conquistas' | 'plano' | 'ajuda';

const UserDashboard: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useBackendAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [disparoStep, setDisparoStep] = useState(1);
  const [userName, setUserName] = useState('Usuário');
  const [userEmail, setUserEmail] = useState('--');
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [totalMessagesSent, setTotalMessagesSent] = useState(0);

  // Carregar instâncias do usuário
  const reloadInstances = async () => {
    setLoadingInstances(true);
    try {
      const data = await fetchAPI('/instances');
      setInstances(data);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setLoadingInstances(false);
    }
  };

  // Carregar listas de contatos
  const reloadContactLists = async () => {
    try {
      const data = await fetchAPI('/contacts');
      setContactLists(data || []);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
    }
  };

  // Carregar dados de disparos
  const loadDisparoStats = async () => {
    try {
      const data = await fetchAPI('/stats/user');
      setTotalMessagesSent(data.totalMessagesSent || 0);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  // Criar nova lista de contatos
  const createNewList = async () => {
    if (!newListName.trim()) {
      alert('Digite um nome para a lista');
      return;
    }
    try {
      await fetchAPI('/contacts', {
        method: 'POST',
        body: { name: newListName }
      });
      setNewListName('');
      setShowNewListModal(false);
      reloadContactLists();
    } catch (error) {
      console.error('Erro ao criar lista:', error);
      alert('Erro ao criar lista');
    }
  };

  useEffect(() => {
    // Só carrega instâncias após auth estar pronto e se está autenticado
    if (!authLoading && isAuthenticated) {
      reloadInstances();
      reloadContactLists();
      loadDisparoStats();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUserName(userData.fullName || userData.email?.split('@')[0] || 'Usuário');
        setUserEmail(userData.email || '--');
      } catch {
        // Falha ao parsear, deixa valores padrão
      }
    }
  }, []);

  const sidebarItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Painel Geral', icon: <LayoutGrid size={18} /> },
    { id: 'disparo', label: 'Disparador Elite', icon: <Send size={18} /> },
    { id: 'contatos', label: 'Listas de Contatos', icon: <Users size={18} /> },
    { id: 'logs', label: 'Logs de Atividade', icon: <Clock size={18} /> },
    { id: 'grupos', label: 'Gestão de Grupos', icon: <MessageSquare size={18} /> },
    { id: 'aquecimento', label: 'Aquecimento Cloud', icon: <Flame size={18} /> },
    { id: 'conquistas', label: 'Placas de Metas', icon: <Star size={18} /> },
    { id: 'plano', label: 'Meu Plano', icon: <CreditCard size={18} /> },
    { id: 'ajuda', label: 'Central de Ajuda', icon: <HelpCircle size={18} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="animate-fade-in space-y-8">
            <header className="dashboard-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-brand-500/20">
              <div>
                <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Resumo</span>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">
                  Olá, {userName}
                </h1>
                <p className="text-slate-500 text-sm mt-1">Bem-vindo ao seu centro de comando.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setShowConnectModal(!showConnectModal)}
                  className="bg-brand-600 hover:bg-brand-500 text-white px-6 md:px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-brand-500/20 active:scale-95 border border-white/10">
                  <Plus size={16} />
                  Conectar WhatsApp
                </button>
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-white/5 border-white/5 text-slate-600">
                  <div className="w-2 h-2 rounded-full bg-slate-700" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {instances.length > 0 ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              </div>
            </header>

            {showConnectModal && (
              <div className="dashboard-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-white uppercase">Gerenciar Conexões WhatsApp</h2>
                  <button
                    onClick={() => setShowConnectModal(false)}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {instances.length === 0 ? (
                  <CreateInstance onSuccess={() => {
                    reloadInstances();
                    setShowConnectModal(false);
                  }} />
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {instances.map((instance) => (
                        <ConnectWhatsApp key={instance.id} instanceId={instance.id} onConnected={() => reloadInstances()} />
                      ))}
                    </div>
                    <button
                      onClick={() => setShowConnectModal(false)}
                      className="w-full py-2 text-slate-400 hover:text-white text-xs uppercase font-black tracking-widest transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            )}

            {!showConnectModal && instances.length === 0 && (
              <div className="dashboard-card">
                <CreateInstance onSuccess={() => reloadInstances()} />
              </div>
            )}

            {!showConnectModal && instances.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {instances.map((instance) => (
                  <div key={instance.id}>
                    <ConnectWhatsApp instanceId={instance.id} />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[
                { label: 'MENSAGENS ENVIADAS', val: '0', badge: 'VOLUME TOTAL', icon: <Zap size={18} />, color: 'text-emerald-500' },
                { label: 'TAXA DE ENTREGA', val: '0%', badge: 'ESTABILIDADE', icon: <BarChart3 size={18} />, color: 'text-brand-500' },
                { label: 'FALHAS DETECTADAS', val: '0', badge: 'ERROS TÉCNICOS', icon: <AlertCircle size={18} />, color: 'text-rose-500' }
              ].map((s, i) => (
                <div key={i} className="dashboard-card flex flex-col justify-between relative overflow-hidden group hover:scale-105 transition-transform text-center">
                  <div className="flex justify-center mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 border border-white/10">{s.icon}</div>
                  </div>
                  <span className="text-[8px] font-black text-slate-500 uppercase border border-white/5 px-2 py-1 rounded tracking-tighter mx-auto mb-4">{s.badge}</span>
                  <div>
                    <div className="text-[9px] font-black text-slate-500 uppercase mb-2">{s.label}</div>
                    <div className="text-3xl md:text-4xl font-black text-white italic tracking-tighter">{s.val}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 dashboard-card flex flex-col items-center justify-center min-h-[300px]">
                <h3 className="text-xl font-black text-white italic uppercase mb-8 self-start">Fluxo de Disparos</h3>
                <div className="flex flex-col items-center gap-4 opacity-20">
                  <BarChart3 size={64} className="text-slate-600" strokeWidth={1} />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Aguardando dados...</span>
                </div>
              </div>
              <div className="dashboard-card min-h-[300px] flex flex-col">
                <h3 className="text-xl font-black text-white italic uppercase mb-8">Atividade Recente</h3>
                <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-20">
                  <Clock size={48} className="text-slate-600" strokeWidth={1} />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Sem logs</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'disparo':
        return <CampaignDispatcher />;

      case 'contatos':
        return (
          <div className="animate-fade-in space-y-10">
            <header className="dashboard-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Gestão</span>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Listas de Contatos</h1>
                <p className="text-slate-500 text-sm mt-1">Crie listas segmentadas com variáveis personalizadas.</p>
              </div>
              <button onClick={() => setShowNewListModal(true)} className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 md:px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 shadow-2xl shadow-emerald-500/20 active:scale-95">
                <Plus size={18} />
                Nova Lista
              </button>
            </header>

            {showNewListModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-[#1c2433] border border-white/5 rounded-2xl p-8 max-w-md w-full">
                  <h2 className="text-xl font-black text-white uppercase mb-4">Criar Nova Lista</h2>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="Nome da lista..."
                    className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700 mb-4"
                    onKeyPress={(e) => e.key === 'Enter' && createNewList()}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={createNewList}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Criar
                    </button>
                    <button
                      onClick={() => {
                        setShowNewListModal(false);
                        setNewListName('');
                      }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {contactLists.length === 0 ? (
              <div className="py-32 md:py-40 flex flex-col items-center justify-center gap-6 opacity-30">
                <Users size={80} className="text-slate-600" strokeWidth={1} />
                <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600 italic">Nenhuma lista criada ainda.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {contactLists.map((list: any) => (
                  <div key={list.id} className="dashboard-card">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-black text-white uppercase">{list.name}</h3>
                        <p className="text-slate-500 text-sm mt-1">{list.count || 0} contatos</p>
                      </div>
                      <button className="text-red-500 hover:text-red-400 transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                    <button className="w-full py-2 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-black uppercase transition-all">
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'logs':
        return (
          <div className="animate-fade-in space-y-8">
            <header className="dashboard-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Sistema</span>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Logs de Atividade</h1>
                <p className="text-slate-500 text-sm mt-1">Nenhum disparo realizado até o momento.</p>
              </div>
              <button className="bg-white/5 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all border border-white/5 opacity-50 cursor-not-allowed" disabled>
                <Download size={14} />
                Exportar CSV
              </button>
            </header>
            <div className="dashboard-card py-20 md:p-24 flex flex-col items-center justify-center gap-6 border-white/5 opacity-20">
              <Activity size={64} className="text-slate-600" strokeWidth={1} />
              <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600 italic">Lista de logs vazia</span>
            </div>
          </div>
        );

      case 'grupos':
        return (
          <div className="animate-fade-in space-y-8">
            <header className="dashboard-card">
              <span className="bg-brand-500/10 text-brand-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Gestão de Grupos</span>
              <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Adição em Massa</h1>
              <p className="text-slate-500 text-sm mt-1">Adicione membros de uma planilha automaticamente aos seus grupos.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="dashboard-card space-y-10 md:space-y-12">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">1. Selecionar WhatsApp</label>
                  <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10 flex items-center gap-4 cursor-pointer hover:border-brand-500/30 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[#0d1117] border border-white/10 flex items-center justify-center">
                      <MessageSquare size={16} className="text-slate-600" />
                    </div>
                    <span className="text-sm font-bold text-white">Nenhuma Instância</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">2. Modo de Operação</label>
                  <button className="w-full py-4 rounded-xl border border-white/10 bg-white/5 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Grupo Existente</button>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">3. Upload Planilha</label>
                  <div className="border-2 border-dashed border-white/10 rounded-[2rem] p-10 md:p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-all text-slate-500 hover:text-white group">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Selecionar XLSX</span>
                  </div>
                </div>

                <button className="w-full py-5 rounded-2xl bg-white/5 text-slate-700 font-black text-[11px] uppercase tracking-[0.3em] cursor-not-allowed border border-white/5">
                  Iniciar Adição
                </button>
              </div>

              <div className="lg:col-span-3 dashboard-card flex flex-col items-center justify-center gap-8 relative overflow-hidden min-h-[400px]">
                <div className="absolute top-8 md:top-10 left-8 md:left-10 right-8 md:right-10 flex items-center gap-4">
                  <div className="relative flex-1">
                    <input type="text" placeholder="Filtrar grupos existentes..." className="w-full bg-[#0d1117] border border-white/5 rounded-2xl px-12 md:px-14 py-4 text-sm font-medium outline-none focus:border-brand-500/40 transition-all" />
                    <Search size={16} className="text-slate-600 absolute left-5 md:left-6 top-1/2 -translate-y-1/2" />
                  </div>
                  <button className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 transition-all cursor-not-allowed shrink-0">
                    <RefreshCw size={18} />
                  </button>
                </div>
                <div className="flex flex-col items-center gap-6 opacity-40 mt-16">
                  <Users size={80} className="text-slate-600" strokeWidth={1} />
                  <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600 italic">Nenhum Grupo Encontrado...</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'aquecimento':
        return (
          <div className="animate-fade-in space-y-10">
            <header className="dashboard-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
              <div className="relative z-10">
                <span className="bg-brand-500/10 text-brand-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Maturação</span>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Aquecimento Cloud</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">Aumente a autoridade do seu chip de forma 100% automática.</p>
              </div>
              <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 shadow-2xl shadow-emerald-500/20 active:scale-95">
                <Play size={16} />
                Iniciar Maturação Cloud
              </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="dashboard-card relative overflow-visible">
                  <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
                    <div className="circle-progress-container">
                      <svg width="200" height="200" className="circle-progress-svg">
                        <circle cx="100" cy="100" r="85" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="14" />
                        <circle cx="100" cy="100" r="85" fill="transparent" stroke="#10b981" strokeWidth="14" strokeDasharray="534" strokeDashoffset="534" strokeLinecap="round" className="glow-green transition-all duration-1000" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-5xl md:text-6xl font-black text-white italic tracking-tighter leading-none">0%</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Maturidade</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                        <h3 className="text-lg md:text-xl font-black text-white italic uppercase tracking-tighter">Índice de Maturação</h3>
                        <div className="bg-white/5 px-4 py-1 rounded-full border border-white/5 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sistema Standby</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-6">
                        <Flame size={14} className="text-orange-500" />
                        <span className="text-slate-500 font-black italic uppercase text-[10px]">Aguardando Início...</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 md:gap-4">
                        {[
                          { label: 'TOTAL INTERAÇÕES', val: '0' },
                          { label: 'TEMPO DE UPTIME', val: '00:00:00' },
                          { label: 'DELAY MÉDIO', val: '--' }
                        ].map((s, i) => (
                          <div key={i} className="bg-white/5 p-3 md:p-4 rounded-2xl border border-white/5 text-center">
                            <div className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">{s.label}</div>
                            <div className="text-lg font-black text-white italic">{s.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Velocidade do Motor + Modo & Instâncias */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="dashboard-card">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-500/20">
                        <Zap size={18} />
                      </div>
                      <h3 className="text-base font-black text-white italic uppercase tracking-tighter">Velocidade do Motor</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { name: 'Humano', delay: '30-60 seg' },
                        { name: 'Veloz', delay: '15-30 seg' },
                        { name: 'Turbo Elite', delay: '5-15 seg' },
                        { name: 'Caótico', delay: 'Aleatório' }
                      ].map((v, i) => (
                        <button key={i} className={`p-4 rounded-2xl border transition-all text-center hover:scale-105 ${i === 1 ? 'bg-brand-500/10 border-brand-500/40' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                          <div className={`text-xs font-black italic uppercase ${i === 1 ? 'text-white' : 'text-slate-400'}`}>{v.name}</div>
                          <div className="text-[8px] text-slate-600 font-bold uppercase mt-1">{v.delay}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="dashboard-card">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 size={18} />
                      </div>
                      <h3 className="text-base font-black text-white italic uppercase tracking-tighter">Modo & Instâncias</h3>
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5 flex mb-6">
                      <button className="flex-1 py-3 bg-emerald-500 text-white font-black text-[10px] uppercase rounded-lg shadow-xl shadow-emerald-500/10">Modo Solo</button>
                      <button className="flex-1 py-3 text-slate-500 font-black text-[10px] uppercase hover:text-white transition-colors">Ping Pong</button>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Instância Principal</label>
                      <div className="relative">
                        <select className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-5 py-3 text-white text-xs font-bold appearance-none outline-none focus:border-brand-500 transition-all">
                          <option>Nenhuma conectada</option>
                        </select>
                        <ChevronDown size={14} className="text-slate-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dashboard-card flex flex-col h-full relative overflow-hidden">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Monitoramento Realtime</h3>
                  <span className="text-[9px] font-bold text-brand-500 uppercase tracking-widest animate-pulse italic">Live</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-6 opacity-20">
                  <Activity size={64} className="text-slate-600" strokeWidth={1} />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-center">Nenhuma atividade registrada.</span>
                </div>
                <div className="mt-8 bg-brand-500/5 p-5 md:p-6 rounded-2xl border border-brand-500/10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-500 shrink-0">
                    <Shield size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-widest">PROTEÇÃO ANTI-BAN</div>
                    <p className="text-[9px] text-slate-500 font-medium">Variação inteligente de delay e simulação ativa.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'conquistas':
        const plaques = [
          { title: 'Placa de 10k', subtitle: 'Iniciante PRO', image: 'https://i.ibb.co/ym0R0PTf/Design-sem-nome-1.png', desc: 'Concedida ao atingir 10 mil disparos entregues.', color: 'border-slate-400/30', target: 10000 },
          { title: 'Placa de 100k', subtitle: 'Expert Global', image: 'https://i.ibb.co/9HNDWPXS/Design-sem-nome.png', desc: 'Concedida ao atingir 100 mil disparos entregues.', color: 'border-brand-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]', target: 100000 },
          { title: 'Placa de 1 Milhão', subtitle: 'Lenda das Vendas', image: 'https://i.ibb.co/Xx2H9Z6v/Design-sem-nome-2.png', desc: 'O ápice da escala. Um milhão de mensagens enviadas.', color: 'border-brand-600 shadow-[0_0_40px_rgba(37,99,235,0.3)]', target: 1000000 }
        ];
        return (
          <div className="animate-fade-in space-y-10">
            <header className="dashboard-card">
              <span className="bg-brand-500/10 text-brand-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Recompensas</span>
              <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Minhas Conquistas</h1>
              <p className="text-slate-500 text-sm mt-1">Acompanhe seu progresso e desbloqueie placas físicas exclusivas.</p>
            </header>

            {/* Total de Disparos */}
            <div className="dashboard-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-white uppercase">Seus Disparos Totais</h3>
                <span className="text-3xl font-black text-brand-500">{totalMessagesSent.toLocaleString()}</span>
              </div>
              <p className="text-slate-500 text-sm mb-6">Progresso geral de mensagens enviadas.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              {plaques.map((plaque, idx) => {
                const percentage = Math.min((totalMessagesSent / plaque.target) * 100, 100);
                const isUnlocked = totalMessagesSent >= plaque.target;

                return (
                  <div key={idx} className={`dashboard-card !p-4 border ${plaque.color} relative overflow-hidden group hover:scale-105 transition-transform duration-500`}>
                    <div className="bg-[#1c2433] rounded-3xl p-5 md:p-6 h-full flex flex-col">
                      <div className="aspect-square rounded-2xl overflow-hidden mb-6 relative">
                        <img src={plaque.image} alt={plaque.title} className={`w-full h-full object-cover transition-all duration-700 ${isUnlocked ? 'filter-none opacity-100' : 'filter grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100'}`} />
                        {!isUnlocked && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center group-hover:bg-transparent transition-all">
                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 group-hover:hidden">
                              <span className="text-[9px] font-black text-white uppercase tracking-widest">Bloqueado</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg md:text-xl font-black text-white italic uppercase tracking-tighter mb-1">{plaque.title}</h3>
                      <div className="text-brand-500 text-[9px] font-black uppercase tracking-widest mb-4">{plaque.subtitle}</div>
                      <div className="flex-1 text-[11px] text-slate-500 font-medium leading-relaxed mb-4">
                        {plaque.desc}
                        <p className="mt-2 text-brand-400">Progresso: {totalMessagesSent.toLocaleString()} / {plaque.target.toLocaleString()}</p>
                      </div>

                      {/* Barra de Progressão */}
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
                        <div
                          className={`h-full ${isUnlocked ? 'bg-emerald-500' : 'bg-brand-500'} transition-all duration-1000`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      {/* Botão WhatsApp */}
                      <a
                        href={`https://wa.me/5542999538607?text=Olá! Meu progresso atual é ${totalMessagesSent.toLocaleString()} disparos. ${isUnlocked ? `Atingi o objetivo de ${plaque.target.toLocaleString()} e gostaria de receber a placa de ${plaque.title}!` : `Estou progredindo para a placa de ${plaque.target.toLocaleString()} disparos.`}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2"
                      >
                        📱 Contato via WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="dashboard-card bg-brand-500/5 border border-brand-500/20">
              <p className="text-sm text-slate-400 text-center italic">
                💡 Chamar no WhatsApp ao lado e mandar uma print da sua progressão para receber a placa física no seu endereço!
              </p>
            </div>
          </div>
        );

      case 'plano':
        return (
          <div className="animate-fade-in space-y-10">
            <header className="dashboard-card">
              <span className="bg-brand-500/10 text-brand-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Assinatura</span>
              <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Meu Plano</h1>
              <p className="text-slate-500 text-sm mt-1">Gerencie sua assinatura e veja seu histórico.</p>
            </header>

            <div className="dashboard-card">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Plano Atual</div>
                  <div className="text-3xl font-black text-white italic uppercase tracking-tighter">--</div>
                  <div className="text-brand-500 text-sm font-bold mt-1">--</div>
                </div>
                <div className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Sem plano
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Mensagens Enviadas</div>
                  <div className="text-2xl font-black text-white italic">0</div>
                  <div className="text-[9px] text-slate-600 mt-1">de 0 do plano</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Sessões WhatsApp</div>
                  <div className="text-2xl font-black text-white italic">0</div>
                  <div className="text-[9px] text-slate-600 mt-1">0 conectada(s)</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Mensal', price: 'R$ 69,90', period: '/mês' },
                { name: 'Trimestral', price: 'R$ 149,90', period: '/trim' },
                { name: 'Anual', price: 'R$ 299,90', period: '/ano' },
              ].map((p, i) => (
                <div key={i} className="dashboard-card text-center">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{p.name}</div>
                  <div className="text-3xl font-black text-white italic tracking-tighter mb-1">{p.price}</div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-6">{p.period}</div>
                  <button className="block w-full py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-brand-500/20 active:scale-95">
                    Assinar
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'ajuda':
        return <HelpCenterTab onNavigate={(tab) => setActiveTab(tab as Tab)} />;

      default:
        return <div className="text-slate-400 font-black italic uppercase p-40 text-center opacity-40">Em breve...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col lg:flex-row transition-colors duration-500">
      {/* Loading state enquanto sincroniza autenticação */}
      {authLoading && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600/30 border-t-brand-600 rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-white font-black uppercase text-sm tracking-widest">Sincronizando...</p>
            <p className="text-slate-500 text-xs mt-1">Verificando suas credenciais</p>
          </div>
        </div>
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-5 left-5 z-[60] lg:hidden w-12 h-12 bg-[#1c2433] border border-white/10 rounded-2xl flex items-center justify-center text-white shadow-2xl active:scale-95 transition-transform"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 w-72 bg-[#0b1121] border-r border-white/5 p-6 md:p-8 flex flex-col shrink-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/80' : '-translate-x-full'}`}>
        <div className="flex items-center gap-4 mb-16 md:mb-20 group cursor-pointer pt-2">
          <div className="w-12 h-12 bg-brand-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl shadow-brand-600/30 shrink-0">
            <Zap size={24} />
          </div>
          <div className="text-xl font-black italic tracking-tighter uppercase text-white flex flex-col leading-none">
            <span>GLOBAL</span><span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>

        {/* User info */}
        <div className="mb-8 px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-500">
              <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{userName}</div>
              <div className="text-[9px] text-slate-500 truncate">{userEmail}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 md:space-y-3 overflow-y-auto custom-scrollbar pr-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-5 md:px-6 py-3.5 md:py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all group ${activeTab === item.id ? 'bg-brand-600 text-white shadow-2xl shadow-brand-600/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-8 pt-8 border-t border-white/5">
          <button
            onClick={async () => {
              const { supabase } = await import('@/integrations/supabase/client');
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
            className="w-full text-slate-500 hover:text-rose-500 font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group"
          >
            <LogOut size={14} />
            Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 pt-20 md:p-8 lg:p-16 overflow-y-auto bg-[#0d1117] lg:pt-16">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;
