import { refreshData, getState, setAsistencia, deleteAsistencia } from '../data.js';
import { isAdmin } from '../auth.js';
import { ASISTENCIA_ESTADOS } from '../constants.js';
import {
  escapeHtml, fmtDate, getLastSaturday, computeAsistenciaStats,
  getMonthRange, getSaturdaysInMonth, formatShortDate, formatMonthLabel,
  showError,
} from '../utils.js';

let activeTab = 'reunion';
let viewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };

const ESTADO_CYCLE = ['', 'asistio', 'no_asistio', 'licencia'];

function estadoMeta(key) {
  return ASISTENCIA_ESTADOS.find((s) => s.key === key);
}

function estadoIcon(key) {
  if (!key) return '<span class="asist-dot empty">—</span>';
  const s = estadoMeta(key);
  return `<span class="asist-dot ${s.class}" title="${s.label}"><i class="fa-solid ${s.icon}"></i></span>`;
}

function estadoLabel(key) {
  if (!key) return 'Sin registro';
  return estadoMeta(key)?.label || key;
}

function nextEstado(current, allowClear) {
  const i = ESTADO_CYCLE.indexOf(current);
  let next = ESTADO_CYCLE[(i + 1) % ESTADO_CYCLE.length];
  if (!allowClear && !next) next = 'asistio';
  return next;
}

function getMeetingDatesInMonth(year, month, asistenciaRows) {
  const { start, end } = getMonthRange(year, month);
  const saturdays = getSaturdaysInMonth(year, month);
  const extra = asistenciaRows
    .filter((a) => a.fecha >= start && a.fecha <= end)
    .map((a) => a.fecha);
  return [...new Set([...saturdays, ...extra])].sort();
}

export async function renderAsistencia() {
  await refreshData();
  const el = document.getElementById('view-asistencia');
  el.innerHTML = `
    <h5 class="mb-3">Asistencia</h5>
    <ul class="nav nav-tabs nav-fill mb-3" id="asist-tabs">
      <li class="nav-item">
        <button type="button" class="nav-link ${activeTab === 'reunion' ? 'active' : ''}" data-tab="reunion">
          <i class="fa-solid fa-calendar-day me-1"></i><span class="d-none d-sm-inline">Reunión</span><span class="d-sm-none">Día</span>
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link ${activeTab === 'mes' ? 'active' : ''}" data-tab="mes">
          <i class="fa-solid fa-calendar me-1"></i>Mes
        </button>
      </li>
      <li class="nav-item">
        <button type="button" class="nav-link ${activeTab === 'reporte' ? 'active' : ''}" data-tab="reporte">
          <i class="fa-solid fa-chart-pie me-1"></i>Reporte
        </button>
      </li>
    </ul>
    <div id="asist-tab-content"></div>`;

  el.querySelectorAll('#asist-tabs [data-tab]').forEach((btn) => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      renderAsistencia().catch(showError);
    };
  });

  const content = el.querySelector('#asist-tab-content');
  if (activeTab === 'reunion') await renderReunionTab(content);
  else if (activeTab === 'mes') await renderMesTab(content);
  else await renderReporteTab(content);
}

// ─── Tab 1: Reunión (día / semana) ─────────────────────────

async function renderReunionTab(el) {
  const { patrullas, miembros, asistencia } = getState();
  const fecha = fmtDate(getLastSaturday());
  const stats = computeAsistenciaStats(asistencia, miembros.map((m) => m.id));

  el.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
      <p class="text-muted small mb-0">Marca la reunión del sábado (o elige otra fecha). Tras 3 sábados seguidos sin venir, pasa a <em>en lista</em>.</p>
      <input type="date" class="form-control form-control-sm w-auto" id="asistencia-fecha" value="${fecha}">
    </div>
    <div id="asist-reunion-body">${buildPatrullaCards(patrullas, miembros, asistencia, fecha, stats)}</div>`;

  el.querySelector('#asistencia-fecha').onchange = (e) => renderReunionForDate(e.target.value);
  bindReunionButtons(el, fecha);
}

function buildMemberRow(m, rec, stats, fecha) {
  const estado = rec?.estado || '';
  const btns = ASISTENCIA_ESTADOS.map((s) =>
    `<button type="button" class="btn btn-sm btn-outline-${s.class} ${estado === s.key ? 'active' : ''}"
      data-miembro="${m.id}" data-estado="${s.key}" data-fecha="${fecha}" title="${s.label}">
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
}

