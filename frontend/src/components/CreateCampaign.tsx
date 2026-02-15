import React, { useState } from 'react';
import { fetchAPI } from '@/config/api';
import { Send, Shield, Clock, Zap, Loader2 } from 'lucide-react';

const CreateCampaign: React.FC = () => {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [contactListId, setContactListId] = useState('');
  const [useAntibanVariations, setUseAntibanVariations] = useState(true);
  const [useAntibanDelays, setUseAntibanDelays] = useState(true);
  const [useCommercialHours, setUseCommercialHours] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const campaign = await fetchAPI('/campaigns', {
        method: 'POST',
        body: {
          instanceId: parseInt(instanceId),
          contactListId: parseInt(contactListId),
          name,
          message,
          useAntibanVariations,
          useAntibanDelays,
          useCommercialHours
        }
      });

      // Iniciar disparo automaticamente
      await fetchAPI(`/campaigns/${campaign.id}/start`, {
        method: 'POST'
      });

      alert('Campanha iniciada com anti-ban ativo!');
      
      // Limpar formulário
      setName('');
      setMessage('');
      setInstanceId('');
      setContactListId('');
      
      window.location.reload();
    } catch (error: any) {
      alert(error.message || 'Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
      <h2 className="text-xl font-black text-white mb-4 uppercase flex items-center gap-2">
        <Send size={24} />
        Nova Campanha
      </h2>

      <form onSubmit={handleCreateCampaign} className="space-y-4">
        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
            Nome da Campanha
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Promoção Black Friday"
            className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all"
            required
          />
        </div>

        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
            Mensagem
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Olá {{nome}}! Hoje é {{dia_semana}}..."
            rows={4}
            className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all resize-none"
            required
          />
          <p className="text-xs text-slate-600 mt-1">
            Use variáveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{data}}'}, {'{{dia_semana}}'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
              Instância WhatsApp
            </label>
            <input
              type="number"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="ID da instância"
              className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
              Lista de Contatos
            </label>
            <input
              type="number"
              value={contactListId}
              onChange={(e) => setContactListId(e.target.value)}
              placeholder="ID da lista"
              className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all"
              required
            />
          </div>
        </div>

        <div className="bg-[#060b16] border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Shield size={16} className="text-brand-500" />
            Sistema Anti-Ban
          </h3>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useAntibanVariations}
              onChange={(e) => setUseAntibanVariations(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-[#1c2433] checked:bg-brand-500"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">4 Variações de Mensagem</p>
              <p className="text-xs text-slate-600">Cada contato recebe uma versão diferente</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useAntibanDelays}
              onChange={(e) => setUseAntibanDelays(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-[#1c2433] checked:bg-brand-500"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Delays Randômicos</p>
              <p className="text-xs text-slate-600">3-45 segundos entre mensagens</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useCommercialHours}
              onChange={(e) => setUseCommercialHours(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-[#1c2433] checked:bg-brand-500"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Horário Comercial</p>
              <p className="text-xs text-slate-600">Apenas entre 9h-21h</p>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Criando e Iniciando...
            </>
          ) : (
            <>
              <Zap size={20} />
              Criar e Iniciar Campanha
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateCampaign;