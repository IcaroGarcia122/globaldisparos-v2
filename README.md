# 🚀 Global Disparos — WhatsApp SaaS

Plataforma de disparo em massa de mensagens WhatsApp com segurança, auditoria e planos de preço.

## 📊 Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Node.js + Express + TypeScript |
| **Banco de Dados** | PostgreSQL |
| **WhatsApp** | Evolution API (Baileys) |
| **Comunicação Real-time** | Socket.IO |
| **Autenticação** | JWT (Bearer Token) |

## 🏃 Como Rodar Localmente

### Pré-requisitos
- Node.js v18+ instalado
- npm ou pnpm
- PostgreSQL (ou Docker com docker-compose)

### Passos

**1. Backend**
```bash
cd backend
npm install
npm run build
npm run dev
# Porta: 3001
```

**2. Frontend**
```bash
cd frontend
npm install
npm run dev
# Porta: 5173
```

**3. Evolution API (opcional — para testes locais)**
```bash
cd evolution-api-simple
docker-compose up -d
# Porta: 8081
```

## ⚙️ Variáveis de Ambiente

Crie arquivos `.env` em cada pasta:

**`backend/.env`**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/globaldisparos
JWT_SECRET=sua_chave_super_secreta_aqui
EVOLUTION_API_URL=http://localhost:8081
EVOLUTION_API_KEY=sua_chave_evolution
PORT=3001
NODE_ENV=development
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:3001/api
```

## 📁 Estrutura do Projeto

```
globaldisparos/
├── backend/
│   ├── src/
│   │   ├── routes/          # Endpoints da API
│   │   ├── services/        # Lógica de negócio
│   │   ├── models/          # Schemas do banco
│   │   ├── middleware/      # Auth, validação, etc
│   │   └── server.ts        # Instância Express + Socket.IO
│   ├── dist/                # TypeScript compilado
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Páginas principais
│   │   ├── components/      # Componentes React
│   │   ├── services/        # Chamadas API
│   │   ├── utils/           # Funções auxiliares
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## 🔗 Principais Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login de usuário |
| POST | `/api/instances` | Criar instância WhatsApp |
| GET | `/api/instances/:id/qr` | Obter QR code para conexão |
| POST | `/api/campaigns` | Disparar campanha |
| GET | `/api/campaigns/:id` | Status de campanha |

## 🎯 Roadmap

- [x] Backend com autenticação JWT
- [x] Frontend com componentes UI
- [x] QR code para WhatsApp
- [x] Socket.IO para atualizações real-time
- [ ] Barra de progresso em tempo real
- [ ] Múltiplos planos de preço
- [ ] Dashboard com estatísticas
- [ ] Webhook para eventos

## 📄 Licença

MIT

---

**Última atualização**: Março 2026
