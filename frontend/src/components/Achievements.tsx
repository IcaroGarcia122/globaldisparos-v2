import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const Achievements: React.FC = () => {
  const plaques = [
    {
      title: 'Placa de 10k',
      subtitle: 'Iniciante PRO',
      image: 'https://i.ibb.co/ym0R0PTf/Design-sem-nome-1.png',
      desc: 'Concedida ao atingir 10 mil disparos entregues.',
      color: 'border-slate-400/30'
    },
    {
      title: 'Placa de 100k',
      subtitle: 'Expert Global',
      image: 'https://i.ibb.co/9HNDWPXS/Design-sem-nome.png',
      desc: 'Concedida ao atingir 100 mil disparos entregues.',
      color: 'border-brand-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
    },
    {
      title: 'Placa de 1 Milhão',
      subtitle: 'Lenda das Vendas',
      image: 'https://i.ibb.co/Xx2H9Z6v/Design-sem-nome-2.png',
      desc: 'O ápice da escala. Um milhão de mensagens enviadas.',
      color: 'border-brand-600 shadow-[0_0_40px_rgba(37,99,235,0.3)]'
    }
  ];

  const sectionRef = useScrollReveal();

  return (
    <section id="achievements" className="py-24 relative overflow-hidden" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20 scroll-hidden">
          <div className="inline-block px-6 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6">Recompensas de Elite</div>
          <h2 className="text-4xl md:text-6xl font-black mb-6 italic uppercase tracking-tighter">Nossas <span className="gradient-text-blue">Placas de Metas</span></h2>
          <p className="text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">Premiamos os usuários que dominam o mercado global. Atinja os marcos de envios e receba sua placa exclusiva em sua residência.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {plaques.map((plaque, idx) => (
            <div key={idx} className={`scroll-hidden bg-[#0b1121] p-3 rounded-[3.5rem] border ${plaque.color} transition-all duration-700 hover:-translate-y-6 group cursor-pointer shadow-2xl`} style={{ transitionDelay: `${idx * 150}ms` }}>
              <div className="p-6 rounded-[3rem] overflow-hidden bg-[#1c2433]">
                <div className="overflow-hidden rounded-[2rem] mb-10">
                  <img 
                    src={plaque.image} 
                    alt={plaque.title} 
                    className="w-full aspect-square object-cover group-hover:scale-110 transition-transform duration-1000"
                  />
                </div>
                <div className="px-4 pb-8">
                  <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">{plaque.title}</h3>
                  <div className="text-brand-500 text-[11px] font-black uppercase tracking-[0.3em] mb-6">{plaque.subtitle}</div>
                  <p className="text-slate-400 text-sm leading-relaxed font-medium">{plaque.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Achievements;
