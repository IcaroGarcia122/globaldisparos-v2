import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { fetchAPI } from '@/config/api';

// ── Esqueci minha senha (sem token) ──────────────────────────────────────────
const ForgotPassword: React.FC = () => {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [devLink, setDevLink] = useState('');
  const [error,   setError]   = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetchAPI('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
      if (res._dev_link) setDevLink(res._dev_link); // só em dev
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar. Tente novamente.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-black italic tracking-tighter uppercase flex flex-col items-center">
            <span className="text-white">GLOBAL</span>
            <span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>

        <div className="bg-[#1c2433] border border-white/5 rounded-[2rem] p-8 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-5">
                <CheckCircle size={28} />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Solicitação Enviada</h2>
              <p className="text-slate-400 text-sm mb-6">
                Se este email tiver uma conta cadastrada, você receberá o link de redefinição em instantes. Verifique também sua caixa de spam.
              </p>
              {devLink && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-left">
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">DEV — Clique para redefinir:</p>
                  <a href={devLink} className="text-amber-300 text-xs break-all font-mono hover:underline">{devLink}</a>
                </div>
              )}
              <button onClick={() => navigate('/auth')} className="text-brand-400 hover:text-brand-300 text-sm font-black uppercase tracking-widest transition-all">
                Voltar ao Login →
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mx-auto mb-5">
                <Mail size={20} />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter text-center mb-1">Esqueci minha senha</h2>
              <p className="text-slate-500 text-sm text-center mb-6">Digite seu email para receber o link de redefinição.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com" required
                      className="w-full bg-[#060b16] border border-white/5 rounded-xl pl-11 pr-4 py-4 text-white text-sm focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700" />
                  </div>
                </div>
                {error && <p className="text-rose-400 text-xs font-bold flex items-center gap-2"><AlertCircle size={12} />{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={14} className="animate-spin" />Enviando...</> : 'Enviar Link'}
                </button>
              </form>

              <p className="text-center text-slate-600 text-xs mt-5">
                Lembrou?{' '}
                <button onClick={() => navigate('/auth')} className="text-brand-400 hover:text-brand-300 font-bold transition-all">Fazer login</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Redefinir senha (com token) ───────────────────────────────────────────────
const ResetPassword: React.FC = () => {
  const { token }   = useParams<{ token: string }>();
  const navigate    = useNavigate();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Senhas não coincidem.'); return; }
    if (password.length < 6)  { setError('Mínimo 6 caracteres.'); return; }
    setLoading(true); setError('');
    try {
      await fetchAPI(`/auth/reset-password/${token}`, { method: 'POST', body: { password } });
      setDone(true);
      setTimeout(() => navigate('/auth'), 3000);
    } catch (err: any) {
      setError(err?.message || 'Link inválido ou expirado.');
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-5">
          <CheckCircle size={28} />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Senha Redefinida!</h2>
        <p className="text-slate-400 text-sm">Redirecionando para o login...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-black italic tracking-tighter uppercase flex flex-col items-center">
            <span className="text-white">GLOBAL</span>
            <span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>

        <div className="bg-[#1c2433] border border-white/5 rounded-[2rem] p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mx-auto mb-5">
            <Lock size={20} />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter text-center mb-1">Nova Senha</h2>
          <p className="text-slate-500 text-sm text-center mb-6">Defina sua nova senha de acesso.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nova senha</label>
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
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Confirmar senha</label>
              <div className="relative">
                <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repita a senha" required
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl pl-11 pr-4 py-4 text-white text-sm focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700" />
              </div>
            </div>
            {error && <p className="text-rose-400 text-xs font-bold flex items-center gap-2"><AlertCircle size={12} />{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" />Salvando...</> : 'Redefinir Senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Exporta os dois — App.tsx usa cada um na rota correta
export { ForgotPassword, ResetPassword };
export default ResetPassword;