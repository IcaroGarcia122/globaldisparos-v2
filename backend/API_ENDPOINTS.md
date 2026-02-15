# 📡 DOCUMENTAÇÃO DA API

Base URL: `http://localhost:3001/api`

## 🔐 Autenticação

Todas as rotas (exceto login/register) requerem token JWT no header:
```
Authorization: Bearer SEU_TOKEN_JWT
```

---

## 🔑 Auth

### POST /auth/register
Registra novo usuário (via página de pagamento aprovado)

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "SenhaSegura123",
  "fullName": "Nome Completo"
}
```

**Response 201:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "fullName": "Nome Completo",
    "role": "user",
    "plan": "free"
  }
}
```

### POST /auth/login
Login

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "SenhaSegura123"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "fullName": "Nome Completo",
    "role": "user",
    "plan": "pro"
  }
}
```

### GET /auth/me
Dados do usuário autenticado

**Headers:** `Authorization: Bearer TOKEN`

**Response 200:**
```json
{
  "id": "uuid",
  "email": "usuario@email.com",
  "fullName": "Nome Completo",
  "role": "user",
  "plan": "pro",
  "planExpiresAt": "2026-03-12T00:00:00Z",
  "isActive": true
}
```

---

## 📱 Instâncias WhatsApp

### POST /instances
Cria nova instância WhatsApp

**Headers:** `Authorization: Bearer TOKEN`

**Body:**
```json
{
  "name": "WhatsApp Principal",
  "accountAge": 30
}
```

**Response 201:**
```json
{
  "id": "instance-uuid",
  "name": "WhatsApp Principal",
  "status": "disconnected",
  "accountAge": 30,
  "createdAt": "2026-02-12T10:00:00Z"
}
```

### GET /instances
Lista todas instâncias do usuário

**Response 200:**
```json
[
  {
    "id": "uuid",
    "name": "WhatsApp Principal",
    "phoneNumber": "5511999999999",
    "status": "connected",
    "accountAge": 30,
    "dailyMessagesSent": 47,
    "totalMessagesSent": 1523,
    "connectedAt": "2026-02-12T09:00:00Z"
  }
]
```

### GET /instances/:id/qr
Obtém QR Code para escanear

**Response 200:**
```json
{
  "qrCode": "data:image/png;base64,iVBORw0KG..."
}
```

### POST /instances/:id/connect
Conecta instância (gera QR Code)

**Response 200:**
```json
{
  "message": "Conectando... Escaneie o QR Code"
}
```

### DELETE /instances/:id
Desconecta e remove instância

**Response 200:**
```json
{
  "message": "Instância desconectada com sucesso"
}
```

---

## 📇 Contatos

### POST /contacts/lists
Cria nova lista de contatos

**Body:**
```json
{
  "name": "Clientes VIP",
  "description": "Lista de clientes premium"
}
```

**Response 201:**
```json
{
  "id": "list-uuid",
  "name": "Clientes VIP",
  "description": "Lista de clientes premium",
  "totalContacts": 0
}
```

### GET /contacts/lists
Lista todas as listas

**Response 200:**
```json
[
  {
    "id": "uuid",
    "name": "Clientes VIP",
    "totalContacts": 150,
    "createdAt": "2026-02-01T00:00:00Z"
  }
]
```

### POST /contacts/import-csv
Importa contatos via CSV

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: arquivo.csv
- `contactListId`: uuid da lista

**CSV Format:**
```csv
nome,telefone,empresa,cidade
João Silva,5511999999999,Acme Inc,São Paulo
Maria Santos,5511888888888,TechCorp,Rio de Janeiro
```

**Response 200:**
```json
{
  "message": "150 contatos importados com sucesso",
  "imported": 150,
  "failed": 0
}
```

### GET /contacts/lists/:id/contacts
Lista contatos de uma lista

**Query params:**
- `page`: número da página (padrão: 1)
- `limit`: itens por página (padrão: 50)

**Response 200:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "name": "João Silva",
      "phoneNumber": "5511999999999",
      "variables": {
        "empresa": "Acme Inc",
        "cidade": "São Paulo"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

---

## 📨 Campanhas

### POST /campaigns
Cria nova campanha

**Body:**
```json
{
  "instanceId": "instance-uuid",
  "contactListId": "list-uuid",
  "name": "Promoção Natal 2026",
  "message": "Olá {{nome}}! Hoje é {{dia_semana}}. Trabalha na {{empresa}}?",
  "scheduledFor": null,
  "useAntibanVariations": true,
  "useAntibanDelays": true,
  "useCommercialHours": true
}
```

**Response 201:**
```json
{
  "id": "campaign-uuid",
  "name": "Promoção Natal 2026",
  "status": "pending",
  "totalContacts": 150,
  "createdAt": "2026-02-12T10:00:00Z"
}
```

### GET /campaigns
Lista campanhas do usuário

**Query params:**
- `status`: pending|running|paused|completed|cancelled

**Response 200:**
```json
[
  {
    "id": "uuid",
    "name": "Promoção Natal 2026",
    "status": "running",
    "totalContacts": 150,
    "messagesSent": 47,
    "messagesFailed": 3,
    "startedAt": "2026-02-12T10:00:00Z"
  }
]
```

### POST /campaigns/:id/start
Inicia campanha

**Response 200:**
```json
{
  "message": "Campanha iniciada com sucesso"
}
```

### POST /campaigns/:id/pause
Pausa campanha

**Response 200:**
```json
{
  "message": "Campanha pausada"
}
```

### POST /campaigns/:id/cancel
Cancela campanha

**Response 200:**
```json
{
  "message": "Campanha cancelada"
}
```

### GET /campaigns/:id/progress
Obtém progresso em tempo real

**Response 200:**
```json
{
  "campaignId": "uuid",
  "status": "running",
  "totalContacts": 150,
  "messagesSent": 47,
  "messagesFailed": 3,
  "messagesRemaining": 100,
  "isPaused": false
}
```

---

## 👥 Grupos

### GET /groups/sync/:instanceId
Sincroniza grupos do WhatsApp

**Response 200:**
```json
{
  "message": "15 grupos sincronizados",
  "groups": [
    {
      "id": "group-uuid",
      "name": "Clientes Premium",
      "participantsCount": 234,
      "groupId": "120363xxx@g.us"
    }
  ]
}
```

### GET /groups/:groupId/participants
Extrai participantes de um grupo

**Response 200:**
```json
{
  "groupId": "uuid",
  "groupName": "Clientes Premium",
  "participants": [
    {
      "phoneNumber": "5511999999999",
      "name": "João Silva",
      "isAdmin": false
    }
  ],
  "total": 234
}
```

### POST /groups/export-to-contacts
Exporta participantes para lista de contatos

**Body:**
```json
{
  "groupId": "group-uuid",
  "contactListId": "list-uuid"
}
```

**Response 200:**
```json
{
  "message": "234 participantes exportados para lista de contatos"
}
```

---

## 📊 Estatísticas

### GET /stats/user
Estatísticas gerais do usuário

**Response 200:**
```json
{
  "totalInstances": 3,
  "connectedInstances": 2,
  "totalCampaigns": 15,
  "runningCampaigns": 2,
  "totalMessagesSent": 5432,
  "totalMessagesFailed": 123,
  "successRate": "97.8%",
  "todayMessages": 234
}
```

### GET /stats/instance/:id
Stats de uma instância específica (com info anti-ban)

**Response 200:**
```json
{
  "instanceId": "uuid",
  "phoneNumber": "5511999999999",
  "accountAge": 30,
  "ageCategory": "medium",
  "dailyLimit": 150,
  "dailyUsed": 47,
  "dailyRemaining": 103,
  "delayRange": "8-20s",
  "errorRate": "2.5%",
  "isPossiblyBanned": false,
  "isCommercialHours": true,
  "totalMessagesSent": 1523,
  "totalMessagesFailed": 38
}
```

### GET /stats/messages/chart
Dados para gráfico de envios (últimos 30 dias)

**Response 200:**
```json
{
  "labels": ["12/01", "13/01", "14/01", ...],
  "sent": [45, 123, 98, ...],
  "failed": [2, 5, 3, ...]
}
```

---

## 🔔 Webhook

### POST /webhook/diggion
Webhook do Diggion (não requer auth, usa secret)

**Headers:**
```
X-Diggion-Signature: sha256_signature
```

**Body (exemplo):**
```json
{
  "event": "payment.approved",
  "transaction_id": "TXN123456",
  "customer_email": "cliente@email.com",
  "amount": 97.00,
  "product_id": "PROD123",
  "metadata": {
    "plan": "pro",
    "duration": 30
  }
}
```

**Response 200:**
```json
{
  "received": true
}
```

---

## 🚨 Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 500 | Erro interno |

**Formato de erro:**
```json
{
  "error": "Mensagem de erro descritiva"
}
```

---

## 🔌 WebSocket Events

Conecte em: `ws://localhost:3001`

### Events emitidos pelo servidor:

**qr_code_updated**
```json
{
  "instanceId": "uuid",
  "qrCode": "data:image/png;base64,..."
}
```

**instance_connected**
```json
{
  "instanceId": "uuid",
  "phoneNumber": "5511999999999"
}
```

**campaign_progress**
```json
{
  "campaignId": "uuid",
  "messagesSent": 47,
  "messagesFailed": 3
}
```

**ban_detected**
```json
{
  "instanceId": "uuid",
  "errorRate": "75%",
  "message": "Possível ban detectado!"
}
```

---

## 📝 Notas Importantes

1. **Rate Limiting:** 100 requisições por minuto por IP
2. **Tokens JWT:** Expiram em 7 dias (configurável)
3. **Upload Max:** 10MB por arquivo
4. **WebSocket:** Reconecta automaticamente em caso de queda
5. **Logs:** Todos os endpoints geram logs de atividade

---

**Dúvidas? Consulte os exemplos de uso no frontend ou logs do servidor.**
