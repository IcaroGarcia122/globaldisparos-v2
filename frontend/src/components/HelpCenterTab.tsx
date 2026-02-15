import React, { useState } from 'react';
import {
  Search, BookOpen, Zap, MessageCircle, Smartphone, ShieldCheck, Headphones,
  ChevronDown, ChevronUp, X, ArrowRight, RefreshCw, Mail
} from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  icon: React.ReactNode;
  items: FaqItem[];
}

interface CategoryDetail {
  label: string;
  icon: React.ReactNode;
  steps: { title: string; description: string }[];
  ctaLabel?: string;
  ctaAction?: string;
}

const categoryDetails: CategoryDetail[] = [
  {
    label: 'ATUALIZAÇÕES',
    icon: <BookOpen size={24} />,
    steps: [
      { title: 'Versão 2.6 — Delay Inteligente', description: 'Nova engine de delay com variação aleatória para simular comportamento humano.' },
      { title: 'Versão 2.5 — Aquecimento Cloud', description: 'Sistema automatizado de maturação de chip 100% em nuvem.' },
      { title: 'Versão 2.4 — Minerador de Grupos', description: 'Extração de contatos de grupos do WhatsApp com filtros avançados.' },
      { title: 'Versão 2.3 — Multi-Instância', description: 'Suporte a múltiplas sessões WhatsApp simultâneas por conta.' },
    ],
  },
  {
    label: 'PRIMEIROS PASSOS',
    icon: <Zap size={24} />,
    steps: [
      { title: 'Conecte seu WhatsApp', description: 'Vá em Configurações e escaneie o QR Code.' },
      { title: 'Importe seus Contatos', description: 'Carregue sua planilha no disparador.' },
      { title: 'Crie seu Fluxo', description: 'Escreva suas mensagens e anexe mídias.' },
      { title: 'Inicie os Disparos', description: 'Ative a IA Anti-Ban e clique em Iniciar.' },
    ],
    ctaLabel: 'IR PARA O DISPARADOR',
    ctaAction: 'disparo',
  },
  {
    label: 'MINERAR GRUPOS',
    icon: <MessageCircle size={24} />,
    steps: [
      { title: 'Acesse Gestão de Grupos', description: 'No menu lateral, clique em "Gestão de Grupos".' },
      { title: 'Selecione a Instância', description: 'Escolha o WhatsApp conectado para extrair contatos.' },
      { title: 'Escolha os Grupos', description: 'Filtre e selecione os grupos desejados.' },
      { title: 'Exporte os Contatos', description: 'Baixe a lista em XLSX ou adicione direto a uma campanha.' },
    ],
    ctaLabel: 'IR PARA GRUPOS',
    ctaAction: 'grupos',
  },
  {
    label: 'I.A ESTRATEGISTA',
    icon: <Smartphone size={24} />,
    steps: [
      { title: 'Proteção Anti-Ban Automática', description: 'A IA monitora padrões de envio e ajusta delays em tempo real.' },
      { title: 'Variação de Mensagens', description: 'Geração automática de variações para evitar detecção de spam.' },
      { title: 'Horários Inteligentes', description: 'Envio concentrado nos horários de maior abertura e resposta.' },
      { title: 'Análise de Engajamento', description: 'Métricas de conversão e sugestões de otimização por campanha.' },
    ],
  },
  {
    label: 'RECUPERAR CONTA',
    icon: <ShieldCheck size={24} />,
    steps: [
      { title: 'Esqueceu a Senha?', description: 'Acesse a tela de login e clique em "Esqueci minha senha" para receber um link de redefinição.' },
      { title: 'Conta Bloqueada?', description: 'Caso sua conta tenha sido suspensa, entre em contato com o suporte via WhatsApp.' },
      { title: 'Trocar E-mail', description: 'Abra um ticket por e-mail informando o e-mail antigo e o novo desejado.' },
    ],
  },
  {
    label: 'FALAR COM SUPORTE',
    icon: <Headphones size={24} />,
    steps: [
      { title: 'WhatsApp — Resposta Rápida', description: 'Atendimento de Segunda a Sexta, 09h às 18h. Tempo médio: 15 minutos.' },
      { title: 'E-mail — Tickets Detalhados', description: 'Para questões técnicas complexas, envie para suporte@globaldisparos.com.' },
      { title: 'Base de Conhecimento', description: 'Consulte as perguntas frequentes abaixo antes de abrir um chamado.' },
    ],
    ctaLabel: 'CHAMAR NO WHATSAPP',
    ctaAction: 'whatsapp',
  },
];

