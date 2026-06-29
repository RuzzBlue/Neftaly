import { showError } from './utils.js';

let profile = null;
let onAuthenticated = null;

export function getProfile() { return profile; }
export function isAdmin() { return profile?.role === 'admin'; }

export function setOnAuthenticated(fn) {
  onAuthenticated = fn;
}

export async function initAuth() {
  const sb = window.supabase;

  document.getElementById('login-form')?.addEventListener('submit', onLogin);
  document.getElementById('btn-logout')?.addEventListener('click', onLogout);

  sb.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await loadProfile();
      showAppShell();
      if (onAuthenticated) await onAuthenticated();
    } else {
      profile = null;
      showLogin();
    }
  });

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await loadProfile();
    showAppShell();
    return true;
  }
  showLogin();
  return false;
}

async function loadProfile() {
  const { data: { user } } = await window.supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await window.supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      'No hay perfil para este usuario. Ejecuta supabase/003_backfill_profiles.sql en Supabase.'
    );
  }

  profile = data;
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = data.nombre || data.email;
  document.getElementById('nav-config')?.classList.toggle('d-none', !isAdmin());
}

async function onLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('d-none');

  const { error } = await window.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('d-none');
    return;
  }

  try {
    await loadProfile();
    showAppShell();
    if (onAuthenticated) await onAuthenticated();
  } catch (err) {
    errEl.textContent = err?.message || String(err);
    errEl.classList.remove('d-none');
    await window.supabase.auth.signOut();
  }
}

async function onLogout() {
  await window.supabase.auth.signOut();
  profile = null;
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('d-none');
  document.getElementById('app-shell').classList.remove('ready');
}

function showAppShell() {
  document.getElementById('login-screen').classList.add('d-none');
  document.getElementById('app-shell').classList.add('ready');
}

export async function requireAuth() {
  const { data: { user } } = await window.supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  if (!profile) await loadProfile();
  return user;
}

export async function getCurrentCiclo() {
  const { data, error } = await window.supabase
    .from('app_config')
    .select('value')
    .eq('key', 'ciclo_actual')
    .maybeSingle();
  if (error) throw error;
  return parseInt(data?.value || '2', 10);
}

export async function setCurrentCiclo(n) {
  const { error } = await window.supabase
    .from('app_config')
    .upsert({ key: 'ciclo_actual', value: String(n) });
  if (error) throw error;
}

export async function logAction(tipo, detalle, ciclo) {
  const { data: { user } } = await window.supabase.auth.getUser();
  await window.supabase.from('action_log').insert({
    user_id: user?.id,
    tipo,
    detalle,
    ciclo: ciclo ?? null,
  });
}
