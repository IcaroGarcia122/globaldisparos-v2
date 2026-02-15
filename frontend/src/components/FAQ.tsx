import React, { useState } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const FAQ: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const questions = [
    {
      q: "O Global Disparos causa banimento do meu número?",
      a: "Nossa tecnologia utiliza algoritmos de envio humanizado, respeitando intervalos e limites de segurança. Embora nenhum envio em massa seja 100% livre de riscos, somos a ferramenta com menor taxa de banimento do mercado devido ao nosso sistema exclusivo de 'delay random'."
    },
    {
      q: "Preciso baixar algum programa no computador?",
      a: "Não! O Global Disparos é 100% online (SaaS). Você acessa pelo seu navegador de qualquer lugar do mundo, sem precisar instalar nada pesado no seu PC."
    },
    {
      q: "Funciona para iPhone e Android?",
      a: "Sim! Como o acesso é via navegador e a conexão é via QR Code do WhatsApp, funciona perfeitamente independente do sistema operacional do seu celular."
    },
    {
      q: "Consigo integrar com meu site ou CRM?",
      a: "Com certeza. Temos integração via Webhooks e API REST que permite conectar o Global Disparos a Hotmart, Kiwify, ActiveCampaign, e qualquer outra ferramenta que suporte webhooks."
    },
    {
      q: "Como recebo meu acesso após o pagamento?",
      a: "O envio é imediato. Assim que o pagamento for confirmado (via PIX ou Cartão), você receberá um e-mail com seus dados de login e link da nossa área de membros com tutoriais."
    }
  ];

  const sectionRef = useScrollReveal();

  return (
    <section id="faq" className="py-24 max-w-4xl mx-auto px-4" ref={sectionRef}>
      <div className="text-center mb-16 scroll-hidden">
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Dúvidas Frequentes</h2>
        <p className="text-slate-400">Tudo o que você precisa saber antes de assinar.</p>
      </div>
      
      <div className="space-y-4">
        {questions.map((item, idx) => (
          <div key={idx} className="scroll-hidden glass-card rounded-2xl overflow-hidden border border-white/5" style={{ transitionDelay: `${idx * 80}ms` }}>
            <button 
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full p-6 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="font-bold text-slate-200">{item.q}</span>
              <svg 
                className={`w-6 h-6 text-emerald-500 transition-transform duration-300 ${openIdx === idx ? 'rotate-180' : ''}`} 
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openIdx === idx && (
              <div className="p-6 pt-0 text-slate-400 leading-relaxed border-t border-white/5 bg-slate-900/30">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default FAQ;
