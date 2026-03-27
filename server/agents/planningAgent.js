import { runAgent } from './baseAgent.js';

export async function optimiserPlanning({ company, chantiers, employes, materiels, contexte, companyId, userId }) {
  const system = `Tu es un planificateur expert pour une PME de Travaux Publics.
Analyse les ressources disponibles et les chantiers en cours/planifiés, puis fournis des recommandations d'optimisation du planning.

Donne des recommandations concrètes, actionnables et réalistes en tenant compte :
- Des qualifications des employés vs besoins des chantiers
- Des conflits de ressources potentiels
- Des délais contractuels
- De l'optimisation des coûts (engins, déplacements)`;

  const user = `Entreprise : ${company.name}

Chantiers actifs/planifiés :
${chantiers.map(c => `- ${c.nom} (${c.statut}) : ${c.date_debut} → ${c.date_fin_prev || '?'} — Budget : ${c.budget ? c.budget.toLocaleString('fr-FR') + '€' : 'N/A'}`).join('\n') || 'Aucun chantier'}

Équipe disponible :
${employes.map(e => `- ${e.prenom} ${e.nom} — ${e.poste || 'N/A'} (${e.qualification || 'Sans qualification spécifiée'})`).join('\n') || 'Aucun employé'}

Matériel :
${materiels.map(m => `- ${m.nom} (${m.type || 'N/A'}) — ${m.disponible ? 'Disponible' : 'En utilisation'}`).join('\n') || 'Aucun matériel'}

Contexte / question spécifique :
${contexte || 'Optimisation générale du planning pour les prochaines semaines'}`;

  return runAgent({ agent: 'planning', system, user, companyId, userId, maxTokens: 1500 });
}
