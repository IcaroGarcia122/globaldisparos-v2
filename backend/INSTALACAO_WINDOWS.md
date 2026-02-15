# 🚀 GUIA DE INSTALAÇÃO - WINDOWS

## 📋 Pré-requisitos

### 1. Node.js
- Baixe e instale: https://nodejs.org/ (versão LTS 18 ou superior)
- Após instalar, abra o PowerShell/CMD e verifique:
  ```bash
  node --version
  npm --version
  ```

### 2. PostgreSQL
- Baixe: https://www.postgresql.org/download/windows/
- Durante a instalação:
  - Senha: anote bem (vai precisar no .env)
  - Porta: 5432 (padrão)
  - Crie um database chamado `whatsapp_saas`

#### Criar Database pelo pgAdmin:
1. Abra pgAdmin
2. Conecte no servidor local
3. Clique direito em "Databases" → "Create" → "Database"
4. Nome: `whatsapp_saas`
5. Salve

### 3. Git (Opcional, mas recomendado)
- Baixe: https://git-scm.com/download/win

### 4. VS Code (Recomendado)
- Baixe: https://code.visualstudio.com/

## 🔧 PASSO A PASSO - INSTALAÇÃO

### PASSO 1: Preparar o projeto

1. **Extraia os arquivos do backend** em uma pasta, exemplo:
   ```
   C:\Projects\whatsapp-saas-backend
   ```

2. **Abra o VS Code** nesta pasta:
   - Arquivo → Abrir Pasta → Selecione a pasta do backend
   - Ou pelo terminal: `cd C:\Projects\whatsapp-saas-backend` e `code .`

### PASSO 2: Configurar variáveis de ambiente

1. **Copie o arquivo `.env.example` para `.env`:**
   ```bash
   copy .env.example .env
   ```

2. **Edite o arquivo `.env`** com seus dados:
   ```env
   # Servidor
   NODE_ENV=development
   PORT=3001
   HOST=0.0.0.0

   # PostgreSQL (IMPORTANTE - COLOQUE SUA SENHA)
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=whatsapp_saas
   DB_USER=postgres
   DB_PASSWORD=SUA_SENHA_AQUI   # ← Coloque a senha do PostgreSQL
   DB_DIALECT=postgres

   # JWT (GERE UMA CHAVE SEGURA)
   JWT_SECRET=mude_isso_por_uma_chave_aleatoria_super_segura
   JWT_EXPIRES_IN=7d

   # Diggion (preencha depois quando tiver os dados)
   DIGGION_WEBHOOK_SECRET=
   DIGGION_PRODUCT_ID=

   # Admin padrão (será criado no setup)
   ADMIN_EMAIL=admin@seusite.com
   ADMIN_PASSWORD=Admin@123456

   # Frontend (quando subir o frontend, vai estar nessa porta)
   FRONTEND_URL=http://localhost:5173

   # Deixe o resto como está
   ```

### PASSO 3: Instalar dependências

No terminal do VS Code (Terminal → New Terminal):

```bash
npm install
```

Aguarde a instalação de todas as dependências (pode demorar alguns minutos).

### PASSO 4: Compilar TypeScript

```bash
npm run build
```

### PASSO 5: Rodar o servidor

**MODO DESENVOLVIMENTO (recomendado para testes):**
```bash
npm run dev
```

**MODO PRODUÇÃO:**
```bash
npm start
```

### ✅ Verificação

Se tudo deu certo, você verá:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🚀 WHATSAPP SAAS BACKEND - RODANDO!               ║
║                                                           ║
║  Ambiente: development                                   ║
║  Servidor: http://0.0.0.0:3001                          ║
║  Frontend: http://localhost:5173                        ║
║                                                           ║
║  ✅ Baileys integrado com sistema anti-ban               ║
║  ✅ PostgreSQL conectado                                 ║
║  ✅ WebSocket ativo                                      ║
║  ✅ Cron jobs agendados                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### 🧪 Testar API

Abra o navegador ou Postman:
```
http://localhost:3001/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "2026-02-12T...",
  "uptime": 123.45
}
```

## 📱 FRONTEND (Projeto React)

### PASSO 1: Preparar frontend

1. Navegue até a pasta do frontend:
   ```bash
   cd C:\Projects\project-relocate-main
   ```

2. Instale dependências:
   ```bash
   npm install
   ```

### PASSO 2: Configurar URL do backend

Edite o arquivo que faz chamadas à API (geralmente em `src/config` ou similar) e configure:

```typescript
const API_URL = 'http://localhost:3001/api';
```

### PASSO 3: Rodar frontend

```bash
npm run dev
```

Frontend estará em: `http://localhost:5173`

## 🔗 Integração Frontend ↔ Backend

### Endpoints principais para o frontend chamar:

**Login:**
```javascript
POST http://localhost:3001/api/auth/login
Body: {
  "email": "admin@seusite.com",
  "password": "Admin@123456"
}
```

**Criar instância WhatsApp:**
```javascript
POST http://localhost:3001/api/instances
Headers: { Authorization: 'Bearer TOKEN_JWT' }
Body: {
  "name": "WhatsApp Principal",
  "accountAge": 30
}
```

**Obter QR Code:**
```javascript
GET http://localhost:3001/api/instances/:id/qr
Headers: { Authorization: 'Bearer TOKEN_JWT' }
```

## 🐛 Resolução de Problemas

### Erro: "Cannot connect to PostgreSQL"
- Verifique se o PostgreSQL está rodando (pesquise "Services" no Windows, procure por PostgreSQL)
- Confirme usuário, senha e database no .env
- Teste conexão pelo pgAdmin

### Erro: "Port 3001 already in use"
- Mude a porta no .env: `PORT=3002`
- Ou mate o processo: `npx kill-port 3001`

### Erro: "MODULE_NOT_FOUND"
- Rode novamente: `npm install`
- Delete `node_modules` e `package-lock.json`, rode `npm install` de novo

### Frontend não conecta no backend
- Verifique se o backend está rodando
- Confirme CORS configurado corretamente (já está no código)
- Verifique console do navegador (F12) por erros

## 🎯 Próximos Passos

1. ✅ Backend rodando
2. ✅ Frontend rodando
3. 🔄 Conecte uma instância WhatsApp (escaneie QR Code)
4. 🔄 Crie uma lista de contatos
5. 🔄 Importe contatos via CSV
6. 🔄 Crie uma campanha
7. 🔄 Inicie o disparo (sistema anti-ban vai gerenciar automaticamente!)

## 📞 Suporte

Em caso de dúvidas:
- Verifique logs no terminal (mensagens de erro detalhadas)
- Console do navegador (F12) para erros do frontend
- Arquivo `logs/` (se configurado)

## 🎉 Pronto!

Seu SaaS WhatsApp está rodando localmente com:
- ✅ Sistema anti-ban profissional
- ✅ Baileys integrado
- ✅ PostgreSQL
- ✅ JWT autenticação
- ✅ WebSocket real-time
- ✅ Dashboard completo

---

**Desenvolvido para testes locais. Para produção (VPS), consulte DEPLOY_VPS.md**
