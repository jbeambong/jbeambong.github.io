import { api } from '../api.js';
import { toast } from '../app.js';

let clients = [];

export async function render(el, id) {
  if (id) { await renderDetail(el, id); return; }
  await renderList(el);
}

async function renderList(el) {
  clients = await api.clients().catch(() => []);
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Clients</h1><p>${clients.length} client(s) enregistré(s)</p></div>
      <button class="btn btn-primary" id="add-client">+ Nouveau client</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        ${clients.length ? `<table>
          <thead><tr><th>Nom</th><th>Contact</th><th>Email</th><th>Téléphone</th><th>Actions</th></tr></thead>
          <tbody id="clients-body">
            ${clients.map(c => `<tr data-id="${c.id}">
              <td><strong>${c.name}</strong>${c.siret ? `<br><span style="font-size:.75rem;color:var(--muted)">SIRET: ${c.siret}</span>` : ''}</td>
              <td>${c.contact || '—'}</td>
              <td>${c.email ? `<a href="mailto:${c.email}" style="color:var(--orange)">${c.email}</a>` : '—'}</td>
              <td>${c.phone || '—'}</td>
              <td><div style="display:flex;gap:.4rem">
                <button class="btn btn-ghost btn-sm btn-edit" data-id="${c.id}">✏️</button>
                <button class="btn btn-danger btn-sm btn-del" data-id="${c.id}">🗑️</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>` : `<div class="empty-state"><div class="icon">👥</div><h3>Aucun client</h3><p>Ajoutez votre premier client pour commencer.</p></div>`}
      </div>
    </div>
    <div id="modal-container"></div>`;

  el.querySelector('#add-client').onclick = () => showModal(el, null);
  el.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => showModal(el, clients.find(c => c.id == b.dataset.id)));
  el.querySelectorAll('.btn-del').forEach(b => b.onclick = async () => {
    if (!confirm('Supprimer ce client ?')) return;
    await api.deleteClient(b.dataset.id);
    toast('Client supprimé', 'success');
    renderList(el);
  });
}

function showModal(el, client) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <div class="modal-header"><h2>${client ? 'Modifier le client' : 'Nouveau client'}</h2><button class="modal-close" id="modal-close">×</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Nom *</label><input class="form-control" id="f-name" value="${client?.name || ''}" /></div>
            <div class="form-group"><label>SIRET</label><input class="form-control" id="f-siret" value="${client?.siret || ''}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Contact</label><input class="form-control" id="f-contact" value="${client?.contact || ''}" /></div>
            <div class="form-group"><label>Email</label><input type="email" class="form-control" id="f-email" value="${client?.email || ''}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Téléphone</label><input class="form-control" id="f-phone" value="${client?.phone || ''}" /></div>
            <div class="form-group"><label>Adresse</label><input class="form-control" id="f-address" value="${client?.address || ''}" /></div>
          </div>
          <div class="form-group"><label>Notes</label><textarea class="form-control" id="f-notes">${client?.notes || ''}</textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="modal-cancel">Annuler</button>
          <button class="btn btn-primary" id="modal-save">Enregistrer</button>
        </div>
      </div>
    </div>`;

  const close = () => mc.innerHTML = '';
  mc.querySelector('#modal-close').onclick = close;
  mc.querySelector('#modal-cancel').onclick = close;
  mc.querySelector('#modal-overlay').onclick = e => { if (e.target.id === 'modal-overlay') close(); };

  mc.querySelector('#modal-save').onclick = async () => {
    const data = {
      name: mc.querySelector('#f-name').value,
      siret: mc.querySelector('#f-siret').value,
      contact: mc.querySelector('#f-contact').value,
      email: mc.querySelector('#f-email').value,
      phone: mc.querySelector('#f-phone').value,
      address: mc.querySelector('#f-address').value,
      notes: mc.querySelector('#f-notes').value,
    };
    try {
      if (client) await api.updateClient(client.id, data);
      else await api.createClient(data);
      toast(`Client ${client ? 'mis à jour' : 'créé'}`, 'success');
      close();
      renderList(el);
    } catch (e) { toast(e.message, 'error'); }
  };
}

async function renderDetail(el, id) {
  const c = await api.client(id).catch(() => null);
  if (!c) { toast('Client introuvable', 'error'); return; }
  el.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/clients" style="color:var(--muted);font-size:.85rem;text-decoration:none">← Clients</a>
        <h1 style="margin-top:.3rem">${c.name}</h1>
        ${c.siret ? `<p>SIRET: ${c.siret}</p>` : ''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="card"><div class="card-body">
        <div style="display:flex;flex-direction:column;gap:.6rem;font-size:.88rem">
          ${c.contact ? `<div><strong>Contact :</strong> ${c.contact}</div>` : ''}
          ${c.email ? `<div><strong>Email :</strong> <a href="mailto:${c.email}" style="color:var(--orange)">${c.email}</a></div>` : ''}
          ${c.phone ? `<div><strong>Tél :</strong> ${c.phone}</div>` : ''}
          ${c.address ? `<div><strong>Adresse :</strong> ${c.address}</div>` : ''}
          ${c.notes ? `<div><strong>Notes :</strong> ${c.notes}</div>` : ''}
        </div>
      </div></div>
      <div style="display:flex;flex-direction:column;gap:1.5rem">
        <div class="card"><div class="card-header"><h3>Devis (${c.devis?.length || 0})</h3></div>
          <div class="table-wrap">
            ${c.devis?.length ? `<table><thead><tr><th>N°</th><th>Titre</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
              ${c.devis.map(d => `<tr><td>${d.numero}</td><td>${d.titre}</td><td>${(d.montant_ttc||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0})}</td><td>${d.statut}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty-state" style="padding:1.2rem"><p>Aucun devis</p></div>'}
          </div>
        </div>
        <div class="card"><div class="card-header"><h3>Factures (${c.factures?.length || 0})</h3></div>
          <div class="table-wrap">
            ${c.factures?.length ? `<table><thead><tr><th>N°</th><th>Montant</th><th>Échéance</th><th>Statut</th></tr></thead><tbody>
              ${c.factures.map(f => `<tr><td>${f.numero}</td><td>${(f.montant_ttc||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0})}</td><td>${f.date_echeance||'—'}</td><td>${f.statut}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty-state" style="padding:1.2rem"><p>Aucune facture</p></div>'}
          </div>
        </div>
      </div>
    </div>`;
}
