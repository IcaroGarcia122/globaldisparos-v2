import React, { useState, useEffect, useCallback } from 'react';
import { fetchAPI } from '@/config/api';
import { Plus, Trash2, QrCode, Phone, CheckCircle2, X, RefreshCw } from 'lucide-react';
import ConnectWhatsApp from '@/components/ConnectWhatsAPP';
import CreateAndConnectInstance from '@/components/CreateAndConnectInstance';
import { initSocket, onInstanceConnected, onInstanceDisconnected } from '@/utils/socketClient';

interface Instance {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'banned';
  connectedAt: string | null;
  accountAge: number;
  createdAt: string;
}

const InstanceManager: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const reloadInstances = useCallback(async () => {
    try {
      const response = await fetchAPI('/instances');
      const data = response?.data || response?.instances || response || [];
      const list = Array.isArray(data) ? data : [];
      setInstances(list);
      // Atualiza selectedInstance se existir
      setSelectedInstance(prev => {
        if (!prev) return list.length > 0 ? list[0] : null;
        const updated = list.find((i: Instance) => i.id === prev.id);
        return updated || prev;
      });
      return list;
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregamento inicial
  useEffect(() => {
    reloadInstances();
  }, [reloadInstances]);

  // Socket para eventos em tempo real
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) return;

    initSocket(token);

    onInstanceConnected((data) => {
      setInstances(prev => prev.map(i =>
        String(i.id) === String(data.instanceId)
          ? { ...i, status: 'connected', phoneNumber: data.phoneNumber || i.phoneNumber }
          : i
      ));
      setSelectedInstance(prev =>
        prev && String(prev.id) === String(data.instanceId)
          ? { ...prev, status: 'connected', phoneNumber: data.phoneNumber || prev.phoneNumber }
          : prev
      );
      showNotification('success', '✅ WhatsApp conectado com sucesso!');
      setShowQRModal(false);
    });

    onInstanceDisconnected((data) => {
      setInstances(prev => prev.map(i =>
        String(i.id) === String(data.instanceId) ? { ...i, status: 'disconnected' } : i
      ));
    });
  }, []);

  // Polling a cada 8s para manter status atualizado
  useEffect(() => {
    const interval = setInterval(reloadInstances, 8000);
    return () => clearInterval(interval);
  }, [reloadInstances]);

  const deleteInstance = async (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja remover esta instância?')) return;
    setDeleting(true);
    try {
      await fetchAPI(`/instances/${instanceId}`, { method: 'DELETE' });
      showNotification('success', '✅ Instância removida com sucesso!');
      if (selectedInstance?.id === instanceId) {
        setSelectedInstance(null);
        setShowQRModal(false);
      }
      await reloadInstances();
    } catch (error: any) {
      showNotification('error', `❌ Erro ao deletar: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'connected') return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
    if (status === 'connecting') return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    if (status === 'banned') return 'bg-rose-500/20 text-rose-500 border-rose-500/30';
    return 'bg-slate-500/20 text-slate-500 border-slate-500/30';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'connected') return '✅ Conectado';
    if (status === 'connecting') return '⏳ Conectando';
    if (status === 'banned') return '🚫 Banido';
    return '❌ Desconectado';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não conectado';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // Tela de criação
  if (showCreate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setShowCreate(false)}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
            <X size={20} /> Voltar
          </button>
          <CreateAndConnectInstance
            onSuccess={async () => {
              await reloadInstances();
              setShowCreate(false);
              showNotification('success', '✅ Instância criada e conectada!');
            }}
            onBack={() => setShowCreate(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Toast */}
        {notification && (
          <div className={`fixed top-6 right-6 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest z-50 animate-in fade-in slide-in-from-top-4 duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
              Instâncias WhatsApp
            </h1>
            <p className="text-slate-400">Gerencie suas instâncias do WhatsApp</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => reloadInstances()}
              className="border border-white/10 text-slate-400 hover:text-white px-4 py-3 rounded-xl transition-all">
              <RefreshCw size={18} />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
              <Plus size={18} /> Nova Instância
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-1">
            <div className="dashboard-card sticky top-6">
              <h2 className="text-lg font-black text-white uppercase mb-4">
                Suas Instâncias ({instances.length}/3)
              </h2>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin text-emerald-500 text-2xl">⏳</div>
                  <p className="text-slate-400 mt-2 text-sm">Carregando...</p>
                </div>
              ) : instances.length === 0 ? (
                <div className="text-center py-8">
                  <QrCode size={32} className="text-slate-600 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-400 text-sm">Nenhuma instância criada</p>
                  <button onClick={() => setShowCreate(true)}
                    className="mt-3 text-xs text-brand-400 underline hover:text-brand-300">
                    Criar agora
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {instances.map((instance) => (
                    <button key={instance.id} onClick={() => { setSelectedInstance(instance); setShowQRModal(false); }}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedInstance?.id === instance.id
                          ? 'bg-brand-500/20 border-brand-500/50 shadow-lg shadow-brand-500/20'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-white text-sm truncate">{instance.name}</h3>
                          {instance.phoneNumber
                            ? <p className="text-emerald-500 text-xs font-bold flex items-center gap-1 mt-1"><Phone size={12} />{instance.phoneNumber}</p>
                            : <p className="text-slate-500 text-xs mt-1">Sem número</p>
                          }
                        </div>
                        <span className={`text-xs font-black px-2 py-1 rounded border shrink-0 ml-2 ${getStatusColor(instance.status)}`}>
                          {instance.status === 'connected' ? '✅' : instance.status === 'connecting' ? '⏳' : '❌'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detalhes */}
          <div className="lg:col-span-2 space-y-6">
            {selectedInstance ? (
              <>
                <div className="dashboard-card">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-white uppercase mb-2">{selectedInstance.name}</h2>
                      <p className="text-slate-400 text-sm flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${selectedInstance.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        {getStatusLabel(selectedInstance.status)}
                      </p>
                    </div>
                    <button onClick={(e) => deleteInstance(e, selectedInstance.id)} disabled={deleting}
                      className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 border border-rose-500/30 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50">
                      <Trash2 size={16} /> {deleting ? 'Removendo...' : 'Remover'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Número</p>
                      <p className="text-white font-bold">{selectedInstance.phoneNumber || 'Não conectado'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Idade da Conta</p>
                      <p className="text-white font-bold">{selectedInstance.accountAge} dias</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Criada em</p>
                      <p className="text-white font-bold text-sm">{formatDate(selectedInstance.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Conectada em</p>
                      <p className="text-white font-bold text-sm">{formatDate(selectedInstance.connectedAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Botão QR / Status conectado */}
                {selectedInstance.status !== 'connected' ? (
                  <div className="dashboard-card">
                    <button onClick={() => setShowQRModal(!showQRModal)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95">
                      <QrCode size={18} />
                      {showQRModal ? 'Esconder QR Code' : 'Gerar QR Code'}
                    </button>

                    {showQRModal && (
                      <div className="mt-6">
                        <ConnectWhatsApp
                          instanceId={selectedInstance.id}
                          onConnected={() => {
                            reloadInstances();
                            setShowQRModal(false);
                            showNotification('success', '✅ WhatsApp conectado com sucesso!');
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="dashboard-card bg-emerald-500/10 border-emerald-500/20">
                    <div className="flex items-center gap-4">
                      <CheckCircle2 size={32} className="text-emerald-500" />
                      <div>
                        <h3 className="font-black text-emerald-500 text-lg">Conectado!</h3>
                        <p className="text-emerald-400 text-sm">Instância está conectada ao WhatsApp</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="dashboard-card text-center py-16">
                <QrCode size={48} className="text-slate-600 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-black text-white uppercase mb-2">Selecione uma Instância</h3>
                <p className="text-slate-400 text-sm">Clique em uma instância na lista para ver detalhes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstanceManager;