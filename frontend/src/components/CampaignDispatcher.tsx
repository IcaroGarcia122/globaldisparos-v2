import React, { useState, useEffect } from 'react';
import { fetchAPI } from '@/config/api';
import { Send, Loader2, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import CampaignMonitoring from './CampaignMonitoring';

interface Campaign {
  id: string;
  name: string;
  instanceId: number;
  message: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'running' | 'paused' | 'cancelled';
  sentCount: number;
  failedCount: number;
  totalCount: number;
  createdAt: string;
}

const CampaignDispatcher: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [instances, setInstances] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    instanceId: '',
    groupId: '',
    message: '',
    contactList: null as any,
  });

  useEffect(() => {
    loadInstances();
    loadCampaigns();
  }, []);

  const loadInstances = async () => {
    try {
      const response = await fetchAPI('/instances');
      // API retorna {data: [...], pagination: {...}} ou {instances: [...], pagination: {...}}
      const data = response?.data || response?.instances || response || [];
      setInstances(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar instâncias:', err);
    }
  };

  const loadGroups = async (instanceId: string) => {
    try {
      const data = await fetchAPI(`/groups?instanceId=${instanceId}`);
      const groups = Array.isArray(data?.groups) ? data.groups : (Array.isArray(data) ? data : []);
      setGroups(groups);
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
      setGroups([]);
    }
  };

  const loadCampaigns = async () => {
    try {
      const data = await fetchAPI('/campaigns');
      setCampaigns(data || []);
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.name || !formData.instanceId || !formData.message) {
        setError('Preencha todos os campos obrigatórios');
        setLoading(false);
        return;
      }

      if (!formData.groupId) {
        setError('Selecione um grupo de destino');
        setLoading(false);
        return;
      }

      // Cria a campanha com grupo
      const newCampaign = await fetchAPI('/campaigns', {
        method: 'POST',
        body: {
          name: formData.name,
          instanceId: parseInt(formData.instanceId),
          groupId: formData.groupId,
          message: formData.message,
        },
      });

      // Inicia a campanha
      await fetchAPI(`/campaigns/${newCampaign.id}/start`, {
        method: 'POST',
      });

      setCampaigns([...campaigns, newCampaign]);
      setFormData({ name: '', instanceId: '', message: '', contactList: null, groupId: '' });
      setShowForm(false);
      
      // Mostra o dashboard de monitoramento
      setActiveCampaignId(newCampaign.id);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = (status: string) => {
    const statusConfig: { [key: string]: { color: string; label: string } } = {
      draft: { color: 'text-slate-500', label: 'Rascunho' },
      scheduled: { color: 'text-blue-500', label: 'Agendado' },
      sending: { color: 'text-yellow-500', label: 'Enviando' },
      completed: { color: 'text-emerald-500', label: 'Concluído' },
      failed: { color: 'text-rose-500', label: 'Falhou' },
    };

    const config = statusConfig[status];
    return <span className={`text-xs font-black uppercase ${config.color}`}>{config.label}</span>;
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Dashboard de Monitoramento */}
      {activeCampaignId && (
        <CampaignMonitoring 
          campaignId={activeCampaignId}
          onClose={() => setActiveCampaignId(null)}
        />
      )}

      <header className="dashboard-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="bg-brand-500/10 text-brand-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">
              Envio
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">
              Disparador Elite
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Configure e envie campanhas em massa para WhatsApp
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand-600 hover:bg-brand-500 text-white px-8 md:px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 shadow-2xl shadow-brand-500/20 active:scale-95"
          >
            <Plus size={18} />
            Nova Campanha
          </button>
        </div>
      </header>

      {/* Formulário de Criação */}
      {showForm && (
        <div className="dashboard-card">
          <h2 className="text-xl font-black text-white mb-6 uppercase">Criar Nova Campanha</h2>

          <form onSubmit={handleCreateCampaign} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                  Nome da Campanha
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Promoção Especial Fevereiro"
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                  Instância WhatsApp
                </label>
                <select
                  value={formData.instanceId}
                  onChange={(e) => {
                    setFormData({ ...formData, instanceId: e.target.value, groupId: '' });
                    if (e.target.value) {
                      loadGroups(e.target.value);
                    }
                  }}
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all appearance-none cursor-pointer"
                  required
                >
                  <option value="">Selecionar instância</option>
                  {instances.map((instance) => (
                    <option key={instance.id} value={instance.id}>
                      {instance.name} ({instance.phoneNumber || 'Desconectado'})
                    </option>
                  ))}
                </select>
              </div>

              {formData.instanceId && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                    Grupo de Destino
                  </label>
                  <select
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Selecionar grupo</option>
                    {groups.length > 0 ? (
                      groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.participantCount || 0} membros)
                        </option>
                      ))
                    ) : (
                      <option disabled>Nenhum grupo encontrado</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                Mensagem
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Digite a mensagem que será enviada..."
                className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all min-h-24 resize-none"
                required
              />
              <p className="text-[9px] text-slate-600 mt-1">
                Máx. 4096 caracteres | Use variáveis como &#123;name&#125; para personalizar
              </p>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3">
                <AlertCircle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
                <p className="text-rose-500 text-sm font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-4 pt-6 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-brand-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Criar Campanha
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Campanhas */}
      {campaigns.length > 0 ? (
        <div className="dashboard-card">
          <h2 className="text-xl font-black text-white mb-6 uppercase">Campanhas Recentes</h2>

          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-[#0d1117] border border-white/5 rounded-xl p-4 flex items-center justify-between hover:border-white/10 transition-all"
              >
                <div className="flex-1">
                  <h3 className="font-black text-white text-sm mb-1">{campaign.name}</h3>
                  <p className="text-[9px] text-slate-500 line-clamp-2">{campaign.message}</p>
                  <div className="flex gap-4 mt-2 text-[9px]">
                    <span className="text-slate-600">
                      Enviadas: <span className="text-emerald-500 font-black">{campaign.sentCount}</span>
                    </span>
                    <span className="text-slate-600">
                      Falhas: <span className="text-rose-500 font-black">{campaign.failedCount}</span>
                    </span>
                    <span className="text-slate-600">
                      Total: <span className="text-blue-500 font-black">{campaign.totalCount}</span>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {renderStatus(campaign.status)}
                  <p className="text-[8px] text-slate-600 mt-2">
                    {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="dashboard-card py-20 flex flex-col items-center justify-center gap-4 text-center opacity-40">
          <Send size={48} className="text-slate-600" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-600">
            Nenhuma campanha criada ainda
          </p>
          <p className="text-[10px] text-slate-600">Clique em "Nova Campanha" para começar</p>
        </div>
      )}
    </div>
  );
};

export default CampaignDispatcher;
