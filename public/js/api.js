const BASE = '/api';

function getToken() { return localStorage.getItem('token'); }

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  if (res.status === 401) { localStorage.removeItem('token'); location.hash = '#/login'; return; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// SSE streaming helper
export async function stream(path, body, onChunk) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json().catch(() => {}); throw new Error(d?.error || 'Erreur'); }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastData = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const d = JSON.parse(line.slice(6));
          lastData = d;
          onChunk(d);
        } catch {}
      }
    }
  }
  return lastData;
}

export const api = {
  // Auth
  register: d => req('POST', '/auth/register', d),
  login:    d => req('POST', '/auth/login', d),
  me:       ()=> req('GET',  '/auth/me'),
  profile:  d => req('PUT',  '/auth/profile', d),

  // Dashboard
  dashStats:  () => req('GET', '/dashboard/stats'),
  dashAlerts: () => req('GET', '/dashboard/alerts'),

  // Clients
  clients:       ()  => req('GET',    '/clients'),
  client:        id  => req('GET',    `/clients/${id}`),
  createClient:  d   => req('POST',   '/clients', d),
  updateClient:  (id,d)=> req('PUT',  `/clients/${id}`, d),
  deleteClient:  id  => req('DELETE', `/clients/${id}`),

  // Devis
  devis:          p  => req('GET',    '/devis' + (p ? '?' + new URLSearchParams(p) : '')),
  devisOne:       id => req('GET',    `/devis/${id}`),
  createDevis:    d  => req('POST',   '/devis', d),
  updateDevis:    (id,d)=> req('PUT', `/devis/${id}`, d),
  devisStatut:    (id,s)=> req('PUT', `/devis/${id}/statut`, { statut: s }),
  deleteDevis:    id => req('DELETE', `/devis/${id}`),
  generateDevis:  (body, onChunk) => stream('/devis/generate', body, onChunk),

  // Appels d'offres
  aos:        p  => req('GET',    '/appels-offres' + (p ? '?' + new URLSearchParams(p) : '')),
  aoOne:      id => req('GET',    `/appels-offres/${id}`),
  createAO:   d  => req('POST',   '/appels-offres', d),
  updateAO:   (id,d)=> req('PUT', `/appels-offres/${id}`, d),
  deleteAO:   id => req('DELETE', `/appels-offres/${id}`),
  analyseAO:  id => req('POST',   '/appels-offres/analyse', { id }),
  reponseAO:  (id, onChunk) => stream('/appels-offres/reponse', { id }, onChunk),

  // Chantiers
  chantiers:      p  => req('GET',    '/chantiers' + (p ? '?' + new URLSearchParams(p) : '')),
  chantier:       id => req('GET',    `/chantiers/${id}`),
  createChantier: d  => req('POST',   '/chantiers', d),
  updateChantier: (id,d)=> req('PUT', `/chantiers/${id}`, d),
  rapports:       id => req('GET',    `/chantiers/${id}/rapports`),
  createRapport:  (id,d)=> req('POST',`/chantiers/${id}/rapports`, d),
  generateRapport:(id, body, onChunk)=> stream(`/chantiers/${id}/rapports/generate`, body, onChunk),
  updateRapport:  (cid,rid,d)=> req('PUT', `/chantiers/${cid}/rapports/${rid}`, d),

  // Factures
  factures:      p  => req('GET',    '/factures' + (p ? '?' + new URLSearchParams(p) : '')),
  factureOne:    id => req('GET',    `/factures/${id}`),
  factureStats:  ()  => req('GET',   '/factures/stats'),
  createFacture: d  => req('POST',   '/factures', d),
  fromDevis:     id => req('POST',   `/factures/from-devis/${id}`),
  updateFacture: (id,d)=> req('PUT', `/factures/${id}`, d),
  sendFacture:   id => req('POST',   `/factures/${id}/send`),
  paiement:      (id,d)=> req('POST',`/factures/${id}/paiement`, d),
  rappelFacture: id => req('POST',   `/factures/${id}/rappel`),

  // Planning
  employes:          ()  => req('GET',    '/planning/employes'),
  createEmploye:     d   => req('POST',   '/planning/employes', d),
  updateEmploye:     (id,d)=> req('PUT',  `/planning/employes/${id}`, d),
  materiels:         ()  => req('GET',    '/planning/materiels'),
  createMateriel:    d   => req('POST',   '/planning/materiels', d),
  updateMateriel:    (id,d)=> req('PUT',  `/planning/materiels/${id}`, d),
  affectations:      p   => req('GET',    '/planning/affectations' + (p ? '?' + new URLSearchParams(p) : '')),
  createAffectation: d   => req('POST',   '/planning/affectations', d),
  updateAffectation: (id,d)=> req('PUT',  `/planning/affectations/${id}`, d),
  deleteAffectation: id  => req('DELETE', `/planning/affectations/${id}`),
  optimiserPlanning: d   => req('POST',   '/planning/optimise', d),

  // Conformité
  conformite:        p   => req('GET',    '/conformite' + (p ? '?' + new URLSearchParams(p) : '')),
  conformiteOne:     id  => req('GET',    `/conformite/${id}`),
  generateDoc:       (body, onChunk)=> stream('/conformite/generate', body, onChunk),
  updateDoc:         (id,d)=> req('PUT',  `/conformite/${id}`, d),
  finaliserDoc:      id  => req('POST',   `/conformite/${id}/finaliser`),
  deleteDoc:         id  => req('DELETE', `/conformite/${id}`),
};
