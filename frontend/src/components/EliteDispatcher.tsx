import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAPI } from '@/config/api';
import {
  Send, Loader2, AlertCircle, CheckCircle2, Users, Upload,
  RefreshCw, X, ChevronDown, ChevronUp, Zap, Shield,
  BarChart3, Clock, TrendingUp, MessageSquare, AlertTriangle, StopCircle
} from 'lucide-react';

interface Group { id: string; name: string; participantsCount?: number; }
interface Instance { id: string | number; name: string; phoneNumber?: string; status: string; }

interface DispatchConfig {
  instanceId: string;
  groupId: string;
  sourceType: 'group' | 'xlsx';
  xlsxNumbers: string[];
  messages: string[]; // variações de mensagem
  delayMin: number;
  delayMax: number;
  excludeAdmins: boolean;
  skipAlreadySent: boolean;
  randomizeOrder: boolean;
}

interface CampaignMetrics {
  status: 'idle' | 'loading_participants' | 'running' | 'paused' | 'done' | 'cancelled';
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  current: string;
  startedAt: number;
  estimatedEnd: number | null;
  numbers: string[];
  currentIndex: number;
}

const DEFAULT_CONFIG: DispatchConfig = {
  instanceId: '',
  groupId: '',
  sourceType: 'group',
  xlsxNumbers: [],
  messages: [''],
  delayMin: 30000,
  delayMax: 60000,
  excludeAdmins: false,
  skipAlreadySent: false,
  randomizeOrder: false,
};

