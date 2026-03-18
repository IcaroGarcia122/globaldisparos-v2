import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, Shield, Crown } from 'lucide-react';
import { fetchAPI } from '@/config/api';

const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPanelSelector, setShowPanelSelector] = useState(false);
  const navigate = useNavigate();

  // Se já está autenticado com token válido, redireciona
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      try {
        const userData = JSON.parse(user);
        // Se é admin@gmail.com e role é admin, mostrar seletor
        if (userData.email === 'admin@gmail.com' && userData.role === 'admin') {
          setShowPanelSelector(true);
          return;
        }
        // Caso contrário, navegar baseado no role
        if (userData.role === 'admin') {
          navigate('/admin');
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

      // SE é admin@gmail.com E role === admin: mostrar seletor
      if (backendData.user.email === 'admin@gmail.com' && backendData.user.role === 'admin') {
        setShowPanelSelector(true);
      } else {
        // Redirecionar baseado no role
        if (backendData.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError('E-mail ou senha inválidos.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  // SE showPanelSelector, renderizar o seletor
  if (showPanelSelector) {
    const user = localStorage.getItem('user');
    const userData = user ? JSON.parse(user) : null;

    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-lg relative z-10">
          <div className="bg-[#1c2433] border border-white/5 p-10 rounded-[2.5rem]">
            <h1 className="text-2xl font-black text-white text-center mb-2 uppercase italic tracking-tighter">
              Selecione o Painel
            </h1>
            <p className="text-slate-500 text-sm text-center mb-10">
              Escolha qual painel você deseja acessar
            </p>

            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Admin Button */}
              <button
                onClick={() => navigate('/admin')}
                className="group relative overflow-hidden rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-950 to-slate-950 p-6 transition-all duration-300 hover:border-brand-400 hover:shadow-lg hover:shadow-brand-500/20 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative z-10 flex flex-col items-center">
                  <Shield size={32} className="text-brand-400 mb-3" />
                  <h3 className="text-white font-black text-sm uppercase tracking-wider">
                    Painel Admin
                  </h3>
                  <p className="text-slate-600 text-xs mt-2 text-center">
                    Gerenciar sistema
                  </p>
                </div>
              </button>

              {/* VIP Button */}
              <button
                onClick={() => navigate('/dashboard')}
                className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950 to-slate-950 p-6 transition-all duration-300 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative z-10 flex flex-col items-center">
                  <Crown size={32} className="text-emerald-400 mb-3" />
                  <h3 className="text-white font-black text-sm uppercase tracking-wider">
                    Painel VIP
                  </h3>
                  <p className="text-slate-600 text-xs mt-2 text-center">
                    Disparos WhatsApp
                  </p>
                </div>
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setShowPanelSelector(false);
                setEmail('');
                setPassword('');
              }}
              className="w-full text-slate-600 hover:text-slate-400 text-xs font-black uppercase tracking-widest transition-colors py-2"
            >
              Não é você? Fazer logout
            </button>
          </div>
        </div>
      </div>
    );
  }

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

            <p className="text-center text-slate-600 text-xs mt-4">
              <a href="/forgot-password" className="text-slate-500 hover:text-brand-400 font-bold transition-colors">
                Esqueci minha senha
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;