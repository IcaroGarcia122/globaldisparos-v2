═════════════════════════════════════════════════════════════
✅ QR CODE FIX - RESUMO EXECUTIVO
═════════════════════════════════════════════════════════════

PROBLEMA
────────
Frontend criava instância mas NÃO chamava o endpoint de conexão
que retorna o QR Code da Evolution API.
Resultado: QR Code nunca era exibido.

SOLUÇÃO IMPLEMENTADA
────────────────────
✅ frontend/src/components/CreateInstance.tsx
   - handleCreateInstance() agora:
     1. POST /instances (criar)
     2. POST /instances/:id/connect (obter QR) ← NOVO
     3. Extrai connectResponse.qrCode
     4. Normaliza para data URL
     5. setQRCode() para renderizar

✅ backend/src/routes/instances.ts (POST /:id/connect)
   - Executa whatsappService.connect() em background
   - Aguarda 2s pelo QR Code ser salvo no banco
   - Retorna { success: true, qrCode: "base64..." }
   - Se falhar, retorna 503 com mensagem clara

✅ backend/src/adapters/EvolutionAdapter.ts
   - Extrai QR de response.data.base64 (Evolution real)
   - Normaliza para data:image/png;base64,...
   - Salva no banco com instance.update()
   - Fallback com QR dummy em development

═════════════════════════════════════════════════════════════
ARQUIVOS MODIFICADOS
═════════════════════════════════════════════════════════════

1️⃣ frontend/src/components/CreateInstance.tsx
   → Função: handleCreateInstance()
   → Adicionado: ~50 linhas de código
   → Efeito: Frontend agora busca e exibe QR

2️⃣ backend/src/routes/instances.ts  
   → Rota: POST /:id/connect
   → Melhorado: Melhor tratamento de erros
   → Efeito: Backend retorna QR Code com sucesso

3️⃣ backend/src/adapters/EvolutionAdapter.ts
   → Classes: connect(), getQRCodeFromAPI()
   → Melhorado: Extração robusta de QR, fallback
   → Efeito: QR Code é extraído e salvo corretamente

═════════════════════════════════════════════════════════════
COMO TESTAR
═════════════════════════════════════════════════════════════

TESTE 1: Backend via cURL (se Evolution estiver rodando)
──────────────────────────────────────────────────────────

# 1. Registrar/Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@globaldisparos.com","password":"Admin123!@#"}'

TOKEN=$(resposta do login vai aqui)

# 2. Criar instância
curl -X POST http://localhost:3001/api/instances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","accountAge":30}'

INSTANCE_ID=146  # colocar o ID retornado acima

# 3. Conectar e obter QR
curl -X POST http://localhost:3001/api/instances/$INSTANCE_ID/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

Esperado:
{
  "success": true,
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "message": "QR Code gerado. Escaneie com seu WhatsApp"
}

TESTE 2: Frontend via navegador
────────────────────────────────

1. Navegar para http://localhost:5173/
2. Login com credenciais
3. Clique em "Criar Instância"
4. Preencha: Nome e Idade da Conta
5. Clique em "Criar Instância"
6. Aguarde ~2-3 segundos
7. ✅ QR Code PNG deve aparecer na tela

Se não aparecer:
1. Abrir F12 (Developer Tools)
2. Aba "Console"
3. Procurar por "✅ QR Code obtido"
4. Se não aparecer, ver qual erro apareceu
5. Tomar screenshot e compartilhar

TESTE 3: Monitoramento com console
────────────────────────────────────

1. F12 → Console
2. Cole conteúdo de: debug-console.js
3. Clique em "Criar Instância"
4. Observe todos os logs de API

Esperado na console:
━━━━━━━━━━━━━━━━━━━━
✅ Monitoramento de API iniciado!

(preenche formulário)

🚀 FORM SUBMITTED
📡 [API CALL] POST /api/instances
📤 Body: {"name":"Test","accountAge":30}
📥 Status: 201
📥 Response: {id: 146, name: "Test", ...}

✅ Instância criada: {id: 146, ...}

🔗 Chamando POST /instances/146/connect...
📡 [API CALL] POST /api/instances/146/connect
📥 Status: 200
📥 Response: {success: true, qrCode: "data:image/...", ...}

📱 Resposta do connect: {success: true, ...}
✅ QR Code obtido de connectResponse.qrCode
✅ QR Code normalizado, exibindo na tela
━━━━━━━━━━━━━━━━━━━━

═════════════════════════════════════════════════════════════
CHECKLIST DE VERIFICAÇÃO
═════════════════════════════════════════════════════════════

BACKEND (terminal npm run dev)
☐ Sem erros de compilação TypeScript
☐ Servidor escutando em http://localhost:3001
☐ Logs mostram "[CONNECT] Iniciando para instância 146"
☐ Logs mostram "[CONNECT] QR Code obtido? true"

FRONTEND (http://localhost:5173)
☐ Login bem-sucedido
☐ Formulário de criar instância aparece
☐ Click em "Criar Instância" não retorna erro
☐ "⏳ Gerando QR Code..." aparece por ~2s
☐ QR Code PNG (256x256) é renderizado
☐ Console mostra: "✅ QR Code obtido de connectResponse.qrCode"

INTEGRATION (tudo junto)
☐ Criar instância via frontend
☐ QR Code aparece
☐ GET /api/instances retorna qrCode não-null
☐ Novo evento Socket.IO não quebra nada (fallback ok)

═════════════════════════════════════════════════════════════
TROUBLESHOOTING
═════════════════════════════════════════════════════════════

❌ "QR Code não encontrado na resposta"
   → Backend não está retornando qrCode
   → Verificar: EvolutionAdapter.getQRCodeFromAPI()
   → Verified console do backend para erros

❌ "base64 puro" no console
   → Está recebendo base64 sem "data:image/..."
   → Frontend está normalizando corretamente
   → Imagem deveria renderizar

❌ QR não aparece mesmo com logs corretos
   → Problema no JSX de renderização
   → Verificar: {qrLoading && !connectedMessage}
   → <img src={qrCode} /> está renderizando?

❌ 503 Service Unavailable
   → Evolution API não está rodando
   → Iniciar: docker-compose up -d
   → Ou usar mock: node evolution-api-mock-server.js

═════════════════════════════════════════════════════════════
COMMITS / MUDANÇAS
═════════════════════════════════════════════════════════════

Arquivo: frontend/src/components/CreateInstance.tsx
Função: handleCreateInstance (linha ~186)
Linhas adicionadas: ~45
Linhas removidas: ~5
Delta: +40 net

Arquivo: backend/src/routes/instances.ts
Função: POST /:id/connect (linha ~476)
Linhas modificadas: ~15
Delta: melhor tratamento de erros

Arquivo: backend/src/adapters/EvolutionAdapter.ts
Função: getQRCodeFromAPI (linha ~198)
Linhas modificadas: ~10
Delta: melhor fallback

═════════════════════════════════════════════════════════════