const EliteDispatcher: React.FC = () => {
  const [config, setConfig] = useState<DispatchConfig>(DEFAULT_CONFIG);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsSyncing, setGroupsSyncing] = useState(false);
  const [xlsxFileName, setXlsxFileName] = useState('');
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [campaign, setCampaign] = useState<CampaignMetrics | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef(false);
  const cancelResolveRef = useRef<(() => void) | null>(null);
  const campaignIdRef = useRef<number | null>(null);
  const sentNumbersRef = useRef<Set<string>>(new Set());

  // Escuta progresso da campanha via socket (backend envia eventos)
  useEffect(() => {
    if (!campaignIdRef.current) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    import('@/utils/socketClient').then(({ initSocket, getSocket }) => {
      initSocket(token);
      const socket = getSocket();
      if (!socket) return;

      socket.on('campanha:progresso', (data: any) => {
        if (data.campaignId !== campaignIdRef.current) return;
        setCampaign(c => c ? {
          ...c,
          sent: data.sent || 0,
          failed: data.failed || 0,
          current: data.currentContact || '',
          currentIndex: (data.sent || 0) + (data.failed || 0),
          estimatedEnd: data.remainingSeconds ? Date.now() + data.remainingSeconds * 1000 : null,
        } : null);
      });

      socket.on('campanha:concluida', (data: any) => {
        if (data.campaignId !== campaignIdRef.current) return;
        setCampaign(c => c ? { ...c, status: 'done', current: '', estimatedEnd: null, sent: data.totalSent || c.sent, failed: data.totalFailed || c.failed } : null);
        campaignIdRef.current = null;
      });

      socket.on('campanha:erro', (data: any) => {
        if (data.campaignId !== campaignIdRef.current) return;
        setCampaign(c => c ? { ...c, status: 'cancelled', current: '' } : null);
        campaignIdRef.current = null;
      });
    }).catch(() => {});
  }, [campaign?.status]);

  // Carrega instâncias conectadas
  useEffect(() => {
    // Carregar instâncias
    fetchAPI('/instances').then(data => {
      const list = data?.data || data || [];
      // Mostrar todas as instâncias — não filtrar por status aqui
      // O backend já filtra isActive:true e exclui deleted_
      setInstances(list);
      const conn = list.filter((i: Instance) => i.status === 'connected');
      if (conn.length === 1) setConfig(c => ({ ...c, instanceId: String(conn[0].id) }));
      else if (list.length === 1) setConfig(c => ({ ...c, instanceId: String(list[0].id) }));
    }).catch(() => {});

    // Recuperar campanha ativa caso tenha feito logout/login com campanha em andamento
    fetchAPI('/campaigns/active').then(active => {
      if (!active) return;
      campaignIdRef.current = active.id;
      setCampaign({
        status: active.status,
        total: active.total,
        sent: active.sent,
        failed: active.failed,
        skipped: active.skipped ?? 0,
        current: active.current ?? '',
        startedAt: active.startedAt,
        estimatedEnd: active.estimatedEnd ?? null,
        numbers: active.numbers ?? [],
        currentIndex: active.currentIndex ?? active.sent,
      });
      if (active.instanceId) setConfig(c => ({ ...c, instanceId: active.instanceId }));
      // Iniciar poll de progresso
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (!campaignIdRef.current) return;
        try {
          const m = await fetchAPI(`/campaigns/${campaignIdRef.current}/metricas`);
          setCampaign(prev => prev ? { ...prev, status: m.status, sent: m.metrics.sent, failed: m.metrics.failed, total: m.metrics.total } : prev);
          if (m.status === 'done' || m.status === 'cancelled') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
          }
        } catch { /* silent */ }
      }, 3000);
    }).catch(() => {});
  }, []);

  // Carrega grupos ao mudar instância
  useEffect(() => {
    if (!config.instanceId) { setGroups([]); return; }
    loadGroups(config.instanceId, false);
  }, [config.instanceId]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const loadGroups = async (instId: string, forceSync: boolean) => {
    setGroupsLoading(true);
    setGroupsSyncing(forceSync);
    setError('');
    try {
      const endpoint = forceSync ? `/groups/sync/${instId}` : `/groups?instanceId=${instId}`;
      const data = await fetchAPI(endpoint);
      if (data?.groups?.length > 0) {
        setGroups(data.groups);
        setGroupsLoading(false);
        setGroupsSyncing(false);
        return;
      }
      if (data?.loading || forceSync) {
        setGroupsSyncing(true);
        setGroups([]);
        startGroupPolling(instId);
      } else {
        setGroups([]);
        setGroupsLoading(false);
      }
    } catch { setError('Erro ao carregar grupos'); setGroupsLoading(false); }
  };

  const startGroupPolling = (instId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetchAPI(`/groups?instanceId=${instId}`);
        if (data?.groups?.length > 0) {
          setGroups(data.groups);
          setGroupsLoading(false);
          setGroupsSyncing(false);
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch { /* ignora */ }
    }, 5000);
  };

  const handleXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXlsxFileName(file.name);
    const text = await file.text();
    const numbers = text.split(/[\n\r,;]+/)
      .map(l => l.replace(/\D/g, ''))
      .filter(n => n.length >= 10 && n.length <= 15);
    setConfig(c => ({ ...c, xlsxNumbers: [...new Set(numbers)] }));
  };

  const updateMessage = (index: number, value: string) => {
    const msgs = [...config.messages];
    msgs[index] = value;
    setConfig(c => ({ ...c, messages: msgs }));
  };

  const addVariation = () => setConfig(c => ({ ...c, messages: [...c.messages, ''] }));
  const removeVariation = (i: number) => setConfig(c => ({ ...c, messages: c.messages.filter((_, idx) => idx !== i) }));

  const handleStart = async () => {
    if (!config.messages.some(m => m.trim())) return setError('Digite pelo menos uma mensagem');
    if (!config.instanceId) return setError('Selecione uma instância');
    if (config.sourceType === 'group' && !config.groupId) return setError('Selecione um grupo');
    if (config.sourceType === 'xlsx' && config.xlsxNumbers.length === 0) return setError('Carregue um arquivo com números');
    setError('');
    abortRef.current = false;

    setCampaign({ status: 'loading_participants', total: 0, sent: 0, failed: 0, skipped: 0, current: '', startedAt: Date.now(), estimatedEnd: null, numbers: [], currentIndex: 0 });

    try {
      // Disparo 100% no backend/VPS — continua mesmo com navegador fechado
      const res = await fetchAPI('/disparador/iniciar', {
        method: 'POST',
        body: {
          instanceId: config.instanceId,
          groupIds: config.sourceType === 'group' ? [config.groupId] : [],
          xlsxNumbers: config.sourceType === 'xlsx' ? config.xlsxNumbers : [],
          message: config.messages.filter(m => m.trim())[0],
          interval: config.delayMin,
          randomizeInterval: config.delayMax > config.delayMin,
          randomizeMessage: config.messages.filter(m => m.trim()).length > 1,
          excludeAdmins: config.excludeAdmins,
        },
      });

      if (res.campaignId) {
        campaignIdRef.current = res.campaignId;
        setCampaign(c => ({ ...c!, status: 'running', total: res.totalContacts || 0, startedAt: Date.now() }));
      } else {
        setError(res.error || 'Erro ao iniciar campanha');
        setCampaign(null);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar');
      setCampaign(null);
    }
  };

  const handlePause = () => {
    abortRef.current = true;
    setCampaign(c => c ? { ...c, status: 'cancelled' } : null);
    if (campaignIdRef.current) {
      fetchAPI(`/disparador/parar/${campaignIdRef.current}`, { method: 'POST' }).catch(() => {});
      campaignIdRef.current = null;
    }
  };

  const handleReset = () => { setCampaign(null); abortRef.current = false; };

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()));
  const selectedGroup = groups.find(g => g.id === config.groupId);
  const isCampaignActive = campaign && (campaign.status === 'running' || campaign.status === 'loading_participants');
  const pct = campaign && (campaign.total || 0) > 0 ? Math.round((((campaign.sent||0) + (campaign.failed||0) + (campaign.skipped||0)) / campaign.total) * 100) : 0;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const elapsed = campaign?.startedAt ? Date.now() - campaign.startedAt : 0;
  const eta = campaign?.estimatedEnd ? campaign.estimatedEnd - Date.now() : null;

  // ─── TELA DE CAMPANHA ATIVA ───────────────────────────────────
  if (campaign && campaign.status !== 'idle') {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Status Header */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">
                {campaign.status === 'loading_participants' ? '⏳ Carregando...' :
                 campaign.status === 'running' ? '🚀 Disparo em Andamento' :
                 campaign.status === 'done' ? '✅ Disparo Concluído' :
                 '🛑 Disparo Cancelado'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {campaign.status === 'running' ? `Enviando para ${campaign.current || '...'}` :
                 campaign.status === 'done' ? 'Todos os contatos foram processados' :
                 campaign.status === 'cancelled' ? 'O disparo foi interrompido manualmente' : ''}
              </p>
            </div>
            {(campaign.status === 'done' || campaign.status === 'cancelled') && (
              <button onClick={handleReset} className="px-4 py-2 border border-white/10 text-slate-400 font-black text-xs uppercase rounded-xl hover:border-white/20 hover:text-white transition-all">
                Novo Disparo
              </button>
            )}
          </div>

          {/* Barra de progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{pct}% concluído</span>
              <span>{(campaign.sent||0) + (campaign.failed||0) + (campaign.skipped||0)}/{campaign.total||0}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${campaign.status === 'done' ? 'bg-emerald-500' : campaign.status === 'cancelled' ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="dashboard-card text-center">
            <div className="text-3xl font-black text-emerald-400">{campaign.sent}</div>
            <div className="text-xs font-black text-slate-500 uppercase mt-1">Enviados</div>
          </div>
          <div className="dashboard-card text-center">
            <div className="text-3xl font-black text-red-400">{campaign.failed}</div>
            <div className="text-xs font-black text-slate-500 uppercase mt-1">Falhas</div>
          </div>
          <div className="dashboard-card text-center">
            <div className="text-3xl font-black text-slate-400">{campaign.skipped}</div>
            <div className="text-xs font-black text-slate-500 uppercase mt-1">Pulados</div>
          </div>
          <div className="dashboard-card text-center">
            <div className="text-3xl font-black text-brand-400">{Math.max(0, (campaign.total || 0) - (campaign.sent || 0) - (campaign.failed || 0) - (campaign.skipped || 0))}</div>
            <div className="text-xs font-black text-slate-500 uppercase mt-1">Restantes</div>
          </div>
        </div>

        {/* Tempo */}
        <div className="dashboard-card grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-slate-500" />
            <div>
              <div className="text-xs text-slate-500 uppercase font-black">Tempo decorrido</div>
              <div className="text-white font-black">{formatTime(elapsed)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TrendingUp size={18} className="text-slate-500" />
            <div>
              <div className="text-xs text-slate-500 uppercase font-black">Tempo restante</div>
              <div className="text-white font-black">{eta && eta > 0 ? formatTime(eta) : campaign.status === 'done' ? '—' : 'Calculando...'}</div>
            </div>
          </div>
        </div>

        {/* Taxa de sucesso */}
        {campaign.total > 0 && (campaign.sent + campaign.failed) > 0 && (
          <div className="dashboard-card">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-slate-400 uppercase">Taxa de Sucesso</span>
              <span className="text-emerald-400 font-black text-sm">
                {Math.round((campaign.sent / (campaign.sent + campaign.failed)) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.round((campaign.sent / (campaign.sent + campaign.failed)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Botão cancelar */}
        {isCampaignActive && (
          <button
            onClick={handlePause}
            className="w-full py-4 bg-red-500/20 border border-red-500/40 text-red-400 font-black text-sm uppercase rounded-xl hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
          >
            <StopCircle size={18} /> Parar Disparo
          </button>
        )}
      </div>
    );
  }

  // ─── TELA DE CONFIGURAÇÃO ─────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="dashboard-card">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Elite Disparador</h2>
        <p className="text-slate-500 text-sm mt-1">Configure e dispare mensagens em massa</p>
      </div>

      {/* Instância */}
      <div className="dashboard-card space-y-3">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Instância WhatsApp</label>
        <select
          value={config.instanceId}
          onChange={e => setConfig(c => ({ ...c, instanceId: e.target.value, groupId: '' }))}
          className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white text-sm focus:border-brand-500/50 focus:outline-none"
        >
          <option value="">Selecione...</option>
          {instances.map(i => (
            <option key={i.id} value={String(i.id)}>
              {i.name} {i.phoneNumber ? `(${i.phoneNumber})` : ''}
            </option>
          ))}
        </select>
        {instances.length === 0 && <p className="text-xs text-yellow-500">Nenhuma instância criada. Vá em WhatsApp → Nova Instância.</p>}
      </div>

      {/* Fonte */}
      <div className="dashboard-card space-y-4">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Fonte dos Contatos</label>
        <div className="flex gap-3">
          {(['group', 'xlsx'] as const).map(type => (
            <button key={type} onClick={() => setConfig(c => ({ ...c, sourceType: type }))}
              className={`flex-1 py-3 rounded-xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${config.sourceType === type ? 'bg-brand-500 text-white' : 'border border-white/10 text-slate-400 hover:border-white/20'}`}>
              {type === 'group' ? <><Users size={15} /> Grupos</> : <><Upload size={15} /> Arquivo</>}
            </button>
          ))}
        </div>

        {/* Grupos */}
        {config.sourceType === 'group' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input type="text" placeholder="Buscar grupo..." value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500/50" />
              <button onClick={() => config.instanceId && loadGroups(config.instanceId, true)}
                disabled={!config.instanceId || groupsSyncing}
                className="px-3 py-2 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-40" title="Sincronizar">
                <RefreshCw size={16} className={groupsSyncing ? 'animate-spin' : ''} />
              </button>
            </div>

            {groupsSyncing && (
              <div className="flex items-center gap-2 text-slate-400 text-xs p-3 bg-slate-900/30 rounded-xl border border-white/5">
                <Loader2 size={14} className="animate-spin text-brand-500" />
                <span>Sincronizando grupos... pode demorar alguns minutos.</span>
              </div>
            )}

            {!groupsSyncing && filteredGroups.length > 0 && (
              <div className="max-h-52 overflow-y-auto space-y-1">
                {filteredGroups.map(g => (
                  <button key={g.id} onClick={() => setConfig(c => ({ ...c, groupId: g.id }))}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between ${config.groupId === g.id ? 'bg-brand-500/20 border border-brand-500/40 text-brand-300' : 'hover:bg-white/5 text-slate-300 border border-transparent'}`}>
                    <span className="truncate font-medium">{g.name}</span>
                    {g.participantsCount ? <span className="text-xs text-slate-500 ml-2 shrink-0">{g.participantsCount}</span> : null}
                  </button>
                ))}
              </div>
            )}

            {!groupsSyncing && groups.length === 0 && config.instanceId && (
              <div className="text-center py-6">
                <p className="text-slate-500 text-sm mb-3">Nenhum grupo carregado</p>
                <button onClick={() => loadGroups(config.instanceId, true)}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-black text-xs uppercase rounded-xl transition-all">
                  Sincronizar Grupos
                </button>
              </div>
            )}

            {selectedGroup && (
              <div className="flex items-center gap-2 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                <CheckCircle2 size={16} className="text-brand-400" />
                <span className="text-brand-300 text-sm font-semibold truncate">{selectedGroup.name}</span>
                {selectedGroup.participantsCount && <span className="text-slate-500 text-xs ml-auto">{selectedGroup.participantsCount} membros</span>}
              </div>
            )}
          </div>
        )}

        {/* Arquivo */}
        {config.sourceType === 'xlsx' && (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all">
              <Upload size={20} className="text-slate-500 mb-1" />
              <span className="text-slate-500 text-sm">{xlsxFileName || 'CSV ou TXT com números (um por linha)'}</span>
              <input type="file" accept=".csv,.txt" onChange={handleXlsx} className="hidden" />
            </label>
            {config.xlsxNumbers.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="text-emerald-300 text-sm">{config.xlsxNumbers.length} números carregados</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mensagens / Variações */}
      <div className="dashboard-card space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Mensagens {config.messages.length > 1 && <span className="text-brand-400">({config.messages.length} variações)</span>}
          </label>
          <button onClick={addVariation}
            className="text-xs text-brand-400 hover:text-brand-300 font-black uppercase transition-colors">
            + Variação
          </button>
        </div>

        {config.messages.map((msg, i) => (
          <div key={i} className="relative">
            <textarea value={msg} onChange={e => updateMessage(i, e.target.value)}
              placeholder={`Mensagem ${i + 1}${i === 0 ? ' (principal)' : ` (variação ${i})`}...`}
              rows={4}
              className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-brand-500/50 focus:outline-none text-sm resize-none pr-10" />
            {i > 0 && (
              <button onClick={() => removeVariation(i)}
                className="absolute top-3 right-3 text-slate-600 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        ))}

        {config.messages.length > 1 && (
          <p className="text-xs text-slate-600 flex items-center gap-1">
            <Zap size={12} className="text-brand-500" />
            Uma variação aleatória será enviada para cada contato
          </p>
        )}
      </div>

      {/* Velocidade */}
      <div className="dashboard-card space-y-4">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Velocidade de Envio</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Delay mínimo</label>
            <div className="flex items-center gap-2">
              <input type="range" min={30000} max={120000} step={1000} value={config.delayMin}
                onChange={e => setConfig(c => ({ ...c, delayMin: Math.min(Number(e.target.value), c.delayMax - 500) }))}
                className="flex-1" />
              <span className="text-white text-sm w-14 text-right">{(config.delayMin / 1000).toFixed(1)}s</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Delay máximo</label>
            <div className="flex items-center gap-2">
              <input type="range" min={31000} max={180000} step={1000} value={config.delayMax}
                onChange={e => setConfig(c => ({ ...c, delayMax: Math.max(Number(e.target.value), c.delayMin + 500) }))}
                className="flex-1" />
              <span className="text-white text-sm w-14 text-right">{(config.delayMax / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-xl border border-white/5">
          <span className="text-xs text-slate-400">Intervalo randomico entre {(config.delayMin / 1000).toFixed(1)}s e {(config.delayMax / 1000).toFixed(1)}s</span>
          <span className="text-xs text-brand-400 font-black">Anti-ban ativo</span>
        </div>
      </div>

      {/* Opções avançadas */}
      <div className="dashboard-card">
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-2"><Shield size={14} /> Opções Avançadas</span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-3">
            {[
              { key: 'excludeAdmins', label: 'Excluir administradores do grupo', icon: Shield },
              { key: 'skipAlreadySent', label: 'Não reenviar para contatos já enviados', icon: CheckCircle2 },
              { key: 'randomizeOrder', label: 'Randomizar ordem de envio', icon: Zap },
            ].map(({ key, label, icon: Icon }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => setConfig(c => ({ ...c, [key]: !(c as any)[key] }))}
                  className={`w-10 h-6 rounded-full transition-all relative ${(config as any)[key] ? 'bg-brand-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${(config as any)[key] ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-sm text-slate-400 group-hover:text-white transition-colors flex items-center gap-2">
                  <Icon size={14} className="text-slate-500" /> {label}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-sm flex-1">{error}</p>
          <button onClick={() => setError('')}><X size={16} className="text-slate-500 hover:text-white" /></button>
        </div>
      )}

      {/* Resumo e botão */}
      <div className="dashboard-card space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-black text-white">
              {config.sourceType === 'group' ? (selectedGroup?.participantsCount || '?') : config.xlsxNumbers.length}
            </div>
            <div className="text-xs text-slate-500 uppercase">Contatos</div>
          </div>
          <div>
            <div className="text-lg font-black text-white">{config.messages.filter(m => m.trim()).length}</div>
            <div className="text-xs text-slate-500 uppercase">Variações</div>
          </div>
          <div>
            <div className="text-lg font-black text-white">{((config.delayMin + config.delayMax) / 2000).toFixed(1)}s</div>
            <div className="text-xs text-slate-500 uppercase">Delay Médio</div>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={
            !config.messages.some(m => m.trim()) || !config.instanceId ||
            (config.sourceType === 'group' && !config.groupId) ||
            (config.sourceType === 'xlsx' && config.xlsxNumbers.length === 0)
          }
          className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white font-black text-sm uppercase rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Send size={18} /> Iniciar Disparo
        </button>
      </div>
    </div>
  );
};

export default EliteDispatcher;