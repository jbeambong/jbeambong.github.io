import { api } from './api.js';
import { store } from './store.js';

// ── Views (lazy import map) ──────────────────────────────────────
const VIEWS = {
  '/dashboard':     () => import('./views/dashboard.js'),
  '/clients':       () => import('./views/clients.js'),
  '/devis':         () => import('./views/devis.js'),
  '/appels-offres': () => import('./views/appelsOffres.js'),
  '/chantiers':     () => import('./views/chantiers.js'),
  '/factures':      () => import('./views/factures.js'),
  '/planning':      () => import('./views/planning.js'),
  '/conformite':    () => import('./views/conformite.js'),
};

const NAV = [
  { section: 'Principal' },
  { icon: '🏠', label: 'Tableau de bord', path: '/dashboard' },
  { icon: '🏗️', label: 'Chantiers', path: '/chantiers' },
  { section: 'Agents IA' },
  { icon: '📋', label: 'Devis & Chiffrage', path: '/devis' },
  { icon: '📢', label: 'Appels d\'offres', path: '/appels-offres' },
  { icon: '💰', label: 'Facturation', path: '/factures' },
  { icon: '📅', label: 'Planning & RH', path: '/planning' },
  { icon: '🛡️', label: 'Conformité', path: '/conformite' },
  { section: 'Gestion' },
  { icon: '👥', label: 'Clients', path: '/clients' },
];

// ── Toast ────────────────────────────────────────────────────────
export function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Router ───────────────────────────────────────────────────────
let currentPath = '';

async function navigate(path) {
  if (!localStorage.getItem('token')) { renderLogin(); return; }

  // Extract base path and optional id param
  const parts = path.split('/').filter(Boolean);
  let base = '/' + parts[0];
  const param = parts[1] || null;

  const loader = VIEWS[base];
  if (!loader) { base = '/dashboard'; }

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.path === base);
  });

  const titleMap = {
    '/dashboard': 'Tableau de bord',
    '/clients': 'Clients',
    '/devis': 'Devis & Chiffrage',
    '/appels-offres': 'Appels d\'offres',
    '/chantiers': 'Chantiers',
    '/factures': 'Facturation',
    '/planning': 'Planning & RH',
    '/conformite': 'Conformité',
  };
  document.querySelector('.topbar-title').textContent = titleMap[base] || 'Boostr';

  const viewEl = document.getElementById('view');
  viewEl.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement…</div>`;

  const mod = await (VIEWS[base] || VIEWS['/dashboard'])();
  currentPath = path;
  await mod.render(viewEl, param);
}

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--dark);padding:1rem;">
      <div style="width:100%;max-width:420px;">
        <div style="text-align:center;margin-bottom:2rem;">
          <div style="font-size:2rem;font-weight:900;color:#fff;letter-spacing:-.5px;">boo<span style="color:var(--orange)">str</span></div>
          <p style="color:var(--muted);font-size:.9rem;margin-top:.5rem;">La plateforme IA des Travaux Publics</p>
        </div>
        <div class="card">
          <div style="display:flex;border-bottom:1px solid var(--border);">
            <button id="tab-login" class="tab active" style="flex:1;border-radius:0;justify-content:center;">Connexion</button>
            <button id="tab-register" class="tab" style="flex:1;border-radius:0;justify-content:center;">Créer un compte</button>
          </div>
          <div class="card-body">
            <div id="login-form">
              <div class="form-group"><label>Email</label><input type="email" id="login-email" class="form-control" placeholder="vous@entreprise.fr" /></div>
              <div class="form-group"><label>Mot de passe</label><input type="password" id="login-pwd" class="form-control" placeholder="••••••••" /></div>
              <div id="login-err" style="color:var(--danger);font-size:.82rem;margin-bottom:.75rem;display:none;"></div>
              <button id="login-btn" class="btn btn-primary" style="width:100%;">Se connecter</button>
            </div>
            <div id="register-form" style="display:none;">
              <div class="form-row">
                <div class="form-group"><label>Prénom / Nom</label><input type="text" id="reg-name" class="form-control" placeholder="Jean Dupont" /></div>
                <div class="form-group"><label>Entreprise</label><input type="text" id="reg-company" class="form-control" placeholder="BTP Dupont" /></div>
              </div>
              <div class="form-group"><label>Email</label><input type="email" id="reg-email" class="form-control" placeholder="vous@entreprise.fr" /></div>
              <div class="form-group"><label>Mot de passe</label><input type="password" id="reg-pwd" class="form-control" placeholder="••••••••" /></div>
              <div id="reg-err" style="color:var(--danger);font-size:.82rem;margin-bottom:.75rem;display:none;"></div>
              <button id="reg-btn" class="btn btn-primary" style="width:100%;">Créer mon compte</button>
            </div>
          </div>
        </div>
        <p style="text-align:center;color:var(--muted);font-size:.78rem;margin-top:1.5rem;">En vous connectant, vous acceptez nos CGU.</p>
      </div>
    </div>`;

  document.getElementById('tab-login').onclick = () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('login-form').style.display = '';
    document.getElementById('register-form').style.display = 'none';
  };
  document.getElementById('tab-register').onclick = () => {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('register-form').style.display = '';
    document.getElementById('login-form').style.display = 'none';
  };

  document.getElementById('login-btn').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pwd').value;
    const errEl = document.getElementById('login-err');
    try {
      const { token, user } = await api.login({ email, password });
      localStorage.setItem('token', token);
      store.set('user', user);
      initApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  };

  document.getElementById('reg-btn').onclick = async () => {
    const name = document.getElementById('reg-name').value;
    const companyName = document.getElementById('reg-company').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pwd').value;
    const errEl = document.getElementById('reg-err');
    try {
      const { token, user } = await api.register({ name, companyName, email, password });
      localStorage.setItem('token', token);
      store.set('user', user);
      initApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  };

  // Enter key support
  ['login-email','login-pwd'].forEach(id => document.getElementById(id).addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('login-btn').click(); }));
  ['reg-name','reg-company','reg-email','reg-pwd'].forEach(id => document.getElementById(id).addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('reg-btn').click(); }));
}

