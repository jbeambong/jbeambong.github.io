import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { generateDevis } from '../agents/devisAgent.js';

const router = Router();
router.use(requireAuth);

function nextNumero(companyId) {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT numero FROM devis WHERE company_id=? AND numero LIKE ? ORDER BY id DESC LIMIT 1")
    .get(companyId, `DEV-${year}-%`);
  const n = last ? parseInt(last.numero.split('-')[2]) + 1 : 1;
  return `DEV-${year}-${String(n).padStart(3, '0')}`;
}

router.get('/', (req, res) => {
  const { statut, client_id } = req.query;
  let q = 'SELECT d.*, c.name as client_name FROM devis d LEFT JOIN clients c ON c.id=d.client_id WHERE d.company_id=?';
  const params = [req.user.companyId];
  if (statut) { q += ' AND d.statut=?'; params.push(statut); }
  if (client_id) { q += ' AND d.client_id=?'; params.push(client_id); }
  q += ' ORDER BY d.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

router.post('/', (req, res, next) => {
  try {
    const { client_id, titre, description, lignes, montant_ht, taux_tva, notes, validite_jours } = req.body;
    if (!titre) return res.status(400).json({ error: 'Titre obligatoire' });
    const ttc = (montant_ht || 0) * (1 + (taux_tva || 20) / 100);
    const now = new Date().toISOString().slice(0, 10);
    const numero = nextNumero(req.user.companyId);
    const row = db.prepare(`INSERT INTO devis (company_id, client_id, numero, titre, description, lignes, montant_ht, taux_tva, montant_ttc, notes, validite_jours, date_emission, date_validite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      req.user.companyId, client_id, numero, titre, description,
      JSON.stringify(lignes || []), montant_ht || 0, taux_tva || 20, ttc,
      notes, validite_jours || 30, now,
      new Date(Date.now() + (validite_jours || 30) * 86400000).toISOString().slice(0, 10)
    );
    res.status(201).json({ ...row, lignes: JSON.parse(row.lignes) });
  } catch (e) { next(e); }
});

// AI generate
router.post('/generate', async (req, res, next) => {
  try {
    const { prompt, client_id, taux_tva } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Description requise' });

    const company = db.prepare('SELECT * FROM companies WHERE id=?').get(req.user.companyId);
    const client  = client_id ? db.prepare('SELECT * FROM clients WHERE id=?').get(client_id) : null;

    // Stream response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');

    let fullText = '';
    await generateDevis({
      prompt, company, client,
      companyId: req.user.companyId,
      userId: req.user.userId,
      onChunk: chunk => { fullText += chunk; res.write(`data: ${JSON.stringify({ chunk })}\n\n`); },
    });

    // Parse AI result and save
    let parsed = { titre: 'Devis généré par IA', lignes: [], montant_ht: 0 };
    try { parsed = JSON.parse(fullText.match(/```json\n?([\s\S]*?)\n?```/)?.[1] || fullText); } catch {}

    const ttc = (parsed.montant_ht || 0) * (1 + (taux_tva || 20) / 100);
    const now = new Date().toISOString().slice(0, 10);
    const numero = nextNumero(req.user.companyId);
    const saved = db.prepare(`INSERT INTO devis (company_id, client_id, numero, titre, description, ai_prompt, lignes, montant_ht, taux_tva, montant_ttc, date_emission, date_validite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      req.user.companyId, client_id || null, numero,
      parsed.titre || 'Devis IA', parsed.description || prompt, prompt,
      JSON.stringify(parsed.lignes || []),
      parsed.montant_ht || 0, taux_tva || 20, ttc, now,
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    );

    res.write(`data: ${JSON.stringify({ done: true, devis: { ...saved, lignes: JSON.parse(saved.lignes) } })}\n\n`);
    res.end();
  } catch (e) { next(e); }
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT d.*, c.name as client_name FROM devis d LEFT JOIN clients c ON c.id=d.client_id WHERE d.id=? AND d.company_id=?')
    .get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ...row, lignes: JSON.parse(row.lignes || '[]') });
});

router.put('/:id', (req, res, next) => {
  try {
    const { titre, description, lignes, montant_ht, taux_tva, notes, validite_jours, client_id } = req.body;
    const ttc = (montant_ht || 0) * (1 + (taux_tva || 20) / 100);
    db.prepare(`UPDATE devis SET titre=?, description=?, client_id=?, lignes=?, montant_ht=?, taux_tva=?, montant_ttc=?, notes=?, validite_jours=?, updated_at=datetime('now')
      WHERE id=? AND company_id=?`).run(
      titre, description, client_id, JSON.stringify(lignes || []),
      montant_ht || 0, taux_tva || 20, ttc, notes, validite_jours || 30,
      req.params.id, req.user.companyId
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/:id/statut', (req, res) => {
  const { statut } = req.body;
  db.prepare("UPDATE devis SET statut=?, updated_at=datetime('now') WHERE id=? AND company_id=?")
    .run(statut, req.params.id, req.user.companyId);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM devis WHERE id=? AND company_id=?').run(req.params.id, req.user.companyId);
  res.json({ ok: true });
});

export default router;
