import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { genererRappel } from '../agents/facturationAgent.js';

const router = Router();
router.use(requireAuth);

function nextNumero(companyId) {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT numero FROM factures WHERE company_id=? AND numero LIKE ? ORDER BY id DESC LIMIT 1")
    .get(companyId, `FAC-${year}-%`);
  const n = last ? parseInt(last.numero.split('-')[2]) + 1 : 1;
  return `FAC-${year}-${String(n).padStart(3, '0')}`;
}

router.get('/', (req, res) => {
  const { statut } = req.query;
  let q = `SELECT f.*, c.name as client_name FROM factures f LEFT JOIN clients c ON c.id=f.client_id WHERE f.company_id=?`;
  const params = [req.user.companyId];
  if (statut) { q += ' AND f.statut=?'; params.push(statut); }
  q += ' ORDER BY f.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

router.get('/stats', (req, res) => {
  const cid = req.user.companyId;
  const total = db.prepare("SELECT COALESCE(SUM(montant_ttc),0) as v FROM factures WHERE company_id=? AND statut!='annulée'").get(cid).v;
  const paye  = db.prepare("SELECT COALESCE(SUM(montant_paye),0) as v FROM factures WHERE company_id=?").get(cid).v;
  const retard = db.prepare("SELECT COUNT(*) as v FROM factures WHERE company_id=? AND statut='en_retard'").get(cid).v;
  const mois = db.prepare("SELECT COALESCE(SUM(montant_ttc),0) as v FROM factures WHERE company_id=? AND strftime('%Y-%m', date_emission)=strftime('%Y-%m', 'now')").get(cid).v;
  res.json({ total, paye, impaye: total - paye, retard, mois });
});

router.post('/', (req, res, next) => {
  try {
    const { client_id, devis_id, chantier_id, lignes, montant_ht, taux_tva, date_echeance, notes, mode_paiement } = req.body;
    const ttc = (montant_ht || 0) * (1 + (taux_tva || 20) / 100);
    const now = new Date().toISOString().slice(0, 10);
    const row = db.prepare(`INSERT INTO factures (company_id, client_id, devis_id, chantier_id, numero, lignes, montant_ht, taux_tva, montant_ttc, date_emission, date_echeance, notes, mode_paiement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      req.user.companyId, client_id, devis_id || null, chantier_id || null,
      nextNumero(req.user.companyId), JSON.stringify(lignes || []),
      montant_ht || 0, taux_tva || 20, ttc, now, date_echeance, notes, mode_paiement
    );
    res.status(201).json({ ...row, lignes: JSON.parse(row.lignes) });
  } catch (e) { next(e); }
});

router.post('/from-devis/:devisId', (req, res, next) => {
  try {
    const dv = db.prepare('SELECT * FROM devis WHERE id=? AND company_id=?').get(req.params.devisId, req.user.companyId);
    if (!dv) return res.status(404).json({ error: 'Devis introuvable' });
    const echeance = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const now = new Date().toISOString().slice(0, 10);
    const row = db.prepare(`INSERT INTO factures (company_id, client_id, devis_id, numero, lignes, montant_ht, taux_tva, montant_ttc, date_emission, date_echeance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(
      req.user.companyId, dv.client_id, dv.id, nextNumero(req.user.companyId),
      dv.lignes, dv.montant_ht, dv.taux_tva, dv.montant_ttc, now, echeance
    );
    res.status(201).json({ ...row, lignes: JSON.parse(row.lignes) });
  } catch (e) { next(e); }
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT f.*, c.name as client_name, c.email as client_email, c.address as client_address
    FROM factures f LEFT JOIN clients c ON c.id=f.client_id WHERE f.id=? AND f.company_id=?`)
    .get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  const paiements = db.prepare('SELECT * FROM paiements WHERE facture_id=? ORDER BY date_paiement').all(row.id);
  res.json({ ...row, lignes: JSON.parse(row.lignes || '[]'), paiements });
});

router.put('/:id', (req, res, next) => {
  try {
    const { lignes, montant_ht, taux_tva, date_echeance, notes, mode_paiement, client_id } = req.body;
    const ttc = (montant_ht || 0) * (1 + (taux_tva || 20) / 100);
    db.prepare(`UPDATE factures SET client_id=?, lignes=?, montant_ht=?, taux_tva=?, montant_ttc=?, date_echeance=?, notes=?, mode_paiement=?, updated_at=datetime('now')
      WHERE id=? AND company_id=?`).run(client_id, JSON.stringify(lignes || []), montant_ht || 0, taux_tva || 20, ttc, date_echeance, notes, mode_paiement, req.params.id, req.user.companyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/send', (req, res) => {
  db.prepare("UPDATE factures SET statut='envoyée', date_emission=COALESCE(date_emission, date('now')), updated_at=datetime('now') WHERE id=? AND company_id=?")
    .run(req.params.id, req.user.companyId);
  res.json({ ok: true });
});

router.post('/:id/paiement', (req, res, next) => {
  try {
    const { montant, date_paiement, mode, reference, notes } = req.body;
    const fac = db.prepare('SELECT * FROM factures WHERE id=? AND company_id=?').get(req.params.id, req.user.companyId);
    if (!fac) return res.status(404).json({ error: 'Introuvable' });

    db.prepare('INSERT INTO paiements (facture_id, montant, date_paiement, mode, reference, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(fac.id, montant, date_paiement, mode, reference, notes);

    const newPaye = (fac.montant_paye || 0) + montant;
    const statut = newPaye >= fac.montant_ttc ? 'payée' : 'envoyée';
    db.prepare("UPDATE factures SET montant_paye=?, statut=?, date_paiement=CASE WHEN ?='payée' THEN ? ELSE date_paiement END, updated_at=datetime('now') WHERE id=?")
      .run(newPaye, statut, statut, date_paiement, fac.id);
    res.json({ ok: true, statut });
  } catch (e) { next(e); }
});

router.post('/:id/rappel', async (req, res, next) => {
  try {
    const fac = db.prepare(`SELECT f.*, c.name as client_name, c.email as client_email
      FROM factures f LEFT JOIN clients c ON c.id=f.client_id WHERE f.id=? AND f.company_id=?`)
      .get(req.params.id, req.user.companyId);
    if (!fac) return res.status(404).json({ error: 'Introuvable' });
    const company = db.prepare('SELECT * FROM companies WHERE id=?').get(req.user.companyId);
    const rappel = await genererRappel({ facture: fac, company, companyId: req.user.companyId, userId: req.user.userId });
    db.prepare("UPDATE factures SET rappels_envoyes=rappels_envoyes+1 WHERE id=?").run(fac.id);
    res.json({ texte: rappel });
  } catch (e) { next(e); }
});

export default router;