function initApp() {
  const user = store.get('user');
  document.getElementById('app').innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">boo<span>str</span></div>
      <nav class="sidebar-nav">
        ${NAV.map(item => item.section
          ? `<div class="nav-section">${item.section}</div>`
          : `<a class="nav-item" data-path="${item.path}" href="#${item.path}"><span class="icon">${item.icon}</span>${item.label}</a>`
        ).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="user-info" id="user-info">
          <div class="avatar-sm">${(user?.name || 'U').charAt(0).toUpperCase()}</div>
          <div><div class="user-name">${user?.name || ''}</div><div class="user-company">${user?.company?.name || ''}</div></div>
        </div>
      </div>
    </aside>
    <div class="main-content">
      <header class="topbar">
        <span class="topbar-title">Tableau de bord</span>
        <div class="topbar-actions">
          <button class="notif-btn" id="notif-btn" title="Alertes">🔔<span class="notif-badge" id="notif-badge" style="display:none">0</span></button>
          <button class="btn btn-ghost btn-sm" id="logout-btn">Déconnexion</button>
        </div>
      </header>
      <main class="view" id="view"></main>
    </div>
    <div id="toast-container"></div>`;

  document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('token');
    location.hash = '#/login';
    location.reload();
  };

  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(el => {
    el.onclick = e => { e.preventDefault(); location.hash = '#' + el.dataset.path; };
  });

  // Load alerts
  api.dashAlerts().then(alerts => {
    if (alerts?.length) {
      const badge = document.getElementById('notif-badge');
      badge.textContent = alerts.length;
      badge.style.display = 'flex';
    }
  }).catch(() => {});

  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '') || '/dashboard';
    navigate(hash);
  });

  const hash = location.hash.replace('#', '') || '/dashboard';
  navigate(hash);
}

// ── Boot ─────────────────────────────────────────────────────────
async function boot() {
  if (!localStorage.getItem('token')) { renderLogin(); return; }
  try {
    const user = await api.me();
    store.set('user', user);
    initApp();
  } catch {
    localStorage.removeItem('token');
    renderLogin();
  }
}

boot();
