import { getCurrentCiclo, logAction, isAdmin } from './auth.js';
import { AREAS } from './constants.js';
import { computeAsistenciaStats, groupSum, showError, toast, escapeHtml, fmtDate, getLastSaturday } from './utils.js';

let state = {
  ciclo: 2,
  patrullas: [],
  miembros: [],
  cargos: [],
  miembroCargos: [],
  puntosPatrulla: [],
  puntosCrecimiento: [],
  asistencia: [],
};

export function getState() { return state; }

export async function refreshData() {
  state.ciclo = await getCurrentCiclo();
  const sb = window.supabase;
  const [p, m, c, mc, pp, pc, a] = await Promise.all([
    sb.from('patrullas').select('*').order('orden'),
    sb.from('miembros').select('*').eq('activo', true).order('nombre'),
    sb.from('cargos').select('*').order('orden'),
    sb.from('miembro_cargos').select('*'),
    sb.from('puntos_patrulla').select('*').eq('ciclo', state.ciclo),
    sb.from('puntos_crecimiento').select('*').eq('ciclo', state.ciclo),
    sb.from('asistencia').select('*').order('fecha', { ascending: false }).limit(500),
  ]);
  [p, m, c, mc, pp, pc, a].forEach((r) => { if (r.error) throw r.error; });
  state.patrullas = p.data;
  state.miembros = m.data;
  state.cargos = c.data;
  state.miembroCargos = mc.data;
  state.puntosPatrulla = pp.data;
  state.puntosCrecimiento = pc.data;
  state.asistencia = a.data;
}

export function patrullaPoints(patrullaId) {
  return state.puntosPatrulla
    .filter((x) => x.patrulla_id === patrullaId)
    .reduce((s, x) => s + x.delta, 0);
}

export function memberAreaPoints(miembroId) {
  const m = {};
  AREAS.forEach((a) => { m[a.key] = 0; });
  state.puntosCrecimiento
    .filter((x) => x.miembro_id === miembroId)
    .forEach((x) => { m[x.area] = (m[x.area] || 0) + x.delta; });
  return m;
}

export function patrullaAreaTotals(patrullaId) {
  const ids = state.miembros.filter((m) => m.patrulla_id === patrullaId).map((m) => m.id);
  const totals = {};
  AREAS.forEach((a) => { totals[a.key] = 0; });
  state.puntosCrecimiento
    .filter((x) => ids.includes(x.miembro_id))
    .forEach((x) => { totals[x.area] = (totals[x.area] || 0) + x.delta; });
  return totals;
}

export function memberCountsForPatrulla(patrullaId) {
  const members = state.miembros.filter((m) => m.patrulla_id === patrullaId);
  const stats = computeAsistenciaStats(state.asistencia, members.map((m) => m.id));
  let constantes = 0;
  let enLista = 0;
  members.forEach((m) => {
    if (stats[m.id]?.enLista) enLista++;
    else constantes++;
  });
  return { total: members.length, constantes, enLista };
}

export function getCargoNames(miembroId) {
  const cargoIds = state.miembroCargos.filter((x) => x.miembro_id === miembroId).map((x) => x.cargo_id);
  return state.cargos.filter((c) => cargoIds.includes(c.id)).map((c) => c.nombre);
}

export async function addPatrullaPoints(patrullaId, delta, nota) {
  const { data: { user } } = await window.supabase.auth.getUser();
  const { error } = await window.supabase.from('puntos_patrulla').insert({
    patrulla_id: patrullaId,
    ciclo: state.ciclo,
    delta,
    nota: nota || null,
    created_by: user?.id,
  });
  if (error) throw error;
  const pat = state.patrullas.find((p) => p.id === patrullaId);
  await logAction('puntos_patrulla', {
    patrulla: pat?.nombre,
    patrulla_id: patrullaId,
    delta,
    nota,
  }, state.ciclo);
  await refreshData();
  toast(delta > 0 ? `+${delta} a ${pat?.nombre}` : `${delta} a ${pat?.nombre}`);
}

export async function addCrecimientoPoints(miembroId, area, delta, nota) {
  const { data: { user } } = await window.supabase.auth.getUser();
  const { error } = await window.supabase.from('puntos_crecimiento').insert({
    miembro_id: miembroId,
    ciclo: state.ciclo,
    area,
    delta,
    nota: nota || null,
    created_by: user?.id,
  });
  if (error) throw error;
  const mem = state.miembros.find((m) => m.id === miembroId);
  await logAction('puntos_crecimiento', {
    miembro: mem?.nombre,
    miembro_id: miembroId,
    area,
    delta,
    nota,
  }, state.ciclo);
  await refreshData();
  toast('Puntos actualizados');
}

export async function setAsistencia(miembroId, fecha, estado) {
  const { data: { user } } = await window.supabase.auth.getUser();
  const { error } = await window.supabase.from('asistencia').upsert({
    miembro_id: miembroId,
    fecha,
    estado,
    created_by: user?.id,
  }, { onConflict: 'miembro_id,fecha' });
  if (error) throw error;
  const mem = state.miembros.find((m) => m.id === miembroId);
  await logAction('asistencia', { miembro: mem?.nombre, miembro_id: miembroId, fecha, estado }, state.ciclo);
  await refreshData();
}

export async function deleteAsistencia(miembroId, fecha) {
  const { error } = await window.supabase.from('asistencia')
    .delete()
    .eq('miembro_id', miembroId)
    .eq('fecha', fecha);
  if (error) throw error;
  await refreshData();
}

async function deleteAllFrom(table, column = 'id') {
  const { error } = await window.supabase.from(table).delete().gte(column, 0);
  if (error) throw error;
}

async function resetTroopDataClient({ keepPatrullas, keepMiembros, keepAsistencia }) {
  if (keepMiembros && !keepPatrullas) {
    throw new Error('No se pueden conservar miembros sin patrullas');
  }
  if (keepAsistencia && !keepMiembros) {
    throw new Error('No se puede conservar asistencia sin miembros');
  }

  await deleteAllFrom('action_log');
  await deleteAllFrom('puntos_crecimiento');
  await deleteAllFrom('puntos_patrulla');

  if (!keepAsistencia) await deleteAllFrom('asistencia');
  if (!keepMiembros) {
    await deleteAllFrom('miembro_cargos', 'miembro_id');
    await deleteAllFrom('miembros');
  }
  if (!keepPatrullas) {
    await deleteAllFrom('cargos');
    await deleteAllFrom('patrullas');
  }

  const { error } = await window.supabase
    .from('app_config')
    .upsert({ key: 'ciclo_actual', value: '1' });
  if (error) throw error;
}

export async function resetTroopData({ keepPatrullas, keepMiembros, keepAsistencia }) {
  const { error } = await window.supabase.rpc('reset_troop_data', {
    keep_patrullas: keepPatrullas,
    keep_miembros: keepMiembros,
    keep_asistencia: keepAsistencia,
  });

  if (error?.code === 'PGRST202') {
    await resetTroopDataClient({ keepPatrullas, keepMiembros, keepAsistencia });
  } else if (error) {
    throw error;
  }

  await refreshData();
}

/** @deprecated use resetTroopData */
export async function clearAllData() {
  return resetTroopData({ keepPatrullas: false, keepMiembros: false, keepAsistencia: false });
}

export { isAdmin, escapeHtml, fmtDate, getLastSaturday, groupSum, computeAsistenciaStats, showError };
