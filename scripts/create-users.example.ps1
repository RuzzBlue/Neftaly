# Copia a create-users.local.ps1 y pega tu secret key (solo ejecutar una vez en tu PC)
# NO subas el archivo .local.ps1 a GitHub

$ProjectUrl = "https://azdrmhzmldmeyiuhrwve.supabase.co"
$SecretKey = "PEGAR_sb_secret_AQUI"
$Password = "Neftaly2026!"

$users = @(
  @{ email = "Branko@gmail.com"; role = "admin"; nombre = "Branko" },
  @{ email = "Luis@gmail.com"; role = "admin"; nombre = "Luis" },
  @{ email = "Belen@gmail.com"; role = "leader"; nombre = "Belen" },
  @{ email = "Liam@gmail.com"; role = "leader"; nombre = "Liam" }
)

foreach ($u in $users) {
  $body = @{
    email = $u.email
    password = $Password
    email_confirm = $true
    app_metadata = @{ role = $u.role }
    user_metadata = @{ nombre = $u.nombre }
  } | ConvertTo-Json

  $headers = @{
    "apikey" = $SecretKey
    "Authorization" = "Bearer $SecretKey"
    "Content-Type" = "application/json"
  }

  try {
    $resp = Invoke-RestMethod -Uri "$ProjectUrl/auth/v1/admin/users" -Method Post -Headers $headers -Body $body
    Write-Host "OK: $($u.email)" -ForegroundColor Green
  } catch {
    Write-Host "Error $($u.email): $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host "`nContraseña temporal para todos: $Password"
Write-Host "Luego ejecuta supabase/002_seed.sql para roles y datos iniciales."
