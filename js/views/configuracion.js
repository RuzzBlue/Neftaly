import { refreshData, getState, clearAllData, isAdmin } from '../data.js';
import { setCurrentCiclo } from '../auth.js';
import { AREAS, CICLOS } from '../constants.js';
import { escapeHtml, showError, toast } from '../utils.js';

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
      <div class="card-header d-flex justify-content-between">
        <span>Patrullas</span>
        <button class="btn btn-sm btn-primary" id="cfg-add-patrulla">+ Nueva</button>
      </div>
      <ul class="list-group list-group-flush" id="cfg-patrullas-list">
        ${patrullas.map((p) => cfgPatrullaRow(p)).join('')}
      </ul>
    </div>

    <div class="card mb-3">
      <div class="card-header d-flex justify-content-between">
        <span>Miembros</span>
        <button class="btn btn-sm btn-primary" id="cfg-add-miembro">+ Nuevo</button>
      </div>
      <div class="list-group list-group-flush" id="cfg-miembros-list">
        ${miembros.map((m) => cfgMiembroRow(m, patrullas, cargos)).join('')}
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header d-flex justify-content-between">
        <span>Cargos de patrulla</span>
        <button class="btn btn-sm btn-primary" id="cfg-add-cargo">+ Nuevo</button>
      </div>
      <ul class="list-group list-group-flush" id="cfg-cargos-list">
        ${cargos.map((c) => `<li class="list-group-item d-flex justify-content-between align-items-center">
          ${escapeHtml(c.nombre)}
          <button class="btn btn-sm btn-outline-danger cfg-del-cargo" data-id="${c.id}"><i class="fa-solid fa-trash"></i></button>
        </li>`).join('')}
      </ul>
    </div>

    <div class="danger-zone">
      <h6 class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Zona peligrosa — nuevo año</h6>
      <p class="small mb-2">Borra patrullas, miembros, puntos, asistencia y logs. Reinicia al ciclo 1. Solo usar al empezar un año scout nuevo.</p>
      <button class="btn btn-danger btn-sm" id="btn-clear-all">Borrar todo y reiniciar</button>
    </div>`;

  el.querySelectorAll('[data-ciclo]').forEach((btn) => {
    btn.onclick = async () => {
      await setCurrentCiclo(parseInt(btn.dataset.ciclo, 10));
      toast(`Ciclo ${btn.dataset.ciclo} activo`);
      renderConfiguracion();
    };
  });

  document.getElementById('cfg-add-patrulla').onclick = addPatrulla;
  document.getElementById('cfg-add-miembro').onclick = addMiembro;
  document.getElementById('cfg-add-cargo').onclick = addCargo;
  document.getElementById('btn-clear-all').onclick = onClearAll;
  el.querySelectorAll('.cfg-del-cargo').forEach((b) => {
    b.onclick = () => deleteCargo(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-edit-patrulla').forEach((b) => {
    b.onclick = () => editPatrullaCfg(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-del-patrulla').forEach((b) => {
    b.onclick = () => deletePatrulla(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-edit-miembro').forEach((b) => {
    b.onclick = () => editMiembroCfg(parseInt(b.dataset.id, 10));
  });
  el.querySelectorAll('.cfg-del-miembro').forEach((b) => {
    b.onclick = () => deleteMiembro(parseInt(b.dataset.id, 10));
  });
}

function cfgPatrullaRow(p) {
  return `<li class="list-group-item d-flex justify-content-between align-items-center">
    <span><span class="color-swatch me-2" style="background:${escapeHtml(p.color)}"></span>${escapeHtml(p.nombre)}</span>
    <span>
      <button class="btn btn-sm btn-outline-secondary cfg-edit-patrulla" data-id="${p.id}"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-sm btn-outline-danger cfg-del-patrulla" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
    </span>
  </li>`;
}

function cfgMiembroRow(m, patrullas, cargos) {
  const pat = patrullas.find((p) => p.id === m.patrulla_id);
  const roles = [m.es_guia && 'Guía', m.es_subguia && 'Subguía'].filter(Boolean).join(', ');
  return `<div class="list-group-item">
    <div class="d-flex justify-content-between">
      <div>
        <strong>${escapeHtml(m.nombre)}</strong>
        <div class="small text-muted">${escapeHtml(pat?.nombre || '')}${roles ? ' · ' + roles : ''}</div>
      </div>
      <span>
        <button class="btn btn-sm btn-outline-secondary cfg-edit-miembro" data-id="${m.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-danger cfg-del-miembro" data-id="${m.id}"><i class="fa-solid fa-trash"></i></button>
      </span>
    </div>
  </div>`;
}

async function addPatrulla() {
  const nombre = prompt('Nombre de la patrulla:');
  if (!nombre) return;
  const color = prompt('Color hex:', '#6c757d') || '#6c757d';
  const { error } = await window.supabase.from('patrullas').insert({ nombre, color, orden: 99 });
  if (error) return showError(error);
  renderConfiguracion();
}

async function editPatrullaCfg(id) {
  const p = getState().patrullas.find((x) => x.id === id);
  const nombre = prompt('Nombre:', p.nombre);
  if (!nombre) return;
  const color = prompt('Color:', p.color) || p.color;
  await window.supabase.from('patrullas').update({ nombre, color }).eq('id', id);
  renderConfiguracion();
}

async function deletePatrulla(id) {
  if (!confirm('¿Eliminar patrulla? Debe no tener miembros.')) return;
  const { error } = await window.supabase.from('patrullas').delete().eq('id', id);
  if (error) showError(error);
  else renderConfiguracion();
}

async function addMiembro() {
  const { patrullas, cargos } = getState();
  const nombre = prompt('Nombre del miembro:');
  if (!nombre) return;
  const patOpts = patrullas.map((p, i) => `${i + 1}. ${p.nombre}`).join('\n');
  const pick = parseInt(prompt(`Patrulla:\n${patOpts}\nNúmero:`), 10) - 1;
  if (pick < 0 || !patrullas[pick]) return;
  const esGuia = confirm('¿Es guía?');
  const esSub = !esGuia && confirm('¿Es subguía?');
  const { data, error } = await window.supabase.from('miembros').insert({
    nombre, patrulla_id: patrullas[pick].id, es_guia: esGuia, es_subguia: esSub,
  }).select().single();
  if (error) return showError(error);
  if (cargos.length && confirm('¿Asignar un cargo extra?')) {
    const cPick = parseInt(prompt(cargos.map((c, i) => `${i + 1}. ${c.nombre}`).join('\n') + '\nNúmero:'), 10) - 1;
    if (cargos[cPick]) {
      await window.supabase.from('miembro_cargos').insert({ miembro_id: data.id, cargo_id: cargos[cPick].id });
    }
  }
  renderConfiguracion();
}

async function editMiembroCfg(id) {
  const m = getState().miembros.find((x) => x.id === id);
  const nombre = prompt('Nombre:', m.nombre);
  if (!nombre) return;
  const { patrullas } = getState();
  const patOpts = patrullas.map((p, i) => `${i + 1}. ${p.nombre}`).join('\n');
  const pick = parseInt(prompt(`Patrulla:\n${patOpts}\nNúmero (Enter = igual):`), 10);
  const upd = { nombre, es_guia: confirm('¿Guía?'), es_subguia: confirm('¿Subguía?') };
  if (pick > 0 && patrullas[pick - 1]) upd.patrulla_id = patrullas[pick - 1].id;
  await window.supabase.from('miembros').update(upd).eq('id', id);
  renderConfiguracion();
}

async function deleteMiembro(id) {
  if (!confirm('¿Eliminar miembro?')) return;
  await window.supabase.from('miembros').update({ activo: false }).eq('id', id);
  renderConfiguracion();
}

async function addCargo() {
  const nombre = prompt('Nombre del cargo:');
  if (!nombre) return;
  await window.supabase.from('cargos').insert({ nombre, orden: 99 });
  renderConfiguracion();
}

async function deleteCargo(id) {
  if (!confirm('¿Eliminar cargo?')) return;
  await window.supabase.from('cargos').delete().eq('id', id);
  renderConfiguracion();
}

async function onClearAll() {
  const typed = prompt('Escribe BORRAR TODO para confirmar:');
  if (typed !== 'BORRAR TODO') return;
  try {
    await clearAllData();
    toast('Datos reiniciados', 'warning');
    renderConfiguracion();
  } catch (e) {
    showError(e);
  }
}
