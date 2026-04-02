import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User } from 'lucide-react';
import { fetchAPI } from '@/config/api';

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise',
  mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual',
};

const PLAN_ENUM: Record<string, string> = {
  mensal: 'pro', trimestral: 'enterprise', anual: 'enterprise',
  basic: 'basic', pro: 'pro', enterprise: 'enterprise',
};

const PaymentApproved: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token    = searchParams.get('token');
  const planSlug = searchParams.get('plan') || 'mensal';
  const ref      = searchParams.get('ref');
  const navigate = useNavigate();

  const [validating, setValidating] = useState(!!(token || ref));
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [validPlan, setValidPlan]   = useState(planSlug);

  // Form
  const [step,         setStep]         = useState<'info' | 'form'>('info');
  const [fullName,     setFullName]      = useState('');
  const [email,        setEmail]         = useState('');
  const [password,     setPassword]      = useState('');
  const [showPassword, setShowPassword]  = useState(false);
  const [error,        setError]         = useState('');
  const [loading,      setLoading]       = useState(false);

  // Validar acesso ao carregar — via token (link por email) ou via ref (redirect IronPay)
  useEffect(() => {
    if (token) {
      // Fluxo token: link gerado pelo admin ou webhook
      fetchAPI(`/auth/validate-payment-token/${token}`)
        .then(data => {
          setTokenValid(true);
          setValidPlan(data.plan || planSlug);
          setValidating(false);
        })
        .catch(err => {
          setTokenError(err?.message || 'Link inválido ou expirado.');
          setTokenValid(false);
          setValidating(false);
        });
    } else if (ref) {
      // Fluxo ref: redirect da IronPay — valida no servidor (ref nunca fica exposto no frontend)
      fetchAPI('/auth/validate-payment-ref', { method: 'POST', body: { ref, plan: planSlug } })
        .then(data => {
          setTokenValid(true);
          setValidPlan(data.plan || planSlug);
          setValidating(false);
        })
        .catch(() => {
          setTokenError('Acesso não autorizado. Esta página só pode ser acessada após a compra.');
          setTokenValid(false);
          setValidating(false);
        });
    } else {
      // Sem token nem ref
      setTokenError('Acesso não autorizado. Esta página só pode ser acessada após a compra.');
      setTokenValid(false);
      setValidating(false);
    }
  }, [token, ref]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Senha mínima de 6 caracteres.'); return; }
    setLoading(true); setError('');

    try {
      const planEnum = PLAN_ENUM[validPlan] || 'pro';
      const response = await fetchAPI('/auth/register', {
        method: 'POST',
        body: { email, password, fullName: fullName || email.split('@')[0], plan: planEnum },
      });

      if (response.token && response.user) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));

        // Marcar token como usado
        if (token) {
          fetchAPI(`/auth/invite/${token}`, { method: 'POST', body: { email, password, fullName } }).catch(() => {});
        }

        setTimeout(() => navigate('/dashboard'), 500);
      }
    } catch (err: any) {
      if (err.message?.includes('já cadastrado') || err.message?.includes('already')) {
        setError('Este email já possui conta. Faça login na página inicial.');
      } else {
        setError(err.message || 'Erro ao criar conta');
      }
      setLoading(false);
    }
  };

  // Loading da validação
  if (validating) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-emerald-500" />
    </div>
  );

  // Acesso negado (ref ou token inválido)
  if (!tokenValid) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto mb-5">
          <AlertCircle size={28} />
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Link Inválido</h1>
        <p className="text-slate-400 text-sm mb-6">{tokenError}</p>
        <p className="text-slate-500 text-xs">Se você acabou de comprar, entre em contato com o suporte.</p>
      </div>
    </div>
  );

  // Tela inicial
  if (step === 'info') return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="w-full max-w-md relative z-10 text-center">
        <div className="flex flex-col items-center mb-8">
          <div className="text-3xl font-black italic tracking-tighter uppercase leading-tight flex flex-col text-center">
            <span className="text-white">GLOBAL</span>
            <span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>
        <div className="bg-[#1c2433] border border-white/5 p-8 rounded-[2rem] shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-5 mx-auto border border-emerald-500/20 shadow-xl shadow-emerald-500/20">
            <CheckCircle size={32} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Pagamento Aprovado!</h1>
          <p className="text-slate-400 text-sm mb-2">
            Plano <span className="text-emerald-400 font-bold">{PLAN_LABELS[validPlan] ?? validPlan}</span> confirmado.
          </p>
          <p className="text-slate-500 text-xs mb-8">Crie sua conta abaixo para acessar o painel.</p>
          <button onClick={() => setStep('form')}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 active:scale-95">
            Criar Minha Conta
          </button>
        </div>
      </div>
    </div>
  );

  // Formulário de cadastro
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="text-3xl font-black italic tracking-tighter uppercase leading-tight flex flex-col text-center">
            <span className="text-white">GLOBAL</span>
            <span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>
        <div className="bg-[#1c2433] border border-white/5 p-8 rounded-[2rem] shadow-2xl">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 mb-5 mx-auto border border-emerald-500/20">
            <CheckCircle size={24} />
          </div>
          <h1 className="text-xl font-black text-white text-center mb-1 uppercase italic tracking-tighter">Criar Conta VIP</h1>
          <p className="text-slate-500 text-xs text-center mb-6">Plano <span className="text-emerald-400 font-bold">{PLAN_LABELS[validPlan] ?? validPlan}</span> · Defina seu email e senha de acesso.</p>

          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nome</label>
              <div className="relative">
                <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl pl-11 pr-4 py-4 text-white text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl pl-11 pr-4 py-4 text-white text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Criar Senha</label>
              <div className="relative">
                <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required minLength={6}
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl pl-11 pr-12 py-4 text-white text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-all">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {error && <p className="text-rose-400 text-xs font-bold flex items-center gap-2"><AlertCircle size={12} />{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 active:scale-95 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" />Criando...</> : 'Ativar Acesso VIP'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-5">
            Já tem conta?{' '}
            <button onClick={() => navigate('/auth')} className="text-emerald-400 hover:text-emerald-300 font-bold transition-all">Fazer login</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentApproved;