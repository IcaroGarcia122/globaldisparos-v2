import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '@/config/api';
import {
  Play, Square, Flame, Zap, Shield, Clock, MessageSquare,
  ChevronDown, AlertTriangle, Activity, Thermometer, Target, Info
} from 'lucide-react';

interface Instance { id: string; name: string; status: string; phoneNumber?: string; connectedAt?: string; }

interface WarmupStatus {
  running: boolean;
  day: number;
  phaseId: number;
  phaseName: string;
  sessionSent: number;
  totalSent: number;
  lastMessage: string;
  nextMsgAt: number;
  startedAt?: number;     // timestamp ms do início do aquecimento
  secsUntilNext: number;
  logs: Array<{ time: string; msg: string; phaseId: number; type: 'sent' | 'error' | 'info' }>;
}

const PHASES = [
  { id: 1, name: 'Ativação',    subtitle: 'Dias 1–3',   icon: '🌱', color: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', msgsRange: '2–4',   delay: '3–7 min',    phaseDays: [1,3]   },
  { id: 2, name: 'Conversação', subtitle: 'Dias 4–7',   icon: '💬', color: '#3b82f6', text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    msgsRange: '4–7',   delay: '2–5 min',    phaseDays: [4,7]   },
  { id: 3, name: 'Engajamento', subtitle: 'Dias 8–14',  icon: '🔥', color: '#f59e0b', text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   msgsRange: '5–10',  delay: '90s–4 min',  phaseDays: [8,14]  },
  { id: 4, name: 'Volume',      subtitle: 'Dias 15–21', icon: '⚡', color: '#8b5cf6', text: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  msgsRange: '8–15',  delay: '1–3 min',    phaseDays: [15,21] },
  { id: 5, name: 'Manutenção',  subtitle: 'Dia 22+',    icon: '💎', color: '#ec4899', text: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    msgsRange: '10–20', delay: '45s–2 min',  phaseDays: [22,999]},
];

function getPhaseUI(id: number) { return PHASES.find(p => p.id === id) ?? PHASES[4]; }
function storageKey(id: string)        { return `warmup_day_${id}`; }
function startedAtKey(id: string)      { return `warmup_started_${id}`; }

// Calcula dia do protocolo a partir do timestamp de início do aquecimento
function calcDayFromStart(startedAtMs: number): number {
  const diffMs   = Date.now() - startedAtMs;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1); // dia 1 = dia do início
}

