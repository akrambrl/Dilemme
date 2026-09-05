/**
 * Commandes click & collect — dépôt public, consultation protégée.
 *
 *   POST /api/commandes              → enregistre une commande (site client)
 *   GET  /api/commandes              → liste les commandes (écran caisse)
 *   POST /api/commandes?action=statut → change le statut d'une commande
 *
 * Pourquoi cette API : le message WhatsApp ne part que si le client appuie
 * sur « Envoyer ». La commande est donc enregistrée ici AVANT la redirection
 * vers WhatsApp, pour que le restaurant la voie même si le client abandonne
 * en route.
 *
 * Le montant est celui calculé par le navigateur du client : il sert
 * d'indication de préparation, pas de source de vérité. Le paiement se fait
 * sur place, à la caisse, qui refait le total.
 *
 * Variables d'environnement (identiques à /api/disponibilites) :
 *   ADMIN_PASSWORD, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *   (KV_REST_API_URL / KV_REST_API_TOKEN acceptés aussi).
 */
const crypto = require('crypto');

const PREFIXE = 'dilemme:commande:';
const INDEX = 'dilemme:commandes';
const GARDE_JOURS = 365;             // durée de conservation d'une commande
const MAX_INDEX = 2000;              // commandes gardées dans l'index
const MAX_PAR_IP = 12;               // dépôts par heure et par adresse
const MAX_ESSAIS = 20;               // tentatives de mot de passe par heure
const MOTIF_REF = /^DIL-\d{4}-\d{4}$/;
const STATUTS = ['nouvelle', 'vue', 'prete', 'annulee'];

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

/** Écriture d'une valeur volumineuse : elle passe par le corps de la requête. */
async function redisSetex(cle, secondes, valeur) {
  const c = config();
  const reponse = await fetch(
    `${c.url}/setex/${encodeURIComponent(cle)}/${secondes}`,
    { method: 'POST', headers: { Authorization: `Bearer ${c.token}` }, body: valeur },
  );
  if (!reponse.ok) throw new Error(`stockage: ${reponse.status}`);
}

/* ----------------------------------------------------------- validation */
const texte = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function montant(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 9999 ? Math.round(n * 100) / 100 : 0;
}

function nettoyerCommande(entree) {
  const lignes = (Array.isArray(entree.items) ? entree.items : []).slice(0, 40).map((it) => ({
    qty: Math.min(Math.max(parseInt(it && it.qty, 10) || 1, 1), 99),
    name: texte(it && it.name, 80),
    total: montant(it && it.total),
    summary: (Array.isArray(it && it.summary) ? it.summary : [])
      .slice(0, 20).map((s) => texte(s, 120)).filter(Boolean),
  })).filter((l) => l.name);

  if (!lignes.length) return null;

  const client = entree.customer || {};
  const retrait = entree.pickup || {};
  const nom = texte(client.name, 60);
  const tel = texte(client.phone, 30);
  if (!nom || !tel) return null;

  return {
    reference: MOTIF_REF.test(entree.reference) ? entree.reference : null,
    creeLe: new Date().toISOString(),
    statut: 'nouvelle',
    whatsapp: false,
    client: {
      nom,
      tel,
      note: texte(client.note, 300),
      paiement: texte(client.payment, 40),
    },
    retrait: {
      jour: texte(retrait.dateLabel, 60),
      heure: texte(retrait.time, 10),
      desQuePossible: retrait.asap === true,
    },
    lignes,
    sousTotal: montant(entree.subtotal),
    remise: montant(entree.discount),
    total: montant(entree.total),
    promo: texte(entree.promo, 30),
  };
}

/* --------------------------------------------------------------- accès */
function motDePasseValide(fourni) {
  const attendu = process.env.ADMIN_PASSWORD;
  if (!attendu || typeof fourni !== 'string') return false;
  const a = crypto.createHash('sha256').update(attendu).digest();
  const b = crypto.createHash('sha256').update(fourni).digest();
  return crypto.timingSafeEqual(a, b);
}

function adresse(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
}

async function compteur(cle, plafond) {
  if (!config()) return false;
  try {
    const n = Number(await redis(['incr', cle]));
    if (n === 1) await redis(['expire', cle, '3600']);
    return n > plafond;
  } catch (err) {
    return false;   // une panne du stockage ne doit pas bloquer un client réel
  }
}

/* Le garde-fou anti-force-brute ne compte QUE les échecs : l'écran de caisse
   s'authentifie à chaque rafraîchissement, il serait sinon bloqué en quelques
   minutes d'utilisation normale. */
async function echecsRecents(cle) {
  try { return Number(await redis(['get', cle])) || 0; } catch (err) { return 0; }
}
async function noterEchec(cle) {
  try {
    const n = Number(await redis(['incr', cle]));
    if (n === 1) await redis(['expire', cle, '3600']);
  } catch (err) { /* sans conséquence */ }
}

function corpsDe(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}

/** Référence de secours, si celle du navigateur est absente ou douteuse. */
function referenceDeSecours() {
  const d = new Date();
  const jour = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0');
  return `DIL-${jour}-${String(crypto.randomInt(1000, 10000))}`;
}

/* ---------------------------------------------------------- opérations */
async function deposer(req, res) {
  if (await compteur(`dilemme:depots:${adresse(req)}`, MAX_PAR_IP)) {
    return res.status(429).json({ erreur: 'Trop de commandes envoyées depuis cet appareil.' });
  }

  const propre = nettoyerCommande(corpsDe(req));
  if (!propre) return res.status(400).json({ erreur: 'Commande incomplète.' });
  propre.reference = propre.reference || referenceDeSecours();

  await redisSetex(PREFIXE + propre.reference, GARDE_JOURS * 86400, JSON.stringify(propre));
  await redis(['lpush', INDEX, propre.reference]);
  await redis(['ltrim', INDEX, '0', String(MAX_INDEX - 1)]);
  return res.status(200).json({ ok: true, reference: propre.reference });
}

/** Le client a bien ouvert WhatsApp : information utile pour la caisse. */
async function marquerWhatsapp(req, res) {
  const { reference } = corpsDe(req);
  if (!MOTIF_REF.test(reference || '')) return res.status(400).json({ erreur: 'Référence invalide.' });
  const brut = await redis(['get', PREFIXE + reference]);
  if (!brut) return res.status(404).json({ erreur: 'Commande introuvable.' });
  const cmd = JSON.parse(brut);
  cmd.whatsapp = true;
  await redisSetex(PREFIXE + reference, GARDE_JOURS * 86400, JSON.stringify(cmd));
  return res.status(200).json({ ok: true });
}

/**
 * `depuis` limite à ce qui est arrivé après cette date (le service du jour) ;
 * `limite` borne la remontée d'historique, qu'on ne charge qu'à la demande.
 * Les commandes sont lues par paquets : un MGET de 2000 clés d'un coup est
 * refusé par le stockage au-delà d'une certaine taille de requête.
 */
async function lister(res, depuis, limite) {
  const refs = (await redis(['lrange', INDEX, '0', String(Math.min(limite, MAX_INDEX) - 1)])) || [];
  if (!refs.length) return res.status(200).json({ commandes: [] });

  const commandes = [];
  for (let i = 0; i < refs.length; i += 100) {
    const paquet = refs.slice(i, i + 100).map((r) => PREFIXE + r);
    const valeurs = (await redis(['mget', ...paquet])) || [];
    valeurs.forEach((v) => {
      try { if (v) commandes.push(JSON.parse(v)); } catch (e) { /* entrée illisible */ }
    });
  }
  return res.status(200).json({
    commandes: depuis ? commandes.filter((c) => c.creeLe >= depuis) : commandes,
  });
}

async function changerStatut(req, res) {
  const { reference, statut } = corpsDe(req);
  if (!MOTIF_REF.test(reference || '') || !STATUTS.includes(statut)) {
    return res.status(400).json({ erreur: 'Requête invalide.' });
  }
  const brut = await redis(['get', PREFIXE + reference]);
  if (!brut) return res.status(404).json({ erreur: 'Commande introuvable.' });
  const cmd = JSON.parse(brut);
  cmd.statut = statut;
  cmd.statutLe = new Date().toISOString();
  if (statut === 'prete' && !cmd.preteLe) cmd.preteLe = cmd.statutLe;
  await redisSetex(PREFIXE + reference, GARDE_JOURS * 86400, JSON.stringify(cmd));
  return res.status(200).json({ ok: true, commande: cmd });
}

/* -------------------------------------------------------------- routeur */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!config()) {
    return res.status(503).json({
      erreur: 'Stockage non configuré : les commandes ne peuvent pas être enregistrées.',
    });
  }

  const action = String((req.query && req.query.action) || '');

  try {
    /* --- dépôt public : aucune authentification, le client n'en a pas --- */
    if (req.method === 'POST' && !action) return await deposer(req, res);
    if (req.method === 'POST' && action === 'whatsapp') return await marquerWhatsapp(req, res);

    /* --- au-delà, tout passe par le mot de passe de la caisse --- */
    if (req.method !== 'GET' && !(req.method === 'POST' && action === 'statut')) {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ erreur: 'Méthode non autorisée.' });
    }

    if (!process.env.ADMIN_PASSWORD) {
      return res.status(503).json({ erreur: 'Mot de passe non configuré sur le serveur.' });
    }
    const cleEssais = `dilemme:essais:${adresse(req)}`;
    if (await echecsRecents(cleEssais) > MAX_ESSAIS) {
      return res.status(429).json({ erreur: 'Trop de tentatives. Réessayez dans une heure.' });
    }
    const entete = req.headers.authorization || '';
    if (!motDePasseValide(entete.replace(/^Bearer\s+/i, ''))) {
      await noterEchec(cleEssais);
      return res.status(401).json({ erreur: 'Mot de passe incorrect.' });
    }

    if (req.method === 'GET') {
      const depuis = typeof req.query.depuis === 'string' ? req.query.depuis.slice(0, 30) : '';
      const demande = parseInt(req.query.limite, 10);
      const limite = Number.isInteger(demande) && demande > 0 ? Math.min(demande, MAX_INDEX) : 300;
      return await lister(res, depuis, limite);
    }
    return await changerStatut(req, res);
  } catch (err) {
    return res.status(500).json({ erreur: 'Opération impossible. Réessayez.' });
  }
};
