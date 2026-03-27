import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { genererDocument } from '../agents/conformiteAgent.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { type, chantier_id } = req.query;
  let q = `SELECT d.*, ch.nom as chantier_nom FROM documents_conformite d
           LEFT JOIN chantiers ch ON ch.id=d.chantier_id WHERE d.company_id=?`;
  const params = [req.user.companyId];
  if (type) { q += ' AND d.type=?'; params.push(type); }
  if (chantier_id) { q += ' AND d.chantier_id=?'; params.push(chantier_id); }
  q += ' ORDER BY d.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

router.post('/generate', async (req, res, next) => {
  try {
    const { type, chantier_id, infos } = req.body;
    if (!type) return res.status(400).json({ error: 'Type de document requis' });

    const company  = db.prepare('SELECT * FROM companies WHERE id=?').get(req.user.companyId);
    const chantier = chantier_id ? db.prepare('SELECT * FROM chantiers WHERE id=?').get(chantier_id) : null;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');

    let full = '';
    await genererDocument({
      type, company, chantier, infos, companyId: req.user.companyId, userId: req.user.userId,
      onChunk: c => { full += c; res.write(`data: ${JSON.stringify({ chunk: c })}\n\n`); },
    });

    const saved = db.prepare(`INSERT INTO documents_conformite (company_id, chantier_id, type, titre, contenu, ai_prompt, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      req.user.companyId, chantier_id || null, type,
      `${type} — ${chantier?.nom || company.name} — ${new Date().toLocaleDateString('fr-FR')}`,
      full, JSON.stringify(infos), req.user.userId
    );
    res.write(`data: ${JSON.stringify({ done: true, document: saved })}\n\n`);
    res.end();
  } catch (e) { next(e); }
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM documents_conformite WHERE id=? AND company_id=?').get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  res.json(row);
});

router.put('/:id', (req, res, next) => {
  try {
    const { contenu, titre } = req.body;
    db.prepare("UPDATE documents_conformite SET contenu=?, titre=?, updated_at=datetime('now') WHERE id=? AND company_id=?")
      .run(contenu, titre, req.params.id, req.user.companyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/finaliser', (req, res) => {
  db.prepare("UPDATE documents_conformite SET statut='finalisé', updated_at=datetime('now') WHERE id=? AND company_id=?")
    .run(req.params.id, req.user.companyId);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM documents_conformite WHERE id=? AND company_id=?').run(req.params.id, req.user.companyId);
  res.json({ ok: true });
});

export default router;
