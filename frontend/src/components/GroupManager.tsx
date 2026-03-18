import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '@/config/api';
import {
  Users, Upload, Loader2, AlertCircle, CheckCircle2, Clock,
  PlayCircle, PauseCircle, X, Search, ArrowLeft, ChevronRight,
  RefreshCw, FileSpreadsheet, Shield
} from 'lucide-react';

interface Instance { id: string; name: string; phoneNumber?: string; status: string; }
interface Group    { id: string; groupId: string; name: string; participantsCount: number; }

interface QueueItem {
  phone: string;
  status: 'pending' | 'adding' | 'added' | 'failed';
  error?: string;
}

// ── Parse CSV/XLSX: extrai todos os números de telefone do arquivo ────────────
async function parseContactFile(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const phones: string[] = [];
        const seen = new Set<string>();

        // Divide por linhas e vírgulas — compatível com CSV simples e exportação do GroupToXlsx
        const tokens = content
          .replace(/\r/g, '')
          .split(/[\n,;]+/)
          .map(t => t.replace(/[^0-9]/g, '').trim())
          .filter(t => t.length >= 8 && t.length <= 15);

        for (const t of tokens) {
          if (!seen.has(t)) { seen.add(t); phones.push(t); }
        }

        if (phones.length === 0) reject(new Error('Nenhum número válido encontrado. O arquivo deve conter números de telefone.'));
        else resolve(phones);
      } catch { reject(new Error('Erro ao processar arquivo.')); }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsText(file, 'utf-8');
  });
}

