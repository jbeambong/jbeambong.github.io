import { runAgent } from './baseAgent.js';

export async function genererRappel({ facture, company, companyId, userId }) {
  const retard = facture.date_echeance
    ? Math.floor((Date.now() - new Date(facture.date_echeance)) / 86400000)
    : 0;

  const niveau = retard <= 0 ? 'amiable' : retard <= 15 ? 'premier_rappel' : retard <= 30 ? 'deuxieme_rappel' : 'mise_en_demeure';

  const system = `Tu es le service comptabilité de l'entreprise ${company.name}, spécialisée en Travaux Publics.
Rédige un email de relance de paiement professionnel en français.
Niveau de relance : ${niveau === 'amiable' ? 'Rappel amiable (avant échéance ou juste après)' :
  niveau === 'premier_rappel' ? 'Premier rappel (retard < 15 jours)' :
  niveau === 'deuxieme_rappel' ? 'Deuxième rappel (retard 15-30 jours, ton plus ferme)' :
  'Mise en demeure (retard > 30 jours, ton formel et légal)'}

L'email doit :
- Être professionnel et courtois mais ferme selon le niveau
- Indiquer clairement la référence, le montant et l'échéance
- Proposer un contact pour résoudre le problème
- Pour la mise en demeure : mentionner les recours possibles`;

  const user = `Facture à relancer :
- Numéro : ${facture.numero}
- Client : ${facture.client_name}
- Email client : ${facture.client_email || 'non renseigné'}
- Montant TTC : ${facture.montant_ttc?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
- Montant déjà payé : ${(facture.montant_paye || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
- Date d'échéance : ${facture.date_echeance}
- Retard : ${retard > 0 ? retard + ' jours' : 'Pas encore échu'}
- Nombre de rappels précédents : ${facture.rappels_envoyes || 0}`;

  return runAgent({ agent: 'facturation', system, user, companyId, userId, maxTokens: 800 });
}
