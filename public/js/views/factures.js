import { api } from '../api.js';
import { toast } from '../app.js';

const fmt = n => (n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const BADGE = { brouillon:'badge-gray', envoyée:'badge-blue', payée:'badge-green', en_retard:'badge-red', annulée:'badge-gray' };

export async function render(el, param) {
  if (param) { await renderDetail(el, param); return; }
  await renderList(el);
}

async function renderList(el) {
  const [factures, stats] = await Promise.all([api.factures(), api.factureStats()]).catch(() => [[],{}]);

  el.innerHTML = `
    <div class="page-header">
      <div><h1>Facturation</h1><p>${factures.length} facture(s)</p></div>
      <button class="btn btn-primary" id="add-fac">+ Nouvelle facture</button>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1.5rem">
      <div class="stat-card">
        <div class="label">CA Facturé</div>
        <div class="value" style="font-size:1.4rem">${fmt(stats.total)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Encaissé</div>
        <div class="value" style="font-size:1.4rem;color:var(--success)">${fmt(stats.paye)}</div>
      </div>
      <div class="stat-card">
        <div class="label">À encaisser</div>
        <div class="value" style="font-size:1.4rem;color:var(--warning)">${fmt(stats.impaye)}</div>
      </div>
      <div class="stat-card">
        <div class="label">En retard</div>
        <div class="value" style="font-size:1.4rem;color:${stats.retard>0?'var(--danger)':'var(--success)'}">${stats.retard}</div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        ${factures.length ? `<table>
          <thead><tr><th>Numéro</th><th>Client</th><th>Montant TTC</th><th>Payé</th><th>Reste</th><th>Échéance</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>${factures.map(f => {
            const reste = (f.montant_ttc||0) - (f.montant_paye||0);
            const retard = f.date_echeance && new Date(f.date_echeance) < new Date() && f.statut === 'envoyée';
            return `<tr>
              <td><strong>${f.numero}</strong></td>
              <td>${f.client_name||'—'}</td>
              <td><strong>${fmt(f.montant_ttc)}</strong></td>
              <td style="color:var(--success)">${fmt(f.montant_paye)}</td>
              <td style="color:${reste>0?'var(--warning)':'var(--muted)'}">${reste>0?fmt(reste):'—'}</td>
              <td style="color:${retard?'var(--danger)':'var(--muted)'}${retard?';font-weight:700':''}">${f.date_echeance||'—'}${retard?' ⚠':''}  </td>
              <td><span class="badge ${BADGE[f.statut]||'badge-gray'}">${f.statut}</span></td>
              <td><div style="display:flex;gap:.3rem">
                <button class="btn btn-ghost btn-sm" onclick="location.hash='#/factures/${f.id}'">👁️</button>
                <button class="btn btn-ghost btn-sm btn-rappel" data-id="${f.id}" title="Rappel IA">📧</button>
              </div></td>
            </tr>`;}).join('')}
          </tbody>
        </table>` : `<div class="empty-state"><div class="icon">💰</div><h3>Aucune facture</h3><p>Créez votre première facture ou convertissez un devis accepté.</p></div>`}
      </div>
    </div>
    <div id="modal-container"></div>`;

  el.querySelector('#add-fac').onclick = async () => {
    const clients = await api.clients().catch(() => []);
    showFactureModal(el, clients);
  };

  el.querySelectorAll('.btn-rappel').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = '⏳';
    try {
      const r = await api.rappelFacture(b.dataset.id);
      showRappelModal(el, r.texte);
    } catch(e) { toast(e.message, 'error'); }
    finally { b.disabled = false; b.textContent = '📧'; }
  });
}

