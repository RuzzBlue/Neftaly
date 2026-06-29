# Neftaly — Gestión de Tropa Scout

App estática para GitHub Pages + [Supabase](https://supabase.com) (PostgreSQL + Auth).

**URL prevista:** https://ruzzblue.github.io/Neftaly/

## Configuración inicial (una sola vez)

### 1. Base de datos

En [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**, ejecuta en orden:

1. `supabase/001_schema.sql`
2. Crea usuarios (paso 2 abajo)
3. `supabase/002_seed.sql`

### 2. Usuarios de acceso

**No se envían correos.** Los emails son solo para iniciar sesión.

En **Authentication → Providers → Email**, desactiva **Confirm email** (opcional pero recomendado).

Crea usuarios con el script (en tu PC):

```powershell
copy scripts\create-users.example.ps1 scripts\create-users.local.ps1
# Edita create-users.local.ps1 y pega tu sb_secret_...
powershell -ExecutionPolicy Bypass -File scripts\create-users.local.ps1
```

Contraseña temporal: `Neftaly2026!` (cámbiala en Supabase o desde la app cuando exista esa opción).

| Email | Rol |
|-------|-----|
| Branko@gmail.com | admin |
| Luis@gmail.com | admin |
| Belen@gmail.com | leader |
| Liam@gmail.com | leader |

### 3. Claves de API

La app usa la **publishable key** (`sb_publishable_...`) en `js/config.js`. Es segura en el navegador con RLS activo.

**Nunca** pongas la **secret key** ni la contraseña de la base de datos en el código ni en GitHub.

### 4. Probar en local

Abre `index.html` con un servidor local (los módulos ES no funcionan con `file://`):

```powershell
npx --yes serve .
```

Visita http://localhost:3000

### 5. GitHub Pages

1. Sube el repo a https://github.com/RuzzBlue/Neftaly
2. **Settings → Pages → Deploy from branch → main / root**
3. La app quedará en https://ruzzblue.github.io/Neftaly/

## Funciones

- **Resumen:** puntos de patrullas, detalle por miembro y bitácora
- **Asistencia:** registro por sábado; 3 ausencias seguidas → *en lista*
- **Configuración** (solo admin): ciclos 1–3, patrullas, miembros, cargos, borrar todo (nuevo año)
- **Reportes** y **Registro** de acciones (puntos y asistencia)

## Ciclos

Ciclo actual: **2**. Al cambiar de ciclo, los puntos se guardan por ciclo; un ciclo nuevo empieza en 0 sin borrar historial.