const WarmupCloud: React.FC = () => {
  const [instances, setInstances]         = useState<Instance[]>([]);
  // Persistir selectedId — ao remontar o componente mantém a instância selecionada
  const [selectedId, setSelectedId] = useState<string>(() => {
    return localStorage.getItem('warmup_selected_instance') || '';
  });
  const [loading, setLoading]             = useState(true);
  const [status, setStatus]               = useState<WarmupStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]                 = useState('');
  const [showInfo, setShowInfo]           = useState(false);
  const [countdown, setCountdown]         = useState(0);
  const pollRef   = useRef<NodeJS.Timeout | null>(null);
  const countRef  = useRef<NodeJS.Timeout | null>(null);

  // Carregar instâncias
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await fetchAPI('/instances');
        const raw = res?.data || res?.instances || res || [];
        const list = (Array.isArray(raw) ? raw : []) as Instance[];
        setInstances(list);
        const saved = localStorage.getItem('warmup_selected_instance');
        const savedInst = saved && list.find((i: Instance) => i.id === saved);
        if (savedInst) {
          setSelectedId(saved!);
        } else if (list.length === 1) {
          setSelectedId(list[0].id);
          localStorage.setItem('warmup_selected_instance', list[0].id);
        }
      } catch { /* silent */ } finally { setLoading(false); }
    })();
  }, []);

  // Scroll log
  // Scroll interno do log — não afeta posição da página
  const logContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [status?.logs?.length]);

  // Countdown visual baseado em nextMsgAt
  useEffect(() => {
    if (countRef.current) clearInterval(countRef.current);
    if (status?.running && status.nextMsgAt > Date.now()) {
      const tick = () => setCountdown(Math.max(0, Math.round((status.nextMsgAt - Date.now()) / 1000)));
      tick();
      countRef.current = setInterval(tick, 1000);
    } else {
      setCountdown(0);
    }
    return () => { if (countRef.current) clearInterval(countRef.current); };
  }, [status?.running, status?.nextMsgAt]);

  // Polling — 3s quando rodando, 10s quando parado
  const pollStatus = async (id: string) => {
    if (!id) return;
    try {
      const data: WarmupStatus = await fetchAPI(`/warmup/status?instanceId=${id}`);
      setStatus(data);
      localStorage.setItem(storageKey(id), String(data.day ?? 1));
      // Sincronizar startedAt do banco → localStorage (fonte de verdade é o banco)
      if (data.startedAt) {
        localStorage.setItem(startedAtKey(id), String(data.startedAt));
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedId) { setStatus(null); return; }
    pollStatus(selectedId);
    const interval = status?.running ? 3000 : 10000;
    pollRef.current = setInterval(() => pollStatus(selectedId), interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId, status?.running]);

  const handleStart = async () => {
    if (!selectedId) { setError('Selecione uma instância.'); return; }
    setActionLoading(true); setError('');
    try {
      // Usar startedAt do banco (via status) ou do localStorage como fallback
      let startedAtMs = status?.startedAt
        ? Number(status.startedAt)
        : parseInt(localStorage.getItem(startedAtKey(selectedId)) || '0');
      if (!startedAtMs) {
        startedAtMs = Date.now();
        localStorage.setItem(startedAtKey(selectedId), String(startedAtMs));
      }
      const startDay = calcDayFromStart(startedAtMs);
      await fetchAPI('/warmup/start', {
        method: 'POST',
        body: { instanceId: selectedId, startDay, startedAt: startedAtMs },
      });
      await pollStatus(selectedId);
    } catch (e: any) { setError(e?.message || 'Erro ao iniciar.'); }
    finally { setActionLoading(false); }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await fetchAPI('/warmup/stop', { method: 'POST', body: { instanceId: selectedId } });
      await pollStatus(selectedId);
    } catch { /* silent */ } finally { setActionLoading(false); }
  };

  const handleResetDay = async () => {
    if (!selectedId) return;
    const dias = window.prompt('Há quantos dias você realmente começou o aquecimento? (ex: 2 para dizer que foi há 2 dias)');
    if (!dias || isNaN(Number(dias))) return;
    const daysAgo = Math.max(0, parseInt(dias) - 1);
    const newStartedAt = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    setActionLoading(true);
    try {
      const res = await fetchAPI('/warmup/reset-started-at', {
        method: 'POST',
        body: { instanceId: selectedId, startedAt: newStartedAt },
      });
      await pollStatus(selectedId);
      localStorage.setItem(startedAtKey(selectedId), String(newStartedAt));
      alert(`✅ Corrigido! Aquecimento agora está no ${res.newDay}º dia.`);
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setActionLoading(false); }
  };

  // Valores derivados — ordem importa
  const inst            = instances.find(i => i.id === selectedId);
  // Dia: SEMPRE vem do servidor. Quando parado, usar último dia salvo no localStorage
  const savedDay        = selectedId ? parseInt(localStorage.getItem(storageKey(selectedId)) || '1') : 1;
  const day             = status?.running ? status.day : (status?.day ?? savedDay);
  const currentPhaseId = day <= 3 ? 1 : day <= 7 ? 2 : day <= 14 ? 3 : day <= 21 ? 4 : 5;
  const phase       = getPhaseUI(status?.running ? (status.phaseId ?? currentPhaseId) : currentPhaseId);
  // Temperatura real: combina dias passados com mensagens enviadas
  // 100% = Fase 5 (dia 22+) com 500+ msgs enviadas
  // Progresso por dias: contribui 60% do calor
  // Progresso por mensagens: contribui 40% do calor
  const dayProgress  = Math.min((day - 1) / 21, 1); // 0 a 1 baseado em 21 dias
  const totalSentNow = status?.totalSent ?? 0;
  const msgsTarget   = 500; // ~500 msgs = chip bem aquecido
  const msgsProgress = Math.min(totalSentNow / msgsTarget, 1);
  const heatLevel    = Math.min(Math.round((dayProgress * 0.6 + msgsProgress * 0.4) * 100), 100);
  const isRunning   = status?.running ?? false;

  const fmt = (s: number) => s <= 0 ? '—' : s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;

  return (
    <div className="animate-fade-in space-y-8">

      {/* HEADER */}
      <div className="dashboard-card relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 70% 50%, ${phase.color}55 0%, transparent 70%)` }} />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest"
              style={{ background: `${phase.color}20`, color: phase.color }}>
              {phase.icon} {phase.name} · {phase.subtitle}
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">Aquecimento Cloud</h1>
            <p className="text-slate-500 text-sm mt-1">Loop roda no servidor — continua mesmo ao trocar de aba.</p>
          </div>
          <div className="flex items-center gap-3">
            {isRunning ? (
              <button onClick={handleStop} disabled={actionLoading}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-6 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl active:scale-95">
                {actionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Square size={16}/>}
                Parar
              </button>
            ) : (
              <button onClick={handleStart} disabled={!selectedId || actionLoading || loading}
                className="text-white px-6 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: selectedId ? phase.color : '#374151', boxShadow: selectedId ? `0 20px 40px ${phase.color}40` : 'none' }}>
                {actionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Flame size={16}/>}
                {actionLoading ? 'Iniciando...' : 'Iniciar Aquecimento'}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-sm font-bold">
          <AlertTriangle size={16}/> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* TERMÔMETRO */}
          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Thermometer size={18} className="text-amber-400"/>
                <h3 className="text-base font-black text-white uppercase tracking-tight">Temperatura do Chip</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black italic" style={{ color: phase.color }}>{heatLevel}°</span>
                <span className="text-xs text-slate-500 font-bold">/ 100°</span>
              </div>
            </div>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 mb-3">
              <div className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                style={{ width: `${Math.max(heatLevel, 2)}%`, background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e)' }}>
                {isRunning && <div className="absolute inset-0 bg-white/20 animate-pulse"/>}
              </div>
            </div>
            <div className="flex justify-between mt-2">
              {PHASES.map(p => (
                <div key={p.id} className="text-center flex-1">
                  <div className={`text-base ${phase.id === p.id ? '' : 'opacity-25'}`}>{p.icon}</div>
                  <div className={`text-[7px] font-black uppercase tracking-widest mt-0.5 ${phase.id === p.id ? p.text : 'text-slate-700'}`}>{p.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* MÉTRICAS */}
          <div className="grid grid-cols-3 gap-4">
            <div className="dashboard-card text-center py-5">
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Dia Atual</div>
              <div className="text-3xl font-black text-white italic">{day}</div>
              <div className="text-[9px] text-slate-600 mt-1">de 22+ dias</div>
            </div>
            <div className="dashboard-card text-center py-5">
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Nesta Sessão</div>
              <div className="text-3xl font-black italic" style={{ color: phase.color }}>{status?.sessionSent ?? 0}</div>
              <div className="text-[9px] text-slate-600 mt-1">msgs enviadas</div>
            </div>
            <div className="dashboard-card text-center py-5">
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Total</div>
              <div className="text-3xl font-black text-white italic">{(status?.totalSent ?? 0).toLocaleString('pt-BR')}</div>
              <div className="text-[9px] text-slate-600 mt-1">esta sessão</div>
            </div>
          </div>

          {/* FASES */}
          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2"><Target size={14}/> Protocolo</h3>
              <button onClick={() => setShowInfo(!showInfo)} className="text-slate-600 hover:text-slate-400 transition-colors"><Info size={14}/></button>
            </div>
            <div className="space-y-2">
              {PHASES.map(p => {
                const isActive = phase.id === p.id && isRunning;
                const done     = day > p.phaseDays[1];
                return (
                  <div key={p.id} className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${isActive ? `${p.bg} ${p.border}` : done ? 'bg-white/3 border-white/5 opacity-40' : 'bg-white/3 border-white/5'}`}>
                    <span className="text-lg w-7 text-center flex-shrink-0">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-black uppercase ${isActive ? 'text-white' : done ? 'text-slate-500' : 'text-slate-400'}`}>{p.name}</span>
                        <span className="text-[9px] text-slate-600">{p.subtitle}</span>
                        {isActive && <span className="text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse" style={{ background:`${p.color}30`, color: p.color }}>ATIVA</span>}
                        {done     && <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">✓</span>}
                      </div>
                      {showInfo && <p className="text-[9px] text-slate-600 mt-1">{p.msgsRange} msgs/sessão · delay {p.delay}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">

          {/* INSTÂNCIA */}
          <div className="dashboard-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 border border-brand-500/20"><Zap size={15}/></div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Instância</h3>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 text-xs"><div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin"/> Carregando...</div>
            ) : instances.length === 0 ? (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">⚠️ Nenhuma instância criada. Crie uma na aba WhatsApp.</div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <select value={selectedId} onChange={e => { setSelectedId(e.target.value); localStorage.setItem('warmup_selected_instance', e.target.value); }} disabled={isRunning}
                    className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold appearance-none outline-none focus:border-brand-500 transition-all disabled:opacity-50">
                    <option value="">Selecionar...</option>
                    {instances.map(i => <option key={i.id} value={i.id}>{i.name} · {i.phoneNumber || '?'} {i.status !== 'connected' ? '(desconectado)' : ''}</option>)}
                  </select>
                  <ChevronDown size={12} className="text-slate-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"/>
                </div>
                {inst?.phoneNumber && (
                  <div className="rounded-xl p-3 border text-center" style={{ background:`${phase.color}10`, borderColor:`${phase.color}30` }}>
                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">📱 Enviando para</div>
                    <div className="text-white font-black text-sm">{inst.phoneNumber}</div>
                    <div className="text-[9px] text-slate-500 mt-1">(próprio número)</div>
                  </div>
                )}
                {!isRunning && selectedId && (
                  <button
                    onClick={handleResetDay}
                    className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-amber-400 hover:border-amber-500/30 font-black text-[9px] uppercase tracking-widest transition-all">
                    ✏️ Corrigir Dia Atual
                  </button>
                )}
              </div>
            )}
          </div>

          {/* STATUS */}
          <div className="dashboard-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20"><Activity size={15}/></div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Status Real</h3>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-black text-slate-400 uppercase">Loop Servidor</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}/>
                  <span className={`text-[10px] font-black uppercase ${isRunning ? 'text-emerald-400' : 'text-slate-500'}`}>{isRunning ? 'Ativo' : 'Parado'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-black text-slate-400 uppercase">Fase</span>
                <span className="text-[10px] font-black uppercase" style={{ color: phase.color }}>{phase.icon} {phase.name}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-black text-slate-400 uppercase">Anti-Ban</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                  <span className="text-[10px] font-black uppercase text-emerald-400">ON</span>
                </div>
              </div>
              {isRunning && countdown > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background:`${phase.color}10`, borderColor:`${phase.color}30` }}>
                  <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Clock size={11}/> Próxima msg</span>
                  <span className="text-sm font-black" style={{ color: phase.color }}>{fmt(countdown)}</span>
                </div>
              )}
              {isRunning && status?.lastMessage && (
                <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                  <div className="text-[8px] font-black text-slate-600 uppercase mb-1">Última mensagem</div>
                  <div className="text-[10px] text-slate-300 italic">"{status.lastMessage}"</div>
                </div>
              )}
            </div>
          </div>

          {/* LOG */}
          <div className="dashboard-card flex flex-col" style={{ minHeight:'260px' }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} className="text-slate-400"/>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Log</h3>
            </div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto space-y-1 max-h-56">
              {!status?.logs?.length ? (
                <div className="flex flex-col items-center justify-center h-24 opacity-20">
                  <MessageSquare size={28} strokeWidth={1} className="text-slate-600 mb-1"/>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Aguardando</span>
                </div>
              ) : status.logs.map((log, i) => {
                const lp = PHASES.find(p => p.id === log.phaseId) ?? PHASES[0];
                return (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${log.type==='error' ? 'bg-rose-500/10' : 'bg-white/3'}`}>
                    <span className="text-[8px] text-slate-600 font-mono flex-shrink-0 mt-0.5">{log.time}</span>
                    <span className="text-[9px] flex-shrink-0">{lp.icon}</span>
                    <span className={`text-[10px] leading-tight ${log.type==='error' ? 'text-rose-400' : log.type==='info' ? 'text-slate-500 italic' : 'text-slate-300'}`}>{log.msg}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* AVISOS */}
      <div className="dashboard-card border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-3 mb-5">
          <AlertTriangle size={16} className="text-amber-400"/>
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-tight">⚠️ Leia antes de usar — Protocolo Anti-Ban</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {[
            { label:'🌱 Dias 1–3 · Ativação',         c:'text-emerald-400', brd:'border-emerald-500/20', bg:'bg-emerald-500/5', rule:'Máx. 4 msgs/sessão. Delay de 3–7 min entre sessões.', warn:'Número novo é o mais vulnerável. Nunca force.' },
            { label:'💬 Dias 4–7 · Conversação',       c:'text-blue-400',   brd:'border-blue-500/20',    bg:'bg-blue-500/5',    rule:'Máx. 7 msgs/sessão. Fase crítica — não pule.',       warn:'Disparar em massa nesta fase = ban quase certo.' },
            { label:'🔥 Dias 8–14 · Engajamento',      c:'text-amber-400',  brd:'border-amber-500/20',   bg:'bg-amber-500/5',   rule:'Até 10 msgs/sessão. Grupos pequenos com cuidado.',   warn:'Volume alto antes do dia 14 = risco elevado.' },
            { label:'💎 Dia 22+ · Chip Maturado',      c:'text-pink-400',   brd:'border-pink-500/20',    bg:'bg-pink-500/5',    rule:'Chip estabilizado. Apto para alto volume.',           warn:'Mantenha delay ≥ 30s nos disparos sempre.' },
          ].map((item, i) => (
            <div key={i} className={`rounded-xl p-4 border ${item.brd} ${item.bg}`}>
              <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${item.c}`}>{item.label}</div>
              <div className="text-[10px] text-slate-300 mb-1.5">✅ {item.rule}</div>
              <div className="text-[9px] text-slate-500">⚠️ {item.warn}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-white/5">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
            <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">🚫 Nunca faça</div>
            <ul className="space-y-1">{['Disparar em massa antes do dia 14','Delay abaixo de 20s no disparador','Aquecer e disparar ao mesmo tempo','Ignorar erros (sinal de soft-ban)'].map((t,i)=><li key={i} className="text-[9px] text-slate-500">• {t}</li>)}</ul>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">✅ Boas práticas</div>
            <ul className="space-y-1">{['Completar as 5 fases antes de disparar','Manter aquecimento após maturação','Usar delay 30–60s no disparador','Variar mensagens do disparador'].map((t,i)=><li key={i} className="text-[9px] text-slate-500">• {t}</li>)}</ul>
          </div>
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3">
            <div className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-2">🛡️ Proteções ativas</div>
            <ul className="space-y-1">{['Loop 100% no servidor','Delays aleatórios por fase','60+ variações de texto','Progressão gradual de volume'].map((t,i)=><li key={i} className="text-[9px] text-slate-500">• {t}</li>)}</ul>
          </div>
        </div>
      </div>

    </div>
  );
};

export default WarmupCloud;