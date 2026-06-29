import { refreshData, getState, setAsistencia } from '../data.js';
import { ASISTENCIA_ESTADOS } from '../constants.js';
import { escapeHtml, fmtDate, getLastSaturday, computeAsistenciaStats } from '../utils.js';

export async function renderAsistencia() {
  await refreshData();
  const el = document.getElementById('view-asistencia');
  const { patrullas, miembros, asistencia } = getState();
  const fecha = fmtDate(getLastSaturday());
  const stats = computeAsistenciaStats(asistencia, miembros.map((m) => m.id));

  const byPatrulla = patrullas.map((p) => {
    const members = miembros.filter((m) => m.patrulla_id === p.id);
    const rows = members.map((m) => {
      const rec = asistencia.find((a) => a.miembro_id === m.id && a.fecha === fecha);
      const estado = rec?.estado || '';
      const btns = ASISTENCIA_ESTADOS.map((s) =>
        `<button type="button" class="btn btn-sm btn-outline-${s.class} ${estado === s.key ? 'active' : ''}"
          data-miembro="${m.id}" data-estado="${s.key}" title="${s.label}">
          <i class="fa-solid ${s.icon}"></i>
        </button>`
      ).join('');
      const tag = stats[m.id]?.enLista
        ? '<span class="badge bg-secondary ms-1">en lista</span>'
        : '<span class="badge bg-success ms-1">constante</span>';
      return `<div class="d-flex align-items-center justify-content-between py-2 border-bottom">
        <span>${escapeHtml(m.nombre)} ${tag}</span>
        <div class="btn-group asistencia-btn-group">${btns}</div>
      </div>`;
    }).join('');

    return `<div class="card mb-3">
      <div class="card-header fw-bold" style="border-left:4px solid ${escapeHtml(p.color)}">${escapeHtml(p.nombre)}</div>
      <div class="card-body py-2">${rows || '<p class="text-muted mb-0">Sin miembros</p>'}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">Asistencia</h5>
      <input type="date" class="form-control form-control-sm w-auto" id="asistencia-fecha" value="${fecha}">
    </div>
    <p class="text-muted small">Marca asistencia del sábado. Tras 3 sábados seguidos sin venir, pasa a <em>en lista</em>.</p>
    ${byPatrulla}`;

  el.querySelector('#asistencia-fecha').onchange = (e) => renderForDate(e.target.value);
  bindButtons(el, el.querySelector('#asistencia-fecha').value);
}

async function renderForDate(fecha) {
  const el = document.getElementById('view-asistencia');
  const { patrullas, miembros } = getState();
  const { data: asistencia } = await window.supabase
    .from('asistencia')
    .select('*')
    .eq('fecha', fecha);
  const stats = computeAsistenciaStats(
    [...getState().asistencia.filter((a) => a.fecha !== fecha), ...(asistencia || [])],
    miembros.map((m) => m.id)
  );

  el.querySelectorAll('.card').forEach((card, i) => {
    const p = patrullas[i];
    const members = miembros.filter((m) => m.patrulla_id === p.id);
    const body = card.querySelector('.card-body');
    body.innerHTML = members.map((m) => {
      const rec = (asistencia || []).find((a) => a.miembro_id === m.id);
      const estado = rec?.estado || '';
      const btns = ASISTENCIA_ESTADOS.map((s) =>
        `<button type="button" class="btn btn-sm btn-outline-${s.class} ${estado === s.key ? 'active' : ''}"
          data-miembro="${m.id}" data-estado="${s.key}" title="${s.label}">
          <i class="fa-solid ${s.icon}"></i>
        </button>`
      ).join('');
      const tag = stats[m.id]?.enLista
        ? '<span class="badge bg-secondary ms-1">en lista</span>'
        : '<span class="badge bg-success ms-1">constante</span>';
      return `<div class="d-flex align-items-center justify-content-between py-2 border-bottom">
        <span>${escapeHtml(m.nombre)} ${tag}</span>
        <div class="btn-group asistencia-btn-group">${btns}</div>
      </div>`;
    }).join('') || '<p class="text-muted mb-0">Sin miembros</p>';
  });
  bindButtons(el, fecha);
}

function bindButtons(el, fecha) {
  el.querySelectorAll('[data-miembro][data-estado]').forEach((btn) => {
    btn.onclick = async () => {
      const miembroId = parseInt(btn.dataset.miembro, 10);
      const estado = btn.dataset.estado;
      await setAsistencia(miembroId, fecha, estado);
      await renderForDate(fecha);
    };
  });
}
