import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import HelpCenterTab from '@/components/HelpCenterTab';
import ConnectWhatsApp from '@/components/ConnectWhatsAPP';
import CreateInstance from '@/components/CreateInstance';
import EliteDispatcher from '@/components/EliteDispatcher';
import GroupToXlsxExporter from '@/components/GroupToXlsxExporter';
import GroupManager from '@/components/GroupManager';
import WarmupCloud from '@/components/WarmupCloud';
import GoalsTracker from '@/components/GoalsTracker';
import InstanceManager from './InstanceManager';
import { fetchAPI } from '@/config/api';
import { useBackendAuth } from '@/hooks/useBackendAuth';
import {
  LayoutGrid, Send, Users, Clock, MessageSquare, Flame, Star, Plus, Zap, Shield, Play,
  ChevronRight, Download, Search, RefreshCw, Upload, ChevronDown, BarChart3,
  CheckCircle2, XCircle, AlertCircle, Menu, X, LogOut, Settings, Activity, CreditCard, User,
  HelpCircle, BookOpen, Headphones, MessageCircle, Smartphone, ShieldCheck, ChevronUp
} from 'lucide-react';

type Tab = 'dashboard' | 'instancias' | 'disparo' | 'contatos' | 'logs' | 'grupos' | 'aquecimento' | 'conquistas' | 'plano' | 'ajuda';

