import React, { useState, useEffect } from 'react';
import { fetchAPI } from '@/config/api';
import { Download, Users, Loader2, AlertCircle, CheckCircle2, Search, ChevronRight, ArrowLeft, Filter } from 'lucide-react';

interface Instance { id: string; name: string; phoneNumber?: string; status: string; }
interface Group    { id: string; groupId?: string; name: string; participantsCount: number; }

const GroupToXlsxExporter: React.FC = () => {
  const [step, setStep]           = useState(1);
  const [instanceId, setInstanceId] = useState('');
  const [groupId, setGroupId]     = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupCount, setGroupCount] = useState(0);

  const [instances, setInstances] = useState<Instance[]>([]);
  const [groups, setGroups]       = useState<Group[]>([]);

  const [loadingInst, setLoadingInst]     = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [exporting, setExporting]         = useState(false);

  const [filterAdmin, setFilterAdmin] = useState(false);
  const [search, setSearch]           = useState('');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Instâncias
  useEffect(() => {
    (async () => {
      setLoadingInst(true);
      try {
        const res  = await fetchAPI('/instances');
        const list = res?.data || res?.instances || res || [];
        setInstances(Array.isArray(list) ? list : []);
      } catch { setError('Erro ao carregar instâncias'); }
      finally { setLoadingInst(false); }
    })();
  }, []);

  // Grupos
  const loadGroups = async (instId: string) => {
    setLoadingGroups(true); setError(''); setGroups([]);
    try {
      const res  = await fetchAPI(`/groups?instanceId=${instId}`);
      const list = res?.groups || [];
      setGroups(Array.isArray(list) ? list : []);
    } catch { setError('Erro ao carregar grupos'); }
    finally { setLoadingGroups(false); }
  };

  // Download direto — chama a rota export-xlsx do backend que já gera o CSV
  const handleExport = async () => {
    if (!groupId || !instanceId) return;
    setExporting(true); setError(''); setSuccess('');
    try {
      const token = localStorage.getItem('token');
      const url   = `http://localhost:3001/api/groups/export-xlsx/${instanceId}/${encodeURIComponent(groupId)}?excludeAdmins=${filterAdmin}`;
      const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Erro ao gerar arquivo');
      const blob  = await res.blob();
      const a     = document.createElement('a');
      a.href      = URL.createObjectURL(blob);
      a.download  = `${groupName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      setSuccess(`✅ Arquivo baixado com sucesso!`);
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar');
    } finally { setExporting(false); }
  };

  const filtered = groups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));
  const selectedInst = instances.find(i => i.id === instanceId);

  return (
    <div className="animate-fade-in space-y-6">

      {/* HEADER */}
      <div className="dashboard-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 pointer-events-none" />
        <div className="relative z-10">
          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">
            📋 Lista de Contatos
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">
            Extrair Grupo para Excel
          </h2>
          <p className="text-slate-400 text-sm mt-1">Selecione o grupo e baixe a lista de participantes</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-sm font-bold">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-sm font-bold">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* STEP 1: Instância */}
      {step === 1 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 font-black text-sm">1</div>
            <div>
              <h3 className="text-lg font-black text-white uppercase">Selecionar WhatsApp</h3>
              <p className="text-sm text-slate-500">Escolha a instância que contém o grupo</p>
            </div>
          </div>

          {loadingInst ? (
            <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin text-emerald-500" /> Carregando...
            </div>
          ) : instances.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-10 text-center">
              <AlertCircle size={32} className="text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhuma instância conectada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {instances.map(inst => (
                <div key={inst.id}
                  onClick={() => { setInstanceId(inst.id); loadGroups(inst.id); setStep(2); setError(''); setSuccess(''); }}
                  className="p-5 rounded-xl border-2 border-white/10 bg-slate-900/30 cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all group">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-black text-white text-sm uppercase">{inst.name}</h4>
                    <span className="text-[10px] font-black px-2 py-1 rounded-md uppercase bg-emerald-500/10 text-emerald-500">✓ Conectado</span>
                  </div>
                  {inst.phoneNumber && <p className="text-xs text-slate-400">{inst.phoneNumber}</p>}
                  <div className="flex items-center gap-2 mt-3 text-emerald-400 text-xs font-black">
                    <ChevronRight size={12} /> Selecionar
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Grupo */}
      {step === 2 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 font-black text-sm">2</div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-white uppercase">Selecionar Grupo</h3>
              <p className="text-sm text-slate-500">WhatsApp: <span className="text-white font-bold">{selectedInst?.name}</span></p>
            </div>
          </div>

          <div className="relative mb-4">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar grupo..."
              className="w-full bg-[#0d1117] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-emerald-500 transition-all" />
          </div>

          {loadingGroups ? (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin text-emerald-500" /> Carregando grupos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-10 text-center">
              <Users size={32} className="text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhum grupo encontrado</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-2">{filtered.length} grupos</p>
              {filtered.map(g => {
                const gid = g.groupId || g.id;
                return (
                  <div key={gid}
                    onClick={() => { setGroupId(gid); setGroupName(g.name); setGroupCount(g.participantsCount ?? 0); setStep(3); setError(''); setSuccess(''); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/3 cursor-pointer hover:bg-emerald-500/5 hover:border-emerald-500/20 transition-all group">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0">
                      <Users size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm truncate">{g.name}</p>
                      <p className="text-slate-500 text-xs">{g.participantsCount ?? 0} membros</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-emerald-400 transition-all" />
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => setStep(1)} className="mt-5 flex items-center gap-2 text-slate-400 hover:text-white text-sm font-black uppercase transition-all">
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      )}

      {/* STEP 3: Baixar */}
      {step === 3 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 font-black text-sm">3</div>
            <div>
              <h3 className="text-lg font-black text-white uppercase">Baixar Lista</h3>
              <p className="text-sm text-slate-500">Confirme e baixe o arquivo</p>
            </div>
          </div>

          {/* Info do grupo */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-6 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Users size={24} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-lg truncate">{groupName}</p>
              <p className="text-slate-400 text-sm">{selectedInst?.name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-black text-emerald-400">{groupCount}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">membros</p>
            </div>
          </div>

          {/* Filtro excluir admins */}
          <div className="bg-[#060b16] border border-white/5 rounded-xl p-5 mb-6">
            <label className="flex items-center gap-4 cursor-pointer">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${filterAdmin ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 bg-transparent'}`}
                onClick={() => setFilterAdmin(!filterAdmin)}>
                {filterAdmin && <span className="text-white text-xs font-black">✓</span>}
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <div>
                  <p className="text-sm font-black text-white">Excluir administradores</p>
                  <p className="text-xs text-slate-500">Remove admins do arquivo exportado</p>
                </div>
              </div>
            </label>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-white font-black text-sm uppercase hover:bg-white/5 transition-all">
              <ArrowLeft size={14} /> Voltar
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all">
              {exporting
                ? <><Loader2 size={16} className="animate-spin" /> Gerando arquivo...</>
                : <><Download size={16} /> Baixar Lista ({groupCount} contatos)</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupToXlsxExporter;