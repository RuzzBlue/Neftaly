import {
  getProfile, isAdmin, loadProfile, requireAuth, roleLabel,
} from './auth.js';
import { escapeHtml, showError, toast } from './utils.js';

let profileModalReady = false;
let saving = false;
let profileNoticeTimer = null;

function showFreeTierNotice() {
  const notice = document.getElementById('profile-free-tier-notice');
  if (!notice) return;
  notice.classList.remove('d-none');
  if (profileNoticeTimer) clearTimeout(profileNoticeTimer);
  profileNoticeTimer = setTimeout(() => {
    notice.classList.add('d-none');
  }, 10000);
}

export function initProfileModal() {
  if (profileModalReady) return;
  profileModalReady = true;

  document.getElementById('btn-edit-profile')?.addEventListener('click', () => {
    openProfileModal();
    bootstrap.Offcanvas.getInstance(document.getElementById('offcanvas-nav'))?.hide();
  });

  document.getElementById('profile-save-mine')?.addEventListener('click', () => {
    saveMyProfile().catch(showError);
  });

  document.getElementById('profile-save-user')?.addEventListener('click', () => {
    saveAdminUserForm().catch(showError);
  });

  document.getElementById('profile-tab-users')?.addEventListener('shown.bs.tab', () => {
    renderUsersList().catch(showError);
  });

  document.getElementById('profile-user-new')?.addEventListener('click', () => {
    resetAdminUserForm();
    document.getElementById('profile-user-new')?.classList.add('d-none');
  });
}

function showModal(id) {
  bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
}

function hideModal(id) {
  bootstrap.Modal.getInstance(document.getElementById(id))?.hide();
}

export function openProfileModal() {
  initProfileModal();
  const p = getProfile();
  if (!p) return;

  document.getElementById('profile-nombre').value = p.nombre || '';
  document.getElementById('profile-email').value = p.email || '';
  document.getElementById('profile-password').value = '';
  document.getElementById('profile-password2').value = '';

  const usersTab = document.getElementById('profile-tab-users-wrap');
  const usersPane = document.getElementById('profile-pane-users');
  if (usersTab) usersTab.classList.toggle('d-none', !isAdmin());
  if (usersPane && !isAdmin()) {
    bootstrap.Tab.getOrCreateInstance(document.getElementById('profile-tab-mine')).show();
  }

  if (isAdmin()) {
    resetAdminUserForm();
  }

  showFreeTierNotice();
  showModal('modal-profile');
}

async function saveMyProfile() {
  if (saving) return;
  const nombre = document.getElementById('profile-nombre').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const password = document.getElementById('profile-password').value;
  const password2 = document.getElementById('profile-password2').value;
  const p = getProfile();

  if (!nombre) return showError(new Error('El nombre es obligatorio'));
  if (!email) return showError(new Error('El correo es obligatorio'));
  if (password || password2) {
    if (password.length < 6) return showError(new Error('La contraseña debe tener al menos 6 caracteres'));
    if (password !== password2) return showError(new Error('Las contraseñas no coinciden'));
  }

  saving = true;
  const btn = document.getElementById('profile-save-mine');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    const sb = window.supabase;
    await requireAuth();

    const authPayload = {};
    if (email !== p.email) authPayload.email = email;
    if (password) authPayload.password = password;

    if (Object.keys(authPayload).length) {
      const { error } = await sb.auth.updateUser(authPayload);
      if (error) throw error;
    }

    const { error: profErr } = await sb.from('profiles').update({
      nombre,
      email: email !== p.email ? email : p.email,
    }).eq('id', p.id);
    if (profErr) throw profErr;

    await loadProfile();
    hideModal('modal-profile');
    toast('Cuenta actualizada');
  } finally {
    saving = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}

