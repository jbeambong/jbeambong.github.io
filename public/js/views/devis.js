import { api } from '../api.js';
import { toast } from '../app.js';

const fmt = n => (n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const BADGE = { brouillon:'badge-gray', envoyé:'badge-blue', accepté:'badge-green', refusé:'badge-red' };

export async function render(el, param) {
  if (param === 'new') { await renderGenerator(el); return; }
  if (param) { await renderDetail(el, param); return; }
  await renderList(el);
}

async function renderList(el) {
  const [devis, clients] = await Promise.all([api.devis(), api.clients()]).catch(() => [[],[]]);
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Devis & Chiffrage</h1><p>${devis.length} devis</p></div>
      <div style="display:flex;gap:.75rem">
        <button class="btn btn-ghost" id="btn-new-manual">+ Manuel</button>
        <button class="btn btn-primary" id="btn-ai">🤖 Générer par IA</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm filter-btn active" data-s="">Tous</button>
          <button class="btn btn-ghost btn-sm filter-btn" data-s="brouillon">Brouillon</button>
          <button class="btn btn-ghost btn-sm filter-btn" data-s="envoyé">Envoyé</button>
          <button class="btn btn-ghost btn-sm filter-btn" data-s="accepté">Accepté</button>
          <button class="btn btn-ghost btn-sm filter-btn" data-s="refusé">Refusé</button>
        </div>
      </div>
      <div id="devis-table" class="table-wrap">${renderTable(devis)}</div>
    </div>
    <div id="modal-container"></div>`;

  el.querySelector('#btn-ai').onclick = () => { location.hash = '#/devis/new'; };
  el.querySelector('#btn-new-manual').onclick = () => showManualModal(el, clients, null);

  el.querySelectorAll('.filter-btn').forEach(b => b.onclick = async () => {
    el.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const filtered = b.dataset.s ? devis.filter(d => d.statut === b.dataset.s) : devis;
    el.querySelector('#devis-table').innerHTML = renderTable(filtered);
    attachTableEvents(el, clients);
  });

  attachTableEvents(el, clients);
}

function renderTable(devis) {
  if (!devis.length) return `<div class="empty-state"><div class="icon">📋</div><h3>Aucun devis</h3><p>Créez votre premier devis.</p></div>`;
  return `<table>
    <thead><tr><th>Numéro</th><th>Client</th><th>Titre</th><th>Montant HT</th><th>Montant TTC</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>
      ${devis.map(d => `<tr>
        <td><strong>${d.numero}</strong></td>
        <td>${d.client_name || '—'}</td>
        <td>${d.titre}</td>
        <td>${fmt(d.montant_ht)}</td>
        <td><strong>${fmt(d.montant_ttc)}</strong></td>
        <td><span class="badge ${BADGE[d.statut]||'badge-gray'}">${d.statut}</span></td>
        <td style="color:var(--muted);font-size:.8rem">${d.date_emission || d.created_at?.slice(0,10)}</td>
        <td><div style="display:flex;gap:.3rem">
          <button class="btn btn-ghost btn-sm btn-view" data-id="${d.id}" title="Voir">👁️</button>
          <button class="btn btn-ghost btn-sm btn-facture" data-id="${d.id}" title="→ Facture">💰</button>
          <button class="btn btn-danger btn-sm btn-del" data-id="${d.id}" title="Supprimer">🗑️</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function attachTableEvents(el, clients) {
  el.querySelectorAll('.btn-view').forEach(b => b.onclick = () => { location.hash = `#/devis/${b.dataset.id}`; });
  el.querySelectorAll('.btn-facture').forEach(b => b.onclick = async () => {
    try {
      const f = await api.fromDevis(b.dataset.id);
      toast(`Facture ${f.numero} créée`, 'success');
      location.hash = '#/factures';
    } catch (e) { toast(e.message, 'error'); }
  });
  el.querySelectorAll('.btn-del').forEach(b => b.onclick = async () => {
    if (!confirm('Supprimer ce devis ?')) return;
    await api.deleteDevis(b.dataset.id);
    toast('Devis supprimé', 'success');
    renderList(el);
  });
}

// ── AI Generator ─────────────────────────────────────────────────
async function renderGenerator(el) {
  const clients = await api.clients().catch(() => []);
  el.innerHTML = `
    <div class="page-header">
      <div><a href="#/devis" style="color:var(--muted);font-size:.85rem;text-decoration:none">← Devis</a><h1 style="margin-top:.3rem">🤖 Générer un devis par IA</h1></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div>
        <div class="card">
          <div class="card-header"><h3>Description des travaux</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>Client</label>
              <select class="form-control" id="gen-client">
                <option value="">Sélectionner un client</option>
                ${clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>TVA (%)</label>
              <select class="form-control" id="gen-tva">
                <option value="20" selected>20%</option>
                <option value="10">10%</option>
                <option value="5.5">5.5%</option>
              </select>
            </div>
            <div class="form-group">
              <label>Décrivez les travaux en détail *</label>
              <textarea class="form-control" id="gen-prompt" style="min-height:180px" placeholder="Ex: Terrassement et VRD pour lotissement de 12 maisons à Bordeaux (33). Surface à terrasser : 4 500 m². Travaux incluant : décapage terre végétale 20 cm, fouilles en rigole, remblai compacté, pose réseaux EP/EU, voirie béton désactivé..."></textarea>
            </div>
            <button class="btn btn-primary" style="width:100%" id="gen-btn">🤖 Générer le devis</button>
          </div>
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card-header"><h3>Résultat de l'agent IA</h3></div>
          <div class="card-body">
            <div id="gen-result" style="color:var(--muted);font-size:.875rem">L'agent IA va analyser votre description et générer un devis détaillé avec les lignes de prix.</div>
          </div>
        </div>
      </div>
    </div>`;

  el.querySelector('#gen-btn').onclick = async () => {
    const prompt = el.querySelector('#gen-prompt').value.trim();
    if (!prompt) { toast('Décrivez les travaux', 'error'); return; }
    const client_id = el.querySelector('#gen-client').value || null;
    const taux_tva  = parseFloat(el.querySelector('#gen-tva').value);

    const resultEl = el.querySelector('#gen-result');
    resultEl.innerHTML = `<div class="ai-thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div> L'agent analyse votre description…</div>`;
    el.querySelector('#gen-btn').disabled = true;

    let text = '';
    try {
      const last = await api.generateDevis({ prompt, client_id, taux_tva }, d => {
        if (d.chunk) {
          text += d.chunk;
          resultEl.innerHTML = `<div class="ai-stream">${text}</div>`;
          resultEl.querySelector('.ai-stream').scrollTop = 9999;
        }
        if (d.done && d.devis) {
          showDevisPreview(resultEl, d.devis);
        }
      });
      if (!last?.done) toast('Devis généré !', 'success');
    } catch (e) {
      toast(e.message, 'error');
      resultEl.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    } finally {
      el.querySelector('#gen-btn').disabled = false;
    }
  };
}

function showDevisPreview(el, devis) {
  const fmt2 = n => (n||0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  el.innerHTML = `
    <div class="alert alert-success">✓ Devis <strong>${devis.numero}</strong> créé avec succès !</div>
    <div style="margin-bottom:1rem">
      <div style="font-weight:700;font-size:1rem;margin-bottom:.3rem">${devis.titre}</div>
      <div style="font-size:.82rem;color:var(--muted)">${devis.description || ''}</div>
    </div>
    <table class="lignes-table">
      <thead><tr><th>Description</th><th>Qté</th><th>Unité</th><th>P.U. HT</th><th>Total HT</th></tr></thead>
      <tbody>
        ${(devis.lignes||[]).map(l => `<tr>
          <td>${l.description}</td><td>${l.quantite}</td><td>${l.unite}</td>
          <td>${fmt2(l.prix_unitaire)} €</td><td><strong>${fmt2(l.total)} €</strong></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="text-align:right;margin-top:1rem;font-size:.9rem">
      <div>Total HT : <strong>${fmt(devis.montant_ht)}</strong></div>
      <div>TVA ${devis.taux_tva}% : <strong>${fmt(devis.montant_ttc - devis.montant_ht)}</strong></div>
      <div style="font-size:1.1rem;color:var(--orange);margin-top:.3rem">Total TTC : <strong>${fmt(devis.montant_ttc)}</strong></div>
    </div>
    <div style="margin-top:1rem;display:flex;gap:.75rem">
      <a href="#/devis/${devis.id}" class="btn btn-primary">Voir & modifier →</a>
      <a href="#/devis" class="btn btn-ghost">Liste des devis</a>
    </div>`;
}

// ── Detail / Edit ─────────────────────────────────────────────────
async function renderDetail(el, id) {
  const [devis, clients] = await Promise.all([api.devisOne(id), api.clients()]).catch(() => [null, []]);
  if (!devis) { toast('Devis introuvable', 'error'); return; }

  const fmt2 = n => (n||0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  let lignes = devis.lignes || [];

  const renderLignes = () => `
    <table class="lignes-table">
      <thead><tr><th>Description</th><th>Qté</th><th>Unité</th><th>P.U. HT</th><th>Total HT</th><th></th></tr></thead>
      <tbody id="lignes-tbody">
        ${lignes.map((l,i) => `<tr data-i="${i}">
          <td><input value="${l.description||''}" data-field="description" /></td>
          <td><input type="number" value="${l.quantite||0}" data-field="quantite" style="width:70px" /></td>
          <td><input value="${l.unite||''}" data-field="unite" style="width:60px" /></td>
          <td><input type="number" step="0.01" value="${l.prix_unitaire||0}" data-field="prix_unitaire" style="width:90px" /></td>
          <td><strong>${fmt2((l.quantite||0)*(l.prix_unitaire||0))} €</strong></td>
          <td><button class="btn btn-danger btn-sm btn-rm-ligne" data-i="${i}">✕</button></td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr class="total-row"><td colspan="4">Total HT</td><td id="total-ht"><strong>${fmt2(lignes.reduce((s,l)=>s+(l.quantite||0)*(l.prix_unitaire||0),0))} €</strong></td><td></td></tr></tfoot>
    </table>`;

  el.innerHTML = `
    <div class="page-header">
      <div><a href="#/devis" style="color:var(--muted);font-size:.85rem;text-decoration:none">← Devis</a>
        <h1 style="margin-top:.3rem">${devis.numero} — ${devis.titre}</h1></div>
      <div style="display:flex;gap:.75rem;align-items:center">
        <span class="badge ${BADGE[devis.statut]||'badge-gray'}" style="font-size:.85rem">${devis.statut}</span>
        <button class="btn btn-primary" id="save-btn">💾 Enregistrer</button>
        <button class="btn btn-ghost" id="facture-btn">💰 → Facture</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.5rem">
      <div style="display:flex;flex-direction:column;gap:1.5rem">
        <div class="card">
          <div class="card-header"><h3>Informations</h3></div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group"><label>Client</label>
                <select class="form-control" id="f-client">
                  <option value="">Aucun</option>
                  ${clients.map(c=>`<option value="${c.id}" ${devis.client_id==c.id?'selected':''}>${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Titre</label><input class="form-control" id="f-titre" value="${devis.titre}" /></div>
            </div>
            <div class="form-group"><label>Description</label><textarea class="form-control" id="f-desc">${devis.description||''}</textarea></div>
            <div class="form-row">
              <div class="form-group"><label>TVA (%)</label>
                <select class="form-control" id="f-tva">
                  ${[20,10,5.5].map(v=>`<option value="${v}" ${devis.taux_tva==v?'selected':''}>${v}%</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Validité (jours)</label><input type="number" class="form-control" id="f-valid" value="${devis.validite_jours||30}" /></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Lignes de devis</h3>
            <button class="btn btn-ghost btn-sm" id="add-ligne">+ Ajouter une ligne</button>
          </div>
          <div class="card-body" id="lignes-container">${renderLignes()}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:1.5rem">
        <div class="card"><div class="card-body">
          <div style="font-size:.82rem;color:var(--muted);margin-bottom:.5rem">Statut</div>
          <select class="form-control" id="f-statut">
            ${['brouillon','envoyé','accepté','refusé'].map(s=>`<option value="${s}" ${devis.statut===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <div style="margin-top:1.5rem;font-size:.82rem">
            <div style="display:flex;justify-content:space-between;margin-bottom:.4rem"><span style="color:var(--muted)">Total HT</span><strong id="sum-ht">${fmt(devis.montant_ht)}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:.4rem"><span style="color:var(--muted)">TVA</span><strong id="sum-tva">${fmt(devis.montant_ttc-devis.montant_ht)}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:1.1rem;color:var(--orange)"><span>Total TTC</span><strong id="sum-ttc">${fmt(devis.montant_ttc)}</strong></div>
          </div>
        </div></div>
        <div class="card"><div class="card-body">
          <div class="form-group"><label>Notes</label><textarea class="form-control" id="f-notes" style="min-height:100px">${devis.notes||''}</textarea></div>
        </div></div>
      </div>
    </div>`;

  function recalc() {
    const total_ht = lignes.reduce((s,l)=>s+(l.quantite||0)*(l.prix_unitaire||0),0);
    const tva = parseFloat(el.querySelector('#f-tva').value)/100;
    el.querySelector('#sum-ht').textContent = fmt(total_ht);
    el.querySelector('#sum-tva').textContent = fmt(total_ht*tva);
    el.querySelector('#sum-ttc').textContent = fmt(total_ht*(1+tva));
    el.querySelector('#lignes-container').innerHTML = renderLignes();
    attachLigneEvents();
  }

  function attachLigneEvents() {
    el.querySelectorAll('#lignes-tbody input').forEach(inp => inp.oninput = () => {
      const i = parseInt(inp.closest('tr').dataset.i);
      lignes[i][inp.dataset.field] = inp.type === 'number' ? parseFloat(inp.value)||0 : inp.value;
      lignes[i].total = (lignes[i].quantite||0)*(lignes[i].prix_unitaire||0);
      recalc();
    });
    el.querySelectorAll('.btn-rm-ligne').forEach(b => b.onclick = () => {
      lignes.splice(parseInt(b.dataset.i), 1);
      recalc();
    });
  }

  el.querySelector('#add-ligne').onclick = () => {
    lignes.push({ description:'', quantite:1, unite:'u', prix_unitaire:0, total:0 });
    recalc();
  };

  el.querySelector('#f-tva').onchange = recalc;
  attachLigneEvents();

  el.querySelector('#save-btn').onclick = async () => {
    const ht = lignes.reduce((s,l)=>s+(l.quantite||0)*(l.prix_unitaire||0),0);
    const tva = parseFloat(el.querySelector('#f-tva').value);
    await api.updateDevis(id, {
      titre: el.querySelector('#f-titre').value,
      description: el.querySelector('#f-desc').value,
      client_id: el.querySelector('#f-client').value || null,
      lignes, montant_ht: ht, taux_tva: tva, notes: el.querySelector('#f-notes').value,
      validite_jours: el.querySelector('#f-valid').value,
    });
    await api.devisStatut(id, el.querySelector('#f-statut').value);
    toast('Devis enregistré', 'success');
  };

  el.querySelector('#facture-btn').onclick = async () => {
    try {
      const f = await api.fromDevis(id);
      toast(`Facture ${f.numero} créée`, 'success');
      location.hash = '#/factures';
    } catch (e) { toast(e.message, 'error'); }
  };
}

function showManualModal(el, clients, devis) {
  const mc = document.getElementById('modal-container') || el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header"><h2>Nouveau devis</h2><button class="modal-close" id="mc">×</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Client</label>
              <select class="form-control" id="m-client"><option value="">Aucun</option>
                ${clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Titre *</label><input class="form-control" id="m-titre" /></div>
          </div>
          <div class="form-group"><label>Description</label><textarea class="form-control" id="m-desc" style="min-height:60px"></textarea></div>
          <div class="form-row">
            <div class="form-group"><label>Montant HT (€)</label><input type="number" class="form-control" id="m-ht" value="0" /></div>
            <div class="form-group"><label>TVA (%)</label>
              <select class="form-control" id="m-tva"><option value="20">20%</option><option value="10">10%</option><option value="5.5">5.5%</option></select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="m-cancel">Annuler</button>
          <button class="btn btn-primary" id="m-save">Créer</button>
        </div>
      </div>
    </div>`;

  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close;
  mc.querySelector('#m-cancel').onclick = close;
  mc.querySelector('#modal-overlay').onclick = e => { if(e.target.id==='modal-overlay') close(); };
  mc.querySelector('#m-save').onclick = async () => {
    try {
      await api.createDevis({
        client_id: mc.querySelector('#m-client').value || null,
        titre: mc.querySelector('#m-titre').value,
        description: mc.querySelector('#m-desc').value,
        montant_ht: parseFloat(mc.querySelector('#m-ht').value)||0,
        taux_tva: parseFloat(mc.querySelector('#m-tva').value),
      });
      toast('Devis créé', 'success');
      close();
      renderList(el);
    } catch(e) { toast(e.message, 'error'); }
  };
}
