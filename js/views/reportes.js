import { refreshData, getState, patrullaPoints } from '../data.js';
import { AREAS, CICLOS } from '../constants.js';
import { escapeHtml, groupSum } from '../utils.js';

export async function renderReportes() {
  await refreshData();
  const el = document.getElementById('view-reportes');
  const { patrullas, miembros, ciclo } = getState();

  el.innerHTML = `
    <h5 class="mb-3">Reportes</h5>
    <div class="filter-bar">
      <div class="row g-2">
        <div class="col-6 col-md-3">
          <label class="form-label small">Ciclo</label>
          <select class="form-select form-select-sm" id="rep-ciclo">
            ${CICLOS.map((c) => `<option value="${c}" ${c === ciclo ? 'selected' : ''}>Ciclo ${c}</option>`).join('')}
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small">Patrulla</label>
          <select class="form-select form-select-sm" id="rep-patrulla">
            <option value="">Todas</option>
            ${patrullas.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label small">Área de crecimiento</label>
          <select class="form-select form-select-sm" id="rep-area">
            <option value="">Todas</option>
            ${AREAS.map((a) => `<option value="${a.key}">${a.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-12 col-md-2 d-flex align-items-end">
          <button class="btn btn-primary btn-sm w-100" id="rep-run">Generar</button>
        </div>
      </div>
    </div>
    <div id="rep-results"></div>`;

  document.getElementById('rep-run').onclick = runReport;
  runReport();
}

async function runReport() {
  const ciclo = parseInt(document.getElementById('rep-ciclo').value, 10);
  const patFilter = document.getElementById('rep-patrulla').value;
  const areaFilter = document.getElementById('rep-area').value;
  const { patrullas, miembros } = getState();

  const [pp, pc, as] = await Promise.all([
    window.supabase.from('puntos_patrulla').select('*').eq('ciclo', ciclo),
    window.supabase.from('puntos_crecimiento').select('*').eq('ciclo', ciclo),
    window.supabase.from('asistencia').select('*').eq('estado', 'asistio'),
  ]);

  let puntosPat = pp.data || [];
  let puntosCre = pc.data || [];
  const asist = as.data || [];

  if (patFilter) {
    const pid = parseInt(patFilter, 10);
    const memberIds = miembros.filter((m) => m.patrulla_id === pid).map((m) => m.id);
    puntosPat = puntosPat.filter((x) => x.patrulla_id === pid);
    puntosCre = puntosCre.filter((x) => memberIds.includes(x.miembro_id));
  }
  if (areaFilter) puntosCre = puntosCre.filter((x) => x.area === areaFilter);

  const patTotals = {};
  patrullas.forEach((p) => {
    patTotals[p.id] = puntosPat.filter((x) => x.patrulla_id === p.id).reduce((s, x) => s + x.delta, 0);
  });
  const patRanking = [...patrullas].sort((a, b) => (patTotals[b.id] || 0) - (patTotals[a.id] || 0));

  const memberTotals = {};
  puntosCre.forEach((x) => {
    memberTotals[x.miembro_id] = (memberTotals[x.miembro_id] || 0) + x.delta;
  });
  const memberRanking = Object.entries(memberTotals)
    .map(([id, pts]) => ({ m: miembros.find((x) => x.id === parseInt(id, 10)), pts }))
    .filter((x) => x.m)
    .sort((a, b) => b.pts - a.pts);

  const areaTotals = groupSum(puntosCre, 'area', 'delta');
  const areaRanking = AREAS.map((a) => ({ ...a, pts: areaTotals[a.key] || 0 })).sort((a, b) => b.pts - a.pts);

  const asistByPat = {};
  patrullas.forEach((p) => { asistByPat[p.id] = 0; });
  asist.forEach((a) => {
    const m = miembros.find((x) => x.id === a.miembro_id);
    if (m) asistByPat[m.patrulla_id] = (asistByPat[m.patrulla_id] || 0) + 1;
  });
  const asistRanking = [...patrullas].sort((a, b) => (asistByPat[b.id] || 0) - (asistByPat[a.id] || 0));

  document.getElementById('rep-results').innerHTML = `
    <div class="row g-3">
      <div class="col-md-6">
        <div class="stat-card">
          <h6>Puntos de patrulla — Ciclo ${ciclo}</h6>
          <ol class="mb-0 ps-3">${patRanking.map((p) =>
            `<li><strong>${escapeHtml(p.nombre)}</strong>: ${patTotals[p.id] || 0} pts</li>`
          ).join('')}</ol>
          ${patRanking.length ? `<p class="small text-muted mt-2 mb-0">Más: ${escapeHtml(patRanking[0].nombre)} · Menos: ${escapeHtml(patRanking[patRanking.length - 1].nombre)}</p>` : ''}
        </div>
      </div>
      <div class="col-md-6">
        <div class="stat-card">
          <h6>Bitácora personal (total)</h6>
          <ol class="mb-0 ps-3">${memberRanking.slice(0, 10).map((x) =>
            `<li><strong>${escapeHtml(x.m.nombre)}</strong>: ${x.pts} pts</li>`
          ).join('') || '<li class="text-muted">Sin datos</li>'}</ol>
        </div>
      </div>
      <div class="col-md-6">
        <div class="stat-card">
          <h6>Áreas más trabajadas</h6>
          <ol class="mb-0 ps-3">${areaRanking.map((a) =>
            `<li><strong>${a.label}</strong>: ${a.pts} pts</li>`
          ).join('')}</ol>
        </div>
      </div>
      <div class="col-md-6">
        <div class="stat-card">
          <h6>Asistencias registradas (total histórico)</h6>
          <ol class="mb-0 ps-3">${asistRanking.map((p) =>
            `<li><strong>${escapeHtml(p.nombre)}</strong>: ${asistByPat[p.id] || 0}</li>`
          ).join('')}</ol>
        </div>
      </div>
    </div>`;
}
