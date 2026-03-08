# Script para iniciar toda a stack (Evolution API, Backend, Frontend)

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🚀 INICIANDO STACK COMPLETA" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 1. Parar todos os processos antigos
Write-Host "1️⃣  Parando serviços antigos..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue 2>&1 | Out-Null
Start-Sleep 2
Write-Host "   ✅ Processos parados"
Write-Host ""

# 2. Compilar Backend
Write-Host "2️⃣  Compilando Backend..." -ForegroundColor Cyan
cd "C:\Users\Icaro Garcia\Documents\globaldisparos\backend"
npm run build 2>&1 | Out-Null
Write-Host "   ✅ Backend compilado"
Write-Host ""

# 3. Iniciar Evolution API
Write-Host "3️⃣  Iniciando Evolution API Mock (porta 8081)..." -ForegroundColor Green
Start-Process -FilePath "node" -ArgumentList "evolution-api-mock.js" -WorkingDirectory "C:\Users\Icaro Garcia\Documents\globaldisparos" -NoNewWindow
Start-Sleep 2
Write-Host "   ✅ Evolution API iniciada"
Write-Host ""

# 4. Iniciar Backend
Write-Host "4️⃣  Iniciando Backend (porta 3001)..." -ForegroundColor Cyan
Start-Process -FilePath "npm" -ArgumentList "run", "start" -WorkingDirectory "C:\Users\Icaro Garcia\Documents\globaldisparos\backend" -NoNewWindow
Start-Sleep 5
Write-Host "   ✅ Backend iniciado"
Write-Host ""

# 5. Iniciar Frontend
Write-Host "5️⃣  Iniciando Frontend (porta 5173)..." -ForegroundColor Magenta
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "C:\Users\Icaro Garcia\Documents\globaldisparos\frontend" -NoNewWindow
Start-Sleep 3
Write-Host "   ✅ Frontend iniciado"
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ STACK INICIADA COM SUCESSO" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "📍 URLs disponíveis:" -ForegroundColor Cyan
Write-Host "   - Frontend:         http://localhost:5173" -ForegroundColor Green
Write-Host "   - Backend:          http://localhost:3001" -ForegroundColor Cyan
Write-Host "   - Evolution API:    http://localhost:8081" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Dica: Para testar o QR code, execute:" -ForegroundColor Yellow
Write-Host "   node test-qr-final.js" -ForegroundColor White
Write-Host ""
