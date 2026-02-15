import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: "Rodrigo Silva",
      role: "E-commerce Owner",
      content: "O Global Disparos mudou o jogo do meu checkout. Recupero 40% mais carrinhos abandonados de forma 100% automática agora.",
      avatar: "https://picsum.photos/id/64/100/100"
    },
    {
      name: "Ana Carla",
      role: "Consultora de Vendas",
      content: "A extração de leads do Google Maps é bizarra. Em um dia consegui mais contatos qualificados que em um mês de anúncios.",
      avatar: "https://picsum.photos/id/65/100/100"
    },
    {
      name: "Marcos Vinícius",
      role: "Agência de Marketing",
      content: "Uso em todos os meus clientes de lançamento. A facilidade de gerenciar múltiplos números em uma só tela é única.",
      avatar: "https://picsum.photos/id/66/100/100"
    }
  ];

  const sectionRef = useScrollReveal();

  return (
    <section className="py-24 max-w-7xl mx-auto px-4" ref={sectionRef}>
      <div className="text-center mb-16 scroll-hidden">
        <h2 className="text-3xl md:text-5xl font-bold mb-4 italic">Quem usa, <span className="text-emerald-500">aprova</span>.</h2>
        <p className="text-slate-400">Junte-se a mais de 15.000 empreendedores que escalaram seus negócios.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {testimonials.map((t, idx) => (
          <div key={idx} className="scroll-hidden glass-card p-8 rounded-3xl relative overflow-hidden group" style={{ transitionDelay: `${idx * 100}ms` }}>
            <div className="absolute top-0 right-0 opacity-10 group-hover:rotate-12 transition-transform">
                <svg className="w-24 h-24 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V11M14.017 21H11.017C10.4647 21 10.017 20.5523 10.017 20V15C10.017 14.4477 10.4647 14 11.017 14H14.017M3.017 21L3.017 18C3.017 16.8954 3.91243 16 5.017 16H8.017C8.56928 16 9.017 15.5523 9.017 15V9C9.017 8.44772 8.56928 8 8.017 8H4.017C3.46472 8 3.017 8.44772 3.017 9V11M3.017 21H0.017C-0.535282 21 -1.017 20.5523 -1.017 20V15C-1.017 14.4477 -0.535282 14 0.017 14H3.017" />
                </svg>
            </div>
            <div className="flex items-center gap-4 mb-6 relative">
              <img src={t.avatar} alt={t.name} className="w-14 h-14 rounded-full border-2 border-emerald-500/50" />
              <div>
                <h4 className="font-bold text-white">{t.name}</h4>
                <p className="text-xs text-slate-500 uppercase tracking-widest">{t.role}</p>
              </div>
            </div>
            <p className="text-slate-300 italic relative">"{t.content}"</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;
