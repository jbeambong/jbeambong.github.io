import { streamAgent } from './baseAgent.js';

const TEMPLATES = {
  PPSPS: `Plan Particulier de Sécurité et de Protection de la Santé (PPSPS)
Inclure : identification des parties, description des travaux, analyse des risques, mesures de prévention,
organisation des secours, coordination avec autres entreprises, formations requises, EPI obligatoires,
gestion des déchets, plan d'installation de chantier.`,

  DICT: `Déclaration d'Intention de Commencement de Travaux (DICT)
Inclure : identification du déclarant, nature et localisation des travaux, référence des réseaux concernés,
calendrier prévisionnel, mesures de sécurité prévues pour les réseaux souterrains/aériens.`,

  DOE: `Dossier des Ouvrages Exécutés (DOE)
Inclure : plans de récolement, fiches techniques des matériaux et équipements posés, certificats de conformité,
procès-verbaux d'essais, fiches de maintenance, liste des fournisseurs et sous-traitants.`,

  PV_RECEPTION: `Procès-Verbal de Réception des Travaux
Inclure : identification des parties, référence du marché, description des travaux réceptionnés,
date de visite de réception, liste des réserves éventuelles, délai de levée des réserves,
date d'effet de la réception, signatures.`,

  CERFA: `Formulaire CERFA / Déclaration administrative
Inclure : identification complète de l'entreprise et du maître d'ouvrage, références du chantier,
nature et description précise des travaux, localisation cadastrale, dates prévisionnelles.`,
};

export async function genererDocument({ type, company, chantier, infos, companyId, userId, onChunk }) {
  const template = TEMPLATES[type] || `Document de conformité type ${type}`;

  const system = `Tu es un expert en conformité réglementaire pour les Travaux Publics français.
Génère un document ${type} complet, professionnel et conforme à la réglementation française en vigueur.

Structure requise pour ce document :
${template}

Format : Markdown structuré avec titres, sous-titres et tableaux si nécessaire.
Langue : Français professionnel et technique.
Remplis tous les champs avec les informations fournies ou des mentions "À COMPLÉTER" si information manquante.`;

  const user = `Entreprise : ${company.name}
SIRET : ${company.siret || 'À compléter'}
Adresse : ${company.address || 'À compléter'}
Téléphone : ${company.phone || 'À compléter'}
Email : ${company.email || 'À compléter'}

${chantier ? `Chantier : ${chantier.nom}
Adresse chantier : ${chantier.adresse || 'À compléter'}
Date début : ${chantier.date_debut || 'À compléter'}
Date fin prévue : ${chantier.date_fin_prev || 'À compléter'}` : 'Chantier : À renseigner'}

Informations complémentaires :
${infos ? JSON.stringify(infos, null, 2) : 'Aucune information complémentaire fournie.'}

Génère le document ${type} complet.`;

  return streamAgent({ agent: 'conformite', system, user, companyId, userId, maxTokens: 4096, onChunk });
}
