import { api } from '../api.js';
import { toast } from '../app.js';

const BADGE = { nouveau:'badge-blue', analysé:'badge-yellow', candidature:'badge-orange', gagné:'badge-green', perdu:'badge-red' };

export async function render(el, param) {
  if (param) { await renderDetail(el, param); return; }
  await renderList(el);
}

async function renderList(el) {
  const aos = await api.aos().catch(() => []);
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Appels d'offres</h1><p>${aos.length} appel(s) d'offres</p></div>
      <button class="btn btn-primary" id="add-ao">+ Ajouter un AO</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        ${aos.length ? `<table>
          <thead><tr><th>Titre</th><th>Acheteur</th><th>Date limite</th><th>Montant estimé</th><th>Score IA</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>${aos.map(a => `<tr>
            <td><strong style="cursor:pointer;color:var(--text)" onclick="location.hash='#/appels-offres/${a.id}'">${a.titre}</strong>${a.reference?`<br><span style="font-size:.72rem;color:var(--muted)">${a.reference}</span>`:''}</td>
            <td>${a.acheteur||'—'}</td>
            <td style="${isUrgent(a.date_limite)?'color:var(--danger);font-weight:600':'color:var(--muted);font-size:.85rem'}">${a.date_limite||'—'}</td>
            <td>${a.montant_estime?(a.montant_estime/1000).toFixed(0)+'k€':'—'}</td>
            <td>${a.score_pertinence!=null?`
              <div style="font-size:.85rem;font-weight:700;color:${a.score_pertinence>=70?'var(--success)':a.score_pertinence>=40?'var(--warning)':'var(--danger)'}">${a.score_pertinence}/100</div>
              <div class="score-bar" style="width:80px"><div class="score-fill" style="width:${a.score_pertinence}%"></div></div>
            `:'<span style="color:var(--muted);font-size:.8rem">Non analysé</span>'}</td>
            <td><span class="badge ${BADGE[a.statut]||'badge-gray'}">${a.statut}</span></td>
            <td><div style="display:flex;gap:.3rem">
              <button class="btn btn-ghost btn-sm" data-id="${a.id}" onclick="location.hash='#/appels-offres/${a.id}'">👁️</button>
              <button class="btn btn-ghost btn-sm btn-analyse" data-id="${a.id}" title="Analyser par IA">🤖</button>
              <button class="btn btn-danger btn-sm btn-del" data-id="${a.id}">🗑️</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table>` : `<div class="empty-state"><div class="icon">📢</div><h3>Aucun appel d'offres</h3><p>Ajoutez votre premier AO pour commencer la veille.</p></div>`}
      </div>
    </div>
    <div id="modal-container"></div>`;

  el.querySelector('#add-ao').onclick = () => showAOModal(el, null);

  el.querySelectorAll('.btn-del').forEach(b => b.onclick = async () => {
    if (!confirm('Supprimer cet AO ?')) return;
    await api.deleteAO(b.dataset.id);
    toast('AO supprimé', 'success');
    renderList(el);
  });

  el.querySelectorAll('.btn-analyse').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = '⏳';
    try {
      const r = await api.analyseAO(b.dataset.id);
      toast(`Score : ${r.score}/100 — ${r.resume?.slice(0,60)}…`, 'info');
      renderList(el);
    } catch (e) { toast(e.message, 'error'); }
    finally { b.disabled = false; b.textContent = '🤖'; }
  });
}

function isUrgent(date) {
  if (!date) return false;
  const diff = (new Date(date) - Date.now()) / 86400000;
  return diff >= 0 && diff <= 7;
}

async function renderDetail(el, id) {
  const ao = await api.aoOne(id).catch(() => null);
  if (!ao) { toast('AO introuvable', 'error'); return; }

  el.innerHTML = `
    <div class="page-header">
      <div><a href="#/appels-offres" style="color:var(--muted);font-size:.85rem;text-decoration:none">← Appels d'offres</a>
        <h1 style="margin-top:.3rem">${ao.titre}</h1>
        <p>${ao.acheteur || ''} ${ao.reference ? `— ${ao.reference}` : ''}</p>
      </div>
      <span class="badge ${BADGE[ao.statut]||'badge-gray'}" style="font-size:.9rem">${ao.statut}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div style="display:flex;flex-direction:column;gap:1.5rem">
        <div class="card"><div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:.875rem">
            <div><div style="color:var(--muted);font-size:.78rem;margin-bottom:.25rem">Date limite</div><strong ${isUrgent(ao.date_limite)?'style="color:var(--danger)"':''}>${ao.date_limite||'—'}</strong></div>
            <div><div style="color:var(--muted);font-size:.78rem;margin-bottom:.25rem">Montant estimé</div><strong>${ao.montant_estime?ao.montant_estime.toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}):'—'}</strong></div>
            <div><div style="color:var(--muted);font-size:.78rem;margin-bottom:.25rem">Lieu</div><strong>${ao.lieu||'—'}</strong></div>
            <div><div style="color:var(--muted);font-size:.78rem;margin-bottom:.25rem">Source</div>${ao.source_url?`<a href="${ao.source_url}" target="_blank" style="color:var(--orange)">Voir →</a>`:'—'}</div>
          </div>
          ${ao.description?`<div style="margin-top:1rem;font-size:.85rem;color:var(--muted)">${ao.description}</div>`:''}
        </div></div>

        <div class="card"><div class="card-header"><h3>Analyse IA</h3>
          <button class="btn btn-primary btn-sm" id="btn-analyse">${ao.ai_analyse?'🔄 Ré-analyser':'🤖 Analyser'}</button>
        </div>
        <div class="card-body" id="analyse-result">
          ${ao.ai_analyse ? renderAnalyse(ao) : '<p style="color:var(--muted);font-size:.875rem">Cliquez sur "Analyser" pour que l\'agent IA évalue la pertinence de cet AO.</p>'}
        </div></div>
      </div>

      <div class="card" style="display:flex;flex-direction:column">
        <div class="card-header"><h3>Réponse / Mémoire technique</h3>
          <button class="btn btn-primary btn-sm" id="btn-reponse">${ao.ai_reponse?'🔄 Régénérer':'✍️ Générer'}</button>
        </div>
        <div class="card-body" id="reponse-result" style="flex:1;overflow-y:auto">
          ${ao.ai_reponse ? `<div class="doc-content md">${md2html(ao.ai_reponse)}</div>` : '<p style="color:var(--muted);font-size:.875rem">Générez la réponse à soumettre à l\'acheteur public.</p>'}
        </div>
      </div>
    </div>
    <div id="modal-container"></div>`;

  el.querySelector('#btn-analyse').onclick = async () => {
    const btn = el.querySelector('#btn-analyse');
    btn.disabled = true; btn.textContent = '⏳ Analyse…';
    const res = el.querySelector('#analyse-result');
    res.innerHTML = `<div class="ai-thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div> Analyse en cours…</div>`;
    try {
      const r = await api.analyseAO(id);
      const updated = await api.aoOne(id);
      res.innerHTML = renderAnalyse(updated);
      toast(`Analyse terminée — Score ${r.score}/100`, 'success');
    } catch (e) { toast(e.message, 'error'); res.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
    finally { btn.disabled = false; btn.textContent = '🔄 Ré-analyser'; }
  };

  el.querySelector('#btn-reponse').onclick = async () => {
    const btn = el.querySelector('#btn-reponse');
    btn.disabled = true; btn.textContent = '⏳ Génération…';
    const res = el.querySelector('#reponse-result');
    res.innerHTML = `<div class="ai-thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div> Rédaction en cours…</div>`;
    let text = '';
    try {
      await api.reponseAO(id, d => {
        if (d.chunk) { text += d.chunk; res.innerHTML = `<div class="doc-content md">${md2html(text)}</div>`; }
      });
      toast('Réponse générée', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '🔄 Régénérer'; }
  };
}

