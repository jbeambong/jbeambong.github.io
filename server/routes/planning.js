import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { optimiserPlanning } from '../agents/planningAgent.js';

const router = Router();
router.use(requireAuth);

// ── Employés ──────────────────────────────────────────
router.get('/employes', (req, res) => {
  res.json(db.prepare('SELECT * FROM employes WHERE company_id=? AND actif=1 ORDER BY nom').all(req.user.companyId));
});

router.post('/employes', (req, res, next) => {
  try {
    const { nom, prenom, poste, qualification, telephone, email, taux_journalier } = req.body;
    const row = db.prepare(`INSERT INTO employes (company_id, nom, prenom, poste, qualification, telephone, email, taux_journalier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(req.user.companyId, nom, prenom, poste, qualification, telephone, email, taux_journalier);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put('/employes/:id', (req, res, next) => {
  try {
    const { nom, prenom, poste, qualification, telephone, email, taux_journalier, actif } = req.body;
    db.prepare('UPDATE employes SET nom=?, prenom=?, poste=?, qualification=?, telephone=?, email=?, taux_journalier=?, actif=? WHERE id=? AND company_id=?')
      .run(nom, prenom, poste, qualification, telephone, email, taux_journalier, actif ?? 1, req.params.id, req.user.companyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Matériels ──────────────────────────────────────────
router.get('/materiels', (req, res) => {
  res.json(db.prepare('SELECT * FROM materiels WHERE company_id=? ORDER BY nom').all(req.user.companyId));
});

router.post('/materiels', (req, res, next) => {
  try {
    const { nom, type, immatriculation, cout_journalier } = req.body;
    const row = db.prepare(`INSERT INTO materiels (company_id, nom, type, immatriculation, cout_journalier)
      VALUES (?, ?, ?, ?, ?) RETURNING *`).get(req.user.companyId, nom, type, immatriculation, cout_journalier);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put('/materiels/:id', (req, res, next) => {
  try {
    const { nom, type, immatriculation, cout_journalier, disponible } = req.body;
    db.prepare('UPDATE materiels SET nom=?, type=?, immatriculation=?, cout_journalier=?, disponible=? WHERE id=? AND company_id=?')
      .run(nom, type, immatriculation, cout_journalier, disponible ?? 1, req.params.id, req.user.companyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Affectations ──────────────────────────────────────────
router.get('/affectations', (req, res) => {
  const { date_debut, date_fin, chantier_id } = req.query;
  let q = `SELECT a.*, ch.nom as chantier_nom, e.nom||' '||e.prenom as employe_nom, m.nom as materiel_nom
           FROM affectations a
           LEFT JOIN chantiers ch ON ch.id=a.chantier_id
           LEFT JOIN employes e ON e.id=a.employe_id
           LEFT JOIN materiels m ON m.id=a.materiel_id
           WHERE a.company_id=?`;
  const params = [req.user.companyId];
  if (date_debut) { q += ' AND a.date_fin >= ?'; params.push(date_debut); }
  if (date_fin)   { q += ' AND a.date_debut <= ?'; params.push(date_fin); }
  if (chantier_id){ q += ' AND a.chantier_id=?'; params.push(chantier_id); }
  res.json(db.prepare(q).all(...params));
});

router.post('/affectations', (req, res, next) => {
  try {
    const { chantier_id, employe_id, materiel_id, date_debut, date_fin, notes } = req.body;
    const row = db.prepare(`INSERT INTO affectations (company_id, chantier_id, employe_id, materiel_id, date_debut, date_fin, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(req.user.companyId, chantier_id, employe_id || null, materiel_id || null, date_debut, date_fin, notes);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.put('/affectations/:id', (req, res, next) => {
  try {
    const { chantier_id, employe_id, materiel_id, date_debut, date_fin, notes } = req.body;
    db.prepare('UPDATE affectations SET chantier_id=?, employe_id=?, materiel_id=?, date_debut=?, date_fin=?, notes=? WHERE id=? AND company_id=?')
      .run(chantier_id, employe_id, materiel_id, date_debut, date_fin, notes, req.params.id, req.user.companyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/affectations/:id', (req, res) => {
  db.prepare('DELETE FROM affectations WHERE id=? AND company_id=?').run(req.params.id, req.user.companyId);
  res.json({ ok: true });
});

// ── AI optimisation ──────────────────────────────────────────
router.post('/optimise', async (req, res, next) => {
  try {
    const { contexte } = req.body;
    const company    = db.prepare('SELECT * FROM companies WHERE id=?').get(req.user.companyId);
    const chantiers  = db.prepare("SELECT * FROM chantiers WHERE company_id=? AND statut IN ('planifié','en_cours')").all(req.user.companyId);
    const employes   = db.prepare('SELECT * FROM employes WHERE company_id=? AND actif=1').all(req.user.companyId);
    const materiels  = db.prepare('SELECT * FROM materiels WHERE company_id=?').all(req.user.companyId);
    const result = await optimiserPlanning({ company, chantiers, employes, materiels, contexte, companyId: req.user.companyId, userId: req.user.userId });
    res.json({ recommandations: result });
  } catch (e) { next(e); }
});

export default router;
