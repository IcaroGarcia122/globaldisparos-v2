import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const Footer: React.FC = () => {
  const sectionRef = useScrollReveal();

  return (
    <footer className="bg-[#060b16] border-t border-white/5 pt-24 pb-12" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20 scroll-hidden">
          <div className="md:col-span-2">
            <div className="flex flex-col items-start mb-8 overflow-visible">
              <div className="text-5xl font-black italic tracking-tighter uppercase leading-tight flex flex-col pr-12 overflow-visible">
                <span className="text-white">GLOBAL</span>
                <span className="gradient-text-blue -mt-2">DISPAROS</span>
              </div>
            </div>
            <p className="text-slate-500 max-w-sm mb-10 font-medium leading-relaxed">
              A maior infraestrutura de disparos em massa do Brasil. Tecnologia de ponta para garantir estabilidade e alta conversão em escala global.
            </p>
            <div className="flex gap-4">
               {[1,2,3,4].map(i => (
                 <div key={i} className="w-10 h-10 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center text-slate-500 hover:text-brand-500 hover:border-brand-500/30 transition-all cursor-pointer">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
                 </div>
               ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-black text-white mb-8 uppercase tracking-[0.3em] text-[11px] italic">Ecossistema</h4>
            <ul className="space-y-5 text-slate-500 text-[11px] font-black uppercase tracking-widest">
              <li><a href="#" className="hover:text-brand-400 transition-colors">Recursos Pro</a></li>
              <li><a href="#achievements" className="hover:text-brand-400 transition-colors">Elite Plaques</a></li>
              <li><a href="#pricing" className="hover:text-brand-400 transition-colors">Planos VIP</a></li>
              <li><a href="#" className="hover:text-brand-400 transition-colors">Afiliados</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-black text-white mb-8 uppercase tracking-[0.3em] text-[11px] italic">Governança</h4>
            <ul className="space-y-5 text-slate-500 text-[11px] font-black uppercase tracking-widest">
              <li><a href="#" className="hover:text-brand-400 transition-colors">Termos Elite</a></li>
              <li><a href="#" className="hover:text-brand-400 transition-colors">Privacidade</a></li>
              <li><a href="#" className="hover:text-brand-400 transition-colors">Contrato SaaS</a></li>
              <li><a href="#" className="hover:text-brand-400 transition-colors">Suporte 24/7</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/5 pt-12 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] text-slate-600 font-black uppercase tracking-[0.4em]">
          <p>© 2026 GLOBAL DISPAROS NETWORK. ALL RIGHTS RESERVED.</p>
          <p className="flex items-center gap-3">
            Elite Infrastructure <span className="text-brand-500 animate-pulse text-lg">⚡</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
