import { CICLOS } from '../constants.js';
import { escapeHtml } from '../utils.js';

export async function renderLog() {
  const el = document.getElementById('view-log');
  el.innerHTML = `
    <h5 class="mb-3">Registro de acciones</h5>
    <div class="filter-bar">
      <div class="row g-2 align-items-end">
        <div class="col-4">
          <label class="form-label small">Ciclo</label>
          <select class="form-select form-select-sm" id="log-ciclo">
            <option value="">Todos</option>
            ${CICLOS.map((c) => `<option value="${c}">Ciclo ${c}</option>`).join('')}
          </select>
        </div>
        <div class="col-4">
          <label class="form-label small">Tipo</label>
          <select class="form-select form-select-sm" id="log-tipo">
            <option value="">Todos</option>
            <option value="puntos_patrulla">Puntos patrulla</option>
            <option value="puntos_crecimiento">Puntos personales</option>
            <option value="asistencia">Asistencia</option>
          </select>
        </div>
        <div class="col-4">
          <button class="btn btn-primary btn-sm w-100" id="log-filter">Filtrar</button>
        </div>
      </div>
    </div>
    <div id="log-list" class="bg-white rounded p-3"></div>`;

  document.getElementById('log-filter').onclick = loadLog;
  loadLog();
}

async function loadLog() {
  const ciclo = document.getElementById('log-ciclo').value;
  const tipo = document.getElementById('log-tipo').value;
  let q = window.supabase
    .from('action_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (ciclo) q = q.eq('ciclo', parseInt(ciclo, 10));
  if (tipo) q = q.eq('tipo', tipo);
  const [{ data, error }, { data: profiles }] = await Promise.all([
    q,
    window.supabase.from('profiles').select('id, nombre, email'),
  ]);
  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const list = document.getElementById('log-list');
  if (error) {
    list.innerHTML = `<p class="text-danger">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data?.length) {
    list.innerHTML = '<p class="text-muted mb-0">Sin registros</p>';
    return;
  }
  list.innerHTML = data.map((row) => formatEntry(row, profileMap[row.user_id])).join('');
}

function formatEntry(row, profile) {
  const who = profile?.nombre || profile?.email || 'Usuario';
  const d = row.detalle || {};
  const when = new Date(row.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  let text = '';

  if (row.tipo === 'puntos_patrulla') {
    const cls = d.delta > 0 ? 'delta-pos' : 'delta-neg';
    text = `<span class="${cls}">${d.delta > 0 ? '+' : ''}${d.delta}</span> pts a patrulla <strong>${escapeHtml(d.patrulla || '')}</strong>`;
  } else if (row.tipo === 'puntos_crecimiento') {
    const cls = d.delta > 0 ? 'delta-pos' : 'delta-neg';
    text = `<span class="${cls}">${d.delta > 0 ? '+' : ''}${d.delta}</span> en ${escapeHtml(d.area || '')} — <strong>${escapeHtml(d.miembro || '')}</strong>`;
  } else if (row.tipo === 'asistencia') {
    text = `Asistencia <strong>${escapeHtml(d.estado || '')}</strong> — ${escapeHtml(d.miembro || '')} (${escapeHtml(d.fecha || '')})`;
  } else {
    text = escapeHtml(JSON.stringify(d));
  }

  return `<div class="log-entry">
    <div>${text}</div>
    <div class="text-muted small">${escapeHtml(who)} · ${when}${row.ciclo ? ` · Ciclo ${row.ciclo}` : ''}</div>
  </div>`;
}
