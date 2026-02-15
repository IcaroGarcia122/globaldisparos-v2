import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Mail, ArrowLeft } from 'lucide-react';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Credenciais inválidas.');
      setLoading(false);
      return;
    }

    // Check if user is admin
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .eq('role', 'admin');

    if (roleError || !roles || roles.length === 0) {
      await supabase.auth.signOut();
      setError('Acesso negado. Você não é administrador.');
      setLoading(false);
      return;
    }

    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest mb-10 transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar ao site
        </button>

        <div className="bg-[#1c2433] border border-brand-500/20 p-10 rounded-[2.5rem] shadow-2xl blue-glow">
          <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-500 mb-6 mx-auto border border-brand-500/20">
            <Lock size={28} />
          </div>
          <h1 className="text-2xl font-black text-white text-center mb-2 uppercase italic tracking-tighter">
            Admin Panel
          </h1>
          <p className="text-slate-400 text-sm text-center mb-8 font-medium">
            Acesso restrito a administradores.
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  className="w-full bg-[#060b16] border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#060b16] border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-white text-sm font-medium focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-700"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-rose-500 text-xs font-black text-center uppercase tracking-widest">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-brand-500/30 disabled:opacity-50 active:scale-95"
            >
              {loading ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
