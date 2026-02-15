import React, { useState } from 'react';
import { fetchAPI } from '@/config/api';
import { Plus, Loader2, AlertCircle } from 'lucide-react';

interface CreateInstanceProps {
  onSuccess?: () => void;
}

const CreateInstance: React.FC<CreateInstanceProps> = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [accountAge, setAccountAge] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Você precisa fazer login primeiro');
        setLoading(false);
        return;
      }

      const instance = await fetchAPI('/instances', {
        method: 'POST',
        body: { name, accountAge }
      });

      setSuccess(true);
      setName('');
      setAccountAge(30);

      // Callback para notificar sucesso
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      setError(error.message || 'Erro ao criar instância. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl text-center">
        <h2 className="text-xl font-black text-white mb-4 uppercase">Sucesso!</h2>
        <p className="text-slate-400 text-sm">Instância criada com sucesso. Atualizando...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1c2433] border border-white/5 p-6 rounded-2xl">
      <h2 className="text-xl font-black text-white mb-4 uppercase">Nova Instância WhatsApp</h2>

      <form onSubmit={handleCreateInstance} className="space-y-4">
        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
            Nome da Instância
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Meu WhatsApp Principal"
            className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">
            Idade da Conta (dias)
          </label>
          <input
            type="number"
            value={accountAge}
            onChange={(e) => setAccountAge(parseInt(e.target.value) || 30)}
            min="0"
            max="365"
            className="w-full bg-[#060b16] border border-white/5 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all"
            disabled={loading}
          />
          <p className="text-xs text-slate-600 mt-1">
            Usado para calcular limites anti-ban (0 = conta nova)
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3">
            <AlertCircle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
            <p className="text-rose-500 text-sm font-medium">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Criando Instância...
            </>
          ) : (
            <>
              <Plus size={16} />
              Criar Instância
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateInstance;