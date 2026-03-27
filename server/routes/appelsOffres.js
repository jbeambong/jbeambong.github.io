import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { analyseAO, genererReponseAO } from '../agents/appelsOffresAgent.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { statut } = req.query;
  let q = 'SELECT * FROM appels_offres WHERE company_id=?';
  const params = [req.user.companyId];
  if (statut) { q += ' AND statut=?'; params.push(statut); }
  q += ' ORDER BY date_limite ASC';
  res.json(db.prepare(q).all(...params));
});

router.post('/', (req, res, next) => {
  try {
    const { titre, reference, acheteur, date_limite, montant_estime, lieu, description, source_url } = req.body;
    if (!titre) return res.status(400).json({ error: 'Titre obligatoire' });
    const row = db.prepare(`INSERT INTO appels_offres (company_id, titre, reference, acheteur, date_limite, montant_estime, lieu, description, source_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      req.user.companyId, titre, reference, acheteur, date_limite, montant_estime, lieu, description, source_url
    );
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.post('/analyse', async (req, res, next) => {
  try {
    const { id } = req.body;
    const ao = db.prepare('SELECT * FROM appels_offres WHERE id=? AND company_id=?').get(id, req.user.companyId);
    if (!ao) return res.status(404).json({ error: 'AO introuvable' });
    const company = db.prepare('SELECT * FROM companies WHERE id=?').get(req.user.companyId);

    const analyse = await analyseAO({ ao, company, companyId: req.user.companyId, userId: req.user.userId });
    let parsed = {};
    try { parsed = JSON.parse(analyse.match(/```json\n?([\s\S]*?)\n?```/)?.[1] || analyse); } catch {}

    db.prepare("UPDATE appels_offres SET ai_analyse=?, score_pertinence=?, statut='analysé' WHERE id=?")
      .run(analyse, parsed.score || null, id);
    res.json({ analyse, score: parsed.score, resume: parsed.resume });
  } catch (e) { next(e); }
});

router.post('/reponse', async (req, res, next) => {
  try {
    const { id } = req.body;
    const ao = db.prepare('SELECT * FROM appels_offres WHERE id=? AND company_id=?').get(id, req.user.companyId);
    if (!ao) return res.status(404).json({ error: 'AO introuvable' });
    const company = db.prepare('SELECT * FROM companies WHERE id=?').get(req.user.companyId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    let full = '';
    await genererReponseAO({
      ao, company, companyId: req.user.companyId, userId: req.user.userId,
      onChunk: c => { full += c; res.write(`data: ${JSON.stringify({ chunk: c })}\n\n`); },
    });
    db.prepare("UPDATE appels_offres SET ai_reponse=?, statut='candidature' WHERE id=?").run(full, id);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) { next(e); }
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM appels_offres WHERE id=? AND company_id=?').get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  res.json(row);
});

router.put('/:id', (req, res, next) => {
  try {
    const { titre, reference, acheteur, date_limite, montant_estime, lieu, description, statut } = req.body;
    db.prepare('UPDATE appels_offres SET titre=?, reference=?, acheteur=?, date_limite=?, montant_estime=?, lieu=?, description=?, statut=? WHERE id=? AND company_id=?')
      .run(titre, reference, acheteur, date_limite, montant_estime, lieu, description, statut, req.params.id, req.user.companyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM appels_offres WHERE id=? AND company_id=?').run(req.params.id, req.user.companyId);
  res.json({ ok: true });
});

export default router;
