import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import authRouter       from './routes/auth.js';
import clientsRouter    from './routes/clients.js';
import devisRouter      from './routes/devis.js';
import aoRouter         from './routes/appelsOffres.js';
import chantiersRouter  from './routes/chantiers.js';
import facturesRouter   from './routes/factures.js';
import planningRouter   from './routes/planning.js';
import conformiteRouter from './routes/conformite.js';
import dashboardRouter  from './routes/dashboard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

app.use('/api/auth',         authRouter);
app.use('/api/clients',      clientsRouter);
app.use('/api/devis',        devisRouter);
app.use('/api/appels-offres', aoRouter);
app.use('/api/chantiers',    chantiersRouter);
app.use('/api/factures',     facturesRouter);
app.use('/api/planning',     planningRouter);
app.use('/api/conformite',   conformiteRouter);
app.use('/api/dashboard',    dashboardRouter);

// Serve SPA for app routes
app.get('/app', (_, res) => res.sendFile(join(__dirname, '..', 'app.html')));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Boostr démarré sur http://localhost:${PORT}`));
