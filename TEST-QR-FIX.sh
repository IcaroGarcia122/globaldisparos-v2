#!/bin/bash

# ============================================
# TESTE DO QR CODE FIX
# ============================================

echo "🧪 Iniciando testes do QR Code..."
echo ""

# 1. Verificar .env
echo "1️⃣  Verificando configuração do .env..."
EVOLUTION_URL=$(grep EVOLUTION_API_URL .env | cut -d '=' -f2)
EVOLUTION_KEY=$(grep EVOLUTION_API_KEY .env | cut -d '=' -f2)

echo "   ✅ EVOLUTION_API_URL: $EVOLUTION_URL"
echo "   ✅ EVOLUTION_API_KEY: ${EVOLUTION_KEY:0:10}..."
echo ""

# 2. Testar conexão com Evolution API
echo "2️⃣  Testando conexão com Evolution API..."
RESPONSE=$(curl -s -H "apikey: $EVOLUTION_KEY" "$EVOLUTION_URL/" || echo "ERROR")

if [[ $RESPONSE == "ERROR" ]]; then
    echo "   ❌ Erro ao conectar Evolution API"
    echo "   💡 Certifique-se de rodar: docker-compose up -d"
else
    echo "   ✅ Evolution API respondendo"
fi
echo ""

# 3. Testar criação de instância
echo "3️⃣  Testando POST /instance/create..."
CREATE_RESPONSE=$(curl -s -X POST "$EVOLUTION_URL/instance/create" \
  -H "apikey: $EVOLUTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"test_instance_123","qrcode":true}')

echo "   Resposta: $CREATE_RESPONSE"
echo ""

# 4. Testar GET QR code
echo "4️⃣  Testando GET /instance/connect/{name}..."
QR_RESPONSE=$(curl -s "$EVOLUTION_URL/instance/connect/test_instance_123" \
  -H "apikey: $EVOLUTION_KEY")

if echo "$QR_RESPONSE" | grep -q "base64\|qr\|qrcode"; then
    echo "   ✅ QR Code retornado com sucesso"
    echo "   Tamanho: $(echo "$QR_RESPONSE" | wc -c) chars"
else
    echo "   ⚠️  QR Code pode não estar pronto ainda"
    echo "   Resposta: ${QR_RESPONSE:0:200}..."
fi
echo ""

echo "✅ Testes concluídos!"
echo ""
echo "Próximos passos:"
echo "1. Rodar: npm install (se necessário)"
echo "2. Rodar: npm run dev (backend)"
echo "3. Conectar uma instância via frontend"
echo "4. Verificar se GET /api/instances retorna qrCode não-null"
