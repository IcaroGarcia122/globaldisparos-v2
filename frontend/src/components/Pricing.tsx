import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const Pricing: React.FC = () => {
  const plans = [
    {
      name: 'PLANO MENSAL',
      price: 'R$ 69,90',
      period: '/mês',
      features: ['1 Número de WhatsApp', 'Disparos Ilimitados', 'Autoresponder Básico', 'Importação de Contatos', 'Suporte Via Chat'],
      recommended: false,
      cta: 'ASSINAR AGORA',
      delay: '0ms',
      link: 'https://go.diggion.com.br/h6g2fyssbt'
    },
    {
      name: 'PLANO TRIMESTRAL',
      price: 'R$ 149,90',
      period: '/mês',
      features: ['3 Números de WhatsApp', 'CRM Multi-agente', 'Chatbot Avançado', 'Extrator de Leads Maps', 'Webhook API', 'Suporte Prioritário'],
      recommended: true,
      cta: 'MAIS VENDIDO',
      delay: '200ms',
      link: 'https://go.diggion.com.br/evlzb'
    },
    {
      name: 'PLANO ANUAL',
      price: 'R$ 299,90',
      period: '/ano',
      features: ['10 Números de WhatsApp', 'White Label', 'Painel Gerencial', 'Consultoria de Escala', 'API de Integração Total', 'Gerente de Contas'],
      recommended: false,
      cta: 'PLANO ANUAL',
      delay: '400ms',
      link: 'https://go.diggion.com.br/qyu5l'
    }
  ];

  const sectionRef = useScrollReveal();

  return (
    <section id="pricing" className="py-32 relative overflow-hidden" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20 scroll-hidden">
          <h2 className="text-4xl md:text-6xl font-black mb-6 uppercase italic tracking-tighter text-white">
            Planos que <span className="gradient-text-blue italic pr-8">escalam seu negócio</span>
          </h2>
          <p className="text-slate-500 font-medium">O ecossistema definitivo para quem busca volume e resultados exponenciais.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-20">
          {plans.map((plan, idx) => {
            const isTrimensal = plan.name === 'PLANO TRIMESTRAL';
            
            return (
              <div 
                key={idx} 
                className="scroll-hidden relative group"
                style={{ transitionDelay: `${idx * 150}ms` }}
              >
                {plan.recommended && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-brand-600 font-black text-[10px] uppercase tracking-[0.3em] px-8 py-3 rounded-full shadow-2xl z-[30] border border-brand-500/10">
                    RECOMENDADO
                  </div>
                )}

                <div className={`h-full transition-all duration-500 flex flex-col ${isTrimensal ? 'trail-container scale-105 shadow-[0_40px_100px_rgba(255,255,255,0.08)]' : 'bg-[#1c2433] border border-white/5 hover:border-brand-500/20 shadow-2xl rounded-[3.5rem]'}`}>
                  <div className={`trail-inner p-12 rounded-[3.5rem] flex flex-col h-full ${isTrimensal ? 'bg-brand-600' : 'bg-[#1c2433]'}`}>
                    
                    <div className="mb-12">
                      <h3 className={`text-sm font-black italic uppercase mb-4 tracking-[0.2em] ${plan.recommended ? 'text-white/80' : 'text-slate-500'}`}>
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl md:text-5xl font-[950] text-white italic tracking-tighter">{plan.price}</span>
                        <span className={`text-xs font-bold uppercase tracking-widest ${plan.recommended ? 'text-brand-100/60' : 'text-slate-600'}`}>
                          {plan.period}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-6 mb-12">
                      {plan.features.map((feature, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-4 group/item">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.recommended ? 'bg-white/20' : 'bg-brand-500/10'}`}>
                            <svg className={`w-3 h-3 ${plan.recommended ? 'text-white' : 'text-brand-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className={`text-[13px] font-bold tracking-tight ${plan.recommended ? 'text-white' : 'text-slate-400'}`}>
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <a href={plan.link} target="_blank" rel="noopener noreferrer" className={`block w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all transform hover:-translate-y-1 active:scale-95 shadow-xl text-center ${plan.recommended ? 'bg-white text-brand-600 hover:bg-slate-100' : 'bg-brand-600 text-white hover:bg-brand-500 shadow-brand-600/20'}`}>
                      {plan.cta}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-4xl mx-auto scroll-hidden" style={{ transitionDelay: '300ms' }}>
          <div className="bg-[#1c2433] rounded-[3rem] p-10 md:p-14 border border-brand-500/20 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden group shadow-2xl blue-glow">
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-brand-500/10 rounded-full blur-[100px] group-hover:bg-brand-500/20 transition-all"></div>
            
            <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 bg-brand-500/10 rounded-[2rem] flex items-center justify-center border border-brand-500/20 shadow-2xl">
              <svg className="w-12 h-12 md:w-16 md:h-16 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            
            <div className="flex-1 text-center md:text-left relative z-10">
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4">Garantia Blindada de 7 Dias</h3>
              <p className="text-slate-400 text-base leading-relaxed mb-6 font-medium">
                Teste o Global Disparos sem riscos. Se em 7 dias você não sentir que sua escala decolou, devolvemos 100% do valor investido. Simples assim.
              </p>
              <div className="text-brand-500 font-black tracking-[0.4em] text-[10px] uppercase italic">Risco Zero • Cancelamento Imediato</div>
            </div>
          </div>
        </div>
        
      </div>
    </section>
  );
};

export default Pricing;
