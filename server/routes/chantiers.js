import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { genererRapport } from '../agents/chantierAgent.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { statut } = req.query;
  let q = `SELECT c.*, cl.name as client_name FROM chantiers c
           LEFT JOIN clients cl ON cl.id=c.client_id WHERE c.company_id=?`;
  const params = [req.user.companyId];
  if (statut) { q += ' AND c.statut=?'; params.push(statut); }
  q += ' ORDER BY c.date_debut DESC';
  res.json(db.prepare(q).all(...params));
});

router.post('/', (req, res, next) => {
  try {
    const { nom, client_id, devis_id, adresse, date_debut, date_fin_prev, budget } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom obligatoire' });
    const row = db.prepare(`INSERT INTO chantiers (company_id, client_id, devis_id, nom, adresse, date_debut, date_fin_prev, budget)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      req.user.companyId, client_id, devis_id, nom, adresse, date_debut, date_fin_prev, budget
    );
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT c.*, cl.name as client_name FROM chantiers c
    LEFT JOIN clients cl ON cl.id=c.client_id WHERE c.id=? AND c.company_id=?`)
    .get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  const rapports = db.prepare('SELECT * FROM rapports_chantier WHERE chantier_id=? ORDER BY date_rapport DESC').all(row.id);
  const affectations = db.prepare(`SELECT a.*, e.nom||' '||e.prenom as employe_nom, m.nom as materiel_nom
    FROM affectations a LEFT JOIN employes e ON e.id=a.employe_id LEFT JOIN materiels m ON m.id=a.materiel_id
    WHERE a.chantier_id=?`).all(row.id);
  res.json({ ...row, rapports, affectations });
});

router.put('/:id', (req, res, next) => {
  try {
    const { nom, client_id, adresse, date_debut, date_fin_prev, date_fin_reel, statut, budget, depenses } = req.body;
    db.prepare('UPDATE chantiers SET nom=?, client_id=?, adresse=?, date_debut=?, date_fin_prev=?, date_fin_reel=?, statut=?, budget=?, depenses=? WHERE id=? AND company_id=?')
      .run(nom, client_id, adresse, date_debut, date_fin_prev, date_fin_reel, statut, budget, depenses, req.params.id, req.user.companyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Reports
router.get('/:id/rapports', (req, res) => {
  const ch = db.prepare('SELECT id FROM chantiers WHERE id=? AND company_id=?').get(req.params.id, req.user.companyId);
  if (!ch) return res.status(404).json({ error: 'Introuvable' });
  res.json(db.prepare('SELECT * FROM rapports_chantier WHERE chantier_id=? ORDER BY date_rapport DESC').all(ch.id));
});

router.post('/:id/rapports', (req, res, next) => {
  try {
    const ch = db.prepare('SELECT id FROM chantiers WHERE id=? AND company_id=?').get(req.params.id, req.user.companyId);
    if (!ch) return res.status(404).json({ error: 'Introuvable' });
    const { date_rapport, meteo, effectif, travaux_realises, incidents, materiel, observations } = req.body;
    const row = db.prepare(`INSERT INTO rapports_chantier (chantier_id, date_rapport, meteo, effectif, travaux_realises, incidents, materiel, observations, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      ch.id, date_rapport, meteo, effectif, travaux_realises, incidents, materiel, observations, req.user.userId
    );
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.post('/:id/rapports/generate', async (req, res, next) => {
  try {
    const ch = db.prepare('SELECT * FROM chantiers WHERE id=? AND company_id=?').get(req.params.id, req.user.companyId);
    if (!ch) return res.status(404).json({ error: 'Introuvable' });
    const { brief } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    let full = '';
    await genererRapport({
      chantier: ch, brief, companyId: req.user.companyId, userId: req.user.userId,
      onChunk: c => { full += c; res.write(`data: ${JSON.stringify({ chunk: c })}\n\n`); },
    });

    let parsed = {};
    try { parsed = JSON.parse(full.match(/```json\n?([\s\S]*?)\n?```/)?.[1] || full); } catch {}
    const today = new Date().toISOString().slice(0, 10);
    const saved = db.prepare(`INSERT INTO rapports_chantier (chantier_id, date_rapport, meteo, effectif, travaux_realises, incidents, materiel, observations, ai_summary, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      ch.id, today, parsed.meteo, parsed.effectif || 0, parsed.travaux_realises, parsed.incidents,
      parsed.materiel, parsed.observations, full, req.user.userId
    );
    res.write(`data: ${JSON.stringify({ done: true, rapport: saved })}\n\n`);
    res.end();
  } catch (e) { next(e); }
});

router.put('/:id/rapports/:rid', (req, res, next) => {
  try {
    const { date_rapport, meteo, effectif, travaux_realises, incidents, materiel, observations } = req.body;
    db.prepare('UPDATE rapports_chantier SET date_rapport=?, meteo=?, effectif=?, travaux_realises=?, incidents=?, materiel=?, observations=? WHERE id=?')
      .run(date_rapport, meteo, effectif, travaux_realises, incidents, materiel, observations, req.params.rid);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
