import {
  refreshData, getState, patrullaPoints, memberCountsForPatrulla,
  patrullaAreaTotals, memberAreaPoints, getCargoNames,
  addPatrullaPoints, addCrecimientoPoints, isAdmin, escapeHtml,
} from '../data.js';
import { AREAS } from '../constants.js';

let stack = [];
let submittingPatrulla = false;
let submittingMember = false;

export async function renderOverview() {
  await refreshData();
  stack = ['list'];
  renderList();
}

function renderList() {
  const el = document.getElementById('view-resumen');
  const { patrullas } = getState();
  const cards = patrullas.map((p) => {
    const pts = patrullaPoints(p.id);
    const c = memberCountsForPatrulla(p.id);
    return `
      <div class="col-6">
        <div class="card patrulla-card h-100" data-patrulla="${p.id}" style="--patrulla-color:${escapeHtml(p.color)}">
          <div class="card-body text-center py-3">
            <div class="fw-bold mb-1">${escapeHtml(p.nombre)}</div>
            <div class="total-num text-primary">${pts}</div>
            <small class="text-muted d-block">puntos</small>
            <hr class="my-2">
            <small class="d-block"><strong>${c.total}</strong> miembros</small>
            <small class="d-block text-success">Constantes: ${c.constantes}</small>
            <small class="d-block text-secondary">En lista: ${c.enLista}</small>
          </div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="d-grid grid-cols-2 gap-2 mb-3" style="grid-template-columns:1fr 1fr;display:grid;">
      <button type="button" class="btn btn-points-add btn-lg" id="btn-add-patrulla-pts">
        <i class="fa-solid fa-plus me-1"></i> Sumar
      </button>
      <button type="button" class="btn btn-points-sub btn-lg" id="btn-sub-patrulla-pts">
        <i class="fa-solid fa-minus me-1"></i> Restar
      </button>
    </div>
    <div class="row g-2">${cards}</div>`;

  el.querySelector('#btn-add-patrulla-pts').onclick = () => openPatrullaModal('add');
  el.querySelector('#btn-sub-patrulla-pts').onclick = () => openPatrullaModal('sub');
  el.querySelectorAll('.patrulla-card').forEach((card) => {
    card.onclick = () => showPatrullaDetail(parseInt(card.dataset.patrulla, 10));
  });
}

function openPatrullaModal(mode) {
  const { patrullas } = getState();
  const isAdd = mode === 'add';
  const modal = document.getElementById('modal-puntos-patrulla');
  const header = modal.querySelector('.modal-header');
  header.className = `modal-header ${isAdd ? 'add-points' : 'sub-points'}`;
  modal.querySelector('.modal-title').textContent = isAdd ? 'Sumar puntos' : 'Restar puntos';
  modal.querySelector('#ppt-patrulla').innerHTML = patrullas
    .map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  modal.querySelector('#ppt-cantidad').value = '1';
  modal.querySelector('#ppt-nota').value = '';
  modal.dataset.mode = mode;
  bootstrap.Modal.getOrCreateInstance(modal).show();
}

export async function submitPatrullaPointsModal() {
  if (submittingPatrulla) return;
  submittingPatrulla = true;
  const btn = document.getElementById('ppt-submit');
  if (btn) btn.disabled = true;
  try {
    const modal = document.getElementById('modal-puntos-patrulla');
    const mode = modal.dataset.mode;
    const patrullaId = parseInt(modal.querySelector('#ppt-patrulla').value, 10);
    let cant = parseInt(modal.querySelector('#ppt-cantidad').value, 10);
    const nota = modal.querySelector('#ppt-nota').value.trim();
    if (!cant || cant < 1) return;
    if (mode === 'sub') cant = -cant;
    await addPatrullaPoints(patrullaId, cant, nota);
    bootstrap.Modal.getInstance(modal).hide();
    renderList();
  } finally {
    submittingPatrulla = false;
    if (btn) btn.disabled = false;
  }
}

function showPatrullaDetail(patrullaId) {
  stack.push('patrulla');
  const { patrullas, miembros, ciclo } = getState();
  const p = patrullas.find((x) => x.id === patrullaId);
  const members = miembros.filter((m) => m.patrulla_id === patrullaId);
  const areas = patrullaAreaTotals(patrullaId);
  const areaHtml = `
    <div class="area-grid-patrulla">
      ${AREAS.map((a) =>
        `<div class="area-compact">${a.label}: <strong>${areas[a.key] || 0}</strong></div>`
      ).join('')}
    </div>`;

  const list = members.map((m) => {
    const badges = [];
    if (m.es_guia) badges.push('<span class="badge badge-guia me-1">Guía</span>');
    if (m.es_subguia) badges.push('<span class="badge badge-subguia me-1">Subguía</span>');
    getCargoNames(m.id).forEach((c) => badges.push(`<span class="badge bg-secondary me-1">${escapeHtml(c)}</span>`));
    return `<div class="member-row" data-member="${m.id}">
      <span>${escapeHtml(m.nombre)} ${badges.join('')}</span>
      <i class="fa-solid fa-chevron-right text-muted"></i>
    </div>`;
  }).join('');

  document.getElementById('view-resumen').innerHTML = `
    <button class="btn btn-link ps-0 mb-2" id="btn-back-overview"><i class="fa-solid fa-arrow-left"></i> Volver</button>
    <div class="d-flex align-items-center gap-2 mb-2">
      <span class="color-swatch" style="background:${escapeHtml(p.color)}"></span>
      <h4 class="mb-0">${escapeHtml(p.nombre)}</h4>
      ${isAdmin() ? `<button class="btn btn-sm btn-outline-secondary ms-auto" id="btn-edit-patrulla"><i class="fa-solid fa-pen"></i></button>` : ''}
    </div>
    <p class="text-muted small mb-2">Ciclo ${ciclo} · ${patrullaPoints(patrullaId)} pts patrulla</p>
    <h6 class="mb-1">Áreas de crecimiento (total patrulla)</h6>
    ${areaHtml}
    <h6 class="mt-2 mb-2">Miembros</h6>
    <div class="bg-white rounded p-2">${list || '<p class="text-muted mb-0">Sin miembros</p>'}</div>`;

  document.getElementById('btn-back-overview').onclick = () => { stack.pop(); renderList(); };
  document.querySelectorAll('.member-row').forEach((row) => {
    row.onclick = () => showMemberDetail(parseInt(row.dataset.member, 10));
  });
  if (isAdmin()) {
    document.getElementById('btn-edit-patrulla').onclick = () => editPatrulla(p);
  }
}

async function editPatrulla(p) {
  const nombre = prompt('Nombre de la patrulla:', p.nombre);
  if (!nombre) return;
  const color = prompt('Color (hex):', p.color) || p.color;
  await window.supabase.from('patrullas').update({ nombre, color }).eq('id', p.id);
  await refreshData();
  showPatrullaDetail(p.id);
}

function showMemberDetail(miembroId) {
  stack.push('member');
  const { miembros, patrullas, ciclo } = getState();
  const m = miembros.find((x) => x.id === miembroId);
  const pat = patrullas.find((p) => p.id === m.patrulla_id);
  const areas = memberAreaPoints(miembroId);
  const areaHtml = AREAS.map((a) =>
    `<div class="area-badge"><span>${a.label}</span><strong>${areas[a.key] || 0}</strong></div>`
  ).join('');

  document.getElementById('view-resumen').innerHTML = `
    <button class="btn btn-link ps-0 mb-2" id="btn-back-patrulla"><i class="fa-solid fa-arrow-left"></i> Volver</button>
    <div class="d-grid grid-cols-2 gap-2 mb-3" style="grid-template-columns:1fr 1fr;display:grid;">
      <button class="btn btn-points-add" id="btn-add-member-pts"><i class="fa-solid fa-plus"></i> Sumar</button>
      <button class="btn btn-points-sub" id="btn-sub-member-pts"><i class="fa-solid fa-minus"></i> Restar</button>
    </div>
    <h4>${escapeHtml(m.nombre)}</h4>
    <p class="text-muted">${escapeHtml(pat?.nombre || '')} · Ciclo ${ciclo}</p>
    <h6>Bitácora — áreas de crecimiento</h6>
    ${areaHtml}`;

  document.getElementById('btn-back-patrulla').onclick = () => {
    stack.pop();
    showPatrullaDetail(m.patrulla_id);
  };
  document.getElementById('btn-add-member-pts').onclick = () => openMemberModal('add', miembroId);
  document.getElementById('btn-sub-member-pts').onclick = () => openMemberModal('sub', miembroId);
}

function openMemberModal(mode, miembroId) {
  const modal = document.getElementById('modal-puntos-miembro');
  const isAdd = mode === 'add';
  const header = modal.querySelector('.modal-header');
  header.className = `modal-header ${isAdd ? 'add-points' : 'sub-points'}`;
  modal.querySelector('.modal-title').textContent = isAdd ? 'Sumar puntos personales' : 'Restar puntos personales';
  modal.querySelector('#pmb-area').innerHTML = AREAS
    .map((a) => `<option value="${a.key}">${a.label}</option>`).join('');
  modal.querySelector('#pmb-cantidad').value = '1';
  modal.querySelector('#pmb-nota').value = '';
  modal.dataset.mode = mode;
  modal.dataset.miembro = miembroId;
  bootstrap.Modal.getOrCreateInstance(modal).show();
}

export async function submitMemberPointsModal() {
  if (submittingMember) return;
  submittingMember = true;
  const btn = document.getElementById('pmb-submit');
  if (btn) btn.disabled = true;
  try {
    const modal = document.getElementById('modal-puntos-miembro');
    const mode = modal.dataset.mode;
    const miembroId = parseInt(modal.dataset.miembro, 10);
    const area = modal.querySelector('#pmb-area').value;
    let cant = parseInt(modal.querySelector('#pmb-cantidad').value, 10);
    const nota = modal.querySelector('#pmb-nota').value.trim();
    if (!cant || cant < 1) return;
    if (mode === 'sub') cant = -cant;
    await addCrecimientoPoints(miembroId, area, cant, nota);
    bootstrap.Modal.getInstance(modal).hide();
    showMemberDetail(miembroId);
  } finally {
    submittingMember = false;
    if (btn) btn.disabled = false;
  }
}
