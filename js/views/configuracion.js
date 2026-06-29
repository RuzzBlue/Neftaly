import { refreshData, getState, resetTroopData, getCargoNames, isAdmin } from '../data.js';
import { setCurrentCiclo } from '../auth.js';
import { CICLOS } from '../constants.js';
import { escapeHtml, showError, toast } from '../utils.js';

const COLOR_PRESETS = [
  '#E67E22', '#9B59B6', '#34495E', '#D35400', '#1ABC9C', '#E74C3C',
  '#0d6efd', '#198754', '#ffc107', '#6c757d', '#fd7e14', '#20c997',
];

let configModalsReady = false;
let deleteConfirmHandler = null;
let saving = false;

export async function renderConfiguracion() {
  if (!isAdmin()) return;
  await refreshData();
  const el = document.getElementById('view-config');
  const { patrullas, miembros, cargos, ciclo } = getState();

  el.innerHTML = `
    <h5 class="mb-3">Configuración</h5>

    <div class="card mb-3">
      <div class="card-header">Ciclo actual</div>
      <div class="card-body">
        <p class="small text-muted">Los puntos y bitácora se guardan por ciclo (1, 2, 3). Cambiar ciclo muestra/edita datos de ese ciclo.</p>
        <div class="btn-group">${CICLOS.map((c) =>
          `<button type="button" class="btn btn-outline-primary ${c === ciclo ? 'active' : ''}" data-ciclo="${c}">Ciclo ${c}</button>`
        ).join('')}</div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Patrullas</span>
        <button class="btn btn-sm btn-primary" id="cfg-add-patrulla"><i class="fa-solid fa-plus me-1"></i>Nueva</button>
      </div>
      <ul class="list-group list-group-flush">
        ${patrullas.map((p) => cfgPatrullaRow(p)).join('') || '<li class="list-group-item text-muted">Sin patrullas</li>'}
      </ul>
    </div>

    <div class="card mb-3">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Miembros</span>
        <button class="btn btn-sm btn-primary" id="cfg-add-miembro"><i class="fa-solid fa-plus me-1"></i>Nuevo</button>
      </div>
      <div class="list-group list-group-flush">
        ${miembros.map((m) => cfgMiembroRow(m, patrullas)).join('') || '<div class="list-group-item text-muted">Sin miembros</div>'}
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Cargos de patrulla</span>
        <button class="btn btn-sm btn-primary" id="cfg-add-cargo"><i class="fa-solid fa-plus me-1"></i>Nuevo</button>
      </div>
      <ul class="list-group list-group-flush">
        ${cargos.map((c) => cfgCargoRow(c)).join('') || '<li class="list-group-item text-muted">Sin cargos</li>'}
      </ul>
    </div>

    <div class="danger-zone">
      <h6 class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Zona peligrosa — nuevo año</h6>
      <p class="small mb-2">Reinicia puntos y ciclo para un año nuevo. Elige qué conservar antes de confirmar.</p>
      <button class="btn btn-danger btn-sm" id="btn-clear-all">Reiniciar tropa…</button>
    </div>`;

  el.querySelectorAll('[data-ciclo]').forEach((btn) => {
    btn.onclick = async () => {
      await setCurrentCiclo(parseInt(btn.dataset.ciclo, 10));
      toast(`Ciclo ${btn.dataset.ciclo} activo`);
      renderConfiguracion();
    };
  });

  document.getElementById('cfg-add-patrulla').onclick = () => openPatrullaModal(null);
  document.getElementById('cfg-add-miembro').onclick = () => openMiembroModal(null);
  document.getElementById('cfg-add-cargo').onclick = () => openCargoModal(null);
  document.getElementById('btn-clear-all').onclick = openResetTroopModal;

  el.querySelectorAll('.cfg-edit-patrulla').forEach((b) => {
    b.onclick = () => openPatrullaModal(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-del-patrulla').forEach((b) => {
    b.onclick = () => confirmDeletePatrulla(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-edit-miembro').forEach((b) => {
    b.onclick = () => openMiembroModal(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-del-miembro').forEach((b) => {
    b.onclick = () => confirmDeleteMiembro(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-edit-cargo').forEach((b) => {
    b.onclick = () => openCargoModal(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-del-cargo').forEach((b) => {
    b.onclick = () => confirmDeleteCargo(parseInt(b.dataset.id, 10));
  });
}

function cfgPatrullaRow(p) {
  return `<li class="list-group-item d-flex justify-content-between align-items-center">
    <span><span class="color-swatch me-2" style="background:${escapeHtml(p.color)}"></span>${escapeHtml(p.nombre)}</span>
    <span class="cfg-list-actions">
      <button type="button" class="btn btn-sm btn-outline-secondary cfg-edit-patrulla" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="btn btn-sm btn-outline-danger cfg-del-patrulla" data-id="${p.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
    </span>
  </li>`;
}

function cfgMiembroRow(m, patrullas) {
  const pat = patrullas.find((p) => p.id === m.patrulla_id);
  const badges = [];
  if (m.es_guia) badges.push('<span class="badge badge-guia me-1">Guía</span>');
  if (m.es_subguia) badges.push('<span class="badge badge-subguia me-1">Subguía</span>');
  getCargoNames(m.id).forEach((c) => badges.push(`<span class="badge bg-secondary me-1">${escapeHtml(c)}</span>`));
  return `<div class="list-group-item d-flex justify-content-between align-items-start">
    <div>
      <strong>${escapeHtml(m.nombre)}</strong>
      <div class="small text-muted">${escapeHtml(pat?.nombre || '')}</div>
      ${badges.length ? `<div class="mt-1">${badges.join('')}</div>` : ''}
    </div>
    <span class="cfg-list-actions flex-shrink-0 ms-2">
      <button type="button" class="btn btn-sm btn-outline-secondary cfg-edit-miembro" data-id="${m.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="btn btn-sm btn-outline-danger cfg-del-miembro" data-id="${m.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
    </span>
  </div>`;
}

function cfgCargoRow(c) {
  return `<li class="list-group-item d-flex justify-content-between align-items-center">
    <span>${escapeHtml(c.nombre)}</span>
    <span class="cfg-list-actions">
      <button type="button" class="btn btn-sm btn-outline-secondary cfg-edit-cargo" data-id="${c.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="btn btn-sm btn-outline-danger cfg-del-cargo" data-id="${c.id}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
    </span>
  </li>`;
}

// ─── Modals init ───────────────────────────────────────────

export function initConfigModals() {
  if (configModalsReady) return;
  configModalsReady = true;

  buildColorPresets();
  syncColorInputs();

  document.getElementById('cfg-patrulla-color')?.addEventListener('input', () => {
    const hex = document.getElementById('cfg-patrulla-color').value;
    document.getElementById('cfg-patrulla-color-hex').value = hex;
    updatePatrullaPreview();
    highlightPreset(hex);
  });
  document.getElementById('cfg-patrulla-color-hex')?.addEventListener('input', () => {
    let hex = document.getElementById('cfg-patrulla-color-hex').value.trim();
    if (!hex.startsWith('#')) hex = `#${hex}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      document.getElementById('cfg-patrulla-color').value = hex;
      updatePatrullaPreview();
      highlightPreset(hex);
    }
  });
  document.getElementById('cfg-patrulla-nombre')?.addEventListener('input', updatePatrullaPreview);

  document.getElementById('cfg-miembro-guia')?.addEventListener('change', (e) => {
    if (e.target.checked) document.getElementById('cfg-miembro-subguia').checked = false;
  });
  document.getElementById('cfg-miembro-subguia')?.addEventListener('change', (e) => {
    if (e.target.checked) document.getElementById('cfg-miembro-guia').checked = false;
  });

  document.getElementById('cfg-patrulla-save')?.addEventListener('click', () => savePatrullaModal().catch(showError));
  document.getElementById('cfg-miembro-save')?.addEventListener('click', () => saveMiembroModal().catch(showError));
  document.getElementById('cfg-cargo-save')?.addEventListener('click', () => saveCargoModal().catch(showError));
  document.getElementById('cfg-delete-confirm')?.addEventListener('click', () => {
    if (deleteConfirmHandler) deleteConfirmHandler().catch(showError);
  });
}

function buildColorPresets() {
  const row = document.getElementById('cfg-patrulla-presets');
  if (!row) return;
  row.innerHTML = COLOR_PRESETS.map((c) =>
    `<button type="button" class="color-preset" data-color="${c}" style="background:${c}" title="${c}"></button>`
  ).join('');
  row.querySelectorAll('.color-preset').forEach((btn) => {
    btn.onclick = () => {
      const hex = btn.dataset.color;
      document.getElementById('cfg-patrulla-color').value = hex;
      document.getElementById('cfg-patrulla-color-hex').value = hex;
      highlightPreset(hex);
      updatePatrullaPreview();
    };
  });
}

function highlightPreset(hex) {
  document.querySelectorAll('.color-preset').forEach((b) => {
    b.classList.toggle('active', b.dataset.color.toLowerCase() === hex.toLowerCase());
  });
}

function syncColorInputs() {
  /* presets built once in init */
}

function updatePatrullaPreview() {
  const nombre = document.getElementById('cfg-patrulla-nombre')?.value.trim() || 'Vista previa';
  const color = document.getElementById('cfg-patrulla-color')?.value || '#6c757d';
  const el = document.getElementById('cfg-patrulla-preview');
  if (el) {
    el.textContent = nombre;
    el.style.background = color;
    el.style.color = parseInt(color.slice(1), 16) > 0xffffff / 2 ? '#212529' : '#fff';
  }
}

function showModal(id) {
  bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
}

function hideModal(id) {
  bootstrap.Modal.getInstance(document.getElementById(id))?.hide();
}

// ─── Patrulla ──────────────────────────────────────────────

function openPatrullaModal(id) {
  initConfigModals();
  const isEdit = id != null;
  const p = isEdit ? getState().patrullas.find((x) => x.id === id) : null;
  document.getElementById('modal-cfg-patrulla-title').textContent = isEdit ? 'Editar patrulla' : 'Nueva patrulla';
  document.getElementById('cfg-patrulla-id').value = isEdit ? id : '';
  document.getElementById('cfg-patrulla-nombre').value = p?.nombre || '';
  const color = p?.color || '#6c757d';
  document.getElementById('cfg-patrulla-color').value = color;
  document.getElementById('cfg-patrulla-color-hex').value = color;
  highlightPreset(color);
  updatePatrullaPreview();
  showModal('modal-cfg-patrulla');
}

async function savePatrullaModal() {
  if (saving) return;
  const nombre = document.getElementById('cfg-patrulla-nombre').value.trim();
  let color = document.getElementById('cfg-patrulla-color-hex').value.trim();
  if (!color.startsWith('#')) color = `#${color}`;
  const id = document.getElementById('cfg-patrulla-id').value;

  if (!nombre) return showError(new Error('El nombre es obligatorio'));
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return showError(new Error('Color inválido (usa #RRGGBB)'));

  saving = true;
  try {
    if (id) {
      const { error } = await window.supabase.from('patrullas').update({ nombre, color }).eq('id', parseInt(id, 10));
      if (error) throw error;
      toast('Patrulla actualizada');
    } else {
      const { error } = await window.supabase.from('patrullas').insert({ nombre, color, orden: 99 });
      if (error) throw error;
      toast('Patrulla creada');
    }
    hideModal('modal-cfg-patrulla');
    renderConfiguracion();
  } finally {
    saving = false;
  }
}

function confirmDeletePatrulla(id) {
  const p = getState().patrullas.find((x) => x.id === id);
  openDeleteModal(`¿Eliminar la patrulla "${p?.nombre}"? Debe no tener miembros asignados.`, async () => {
    const { error } = await window.supabase.from('patrullas').delete().eq('id', id);
    if (error) throw error;
    hideModal('modal-cfg-delete');
    toast('Patrulla eliminada', 'warning');
    renderConfiguracion();
  });
}

// ─── Miembro ───────────────────────────────────────────────

function openMiembroModal(id) {
  initConfigModals();
  const isEdit = id != null;
  const m = isEdit ? getState().miembros.find((x) => x.id === id) : null;
  const { patrullas, cargos, miembroCargos } = getState();

  document.getElementById('modal-cfg-miembro-title').textContent = isEdit ? 'Editar miembro' : 'Nuevo miembro';
  document.getElementById('cfg-miembro-id').value = isEdit ? id : '';
  document.getElementById('cfg-miembro-nombre').value = m?.nombre || '';
  document.getElementById('cfg-miembro-patrulla').innerHTML = patrullas
    .map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  if (m) document.getElementById('cfg-miembro-patrulla').value = String(m.patrulla_id);
  else if (patrullas[0]) document.getElementById('cfg-miembro-patrulla').value = String(patrullas[0].id);

  document.getElementById('cfg-miembro-guia').checked = !!m?.es_guia;
  document.getElementById('cfg-miembro-subguia').checked = !!m?.es_subguia;

  const assigned = isEdit
    ? miembroCargos.filter((x) => x.miembro_id === id).map((x) => x.cargo_id)
    : [];
  const cargoBox = document.getElementById('cfg-miembro-cargos');
  const emptyMsg = document.getElementById('cfg-miembro-cargos-empty');
  if (cargos.length) {
    emptyMsg.classList.add('d-none');
    cargoBox.innerHTML = cargos.map((c) =>
      `<div class="form-check">
        <input class="form-check-input cfg-cargo-check" type="checkbox" value="${c.id}" id="cfg-cargo-ch-${c.id}" ${assigned.includes(c.id) ? 'checked' : ''}>
        <label class="form-check-label" for="cfg-cargo-ch-${c.id}">${escapeHtml(c.nombre)}</label>
      </div>`
    ).join('');
  } else {
    cargoBox.innerHTML = '';
    emptyMsg.classList.remove('d-none');
  }

  showModal('modal-cfg-miembro');
}

async function syncMiembroCargos(miembroId, selectedIds) {
  const { miembroCargos } = getState();
  const current = miembroCargos.filter((x) => x.miembro_id === miembroId).map((x) => x.cargo_id);
  const toAdd = selectedIds.filter((cid) => !current.includes(cid));
  const toRemove = current.filter((cid) => !selectedIds.includes(cid));

  for (const cargo_id of toAdd) {
    const { error } = await window.supabase.from('miembro_cargos').insert({ miembro_id: miembroId, cargo_id });
    if (error) throw error;
  }
  for (const cargo_id of toRemove) {
    const { error } = await window.supabase.from('miembro_cargos')
      .delete()
      .eq('miembro_id', miembroId)
      .eq('cargo_id', cargo_id);
    if (error) throw error;
  }
}

async function saveMiembroModal() {
  if (saving) return;
  const nombre = document.getElementById('cfg-miembro-nombre').value.trim();
  const patrulla_id = parseInt(document.getElementById('cfg-miembro-patrulla').value, 10);
  const es_guia = document.getElementById('cfg-miembro-guia').checked;
  const es_subguia = document.getElementById('cfg-miembro-subguia').checked;
  const idVal = document.getElementById('cfg-miembro-id').value;
  const cargoIds = [...document.querySelectorAll('.cfg-cargo-check:checked')].map((el) => parseInt(el.value, 10));

  if (!nombre) return showError(new Error('El nombre es obligatorio'));
  if (!patrulla_id) return showError(new Error('Selecciona una patrulla'));

  const payload = { nombre, patrulla_id, es_guia, es_subguia };

  saving = true;
  try {
    let miembroId;
    if (idVal) {
      miembroId = parseInt(idVal, 10);
      const { error } = await window.supabase.from('miembros').update(payload).eq('id', miembroId);
      if (error) throw error;
      toast('Miembro actualizado');
    } else {
      const { data, error } = await window.supabase.from('miembros').insert(payload).select().single();
      if (error) throw error;
      miembroId = data.id;
      toast('Miembro creado');
    }
    await syncMiembroCargos(miembroId, cargoIds);
    await refreshData();
    hideModal('modal-cfg-miembro');
    renderConfiguracion();
  } finally {
    saving = false;
  }
}

function confirmDeleteMiembro(id) {
  const m = getState().miembros.find((x) => x.id === id);
  openDeleteModal(`¿Eliminar a "${m?.nombre}"? Se ocultará de la lista (datos históricos se conservan).`, async () => {
    const { error } = await window.supabase.from('miembros').update({ activo: false }).eq('id', id);
    if (error) throw error;
    hideModal('modal-cfg-delete');
    toast('Miembro eliminado', 'warning');
    renderConfiguracion();
  });
}

// ─── Cargo ─────────────────────────────────────────────────

function openCargoModal(id) {
  initConfigModals();
  const isEdit = id != null;
  const c = isEdit ? getState().cargos.find((x) => x.id === id) : null;
  document.getElementById('modal-cfg-cargo-title').textContent = isEdit ? 'Editar cargo' : 'Nuevo cargo';
  document.getElementById('cfg-cargo-id').value = isEdit ? id : '';
  document.getElementById('cfg-cargo-nombre').value = c?.nombre || '';
  showModal('modal-cfg-cargo');
}

async function saveCargoModal() {
  if (saving) return;
  const nombre = document.getElementById('cfg-cargo-nombre').value.trim();
  const idVal = document.getElementById('cfg-cargo-id').value;

  if (!nombre) return showError(new Error('El nombre es obligatorio'));

  saving = true;
  try {
    if (idVal) {
      const { error } = await window.supabase.from('cargos').update({ nombre }).eq('id', parseInt(idVal, 10));
      if (error) throw error;
      toast('Cargo actualizado');
    } else {
      const { error } = await window.supabase.from('cargos').insert({ nombre, orden: 99 });
      if (error) throw error;
      toast('Cargo creado');
    }
    hideModal('modal-cfg-cargo');
    renderConfiguracion();
  } finally {
    saving = false;
  }
}

function confirmDeleteCargo(id) {
  const c = getState().cargos.find((x) => x.id === id);
  openDeleteModal(`¿Eliminar el cargo "${c?.nombre}"? Se quitará de quienes lo tengan asignado.`, async () => {
    const { error } = await window.supabase.from('cargos').delete().eq('id', id);
    if (error) throw error;
    hideModal('modal-cfg-delete');
    toast('Cargo eliminado', 'warning');
    renderConfiguracion();
  });
}

// ─── Delete confirm ────────────────────────────────────────

function openDeleteModal(message, onConfirm) {
  document.getElementById('cfg-delete-message').textContent = message;
  deleteConfirmHandler = onConfirm;
  showModal('modal-cfg-delete');
}

// ─── Reset tropa (sin cambios) ─────────────────────────────

let resetModalReady = false;
let resetSubmitting = false;

function updateResetSummary() {
  const keepPat = document.getElementById('reset-keep-patrullas')?.checked;
  const keepMem = document.getElementById('reset-keep-miembros')?.checked;
  const keepAsis = document.getElementById('reset-keep-asistencia')?.checked;
  const el = document.getElementById('reset-summary');
  if (!el) return;

  const keep = [];
  const remove = ['Puntos de patrullas', 'Puntos personales', 'Registro de acciones'];
  if (keepPat) keep.push('Patrullas (nombres y colores)');
  else remove.push('Patrullas');
  if (keepMem) keep.push('Miembros y cargos');
  else remove.push('Miembros y cargos');
  if (keepAsis) keep.push('Asistencias pasadas');
  else remove.push('Asistencias');

  el.innerHTML = `
    <div><strong>Se conservará:</strong> ${keep.length ? keep.join(', ') : 'Nada'}</div>
    <div class="mt-1"><strong>Se eliminará:</strong> ${remove.join(', ')}</div>
    <div class="mt-1"><strong>Ciclo:</strong> se reinicia a 1</div>`;
}

function syncResetCheckboxes() {
  const pat = document.getElementById('reset-keep-patrullas');
  const mem = document.getElementById('reset-keep-miembros');
  const asis = document.getElementById('reset-keep-asistencia');
  if (!pat || !mem || !asis) return;

  mem.disabled = !pat.checked;
  if (!pat.checked) {
    mem.checked = false;
    asis.checked = false;
  }
  asis.disabled = !mem.checked;
  if (!mem.checked) asis.checked = false;

  updateResetSummary();
  updateResetConfirmBtn();
}

function updateResetConfirmBtn() {
  const text = document.getElementById('reset-confirm-text')?.value.trim();
  const btn = document.getElementById('reset-submit');
  if (btn) btn.disabled = text !== 'BORRAR' || resetSubmitting;
}

export function initResetModal() {
  if (resetModalReady) return;
  resetModalReady = true;

  document.getElementById('reset-keep-patrullas')?.addEventListener('change', syncResetCheckboxes);
  document.getElementById('reset-keep-miembros')?.addEventListener('change', syncResetCheckboxes);
  document.getElementById('reset-keep-asistencia')?.addEventListener('change', syncResetCheckboxes);
  document.getElementById('reset-confirm-text')?.addEventListener('input', updateResetConfirmBtn);
  document.getElementById('reset-submit')?.addEventListener('click', () => {
    submitResetTroopModal().catch(showError);
  });
  document.getElementById('modal-reset-troop')?.addEventListener('hidden.bs.modal', () => {
    document.getElementById('reset-confirm-text').value = '';
    document.getElementById('reset-keep-patrullas').checked = false;
    syncResetCheckboxes();
  });
}

export function openResetTroopModal() {
  initResetModal();
  document.getElementById('reset-confirm-text').value = '';
  document.getElementById('reset-keep-patrullas').checked = false;
  syncResetCheckboxes();
  showModal('modal-reset-troop');
}

export async function submitResetTroopModal() {
  if (resetSubmitting) return;
  const confirmText = document.getElementById('reset-confirm-text')?.value.trim();
  if (confirmText !== 'BORRAR') return;

  const keepPatrullas = document.getElementById('reset-keep-patrullas').checked;
  const keepMiembros = document.getElementById('reset-keep-miembros').checked;
  const keepAsistencia = document.getElementById('reset-keep-asistencia').checked;

  resetSubmitting = true;
  updateResetConfirmBtn();
  const btn = document.getElementById('reset-submit');
  if (btn) btn.textContent = 'Reiniciando…';

  try {
    await resetTroopData({ keepPatrullas, keepMiembros, keepAsistencia });
    hideModal('modal-reset-troop');
    toast('Tropa reiniciada', 'warning');
    renderConfiguracion();
  } finally {
    resetSubmitting = false;
    if (btn) btn.textContent = 'Confirmar reinicio';
    updateResetConfirmBtn();
  }
}
