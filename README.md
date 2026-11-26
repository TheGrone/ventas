# Mercado del Condominio (CondoMarket)

Aplicación web privada para que los vecinos de un condominio publiquen productos o servicios en CLP, organicen por catálogos/secciones y se contacten directamente por **WhatsApp**, con **panel de administración** y seguridad anti-suplantación lista para **GitHub Pages**.

## Seguridad y Buenas Prácticas implementadas

1. **Sin suplantación de identidad ni acceso externo:**
   - Para registrarse se exige un **Código de invitación del condominio** validado en el servidor (trigger `handle_new_user` en PostgreSQL; nunca se expone en el frontend).
   - Toda cuenta nueva queda en estado **`pending`** hasta que el **Administrador** la aprueba manualmente verificando nombre y Casa/Depto.
2. **Row-Level Security (RLS) en PostgreSQL:**
   - Cada vendedor solo puede editar o eliminar sus propios anuncios (`seller_id = auth.uid()`).
   - Un trigger (`protect_profile_fields`) impide que cualquier usuario modifique su propio `role` (`resident` / `admin`) o `status`.
   - Los perfiles y anuncios solo son visibles para vecinos autenticados y aprobados.
3. **Moderación del Administrador:**
   - Aprobar o suspender vecinos.
   - Ocultar (con nota de motivo) o eliminar cualquier anuncio inapropiado.
   - Agregar o eliminar secciones/catálogos y rotar el código de invitación.
   - Registro en tabla `moderation_logs`.
4. **Fotos seguras y CSP:**
   - Bucket `product-images` limitado a `JPG/PNG/WebP` de máximo 2 MB, donde cada usuario solo escribe en su propia carpeta.
   - Content Security Policy (CSP) configurada en `index.html`.

---

## Guía de Instalación (Paso a paso)

### 1. Configurar Supabase (Backend gratuito)
1. Crea una cuenta y un proyecto nuevo en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** → **New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo.
   - *(Opcional)* En **Authentication → Providers → Email**, si quieres que los vecinos entren apenas tú los apruebes sin confirmar correo, puedes desactivar "Confirm email" (aunque dejarlo activado es más seguro).
3. Copia tu **Project URL** y tu **anon public key** desde **Project Settings → API**.

### 2. Probar en local
```bash
cp .env.example .env.local
# Edita .env.local con tus credenciales de Supabase
npm install
npm run dev
```

### 3. Crear tu usuario Administrador
1. Regístrate desde la app usando el código de invitación inicial (`CONDO2026`).
2. En el **SQL Editor** de Supabase, ejecuta (reemplazando tu correo):
   ```sql
   update public.profiles
   set role = 'admin', status = 'approved'
   where email = 'tu-correo@ejemplo.com';
   ```
3. Recarga la app y verás la pestaña **Administración** (recuerda cambiar el código `CONDO2026` por uno propio desde el panel).

### 4. Subir a GitHub Pages
1. Sube este repositorio a GitHub (rama `main`).
2. En tu repositorio ve a **Settings → Secrets and variables → Actions → Variables** y agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CONDO_NAME` (ej: `Condominio Los Robles`)
3. En **Settings → Pages**, selecciona **Source: GitHub Actions**.
4. Cada `git push` a `main` compilará y publicará automáticamente tu sitio en GitHub Pages.
