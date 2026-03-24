import React, { useState } from 'react';
import {
  LayoutGrid,
  Send,
  Users,
  Clock,
  MessageSquare,
  Flame,
  Star,
  Plus,
  Zap,
  Shield,
  Play,
  ChevronRight,
  Download,
  Search,
  RefreshCw,
  Upload,
  ChevronDown,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Menu,
  X,
  LogOut,
  Settings,
  Activity,
} from 'lucide-react';

interface VIPDashboardProps {
  onLogout: () => void;
}

type Tab = 'dashboard' | 'disparo' | 'contatos' | 'logs' | 'grupos' | 'aquecimento' | 'conquistas';

interface Campaign {
  id: string;
  name: string;
  status: string;
  sent: number;
  total: number;
}

interface Log {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
  timestamp: string;
}

interface Group {
  id: string;
  name: string;
  members: number;
}

const VIPDashboard: React.FC<VIPDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState({ sent: 0, deliveryRate: 0, failures: 0 });
  const [disparoStep, setDisparoStep] = useState(1);

  // const handleConnectWhatsApp = async () => {
  //   // Integração futura com API
  // };

  // const handleStartWarmup = async () => {
  //   // Integração futura com API
  // };

  // const handleSyncGroups = async () => {
  //   // Integração futura com API
  // };

  const handleConnectWhatsApp = () => {
    setIsConnected(true);
    setSessionId('sess_' + Math.random().toString(36).substring(7));
    setPhoneNumber('+55 11 9****-1234');
  };

  const sidebarItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Painel Geral', icon: <LayoutGrid size={18} /> },
    { id: 'disparo', label: 'Disparador Elite', icon: <Send size={18} /> },
    { id: 'contatos', label: 'Listas de Contatos', icon: <Users size={18} /> },
    { id: 'logs', label: 'Logs de Atividade', icon: <Clock size={18} /> },
    { id: 'grupos', label: 'Gestão de Grupos', icon: <MessageSquare size={18} /> },
    { id: 'aquecimento', label: 'Aquecimento Cloud', icon: <Flame size={18} /> },
    { id: 'conquistas', label: 'Placas de Metas', icon: <Star size={18} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="animate-fade-in space-y-8">
            <header className="dashboard-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-brand-500/20">
              <div>
                <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Resumo</span>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Painel Geral</h1>
                <p className="text-slate-500 text-sm mt-1">Bem-vindo ao centro de comando. Conecte seu número para começar.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={handleConnectWhatsApp}
                  className="bg-brand-600 hover:bg-brand-500 text-white px-6 md:px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-brand-500/20 active:scale-95 border border-white/10"
                >
                  <Plus size={16} />
                  Conectar WhatsApp
                </button>
                <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${isConnected ? 'bg-brand-500/10 border-brand-500/20 text-brand-500' : 'bg-white/5 border-white/5 text-slate-600'}`}>
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-brand-500 animate-pulse' : 'bg-slate-700'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{isConnected ? 'Sessão Ativa' : 'Desconectado'}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[
                { label: 'MENSAGENS ENVIADAS', val: stats.sent.toLocaleString(), badge: 'VOLUME TOTAL', icon: <Zap size={18} />, color: 'text-emerald-500' },
                { label: 'TAXA DE ENTREGA', val: `${stats.deliveryRate}%`, badge: 'ESTABILIDADE', icon: <BarChart3 size={18} />, color: 'text-brand-500' },
                { label: 'FALHAS DETECTADAS', val: stats.failures.toLocaleString(), badge: 'ERROS TÉCNICOS', icon: <AlertCircle size={18} />, color: 'text-rose-500' }
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
                {logs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-20">
                    <Clock size={48} className="text-slate-600" strokeWidth={1} />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Sem logs</span>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                    {logs.slice(0, 10).map(log => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl text-xs">
                        {log.type === 'success' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                        {log.type === 'error' && <XCircle size={14} className="text-rose-500 shrink-0" />}
                        {log.type === 'warning' && <AlertCircle size={14} className="text-amber-500 shrink-0" />}
                        <span className="text-slate-400 truncate">{log.message}</span>
                        <span className="text-slate-600 text-[9px] ml-auto shrink-0">{log.timestamp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'disparo':
        return (
          <div className="animate-fade-in space-y-12">
            <header className="dashboard-card">
              <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Envio</span>
              <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Disparador Elite</h1>
              <p className="text-slate-500 text-sm mt-1">Configuração dinâmica de fluxos em massa.</p>

              <div className="mt-12 md:mt-16 relative flex justify-between items-center max-w-2xl mx-auto">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 -translate-y-1/2" />
                {[
                  { id: 1, label: 'Configurações', icon: <Settings size={20} /> },
                  { id: 2, label: 'Conteúdo', icon: <MessageSquare size={20} /> },
                  { id: 3, label: 'Destinatários', icon: <Users size={20} /> }
                ].map((step) => (
                  <div key={step.id} className="relative z-10 flex flex-col items-center gap-3 md:gap-4">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all ${disparoStep === step.id ? 'bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40 border border-emerald-400/30' : 'bg-[#0d1117] text-slate-600 border border-white/5'}`}>
                      {step.icon}
                    </div>
                    <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] ${disparoStep === step.id ? 'text-white' : 'text-slate-600'}`}>{step.label}</span>
                    {disparoStep === step.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />}
                  </div>
                ))}
              </div>
            </header>

            <div className="dashboard-card space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome da Campanha</label>
                  <input type="text" placeholder="Ex: Promoção de Natal 2024" className="w-full bg-[#0d1117] border border-white/5 rounded-2xl px-6 md:px-8 py-5 md:py-6 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 transition-all" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Escolher Instância</label>
                  <div className="relative">
                    <select className="w-full bg-[#0d1117] border border-white/5 rounded-2xl px-6 md:px-8 py-5 md:py-6 text-sm font-bold outline-none appearance-none cursor-pointer focus:border-emerald-500/40 transition-all">
                      <option>Selecionar WhatsApp Conectado</option>
                      {isConnected && <option>{phoneNumber}</option>}
                    </select>
                    <ChevronDown size={16} className="text-slate-500 absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="bg-[#0d1117] p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5 md:gap-6">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white italic uppercase tracking-tighter">Modo de Teste</div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Envie para você mesmo antes de disparar.</p>
                  </div>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-14 h-8 bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-6" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-10 border-t border-white/5">
                {disparoStep > 1 && (
                  <button onClick={() => setDisparoStep(prev => Math.max(prev - 1, 1))} className="bg-white/5 hover:bg-white/10 text-white px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 border border-white/5">
                    Voltar
                  </button>
                )}
                <button onClick={() => setDisparoStep(prev => Math.min(prev + 1, 3))} className="bg-emerald-500 hover:bg-emerald-400 text-white px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 shadow-2xl shadow-emerald-500/20 active:scale-95 ml-auto">
                  {disparoStep === 3 ? 'Iniciar Disparo' : 'Próximo Passo'}
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        );

      case 'contatos':
        return (
          <div className="animate-fade-in space-y-10">
            <header className="dashboard-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Gestão</span>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Listas de Contatos</h1>
                <p className="text-slate-500 text-sm mt-1">Crie listas segmentadas com variáveis personalizadas.</p>
              </div>
              <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 md:px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 shadow-2xl shadow-emerald-500/20 active:scale-95">
                <Plus size={18} />
                Nova Lista
              </button>
            </header>

            {campaigns.length === 0 ? (
              <div className="py-32 md:py-40 flex flex-col items-center justify-center gap-6 opacity-30">
                <Users size={80} className="text-slate-600" strokeWidth={1} />
                <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600 italic">Nenhuma lista criada ainda.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Future: map campaigns here */}
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
              <button className={`bg-white/5 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all border border-white/5 ${logs.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`} disabled={logs.length === 0}>
                <Download size={14} />
                Exportar CSV
              </button>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: 'TOTAL HOJE', val: '0', color: 'text-brand-500' },
                { label: 'SUCESSO', val: '0', color: 'text-emerald-500' },
                { label: 'FALHAS', val: '0', color: 'text-rose-500' },
                { label: 'PENDENTES', val: '0', color: 'text-amber-500' }
              ].map((s, i) => (
                <div key={i} className="dashboard-card text-center border-white/5">
                  <div className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">{s.label}</div>
                  <div className={`text-3xl md:text-4xl font-black italic tracking-tighter ${s.color}`}>{s.val}</div>
                </div>
              ))}
            </div>

            {logs.length === 0 ? (
              <div className="dashboard-card py-20 md:p-24 flex flex-col items-center justify-center gap-6 border-white/5 opacity-20">
                <Activity size={64} className="text-slate-600" strokeWidth={1} />
                <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600 italic">Lista de logs vazia</span>
              </div>
            ) : (
              <div className="dashboard-card space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-4 bg-white/5 rounded-xl text-xs border border-white/5">
                    {log.type === 'success' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                    {log.type === 'error' && <XCircle size={14} className="text-rose-500 shrink-0" />}
                    {log.type === 'warning' && <AlertCircle size={14} className="text-amber-500 shrink-0" />}
                    <span className="text-slate-400 truncate">{log.message}</span>
                    <span className="text-slate-600 text-[9px] ml-auto shrink-0">{log.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
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
                  <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/10 flex items-center gap-4 cursor-pointer hover:border-brand-500/30 transition-all opacity-50">
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
                {groups.length === 0 ? (
                  <div className="flex flex-col items-center gap-6 opacity-40 mt-16">
                    <Users size={80} className="text-slate-600" strokeWidth={1} />
                    <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600 italic">Nenhum Grupo Encontrado...</span>
                  </div>
                ) : (
                  <div className="w-full space-y-3 mt-20 overflow-y-auto custom-scrollbar">
                    {groups.map(g => (
                      <div key={g.id} className="flex items-center justify-between px-6 py-4 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-sm font-bold text-white">{g.name}</span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{g.members} membros</span>
                      </div>
                    ))}
                  </div>
                )}
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
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                        <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">Índice de Maturação</h3>
                        <div className="bg-white/5 px-4 py-1 rounded-full border border-white/5 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sistema Standby</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-8 md:mb-10">
                        <span className="text-slate-500 font-black italic uppercase text-xs">Aguardando Início...</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 md:gap-4">
                        {[
                          { label: 'TOTAL INTERAÇÕES', val: '0' },
                          { label: 'TEMPO DE UPTIME', val: '00:00:00' },
                          { label: 'DELAY MÉDIO', val: '--' }
                        ].map((s, i) => (
                          <div key={i} className="bg-white/5 p-4 md:p-6 rounded-2xl border border-white/5 text-center">
                            <div className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase mb-2 tracking-widest">{s.label}</div>
                            <div className="text-lg md:text-xl font-black text-white italic">{s.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="dashboard-card">
                    <div className="flex items-center gap-4 mb-8 md:mb-10">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-500/20">
                        <Zap size={18} />
                      </div>
                      <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Velocidade do Motor</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      {['Humano', 'Veloz', 'Turbo Elite', 'Caótico'].map((v, i) => (
                        <button key={i} className={`p-5 md:p-6 rounded-2xl border transition-all text-center hover:scale-105 ${v === 'Veloz' ? 'bg-brand-500/10 border-brand-500/40' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                          <div className={`text-sm font-black italic uppercase ${v === 'Veloz' ? 'text-white' : 'text-slate-400'}`}>{v}</div>
                          <div className="text-[9px] text-slate-600 font-bold uppercase mt-1">15-30 seg</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="dashboard-card">
                    <div className="flex items-center gap-4 mb-8 md:mb-10">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 size={18} />
                      </div>
                      <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Modo & Instâncias</h3>
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl border border-white/5 flex mb-8">
                      <button className="flex-1 py-3 bg-emerald-500 text-white font-black text-[10px] uppercase rounded-lg shadow-xl shadow-emerald-500/10">Modo Solo</button>
                      <button className="flex-1 py-3 text-slate-500 font-black text-[10px] uppercase hover:text-white transition-colors">Ping Pong</button>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Instância Principal</label>
                      <div className="relative">
                        <select className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-6 py-4 text-white text-xs font-bold appearance-none outline-none focus:border-brand-500 transition-all">
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
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Monitoramento Realtime</h3>
                  <span className="text-[9px] font-bold text-brand-500 uppercase tracking-widest animate-pulse italic">Live</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-6 opacity-20">
                  <Activity size={64} className="text-slate-600" strokeWidth={1} />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-center">Nenhuma atividade registrada no console.</span>
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
          {
            title: 'Placa de 100k',
            subtitle: 'Expert Global',
            image: 'https://i.ibb.co/9HNDWPXS/Design-sem-nome.png',
            desc: 'Concedida ao atingir 100 mil disparos entregues.',
            color: 'border-slate-400/30'
          },
          {
            title: 'Placa de 500k',
            subtitle: 'Expert Global',
            image: '5hFcMKsF/Chat-GPT-Image-23-de-mar-de-2026-18-26-06.png',
            desc: 'Concedida ao atingir 500 mil disparos entregues.',
            color: 'border-brand-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
          },
          {
            title: 'Placa de 1 Milhão',
            subtitle: 'Lenda das Vendas',
            image: 'https://i.ibb.co/Xx2H9Z6v/Design-sem-nome-2.png',
            desc: 'O ápice da escala. Um milhão de mensagens enviadas.',
            color: 'border-brand-600 shadow-[0_0_40px_rgba(37,99,235,0.3)]'
          }
        ];
        return (
          <div className="animate-fade-in space-y-10">
            <header className="dashboard-card">
              <span className="bg-brand-500/10 text-brand-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Recompensas</span>
              <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Minhas Conquistas</h1>
              <p className="text-slate-500 text-sm mt-1">Acompanhe seu progresso e desbloqueie placas físicas exclusivas.</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              {plaques.map((plaque, idx) => (
                <div key={idx} className={`dashboard-card !p-4 border ${plaque.color} relative overflow-hidden group hover:scale-105 transition-transform duration-500`}>
                  <div className="bg-[#1c2433] rounded-3xl p-5 md:p-6 h-full flex flex-col">
                    <div className="aspect-square rounded-2xl overflow-hidden mb-6 relative">
                      <img src={plaque.image} alt={plaque.title} className="w-full h-full object-cover filter grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center group-hover:bg-transparent transition-all">
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 group-hover:hidden">
                          <span className="text-[9px] font-black text-white uppercase tracking-widest">Bloqueado</span>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-lg md:text-xl font-black text-white italic uppercase tracking-tighter mb-1">{plaque.title}</h3>
                    <div className="text-brand-500 text-[9px] font-black uppercase tracking-widest mb-4">{plaque.subtitle}</div>
                    <div className="flex-1 text-[11px] text-slate-500 font-medium leading-relaxed mb-6">{plaque.desc}</div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="w-0 h-full bg-brand-500 transition-all duration-1000 group-hover:w-[10%]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="text-slate-400 font-black italic uppercase p-40 text-center opacity-40">Em breve...</div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col lg:flex-row transition-colors duration-500">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Mobile hamburger */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-5 left-5 z-[60] lg:hidden w-12 h-12 bg-[#1c2433] border border-white/10 rounded-2xl flex items-center justify-center text-white shadow-2xl active:scale-95 transition-transform"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-[#0b1121] border-r border-white/5 p-6 md:p-8 flex flex-col shrink-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/80' : '-translate-x-full'}`}>
        <div className="flex items-center gap-4 mb-16 md:mb-20 group cursor-pointer pt-2">
          <div className="w-12 h-12 bg-brand-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl shadow-brand-600/30 shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div className="text-xl font-black italic tracking-tighter uppercase text-white flex flex-col leading-none">
            <span>GLOBAL</span><span className="gradient-text-blue -mt-1">DISPAROS</span>
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
          <button onClick={onLogout} className="w-full text-slate-500 hover:text-rose-500 font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group">
            <LogOut size={14} />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 pt-20 md:p-8 lg:p-16 overflow-y-auto bg-[#0d1117] lg:pt-16">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default VIPDashboard;
