import { api } from '../api.js';
import { toast } from '../app.js';

export async function render(el) {
  const [employes, materiels, chantiers] = await Promise.all([
    api.employes().catch(() => []),
    api.materiels().catch(() => []),
    api.chantiers().catch(() => []),
  ]);

  // Get current week affectations
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt_d = d => d.toISOString().slice(0,10);

  const affectations = await api.affectations({ date_debut: fmt_d(monday), date_fin: fmt_d(sunday) }).catch(() => []);

  el.innerHTML = `
    <div class="page-header">
      <div><h1>Planning & RH</h1><p>Semaine du ${monday.toLocaleDateString('fr-FR')} au ${sunday.toLocaleDateString('fr-FR')}</p></div>
      <div style="display:flex;gap:.75rem">
        <button class="btn btn-ghost" id="btn-ai">🤖 Optimiser le planning</button>
        <button class="btn btn-primary" id="btn-add">+ Affecter</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
      <!-- Équipe -->
      <div class="card">
        <div class="card-header"><h3>👷 Équipe (${employes.length})</h3>
          <button class="btn btn-ghost btn-sm" id="add-emp">+ Ajouter</button>
        </div>
        <div class="card-body" style="max-height:300px;overflow-y:auto">
          ${employes.length ? employes.map(e => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
              <div>
                <div style="font-weight:600;font-size:.875rem">${e.prenom} ${e.nom}</div>
                <div style="font-size:.75rem;color:var(--muted)">${e.poste||'—'} · ${e.qualification||'—'}</div>
              </div>
              <div style="text-align:right">
                ${e.taux_journalier?`<div style="font-size:.78rem;color:var(--orange)">${e.taux_journalier}€/j</div>`:''}
                <div style="font-size:.72rem;color:var(--muted)">${e.telephone||''}</div>
              </div>
            </div>`).join('') : '<p style="color:var(--muted);font-size:.85rem">Aucun employé</p>'}
        </div>
      </div>

      <!-- Matériel -->
      <div class="card">
        <div class="card-header"><h3>🚜 Matériel (${materiels.length})</h3>
          <button class="btn btn-ghost btn-sm" id="add-mat">+ Ajouter</button>
        </div>
        <div class="card-body" style="max-height:300px;overflow-y:auto">
          ${materiels.length ? materiels.map(m => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
              <div>
                <div style="font-weight:600;font-size:.875rem">${m.nom}</div>
                <div style="font-size:.75rem;color:var(--muted)">${m.type||'—'} ${m.immatriculation?'· '+m.immatriculation:''}</div>
              </div>
              <div style="text-align:right">
                <span class="badge ${m.disponible?'badge-green':'badge-red'}" style="font-size:.7rem">${m.disponible?'Disponible':'Indispo'}</span>
                ${m.cout_journalier?`<div style="font-size:.72rem;color:var(--orange);margin-top:.2rem">${m.cout_journalier}€/j</div>`:''}
              </div>
            </div>`).join('') : '<p style="color:var(--muted);font-size:.85rem">Aucun matériel</p>'}
        </div>
      </div>
    </div>

    <!-- Planning hebdomadaire -->
    <div class="card" style="margin-bottom:1.5rem">
      <div class="card-header"><h3>Planning de la semaine</h3></div>
      <div class="card-body" style="overflow-x:auto">
        ${renderWeekCalendar(monday, employes, materiels, affectations)}
      </div>
    </div>

    <!-- Affectations en cours -->
    <div class="card">
      <div class="card-header"><h3>Affectations actives</h3></div>
      <div class="table-wrap">
        ${affectations.length ? `<table>
          <thead><tr><th>Ressource</th><th>Chantier</th><th>Période</th><th>Notes</th><th></th></tr></thead>
          <tbody>${affectations.map(a => `<tr>
            <td><strong>${a.employe_nom||a.materiel_nom||'—'}</strong></td>
            <td>${a.chantier_nom||'—'}</td>
            <td style="font-size:.82rem;color:var(--muted)">${a.date_debut} → ${a.date_fin}</td>
            <td style="font-size:.82rem;color:var(--muted)">${a.notes||'—'}</td>
            <td><button class="btn btn-danger btn-sm btn-del-aff" data-id="${a.id}">🗑️</button></td>
          </tr>`).join('')}</tbody>
        </table>` : `<div class="empty-state" style="padding:2rem"><p>Aucune affectation cette semaine</p></div>`}
      </div>
    </div>

    <div id="ai-result" style="margin-top:1.5rem"></div>
    <div id="modal-container"></div>`;

  el.querySelector('#add-emp').onclick = () => showEmployeModal(el, null);
  el.querySelector('#add-mat').onclick = () => showMaterielModal(el, null);
  el.querySelector('#btn-add').onclick = () => showAffectationModal(el, employes, materiels, chantiers);

  el.querySelectorAll('.btn-del-aff').forEach(b => b.onclick = async () => {
    await api.deleteAffectation(b.dataset.id);
    toast('Affectation supprimée', 'success');
    render(el);
  });

  el.querySelector('#btn-ai').onclick = async () => {
    const btn = el.querySelector('#btn-ai');
    btn.disabled = true; btn.textContent = '⏳ Analyse…';
    const res = el.querySelector('#ai-result');
    res.innerHTML = `<div class="card"><div class="card-header"><h3>🤖 Recommandations IA</h3></div><div class="card-body"><div class="ai-thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div> Analyse en cours…</div></div></div>`;
    try {
      const r = await api.optimiserPlanning({ contexte: '' });
      res.innerHTML = `<div class="card"><div class="card-header"><h3>🤖 Recommandations de l'agent Planning</h3></div><div class="card-body"><div style="white-space:pre-wrap;font-size:.875rem;line-height:1.7;color:var(--text)">${r.recommandations}</div></div></div>`;
    } catch(e) { toast(e.message, 'error'); res.innerHTML = ''; }
    finally { btn.disabled = false; btn.textContent = '🤖 Optimiser le planning'; }
  };
}

function renderWeekCalendar(monday, employes, materiels, affectations) {
  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate()+i);
    return d;
  });
  const DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const resources = [
    ...employes.map(e => ({ id:'e'+e.id, label: e.prenom+' '+e.nom, type:'employe', src_id: e.id })),
    ...materiels.map(m => ({ id:'m'+m.id, label: m.nom, type:'materiel', src_id: m.id })),
  ];

  if (!resources.length) return '<p style="color:var(--muted);font-size:.875rem">Ajoutez des employés ou du matériel pour voir le planning.</p>';

  return `<div class="calendar-grid" style="grid-template-columns:180px repeat(7,1fr)">
    <div class="cal-cell cal-header">Ressource</div>
    ${days.map((d,i) => `<div class="cal-cell cal-header">${DAY_NAMES[i]}<br><span style="font-weight:400;font-size:.7rem;color:var(--muted)">${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</span></div>`).join('')}
    ${resources.map(r => `
      <div class="cal-cell cal-resource">${r.label}<br><span style="font-size:.7rem;color:var(--muted)">${r.type==='employe'?'👷':'🚜'}</span></div>
      ${days.map(d => {
        const ds = d.toISOString().slice(0,10);
        const aff = affectations.filter(a => {
          const match = r.type==='employe' ? a.employe_id==r.src_id : a.materiel_id==r.src_id;
          return match && a.date_debut <= ds && a.date_fin >= ds;
        });
        return `<div class="cal-cell">${aff.map(a=>`<div class="cal-event" title="${a.chantier_nom||''}">${(a.chantier_nom||'').slice(0,12)}${(a.chantier_nom||'').length>12?'…':''}</div>`).join('')}</div>`;
      }).join('')}
    `).join('')}
  </div>`;
}