async function renderDetail(el, id) {
  const fac = await api.factureOne(id).catch(() => null);
  if (!fac) { toast('Facture introuvable', 'error'); return; }
  const fmt2 = n => (n||0).toLocaleString('fr-FR',{minimumFractionDigits:2});

  el.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/factures" style="color:var(--muted);font-size:.85rem;text-decoration:none">← Factures</a>
        <h1 style="margin-top:.3rem">${fac.numero}</h1>
        <p>Client : ${fac.client_name||'—'} · Émise le ${fac.date_emission||'—'} · Échéance ${fac.date_echeance||'—'}</p>
      </div>
      <div style="display:flex;gap:.75rem;align-items:center">
        <span class="badge ${BADGE[fac.statut]||'badge-gray'}" style="font-size:.9rem">${fac.statut}</span>
        ${fac.statut==='brouillon'?`<button class="btn btn-primary" id="btn-send">📤 Envoyer</button>`:''}
        ${fac.statut==='envoyée'?`<button class="btn btn-primary" id="btn-pay">💳 Enregistrer paiement</button>`:''}
        <button class="btn btn-ghost btn-sm" id="btn-rappel">📧 Rappel IA</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.5rem">
      <div class="card">
        <div class="card-header"><h3>Lignes de facturation</h3></div>
        <div class="card-body">
          <table class="lignes-table">
            <thead><tr><th>Description</th><th>Qté</th><th>Unité</th><th>P.U. HT</th><th>Total HT</th></tr></thead>
            <tbody>
              ${(fac.lignes||[]).map(l=>`<tr>
                <td>${l.description||''}</td>
                <td>${l.quantite||0}</td>
                <td>${l.unite||''}</td>
                <td>${fmt2(l.prix_unitaire||0)} €</td>
                <td><strong>${fmt2((l.quantite||0)*(l.prix_unitaire||0))} €</strong></td>
              </tr>`).join('')}
              ${!(fac.lignes||[]).length?`<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:1rem">Aucune ligne</td></tr>`:''}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:1.5rem">
        <div class="card"><div class="card-body">
          <div style="display:flex;flex-direction:column;gap:.5rem;font-size:.875rem">
            <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Total HT</span><strong>${fmt(fac.montant_ht)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">TVA ${fac.taux_tva||20}%</span><strong>${fmt((fac.montant_ttc||0)-(fac.montant_ht||0))}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:1.1rem;color:var(--orange);border-top:1px solid var(--border);padding-top:.5rem;margin-top:.25rem">
              <span>Total TTC</span><strong>${fmt(fac.montant_ttc)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:.5rem"><span style="color:var(--muted)">Payé</span><strong style="color:var(--success)">${fmt(fac.montant_paye)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Reste dû</span>
              <strong style="color:${(fac.montant_ttc||0)-(fac.montant_paye||0)>0?'var(--warning)':'var(--success)'}">${fmt((fac.montant_ttc||0)-(fac.montant_paye||0))}</strong>
            </div>
          </div>
        </div></div>

        <div class="card">
          <div class="card-header"><h3>Paiements (${fac.paiements?.length||0})</h3></div>
          <div class="card-body">
            ${fac.paiements?.length ? fac.paiements.map(p=>`
              <div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.82rem">
                <div><div style="font-weight:600">${fmt(p.montant)}</div><div style="color:var(--muted)">${p.mode||''}</div></div>
                <div style="color:var(--muted)">${p.date_paiement}</div>
              </div>`).join('') : '<p style="color:var(--muted);font-size:.82rem">Aucun paiement enregistré</p>'}
          </div>
        </div>
      </div>
    </div>
    <div id="modal-container"></div>`;

  el.querySelector('#btn-send')?.onclick = async () => {
    await api.sendFacture(id);
    toast('Facture marquée comme envoyée', 'success');
    renderDetail(el, id);
  };

  el.querySelector('#btn-pay')?.onclick = () => showPaiementModal(el, fac);

  el.querySelector('#btn-rappel')?.onclick = async () => {
    const btn = el.querySelector('#btn-rappel');
    btn.disabled = true; btn.textContent = '⏳';
    try {
      const r = await api.rappelFacture(id);
      showRappelModal(el, r.texte);
    } catch(e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '📧 Rappel IA'; }
  };
}

function showPaiementModal(el, fac) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo">
      <div class="modal">
        <div class="modal-header"><h2>Enregistrer un paiement</h2><button class="modal-close" id="mc">×</button></div>
        <div class="modal-body">
          <div class="form-group"><label>Montant (€) *</label>
            <input type="number" class="form-control" id="pay-montant" step="0.01" value="${((fac.montant_ttc||0)-(fac.montant_paye||0)).toFixed(2)}" /></div>
          <div class="form-row">
            <div class="form-group"><label>Date</label><input type="date" class="form-control" id="pay-date" value="${new Date().toISOString().slice(0,10)}" /></div>
            <div class="form-group"><label>Mode</label>
              <select class="form-control" id="pay-mode">
                ${['Virement','Chèque','Espèces','CB','Prélèvement'].map(m=>`<option>${m}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group"><label>Référence</label><input class="form-control" id="pay-ref" placeholder="Ref virement, chèque n°..." /></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="mc2">Annuler</button>
          <button class="btn btn-primary" id="save-pay">Enregistrer</button>
        </div>
      </div>
    </div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close;
  mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#save-pay').onclick = async () => {
    try {
      const r = await api.paiement(fac.id, {
        montant: parseFloat(mc.querySelector('#pay-montant').value),
        date_paiement: mc.querySelector('#pay-date').value,
        mode: mc.querySelector('#pay-mode').value,
        reference: mc.querySelector('#pay-ref').value,
      });
      toast(`Paiement enregistré — Facture ${r.statut}`, 'success');
      close();
      renderDetail(el, fac.id);
    } catch(e) { toast(e.message, 'error'); }
  };
}

function showRappelModal(el, texte) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo">
      <div class="modal modal-lg">
        <div class="modal-header"><h2>📧 Email de relance généré</h2><button class="modal-close" id="mc">×</button></div>
        <div class="modal-body">
          <div class="alert alert-info" style="margin-bottom:1rem">Copiez ce texte dans votre client email.</div>
          <textarea class="form-control" style="min-height:300px;font-family:inherit">${texte}</textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="mc2">Fermer</button>
          <button class="btn btn-primary" id="copy-btn">📋 Copier</button>
        </div>
      </div>
    </div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close;
  mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#copy-btn').onclick = () => {
    navigator.clipboard.writeText(texte);
    toast('Copié dans le presse-papier', 'success');
  };
}

