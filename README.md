# Neftaly — Gestión de Tropa Scout

App estática para GitHub Pages + [Supabase](https://supabase.com) (PostgreSQL + Auth).

**URL:** https://ruzzblue.github.io/Neftaly/

## Configuración inicial (una sola vez)

### 1. Base de datos

En [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**, ejecuta en orden:

1. `supabase/001_schema.sql`
2. Crea usuarios (paso 2 abajo)
3. `supabase/002_seed.sql` (datos de patrullas; ajusta roles al final con tus emails)
4. Opcional: `supabase/003_backfill_profiles.sql` si creaste usuarios manualmente
5. Opcional: `supabase/004_reset_troop_data.sql` para reinicio configurable
6. Opcional: `supabase/005_leader_config_rls.sql` para que líderes cambien ciclo y editen patrullas
7. Opcional: `supabase/006_profile_users.sql` para proteger cambios de rol propios

### 2. Usuarios de acceso

**No se envían correos.** Los emails son solo para iniciar sesión.

En **Authentication → Providers → Email**, desactiva **Confirm email** (recomendado).

**Opción A — Dashboard:** Authentication → Users → Add user (marca *Auto Confirm*).

**Opción B — Script local:**

```powershell
copy scripts\create-users.example.ps1 scripts\create-users.local.ps1
# Edita create-users.local.ps1: secret key, emails, contraseña y roles
powershell -ExecutionPolicy Bypass -File scripts\create-users.local.ps1
```

`create-users.local.ps1` está en `.gitignore` — no lo subas a GitHub.

Asigna roles `admin` o `leader` en el script o con los `UPDATE` al final de `002_seed.sql` / `003_backfill_profiles.sql`.

### 3. Claves de API

Copia `js/config.example.js` → `js/config.js` y agrega tu **Project URL** y **publishable key** (`sb_publishable_...`).

La publishable key es segura en el navegador con RLS activo. **Nunca** subas la secret key ni la contraseña de la base de datos.

### 4. Probar en local

```powershell
npx --yes serve .
```

Visita http://localhost:3000

### 5. GitHub Pages

1. Repo: https://github.com/RuzzBlue/Neftaly
2. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions** (not “Deploy from a branch”)
3. Push to `main` — the workflow `.github/workflows/pages.yml` publishes the site automatically
4. First deploy: open the **Actions** tab, confirm **Deploy GitHub Pages** finished green
5. Live URL: **https://ruzzblue.github.io/Neftaly/**

If the site stays 404: check **Settings → Pages** shows a green “Your site is live at…”, and that the repo is **Public** (or Pages is enabled for your plan on private repos).

## Funciones

- **Resumen:** puntos de patrullas, detalle por miembro y bitácora
- **Asistencia:** registro por sábado; 3 ausencias seguidas → *en lista*
- **Configuración** (admin completo; líderes: ciclo, editar patrullas/miembros, ver cargos): ciclos 1–3, patrullas, miembros, cargos, reinicio de tropa (solo admin)
- **Reportes** y **Registro** de acciones (puntos y asistencia)

## Ciclos

Hay 3 ciclos por año scout. Al cambiar de ciclo, los puntos se guardan por ciclo; un ciclo nuevo empieza en 0 sin borrar historial.