function showEmployeModal(el, emp) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo"><div class="modal">
      <div class="modal-header"><h2>${emp?'Modifier':'Nouvel'} employé</h2><button class="modal-close" id="mc">×</button></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>Prénom</label><input class="form-control" id="e-prenom" value="${emp?.prenom||''}" /></div>
          <div class="form-group"><label>Nom</label><input class="form-control" id="e-nom" value="${emp?.nom||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Poste</label><input class="form-control" id="e-poste" value="${emp?.poste||''}" placeholder="Chef de chantier, Conducteur engins..." /></div>
          <div class="form-group"><label>Qualification</label><input class="form-control" id="e-qual" value="${emp?.qualification||''}" placeholder="CACES R482, Permis PL..." /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Téléphone</label><input class="form-control" id="e-tel" value="${emp?.telephone||''}" /></div>
          <div class="form-group"><label>Taux journalier (€)</label><input type="number" class="form-control" id="e-taux" value="${emp?.taux_journalier||''}" /></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="mc2">Annuler</button>
        <button class="btn btn-primary" id="save-e">Enregistrer</button>
      </div>
    </div></div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close; mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#save-e').onclick = async () => {
    const d = {
      prenom: mc.querySelector('#e-prenom').value, nom: mc.querySelector('#e-nom').value,
      poste: mc.querySelector('#e-poste').value, qualification: mc.querySelector('#e-qual').value,
      telephone: mc.querySelector('#e-tel').value, taux_journalier: parseFloat(mc.querySelector('#e-taux').value)||null,
    };
    try {
      if (emp) await api.updateEmploye(emp.id, d); else await api.createEmploye(d);
      toast(`Employé ${emp?'mis à jour':'ajouté'}`, 'success'); close(); render(el);
    } catch(e) { toast(e.message,'error'); }
  };
}

