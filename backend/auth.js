// backend/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from './models/user.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'replace_with_strong_secret';

// rate-limit to slow down brute-force
const limiter = rateLimit({ windowMs: 15*60e3, max: 50 });
router.use(limiter);

// Sign-up
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await User.create({ username, passwordHash });
    res.sendStatus(201);
  } catch (e) {
    res.status(400).json({ error: 'Username taken' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { sub: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token });
});

export default router;