function renderAnalyse(ao) {
  if (!ao.ai_analyse) return '';
  let parsed = {};
  try { parsed = JSON.parse(ao.ai_analyse.match(/```json\n?([\s\S]*?)\n?```/)?.[1] || ao.ai_analyse); } catch {}
  const score = ao.score_pertinence || parsed.score || 0;
  const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)';
  return `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
      <div style="font-size:2rem;font-weight:800;color:${color}">${score}<span style="font-size:1rem;font-weight:400;color:var(--muted)">/100</span></div>
      <div><div class="score-bar" style="width:200px"><div class="score-fill" style="width:${score}%"></div></div>
        <div style="font-size:.78rem;color:var(--muted);margin-top:.3rem">${parsed.recommandation||''}</div>
      </div>
    </div>
    ${parsed.resume?`<p style="font-size:.875rem;margin-bottom:.75rem">${parsed.resume}</p>`:''}
    ${parsed.points_forts?.length?`<div style="margin-bottom:.75rem"><div style="font-size:.78rem;font-weight:700;color:var(--success);margin-bottom:.3rem">POINTS FORTS</div>${parsed.points_forts.map(p=>`<div style="font-size:.82rem;color:var(--muted)">✓ ${p}</div>`).join('')}</div>`:''}
    ${parsed.points_attention?.length?`<div><div style="font-size:.78rem;font-weight:700;color:var(--warning);margin-bottom:.3rem">POINTS D'ATTENTION</div>${parsed.points_attention.map(p=>`<div style="font-size:.82rem;color:var(--muted)">⚠ ${p}</div>`).join('')}</div>`:''}
    ${parsed.justification?`<div style="margin-top:.75rem;font-size:.82rem;color:var(--muted);border-top:1px solid var(--border);padding-top:.75rem">${parsed.justification}</div>`:''}`;
}

function showAOModal(el, ao) {
  const mc = el.querySelector('#modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" id="mo">
      <div class="modal modal-lg">
        <div class="modal-header"><h2>Ajouter un appel d'offres</h2><button class="modal-close" id="mc">×</button></div>
        <div class="modal-body">
          <div class="form-group"><label>Titre *</label><input class="form-control" id="ao-titre" /></div>
          <div class="form-row">
            <div class="form-group"><label>Référence</label><input class="form-control" id="ao-ref" placeholder="BOAMP-2024-xxx" /></div>
            <div class="form-group"><label>Acheteur public</label><input class="form-control" id="ao-acheteur" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Date limite</label><input type="date" class="form-control" id="ao-date" /></div>
            <div class="form-group"><label>Montant estimé (€)</label><input type="number" class="form-control" id="ao-montant" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Lieu</label><input class="form-control" id="ao-lieu" /></div>
            <div class="form-group"><label>URL source</label><input class="form-control" id="ao-url" placeholder="https://..." /></div>
          </div>
          <div class="form-group"><label>Description / objet des travaux</label><textarea class="form-control" id="ao-desc" style="min-height:100px"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="ao-cancel">Annuler</button>
          <button class="btn btn-primary" id="ao-save">Ajouter</button>
        </div>
      </div>
    </div>`;
  const close = () => mc.innerHTML = '';
  mc.querySelector('#mc').onclick = close;
  mc.querySelector('#ao-cancel').onclick = close;
  mc.querySelector('#mo').onclick = e => { if(e.target.id==='mo') close(); };
  mc.querySelector('#ao-save').onclick = async () => {
    try {
      await api.createAO({
        titre: mc.querySelector('#ao-titre').value,
        reference: mc.querySelector('#ao-ref').value,
        acheteur: mc.querySelector('#ao-acheteur').value,
        date_limite: mc.querySelector('#ao-date').value,
        montant_estime: parseFloat(mc.querySelector('#ao-montant').value)||null,
        lieu: mc.querySelector('#ao-lieu').value,
        description: mc.querySelector('#ao-desc').value,
        source_url: mc.querySelector('#ao-url').value,
      });
      toast('AO ajouté', 'success');
      close();
      renderList(el);
    } catch(e) { toast(e.message, 'error'); }
  };
}

function md2html(text) {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|l|p])/gm, '<p>')
    .replace(/<p><\/p>/g, '');
}
