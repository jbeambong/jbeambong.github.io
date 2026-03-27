import { streamAgent } from './baseAgent.js';

export async function generateDevis({ prompt, company, client, companyId, userId, onChunk }) {
  const system = `Tu es un expert chiffreur pour une entreprise de Travaux Publics française.
Entreprise : ${company.name}${company.siret ? ` (SIRET: ${company.siret})` : ''}

Génère un devis détaillé au format JSON strict :
\`\`\`json
{
  "titre": "Titre du devis",
  "description": "Description générale",
  "lignes": [
    { "description": "...", "quantite": 0, "unite": "m²|ml|u|h|t|m3", "prix_unitaire": 0, "total": 0 }
  ],
  "montant_ht": 0,
  "notes": "Conditions particulières, délais, observations"
}
\`\`\`

Règles :
- Utilise des prix réalistes pour les TP en France (2024-2025)
- Décompose en postes précis : préparation, terrassement, fournitures, pose, finitions, etc.
- Ajoute les postes de sécurité et installation de chantier
- Les unités doivent être cohérentes avec le métier TP
- Sois précis sur les libellés techniques`;

  const user = client
    ? `Client : ${client.name}\n\nDescription des travaux :\n${prompt}`
    : `Description des travaux :\n${prompt}`;

  return streamAgent({ agent: 'devis', system, user, companyId, userId, maxTokens: 3000, onChunk });
}