function showFactureModal(el, clients) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo">
      <div class="modal">
        <div class="modal-header"><h2>Nouvelle facture</h2><button class="modal-close" id="mc">×</button></div>
        <div class="modal-body">
          <div class="form-group"><label>Client</label>
            <select class="form-control" id="f-client"><option value="">Aucun</option>
              ${clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Montant HT (€)</label><input type="number" step="0.01" class="form-control" id="f-ht" value="0" /></div>
            <div class="form-group"><label>TVA (%)</label>
              <select class="form-control" id="f-tva"><option value="20">20%</option><option value="10">10%</option><option value="5.5">5.5%</option></select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Date d'échéance</label><input type="date" class="form-control" id="f-ech" value="${new Date(Date.now()+30*86400000).toISOString().slice(0,10)}" /></div>
            <div class="form-group"><label>Mode de paiement</label>
              <select class="form-control" id="f-mode">
                ${['Virement','Chèque','Espèces','CB'].map(m=>`<option>${m}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="mc2">Annuler</button>
          <button class="btn btn-primary" id="save-f">Créer</button>
        </div>
      </div>
    </div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close;
  mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#save-f').onclick = async () => {
    try {
      const f = await api.createFacture({
        client_id: mc.querySelector('#f-client').value||null,
        montant_ht: parseFloat(mc.querySelector('#f-ht').value)||0,
        taux_tva: parseFloat(mc.querySelector('#f-tva').value),
        date_echeance: mc.querySelector('#f-ech').value,
        mode_paiement: mc.querySelector('#f-mode').value,
      });
      toast(`Facture ${f.numero} créée`, 'success');
      close();
      renderList(el);
    } catch(e) { toast(e.message, 'error'); }
  };
}
