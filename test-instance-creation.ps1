# =============================================
# TEST INSTANCE CREATION - QR CODE DEBUG
# =============================================

Write-Host "🧪 Testing Instance Creation flow..."
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

$backend_url = "http://localhost:3001"

# Step 1: Register user
Write-Host "1️⃣  Registering test user..."
$registerBody = @{
    email = "testuser_$(Get-Random)@test.com"
    password = "Test123!@#"
    name = "Test User"
} | ConvertTo-Json

try {
    $registerResp = Invoke-WebRequest -Uri "$backend_url/api/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerBody `
        -ErrorAction Stop
    
    $registerData = $registerResp.Content | ConvertFrom-Json
    Write-Host "✅ User registered: $($registerData.user.email)"
    $userId = $registerData.user.id
} catch {
    Write-Host "⚠️  Register failed (might already exist): $($_.Exception.Message)"
    # Try login instead
    $loginBody = @{
        email = "admin@globaldisparos.com"
        password = "Admin123!@#"
    } | ConvertTo-Json
    
    try {
        $loginResp = Invoke-WebRequest -Uri "$backend_url/api/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body $loginBody `
            -ErrorAction Stop
        
        $loginData = $loginResp.Content | ConvertFrom-Json
        $token = $loginData.token
        Write-Host "✅ Logged in successfully"
    } catch {
        Write-Host "❌ Both register and login failed"
        Write-Host "Error: $($_.Exception.Message)"
        exit 1
    }
}

Write-Host ""
Write-Host "2️⃣  Attempting to create instance..."

$createBody = @{
    name = "Test_Instance_$(Get-Random)"
    accountAge = 30
} | ConvertTo-Json

Write-Host "Payload: $createBody"
Write-Host ""

try {
    $createResp = Invoke-WebRequest -Uri "$backend_url/api/instances" `
        -Method POST `
        -ContentType "application/json" `
        -Body $createBody `
        -Headers @{Authorization = "Bearer $token"} `
        -ErrorAction Stop
    
    $createData = $createResp.Content | ConvertFrom-Json
    Write-Host "✅ Instance created!"
    Write-Host "Response: $($createData | ConvertTo-Json)"
    $instanceId = $createData.id
} catch {
    Write-Host "❌ ERROR creating instance"
    Write-Host "Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Message: $($_.Exception.Message)"
    
    # Try to read error body
    try {
        $errorBody = $_.Exception.Response.Content.ToString() | ConvertFrom-Json
        Write-Host "Error Details: $($errorBody | ConvertTo-Json)"
    } catch {
        Write-Host "Raw Response: $($_.Exception.Response.Content.ToString())"
    }
    exit 1
}

Write-Host ""
Write-Host "✅ Test completed successfully!"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
