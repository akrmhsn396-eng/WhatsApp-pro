import express from 'express';
import dotenv from 'dotenv';
import { createAuthRouter } from './auth.ts';

dotenv.config();

export function createStandaloneAuthServerApp() {
  const authApp = express();
  authApp.use(express.json({ limit: '4mb' }));

  // Allow CORS if accessed independently by external clients
  authApp.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  authApp.use(
    '/api/auth',
    createAuthRouter({
      onSessionRevoked: () => {},
      onUserRegistered: () => {},
      onUserUpdated: () => {},
      onContactsMatched: () => {},
    })
  );

  authApp.get('/', (_req, res) => {
    res.redirect('/api/auth/health');
  });

  return authApp;
}

const isDirectEntry =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes('standaloneAuth');

if (isDirectEntry) {
  const port = Number(process.env.AUTH_SERVER_PORT) || 4000;
  const authApp = createStandaloneAuthServerApp();
  authApp.listen(port, '0.0.0.0', () => {
    console.log(`Standalone Phone Auth Server + SQLite DB running on http://localhost:${port}`);
  });
}
