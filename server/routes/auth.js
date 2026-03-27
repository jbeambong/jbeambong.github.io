import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { companyName, email, password, name } = req.body;
    if (!companyName || !email || !password || !name)
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    const hash = await bcrypt.hash(password, 10);
    const company = db.prepare(
      'INSERT INTO companies (name) VALUES (?) RETURNING *'
    ).get(companyName);

    const user = db.prepare(
      'INSERT INTO users (company_id, email, password, name) VALUES (?, ?, ?, ?) RETURNING id, email, name, role, company_id'
    ).get(company.id, email, hash, name);

    const token = jwt.sign(
      { userId: user.id, companyId: company.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { ...user, company } });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id);
    const token = jwt.sign(
      { userId: user.id, companyId: company.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const { password: _, ...safeUser } = user;
    res.json({ token, user: { ...safeUser, company } });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, company_id FROM users WHERE id = ?').get(req.user.userId);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.companyId);
  res.json({ ...user, company });
});

router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, companyName, siret, address, phone } = req.body;
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.userId);
    if (companyName || siret || address || phone) {
      db.prepare('UPDATE companies SET name = COALESCE(?, name), siret = COALESCE(?, siret), address = COALESCE(?, address), phone = COALESCE(?, phone) WHERE id = ?')
        .run(companyName, siret, address, phone, req.user.companyId);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
