import { runAgent, streamAgent } from './baseAgent.js';

export async function analyseAO({ ao, company, companyId, userId }) {
  const system = `Tu es un expert en marchés publics pour une PME de Travaux Publics.
Entreprise : ${company.name}

Analyse cet appel d'offres et retourne un JSON strict :
\`\`\`json
{
  "score": 0,
  "resume": "Résumé en 2 phrases",
  "points_forts": ["..."],
  "points_attention": ["..."],
  "competences_requises": ["..."],
  "estimation_charge": "X jours/équipe",
  "recommandation": "CANDIDATER|PASSER|ETUDIER",
  "justification": "Pourquoi cette recommandation"
}
\`\`\`
Le score va de 0 (pas du tout pertinent) à 100 (parfaitement adapté).`;

  const user = `Appel d'offres :
Titre : ${ao.titre}
Référence : ${ao.reference || 'N/A'}
Acheteur : ${ao.acheteur || 'N/A'}
Lieu : ${ao.lieu || 'N/A'}
Date limite : ${ao.date_limite || 'N/A'}
Montant estimé : ${ao.montant_estime ? ao.montant_estime.toLocaleString('fr-FR') + ' €' : 'N/A'}
Description : ${ao.description || 'Non fournie'}`;

  return runAgent({ agent: 'appels_offres', system, user, companyId, userId });
}

export async function genererReponseAO({ ao, company, companyId, userId, onChunk }) {
  const system = `Tu es un rédacteur expert en réponses aux marchés publics de Travaux Publics.
Entreprise : ${company.name}${company.siret ? ` — SIRET : ${company.siret}` : ''}${company.address ? ` — ${company.address}` : ''}

Rédige une lettre de motivation et un mémoire technique professionnel pour répondre à cet appel d'offres.
Le document doit être :
- Professionnel et précis
- Adapté aux exigences des marchés publics français
- Structuré avec des sections claires (présentation, références, méthodologie, moyens, qualité/sécurité)
- En Markdown bien formaté`;

  const user = `Appel d'offres à traiter :
Titre : ${ao.titre}
Acheteur : ${ao.acheteur || 'N/A'}
Description : ${ao.description || ''}
Analyse IA disponible : ${ao.ai_analyse || 'Non disponible'}`;

  return streamAgent({ agent: 'appels_offres', system, user, companyId, userId, maxTokens: 4096, onChunk });
}
