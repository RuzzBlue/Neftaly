# Copia este archivo a create-users.local.ps1 y pega tu secret key.
# Ubicación: scripts/create-users.local.ps1 (misma carpeta que este archivo)
# NO subas create-users.local.ps1 a GitHub (ya está en .gitignore)

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
  } | ConvertTo-Json -Depth 3

  # IMPORTANTE: con las nuevas keys sb_secret_, solo usar header "apikey".
  # NO poner sb_secret_ en Authorization: Bearer (eso causa 401/403).
  $headers = @{
    "apikey" = $SecretKey
    "Content-Type" = "application/json"
  }

  try {
    Invoke-RestMethod -Uri "$ProjectUrl/auth/v1/admin/users" -Method Post -Headers $headers -Body $body | Out-Null
    Write-Host "OK: $($u.email)" -ForegroundColor Green
  } catch {
    $detail = $_.Exception.Message
    if ($_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
    Write-Host "Error $($u.email): $detail" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Contrasena temporal para todos: $Password"
Write-Host "Luego ejecuta supabase/002_seed.sql en el SQL Editor."