function buildPatrullaCards(patrullas, miembros, asistenciaRows, fecha, stats) {
  return patrullas.map((p) => {
    const members = miembros.filter((m) => m.patrulla_id === p.id);
    const rows = members.map((m) => {
      const rec = asistenciaRows.find((a) => a.miembro_id === m.id && a.fecha === fecha);
      return buildMemberRow(m, rec, stats, fecha);
    }).join('');
    return `<div class="card mb-3">
      <div class="card-header fw-bold" style="border-left:4px solid ${escapeHtml(p.color)}">${escapeHtml(p.nombre)}</div>
      <div class="card-body py-2">${rows || '<p class="text-muted mb-0">Sin miembros</p>'}</div>
    </div>`;
  }).join('');
}

async function renderReunionForDate(fecha) {
  const el = document.getElementById('asist-tab-content');
  const { patrullas, miembros } = getState();
  const { data: asistencia } = await window.supabase
    .from('asistencia')
    .select('*')
    .eq('fecha', fecha);
  const merged = [
    ...getState().asistencia.filter((a) => a.fecha !== fecha),
    ...(asistencia || []),
  ];
  const stats = computeAsistenciaStats(merged, miembros.map((m) => m.id));

  el.querySelector('#asist-reunion-body').innerHTML = buildPatrullaCards(
    patrullas, miembros, asistencia || [], fecha, stats
  );
  bindReunionButtons(el, fecha);
}

function bindReunionButtons(el, fecha) {
  el.querySelectorAll('[data-miembro][data-estado]').forEach((btn) => {
    btn.onclick = async () => {
      const miembroId = parseInt(btn.dataset.miembro, 10);
      const estado = btn.dataset.estado;
      const f = btn.dataset.fecha || fecha;
      await setAsistencia(miembroId, f, estado);
      await renderReunionForDate(f);
    };
  });
}

// ─── Tab 2: Mes ────────────────────────────────────────────

