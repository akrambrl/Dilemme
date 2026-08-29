#!/usr/bin/env node
/**
 * Génère les éléments de référencement à partir de la seule source de vérité
 * du site : assets/js/data.js.
 *
 *   node tools/build-seo.js
 *
 * Produit :
 *   · sitemap.xml            — plan du site, avec date de dernière modification
 *   · robots.txt             — accès des moteurs + adresse du plan du site
 *   · les données structurées du menu (schema.org/Menu), injectées dans
 *     carte.html entre les balises <!-- SEO:MENU-JSONLD --> … <!-- /… -->
 *
 * À relancer après chaque modification de la carte ou du domaine.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://dilemme-seven.vercel.app';   // domaine du site, sans barre finale

/* ------- 1. Lecture des données du site (data.js est du JavaScript simple) */
const source = fs.readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  source + '\n;globalThis.__data = { PRODUCTS, CATEGORIES, RESTAURANT, ORDERING };',
  sandbox
);
const { PRODUCTS, CATEGORIES, RESTAURANT } = sandbox.__data;

/* ---------------------------------- 2. Données structurées de la carte */
const dietOf = (product) =>
  (product.tags || []).includes('végé') ? 'https://schema.org/VegetarianDiet' : undefined;

const menu = {
  '@context': 'https://schema.org',
  '@type': 'Menu',
  '@id': `${SITE}/carte.html#menu`,
  name: 'Carte Dilemme — sandwichs et panuozzo',
  inLanguage: 'fr-FR',
  url: `${SITE}/carte.html`,
  hasMenuSection: CATEGORIES.map((cat) => ({
    '@type': 'MenuSection',
    name: cat.label,
    ...(cat.note ? { description: cat.note } : {}),
    hasMenuItem: PRODUCTS.filter((p) => p.category === cat.id).map((p) => ({
      '@type': 'MenuItem',
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
      ...(p.image ? { image: `${SITE}/assets/img/${p.image}.jpg` } : {}),
      ...(dietOf(p) ? { suitableForDiet: dietOf(p) } : {}),
      offers: {
        '@type': 'Offer',
        price: p.price.toFixed(2),
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
      },
    })),
  })).filter((section) => section.hasMenuItem.length),
};

const cartePath = path.join(ROOT, 'carte.html');
let carte = fs.readFileSync(cartePath, 'utf8');
const bloc = `<!-- SEO:MENU-JSONLD -->\n<script type="application/ld+json">${JSON.stringify(menu)}</script>\n<!-- /SEO:MENU-JSONLD -->`;
carte = carte.replace(/<!-- SEO:MENU-JSONLD -->[\s\S]*?<!-- \/SEO:MENU-JSONLD -->/, bloc);
fs.writeFileSync(cartePath, carte);

const nbItems = menu.hasMenuSection.reduce((n, s) => n + s.hasMenuItem.length, 0);
console.log(`carte.html   → menu structuré : ${menu.hasMenuSection.length} sections, ${nbItems} produits`);

/* ------------------------------------------------------- 3. sitemap.xml */
const today = new Date().toISOString().slice(0, 10);
const pages = [
  ['', '1.0', 'weekly'],
  ['carte.html', '0.9', 'weekly'],
  ['infos.html', '0.7', 'monthly'],
  ['commande.html', '0.5', 'monthly'],
  ['mentions-legales.html', '0.2', 'yearly'],
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([p, prio, freq]) => `  <url>
    <loc>${SITE}/${p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log(`sitemap.xml  → ${pages.length} pages (${today})`);

/* --------------------------------------------------------- 4. robots.txt */
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `# Dilemme — ${RESTAURANT.address}
User-agent: *
Allow: /
Disallow: /confirmation.html
Disallow: /admin.html
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`);
console.log('robots.txt   → écrit');
