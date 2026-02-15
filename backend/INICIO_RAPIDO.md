# ⚡ INÍCIO RÁPIDO - 5 MINUTOS

## 🎯 Checklist Rápido

### ✅ Pré-requisitos
- [ ] Node.js 18+ instalado
- [ ] PostgreSQL instalado e rodando
- [ ] Database `whatsapp_saas` criado

### ⚙️ Configuração (2 min)

1. **Copie .env.example para .env**
   ```bash
   copy .env.example .env
   ```

2. **Edite .env - APENAS estas 3 linhas:**
   ```env
   DB_PASSWORD=SUA_SENHA_POSTGRES_AQUI
   JWT_SECRET=qualquer_texto_aleatorio_longo_aqui
   ADMIN_EMAIL=seu@email.com
   ```

3. **Instale:**
   ```bash
   npm install
   ```

### 🚀 Rodar (1 min)

```bash
npm run dev
```

✅ Pronto! Backend rodando em `http://localhost:3001`

### 🧪 Testar

Abra: `http://localhost:3001/health`

Deve retornar:
```json
{"status":"ok","timestamp":"...","uptime":...}
```

---

## 📱 Conectar Frontend

No frontend, configure a URL da API:

```javascript
const API_URL = 'http://localhost:3001/api';
```

Pronto para usar!

---

## 🎬 Primeiros Passos

### 1. Login (use admin padrão)
```
POST http://localhost:3001/api/auth/login
{
  "email": "admin@seusite.com",  # do .env
  "password": "Admin@123456"     # do .env
}
```

Copie o `token` da resposta.

### 2. Criar instância WhatsApp
```
POST http://localhost:3001/api/instances
Headers: Authorization: Bearer SEU_TOKEN
{
  "name": "Meu WhatsApp",
  "accountAge": 30
}
```

### 3. Conectar (obter QR Code)
```
POST http://localhost:3001/api/instances/INSTANCE_ID/connect
Headers: Authorization: Bearer SEU_TOKEN
```

### 4. Ver QR Code
```
GET http://localhost:3001/api/instances/INSTANCE_ID/qr
Headers: Authorization: Bearer SEU_TOKEN
```

Escaneie com WhatsApp!

---

## 📚 Próximos Passos

- [ ] Leia `README.md` - visão geral completa
- [ ] Leia `DOC_ANTI_BAN.md` - entenda o sistema
- [ ] Leia `API_ENDPOINTS.md` - todos os endpoints
- [ ] Teste criar campanha de disparo
- [ ] Monitore stats anti-ban

---

## ⚠️ Problemas Comuns

**Erro: Cannot connect to PostgreSQL**
→ Verifique senha no .env, database existe?

**Erro: Port 3001 in use**
→ Mude PORT no .env para 3002

**Frontend não conecta**
→ Backend está rodando? CORS configurado (já está)?

---

## 🎉 É isso!

Seu SaaS WhatsApp com sistema anti-ban profissional está rodando!

**Dúvidas?** Consulte as outras documentações:
- `INSTALACAO_WINDOWS.md` - guia detalhado Windows
- `DOC_ANTI_BAN.md` - sistema anti-ban explicado
- `API_ENDPOINTS.md` - referência completa da API
