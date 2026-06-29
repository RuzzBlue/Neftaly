import { showError } from './utils.js';

let profile = null;

export function getProfile() { return profile; }
export function isAdmin() { return profile?.role === 'admin'; }

export async function initAuth() {
  const sb = window.supabase;
  sb.auth.onAuthStateChange((_event, session) => {
    if (session) showAppShell();
    else showLogin();
  });

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await loadProfile();
    showAppShell();
  } else {
    showLogin();
  }

  document.getElementById('login-form')?.addEventListener('submit', onLogin);
  document.getElementById('btn-logout')?.addEventListener('click', onLogout);
}

async function loadProfile() {
  const { data: { user } } = await window.supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await window.supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  profile = data;
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.textContent = data.nombre || data.email;
  document.getElementById('nav-config')?.classList.toggle('d-none', !isAdmin());
}

async function onLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember').checked;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('d-none');

  const { error } = await window.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('d-none');
    return;
  }
  if (!remember) {
    /* session still persists in localStorage by default; user can clear browser data */
  }
  await loadProfile();
  showAppShell();
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
    .single();
  if (error) showError(error);
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
