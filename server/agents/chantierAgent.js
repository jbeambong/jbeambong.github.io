import { streamAgent } from './baseAgent.js';

export async function genererRapport({ chantier, brief, companyId, userId, onChunk }) {
  const system = `Tu es un chef de chantier expérimenté dans les Travaux Publics.
Génère un rapport journalier de chantier complet au format JSON strict :
\`\`\`json
{
  "meteo": "Ensoleillé|Nuageux|Pluvieux|Orageux|Vent",
  "effectif": 0,
  "travaux_realises": "Description détaillée des travaux de la journée",
  "incidents": "Incidents ou vide si aucun",
  "materiel": "Matériel utilisé",
  "observations": "Points d'attention, avancement vs planning, prochaines étapes"
}
\`\`\`
Utilise un vocabulaire technique TP précis. Sois concret et factuel.`;

  const user = `Chantier : ${chantier.nom}
Adresse : ${chantier.adresse || 'N/A'}
Date début : ${chantier.date_debut || 'N/A'}
Statut : ${chantier.statut}

Brief journalier fourni par le chef de chantier :
${brief || 'Journée type de chantier TP, travaux en cours selon planning.'}`;

  return streamAgent({ agent: 'chantier', system, user, companyId, userId, maxTokens: 1500, onChunk });
}