const helpCategories = categoryDetails.map(c => ({
  label: c.label,
  icon: c.icon,
}));

const faqData: FaqCategory[] = [
  {
    title: 'Disparador e Campanhas',
    icon: <MessageCircle size={20} className="text-emerald-500" />,
    items: [
      {
        question: 'Como criar uma campanha de alta conversão?',
        answer: 'Acesse o Disparador Elite no menu lateral, crie uma nova campanha com um nome descritivo, selecione sua instância WhatsApp conectada, configure a mensagem personalizada com variáveis como {nome} e {telefone}, importe sua lista de contatos e inicie o disparo. Utilize o delay inteligente para maximizar a entrega.'
      },
      {
        question: 'O que é o Modo de Teste?',
        answer: 'O Modo de Teste permite que você envie disparos para até 5 números antes de lançar a campanha completa. Isso garante que a formatação, variáveis e mídia estão corretas antes do envio em massa.'
      },
      {
        question: 'Quais os formatos de arquivo suportados?',
        answer: 'O sistema suporta envio de imagens (JPG, PNG, WebP), vídeos (MP4 até 16MB), documentos (PDF, DOC, XLSX), áudios (MP3, OGG) e figurinhas (WebP). Todos os formatos podem ser combinados com texto na mesma mensagem.'
      },
    ],
  },
  {
    title: 'Gestão de Instâncias',
    icon: <Smartphone size={20} className="text-brand-500" />,
    items: [
      {
        question: 'Posso conectar mais de um WhatsApp?',
        answer: 'Sim! O número de instâncias disponíveis depende do seu plano. No plano Mensal você pode conectar 1 instância, no Trimestral até 3, e no Anual até 5 instâncias simultâneas. Cada instância funciona de forma independente.'
      },
      {
        question: 'Minha instância desconectou, o que fazer?',
        answer: 'Acesse o Painel Geral, clique em "Conectar WhatsApp" e escaneie o QR Code novamente com seu celular. Caso o problema persista, verifique se o WhatsApp está atualizado no celular e se há conexão estável com a internet. Se continuar, entre em contato com o suporte.'
      },
    ],
  },
  {
    title: 'Segurança e Anti-Ban',
    icon: <ShieldCheck size={20} className="text-amber-500" />,
    items: [
      {
        question: 'Como evitar o banimento do meu chip?',
        answer: 'Utilize o sistema de Aquecimento Cloud antes de iniciar campanhas em massa. Configure delays inteligentes entre as mensagens (recomendamos 15-45 segundos), evite enviar mensagens idênticas em massa, utilize variáveis de personalização e não ultrapasse o limite diário recomendado de 500 mensagens por chip novo.'
      },
      {
        question: 'O que é o Delay Inteligente?',
        answer: 'O Delay Inteligente é um sistema que simula o comportamento humano variando automaticamente o intervalo entre cada mensagem enviada. Ele utiliza intervalos aleatórios dentro de uma faixa configurável, reduzindo drasticamente o risco de detecção e banimento pelo WhatsApp.'
      },
    ],
  },
];

interface HelpCenterTabProps {
  onNavigate?: (tab: string) => void;
}