const UserDashboard: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useBackendAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [disparoStep, setDisparoStep] = useState(1);
  const [userName, setUserName] = useState('Usuário');
  const [userEmail, setUserEmail] = useState('--');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [deletingInstanceId, setDeletingInstanceId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCreateInstanceModal, setShowCreateInstanceModal] = useState(false);
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState(0);
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [totalMessagesSent, setTotalMessagesSent] = useState(0);
  const [showInstanceSuccessMessage, setShowInstanceSuccessMessage] = useState(false);
  const [stats, setStats] = useState<any>({ totalMessagesSent: 0, totalMessagesFailed: 0, successRate: '0%', connectedInstances: 0, totalInstances: 0, runningCampaigns: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoaded, setLogsLoaded] = useState(false);

  // Carregar instâncias do usuário
  const reloadInstances = async () => {
    setLoadingInstances(true);
    try {
      console.log('🔄 Carregando instâncias...');
      const response = await fetchAPI('/instances');
      // API retorna {data: [...], pagination: {...}} ou {instances: [...], pagination: {...}}
      const data = response?.data || response?.instances || response || [];
      console.log(`✅ ${data.length} instância(s) carregada(s):`, data);
      setInstances(Array.isArray(data) ? data : []);
      if (data.length > 0) {
        setSelectedInstanceIndex(0);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias:', error);
    } finally {
      setLoadingInstances(false);
    }
  };

  // Deletar instância
  const deleteInstance = async (instanceId: string) => {
    setDeletingInstanceId(instanceId);
    try {
      console.log(`🗑️ Deletando instância ${instanceId}...`);
      const response = await fetchAPI(`/instances/${instanceId}`, {
        method: 'DELETE'
      });
      console.log(`✅ Instância ${instanceId} deletada:`, response);
      // Aguarda um pouco para mostrar feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      // Recarrega a lista
      await reloadInstances();
    } catch (error: any) {
      console.error('❌ Erro ao deletar instância:', error);
      alert(`Erro ao deletar instância: ${error.message || 'Tente novamente.'}`);
    } finally {
      setDeletingInstanceId(null);
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

  // Carregar dados de disparos e stats
  const loadDisparoStats = async () => {
    try {
      const data = await fetchAPI('/stats/user');
      setTotalMessagesSent(data.totalMessagesSent || 0);
      setStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  // Recarregar stats e instâncias ao entrar na dashboard
  useEffect(() => {
    // Scroll para o topo ao mudar de aba
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (activeTab === 'dashboard' || activeTab === 'conquistas') {
      loadDisparoStats();
      reloadInstances();
    }
    if (activeTab === 'logs') {
      setLogsLoaded(false);
    }
  }, [activeTab]);

  // Carregar logs de atividade
  const loadLogs = async (page = 1) => {
    setLogsLoading(true);
    try {
      const data = await fetchAPI(`/stats/logs?page=${page}&limit=50`);
      setLogs(data?.logs || []);
      setLogsTotal(data?.pagination?.total || 0);
      setLogsPage(page);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLogsLoading(false);
      setLogsLoaded(true);
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
      // Validar limite de plano primeiro
      const validateAndLoad = async () => {
        try {
          const validation = await fetchAPI('/instances/cleanup/validate-plan-limit', {
            method: 'POST'
          });
          if (validation.cleaned > 0) {
            console.log(`🧹 ${validation.cleaned} instâncias excedentes limpas`);
          }
        } catch (error) {
          console.warn('⚠️ Erro na validação (não crítico):', error);
        }
        // Então carregar instâncias
        await reloadInstances();
        reloadContactLists();
        loadDisparoStats();
      };
      
      validateAndLoad();
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
    { id: 'instancias', label: 'Instâncias WhatsApp', icon: <Smartphone size={18} /> },
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
                {(() => {
                  const connected = instances.filter(i => i.status === 'connected');
                  const isConn = connected.length > 0;
                  return (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${isConn ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${isConn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {isConn ? `Conectado (${connected.length})` : 'Desconectado'}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </header>

            {/* Success Message */}
            {showInstanceSuccessMessage && (
              <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl flex items-start gap-4">
                <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-black text-emerald-400 mb-1">Instância criada com sucesso! 🎉</h3>
                  <p className="text-xs text-slate-300 mb-3">Acesse a seção de <span className="font-black">Instâncias</span> para conectar seu WhatsApp e começar a usar todas as funcionalidades.</p>
                  <button
                    onClick={() => {
                      setActiveTab('instancias');
                      setShowInstanceSuccessMessage(false);
                    }}
                    className="text-xs font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                  >
                    Ir para Instâncias <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {showConnectModal && (
              <div className="dashboard-card">
                <div className="flex items-center justify-between mb-6">
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
                    {/* Instância Principal Selecionada */}
                    {instances[selectedInstanceIndex] && (
                      <>
                        <div>
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
                            Instância Ativa ({selectedInstanceIndex + 1}/{instances.length})
                          </label>
                          <div className="flex items-center gap-3">
                            <select
                              value={instances[selectedInstanceIndex]?.id || ''}
                              onChange={(e) => {
                                const idx = instances.findIndex(i => i.id === e.target.value);
                                if (idx !== -1) setSelectedInstanceIndex(idx);
                              }}
                              className="flex-1 bg-[#1c2433] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all"
                            >
                              {instances.map((instance) => (
                                <option key={instance.id} value={instance.id}>
                                  {instance.name} - {instance.status === 'connected' ? '✅' : '⏳'}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const instanceId = instances[selectedInstanceIndex]?.id;
                                const instanceName = instances[selectedInstanceIndex]?.name;
                                if (!instanceId) return;
                                if (confirm(`Tem certeza que deseja remover "${instanceName}"?`)) {
                                  deleteInstance(instanceId);
                                  const newIdx = Math.max(0, selectedInstanceIndex - 1);
                                  setSelectedInstanceIndex(newIdx);
                                }
                              }}
                              disabled={deletingInstanceId === instances[selectedInstanceIndex]?.id}
                              className="bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-rose-500 border border-rose-500/30 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2"
                            >
                              {deletingInstanceId === instances[selectedInstanceIndex]?.id ? (
                                <>
                                  <span className="animate-spin">⏳</span>
                                  Removendo...
                                </>
                              ) : (
                                <>
                                  🗑️ Remover
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Card de Conexão */}
                        <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
                          <ConnectWhatsApp instanceId={instances[selectedInstanceIndex]?.id} onConnected={() => reloadInstances()} />
                        </div>
                      </>
                    )}

                    {/* Seção para Adicionar Nova Instância */}
                    {instances.length < 10 && (
                      showCreateInstanceModal ? (
                        <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-white uppercase">Nova Instância ({instances.length}/10)</h3>
                            <button
                              onClick={() => setShowCreateInstanceModal(false)}
                              className="text-slate-500 hover:text-white transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <CreateInstance onSuccess={() => {
                            reloadInstances();
                            setShowCreateInstanceModal(false);
                            setShowInstanceSuccessMessage(true);
                            setTimeout(() => setShowInstanceSuccessMessage(false), 5000);
                          }} />
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowCreateInstanceModal(true)}
                          className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 border border-emerald-500/30 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={16} />
                          Adicionar Nova Instância ({instances.length}/3)
                        </button>
                      )
                    )}

                    {instances.length > 1 && (
                      <div className="space-y-3 pt-4 border-t border-white/10">
                        <p className="text-xs text-slate-500 uppercase font-black tracking-widest">
                          Outras Instâncias ({instances.length - 1})
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {instances.map((instance, idx) => {
                            if (idx === selectedInstanceIndex) return null;
                            return (
                              <div 
                                key={instance.id}
                                onClick={() => setSelectedInstanceIndex(idx)}
                                className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10 hover:border-brand-500/30 cursor-pointer transition-all hover:bg-white/10"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{instance.name}</p>
                                  <p className="text-xs text-slate-500 truncate">{instance.phoneNumber || 'Não conectado'}</p>
                                </div>
                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                  <span className={`text-xs font-black px-2 py-1 rounded whitespace-nowrap ${
                                    instance.status === 'connected' 
                                      ? 'bg-emerald-500/20 text-emerald-500' 
                                      : 'bg-slate-500/20 text-slate-500'
                                  }`}>
                                    {instance.status === 'connected' ? '✅' : '⏳'}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Tem certeza que deseja remover "${instance.name}"?`)) {
                                        deleteInstance(instance.id);
                                        if (idx < selectedInstanceIndex) {
                                          setSelectedInstanceIndex(selectedInstanceIndex - 1);
                                        }
                                      }
                                    }}
                                    disabled={deletingInstanceId === instance.id}
                                    className="bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-rose-500 border border-rose-500/30 p-2 rounded transition-all flex-shrink-0 flex items-center justify-center"
                                    title="Remover instância"
                                  >
                                    {deletingInstanceId === instance.id ? (
                                      <span className="animate-spin">⏳</span>
                                    ) : (
                                      <X size={16} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="dashboard-card flex flex-col justify-between relative overflow-hidden group hover:scale-105 transition-transform text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20"><Zap size={18} /></div>
                </div>
                <span className="text-[8px] font-black text-slate-500 uppercase border border-white/5 px-2 py-1 rounded tracking-tighter mx-auto mb-4">VOLUME TOTAL</span>
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-2">MENSAGENS ENVIADAS</div>
                  <div className="text-3xl md:text-4xl font-black text-emerald-400 italic tracking-tighter">{(stats.totalMessagesSent || 0).toLocaleString('pt-BR')}</div>
                  <div className="text-[9px] text-slate-600 mt-2">{stats.totalCampaigns || 0} campanha(s) realizadas</div>
                </div>
              </div>
              <div className="dashboard-card flex flex-col justify-between relative overflow-hidden group hover:scale-105 transition-transform text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-500/20"><BarChart3 size={18} /></div>
                </div>
                <span className="text-[8px] font-black text-slate-500 uppercase border border-white/5 px-2 py-1 rounded tracking-tighter mx-auto mb-4">ESTABILIDADE</span>
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-2">TAXA DE ENTREGA</div>
                  <div className="text-3xl md:text-4xl font-black text-brand-400 italic tracking-tighter">{stats.successRate || '0%'}</div>
                  <div className="text-[9px] text-slate-600 mt-2">{stats.runningCampaigns || 0} ativa(s) agora</div>
                </div>
              </div>
              <div className="dashboard-card flex flex-col justify-between relative overflow-hidden group hover:scale-105 transition-transform text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20"><AlertCircle size={18} /></div>
                </div>
                <span className="text-[8px] font-black text-slate-500 uppercase border border-white/5 px-2 py-1 rounded tracking-tighter mx-auto mb-4">ERROS TÉCNICOS</span>
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase mb-2">FALHAS DETECTADAS</div>
                  <div className="text-3xl md:text-4xl font-black text-rose-400 italic tracking-tighter">{(stats.totalMessagesFailed || 0).toLocaleString('pt-BR')}</div>
                  <div className="text-[9px] text-slate-600 mt-2">erros de envio</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Fluxo de Disparos */}
              <div className="lg:col-span-2 dashboard-card flex flex-col min-h-[300px]">
                <h3 className="text-xl font-black text-white italic uppercase mb-6">Fluxo de Disparos</h3>
                {stats.recentLogs && stats.recentLogs.length > 0 ? (
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-64">
                    {stats.recentLogs.slice(0, 8).map((log: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/3 border border-white/5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            log.status === 'completed' ? 'bg-emerald-400' :
                            log.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                            log.status === 'cancelled' ? 'bg-rose-400' : 'bg-slate-500'
                          }`} />
                          <span className="text-xs text-white font-black truncate">{log.name}</span>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                          <span className="text-[10px] text-emerald-400 font-black">{log.sent || 0} enviadas</span>
                          {(log.failed || 0) > 0 && <span className="text-[10px] text-rose-400 font-black">{log.failed} falhas</span>}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            log.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                            log.status === 'running' ? 'bg-yellow-500/10 text-yellow-400' :
                            log.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-500/10 text-slate-400'
                          }`}>
                            {log.status === 'completed' ? 'Concluída' : log.status === 'running' ? 'Ativa' : log.status === 'cancelled' ? 'Cancelada' : log.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-20">
                    <BarChart3 size={64} className="text-slate-600" strokeWidth={1} />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Nenhum disparo ainda</span>
                  </div>
                )}
              </div>

              {/* Atividade Recente */}
              <div className="dashboard-card min-h-[300px] flex flex-col">
                <h3 className="text-xl font-black text-white italic uppercase mb-6">Atividade Recente</h3>
                {stats.recentLogs && stats.recentLogs.length > 0 ? (
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-64">
                    {stats.recentLogs.slice(0, 5).map((log: any, i: number) => (
                      <div key={i} className="flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-white truncate">{log.name}</span>
                          <span className={`text-[9px] font-black ml-2 flex-shrink-0 ${
                            log.status === 'completed' ? 'text-emerald-400' :
                            log.status === 'running' ? 'text-yellow-400' : 'text-rose-400'
                          }`}>
                            {log.status === 'completed' ? '✅ ativa' : log.status === 'running' ? '⏳ enviando' : '⛔ encerrada'}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {log.sent || 0} enviadas · {log.failed || 0} falhas
                          {log.createdAt && <span className="ml-1">· {new Date(log.createdAt).toLocaleDateString('pt-BR')}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-20">
                    <Clock size={48} className="text-slate-600" strokeWidth={1} />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Sem logs</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'instancias':
        return <InstanceManager />;

      case 'disparo':
        return <div />; {/* EliteDispatcher renderizado fora do switch para manter estado */}

      case 'contatos':
        return <GroupToXlsxExporter />;

      case 'logs':
        if (!logsLoaded && !logsLoading) { setTimeout(() => loadLogs(1), 50); }
        return (
          <div className="animate-fade-in space-y-8">
            <header className="dashboard-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Sistema</span>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Logs de Atividade</h1>
                <p className="text-slate-500 text-sm mt-1">{logsTotal} disparo(s) registrado(s)</p>
              </div>
              <button onClick={() => loadLogs(logsPage)} className="bg-white/5 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all border border-white/5 hover:bg-white/10">
                <RefreshCw size={14} />
                Atualizar
              </button>
            </header>

            {logsLoading ? (
              <div className="dashboard-card py-20 flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-500 uppercase tracking-widest">Carregando logs...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="dashboard-card py-20 flex flex-col items-center justify-center gap-6 border-white/5 opacity-20">
                <Activity size={64} className="text-slate-600" strokeWidth={1} />
                <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600 italic">Nenhum disparo realizado</span>
              </div>
            ) : (
              <div className="dashboard-card space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 bg-white/3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'completed' ? 'bg-emerald-500' : log.status === 'running' ? 'bg-yellow-500 animate-pulse' : log.status === 'failed' ? 'bg-rose-500' : 'bg-slate-500'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate">{log.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{log.instanceName} · {log.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <div className="text-center min-w-[48px]">
                        <div className="text-sm font-black text-emerald-400">{log.sent || 0}</div>
                        <div className="text-[9px] text-slate-600 uppercase">Enviados</div>
                      </div>
                      <div className="text-center min-w-[48px]">
                        <div className="text-sm font-black text-rose-400">{log.failed || 0}</div>
                        <div className="text-[9px] text-slate-600 uppercase">Falhas</div>
                      </div>
                      <div className="text-center min-w-[48px]">
                        <div className="text-sm font-black text-brand-400">{log.successRate || '0%'}</div>
                        <div className="text-[9px] text-slate-600 uppercase">Taxa</div>
                      </div>
                      <div className="text-[9px] text-slate-600 text-right hidden md:block min-w-[80px]">
                        <div className="font-black text-slate-400">{log.status === 'completed' ? '✅ Concluído' : log.status === 'running' ? '⏳ Enviando' : log.status === 'cancelled' ? '⛔ Cancelado' : '❌ Falhou'}</div>
                        <div>{log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : ''}</div>
                        {log.duration && <div className="text-slate-700">{log.duration}</div>}
                      </div>
                    </div>
                  </div>
                ))}
                {logsTotal > 50 && (
                  <div className="flex justify-center gap-3 pt-4">
                    <button onClick={() => loadLogs(logsPage - 1)} disabled={logsPage <= 1} className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-white/5 border border-white/10 disabled:opacity-30">Anterior</button>
                    <span className="px-4 py-2 text-xs text-slate-500">{logsPage}</span>
                    <button onClick={() => loadLogs(logsPage + 1)} disabled={logsPage * 50 >= logsTotal} className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-white/5 border border-white/10 disabled:opacity-30">Próximo</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'grupos':
        return <GroupManager />;

      case 'aquecimento':
        return <div />; {/* WarmupCloud renderizado fora do switch para manter estado */}

      case 'conquistas':
        return <GoalsTracker />;

      case 'plano':
        return (
          <div className="animate-fade-in space-y-10">
            <header className="dashboard-card">
              <span className="bg-brand-500/10 text-brand-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">Assinatura</span>
              <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Meu Plano</h1>
              <p className="text-slate-500 text-sm mt-1">Gerencie sua assinatura e veja seu histórico.</p>
            </header>

            <div className="dashboard-card">
              {(() => {
                const userData = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
                const plan = userData.plan || null;
                const expiresAt = userData.planExpiresAt ? new Date(userData.planExpiresAt) : null;
                const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
                const planNames: Record<string, string> = { mensal: 'Plano Mensal', trimestral: 'Plano Trimestral', anual: 'Plano Anual', pro: 'Plano Pro', basic: 'Plano Básico', enterprise: 'Enterprise' };
                const planLabel = plan ? (planNames[plan] || plan) : null;
                const isActive = daysLeft === null ? false : daysLeft > 0;
                return (
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Plano Atual</div>
                      <div className="text-3xl font-black text-white italic uppercase tracking-tighter">{planLabel || '--'}</div>
                      <div className="text-brand-500 text-sm font-bold mt-1">
                        {daysLeft !== null ? `${daysLeft} dia(s) restante(s)` : '--'}
                      </div>
                    </div>
                    <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {isActive ? 'Ativo' : 'Sem plano'}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Mensagens Enviadas</div>
                  <div className="text-2xl font-black text-emerald-400 italic">{stats.totalMessagesSent?.toLocaleString() || '0'}</div>
                  <div className="text-[9px] text-slate-600 mt-1">{stats.runningCampaigns || 0} campanha(s) ativa(s)</div>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Taxa de Entrega</div>
                  <div className="text-2xl font-black text-brand-400 italic">{stats.successRate || '0%'}</div>
                  <div className="text-[9px] text-slate-600 mt-1">{stats.totalCampaigns || 0} campanha(s)</div>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Falhas Detectadas</div>
                  <div className="text-2xl font-black text-rose-400 italic">{stats.totalMessagesFailed?.toLocaleString() || '0'}</div>
                  <div className="text-[9px] text-slate-600 mt-1">erros técnicos</div>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Sessões WhatsApp</div>
                  <div className="text-2xl font-black text-white italic">{stats.connectedInstances || 0}/{stats.totalInstances || 0}</div>
                  <div className="text-[9px] text-slate-600 mt-1">conectada(s)</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Mensal', price: 'R$ 69,90', period: '/mês', link: 'https://go.ironpayapp.com.br/qjuo4vl1oj' },
                { name: 'Trimestral', price: 'R$ 149,90', period: '/trim', link: 'https://go.ironpayapp.com.br/apudn' },
                { name: 'Anual', price: 'R$ 599,90', period: '/ano', link: 'https://go.ironpayapp.com.br/zt3zz' },
              ].map((p, i) => (
                <div key={i} className="dashboard-card text-center">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{p.name}</div>
                  <div className="text-3xl font-black text-white italic tracking-tighter mb-1">{p.price}</div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-6">{p.period}</div>
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="block w-full py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-brand-500/20 active:scale-95 text-center">
                    Assinar
                  </a>
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
          {/* EliteDispatcher permanece montado para não perder estado de campanha em andamento */}
          <div style={{ display: activeTab === 'disparo' ? 'block' : 'none' }}>
            <EliteDispatcher />
          </div>
          <div style={{ display: activeTab === 'aquecimento' ? 'block' : 'none' }}>
            <WarmupCloud />
          </div>
          {activeTab !== 'disparo' && activeTab !== 'aquecimento' && renderContent()}
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;