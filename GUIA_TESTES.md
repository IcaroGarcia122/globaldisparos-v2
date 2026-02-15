# 🧪 GUIA DE TESTES - GLOBAL DISPAROS

## ✅ PRÉ-REQUISITOS

- ✅ Backend rodando em `http://localhost:3001`
- ✅ Frontend rodando em `http://localhost:5173`
- ✅ PostgreSQL conectado e rodando
- ✅ Supabase configurado (ou backend-only)
- ✅ Conta Supabase com email e senha

---

## 🔐 TESTE 1: LOGIN

### Passo 1: Acessar página de login
```bash
http://localhost:5173/auth
```

### Passo 2: Inserir credenciais
- Email: (sua conta Supabase)
- Senha: (sua senha)

### Passo 3: Verificar esperado
✅ **Sucesso esperado:**
- Tela de carregamento "Sincronizando..."
- Redirecionamento para `/dashboard` (VIP)
- Sidebar com "GLOBAL DISPAROS"
- Nome do usuário no sidebar

❌ **Erros comuns:**
- "Acesso não autorizado" → Conta não tem role
- "E-mail ou senha inválidos" → Credenciais erradas
- Fica carregando → Backend não respondendo

### Debug
```javascript
// No console do navegador
localStorage.getItem('token') // Deve ter um JWT
localStorage.getItem('user') // Deve ter objeto com email
```

---

## 🔗 TESTE 2: CONECTAR WHATSAPP

### Passo 1: No Dashboard VIP
- Clique no botão **"Conectar WhatsApp"** (topo direito)
- Modal "Gerenciar Conexões WhatsApp" deve abrir

### Passo 2: Criar Instância
Modal deve mostrar:
1. **Nome da Instância** (obrigatório)
   - Exemplo: "Meu WhatsApp Principal"
2. **Idade da Conta** (em dias)
   - 0 = Conta nova
   - 30 = Um mês
   - 180 = 6 meses

✅ **Teste:**
- Preencha nome: "Test Instance"
- Idade: 30
- Clique "Criar Instância"

### Passo 3: Verificar criação
✅ **Sucesso esperado:**
- Mensagem "Sucesso! Instância criada com sucesso"
- Modal fecha automaticamente
- Novo form aparece: "Conectar WhatsApp" com botão "Gerar QR Code"

❌ **Erros:**
- "Você precisa fazer login primeiro" → Token não salvou
- Erro 401 → Backend retusou requisição
- Erro 500 → Problema no servidor

### Passo 4: Gerar QR Code
- Clique "Gerar QR Code"
- Aguarde 5-10 segundos

✅ **Sucesso esperado:**
- Loading animado: "Gerando QR Code..."
- QR Code em base64 renderizado
- Instruções: "WhatsApp → Aparelhos Conectados → Conectar Aparelho"

### Passo 5: Conectar com WhatsApp
1. Abra WhatsApp no seu celular
2. Vá para **Configurações → Aparelhos Conectados → Conectar Aparelho**
3. Escaneie o QR Code com a câmera

✅ **Sucesso esperado:**
- QR desaparece
- Checkmark verde: "WhatsApp Conectado!"
- Modal fecha automaticamente
- Status no topo muda para "Conectado"
- Número de telefone é salvo

---

## 📤 TESTE 3: CRIAR CAMPANHA

### Passo 1: Acessar "Disparador Elite"
- Na sidebar, clique em **"Disparador Elite"**
- Você deve ver: "Envio / Disparador Elite"

### Passo 2: Criar Nova Campanha
- Clique em botão **"Nova Campanha"** (vermelho, topo direito)
- Form deve aparecer com:
  1. **Nome da Campanha**
  2. **Instância WhatsApp** (select)
  3. **Mensagem** (textarea)

### Passo 3: Preencher formulário
```
Nome: "Teste de Campanha"
Instância: [Selecionar a instância criada antes]
Mensagem: "Olá {name}, teste de mensagem 👋"
```

### Passo 4: Criar campanha
- Clique "Criar Campanha"

✅ **Sucesso esperado:**
- Form desaparece
- Seção "Campanhas Recentes" aparece
- Campanha listada com:
  - Nome
  - Mensagem (truncada)
  - Status: "Rascunho"
  - Contador: Enviadas: 0 | Falhas: 0 | Total: 0

