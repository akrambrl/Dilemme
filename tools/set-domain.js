#!/usr/bin/env node
/**
 * Change l'adresse du site partout en une commande.
 *
 *   node tools/set-domain.js https://dilemme.vercel.app
 *   node tools/set-domain.js https://www.dilemme-resto.fr --cname
 *
 * Met à jour : les liens canoniques, les balises de partage (Open Graph,
 * Twitter), les données structurées de toutes les pages, sitemap.xml,
 * robots.txt, et l'adresse mémorisée dans tools/build-seo.js — pour que les
 * régénérations suivantes utilisent la nouvelle adresse.
 *
 * L'option --cname écrit le fichier CNAME nécessaire à GitHub Pages avec un
 * domaine personnalisé. À n'utiliser qu'une fois les DNS en place : sinon
 * GitHub Pages tente de servir un domaine qui ne répond pas.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = process.argv[2];
const avecCname = process.argv.includes('--cname');

if (!arg || !/^https?:\/\/[^/\s]+$/.test(arg.replace(/\/$/, ''))) {
  console.error('Usage : node tools/set-domain.js https://mon-site.exemple [--cname]');
  console.error('        (adresse complète, sans barre oblique finale, sans chemin)');
  process.exit(1);
}
const nouveau = arg.replace(/\/$/, '');

/* L'adresse actuelle est celle mémorisée dans build-seo.js */
const seoPath = path.join(ROOT, 'tools/build-seo.js');
const seo = fs.readFileSync(seoPath, 'utf8');
const trouve = seo.match(/const SITE = '([^']+)'/);
if (!trouve) {
  console.error('Adresse actuelle introuvable dans tools/build-seo.js');
  process.exit(1);
}
const ancien = trouve[1];

if (ancien === nouveau) {
  console.log(`Le site utilise déjà ${nouveau} — rien à changer.`);
  process.exit(0);
}

const fichiers = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith('.html'))
  .concat(['sitemap.xml', 'robots.txt']);

let total = 0;
for (const f of fichiers) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const avant = fs.readFileSync(p, 'utf8');
  const apres = avant.split(ancien).join(nouveau);
  if (avant !== apres) {
    fs.writeFileSync(p, apres);
    const n = avant.split(ancien).length - 1;
    total += n;
    console.log(`  ${f.padEnd(24)} ${n} remplacement(s)`);
  }
}

fs.writeFileSync(seoPath, seo.replace(`const SITE = '${ancien}'`, `const SITE = '${nouveau}'`));
console.log(`  ${'tools/build-seo.js'.padEnd(24)} adresse mémorisée`);

/* build-pages.py régénère les pages à chaque appel : sans cette ligne, il
   réécrirait l'ancienne adresse dans les liens canoniques au build suivant,
   et Google se verrait à nouveau désigner l'ancien domaine. */
const pagesPath = path.join(ROOT, 'tools/build-pages.py');
const pages = fs.readFileSync(pagesPath, 'utf8');
if (pages.includes(`SITE = '${ancien}'`)) {
  fs.writeFileSync(pagesPath, pages.replace(`SITE = '${ancien}'`, `SITE = '${nouveau}'`));
  console.log(`  ${'tools/build-pages.py'.padEnd(24)} adresse mémorisée`);
} else if (!pages.includes(`SITE = '${nouveau}'`)) {
  console.warn(`  ATTENTION : adresse non trouvée dans tools/build-pages.py — à corriger à la main.`);
}

const cnamePath = path.join(ROOT, 'CNAME');
if (avecCname) {
  const hote = nouveau.replace(/^https?:\/\//, '');
  fs.writeFileSync(cnamePath, hote + '\n');
  console.log(`  ${'CNAME'.padEnd(24)} ${hote}`);
} else if (fs.existsSync(cnamePath)) {
  console.log('  CNAME présent : à supprimer si vous n’utilisez pas de domaine personnalisé.');
}

console.log(`\n${ancien} → ${nouveau} (${total} occurrences)`);
console.log('Pensez à valider et pousser les modifications pour déclencher un nouveau déploiement.');
