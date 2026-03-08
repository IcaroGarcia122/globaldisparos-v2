# ================================================
# TESTE COMPLETO: CRIAR INSTÂNCIA + OBTER QR
# ================================================

Write-Host "🧪 TESTE: Criação de Instância com QR Code"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# Configurações
$baseUrl = "http://localhost:3001"
$email = "test_$(Get-Random)@test.com"
$password = "Test123!@#"
$instanceName = "TestInstance_$(Get-Random)"

# 1. REGISTRAR USUÁRIO
Write-Host "📍 Passo 1: Registrar usuário..."
$registerBody = @{
    email = $email
    password = $password
    name = "Test User"
} | ConvertTo-Json

try {
    $registerResp = Invoke-WebRequest -Uri "$baseUrl/api/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerBody `
        -ErrorAction Stop | ConvertFrom-Json
    
    Write-Host "✅ Usuário registrado: $email"
    $token = $registerResp.token
} catch {
    Write-Host "⚠️  Registro falhou, tentando login..."
    
    $loginBody = @{
        email = "admin@globaldisparos.com"
        password = "Admin123!@#"
    } | ConvertTo-Json
    
    try {
        $loginResp = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body $loginBody `
            -ErrorAction Stop | ConvertFrom-Json
        
        Write-Host "✅ Login bem-sucedido"
        $token = $loginResp.token
        $email = $loginResp.user.email
    } catch {
        Write-Host "❌ Login falhou: $($_.Exception.Message)"
        exit 1
    }
}

Write-Host ""
Write-Host "📍 Passo 2: Criar instância..."

$createBody = @{
    name = $instanceName
    accountAge = 30
} | ConvertTo-Json

try {
    $createResp = Invoke-WebRequest -Uri "$baseUrl/api/instances" `
        -Method POST `
        -ContentType "application/json" `
        -Body $createBody `
        -Headers @{Authorization = "Bearer $token"} `
        -ErrorAction Stop | ConvertFrom-Json
    
    Write-Host "✅ Instância criada!"
    Write-Host "   ID: $($createResp.id)"
    Write-Host "   Nome: $($createResp.name)"
    $instanceId = $createResp.id
} catch {
    Write-Host "❌ Erro ao criar instância"
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Erro: $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host "📍 Passo 3: Chamar POST /instances/:id/connect..."

try {
    $connectResp = Invoke-WebRequest -Uri "$baseUrl/api/instances/$instanceId/connect" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{Authorization = "Bearer $token"} `
        -ErrorAction Stop | ConvertFrom-Json
    
    Write-Host "✅ Conexão iniciada!"
    Write-Host "   Success: $($connectResp.success)"
    Write-Host "   Message: $($connectResp.message)"
    
    if ($connectResp.qrCode) {
        Write-Host ""
        Write-Host "📷 QR CODE ENCONTRADO!"
        Write-Host "   Tamanho: $($connectResp.qrCode.Length) caracteres"
        Write-Host "   Começa com: $($connectResp.qrCode.Substring(0, 50))..."
        
        if ($connectResp.qrCode.StartsWith("data:image")) {
            Write-Host "   ✅ Formato: data URL (pronto para exibir)"
        } else {
            Write-Host "   ⚠️ Formato: base64 puro (precisa normalizar)"
        }
    } else {
        Write-Host "❌ QR Code não retornado!"
        Write-Host "Resposta: $($connectResp | ConvertTo-Json)"
    }
    
} catch {
    Write-Host "❌ Erro ao chamar connect"
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Erro: $($_.Exception.Message)"
    
    try {
        $errorBody = $_.Exception.Response.Content.ToString() | ConvertFrom-Json
        Write-Host "Detalhes: $($errorBody | ConvertTo-Json)"
    } catch { }
    
    exit 1
}

Write-Host ""
Write-Host "✅ TESTE COMPLETADO COM SUCESSO!"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
