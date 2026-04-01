import React, { useState, useEffect } from 'react';
import { fetchAPI } from '@/config/api';
import {
  Users, Upload, Loader2, AlertCircle, CheckCircle2, Search, ChevronRight,
  ArrowLeft, Plus, Trash2, Download, Database, FileSpreadsheet, X, Filter,
} from 'lucide-react';

type MainView = 'lists' | 'detail' | 'extract';

interface CList {
  id: number;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: { contacts: number };
}
interface Contact { id: number; phoneNumber: string; name?: string | null; }
interface Instance { id: string; name: string; phoneNumber?: string; status: string; }
interface Group    { id: string; groupId?: string; name: string; participantsCount: number; }

// ── Helpers ──────────────────────────────────────────────────────────────────
function authFetch(url: string) {
  const token = localStorage.getItem('token');
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

const ContactListsManager: React.FC = () => {
  const [view, setView]               = useState<MainView>('lists');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // ── Lists view ──────────────────────────────────────────────────────────────
  const [lists, setLists]             = useState<CList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating]       = useState(false);

  // ── Detail view ─────────────────────────────────────────────────────────────
  const [selectedList, setSelectedList] = useState<CList | null>(null);
  const [contacts, setContacts]         = useState<Contact[]>([]);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [importingCSV, setImportingCSV] = useState(false);

  // ── Extract view (wizard) ────────────────────────────────────────────────────
  const [extractStep, setExtractStep]       = useState(1);
  const [instances, setInstances]           = useState<Instance[]>([]);
  const [loadingInst, setLoadingInst]       = useState(false);
  const [groups, setGroups]                 = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups]   = useState(false);
  const [extInstId, setExtInstId]           = useState('');
  const [extGroupId, setExtGroupId]         = useState('');
  const [extGroupName, setExtGroupName]     = useState('');
  const [extGroupCount, setExtGroupCount]   = useState(0);
  const [extFilterAdmin, setExtFilterAdmin] = useState(false);
  const [extAction, setExtAction]           = useState<'download' | 'save'>('download');
  const [extTargetListId, setExtTargetListId] = useState<number | ''>('');
  const [extNewListName, setExtNewListName] = useState('');
  const [extSearch, setExtSearch]           = useState('');
  const [extracting, setExtracting]         = useState(false);
  const [extractOriginListId, setExtractOriginListId] = useState<number | null>(null);

  // ── Load lists ───────────────────────────────────────────────────────────────
  const loadLists = async () => {
    setLoadingLists(true);
    try {
      const data = await fetchAPI('/contacts/lists');
      setLists(Array.isArray(data) ? data : []);
    } catch { setError('Erro ao carregar listas'); }
    finally { setLoadingLists(false); }
  };
  useEffect(() => { loadLists(); }, []);

  // ── Open detail ──────────────────────────────────────────────────────────────
  const openDetail = (list: CList) => {
    setSelectedList(list);
    setContacts([]);
    setContactsPage(1);
    setContactsTotal(0);
    setError(''); setSuccess('');
    setView('detail');
    fetchContacts(list.id, 1);
  };

  const fetchContacts = async (listId: number, page: number) => {
    setLoadingContacts(true);
    try {
      const data = await fetchAPI(`/contacts/lists/${listId}/contacts?page=${page}&limit=50`);
      setContacts(data.contacts || []);
      setContactsTotal(data.pagination?.total || 0);
      setContactsPage(page);
    } catch { setError('Erro ao carregar contatos'); }
    finally { setLoadingContacts(false); }
  };

  // ── Create list ──────────────────────────────────────────────────────────────
  const createList = async () => {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      await fetchAPI('/contacts/lists', { method: 'POST', body: { name: newListName.trim() } });
      setNewListName(''); setShowCreate(false);
      setSuccess('Lista criada!');
      await loadLists();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  // ── Delete list ──────────────────────────────────────────────────────────────
  const deleteList = async (list: CList) => {
    if (!confirm(`Excluir "${list.name}" e todos os ${list._count?.contacts ?? 0} contatos?`)) return;
    setError(''); setSuccess('');
    try {
      await fetchAPI(`/contacts/lists/${list.id}`, { method: 'DELETE' });
      setSuccess(`"${list.name}" excluída.`);
      await loadLists();
    } catch (e: any) { setError(e.message); }
  };

  // ── Import CSV ───────────────────────────────────────────────────────────────
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedList || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    e.target.value = '';
    setImportingCSV(true); setError(''); setSuccess('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res  = await authFetch(`/api/contacts/lists/${selectedList.id}/import-csv`);
      // need POST
      const res2 = await fetch(`/api/contacts/lists/${selectedList.id}/import-csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: form,
      });
      const data = await res2.json();
      if (!res2.ok) throw new Error(data.error || 'Erro ao importar');
      setSuccess(`${data.imported} contatos importados!`);
      fetchContacts(selectedList.id, 1);
      loadLists();
    } catch (e: any) { setError(e.message); }
    finally { setImportingCSV(false); }
  };

  // ── Export list CSV ──────────────────────────────────────────────────────────
  const handleExportList = async () => {
    if (!selectedList) return;
    const res = await authFetch(`/api/contacts/lists/${selectedList.id}/export-csv`);
    if (!res.ok) { setError('Erro ao exportar'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedList.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Start extract wizard ─────────────────────────────────────────────────────
  const startExtract = async (opts?: { targetListId?: number; action?: 'download' | 'save'; originListId?: number }) => {
    setView('extract');
    setExtractStep(1);
    setExtInstId(''); setExtGroupId(''); setExtGroupName(''); setExtGroupCount(0);
    setExtSearch(''); setExtFilterAdmin(false); setExtNewListName('');
    setExtAction(opts?.action ?? 'download');
    setExtTargetListId(opts?.targetListId !== undefined ? opts.targetListId : '');
    setExtractOriginListId(opts?.originListId ?? null);
    setError(''); setSuccess('');
    setLoadingInst(true);
    try {
      const res  = await fetchAPI('/instances');
      const list = res?.data || res?.instances || res || [];
      setInstances(Array.isArray(list) ? list.filter((i: any) => i.status === 'connected') : []);
    } catch { setError('Erro ao carregar instâncias'); }
    finally { setLoadingInst(false); }
  };

  const selectExtInstance = async (instId: string) => {
    setExtInstId(instId);
    setExtractStep(2);
    setLoadingGroups(true); setGroups([]); setError('');
    try {
      const res = await fetchAPI(`/groups?instanceId=${instId}`);
      setGroups(res?.groups || []);
    } catch { setError('Erro ao carregar grupos'); }
    finally { setLoadingGroups(false); }
  };

  const selectExtGroup = (g: Group) => {
    setExtGroupId(g.groupId || g.id);
    setExtGroupName(g.name);
    setExtGroupCount(g.participantsCount ?? 0);
    setExtractStep(3);
  };

  const handleExtract = async () => {
    setExtracting(true); setError(''); setSuccess('');
    try {
      if (extAction === 'download') {
        const res = await authFetch(
          `/api/groups/export-xlsx/${extInstId}/${encodeURIComponent(extGroupId)}?excludeAdmins=${extFilterAdmin}`
        );
        if (!res.ok) throw new Error('Erro ao gerar arquivo');
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${extGroupName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        setSuccess('Arquivo baixado!');
      } else {
        let targetId = extTargetListId as number;
        if (!targetId) {
          if (!extNewListName.trim()) { setError('Informe o nome da nova lista.'); setExtracting(false); return; }
          const newList = await fetchAPI('/contacts/lists', { method: 'POST', body: { name: extNewListName.trim() } });
          targetId = newList.id;
          await loadLists();
        }
        const data = await fetchAPI(`/contacts/lists/${targetId}/import-from-group`, {
          method: 'POST',
          body: { instanceId: parseInt(extInstId), groupId: extGroupId },
        });
        setSuccess(`${data.imported} contatos salvos na lista "${data.listName}"!`);
        await loadLists();
      }
    } catch (e: any) { setError(e.message || 'Erro'); }
    finally { setExtracting(false); }
  };

  const goBackFromExtract = () => {
    if (extractOriginListId) {
      const list = lists.find(l => l.id === extractOriginListId);
      if (list) { openDetail(list); return; }
    }
    setView('lists'); setError(''); setSuccess('');
  };

  const extInstSelected   = instances.find(i => i.id === extInstId);
  const filteredExtGroups = groups.filter(g => g.name?.toLowerCase().includes(extSearch.toLowerCase()));

  // ════════════════════════════════════════════════════════════════════════════
  // EXTRACT VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'extract') return (
    <div className="animate-fade-in space-y-6">
      <div className="dashboard-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">
              Extrair Grupo
            </span>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Extrair Membros do Grupo</h2>
            <p className="text-slate-400 text-sm mt-1">Baixe ou salve a lista de participantes</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {[1,2,3].map(s => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                  extractStep === s ? 'bg-emerald-500 border-emerald-500 text-white' :
                  extractStep > s   ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                                      'bg-white/5 border-white/10 text-slate-500'
                }`}>{extractStep > s ? '✓' : s}</div>
                {s < 3 && <div className={`w-8 h-0.5 ${extractStep > s ? 'bg-emerald-500/50' : 'bg-white/10'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {error   && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-sm font-bold"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-sm font-bold"><CheckCircle2 size={16} /> {success}</div>}

      {/* STEP 1 */}
      {extractStep === 1 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 font-black text-sm">1</div>
            <div><h3 className="text-lg font-black text-white uppercase">Selecionar WhatsApp</h3><p className="text-sm text-slate-500">Escolha a instância com o grupo</p></div>
          </div>
          {loadingInst ? (
            <div className="flex items-center justify-center py-10 gap-3 text-slate-400"><Loader2 size={20} className="animate-spin text-emerald-500" /> Carregando...</div>
          ) : instances.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-10 text-center">
              <AlertCircle size={32} className="text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Nenhuma instância conectada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {instances.map(inst => (
                <div key={inst.id} onClick={() => selectExtInstance(inst.id)}
                  className="p-5 rounded-xl border-2 border-white/10 bg-slate-900/30 cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-black text-white text-sm uppercase">{inst.name}</h4>
                    <span className="text-[10px] font-black px-2 py-1 rounded-md uppercase bg-emerald-500/10 text-emerald-500">✓ Conectado</span>
                  </div>
                  {inst.phoneNumber && <p className="text-xs text-slate-400">{inst.phoneNumber}</p>}
                  <div className="flex items-center gap-2 mt-3 text-emerald-400 text-xs font-black"><ChevronRight size={12} /> Selecionar</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={goBackFromExtract} className="mt-5 flex items-center gap-2 text-slate-400 hover:text-white text-sm font-black uppercase transition-all">
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {extractStep === 2 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 font-black text-sm">2</div>
            <div className="flex-1"><h3 className="text-lg font-black text-white uppercase">Selecionar Grupo</h3><p className="text-sm text-slate-500">WhatsApp: <span className="text-white font-bold">{extInstSelected?.name}</span></p></div>
          </div>
          <div className="relative mb-4">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={extSearch} onChange={e => setExtSearch(e.target.value)} placeholder="Buscar grupo..."
              className="w-full bg-[#0d1117] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-emerald-500 transition-all" />
          </div>
          {loadingGroups ? (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400"><Loader2 size={20} className="animate-spin text-emerald-500" /> Carregando grupos...</div>
          ) : filteredExtGroups.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-10 text-center">
              <Users size={32} className="text-slate-500 mx-auto mb-3" /><p className="text-slate-400 text-sm font-bold">Nenhum grupo encontrado</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-2">{filteredExtGroups.length} grupos</p>
              {filteredExtGroups.map(g => {
                const gid = g.groupId || g.id;
                return (
                  <div key={gid} onClick={() => selectExtGroup(g)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/3 cursor-pointer hover:bg-emerald-500/5 hover:border-emerald-500/20 transition-all group">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0"><Users size={15} /></div>
                    <div className="flex-1 min-w-0"><p className="text-white font-black text-sm truncate">{g.name}</p><p className="text-slate-500 text-xs">{g.participantsCount ?? 0} membros</p></div>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-emerald-400 transition-all" />
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => setExtractStep(1)} className="mt-5 flex items-center gap-2 text-slate-400 hover:text-white text-sm font-black uppercase transition-all">
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      )}

      {/* STEP 3 */}
      {extractStep === 3 && (
        <div className="dashboard-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 font-black text-sm">3</div>
            <div><h3 className="text-lg font-black text-white uppercase">Destino</h3><p className="text-sm text-slate-500">Como deseja salvar os contatos?</p></div>
          </div>

          {/* Group summary */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 mb-6 flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Users size={22} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black truncate">{extGroupName}</p>
              <p className="text-slate-400 text-sm">{extInstSelected?.name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-black text-emerald-400">{extGroupCount}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase">membros</p>
            </div>
          </div>

          {/* Exclude admins */}
          <label className="flex items-center gap-3 cursor-pointer bg-[#060b16] border border-white/5 rounded-xl p-4 mb-5">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${extFilterAdmin ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'}`}
              onClick={() => setExtFilterAdmin(!extFilterAdmin)}>
              {extFilterAdmin && <span className="text-white text-xs font-black">✓</span>}
            </div>
            <div>
              <p className="text-sm font-black text-white">Excluir administradores</p>
              <p className="text-xs text-slate-500">Remove admins do resultado</p>
            </div>
          </label>

          {/* Action */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div onClick={() => setExtAction('download')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${extAction === 'download' ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/10 hover:border-emerald-500/30 hover:bg-white/3'}`}>
              <Download size={20} className={`mb-2 ${extAction === 'download' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <p className="text-white font-black text-sm">Baixar CSV</p>
              <p className="text-slate-500 text-xs mt-0.5">Arquivo para download imediato</p>
            </div>
            <div onClick={() => setExtAction('save')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${extAction === 'save' ? 'border-blue-500 bg-blue-500/5' : 'border-white/10 hover:border-blue-500/30 hover:bg-white/3'}`}>
              <Database size={20} className={`mb-2 ${extAction === 'save' ? 'text-blue-400' : 'text-slate-500'}`} />
              <p className="text-white font-black text-sm">Salvar em Lista</p>
              <p className="text-slate-500 text-xs mt-0.5">Salva para reutilizar depois</p>
            </div>
          </div>

          {extAction === 'save' && (
            <div className="bg-[#060b16] border border-white/5 rounded-xl p-5 mb-5 space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Salvar em:</p>
              <select value={extTargetListId} onChange={e => setExtTargetListId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-all">
                <option value="">— Criar nova lista —</option>
                {lists.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l._count?.contacts ?? 0} contatos)</option>
                ))}
              </select>
              {!extTargetListId && (
                <input value={extNewListName} onChange={e => setExtNewListName(e.target.value)}
                  placeholder="Nome da nova lista..."
                  className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-all" />
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setExtractStep(2)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-white font-black text-sm uppercase hover:bg-white/5 transition-all">
              <ArrowLeft size={14} /> Voltar
            </button>
            <button onClick={handleExtract} disabled={extracting}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all">
              {extracting
                ? <><Loader2 size={14} className="animate-spin" /> Processando...</>
                : extAction === 'download'
                  ? <><Download size={14} /> Baixar CSV</>
                  : <><Database size={14} /> Salvar na Lista</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'detail' && selectedList) return (
    <div className="animate-fade-in space-y-6">
      <div className="dashboard-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 pointer-events-none" />
        <div className="relative z-10">
          <button onClick={() => { setView('lists'); loadLists(); }}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-black uppercase mb-3 transition-all">
            <ArrowLeft size={12} /> Listas de Contatos
          </button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedList.name}</h2>
              <p className="text-slate-500 text-sm mt-1">{contactsTotal} contatos</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase cursor-pointer border border-white/10 transition-all">
                {importingCSV ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Importar CSV
                <input type="file" accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />
              </label>
              <button onClick={handleExportList}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase border border-white/10 transition-all">
                <Download size={13} /> Exportar
              </button>
              <button onClick={() => startExtract({ targetListId: selectedList.id, action: 'save', originListId: selectedList.id })}
                className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-xl font-black text-xs uppercase border border-emerald-500/20 transition-all">
                <Users size={13} /> Adicionar de Grupo
              </button>
            </div>
          </div>
        </div>
      </div>

      {error   && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-sm font-bold"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-sm font-bold"><CheckCircle2 size={16} /> {success}</div>}

      <div className="dashboard-card">
        {loadingContacts ? (
          <div className="flex items-center justify-center py-12 gap-3 text-slate-400"><Loader2 size={20} className="animate-spin text-emerald-500" /> Carregando...</div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16">
            <Users size={40} className="text-slate-700 mx-auto mb-4" strokeWidth={1} />
            <p className="text-slate-500 font-black text-sm uppercase">Lista vazia</p>
            <p className="text-slate-600 text-xs mt-2">Importe um CSV ou adicione membros de um grupo</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest pb-3 w-12">#</th>
                    <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest pb-3">Telefone</th>
                    <th className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest pb-3">Nome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {contacts.map((c, i) => (
                    <tr key={c.id} className="hover:bg-white/3 transition-all">
                      <td className="py-3 text-slate-600 text-xs">{(contactsPage - 1) * 50 + i + 1}</td>
                      <td className="py-3 text-white font-mono text-sm">{c.phoneNumber}</td>
                      <td className="py-3 text-slate-400 text-sm">{c.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {contactsTotal > 50 && (
              <div className="flex justify-center items-center gap-3 pt-5 border-t border-white/5">
                <button onClick={() => fetchContacts(selectedList.id, contactsPage - 1)} disabled={contactsPage <= 1}
                  className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-white/5 border border-white/10 disabled:opacity-30">Anterior</button>
                <span className="text-xs text-slate-500">{contactsPage} / {Math.ceil(contactsTotal / 50)}</span>
                <button onClick={() => fetchContacts(selectedList.id, contactsPage + 1)} disabled={contactsPage * 50 >= contactsTotal}
                  className="px-4 py-2 text-xs font-black uppercase rounded-lg bg-white/5 border border-white/10 disabled:opacity-30">Próximo</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // LISTS VIEW (default)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in space-y-6">
      <div className="dashboard-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">
              📋 Listas de Contatos
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">Listas de Contatos</h2>
            <p className="text-slate-400 text-sm mt-1">Gerencie suas listas e extraia membros de grupos</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => startExtract()}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase border border-white/10 transition-all">
              <Users size={14} /> Extrair de Grupo
            </button>
            <button onClick={() => { setShowCreate(true); setError(''); setSuccess(''); }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-500/20 transition-all">
              <Plus size={14} /> Nova Lista
            </button>
          </div>
        </div>
      </div>

      {error   && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-sm font-bold"><AlertCircle size={16} /> {error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-400 text-sm font-bold"><CheckCircle2 size={16} /> {success}</div>}

      {showCreate && (
        <div className="dashboard-card">
          <h3 className="text-sm font-black text-white uppercase mb-4">Nova Lista</h3>
          <div className="flex gap-3">
            <input value={newListName} onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createList()} autoFocus
              placeholder="Nome da lista..."
              className="flex-1 bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500 transition-all" />
            <button onClick={createList} disabled={creating || !newListName.trim()}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-black text-sm uppercase transition-all">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
            </button>
            <button onClick={() => { setShowCreate(false); setNewListName(''); }}
              className="px-4 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {loadingLists ? (
        <div className="dashboard-card flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 size={24} className="animate-spin text-emerald-500" /> Carregando listas...
        </div>
      ) : lists.length === 0 ? (
        <div className="dashboard-card text-center py-20">
          <FileSpreadsheet size={48} className="text-slate-700 mx-auto mb-4" strokeWidth={1} />
          <p className="text-slate-400 font-black text-sm uppercase mb-2">Nenhuma lista ainda</p>
          <p className="text-slate-600 text-xs mb-6">Crie uma lista ou extraia membros de um grupo WhatsApp</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => startExtract()}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase border border-white/10 transition-all">
              <Users size={14} /> Extrair de Grupo
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all">
              <Plus size={14} /> Nova Lista
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map(list => (
            <div key={list.id}
              className="dashboard-card cursor-pointer hover:border-emerald-500/30 transition-all group border border-white/5"
              onClick={() => openDetail(list)}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-emerald-400" />
                </div>
                <button onClick={e => { e.stopPropagation(); deleteList(list); }}
                  className="text-slate-700 hover:text-rose-400 transition-all p-1 rounded-lg hover:bg-rose-500/10">
                  <Trash2 size={14} />
                </button>
              </div>
              <h3 className="text-white font-black text-sm uppercase truncate mb-1">{list.name}</h3>
              {list.description && <p className="text-slate-600 text-xs truncate mb-2">{list.description}</p>}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                <div>
                  <span className="text-2xl font-black text-emerald-400">{list._count?.contacts ?? 0}</span>
                  <span className="text-slate-600 text-xs ml-1.5">contatos</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 group-hover:text-emerald-400 text-xs font-black transition-all">
                  Ver <ChevronRight size={12} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactListsManager;