function showMaterielModal(el, mat) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo"><div class="modal">
      <div class="modal-header"><h2>${mat?'Modifier':'Nouveau'} matériel</h2><button class="modal-close" id="mc">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Nom *</label><input class="form-control" id="m-nom" value="${mat?.nom||''}" placeholder="Pelle hydraulique CAT 320..." /></div>
        <div class="form-row">
          <div class="form-group"><label>Type</label>
            <select class="form-control" id="m-type">
              ${['engin','véhicule','outillage','autre'].map(t=>`<option value="${t}" ${mat?.type===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Immatriculation</label><input class="form-control" id="m-immat" value="${mat?.immatriculation||''}" /></div>
        </div>
        <div class="form-group"><label>Coût journalier (€)</label><input type="number" class="form-control" id="m-cout" value="${mat?.cout_journalier||''}" /></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="mc2">Annuler</button>
        <button class="btn btn-primary" id="save-m">Enregistrer</button>
      </div>
    </div></div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close; mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#save-m').onclick = async () => {
    const d = {
      nom: mc.querySelector('#m-nom').value, type: mc.querySelector('#m-type').value,
      immatriculation: mc.querySelector('#m-immat').value, cout_journalier: parseFloat(mc.querySelector('#m-cout').value)||null,
    };
    try {
      if (mat) await api.updateMateriel(mat.id, d); else await api.createMateriel(d);
      toast(`Matériel ${mat?'mis à jour':'ajouté'}`, 'success'); close(); render(el);
    } catch(e) { toast(e.message,'error'); }
  };
}

function showAffectationModal(el, employes, materiels, chantiers) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo"><div class="modal">
      <div class="modal-header"><h2>Nouvelle affectation</h2><button class="modal-close" id="mc">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label>Chantier</label>
          <select class="form-control" id="a-ch"><option value="">Aucun</option>
            ${chantiers.map(c=>`<option value="${c.id}">${c.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Employé</label>
          <select class="form-control" id="a-emp"><option value="">Aucun</option>
            ${employes.map(e=>`<option value="${e.id}">${e.prenom} ${e.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Matériel</label>
          <select class="form-control" id="a-mat"><option value="">Aucun</option>
            ${materiels.map(m=>`<option value="${m.id}">${m.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Du</label><input type="date" class="form-control" id="a-deb" value="${new Date().toISOString().slice(0,10)}" /></div>
          <div class="form-group"><label>Au</label><input type="date" class="form-control" id="a-fin" /></div>
        </div>
        <div class="form-group"><label>Notes</label><input class="form-control" id="a-notes" /></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="mc2">Annuler</button>
        <button class="btn btn-primary" id="save-a">Affecter</button>
      </div>
    </div></div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close; mc.querySelector('#mc2').onclick = close;
  mc.querySelector('#save-a').onclick = async () => {
    try {
      await api.createAffectation({
        chantier_id: mc.querySelector('#a-ch').value||null,
        employe_id: mc.querySelector('#a-emp').value||null,
        materiel_id: mc.querySelector('#a-mat').value||null,
        date_debut: mc.querySelector('#a-deb').value,
        date_fin: mc.querySelector('#a-fin').value,
        notes: mc.querySelector('#a-notes').value,
      });
      toast('Affectation créée', 'success'); close(); render(el);
    } catch(e) { toast(e.message,'error'); }
  };
}
