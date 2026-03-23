import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Gift, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User } from 'lucide-react';
import { fetchAPI } from '@/config/api';

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise',
};

const InvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate   = useNavigate();

  const [invite, setInvite]       = useState<{ plan: string; note: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [validating, setValidating]   = useState(true);

  const [fullName,  setFullName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (!token) { setInviteError('Link inválido.'); setValidating(false); return; }
    fetchAPI(`/auth/invite/${token}`)
      .then(data => { setInvite(data); setValidating(false); })
      .catch(err => { setInviteError(err?.message || 'Link inválido ou expirado.'); setValidating(false); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Senha mínima de 6 caracteres.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetchAPI(`/auth/invite/${token}`, {
        method: 'POST',
        body: { email, password, fullName },
      });
      if (res.token && res.user) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        // Forçar reload para garantir que auth context reconhece o novo token
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao criar conta.');
      setLoading(false);
    }
  };

  // Loading
  if (validating) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-brand-500" />
    </div>
  );

  // Link inválido/expirado
  if (inviteError) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto mb-5">
          <AlertCircle size={28} />
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Link Inválido</h1>
        <p className="text-slate-400 text-sm mb-6">{inviteError}</p>
        <button onClick={() => navigate('/auth')}
          className="text-brand-400 hover:text-brand-300 text-sm font-black uppercase tracking-widest transition-all">
          Ir para o Login →
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-3xl font-black italic tracking-tighter uppercase leading-tight flex flex-col items-center">
            <span className="text-white">GLOBAL</span>
            <span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>

        <div className="bg-[#1c2433] border border-white/5 rounded-[2rem] p-8 shadow-2xl">
          {/* Badge do convite */}
          <div className="flex items-center gap-3 bg-brand-500/10 border border-brand-500/20 rounded-xl p-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 flex-shrink-0">
              <Gift size={18} />
            </div>
            <div>
              <p className="text-white font-black text-sm">Convite de Acesso</p>
              <p className="text-slate-400 text-xs">
                Plano <span className="text-brand-400 font-bold">{PLAN_LABELS[invite!.plan] ?? invite!.plan}</span> liberado para você
                {invite!.note && <span className="text-slate-500"> · {invite!.note}</span>}
              </p>
            </div>
          </div>

          <h1 className="text-xl font-black text-white uppercase tracking-tighter mb-1">Criar sua Conta</h1>
          <p className="text-slate-500 text-sm mb-6">Preencha os dados abaixo para ativar o acesso.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nome completo</label>
              <div className="relative">
                <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl pl-11 pr-4 py-4 text-white text-sm focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl pl-11 pr-4 py-4 text-white text-sm focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700" />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Criar senha</label>
              <div className="relative">
                <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required minLength={6}
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl pl-11 pr-12 py-4 text-white text-sm focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-all">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand-600/20 active:scale-95 flex items-center justify-center gap-2 mt-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Criando conta...</> : 'Ativar Acesso'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-5">
            Já tem conta?{' '}
            <button onClick={() => navigate('/auth')} className="text-brand-400 hover:text-brand-300 font-bold transition-all">
              Fazer login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;