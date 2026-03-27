import { api } from '../api.js';
import { toast } from '../app.js';

function fmt(n) { return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }); }

const STATUT_BADGE = {
  brouillon: 'badge-gray', envoyé: 'badge-blue', accepté: 'badge-green', refusé: 'badge-red',
  payée: 'badge-green', en_retard: 'badge-red', annulée: 'badge-gray', envoyée: 'badge-blue',
};

export async function render(el) {
  try {
    const [stats, alerts] = await Promise.all([api.dashStats(), api.dashAlerts()]);

    el.innerHTML = `
      <div class="page-header">
        <div><h1>Tableau de bord</h1><p>Vue d'ensemble de votre activité</p></div>
      </div>

      ${alerts.length ? `<div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.5rem;">
        ${alerts.slice(0,4).map(a => `
          <div class="alert alert-${a.type === 'retard' ? 'danger' : a.type === 'urgent' ? 'warning' : 'info'}">
            <span>${a.type === 'retard' ? '⚠️' : a.type === 'urgent' ? '🔴' : 'ℹ️'}</span>
            <span>${a.message}${a.montant ? ' — <strong>' + fmt(a.montant) + '</strong>' : ''}</span>
          </div>`).join('')}
      </div>` : ''}

      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Chantiers actifs</div>
          <div class="value">${stats.chantiers_actifs}</div>
          <div class="sub">sur ${stats.chantiers_total} total</div>
        </div>
        <div class="stat-card">
          <div class="label">CA ce mois</div>
          <div class="value" style="font-size:1.5rem">${fmt(stats.ca_mois)}</div>
          <div class="sub trend-up">↑ Encaissé</div>
        </div>
        <div class="stat-card">
          <div class="label">Factures en retard</div>
          <div class="value" style="color:${stats.factures_retard > 0 ? 'var(--danger)' : 'var(--success)'}">${stats.factures_retard}</div>
          <div class="sub">à relancer</div>
        </div>
        <div class="stat-card">
          <div class="label">Devis en attente</div>
          <div class="value">${stats.devis_en_attente}</div>
          <div class="sub">${stats.devis_mois} créés ce mois</div>
        </div>
        <div class="stat-card">
          <div class="label">CA total encaissé</div>
          <div class="value" style="font-size:1.4rem">${fmt(stats.ca_total)}</div>
          <div class="sub">Toutes périodes</div>
        </div>
        <div class="stat-card">
          <div class="label">Appels d'offres</div>
          <div class="value">${stats.ao_actifs}</div>
          <div class="sub">en cours d'analyse</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem;">
        <div class="card">
          <div class="card-header"><h3>Derniers devis</h3><a href="#/devis" style="font-size:.8rem;color:var(--orange);text-decoration:none;">Voir tout →</a></div>
          <div class="table-wrap">
            ${stats.recent_devis?.length ? `<table>
              <thead><tr><th>Numéro</th><th>Client</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>${stats.recent_devis.map(d => `<tr>
                <td style="font-weight:600">${d.numero}</td>
                <td>${d.client || '—'}</td>
                <td>${fmt(d.montant_ttc)}</td>
                <td><span class="badge ${STATUT_BADGE[d.statut] || 'badge-gray'}">${d.statut}</span></td>
              </tr>`).join('')}</tbody>
            </table>` : '<div class="empty-state" style="padding:1.5rem"><p>Aucun devis</p></div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Dernières factures</h3><a href="#/factures" style="font-size:.8rem;color:var(--orange);text-decoration:none;">Voir tout →</a></div>
          <div class="table-wrap">
            ${stats.recent_factures?.length ? `<table>
              <thead><tr><th>Numéro</th><th>Client</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>${stats.recent_factures.map(f => `<tr>
                <td style="font-weight:600">${f.numero}</td>
                <td>${f.client || '—'}</td>
                <td>${fmt(f.montant_ttc)}</td>
                <td><span class="badge ${STATUT_BADGE[f.statut] || 'badge-gray'}">${f.statut}</span></td>
              </tr>`).join('')}</tbody>
            </table>` : '<div class="empty-state" style="padding:1.5rem"><p>Aucune facture</p></div>'}
          </div>
        </div>
      </div>`;
  } catch (e) {
    toast('Erreur chargement dashboard : ' + e.message, 'error');
    el.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}
