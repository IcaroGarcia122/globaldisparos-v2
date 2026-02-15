import React from 'react';

interface NavbarProps {
  scrolled: boolean;
  onEnterPanel: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ scrolled, onEnterPanel }) => {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#060b16]/95 backdrop-blur-xl py-4 border-b border-white/5 shadow-lg shadow-brand-500/5' : 'bg-transparent py-8'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center overflow-visible py-2">
          <div className="text-3xl font-black italic tracking-tighter uppercase select-none leading-tight flex flex-col pr-12 overflow-visible">
            <span className="text-white">GLOBAL</span>
            <span className="gradient-text-blue -mt-1">DISPAROS</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
          <a 
            href="#home" 
            onClick={(e) => scrollToSection(e, 'home')}
            className="hover:text-brand-400 transition-all hover:tracking-[0.5em] focus:text-white"
          >
            Início
          </a>
          <a 
            href="#features" 
            onClick={(e) => scrollToSection(e, 'features')}
            className="hover:text-brand-400 transition-all hover:tracking-[0.5em] focus:text-white"
          >
            Recursos
          </a>
          <a 
            href="#achievements" 
            onClick={(e) => scrollToSection(e, 'achievements')}
            className="hover:text-brand-400 transition-all hover:tracking-[0.5em] focus:text-white"
          >
            Metas
          </a>
          <a 
            href="#pricing" 
            onClick={(e) => scrollToSection(e, 'pricing')}
            className="hover:text-brand-400 transition-all hover:tracking-[0.5em] focus:text-white"
          >
            Preços
          </a>
        </div>

        <div className="flex items-center">
          <button 
            onClick={onEnterPanel}
            className="group relative bg-brand-600 text-white px-10 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-brand-500/40 border border-brand-500/30 overflow-hidden hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="relative z-10 flex items-center gap-2">
              Painel VIP
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
