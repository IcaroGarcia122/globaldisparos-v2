# ============================================================
# INICIAR EVOLUTION API REAL - Guia para QR Code escaneável
# ============================================================
# Execute este script no PowerShell (como Administrador se necessário)
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EVOLUTION API REAL - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# PASSO 1: Verificar Docker
Write-Host "[1/5] Verificando Docker..." -ForegroundColor Yellow
try {
    $docker = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker nao respondeu"
    }
    Write-Host "      OK - Docker esta rodando" -ForegroundColor Green
} catch {
    Write-Host "      ERRO - Docker Desktop nao esta rodando!" -ForegroundColor Red
    Write-Host ""
    Write-Host "      Acoes:" -ForegroundColor White
    Write-Host "      1. Abra o Docker Desktop" -ForegroundColor White
    Write-Host "      2. Aguarde iniciar completamente" -ForegroundColor White
    Write-Host "      3. Execute este script novamente" -ForegroundColor White
    Write-Host ""
    exit 1
}

# PASSO 2: Parar o mock (se estiver rodando)
Write-Host ""
Write-Host "[2/5] Parando mock na porta 8081 (se existir)..." -ForegroundColor Yellow
Write-Host "      Se o mock estiver rodando, feche o terminal onde ele esta" -ForegroundColor Gray
Write-Host "      ou pressione Ctrl+C no processo node evolution-api-mock.js" -ForegroundColor Gray

# PASSO 3: Subir containers
Write-Host ""
Write-Host "[3/5] Subindo Evolution API + Postgres + Redis..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose up -d postgres redis evolution-api 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "      ERRO ao subir containers" -ForegroundColor Red
    exit 1
}
Write-Host "      Containers iniciados" -ForegroundColor Green

# PASSO 4: Aguardar Evolution ficar pronta
Write-Host ""
Write-Host "[4/5] Aguardando Evolution API ficar pronta (~45 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 45

# PASSO 5: Testar
Write-Host ""
Write-Host "[5/5] Testando Evolution API..." -ForegroundColor Yellow
try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8081/" -Method Get -TimeoutSec 5
    Write-Host "      Evolution OK: $($resp | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "      ERRO - Evolution ainda nao respondeu. Aguarde mais 30s e teste:" -ForegroundColor Red
    Write-Host "      Invoke-RestMethod -Uri 'http://127.0.0.1:8081/' -Method Get" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PROXIMOS PASSOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Backend:  cd backend; npm run dev" -ForegroundColor White
Write-Host "2. Frontend: cd frontend; npm run dev" -ForegroundColor White
Write-Host "3. Acesse:   http://localhost:5173" -ForegroundColor White
Write-Host "4. Login:    admin@gmail.com / vip2026" -ForegroundColor White
Write-Host "5. Crie uma instancia - o QR real deve aparecer em ~10 segundos" -ForegroundColor White
Write-Host ""
Write-Host "EVOLUTION_API_URL=http://127.0.0.1:8081 (ja configurado no .env)" -ForegroundColor Gray
Write-Host "EVOLUTION_API_KEY=myfKey123456789 (igual ao docker-compose)" -ForegroundColor Gray
Write-Host ""
