import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM clients WHERE company_id = ? ORDER BY name').all(req.user.companyId);
  res.json(rows);
});

router.post('/', (req, res, next) => {
  try {
    const { name, siret, contact, email, phone, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom obligatoire' });
    const row = db.prepare(
      'INSERT INTO clients (company_id, name, siret, contact, email, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
    ).get(req.user.companyId, name, siret, contact, email, phone, address, notes);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clients WHERE id = ? AND company_id = ?').get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ error: 'Introuvable' });
  const devis    = db.prepare('SELECT id, numero, titre, montant_ttc, statut FROM devis WHERE client_id = ?').all(row.id);
  const factures = db.prepare('SELECT id, numero, montant_ttc, statut, date_echeance FROM factures WHERE client_id = ?').all(row.id);
  res.json({ ...row, devis, factures });
});

router.put('/:id', (req, res, next) => {
  try {
    const { name, siret, contact, email, phone, address, notes } = req.body;
    db.prepare(
      'UPDATE clients SET name=?, siret=?, contact=?, email=?, phone=?, address=?, notes=? WHERE id=? AND company_id=?'
    ).run(name, siret, contact, email, phone, address, notes, req.params.id, req.user.companyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ? AND company_id = ?').run(req.params.id, req.user.companyId);
  res.json({ ok: true });
});

export default router;
