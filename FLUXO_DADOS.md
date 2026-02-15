# 🔄 FLUXO DE DADOS - GLOBAL DISPAROS

## 1. AUTENTICAÇÃO

```
┌──────────────────────────────────────┐
│  Frontend (Auth.tsx)                 │
│  1. Login form (email + password)    │
└──────────┬──────────────────────────┘
           │
           ├─→ POST /auth/login (Supabase)
           │   └─→ Session + JWT token
           │
           └─→ POST /auth/login-supabase (Backend)
               ├─→ Create/sync user in MySQL
               ├─→ Generate JWT token
               └─→ Save to localStorage
                   ├─→ token
                   └─→ user object

┌──────────────────────────────────────┐
│  useBackendAuth Hook (Novo!)         │
│  - Sincroniza automaticamente        │
│  - Monitora mudanças de auth         │
│  - Salva token no localStorage       │
└──────────────────────────────────────┘
```

## 2. CONECTAR WHATSAPP

```
┌─────────────────────────────────────────┐
│  Frontend (CreateInstance.tsx)          │
│  1. User preenche: nome, idade da conta │
└──────┬──────────────────────────────────┘
       │
       ├─→ POST /api/instances (com token)
       │   │
       │   └─→ Backend (instances.ts)
       │       ├─→ Middleware auth valida JWT
       │       ├─→ WhatsAppInstance.create()
       │       └─→ Retorna instância criada
       │
       └─→ Frontend: showConnectModal = true

┌─────────────────────────────────────────┐
│  Frontend (ConnectWhatsApp.tsx)         │
│  1. User clica "Gerar QR Code"          │
└──────┬──────────────────────────────────┘
       │
       ├─→ POST /api/instances/:id/connect
       │   │
       │   └─→ Backend (baileysService)
       │       ├─→ makeWASocket() inicializa
       │       ├─→ Gera QR code
       │       └─→ saveQRCode() com expiração
       │
       ├─→ GET /api/instances/:id/qr (polling 1.5s)
       │   └─→ Retorna QR code em base64
       │
       └─→ Frontend: renderiza <img> com QR

┌─────────────────────────────────────────┐
│  User: escaneia o QR com WhatsApp       │
└──────┬──────────────────────────────────┘
       │
       └─→ Backend (socket.ev.on('connection.update'))
           ├─→ Detecta conexão bem-sucedida
           ├─→ Salva phoneNumber no banco
           ├─→ Status = 'connected'
           └─→ ActivityLog.create()
               └─→ showConnectModal = false (frontend)
```

## 3. CRIAR CAMPANHA

```
┌──────────────────────────────────────┐
│  Frontend (CampaignDispatcher.tsx)    │
│  1. User clica "Nova Campanha"        │
└──────┬───────────────────────────────┘
       │
       └─→ showForm = true

┌──────────────────────────────────────┐
│  Frontend: Form com                  │
│  - Nome da campanha                  │
│  - Instância WhatsApp                │
│  - Mensagem de texto                 │
└──────┬───────────────────────────────┘
       │
       ├─→ POST /api/campaigns
       │   │
       │   └─→ Backend (campaignService.createCampaign)
       │       ├─→ Campaign.create()
       │       ├─→ [TODO] ContactList validação
       │       ├─→ Message.bulkCreate() (agendadas)
       │       ├─→ ActivityLog.create()
       │       └─→ Status: 'pending'
       │
       └─→ Frontend: Adiciona a campaigns[]
           └─→ Renderiza na lista "Campanhas Recentes"
```

## 4. ENVIAR MENSAGENS (EM BREVE)

```
┌──────────────────────────────────────┐
│  Frontend (CampaignDispatcher.tsx)    │
│  1. User clica "Iniciar" em campanha  │
└──────┬───────────────────────────────┘
       │
       ├─→ POST /api/campaigns/:id/start
       │   │
       │   └─→ Backend (campaignService.startCampaign)
       │       ├─→ Valida instância conectada
       │       ├─→ Campaign.status = 'running'
       │       ├─→ Inicia processCampaign() em background
       │       └─→ ActivityLog.create()
       │
       └─→ Polling: GET /api/campaigns/:id/progress
           └─→ Atualiza UI com stats em tempo real

[Background - Para cada mensagem da campanha]
┌──────────────────────────────────────┐
│  campaignService.processCampaign()   │
│  Loop através de todas as mensagens  │
└──────┬───────────────────────────────┘
       │
       ├─→ Verifica antiBanService
       │   ├─→ Limite diário?
       │   ├─→ Horário comercial?
       │   └─→ Taxa de erro alta?
       │
       ├─→ baileysService.sendMessage()
       │   ├─→ socket.sendMessage() via Baileys
       │   ├─→ Message.status = 'sent'
       │   ├─→ Incrementa contadores
       │   └─→ WhatsAppInstance.lastMessageAt
       │
       ├─→ Delay variável (anti-ban)
       │   ├─→ antiBanService.generateDelay()
       │   ├─→ Sleep(delay)
       │   └─→ Próxima mensagem
       │
       └─→ Quando terminar
           ├─→ Campaign.status = 'completed'
           ├─→ Campaign.completedAt = now()
           └─→ ActivityLog.create('campaign_completed')
```

