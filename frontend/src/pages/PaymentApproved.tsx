import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { fetchAPI } from '@/config/api';

const planMap: Record<string, { label: string; enum: string }> = {
  mensal: { label: 'Mensal — R$ 69,90', enum: 'basic' },
  trimestral: { label: 'Trimestral — R$ 149,90', enum: 'pro' },
  anual: { label: 'Anual — R$ 299,90', enum: 'enterprise' },
};

const PaymentApproved: React.FC = () => {
  const [searchParams] = useSearchParams();
  const planSlug = searchParams.get('plan') || 'mensal';
  const plan = planMap[planSlug] || planMap.mensal;

  const [step, setStep] = useState<'info' | 'form'>('info');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      // Cria conta no backend
      const response = await fetchAPI('/auth/register', {
        method: 'POST',
        body: {
          email,
          password,
          fullName: email.split('@')[0],
          plan: plan.enum,
        }
      });

      // Login automático
      if (response.token && response.user) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));

        // Aguarda um momento antes de redirecionar
        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      }
    } catch (err: any) {
      if (err.message?.includes('já cadastrado') || err.message?.includes('already')) {
        setError('Este email já possui uma conta. Faça login na página inicial.');
      } else {
        setError(err.message || 'Erro ao criar conta');
      }
      setLoading(false);
    }
  };

  if (step === 'info') {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-sm sm:max-w-md relative z-10 text-center">
          <div className="flex flex-col items-center mb-8">
            <div className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase leading-tight flex flex-col text-center">
              <span className="text-white">GLOBAL</span>
              <span className="gradient-text-blue -mt-1">DISPAROS</span>
            </div>
          </div>

          <div className="bg-[#1c2433] border border-white/5 p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 rounded-2xl sm:rounded-3xl flex items-center justify-center text-emerald-500 mb-5 mx-auto border border-emerald-500/20 shadow-2xl shadow-emerald-500/20">
              <CheckCircle size={32} className="sm:hidden" />
              <CheckCircle size={40} className="hidden sm:block" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tighter mb-2">
              Pagamento Aprovado!
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
              Plano <span className="text-emerald-400 font-bold">{plan.label}</span> confirmado. Crie sua conta para acessar o painel VIP.
            </p>

            <button
              onClick={() => setStep('form')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 active:scale-95"
            >
              Criar Minha Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase leading-tight flex flex-col text-center">
            <span className="text-white">GLOBAL</span>
            <span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>

        <div className="bg-[#1c2433] border border-white/5 p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-500 mb-5 mx-auto border border-emerald-500/20">
            <CheckCircle size={24} className="sm:hidden" />
            <CheckCircle size={28} className="hidden sm:block" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white text-center mb-1.5 uppercase italic tracking-tighter">
            Criar sua Conta VIP
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm text-center mb-6 sm:mb-8 font-medium">
            Defina seu email e senha de acesso ao painel.
          </p>

          <form onSubmit={handleCreateAccount} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl sm:rounded-2xl pl-11 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-5 text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Criar Senha</label>
              <div className="relative">
                <Lock size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl sm:rounded-2xl pl-11 sm:pl-14 pr-12 sm:pr-14 py-3.5 sm:py-5 text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-rose-500 text-[10px] sm:text-xs font-black text-center uppercase tracking-widest">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Ativar Acesso VIP'
              )}
            </button>
          </form>

          <p className="text-center text-slate-600 text-[10px] sm:text-xs mt-5 font-medium">
            Já tem uma conta?{' '}
            <button
              onClick={() => navigate('/auth')}
              className="text-brand-500 hover:text-brand-400 font-bold transition-colors"
            >
              Faça login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentApproved;
