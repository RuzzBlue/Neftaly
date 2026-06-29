import { renderOverview, submitPatrullaPointsModal, submitMemberPointsModal } from './views/overview.js';
import { renderAsistencia } from './views/asistencia.js';
import { renderConfiguracion } from './views/configuracion.js';
import { renderReportes } from './views/reportes.js';
import { renderLog } from './views/log.js';
import { getCurrentCiclo } from './auth.js';
import { showError } from './utils.js';

const views = {
  resumen: { render: renderOverview, el: 'view-resumen' },
  asistencia: { render: renderAsistencia, el: 'view-asistencia' },
  config: { render: renderConfiguracion, el: 'view-config' },
  reportes: { render: renderReportes, el: 'view-reportes' },
  log: { render: renderLog, el: 'view-log' },
};

let currentView = 'resumen';

export async function initApp() {
  bindNav();
  bindModals();
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