async function renderMesTab(el) {
  const { year, month } = viewMonth;
  const { patrullas, miembros } = getState();
  const { start, end } = getMonthRange(year, month);

  const { data: monthAsistencia, error } = await window.supabase
    .from('asistencia')
    .select('*')
    .gte('fecha', start)
    .lte('fecha', end);
  if (error) throw error;

  const dates = getMeetingDatesInMonth(year, month, monthAsistencia || []);
  const byKey = {};
  (monthAsistencia || []).forEach((a) => {
    byKey[`${a.miembro_id}:${a.fecha}`] = a.estado;
  });

  const stats = computeAsistenciaStats(getState().asistencia, miembros.map((m) => m.id));

  let tableBody = '';
  patrullas.forEach((p) => {
    const members = miembros.filter((m) => m.patrulla_id === p.id);
    if (!members.length) return;
    tableBody += `<tr class="asist-month-patrulla"><td colspan="${dates.length + 1}">${escapeHtml(p.nombre)}</td></tr>`;
    members.forEach((m) => {
      const cells = dates.map((fecha) => {
        const estado = byKey[`${m.id}:${fecha}`] || '';
        return `<td class="asist-cell ${estado || 'empty'}" data-miembro="${m.id}" data-fecha="${fecha}" title="${estadoLabel(estado)}">
          ${estadoIcon(estado)}
        </td>`;
      }).join('');
      const tag = stats[m.id]?.enLista ? 'lista' : 'ok';
      tableBody += `<tr>
        <td class="asist-month-name"><span class="asist-status-dot ${tag}"></span>${escapeHtml(m.nombre)}</td>
        ${cells}
      </tr>`;
    });
  });

  const headerCells = dates.map((fecha) => {
    const d = new Date(fecha + 'T12:00:00');
    const isSat = d.getDay() === 6;
    return `<th class="${isSat ? 'asist-sat' : ''}" title="${fecha}">${formatShortDate(fecha)}${isSat ? '<small>S</small>' : ''}</th>`;
  }).join('');

  el.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
      <div class="btn-group btn-group-sm">
        <button type="button" class="btn btn-outline-secondary" id="asist-month-prev"><i class="fa-solid fa-chevron-left"></i></button>
        <button type="button" class="btn btn-outline-secondary disabled text-capitalize" id="asist-month-label">${formatMonthLabel(year, month)}</button>
        <button type="button" class="btn btn-outline-secondary" id="asist-month-next"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <input type="month" class="form-control form-control-sm w-auto" id="asist-month-picker" value="${year}-${String(month).padStart(2, '0')}">
    </div>
    <p class="text-muted small mb-2">Toca una celda para cambiar el estado. Columnas <strong>S</strong> = sábado.</p>
    <div class="asist-legend mb-2">
      ${ASISTENCIA_ESTADOS.map((s) => `<span>${estadoIcon(s.key)} ${s.label}</span>`).join('')}
      <span>${estadoIcon('')} Sin registro</span>
    </div>
    <div class="asist-month-wrap">
      <table class="table table-sm table-bordered asist-month-table mb-0">
        <thead><tr><th>Miembro</th>${headerCells || '<th>Sin fechas</th>'}</tr></thead>
        <tbody>${tableBody || '<tr><td colspan="99" class="text-muted">Sin miembros</td></tr>'}</tbody>
      </table>
    </div>`;

  el.querySelector('#asist-month-prev').onclick = () => {
    shiftMonth(-1);
    renderMesTab(el).catch(showError);
  };
  el.querySelector('#asist-month-next').onclick = () => {
    shiftMonth(1);
    renderMesTab(el).catch(showError);
  };
  el.querySelector('#asist-month-picker').onchange = (e) => {
    const [y, m] = e.target.value.split('-').map(Number);
    viewMonth = { year: y, month: m };
    renderMesTab(el).catch(showError);
  };

  el.querySelectorAll('.asist-cell').forEach((cell) => {
    cell.onclick = async () => {
      const miembroId = parseInt(cell.dataset.miembro, 10);
      const fecha = cell.dataset.fecha;
      const current = byKey[`${miembroId}:${fecha}`] || '';
      const next = nextEstado(current, isAdmin());
      if (!next) {
        await deleteAsistencia(miembroId, fecha);
      } else {
        await setAsistencia(miembroId, fecha, next);
      }
      await renderMesTab(el);
    };
  });
}

function shiftMonth(delta) {
  let { year, month } = viewMonth;
  month += delta;
  if (month < 1) { month = 12; year -= 1; }
  if (month > 12) { month = 1; year += 1; }
  viewMonth = { year, month };
}

// ─── Tab 3: Reporte ────────────────────────────────────────

async function renderReporteTab(el) {
  const { patrullas, miembros } = getState();
  const today = fmtDate(new Date());
  const monthStart = getMonthRange(viewMonth.year, viewMonth.month).start;
  const admin = isAdmin();

  el.innerHTML = `
    ${admin ? `
    <div class="filter-bar mb-3">
      <h6 class="mb-2"><i class="fa-solid fa-pen-to-square me-1"></i>Corregir / registrar (cualquier día)</h6>
      <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0">Fecha</label>
          <input type="date" class="form-control form-control-sm" id="rep-fix-fecha" value="${today}">
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small mb-0">Miembro</label>
          <select class="form-select form-select-sm" id="rep-fix-miembro">
            ${miembros.map((m) => {
              const p = patrullas.find((x) => x.id === m.patrulla_id);
              return `<option value="${m.id}">${escapeHtml(m.nombre)} (${escapeHtml(p?.nombre || '')})</option>`;
            }).join('')}
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0">Estado</label>
          <select class="form-select form-select-sm" id="rep-fix-estado">
            ${ASISTENCIA_ESTADOS.map((s) => `<option value="${s.key}">${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-6 col-md-2">
          <button type="button" class="btn btn-primary btn-sm w-100" id="rep-fix-save">Guardar</button>
        </div>
      </div>
    </div>` : ''}
    <div class="filter-bar">
      <h6 class="mb-2">Filtrar registros</h6>
      <div class="row g-2">
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0">Desde</label>
          <input type="date" class="form-control form-control-sm" id="rep-desde" value="${monthStart}">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0">Hasta</label>
          <input type="date" class="form-control form-control-sm" id="rep-hasta" value="${today}">
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small mb-0">Patrulla</label>
          <select class="form-select form-select-sm" id="rep-patrulla">
            <option value="">Todas</option>
            ${patrullas.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small mb-0">Miembro</label>
          <select class="form-select form-select-sm" id="rep-miembro">
            <option value="">Todos</option>
            ${miembros.map((m) => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small mb-0">Estado</label>
          <select class="form-select form-select-sm" id="rep-estado">
            <option value="">Todos</option>
            ${ASISTENCIA_ESTADOS.map((s) => `<option value="${s.key}">${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-12 col-md-2 d-flex align-items-end">
          <button type="button" class="btn btn-primary btn-sm w-100" id="rep-run">Generar</button>
        </div>
      </div>
    </div>
    <div id="rep-results"></div>`;

  if (admin) {
    el.querySelector('#rep-fix-save').onclick = async () => {
      const fecha = el.querySelector('#rep-fix-fecha').value;
      const miembroId = parseInt(el.querySelector('#rep-fix-miembro').value, 10);
      const estado = el.querySelector('#rep-fix-estado').value;
      await setAsistencia(miembroId, fecha, estado);
      runReport();
    };
  }

  el.querySelector('#rep-run').onclick = () => runReport();
  runReport();
}

async function runReport() {
  const el = document.getElementById('rep-results');
  if (!el) return;

  const desde = document.getElementById('rep-desde')?.value;
  const hasta = document.getElementById('rep-hasta')?.value;
  const patFilter = document.getElementById('rep-patrulla')?.value;
  const memFilter = document.getElementById('rep-miembro')?.value;
  const estadoFilter = document.getElementById('rep-estado')?.value;
  const { patrullas, miembros } = getState();
  const admin = isAdmin();

  let query = window.supabase.from('asistencia').select('*').gte('fecha', desde).lte('fecha', hasta);
  if (estadoFilter) query = query.eq('estado', estadoFilter);
  const { data: rows, error } = await query.order('fecha', { ascending: false });
  if (error) throw error;

  let filtered = rows || [];
  if (patFilter) {
    const pid = parseInt(patFilter, 10);
    const ids = new Set(miembros.filter((m) => m.patrulla_id === pid).map((m) => m.id));
    filtered = filtered.filter((r) => ids.has(r.miembro_id));
  }
  if (memFilter) {
    const mid = parseInt(memFilter, 10);
    filtered = filtered.filter((r) => r.miembro_id === mid);
  }

  const counts = { asistio: 0, no_asistio: 0, licencia: 0 };
  filtered.forEach((r) => { counts[r.estado] = (counts[r.estado] || 0) + 1; });

  const byPatrulla = patrullas.map((p) => {
    const ids = miembros.filter((m) => m.patrulla_id === p.id).map((m) => m.id);
    const recs = filtered.filter((r) => ids.includes(r.miembro_id));
    const c = { asistio: 0, no_asistio: 0, licencia: 0 };
    recs.forEach((r) => { c[r.estado]++; });
    return { patrulla: p, ...c, total: recs.length };
  }).filter((x) => x.total > 0 || !patFilter);

  const tableRows = filtered.map((r) => {
    const m = miembros.find((x) => x.id === r.miembro_id);
    const p = patrullas.find((x) => x.id === m?.patrulla_id);
    const estadoOpts = ASISTENCIA_ESTADOS.map((s) =>
      `<option value="${s.key}" ${r.estado === s.key ? 'selected' : ''}>${s.label}</option>`
    ).join('');
    return `<tr>
      <td>${formatShortDate(r.fecha)}<br><small class="text-muted">${r.fecha}</small></td>
      <td>${escapeHtml(m?.nombre || '?')}</td>
      <td>${escapeHtml(p?.nombre || '—')}</td>
      <td>
        <select class="form-select form-select-sm rep-estado-edit" data-miembro="${r.miembro_id}" data-fecha="${r.fecha}">
          ${estadoOpts}
        </select>
      </td>
      ${admin ? `<td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger rep-del" data-miembro="${r.miembro_id}" data-fecha="${r.fecha}" title="Eliminar registro">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>` : ''}
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="row g-2 mb-3">
      <div class="col-4"><div class="stat-card text-center py-2"><div class="text-success fw-bold fs-5">${counts.asistio}</div><small>Asistió</small></div></div>
      <div class="col-4"><div class="stat-card text-center py-2"><div class="text-danger fw-bold fs-5">${counts.no_asistio}</div><small>No asistió</small></div></div>
      <div class="col-4"><div class="stat-card text-center py-2"><div class="text-warning fw-bold fs-5">${counts.licencia}</div><small>Licencia</small></div></div>
    </div>
    ${byPatrulla.length ? `
    <div class="stat-card mb-3">
      <h6 class="mb-2">Por patrulla</h6>
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <thead><tr><th>Patrulla</th><th class="text-success">Asistió</th><th class="text-danger">No</th><th class="text-warning">Lic.</th><th>Total</th></tr></thead>
          <tbody>${byPatrulla.map((x) => `<tr>
            <td><span class="color-swatch me-1" style="background:${escapeHtml(x.patrulla.color)}"></span>${escapeHtml(x.patrulla.nombre)}</td>
            <td>${x.asistio}</td><td>${x.no_asistio}</td><td>${x.licencia}</td><td>${x.total}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
    <div class="stat-card">
      <h6 class="mb-2">Detalle (${filtered.length} registros)</h6>
      <div class="table-responsive">
        <table class="table table-sm table-hover mb-0 asist-report-table">
          <thead><tr><th>Fecha</th><th>Miembro</th><th>Patrulla</th><th>Estado</th>${admin ? '<th></th>' : ''}</tr></thead>
          <tbody>${tableRows || `<tr><td colspan="${admin ? 5 : 4}" class="text-muted">Sin registros en este rango</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;

  el.querySelectorAll('.rep-estado-edit').forEach((sel) => {
    sel.onchange = async () => {
      await setAsistencia(parseInt(sel.dataset.miembro, 10), sel.dataset.fecha, sel.value);
      runReport();
    };
  });

  el.querySelectorAll('.rep-del').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('¿Eliminar este registro de asistencia?')) return;
      await deleteAsistencia(parseInt(btn.dataset.miembro, 10), btn.dataset.fecha);
      runReport();
    };
  });
}