## 5. ESTRUTURA DE DADOS

```
User
├── id (UUID)
├── email
├── password (bcrypt hash)
├── role = 'admin' | 'user'
├── plan = 'free' | 'basic' | 'pro' | 'enterprise'
├── isActive
└── lastLoginAt

WhatsAppInstance
├── id (UUID)
├── userId (FK)
├── name
├── phoneNumber
├── status = 'connecting' | 'connected' | 'disconnected' | 'banned'
├── qrCode (base64 temporário)
├── accountAge
├── dailyMessagesSent
├── totalMessagesSent
├── totalMessagesFailed
├── lastMessageAt
└── connectedAt

Campaign
├── id (UUID)
├── userId (FK)
├── instanceId (FK)
├── name
├── message
├── status = 'pending' | 'running' | 'paused' | 'completed' | 'failed'
├── totalContacts
├── messagesSent
├── messagesFailed
├── useAntibanVariations
├── useAntibanDelays
├── useCommercialHours
├── startedAt
├── completedAt
└── [1] Message

Message [N]
├── id (UUID)
├── campaignId (FK)
├── phoneNumber
├── messageText
├── status = 'scheduled' | 'sent' | 'failed'
├── errorMessage
├── sentAt
└── [1] Contact

Contact [N]
├── id (UUID)
├── contactListId (FK)
├── name
├── phoneNumber
├── variables (JSON)
└── [1] ContactList

ContactList [N]
├── id (UUID)
├── userId (FK)
├── name
├── totalContacts
└── [N] Contact

ActivityLog
├── id (UUID)
├── userId (FK)
├── instanceId
├── action = 'connected' | 'disconnected' | 'campaign_created' | etc
├── details (JSON)
├── level = 'info' | 'success' | 'warning' | 'error'
└── timestamp
```

## 6. FLUXO EM TEMPO REAL (Futuro)

```
[User escaneia QR Code]
          │
          ↓
[Baileys detecta conexão]
          │
          ├─→ socket.ev.on('connection.update')
          ├─→ socket.ev.on('messages.upsert')
          └─→ socket.ev.on('creds.update')
          │
          ↓
[Backend emite via Socket.IO]
          │
          ├─→ io.emit('instance:connected')
          ├─→ io.emit('message:received')
          └─→ io.emit('campaign:progress')
          │
          ↓
[Frontend recebe em tempo real]
          │
          └─→ Atualiza UI sem polling
```

## 7. CICLO DE VIDA DE CAMPANHA

```
┌─────────────────────────────────────┐
│ 1. CRIAÇÃO                          │
│ Status: PENDING                     │
│ - Campaign criada                   │
│ - Messages agendadas                │
│ - Aguardando início                 │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 2. ENVIO                            │
│ Status: RUNNING                     │
│ - Loop de mensagens                 │
│ - Aplicar anti-ban                  │
│ - Logging de sucesso/falha          │
└────────────┬────────────────────────┘
             │
     ┌───────┴────────┬─────────────┬─────────────┐
     │                │             │             │
     ↓                ↓             ↓             ↓
┌─────────┐   ┌─────────────┐ ┌──────────┐ ┌──────────┐
│COMPLETED│   │PAUSED       │ │FAILED    │ │BANNED    │
│Status:O │   │(horário)    │ │(erro)    │ │(account) │
│Status:O │   │             │ │          │ │          │
└─────────┘   └──────┬──────┘ └──────────┘ └──────────┘
                     │
                     ↓
              ┌─────────────┐
              │RETOMAR      │
              │Automatico   │
              └─────────────┘
```

---

## 📊 RESUMO DE INTEGRAÇÕES

| Componente | Integração | Status |
|-----------|-----------|--------|
| Baileys | WhatsApp Web | ✅ Completo |
| Supabase | Autenticação | ✅ Completo |
| PostgreSQL | Database | ✅ Completo |
| BcryptJS | Hash Password | ✅ Completo |
| JWT | Token Auth | ✅ Completo |
| QRCode | QR Generation | ✅ Completo |
| Socket.IO | Real-time (Pronto) | 🔄 Estrutura OK |
| Stripe | Pagamentos | ❌ TODO |
| SendGrid | Email | ❌ TODO |
| AWS S3 | File Storage | ❌ TODO |