❌ **Erros:**
- "Preencha todos os campos" → Falta preencher algo
- "Erro ao criar campanha" → Problema no backend

---

## 📊 TESTE 4: VERIFICAR BANCO DE DADOS

### Via pgAdmin ou psql:

```sql
-- Ver usuários
SELECT id, email, role, plan FROM users;

-- Ver instâncias
SELECT id, userId, name, phoneNumber, status FROM whatsapp_instances;

-- Ver campanhas
SELECT id, userId, instanceId, name, status FROM campaigns;

-- Ver atividades
SELECT id, userId, action, level, details FROM activity_logs
ORDER BY createdAt DESC LIMIT 10;
```

---

## 🔍 TESTE 5: VERIFICAR LOGS

### Backend Logs
```bash
cd backend
npm run dev

# Procure por mensagens como:
# ✅ Instância XXX criada
# QR Code gerado para instância XXX
# ✅ Instância XXX conectada! Número: +5511999999999
# ✅ Campanha XXX criada com 0 contatos
```

### Frontend Console
```javascript
// Abrir DevTools (F12) → Console
// Procure por logs tipo:
// "Erro ao carregar instâncias:"
// "useBackendAuth: sincronizando..."
// "CampaignDispatcher: campanhas carregadas"
```

---

## 🚨 TROUBLESHOOTING

### Problema: "401 Unauthorized"
```javascript
// Verificar no console
localStorage.getItem('token')
// Se vazio: fazer logout e login novamente
localStorage.clear()
```

### Problema: Instância não salva
```bash
# Backend
SELECT * FROM whatsapp_instances WHERE userId = 'seu-user-id';

# Se vazio: verificar logs do backend
npm run dev > logs.txt 2>&1
```

### Problema: QR Code não aparece
```bash
# Verificar se diretório auth_sessions existe
ls -la backend/auth_sessions/

# Se não existir, backend criará automaticamente
```

### Problema: Timeout ao gerar QR
```javascript
// O polling está tentando 40 vezes (60 segundos)
// Se timeout, tente novamente com outra instância
```

---

## 📋 CHECKLIST DE TESTES

### Autenticação
- [ ] Consigo fazer login com minha conta
- [ ] Token é salvo no localStorage
- [ ] Dashboard VIP carrega corretamente
- [ ] Posso fazer logout

### WhatsApp
- [ ] Consigo criar uma instância
- [ ] QR Code é gerado
- [ ] Consigo conectar com WhatsApp
- [ ] Status muda para "Conectado"
- [ ] Número de celular é salvo

### Campanhas
- [ ] Consigo criar uma campanha
- [ ] Campanha aparece na lista
- [ ] Modalido formulário é limpo após criar
- [ ] Múltiplas campanhas podem ser criadas

### Database
- [ ] Usuário está no `users`
- [ ] Instância está em `whatsapp_instances`
- [ ] Campanha está em `campaigns`
- [ ] Logs estão em `activity_logs`

### API
- [ ] GET /health retorna 200
- [ ] GET /api/auth/me retorna usuário
- [ ] POST /api/instances cria instância
- [ ] GET /api/instances retorna instâncias
- [ ] POST /api/campaigns cria campanha
- [ ] GET /api/campaigns retorna campanhas

---

## 📞 PRÓXIMOS TESTES (APÓS IMPLEMENTAR)

Quando implementar o envio de mensagens:
- [ ] Consigo clicar "Iniciar" em uma campanha
- [ ] Mensagens começam a ser enviadas
- [ ] Progresso é atualizado em tempo real
- [ ] Quando completar, status muda para "Concluído"
- [ ] Contagem de enviadas/falhas é atualizada

---

## 🎯 RESULTADO ESPERADO

Ao final de todos os testes, você deve ter:

1. ✅ Conta sincronizada entre Supabase e Backend
2. ✅ Uma instância WhatsApp conectada
3. ✅ Uma campanha criada e pronta para envio
4. ✅ Todos os dados salvos no PostgreSQL
5. ✅ Logs de todas as ações

Se tudo passar, **o MVP está 70% funcional** e pronto para:
- Importação de contatos
- Envio de mensagens em volume
- Gerenciamento de campanhas

---

**Última atualização**: 13/02/2025
**Versão**: MVP 0.1