const GroupManager: React.FC = () => {
  const [step, setStep]           = useState(1);
  const [instanceId, setInstanceId] = useState('');
  const [groupId, setGroupId]     = useState('');
  const [groupName, setGroupName] = useState('');

  const [instances, setInstances] = useState<Instance[]>([]);
  const [groups, setGroups]       = useState<Group[]>([]);

  const [loadingInst, setLoadingInst]     = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const [searchGroup, setSearchGroup] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [queue, setQueue]       = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused]   = useState(false);
  const [delaySec, setDelaySec]   = useState(45);
  const [progress, setProgress]   = useState(0);
  const [countdown, setCountdown] = useState(0);

  const abortRef   = useRef(false);
  const pauseRef   = useRef(false);
  const queueRef   = useRef<QueueItem[]>([]);

  // ── Instâncias ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingInst(true);
      try {
        const res  = await fetchAPI('/instances');
        const list = (res?.data || res?.instances || res || []) as Instance[];
        setInstances(Array.isArray(list) ? list.filter(i => i.status === 'connected') : []);
      } catch { setError('Erro ao carregar instâncias'); }
      finally { setLoadingInst(false); }
    })();
  }, []);

  // ── Grupos ────────────────────────────────────────────────────────────────
  const [groupsWarning, setGroupsWarning] = useState('');

  const loadGroups = async (instId: string) => {
    setLoadingGroups(true); setError(''); setGroups([]); setGroupsWarning('');
    try {
      // /admin-only retorna apenas grupos onde a instância é admin
      const res  = await fetchAPI(`/groups/admin-only/${instId}`);
      const list = res?.groups || [];
      setGroups(Array.isArray(list) ? list : []);
      if (res?.warning) setGroupsWarning(res.warning);
      if (!list.length) setError('Nenhum grupo encontrado onde você é admin.');
    } catch { setError('Erro ao carregar grupos'); }
    finally { setLoadingGroups(false); }
  };

  // ── Upload de arquivo ─────────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setSuccess(''); setQueue([]);

    if (!file.name.match(/\.(csv|xlsx|txt)$/i)) {
      setError('Formato inválido. Use CSV, XLSX ou TXT.'); return;
    }

    try {
      const phones = await parseContactFile(file);
      const items: QueueItem[] = phones.map(p => ({ phone: p, status: 'pending' }));
      setQueue(items);
      queueRef.current = items;
      setUploadedFile(file);
      setSuccess(`✅ ${phones.length} números carregados. Pronto para adicionar!`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Loop de adição ────────────────────────────────────────────────────────
  const runLoop = async (items: QueueItem[]) => {
    setIsRunning(true); abortRef.current = false; pauseRef.current = false;
    setError(''); setSuccess('');

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;

      // Aguardar se pausado
      while (pauseRef.current) {
        await new Promise(r => setTimeout(r, 500));
        if (abortRef.current) break;
      }
      if (abortRef.current) break;

      // Marcar como adding
      items[i] = { ...items[i], status: 'adding' };
      setQueue([...items]);

      try {
        const res = await fetchAPI(`/groups/add-participants/${instanceId}/${encodeURIComponent(groupId)}`, {
          method: 'POST',
          body: { participants: [items[i].phone], delaySeconds: 0 },
        });

        const failed: string[] = res?.failed || [];
        if (failed.includes(items[i].phone)) {
          items[i] = { ...items[i], status: 'failed', error: 'Número não aceitou adição' };
        } else {
          items[i] = { ...items[i], status: 'added' };
        }
      } catch (err: any) {
        items[i] = { ...items[i], status: 'failed', error: err?.message || 'Erro' };
      }

      setQueue([...items]);
      setProgress(Math.round(((i + 1) / items.length) * 100));

      // Delay com countdown
      if (i < items.length - 1 && !abortRef.current) {
        for (let s = delaySec; s > 0; s--) {
          if (abortRef.current) break;
          while (pauseRef.current) await new Promise(r => setTimeout(r, 300));
          setCountdown(s);
          await new Promise(r => setTimeout(r, 1000));
        }
        setCountdown(0);
      }
    }

    const added  = items.filter(i => i.status === 'added').length;
    const failed = items.filter(i => i.status === 'failed').length;
    setSuccess(`✅ ${added}/${items.length} adicionados com sucesso.${failed > 0 ? ` ${failed} falhas.` : ''}`);
    setIsRunning(false); setCountdown(0);
  };

  const handleStart = () => {
    if (!groupId)       { setError('Selecione um grupo.'); return; }
    if (!queue.length)  { setError('Carregue um arquivo com contatos.'); return; }
    const fresh = queue.map(i => ({ ...i, status: 'pending' as const }));
    setQueue(fresh);
    runLoop(fresh);
  };

  const handlePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
  };

  const handleStop = () => {
    abortRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
    setIsRunning(false);
    setCountdown(0);
  };

  const clearQueue = () => {
    setQueue([]); setUploadedFile(null); setProgress(0); setSuccess(''); setError('');
  };

  const goTo = (s: number) => { setError(''); setSuccess(''); setStep(s); };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectedInst   = instances.find(i => i.id === instanceId);
  const filteredGroups = groups.filter(g => g.name?.toLowerCase().includes(searchGroup.toLowerCase()));
  const addedCount     = queue.filter(i => i.status === 'added').length;
  const failedCount    = queue.filter(i => i.status === 'failed').length;
  const pendingCount   = queue.filter(i => i.status === 'pending').length;
  const estMinutes     = Math.ceil((pendingCount * delaySec) / 60);

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in space-y-6">

      {/* HEADER */}
      <div className="dashboard-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <span className="bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">
              👥 Gestão de Grupos
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">
              Adicionar Membros ao Grupo
            </h2>
            <p className="text-slate-400 text-sm mt-1">Importe CSV/XLSX com números e adicione em lote com delay seguro</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {[1,2,3].map(s => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                  step === s ? 'bg-blue-500 border-blue-500 text-white' :
                  step > s   ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
                               'bg-white/5 border-white/10 text-slate-500'
                }`}>{step > s ? '✓' : s}</div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-blue-500/50' : 'bg-white/10'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-sm font-bold">
          <AlertCircle size={16} className="flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-sm font-bold">
          <CheckCircle2 size={16} className="flex-shrink-0" /> {success}
        </div>
      )}

      {/* ── STEP 1: Instância ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 font-black text-sm">1</div>
            <div>
              <h3 className="text-lg font-black text-white uppercase">Selecionar WhatsApp</h3>
              <p className="text-sm text-slate-500">Escolha a instância que é admin do grupo</p>
            </div>
          </div>

          {loadingInst ? (
            <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin text-blue-500" /> Carregando...
            </div>
          ) : instances.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-10 text-center">
              <AlertCircle size={32} className="text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhuma instância conectada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {instances.map(inst => (
                <div key={inst.id} onClick={() => { setInstanceId(inst.id); loadGroups(inst.id); goTo(2); }}
                  className="p-5 rounded-xl border-2 border-white/10 bg-slate-900/30 cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-black text-white text-sm uppercase">{inst.name}</h4>
                    <span className="text-[10px] font-black px-2 py-1 rounded-md uppercase bg-emerald-500/10 text-emerald-500">✓ Conectado</span>
                  </div>
                  {inst.phoneNumber && <p className="text-xs text-slate-400">{inst.phoneNumber}</p>}
                  <div className="flex items-center gap-2 mt-3 text-blue-400 text-xs font-black">
                    <ChevronRight size={12} /> Selecionar
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Grupo ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 font-black text-sm">2</div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-white uppercase">Selecionar Grupo</h3>
              <p className="text-sm text-slate-500">Sua instância deve ser <span className="text-blue-400 font-bold">admin</span> do grupo escolhido</p>
            </div>
            <button onClick={() => loadGroups(instanceId)} className="flex items-center gap-2 text-slate-400 hover:text-blue-400 text-xs font-black uppercase transition-all">
              <RefreshCw size={13} /> Recarregar
            </button>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
            <Shield size={14} className="text-blue-400 flex-shrink-0" />
            <p className="text-xs text-slate-400">
              Exibindo grupos onde você é <strong className="text-white">admin ou criador</strong>.
              {' '}O sistema tentará adicionar diretamente; se não suportado, enviará o <strong className="text-white">link de convite</strong> para cada número.
            </p>
          </div>
          {groupsWarning && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
              <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
              <div className="text-xs text-amber-400">
                <p className="font-bold mb-1">⚠️ Não foi possível filtrar por admin</p>
                <p>{groupsWarning}</p>
                <p className="mt-1 text-amber-600">Selecione apenas grupos onde você é o <strong>criador</strong> para evitar erros.</p>
              </div>
            </div>
          )}

          <div className="relative mb-4">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={searchGroup} onChange={e => setSearchGroup(e.target.value)}
              placeholder="Buscar grupo..."
              className="w-full bg-[#0d1117] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-all" />
          </div>

          {loadingGroups ? (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin text-blue-500" /> Carregando grupos...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-10 text-center">
              <Users size={32} className="text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhum grupo encontrado</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-2">{filteredGroups.length} grupos</p>
              {filteredGroups.map(g => {
                const gid = g.groupId || g.id;
                return (
                  <div key={gid} onClick={() => { setGroupId(gid); setGroupName(g.name); goTo(3); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/3 cursor-pointer hover:bg-blue-500/5 hover:border-blue-500/20 transition-all group">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0">
                      <Users size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm truncate">{g.name}</p>
                      <p className="text-slate-500 text-xs">{g.participantsCount ?? 0} membros</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-all" />
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => goTo(1)} className="mt-5 flex items-center gap-2 text-slate-400 hover:text-white text-sm font-black uppercase transition-all">
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      )}

      {/* ── STEP 3: Upload + Executar ──────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'WhatsApp', value: selectedInst?.name || '—' },
              { label: 'Grupo',    value: groupName || '—' },
              { label: 'Fila',     value: queue.length.toString(), color: 'text-blue-400' },
              { label: 'Adicionados', value: addedCount.toString(), color: 'text-emerald-400' },
            ].map((c, i) => (
              <div key={i} className="dashboard-card py-4 text-center">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{c.label}</div>
                <div className={`text-lg font-black truncate ${c.color || 'text-white'}`}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="dashboard-card">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 font-black text-sm">3</div>
              <div>
                <h3 className="text-lg font-black text-white uppercase">Carregar & Adicionar</h3>
                <p className="text-sm text-slate-500">Grupo: <span className="text-white font-bold">{groupName}</span></p>
              </div>
            </div>

            {/* Upload */}
            <label className="block mb-5 cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                uploadedFile ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-blue-500/30 hover:bg-blue-500/3'
              }`}>
                <FileSpreadsheet size={28} className={`mx-auto mb-3 ${uploadedFile ? 'text-blue-400' : 'text-slate-500'}`} />
                {uploadedFile ? (
                  <>
                    <p className="text-blue-400 font-black text-sm">{uploadedFile.name}</p>
                    <p className="text-slate-500 text-xs mt-1">{queue.length} números carregados</p>
                    {!isRunning && <p className="text-slate-600 text-[10px] mt-2">Clique para trocar o arquivo</p>}
                  </>
                ) : (
                  <>
                    <p className="text-white font-black text-sm mb-1">Clique para carregar arquivo</p>
                    <p className="text-slate-500 text-xs">CSV, XLSX ou TXT · um número por linha</p>
                    <p className="text-slate-600 text-[10px] mt-1">Aceita o arquivo exportado pela seção "Lista de Contatos"</p>
                  </>
                )}
              </div>
              <input type="file" accept=".csv,.xlsx,.txt" onChange={handleFile} className="hidden" disabled={isRunning} />
            </label>

            {/* Delay config */}
            {queue.length > 0 && (
              <div className="bg-[#060b16] border border-white/5 rounded-xl p-5 mb-5">
                <h4 className="text-sm font-black text-white uppercase mb-4 flex items-center gap-2">
                  <Clock size={14} className="text-blue-500" /> Delay entre adições
                </h4>
                <input type="range" min="35" max="120" value={delaySec}
                  onChange={e => setDelaySec(parseInt(e.target.value))}
                  disabled={isRunning}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 mb-2" />
                <div className="flex justify-between text-[10px] text-slate-600 mb-3">
                  <span>35s (mínimo seguro)</span><span className="text-white font-black text-sm">{delaySec}s</span><span>120s (muito seguro)</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 bg-white/5 rounded-lg p-3">
                  <span>⏱️ Tempo estimado</span>
                  <span className="font-black text-white">{estMinutes} minutos ({queue.length} contatos)</span>
                </div>
              </div>
            )}

            {/* Progresso durante execução */}
            {isRunning && (
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-slate-400">{progress}% concluído</span>
                  <span className="text-xs text-slate-500">{addedCount + failedCount}/{queue.length}</span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-blue-500 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                </div>
                {countdown > 0 && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-slate-400 text-xs">
                    <Clock size={12} />
                    Próxima adição em <span className="text-white font-black">{countdown}s</span>
                    {isPaused && <span className="text-amber-400 font-black ml-2">· PAUSADO</span>}
                  </div>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-5 border-t border-white/5">
              <button onClick={() => goTo(2)} disabled={isRunning}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-white font-black text-sm uppercase hover:bg-white/5 transition-all disabled:opacity-40">
                <ArrowLeft size={14} /> Voltar
              </button>

              {!isRunning ? (
                <button onClick={handleStart} disabled={!queue.length}
                  className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
                  <PlayCircle size={16} /> Iniciar Adição ({queue.length})
                </button>
              ) : (
                <>
                  <button onClick={handlePause}
                    className={`flex-1 text-white px-6 py-3 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-3 transition-all ${
                      isPaused ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'
                    }`}>
                    {isPaused ? <><PlayCircle size={16} /> Retomar</> : <><PauseCircle size={16} /> Pausar</>}
                  </button>
                  <button onClick={handleStop}
                    className="px-5 py-3 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-black text-sm uppercase transition-all">
                    <X size={16} />
                  </button>
                </>
              )}

              {!isRunning && queue.length > 0 && (
                <button onClick={clearQueue}
                  className="px-4 py-3 rounded-xl border border-white/10 text-slate-500 hover:text-rose-400 hover:border-rose-500/20 font-black text-sm uppercase transition-all">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Status detalhado */}
          {queue.length > 0 && (isRunning || addedCount > 0 || failedCount > 0) && (
            <div className="dashboard-card">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-emerald-600 uppercase font-black">Adicionados</p>
                  <p className="text-2xl font-black text-emerald-400">{addedCount}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-amber-600 uppercase font-black">Pendentes</p>
                  <p className="text-2xl font-black text-amber-400">{pendingCount}</p>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-rose-600 uppercase font-black">Falhas</p>
                  <p className="text-2xl font-black text-rose-400">{failedCount}</p>
                </div>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {queue.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg text-xs border ${
                    item.status === 'added'   ? 'bg-emerald-500/5 border-emerald-500/20' :
                    item.status === 'failed'  ? 'bg-rose-500/5 border-rose-500/20' :
                    item.status === 'adding'  ? 'bg-blue-500/10 border-blue-500/30 animate-pulse' :
                                                'bg-white/3 border-white/5'
                  }`}>
                    <span className="text-slate-300 font-mono">{item.phone}</span>
                    <div className="flex items-center gap-2">
                      {item.error && <span className="text-rose-400 text-[9px]">{item.error}</span>}
                      <span className={`text-[9px] font-black uppercase ${
                        item.status === 'added'  ? 'text-emerald-400' :
                        item.status === 'failed' ? 'text-rose-400' :
                        item.status === 'adding' ? 'text-blue-400' :
                                                   'text-slate-500'
                      }`}>
                        {item.status === 'added'  ? '✓ OK' :
                         item.status === 'failed' ? '✗ ERRO' :
                         item.status === 'adding' ? '⟳ ADICIONANDO' :
                                                    '⏳ PENDENTE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupManager;