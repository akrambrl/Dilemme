/**
 * Disponibilités des produits — lecture publique, écriture protégée.
 *
 *   GET  /api/disponibilites   → ce qui est épuisé en ce moment (public)
 *   POST /api/disponibilites   → enregistre les ruptures (page admin)
 *
 * Stockage : une base clé-valeur Redis (Upstash), branchée sur le projet
 * Vercel. Tant qu'elle n'est pas configurée, l'API répond quand même en
 * lisant le fichier disponibilites.json du dépôt : le site continue de
 * fonctionner, seule l'écriture est indisponible.
 *
 * Variables d'environnement attendues (voir README, section « page admin ») :
 *   ADMIN_PASSWORD                       mot de passe de la page admin
 *   KV_REST_API_URL / KV_REST_API_TOKEN  (ou UPSTASH_REDIS_REST_URL / _TOKEN)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CLE = 'dilemme:disponibilites';
const MAX_ESSAIS = 20;          // tentatives de mot de passe par heure et par IP
const MOTIF_ID = /^[a-z0-9-]{1,60}$/;

/* ------------------------------------------------------------- stockage */
function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(commande) {
  const c = config();
  if (!c) return null;
  const reponse = await fetch(`${c.url}/${commande.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${c.token}` },
    cache: 'no-store',
  });
  if (!reponse.ok) throw new Error(`stockage: ${reponse.status}`);
  return (await reponse.json()).result;
}

async function redisSet(cle, valeur) {
  const c = config();
  const reponse = await fetch(`${c.url}/set/${encodeURIComponent(cle)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}` },
    body: valeur,
  });
  if (!reponse.ok) throw new Error(`stockage: ${reponse.status}`);
}

/** Valeurs de repli : le fichier versionné dans le dépôt. */
function depuisFichier() {
  try {
    const brut = fs.readFileSync(path.join(process.cwd(), 'disponibilites.json'), 'utf8');
    const data = JSON.parse(brut);
    return {
      produitsIndisponibles: data.produitsIndisponibles || [],
      optionsIndisponibles: data.optionsIndisponibles || [],
      message: data.message || '',
      misAJour: data.misAJour || null,
    };
  } catch (err) {
    return { produitsIndisponibles: [], optionsIndisponibles: [], message: '', misAJour: null };
  }
}

/* ----------------------------------------------------------- validation */
function nettoyer(entree) {
  const liste = (v) => (Array.isArray(v) ? v : [])
    .filter((x) => typeof x === 'string' && MOTIF_ID.test(x))
    .slice(0, 300);
  return {
    produitsIndisponibles: liste(entree.produitsIndisponibles),
    optionsIndisponibles: liste(entree.optionsIndisponibles),
    message: typeof entree.message === 'string' ? entree.message.trim().slice(0, 200) : '',
    misAJour: new Date().toISOString(),
  };
}

/* --------------------------------------------------------------- accès */
function motDePasseValide(fourni) {
  const attendu = process.env.ADMIN_PASSWORD;
  if (!attendu || typeof fourni !== 'string') return false;
  /* comparaison à durée constante, sur des empreintes de même longueur */
  const a = crypto.createHash('sha256').update(attendu).digest();
  const b = crypto.createHash('sha256').update(fourni).digest();
  return crypto.timingSafeEqual(a, b);
}

async function tropDEssais(ip) {
  if (!config()) return false;
  try {
    const cle = `dilemme:essais:${ip}`;
    const n = Number(await redis(['incr', cle]));
    if (n === 1) await redis(['expire', cle, '3600']);
    return n > MAX_ESSAIS;
  } catch (err) {
    return false;   // le stockage ne doit pas bloquer l'accès légitime
  }
}

/* -------------------------------------------------------------- routeur */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const brut = config() ? await redis(['get', CLE]) : null;
      const data = brut ? JSON.parse(brut) : depuisFichier();
      return res.status(200).json({ ...data, stockage: config() ? 'base' : 'fichier' });
    } catch (err) {
      /* en cas de panne du stockage, on sert le fichier plutôt que rien */
      return res.status(200).json({ ...depuisFichier(), stockage: 'fichier' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ erreur: 'Méthode non autorisée.' });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(503).json({
      erreur: 'Mot de passe administrateur non configuré sur le serveur (ADMIN_PASSWORD).',
    });
  }
  if (!config()) {
    return res.status(503).json({
      erreur: 'Stockage non configuré : les modifications ne peuvent pas être enregistrées.',
    });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
  if (await tropDEssais(ip)) {
    return res.status(429).json({ erreur: 'Trop de tentatives. Réessayez dans une heure.' });
  }

  const entete = req.headers.authorization || '';
  if (!motDePasseValide(entete.replace(/^Bearer\s+/i, ''))) {
    return res.status(401).json({ erreur: 'Mot de passe incorrect.' });
  }

  try {
    const corps = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const propre = nettoyer(corps);
    await redisSet(CLE, JSON.stringify(propre));
    return res.status(200).json({ ...propre, stockage: 'base' });
  } catch (err) {
    return res.status(500).json({ erreur: 'Enregistrement impossible. Réessayez.' });
  }
};
