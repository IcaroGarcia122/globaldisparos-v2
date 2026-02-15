import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { fetchAPI } from '@/config/api';

const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Se já está autenticado com token válido, redireciona
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      try {
        const userData = JSON.parse(user);
        if (userData.role === 'admin') {
          navigate('/painel-selector');
        } else {
          navigate('/dashboard');
        }
      } catch (err) {
        // Token inválido, deixa na página de login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Tentar login no backend
      const backendData = await fetchAPI('/auth/login', {
        method: 'POST',
        body: { email, password }
      });

      // Salvar token e dados do backend
      localStorage.setItem('token', backendData.token);
      localStorage.setItem('user', JSON.stringify(backendData.user));

      // Redirecionar baseado no role
      if (backendData.user.role === 'admin') {
        navigate('/painel-selector');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError('E-mail ou senha inválidos.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md relative z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest mb-6 transition-colors"
        >
          <ArrowLeft size={12} />
          Voltar ao site
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase leading-tight flex flex-col text-center">
            <span className="text-white">GLOBAL</span>
            <span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>

        <div className="bg-[#1c2433] border border-white/5 p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl">
          <h1 className="text-xl sm:text-2xl font-black text-white text-center mb-1.5 uppercase italic tracking-tighter">
            Acessar Painel
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm text-center mb-6 sm:mb-8 font-medium">
            Entre com suas credenciais para acessar o sistema.
          </p>

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl sm:rounded-2xl pl-11 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-5 text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Senha
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#060b16] border border-white/5 rounded-xl sm:rounded-2xl pl-11 sm:pl-14 pr-12 sm:pr-14 py-3.5 sm:py-5 text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700"
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
              <p className="text-rose-500 text-[10px] sm:text-xs font-black text-center uppercase tracking-widest">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-xl shadow-brand-500/30 disabled:opacity-50 active:scale-95"
            >
              {loading ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
