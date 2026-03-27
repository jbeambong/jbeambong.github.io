import { api } from '../api.js';
import { toast } from '../app.js';

const TYPES = ['PPSPS','DICT','DOE','PV_RECEPTION','CERFA'];
const TYPE_DESC = {
  PPSPS: 'Plan de Prévention Sécurité',
  DICT: 'Déclaration Intention de Commencement de Travaux',
  DOE: 'Dossier des Ouvrages Exécutés',
  PV_RECEPTION: 'Procès-Verbal de Réception',
  CERFA: 'Formulaire CERFA / Déclaration administrative',
};
const BADGE = { brouillon:'badge-yellow', finalisé:'badge-green', soumis:'badge-blue' };

export async function render(el, param) {
  if (param === 'generate') { await renderGenerator(el); return; }
  if (param) { await renderDetail(el, param); return; }
  await renderList(el);
}

async function renderList(el) {
  const docs = await api.conformite().catch(() => []);

  // Group by type
  const byType = {};
  TYPES.forEach(t => { byType[t] = docs.filter(d => d.type === t); });

  el.innerHTML = `
    <div class="page-header">
      <div><h1>Conformité réglementaire</h1><p>${docs.length} document(s) généré(s)</p></div>
      <button class="btn btn-primary" id="gen-doc">🤖 Générer un document</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin-bottom:1.5rem">
      ${TYPES.map(t => `
        <div class="card" style="cursor:pointer" onclick="document.querySelector('#tab-${t}').scrollIntoView({behavior:'smooth'})">
          <div class="card-body" style="display:flex;align-items:center;gap:1rem">
            <div style="font-size:2rem">${t==='PPSPS'?'🦺':t==='DICT'?'🗺️':t==='DOE'?'📁':t==='PV_RECEPTION'?'✅':'📋'}</div>
            <div>
              <div style="font-weight:700;font-size:.9rem">${t}</div>
              <div style="font-size:.75rem;color:var(--muted)">${TYPE_DESC[t]}</div>
              <div style="font-size:.78rem;margin-top:.2rem"><span class="badge badge-orange">${byType[t].length} doc${byType[t].length>1?'s':''}</span></div>
            </div>
          </div>
        </div>`).join('')}
    </div>

    ${TYPES.map(t => `
      <div id="tab-${t}" style="margin-bottom:2rem">
        <div style="display:flex;align-items:center;gap.75rem;margin-bottom:.75rem">
          <h2 style="font-size:1rem;font-weight:700">${t} — ${TYPE_DESC[t]}</h2>
        </div>
        ${byType[t].length ? `<div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Titre</th><th>Chantier</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>${byType[t].map(d => `<tr>
            <td><strong>${d.titre}</strong></td>
            <td style="color:var(--muted);font-size:.85rem">${d.chantier_nom||'—'}</td>
            <td><span class="badge ${BADGE[d.statut]||'badge-gray'}">${d.statut}</span></td>
            <td style="color:var(--muted);font-size:.8rem">${d.created_at?.slice(0,10)||'—'}</td>
            <td><div style="display:flex;gap:.3rem">
              <button class="btn btn-ghost btn-sm" onclick="location.hash='#/conformite/${d.id}'">👁️ Voir</button>
              <button class="btn btn-danger btn-sm btn-del" data-id="${d.id}">🗑️</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div></div>` :
        `<div class="card"><div class="empty-state" style="padding:2rem">
          <p>Aucun document ${t}. <button class="btn btn-ghost btn-sm" onclick="document.querySelector('#gen-doc').click()">Générer →</button></p>
        </div></div>`}
      </div>`).join('')}
    <div id="modal-container"></div>`;

  el.querySelector('#gen-doc').onclick = () => { location.hash = '#/conformite/generate'; };
  el.querySelectorAll('.btn-del').forEach(b => b.onclick = async () => {
    if (!confirm('Supprimer ce document ?')) return;
    await api.deleteDoc(b.dataset.id);
    toast('Document supprimé', 'success');
    renderList(el);
  });
}

async function renderGenerator(el) {
  const chantiers = await api.chantiers().catch(() => []);
  el.innerHTML = `
    <div class="page-header">
      <div><a href="#/conformite" style="color:var(--muted);font-size:.85rem;text-decoration:none">← Conformité</a>
        <h1 style="margin-top:.3rem">🤖 Générer un document réglementaire</h1>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div>
        <div class="card">
          <div class="card-header"><h3>Paramètres du document</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>Type de document *</label>
              <select class="form-control" id="doc-type">
                ${TYPES.map(t=>`<option value="${t}">${t} — ${TYPE_DESC[t]}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Chantier associé</label>
              <select class="form-control" id="doc-chantier">
                <option value="">Aucun (document générique)</option>
                ${chantiers.map(c=>`<option value="${c.id}">${c.nom}${c.adresse?' — '+c.adresse:''}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Informations complémentaires</label>
              <textarea class="form-control" id="doc-infos" style="min-height:140px" placeholder="Maître d'ouvrage : XXX&#10;Coordonnateur SPS : XXX&#10;Nature des risques : fouilles, travaux en hauteur...&#10;Durée prévisionnelle : X semaines&#10;Nb de travailleurs : X&#10;Sous-traitants : XXX"></textarea>
            </div>
            <button class="btn btn-primary" style="width:100%" id="gen-btn">🤖 Générer le document</button>
          </div>
        </div>
      </div>
      <div class="card" style="display:flex;flex-direction:column">
        <div class="card-header"><h3>Document généré</h3></div>
        <div class="card-body" id="doc-result" style="flex:1">
          <p style="color:var(--muted);font-size:.875rem">L'agent IA va générer un document complet et conforme à la réglementation française.</p>
          <div style="margin-top:1.5rem;display:flex;flex-direction:column;gap:.5rem">
            ${TYPES.map(t=>`<div style="display:flex;align-items:center;gap.5rem;font-size:.82rem;color:var(--muted)">
              <span style="width:80px;font-weight:700;color:var(--text)">${t}</span>
              <span>${TYPE_DESC[t]}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  el.querySelector('#gen-btn').onclick = async () => {
    const type = el.querySelector('#doc-type').value;
    const chantier_id = el.querySelector('#doc-chantier').value || null;
    const infosRaw = el.querySelector('#doc-infos').value;
    const infos = {};
    infosRaw.split('\n').forEach(line => {
      const [k,...v] = line.split(':');
      if (k && v.length) infos[k.trim()] = v.join(':').trim();
    });

    const btn = el.querySelector('#gen-btn');
    btn.disabled = true; btn.textContent = '⏳ Génération en cours…';
    const res = el.querySelector('#doc-result');
    res.innerHTML = `<div class="ai-thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div> Rédaction du ${type}…</div>`;

    let text = '';
    try {
      await api.generateDoc({ type, chantier_id, infos }, d => {
        if (d.chunk) {
          text += d.chunk;
          res.innerHTML = `<div class="doc-content md">${md2html(text)}</div>`;
        }
        if (d.done && d.document) {
          res.innerHTML = `
            <div class="alert alert-success">✓ Document créé : <strong>${d.document.titre}</strong></div>
            <div class="doc-content md" style="max-height:40vh">${md2html(text)}</div>
            <div style="margin-top:1rem;display:flex;gap:.75rem">
              <a href="#/conformite/${d.document.id}" class="btn btn-primary">Ouvrir →</a>
              <a href="#/conformite" class="btn btn-ghost">Liste</a>
            </div>`;
        }
      });
    } catch(e) {
      toast(e.message, 'error');
      res.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = '🤖 Générer le document';
    }
  };
}

async function renderDetail(el, id) {
  const doc = await api.conformiteOne(id).catch(() => null);
  if (!doc) { toast('Document introuvable', 'error'); return; }

  let editing = false;

  const render_content = () => {
    el.innerHTML = `
      <div class="page-header">
        <div>
          <a href="#/conformite" style="color:var(--muted);font-size:.85rem;text-decoration:none">← Conformité</a>
          <h1 style="margin-top:.3rem">${doc.type} — ${doc.chantier_nom || 'Document général'}</h1>
          <p style="color:var(--muted);font-size:.85rem">${doc.titre}</p>
        </div>
        <div style="display:flex;gap:.75rem;align-items:center">
          <span class="badge ${BADGE[doc.statut]||'badge-gray'}" style="font-size:.9rem">${doc.statut}</span>
          ${doc.statut !== 'finalisé' ? `<button class="btn btn-primary" id="btn-finalise">✅ Finaliser</button>` : ''}
          <button class="btn btn-ghost btn-sm" id="btn-edit">${editing ? '👁️ Aperçu' : '✏️ Modifier'}</button>
          <button class="btn btn-ghost btn-sm" id="btn-print">🖨️ Imprimer</button>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          ${editing
            ? `<textarea class="form-control" id="doc-editor" style="min-height:65vh;font-family:'Courier New',monospace;font-size:.82rem">${doc.contenu||''}</textarea>
               <div style="margin-top:1rem;display:flex;justify-content:flex-end;gap:.75rem">
                 <button class="btn btn-ghost" id="cancel-edit">Annuler</button>
                 <button class="btn btn-primary" id="save-edit">💾 Enregistrer</button>
               </div>`
            : `<div class="doc-content md">${md2html(doc.contenu||'*Aucun contenu*')}</div>`}
        </div>
      </div>`;

    el.querySelector('#btn-edit')?.onclick = () => { editing = !editing; render_content(); };
    el.querySelector('#btn-print')?.onclick = () => {
      const w = window.open('', '_blank');
      w.document.write(`<html><head><title>${doc.titre}</title><style>body{font-family:sans-serif;line-height:1.6;padding:2cm;max-width:800px;margin:0 auto}h1,h2,h3{color:#333}p{color:#555}table{width:100%;border-collapse:collapse}th,td{padding:.5rem;border:1px solid #ccc}th{background:#f0f0f0}</style></head><body>${md2html(doc.contenu||'')}</body></html>`);
      w.document.close(); w.print();
    };
    el.querySelector('#btn-finalise')?.onclick = async () => {
      await api.finaliserDoc(id);
      toast('Document finalisé', 'success');
      doc.statut = 'finalisé';
      render_content();
    };
    el.querySelector('#save-edit')?.onclick = async () => {
      const contenu = el.querySelector('#doc-editor').value;
      await api.updateDoc(id, { contenu, titre: doc.titre });
      doc.contenu = contenu;
      toast('Document enregistré', 'success');
      editing = false;
      render_content();
    };
    el.querySelector('#cancel-edit')?.onclick = () => { editing = false; render_content(); };
  };

  render_content();
}

function md2html(text) {
  if (!text) return '';
  return text
    .replace(/```[\w]*\n?([\s\S]*?)\n?```/g, '<pre><code>$1</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\| (.+) \|$/gm, m => {
      const cells = m.slice(2,-2).split(' | ');
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gs, m => `<table>${m}</table>`)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '\n')
    .replace(/^(?!<[htup])/gm, '')
    .replace(/^([^<\n].+)$/gm, '<p>$1</p>');
}
