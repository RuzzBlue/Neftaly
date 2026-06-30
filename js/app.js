import { renderOverview, submitPatrullaPointsModal, submitMemberPointsModal } from './views/overview.js';
import { renderAsistencia } from './views/asistencia.js';
import { renderConfiguracion, initResetModal, initConfigModals } from './views/configuracion.js';
import { renderReportes } from './views/reportes.js';
import { renderLog } from './views/log.js';
import { getCurrentCiclo } from './auth.js';
import { initProfileModal } from './profile.js';
import { showError } from './utils.js';

const views = {
  resumen: { render: renderOverview, el: 'view-resumen' },
  asistencia: { render: renderAsistencia, el: 'view-asistencia' },
  config: { render: renderConfiguracion, el: 'view-config' },
  reportes: { render: renderReportes, el: 'view-reportes' },
  log: { render: renderLog, el: 'view-log' },
};

let currentView = 'resumen';
let appReady = false;
let bindingsReady = false;

export async function initApp() {
  if (appReady) {
    await navigate(currentView);
    return;
  }
  appReady = true;

  if (!bindingsReady) {
    bindNav();
    bindModals();
    initResetModal();
    initConfigModals();
    initProfileModal();
    bindingsReady = true;
  }

  await updateCicloBadge();
  await navigate('resumen');
}

function bindNav() {
  document.querySelectorAll('[data-view]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      navigate(view);
      const oc = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvas-nav'));
      oc?.hide();
    });
  });
}

function bindModals() {
  document.getElementById('ppt-submit')?.addEventListener('click', () => {
    submitPatrullaPointsModal().catch(showError);
  });
  document.getElementById('pmb-submit')?.addEventListener('click', () => {
    submitMemberPointsModal().catch(showError);
  });
  initPointsSteppers();
}

function initPointsSteppers() {
  document.querySelectorAll('.points-step-down').forEach((btn) => {
    btn.addEventListener('click', () => stepPointsInput(btn.dataset.target, -1));
  });
  document.querySelectorAll('.points-step-up').forEach((btn) => {
    btn.addEventListener('click', () => stepPointsInput(btn.dataset.target, 1));
  });
}

function stepPointsInput(inputId, delta) {
  const el = document.getElementById(inputId);
  if (!el) return;
  let v = parseInt(el.value, 10);
  if (Number.isNaN(v)) v = 0;
  v = Math.max(1, v + delta);
  el.value = String(v);
}

async function updateCicloBadge() {
  const ciclo = await getCurrentCiclo();
  const badge = document.getElementById('ciclo-badge');
  if (badge) badge.textContent = `Ciclo ${ciclo}`;
}

export async function navigate(name) {
  if (!views[name]) return;
  currentView = name;
  document.querySelectorAll('.view-section').forEach((s) => s.classList.remove('active'));
  document.getElementById(views[name].el)?.classList.add('active');
  document.querySelectorAll('[data-view]').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === name);
  });
  try {
    await views[name].render();
    await updateCicloBadge();
  } catch (err) {
    showError(err);
  }
}

export function refreshCurrentView() {
  return navigate(currentView);
}
