/**
 * TESTE INTERATIVO: QR CODE
 * 
 * Cole este código no console do navegador (F12)
 * enquanto estiver na página de criar instância
 */

// Monitorar todas as requisições de API
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  
  if (url.includes('/instances')) {
    console.log(`📡 [API CALL] ${args[1]?.method || 'GET'} ${url}`);
    console.log(`📤 Body:`, args[1]?.body);
  }
  
  return originalFetch.apply(this, args).then(response => {
    if (url.includes('/instances')) {
      console.log(`📥 Status: ${response.status}`);
      console.log(`📥 Response:`, response.clone().json());
    }
    return response;
  });
};

// Deixar console.log mais verboso
const loggers = ['log', 'warn', 'error', 'info'];
loggers.forEach(level => {
  const original = console[level];
  console[level] = function(...args) {
    original.call(console, `[${new Date().toLocaleTimeString()}]`, ...args);
  };
});

console.log('✅ Monitoramento de API iniciado!');
console.log('');
console.log('Próximos passos:');
console.log('1. Preencha o formulário');
console.log('2. Clique em "Criar Instância"');
console.log('3. Observe todos os logs abaixo');
console.log('');
const form = document.querySelector('form');
if (form) {
  console.log('✅ Formulário encontrado na página');
  form.addEventListener('submit', (e) => {
    console.log('🚀 FORM SUBMITTED');
  });
} else {
  console.log('❌ Formulário não encontrado');
}