const HelpCenterTab: React.FC<HelpCenterTabProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const toggleItem = (key: string) => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredFaq = faqData
    .map(cat => ({
      ...cat,
      items: cat.items.filter(
        item =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter(cat => cat.items.length > 0);

  const whatsappLink = 'https://wa.me/5511999999999?text=Olá! Preciso de ajuda com o Global Disparos.';

  const activeDetail = categoryDetails.find(c => c.label === openCategory);

  const handleCta = (action?: string) => {
    if (!action) return;
    if (action === 'whatsapp') {
      window.open(whatsappLink, '_blank');
    } else if (onNavigate) {
      onNavigate(action);
    }
  };

  return (
    <div className="animate-fade-in space-y-8 relative">
      {/* Category Modal Overlay */}
      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpenCategory(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-md bg-[#1c2433] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  {activeDetail.icon}
                </div>
                <h3 className="text-base font-black text-white uppercase italic tracking-tighter">
                  {activeDetail.label}
                </h3>
              </div>
              <button
                onClick={() => setOpenCategory(null)}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-4 mb-8">
              {activeDetail.steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 bg-[#0d1117] border border-white/5 rounded-2xl px-5 py-4"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-black shrink-0 mt-0.5 shadow-lg shadow-emerald-500/30">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">{step.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-medium">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            {activeDetail.ctaLabel && (
              <button
                onClick={() => {
                  handleCta(activeDetail.ctaAction);
                  setOpenCategory(null);
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
              >
                {activeDetail.ctaLabel}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="dashboard-card border-brand-500/20">
        <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase px-3 py-1 rounded-md mb-3 inline-block tracking-widest">
          Suporte
        </span>
        <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">
          Central de Ajuda
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">
          Tudo o que você precisa saber para dominar o Global Disparos.
        </p>
      </header>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Search + Categories + FAQ */}
        <div className="lg:col-span-2 space-y-8">
          {/* Search */}
          <div className="dashboard-card">
            <div className="relative">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busque por uma dúvida ou palavra-chave..."
                className="w-full bg-[#0d1117] border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-medium text-white outline-none focus:border-emerald-500/40 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Category cards */}
          {!searchQuery && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {helpCategories.map((cat, i) => (
                <button
                  key={i}
                  onClick={() => setOpenCategory(cat.label)}
                  className="dashboard-card flex flex-col items-center justify-center gap-4 py-8 cursor-pointer transition-all hover:scale-105 active:scale-95 hover:border-emerald-500/30"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                    {cat.icon}
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* FAQ Accordions */}
          <div className="space-y-6">
            {filteredFaq.map((category, catIdx) => (
              <div key={catIdx} className="dashboard-card space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                    {category.icon}
                  </div>
                  <h3 className="text-base font-black text-white italic tracking-tight">
                    {category.title}
                  </h3>
                </div>

                {category.items.map((item, itemIdx) => {
                  const key = `${catIdx}-${itemIdx}`;
                  const isOpen = openItems[key];
                  return (
                    <div
                      key={itemIdx}
                      className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => toggleItem(key)}
                        className="w-full flex items-center justify-between px-6 py-5 text-left group"
                      >
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors pr-4">
                          {item.question}
                        </span>
                        <div className="shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors">
                          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-5 -mt-1">
                          <p className="text-sm text-slate-500 leading-relaxed font-medium">
                            {item.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {filteredFaq.length === 0 && searchQuery && (
              <div className="dashboard-card py-16 flex flex-col items-center gap-4 opacity-40">
                <Search size={48} className="text-slate-600" strokeWidth={1} />
                <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-600 italic">
                  Nenhum resultado encontrado
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Support sidebar */}
        <div className="space-y-8">
          <div className="dashboard-card flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
              <Headphones size={28} />
            </div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-2">
              Ainda com dúvidas?
            </h3>
            <p className="text-slate-500 text-xs font-medium mb-8 leading-relaxed italic">
              Nosso time de especialistas está pronto para te atender de Segunda a Sexta, das 09h às 18h.
            </p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3 mb-4"
            >
              <MessageCircle size={16} />
              Chamar no WhatsApp
            </a>
            <a
              href="mailto:suporte@globaldisparos.com"
              className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center gap-3"
            >
              Abrir Ticket por E-mail
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenterTab;
