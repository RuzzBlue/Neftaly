import { ABSENCE_THRESHOLD } from './constants.js';

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Most recent Saturday on or before today */
export function getLastSaturday(ref = new Date()) {
  const d = new Date(ref);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export function getRecentSaturdays(count, from = getLastSaturday()) {
  const out = [];
  const d = new Date(from);
  for (let i = 0; i < count; i++) {
    out.push(fmtDate(d));
    d.setDate(d.getDate() - 7);
  }
  return out;
}

export function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `alert alert-${type} position-fixed bottom-0 start-50 translate-middle-x mb-3 shadow`;
  el.style.zIndex = 9999;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

export function showError(err) {
  console.error(err);
  toast(err?.message || String(err), 'danger');
}

/** constante = not 3+ consecutive no_asistio on recent Saturdays (licencia breaks streak) */
export function computeAsistenciaStats(asistenciaRows, memberIds) {
  const saturdays = getRecentSaturdays(12);
  const byMember = {};
  memberIds.forEach((id) => { byMember[id] = { constante: true, enLista: false }; });

  asistenciaRows.forEach((r) => {
    if (!byMember[r.miembro_id]) byMember[r.miembro_id] = { constante: true, enLista: false };
    if (!byMember[r.miembro_id].records) byMember[r.miembro_id].records = {};
    byMember[r.miembro_id].records[r.fecha] = r.estado;
  });

  memberIds.forEach((id) => {
    let streak = 0;
    for (const fecha of saturdays) {
      const estado = byMember[id]?.records?.[fecha];
      if (estado === 'no_asistio') streak++;
      else if (estado === 'asistio' || estado === 'licencia') break;
      else continue;
    }
    const enLista = streak >= ABSENCE_THRESHOLD;
    byMember[id].constante = !enLista;
    byMember[id].enLista = enLista;
  });

  return byMember;
}

export function sumBy(arr, key) {
  return arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);
}

export function groupSum(arr, groupKey, valueKey) {
  const m = {};
  arr.forEach((x) => {
    const k = x[groupKey];
    m[k] = (m[k] || 0) + (Number(x[valueKey]) || 0);
  });
  return m;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
