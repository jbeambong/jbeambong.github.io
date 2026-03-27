import { api } from '../api.js';
import { toast } from '../app.js';

const BADGE = { planifié:'badge-blue', en_cours:'badge-green', terminé:'badge-gray', suspendu:'badge-yellow' };
const fmt = n => (n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0});

export async function render(el, param) {
  if (param) { await renderDetail(el, param); return; }
  await renderList(el);
}

async function renderList(el) {
  const chantiers = await api.chantiers().catch(() => []);
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Chantiers</h1><p>${chantiers.length} chantier(s)</p></div>
      <button class="btn btn-primary" id="add-ch">+ Nouveau chantier</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem">
      ${chantiers.length ? chantiers.map(c => `
        <div class="card" style="cursor:pointer;transition:border-color .2s" onmouseenter="this.style.borderColor='rgba(249,115,22,.4)'" onmouseleave="this.style.borderColor=''" onclick="location.hash='#/chantiers/${c.id}'">
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
              <h3 style="font-size:1rem;font-weight:700">${c.nom}</h3>
              <span class="badge ${BADGE[c.statut]||'badge-gray'}">${c.statut}</span>
            </div>
            <div style="font-size:.82rem;color:var(--muted);margin-bottom:.75rem">${c.client_name||'Pas de client'} ${c.adresse?'• '+c.adresse:''}</div>
            <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.75rem">
              <span style="color:var(--muted)">📅 ${c.date_debut||'?'} → ${c.date_fin_prev||'?'}</span>
            </div>
            ${c.budget?`
              <div style="font-size:.78rem;color:var(--muted);margin-bottom:.3rem">Budget : ${fmt(c.budget)}</div>
              <div class="progress"><div class="progress-fill" style="width:${Math.min(100,((c.depenses||0)/c.budget)*100).toFixed(0)}%"></div></div>
              <div style="font-size:.72rem;color:var(--muted);margin-top:.25rem">${fmt(c.depenses)} dépensés</div>
            `:''}`).join('') : `<div class="empty-state"><div class="icon">🏗️</div><h3>Aucun chantier</h3><p>Créez votre premier chantier.</p></div>`}
    </div>
    <div id="modal-container"></div>`;

  el.querySelector('#add-ch')?.onclick = async () => {
    const clients = await api.clients().catch(() => []);
    showChantierModal(el, clients, null);
  };
}

async function renderDetail(el, id) {
  const [ch, clients] = await Promise.all([api.chantier(id), api.clients()]).catch(() => [null, []]);
  if (!ch) { toast('Chantier introuvable', 'error'); return; }

  el.innerHTML = `
    <div class="page-header">
      <div><a href="#/chantiers" style="color:var(--muted);font-size:.85rem;text-decoration:none">← Chantiers</a>
        <h1 style="margin-top:.3rem">${ch.nom}</h1>
        <p>${ch.client_name||''} ${ch.adresse?'• '+ch.adresse:''}</p>
      </div>
      <div style="display:flex;gap:.75rem">
        <span class="badge ${BADGE[ch.statut]||'badge-gray'}" style="font-size:.9rem">${ch.statut}</span>
        <button class="btn btn-ghost btn-sm" id="edit-ch">✏️ Modifier</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
      <div class="card"><div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.875rem">
          <div><div style="color:var(--muted);font-size:.75rem">Début</div><strong>${ch.date_debut||'—'}</strong></div>
          <div><div style="color:var(--muted);font-size:.75rem">Fin prévue</div><strong>${ch.date_fin_prev||'—'}</strong></div>
          <div><div style="color:var(--muted);font-size:.75rem">Budget</div><strong>${fmt(ch.budget)}</strong></div>
          <div><div style="color:var(--muted);font-size:.75rem">Dépenses</div><strong style="color:${(ch.depenses||0)>(ch.budget||Infinity)?'var(--danger)':'var(--success)'}">${fmt(ch.depenses)}</strong></div>
        </div>
        ${ch.budget?`
          <div style="margin-top:1rem">
            <div style="font-size:.75rem;color:var(--muted);margin-bottom:.3rem">Avancement budgétaire</div>
            <div class="progress" style="height:8px"><div class="progress-fill" style="width:${Math.min(100,((ch.depenses||0)/(ch.budget||1))*100).toFixed(0)}%"></div></div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:.25rem">${(((ch.depenses||0)/(ch.budget||1))*100).toFixed(0)}% du budget utilisé</div>
          </div>`:''}
      </div></div>
      <div class="card"><div class="card-header"><h3>Équipe & Matériel</h3></div>
        <div class="card-body">
          ${ch.affectations?.length ? ch.affectations.map(a => `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.82rem">
              <span>${a.employe_nom ? '👷' : '🚜'}</span>
              <span>${a.employe_nom || a.materiel_nom || '—'}</span>
              <span style="color:var(--muted);margin-left:auto">${a.date_debut} → ${a.date_fin}</span>
            </div>`).join('') : '<p style="color:var(--muted);font-size:.85rem">Aucune affectation</p>'}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Rapports journaliers (${ch.rapports?.length||0})</h3>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost btn-sm" id="btn-new-rapport">+ Manuel</button>
          <button class="btn btn-primary btn-sm" id="btn-ai-rapport">🤖 Générer</button>
        </div>
      </div>
      <div id="rapports-list">
        ${ch.rapports?.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Météo</th><th>Effectif</th><th>Travaux réalisés</th><th>Incidents</th></tr></thead>
          <tbody>${ch.rapports.map(r => `<tr>
            <td><strong>${r.date_rapport}</strong></td>
            <td>${r.meteo||'—'}</td>
            <td style="text-align:center">${r.effectif||0}</td>
            <td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.travaux_realises||'—'}</td>
            <td style="color:${r.incidents&&r.incidents.length>2?'var(--warning)':'var(--muted)'}">${r.incidents||'Aucun'}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<div class="empty-state" style="padding:2rem"><p>Aucun rapport journalier</p></div>'}
      </div>
    </div>
    <div id="modal-container"></div>`;

  el.querySelector('#edit-ch').onclick = async () => {
    showChantierModal(el, clients, ch, async () => {
      const updated = await api.chantier(id);
      renderDetail(el, id);
    });
  };

  el.querySelector('#btn-ai-rapport').onclick = () => showAIRapportModal(el, ch.id);
  el.querySelector('#btn-new-rapport').onclick = () => showRapportModal(el, ch.id);
}

function showChantierModal(el, clients, ch, onSave) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo">
      <div class="modal modal-lg">
        <div class="modal-header"><h2>${ch?'Modifier':'Nouveau'} chantier</h2><button class="modal-close" id="mc">×</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Nom *</label><input class="form-control" id="ch-nom" value="${ch?.nom||''}" /></div>
            <div class="form-group"><label>Client</label>
              <select class="form-control" id="ch-client"><option value="">Aucun</option>
                ${clients.map(c=>`<option value="${c.id}" ${ch?.client_id==c.id?'selected':''}>${c.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group"><label>Adresse chantier</label><input class="form-control" id="ch-adresse" value="${ch?.adresse||''}" /></div>
          <div class="form-row">
            <div class="form-group"><label>Date début</label><input type="date" class="form-control" id="ch-debut" value="${ch?.date_debut||''}" /></div>
            <div class="form-group"><label>Date fin prévue</label><input type="date" class="form-control" id="ch-fin" value="${ch?.date_fin_prev||''}" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Budget (€)</label><input type="number" class="form-control" id="ch-budget" value="${ch?.budget||''}" /></div>
            <div class="form-group"><label>Statut</label>
              <select class="form-control" id="ch-statut">
                ${['planifié','en_cours','terminé','suspendu'].map(s=>`<option value="${s}" ${ch?.statut===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="mc2">Annuler</button>
          <button class="btn btn-primary" id="save-ch">Enregistrer</button>
        </div>
      </div>
    </div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close;
  mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#mo').onclick = e => { if(e.target.id==='mo') close(); };
  mc.querySelector('#save-ch').onclick = async () => {
    const data = {
      nom: mc.querySelector('#ch-nom').value,
      client_id: mc.querySelector('#ch-client').value||null,
      adresse: mc.querySelector('#ch-adresse').value,
      date_debut: mc.querySelector('#ch-debut').value,
      date_fin_prev: mc.querySelector('#ch-fin').value,
      budget: parseFloat(mc.querySelector('#ch-budget').value)||null,
      statut: mc.querySelector('#ch-statut').value,
    };
    try {
      if (ch) await api.updateChantier(ch.id, data);
      else await api.createChantier(data);
      toast(`Chantier ${ch?'mis à jour':'créé'}`, 'success');
      close();
      if (onSave) onSave(); else renderList(el);
    } catch(e) { toast(e.message, 'error'); }
  };
}

function showAIRapportModal(el, chantierId) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo">
      <div class="modal modal-lg">
        <div class="modal-header"><h2>🤖 Générer un rapport journalier</h2><button class="modal-close" id="mc">×</button></div>
        <div class="modal-body">
          <div class="form-group"><label>Brief journalier (optionnel)</label>
            <textarea class="form-control" id="brief" style="min-height:100px" placeholder="Ex: Journée productive, 6 ouvriers, pose de 120 ml de bordures, météo nuageuse, retard RAS..."></textarea>
          </div>
          <div id="stream-result"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="mc2">Fermer</button>
          <button class="btn btn-primary" id="gen-rp">🤖 Générer</button>
        </div>
      </div>
    </div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close;
  mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#gen-rp').onclick = async () => {
    const btn = mc.querySelector('#gen-rp');
    btn.disabled = true; btn.textContent = '⏳ Génération…';
    const res = mc.querySelector('#stream-result');
    res.innerHTML = `<div class="ai-thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
    let text = '';
    try {
      await api.generateRapport(chantierId, { brief: mc.querySelector('#brief').value }, d => {
        if (d.chunk) { text += d.chunk; res.innerHTML = `<div class="ai-stream">${text}</div>`; }
        if (d.done) {
          toast('Rapport généré !', 'success');
          close();
          renderDetail(el, chantierId);
        }
      });
    } catch(e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '🤖 Générer'; }
  };
}

function showRapportModal(el, chantierId) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo">
      <div class="modal">
        <div class="modal-header"><h2>Nouveau rapport journalier</h2><button class="modal-close" id="mc">×</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Date</label><input type="date" class="form-control" id="rp-date" value="${new Date().toISOString().slice(0,10)}" /></div>
            <div class="form-group"><label>Météo</label>
              <select class="form-control" id="rp-meteo">
                ${['Ensoleillé','Nuageux','Pluvieux','Orageux','Venteux'].map(m=>`<option>${m}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group"><label>Effectif</label><input type="number" class="form-control" id="rp-eff" value="0" min="0" /></div>
          <div class="form-group"><label>Travaux réalisés</label><textarea class="form-control" id="rp-travaux" style="min-height:80px"></textarea></div>
          <div class="form-group"><label>Incidents</label><textarea class="form-control" id="rp-inc"></textarea></div>
          <div class="form-group"><label>Matériel utilisé</label><input class="form-control" id="rp-mat" /></div>
          <div class="form-group"><label>Observations</label><textarea class="form-control" id="rp-obs"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="mc2">Annuler</button>
          <button class="btn btn-primary" id="save-rp">Enregistrer</button>
        </div>
      </div>
    </div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close;
  mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#save-rp').onclick = async () => {
    try {
      await api.createRapport(chantierId, {
        date_rapport: mc.querySelector('#rp-date').value,
        meteo: mc.querySelector('#rp-meteo').value,
        effectif: parseInt(mc.querySelector('#rp-eff').value)||0,
        travaux_realises: mc.querySelector('#rp-travaux').value,
        incidents: mc.querySelector('#rp-inc').value,
        materiel: mc.querySelector('#rp-mat').value,
        observations: mc.querySelector('#rp-obs').value,
      });
      toast('Rapport enregistré', 'success');
      close();
      renderDetail(el, chantierId);
    } catch(e) { toast(e.message, 'error'); }
  };
}
