import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'boostr.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    siret      TEXT,
    address    TEXT,
    phone      TEXT,
    email      TEXT,
    plan       TEXT DEFAULT 'trial',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    name       TEXT NOT NULL,
    role       TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id         INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name       TEXT NOT NULL,
    siret      TEXT,
    contact    TEXT,
    email      TEXT,
    phone      TEXT,
    address    TEXT,
    notes      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devis (
    id             INTEGER PRIMARY KEY,
    company_id     INTEGER NOT NULL REFERENCES companies(id),
    client_id      INTEGER REFERENCES clients(id),
    numero         TEXT NOT NULL,
    titre          TEXT NOT NULL,
    description    TEXT,
    ai_prompt      TEXT,
    lignes         TEXT DEFAULT '[]',
    montant_ht     REAL DEFAULT 0,
    taux_tva       REAL DEFAULT 20,
    montant_ttc    REAL DEFAULT 0,
    statut         TEXT DEFAULT 'brouillon',
    validite_jours INTEGER DEFAULT 30,
    date_emission  TEXT,
    date_validite  TEXT,
    notes          TEXT,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appels_offres (
    id               INTEGER PRIMARY KEY,
    company_id       INTEGER NOT NULL REFERENCES companies(id),
    titre            TEXT NOT NULL,
    reference        TEXT,
    acheteur         TEXT,
    date_limite      TEXT,
    montant_estime   REAL,
    lieu             TEXT,
    description      TEXT,
    source_url       TEXT,
    statut           TEXT DEFAULT 'nouveau',
    ai_analyse       TEXT,
    ai_reponse       TEXT,
    score_pertinence INTEGER,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chantiers (
    id            INTEGER PRIMARY KEY,
    company_id    INTEGER NOT NULL REFERENCES companies(id),
    client_id     INTEGER REFERENCES clients(id),
    devis_id      INTEGER REFERENCES devis(id),
    nom           TEXT NOT NULL,
    adresse       TEXT,
    date_debut    TEXT,
    date_fin_prev TEXT,
    date_fin_reel TEXT,
    statut        TEXT DEFAULT 'planifié',
    budget        REAL,
    depenses      REAL DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rapports_chantier (
    id               INTEGER PRIMARY KEY,
    chantier_id      INTEGER NOT NULL REFERENCES chantiers(id),
    date_rapport     TEXT NOT NULL,
    meteo            TEXT,
    effectif         INTEGER DEFAULT 0,
    travaux_realises TEXT,
    incidents        TEXT,
    materiel         TEXT,
    observations     TEXT,
    ai_summary       TEXT,
    created_by       INTEGER REFERENCES users(id),
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS factures (
    id              INTEGER PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    client_id       INTEGER REFERENCES clients(id),
    devis_id        INTEGER REFERENCES devis(id),
    chantier_id     INTEGER REFERENCES chantiers(id),
    numero          TEXT NOT NULL,
    lignes          TEXT DEFAULT '[]',
    montant_ht      REAL DEFAULT 0,
    taux_tva        REAL DEFAULT 20,
    montant_ttc     REAL DEFAULT 0,
    montant_paye    REAL DEFAULT 0,
    statut          TEXT DEFAULT 'brouillon',
    date_emission   TEXT,
    date_echeance   TEXT,
    date_paiement   TEXT,
    mode_paiement   TEXT,
    notes           TEXT,
    rappels_envoyes INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS paiements (
    id            INTEGER PRIMARY KEY,
    facture_id    INTEGER NOT NULL REFERENCES factures(id),
    montant       REAL NOT NULL,
    date_paiement TEXT NOT NULL,
    mode          TEXT,
    reference     TEXT,
    notes         TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employes (
    id               INTEGER PRIMARY KEY,
    company_id       INTEGER NOT NULL REFERENCES companies(id),
    nom              TEXT NOT NULL,
    prenom           TEXT NOT NULL,
    poste            TEXT,
    qualification    TEXT,
    telephone        TEXT,
    email            TEXT,
    taux_journalier  REAL,
    actif            INTEGER DEFAULT 1,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS materiels (
    id               INTEGER PRIMARY KEY,
    company_id       INTEGER NOT NULL REFERENCES companies(id),
    nom              TEXT NOT NULL,
    type             TEXT,
    immatriculation  TEXT,
    disponible       INTEGER DEFAULT 1,
    cout_journalier  REAL,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS affectations (
    id          INTEGER PRIMARY KEY,
    company_id  INTEGER NOT NULL REFERENCES companies(id),
    chantier_id INTEGER REFERENCES chantiers(id),
    employe_id  INTEGER REFERENCES employes(id),
    materiel_id INTEGER REFERENCES materiels(id),
    date_debut  TEXT NOT NULL,
    date_fin    TEXT NOT NULL,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents_conformite (
    id          INTEGER PRIMARY KEY,
    company_id  INTEGER NOT NULL REFERENCES companies(id),
    chantier_id INTEGER REFERENCES chantiers(id),
    type        TEXT NOT NULL,
    titre       TEXT NOT NULL,
    contenu     TEXT,
    statut      TEXT DEFAULT 'brouillon',
    ai_prompt   TEXT,
    version     INTEGER DEFAULT 1,
    created_by  INTEGER REFERENCES users(id),
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_logs (
    id          INTEGER PRIMARY KEY,
    company_id  INTEGER NOT NULL,
    user_id     INTEGER,
    agent       TEXT NOT NULL,
    prompt      TEXT,
    response    TEXT,
    tokens_in   INTEGER,
    tokens_out  INTEGER,
    duration_ms INTEGER,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL,
    user_id    INTEGER,
    type       TEXT NOT NULL,
    message    TEXT NOT NULL,
    lien       TEXT,
    lu         INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export default db;