function resetAdminUserForm() {
  document.getElementById('profile-user-id').value = '';
  document.getElementById('profile-user-nombre').value = '';
  const emailEl = document.getElementById('profile-user-email');
  emailEl.value = '';
  emailEl.readOnly = false;
  document.getElementById('profile-user-password').value = '';
  document.getElementById('profile-user-role').value = 'leader';
  document.getElementById('profile-user-form-title').textContent = 'Nuevo usuario';
  document.getElementById('profile-save-user').textContent = 'Crear usuario';
  document.getElementById('profile-user-password-wrap')?.classList.remove('d-none');
  document.getElementById('profile-user-new')?.classList.add('d-none');
}

async function renderUsersList() {
  if (!isAdmin()) return;
  const listEl = document.getElementById('profile-users-list');
  if (!listEl) return;

  listEl.innerHTML = '<p class="text-muted small mb-0">Cargando…</p>';

  const { data, error } = await window.supabase
    .from('profiles')
    .select('*')
    .order('nombre');
  if (error) throw error;

  if (!data?.length) {
    listEl.innerHTML = '<p class="text-muted small mb-0">Sin usuarios</p>';
    return;
  }

  listEl.innerHTML = data.map((u) => `
    <div class="profile-user-row d-flex align-items-center justify-content-between py-2 border-bottom">
      <div>
        <div class="fw-semibold">${escapeHtml(u.nombre || u.email)}</div>
        <small class="text-muted">${escapeHtml(u.email)} · ${escapeHtml(roleLabel(u.role))}</small>
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary profile-edit-user" data-id="${u.id}" title="Editar">
        <i class="fa-solid fa-pen"></i>
      </button>
    </div>
  `).join('');

  listEl.querySelectorAll('.profile-edit-user').forEach((btn) => {
    btn.onclick = () => {
      const u = data.find((x) => x.id === btn.dataset.id);
      if (!u) return;
      document.getElementById('profile-user-id').value = u.id;
      document.getElementById('profile-user-nombre').value = u.nombre || '';
      const emailEl = document.getElementById('profile-user-email');
      emailEl.value = u.email;
      emailEl.readOnly = true;
      document.getElementById('profile-user-password').value = '';
      document.getElementById('profile-user-role').value = u.role;
      document.getElementById('profile-user-form-title').textContent = 'Editar usuario';
      document.getElementById('profile-save-user').textContent = 'Guardar usuario';
      document.getElementById('profile-user-password-wrap')?.classList.add('d-none');
      document.getElementById('profile-user-new')?.classList.remove('d-none');
    };
  });
}

async function createTroopUser({ email, password, nombre, role }) {
  const sb = window.supabase;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('No autenticado');

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });
  if (error) throw error;
  if (!data.user?.id) throw new Error('No se pudo crear el usuario. ¿Confirmación de correo activada?');

  const newUserId = data.user.id;

  const { error: restoreErr } = await sb.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (restoreErr) throw restoreErr;

  const { error: profErr } = await sb.from('profiles')
    .upsert({ id: newUserId, nombre, role, email });
  if (profErr) throw profErr;
}

async function saveAdminUserForm() {
  if (saving || !isAdmin()) return;

  const id = document.getElementById('profile-user-id').value;
  const nombre = document.getElementById('profile-user-nombre').value.trim();
  const email = document.getElementById('profile-user-email').value.trim();
  const password = document.getElementById('profile-user-password').value;
  const role = document.getElementById('profile-user-role').value;

  if (!nombre) return showError(new Error('El nombre es obligatorio'));
  if (!email) return showError(new Error('El correo es obligatorio'));
  if (!id && (!password || password.length < 6)) {
    return showError(new Error('La contraseña debe tener al menos 6 caracteres'));
  }
  if (id && password && password.length < 6) {
    return showError(new Error('La contraseña debe tener al menos 6 caracteres'));
  }

  saving = true;
  const btn = document.getElementById('profile-save-user');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    if (!id) {
      await createTroopUser({ email, password, nombre, role });
      toast('Usuario creado');
      resetAdminUserForm();
    } else {
      const { error } = await window.supabase.from('profiles')
        .update({ nombre, role })
        .eq('id', id);
      if (error) throw error;
      toast('Usuario actualizado');
    }

    await renderUsersList();
  } finally {
    saving = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = id ? 'Guardar usuario' : 'Crear usuario';
    }
  }
}
