# Copia este archivo a create-users.local.ps1 y completa tus datos.
# create-users.local.ps1 está en .gitignore — NO lo subas a GitHub.

$ProjectUrl = "https://TU_PROJECT_ID.supabase.co"
$SecretKey = "PEGAR_sb_secret_AQUI"
$Password = "TU_CONTRASENA_TEMPORAL"

$users = @(
  @{ email = "admin1@ejemplo.com"; role = "admin"; nombre = "Admin 1" },
  @{ email = "admin2@ejemplo.com"; role = "admin"; nombre = "Admin 2" },
  @{ email = "lider1@ejemplo.com"; role = "leader"; nombre = "Líder 1" },
  @{ email = "lider2@ejemplo.com"; role = "leader"; nombre = "Líder 2" }
)

foreach ($u in $users) {
  $body = @{
    email = $u.email
    password = $Password
    email_confirm = $true
    app_metadata = @{ role = $u.role }
    user_metadata = @{ nombre = $u.nombre }
  } | ConvertTo-Json -Depth 3

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
Write-Host "Listo. Luego ejecuta supabase/002_seed.sql (ajusta roles con tus emails reales)."
