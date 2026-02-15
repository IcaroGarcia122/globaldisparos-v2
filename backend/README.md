# 🚀 WhatsApp SaaS Backend - Baileys Integrado

Backend completo para SaaS de disparo de mensagens WhatsApp com sistema anti-ban profissional.

## ✨ Funcionalidades

### 🎯 Core Features
- ✅ Autenticação JWT completa
- ✅ Gerenciamento de múltiplas instâncias WhatsApp (Baileys)
- ✅ Sistema de disparo em massa
- ✅ Importação de contatos (CSV)
- ✅ Extração de participantes de grupos
- ✅ Webhook Diggion (checkout)
- ✅ Sistema de logs completo
- ✅ WebSocket para atualizações em tempo real

### 🛡️ Sistema Anti-Ban PROFISSIONAL
- ✅ Limites inteligentes por idade da conta
  - Conta Nova (< 7 dias): 50 msgs/dia
  - Conta Média (7-30 dias): 150 msgs/dia
  - Conta Antiga (> 30 dias): 500 msgs/dia
- ✅ 4 Variações automáticas de mensagem
- ✅ Variáveis personalizadas ({{nome}}, {{data}}, etc)
- ✅ Delays randômicos com variação (3-45s)
- ✅ Pausas inteligentes (a cada 5-20 msgs)
- ✅ Horário comercial (9h-21h)
- ✅ Detecção automática de ban (taxa de erro > 70%)
- ✅ Dashboard de estatísticas

## 📦 Tecnologias

- **Node.js** + **TypeScript**
- **Express.js** (API REST)
- **PostgreSQL** (Banco de dados)
- **Sequelize** (ORM)
- **@whiskeysockets/baileys** (WhatsApp Web API)
- **Socket.IO** (WebSocket)
- **JWT** (Autenticação)
- **Pino** (Logging)
- **Node-cron** (Agendamentos)

## 📊 Banco de Dados (12 Tabelas)

1. **users** - Usuários do sistema
2. **whatsapp_instances** - Instâncias WhatsApp conectadas
3. **contact_lists** - Listas de contatos
4. **contacts** - Contatos individuais
5. **campaigns** - Campanhas de disparo
6. **messages** - Mensagens enviadas
7. **whatsapp_groups** - Grupos sincronizados
8. **group_participants** - Participantes dos grupos
9. **activity_logs** - Logs de atividade
10. **payments** - Pagamentos (Diggion)
11. **warmup_sessions** - Sessões de aquecimento
12. **achievements** - Conquistas do usuário

## 🎯 Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `GET /api/auth/me` - Dados do usuário autenticado

### Instâncias WhatsApp
- `POST /api/instances` - Criar instância
- `GET /api/instances` - Listar instâncias
- `GET /api/instances/:id/qr` - Obter QR Code
- `POST /api/instances/:id/connect` - Conectar
- `DELETE /api/instances/:id` - Desconectar

### Contatos
- `POST /api/contacts/lists` - Criar lista
- `GET /api/contacts/lists` - Listar listas
- `POST /api/contacts/import-csv` - Importar CSV
- `GET /api/contacts/lists/:id/contacts` - Ver contatos

### Campanhas
- `POST /api/campaigns` - Criar campanha
- `GET /api/campaigns` - Listar campanhas
- `POST /api/campaigns/:id/start` - Iniciar
- `POST /api/campaigns/:id/pause` - Pausar
- `GET /api/campaigns/:id/progress` - Progresso

### Grupos
- `GET /api/groups/sync/:instanceId` - Sincronizar grupos
- `GET /api/groups/:groupId/participants` - Extrair participantes
- `POST /api/groups/export-to-contacts` - Exportar para lista

### Estatísticas
- `GET /api/stats/user` - Stats gerais do usuário
- `GET /api/stats/instance/:id` - Stats da instância
- `GET /api/stats/messages/chart` - Gráfico de envios

### Webhook
- `POST /api/webhook/diggion` - Webhook do Diggion

## 📁 Estrutura de Pastas

```
src/
├── config/          # Configurações
│   ├── index.ts
│   └── database.ts
├── models/          # Modelos Sequelize (12 tabelas)
│   ├── User.ts
│   ├── WhatsAppInstance.ts
│   ├── ContactList.ts
│   ├── Contact.ts
│   ├── Campaign.ts
│   ├── Message.ts
│   ├── WhatsAppGroup.ts
│   ├── GroupParticipant.ts
│   ├── ActivityLog.ts
│   ├── Payment.ts
│   ├── WarmupSession.ts
│   ├── Achievement.ts
│   └── index.ts
├── services/        # Lógica de negócio
│   ├── baileysService.ts      # Gerenciador WhatsApp
│   ├── antiBanService.ts      # Sistema anti-ban
│   └── campaignService.ts     # Disparos
├── controllers/     # Controllers das rotas
├── routes/          # Rotas da API
├── middleware/      # Middlewares
│   └── auth.ts
├── utils/           # Utilidades
│   └── logger.ts
├── types/           # Tipos TypeScript
├── websocket/       # Socket.IO handlers
├── scripts/         # Scripts de setup
│   ├── setup.ts
│   └── migrate.ts
└── server.ts        # Servidor principal
```

## 🔐 Variáveis de Ambiente (.env)

```env
# Servidor
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_saas
DB_USER=postgres
DB_PASSWORD=sua_senha

# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=7d

# Diggion
DIGGION_WEBHOOK_SECRET=sua_chave
DIGGION_PRODUCT_ID=seu_product_id

# Admin padrão
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=Admin@123456

# Frontend
FRONTEND_URL=http://localhost:5173

# Baileys
AUTH_SESSIONS_DIR=./auth_sessions

# Anti-Ban (configurável)
ANTI_BAN_NEW_ACCOUNT_DAYS=7
ANTI_BAN_MEDIUM_ACCOUNT_DAYS=30
ANTI_BAN_NEW_DAILY_LIMIT=50
ANTI_BAN_MEDIUM_DAILY_LIMIT=150
ANTI_BAN_OLD_DAILY_LIMIT=500
ANTI_BAN_NEW_DELAY_MIN=15
ANTI_BAN_NEW_DELAY_MAX=45
ANTI_BAN_MEDIUM_DELAY_MIN=8
ANTI_BAN_MEDIUM_DELAY_MAX=20
ANTI_BAN_OLD_DELAY_MIN=3
ANTI_BAN_OLD_DELAY_MAX=10
ANTI_BAN_START_HOUR=9
ANTI_BAN_END_HOUR=21
ANTI_BAN_ERROR_THRESHOLD=70

# Uploads
UPLOADS_DIR=./uploads
MAX_FILE_SIZE=10485760
```

