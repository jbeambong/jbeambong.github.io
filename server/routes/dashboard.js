import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', (req, res) => {
  const cid = req.user.companyId;
  const chantiers_actifs = db.prepare("SELECT COUNT(*) as v FROM chantiers WHERE company_id=? AND statut='en_cours'").get(cid).v;
  const chantiers_total  = db.prepare("SELECT COUNT(*) as v FROM chantiers WHERE company_id=?").get(cid).v;
  const devis_en_attente = db.prepare("SELECT COUNT(*) as v FROM devis WHERE company_id=? AND statut='envoyé'").get(cid).v;
  const devis_mois       = db.prepare("SELECT COUNT(*) as v FROM devis WHERE company_id=? AND strftime('%Y-%m', created_at)=strftime('%Y-%m', 'now')").get(cid).v;
  const ca_mois          = db.prepare("SELECT COALESCE(SUM(montant_ttc),0) as v FROM factures WHERE company_id=? AND statut='payée' AND strftime('%Y-%m', date_paiement)=strftime('%Y-%m', 'now')").get(cid).v;
  const ca_total         = db.prepare("SELECT COALESCE(SUM(montant_ttc),0) as v FROM factures WHERE company_id=? AND statut='payée'").get(cid).v;
  const factures_retard  = db.prepare("SELECT COUNT(*) as v FROM factures WHERE company_id=? AND statut='en_retard'").get(cid).v;
  const ao_actifs        = db.prepare("SELECT COUNT(*) as v FROM appels_offres WHERE company_id=? AND statut NOT IN ('gagné','perdu')").get(cid).v;
  const docs_brouillon   = db.prepare("SELECT COUNT(*) as v FROM documents_conformite WHERE company_id=? AND statut='brouillon'").get(cid).v;

  const recent_devis     = db.prepare("SELECT d.numero, d.titre, d.montant_ttc, d.statut, c.name as client FROM devis d LEFT JOIN clients c ON c.id=d.client_id WHERE d.company_id=? ORDER BY d.created_at DESC LIMIT 5").all(cid);
  const recent_factures  = db.prepare("SELECT f.numero, f.montant_ttc, f.statut, f.date_echeance, c.name as client FROM factures f LEFT JOIN clients c ON c.id=f.client_id WHERE f.company_id=? ORDER BY f.created_at DESC LIMIT 5").all(cid);

  res.json({
    chantiers_actifs, chantiers_total, devis_en_attente, devis_mois,
    ca_mois, ca_total, factures_retard, ao_actifs, docs_brouillon,
    recent_devis, recent_factures,
  });
});

router.get('/alerts', (req, res) => {
  const cid = req.user.companyId;
  const alerts = [];

  // Factures en retard
  const retard = db.prepare(`SELECT f.numero, f.montant_ttc, f.date_echeance, c.name as client
    FROM factures f LEFT JOIN clients c ON c.id=f.client_id
    WHERE f.company_id=? AND f.statut='envoyée' AND f.date_echeance < date('now')`).all(cid);
  retard.forEach(f => alerts.push({ type: 'retard', message: `Facture ${f.numero} en retard — ${f.client}`, montant: f.montant_ttc, lien: '#/factures' }));

  // AO avec délai < 7j
  const aoUrgent = db.prepare(`SELECT titre, date_limite FROM appels_offres
    WHERE company_id=? AND statut NOT IN ('gagné','perdu','candidature') AND date_limite BETWEEN date('now') AND date('now', '+7 days')`).all(cid);
  aoUrgent.forEach(a => alerts.push({ type: 'urgent', message: `AO "${a.titre}" — délai le ${a.date_limite}`, lien: '#/appels-offres' }));

  // Chantiers sans rapport depuis 3j
  const sansRapport = db.prepare(`SELECT c.nom FROM chantiers c WHERE c.company_id=? AND c.statut='en_cours'
    AND NOT EXISTS (SELECT 1 FROM rapports_chantier r WHERE r.chantier_id=c.id AND r.date_rapport >= date('now', '-3 days'))`).all(cid);
  sansRapport.forEach(c => alerts.push({ type: 'info', message: `Chantier "${c.nom}" sans rapport depuis 3 jours`, lien: '#/chantiers' }));

  // Devis proches expiration
  const expirant = db.prepare(`SELECT d.numero, d.date_validite, c.name as client FROM devis d LEFT JOIN clients c ON c.id=d.client_id
    WHERE d.company_id=? AND d.statut='envoyé' AND d.date_validite BETWEEN date('now') AND date('now', '+5 days')`).all(cid);
  expirant.forEach(d => alerts.push({ type: 'warning', message: `Devis ${d.numero} expire le ${d.date_validite} — ${d.client}`, lien: '#/devis' }));

  res.json(alerts);
});

export default router;
