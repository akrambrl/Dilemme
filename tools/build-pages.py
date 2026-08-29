# -*- coding: utf-8 -*-
"""Génère les pages HTML du site. À relancer après toute modification :
    python3 tools/build-pages.py && node tools/build-seo.js
"""
"""Génère les pages HTML du site Dilemme (en-tête, pied de page et
balisage SEO partagés, pour garder les pages cohérentes)."""
import os, json

SITE = 'https://dilemme-seven.vercel.app'   # adresse en ligne (voir tools/set-domain.js)
NAME = 'Dilemme'
FULL = 'Dilemme — Sandwichs &amp; Panuozzo'
ADDR = '4 Pl. Joséphine Piquet, 94350 Villiers-sur-Marne'
TEL = '06 29 98 60 50'
TELLINK = '+33629986050'
MAPS = 'https://www.google.com/maps/search/?api=1&amp;query=4+Place+Jos%C3%A9phine+Piquet+94350+Villiers-sur-Marne'

# ------------------------------------------------------------------ SEO/JSON-LD
RESTAURANT_LD = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": SITE + "/#restaurant",
    "name": "Dilemme",
    "alternateName": "Dilemme Sandwichs & Panuozzo",
    "description": ("Sandwicherie italienne à Villiers-sur-Marne spécialisée dans le panuozzo, "
                    "le sandwich napolitain au pain à pizza cuit au four. Sandwichs chauds servis "
                    "avec frites et boisson, panuozzos froids à la charcuterie italienne, salades "
                    "et snacks. Commande en ligne et retrait sur place (click and collect)."),
    "url": SITE + "/",
    "telephone": "+33 6 29 98 60 50",
    "image": [SITE + "/assets/img/og-image.jpg", SITE + "/assets/img/hero-01.jpg"],
    "logo": SITE + "/assets/img/logo.png",
    "priceRange": "€€",
    "currenciesAccepted": "EUR",
    "servesCuisine": ["Italienne", "Sandwicherie", "Street food"],
    "hasMenu": SITE + "/carte.html",
    "acceptsReservations": "False",
    "address": {
        "@type": "PostalAddress",
        "streetAddress": "4 Place Joséphine Piquet",
        "postalCode": "94350",
        "addressLocality": "Villiers-sur-Marne",
        "addressRegion": "Île-de-France",
        "addressCountry": "FR",
    },
    "areaServed": [
        {"@type": "City", "name": "Villiers-sur-Marne"},
        {"@type": "City", "name": "Champigny-sur-Marne"},
        {"@type": "City", "name": "Bry-sur-Marne"},
        {"@type": "City", "name": "Le Plessis-Trévise"},
        {"@type": "City", "name": "Chennevières-sur-Marne"},
    ],
    "hasMap": ("https://www.google.com/maps/search/?api=1&query="
               "4+Place+Jos%C3%A9phine+Piquet+94350+Villiers-sur-Marne"),
    "openingHoursSpecification": [
        {"@type": "OpeningHoursSpecification",
         "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Saturday", "Sunday"],
         "opens": "12:00", "closes": "23:00"},
        {"@type": "OpeningHoursSpecification", "dayOfWeek": "Friday",
         "opens": "14:30", "closes": "23:00"},
        {"@type": "OpeningHoursSpecification", "dayOfWeek": "Monday",
         "opens": "00:00", "closes": "00:00"},
    ],
    "potentialAction": {
        "@type": "OrderAction",
        "target": {
            "@type": "EntryPoint",
            "urlTemplate": SITE + "/commande.html",
            "inLanguage": "fr-FR",
            "actionPlatform": ["http://schema.org/DesktopWebPlatform",
                               "http://schema.org/MobileWebPlatform"],
        },
        "deliveryMethod": "http://purl.org/goodrelations/v1#PickUp",
    },
}

WEBSITE_LD = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE + "/#website",
    "url": SITE + "/",
    "name": FULL.replace('&amp;', '&'),
    "inLanguage": "fr-FR",
    "publisher": {"@id": SITE + "/#restaurant"},
    "potentialAction": {
        "@type": "SearchAction",
        "target": {"@type": "EntryPoint", "urlTemplate": SITE + "/carte.html?q={search_term_string}"},
        "query-input": "required name=search_term_string",
    },
}

FAQ = [
    ("Comment fonctionne le click and collect chez Dilemme ?",
     "Vous composez votre commande en ligne, vous choisissez votre créneau de retrait, puis vous "
     "venez récupérer votre commande au 4 Place Joséphine Piquet à Villiers-sur-Marne. Tout est "
     "préparé à la commande : comptez environ 20 minutes de préparation."),
    ("Quels sont les horaires d’ouverture de Dilemme à Villiers-sur-Marne ?",
     "Du mardi au jeudi de 12h à 23h, le vendredi de 14h30 à 23h, le samedi et le dimanche de 12h "
     "à 23h. Le restaurant est fermé le lundi."),
    ("Qu’est-ce qu’un panuozzo ?",
     "Le panuozzo est un sandwich né dans la région de Naples : une pâte à pizza cuite au four, "
     "ouverte en deux et garnie. Le pain est à la fois moelleux à l’intérieur et croustillant "
     "à l’extérieur, ce qui change complètement d’un sandwich classique."),
    ("Peut-on composer son propre sandwich ?",
     "Oui, avec Le Composé : vous choisissez une sauce, un fromage, jusqu’à quatre légumes et "
     "jusqu’à deux viandes parmi la sélection italienne (jambon de dinde, mortadelle pistache, "
     "pastrami, bresaola, Black Angus…)."),
    ("Les viandes sont-elles halal ?",
     "Oui. Toutes les viandes servies chez Dilemme sont halal, aussi bien dans les "
     "sandwichs chauds que dans les panuozzos froids et les snacks."),
    ("Y a-t-il des options végétariennes ?",
     "Oui : la salade de tomates mozzarella, la burrata, la salade de chèvre chaud, et Le Composé "
     "que vous pouvez garnir uniquement de fromages et de légumes."),
    ("Les sandwichs chauds sont-ils servis en menu ?",
     "Tous les sandwichs chauds sont servis avec des frites maison et une boisson, le prix "
     "affiché comprend la formule complète."),
]
FAQ_LD = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {"@type": "Question", "name": q,
         "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ
    ],
}

def ld(*objs):
    return '\n'.join(
        '<script type="application/ld+json">%s</script>' % json.dumps(o, ensure_ascii=False, indent=None)
        for o in objs)

def breadcrumb(label, path):
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": label, "item": f"{SITE}/{path}"},
        ],
    }

# ------------------------------------------------------------------- gabarits
HEAD = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<meta name="description" content="__DESC__">
<link rel="canonical" href="__CANON__">
<meta name="robots" content="__ROBOTS__">
<meta name="theme-color" content="#333D20">
<meta name="geo.region" content="FR-IDF">
<meta name="geo.placename" content="Villiers-sur-Marne">
<meta name="ICBM" content="48.8265, 2.5474">

<!-- Partage sur les réseaux et messageries -->
<meta property="og:type" content="__OGTYPE__">
<meta property="og:site_name" content="Dilemme — Sandwichs &amp; Panuozzo">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="__TITLE__">
<meta property="og:description" content="__DESC__">
<meta property="og:url" content="__CANON__">
<meta property="og:image" content="__SITE__/assets/img/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Assortiment de panuozzos et sandwichs italiens Dilemme">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="__TITLE__">
<meta name="twitter:description" content="__DESC__">
<meta name="twitter:image" content="__SITE__/assets/img/og-image.jpg">

<link rel="icon" href="assets/img/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">

<link rel="preload" href="assets/fonts/playfair-display-600-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/jost-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/styles.css">
__EXTRA__
<script src="assets/js/data.js" defer></script>
<script src="assets/js/app.js" defer></script>
__JSONLD__
</head>
<body data-page="__PAGE__">
<a class="visually-hidden" href="#main">Aller au contenu principal</a>
"""

def header(active):
    def cls(page):
        return ' aria-current="page"' if page == active else ''
    return f"""
<header class="header">
  <div class="wrap header__inner">
    <a class="logo" href="index.html" aria-label="Dilemme, sandwichs et panuozzo, retour à l’accueil">
      <span class="logo__mark"><img src="assets/img/logo.png" alt="Logo Dilemme" width="46" height="46"></span>
      <span class="logo__text">
        <span class="logo__name">Dilemme</span>
        <span class="logo__sub">Sandwichs &amp; Panuozzo</span>
      </span>
    </a>

    <nav class="nav" aria-label="Navigation principale">
      <a href="index.html"{cls('index')}>Accueil</a>
      <a href="carte.html"{cls('carte')}>La carte</a>
      <a href="infos.html"{cls('infos')}>Infos &amp; horaires</a>
    </nav>

    <div class="header__actions">
      <a class="icon-btn" href="tel:{TELLINK}" aria-label="Appeler le restaurant au {TEL}">☎</a>
      <button type="button" class="icon-btn" data-cart-open aria-label="Ouvrir le panier">
        🛒<span class="cart-btn__count" data-cart-count>0</span>
      </button>
      <a class="btn btn--sm header__cta" data-order-cta>Commander</a>
      <button type="button" class="icon-btn burger" id="burger" aria-expanded="false"
              aria-controls="mobile-nav" aria-label="Ouvrir le menu">☰</button>
    </div>
  </div>

  <nav class="wrap mobile-nav" id="mobile-nav" aria-label="Navigation mobile">
    <a href="index.html">Accueil</a>
    <a href="carte.html">La carte</a>
    <a href="infos.html">Infos &amp; horaires</a>
    <a href="#" data-order-cta data-order-cta-label="keep">Commander en ligne</a>
  </nav>
</header>
"""

FOOTER = f"""
<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div>
        <div class="footer__logo">
          <span class="logo__mark"><img src="assets/img/logo.png" alt="" width="46" height="46"></span>
          <span class="logo__text">
            <span class="logo__name">Dilemme</span>
            <span class="logo__sub">Sandwichs &amp; Panuozzo</span>
          </span>
        </div>
        <p class="footer__baseline">Chaud ou froid, délicieux sera le choix.</p>
        <p>Sandwicherie italienne à Villiers-sur-Marne.<br>
        Panuozzo cuit au four, produits frais, préparé à la commande.</p>
      </div>

      <div>
        <h4>Le site</h4>
        <ul>
          <li><a href="index.html">Accueil</a></li>
          <li><a href="carte.html">La carte</a></li>
          <li><a href="infos.html">Infos &amp; horaires</a></li>
          <li><a href="#" data-order-cta data-order-cta-label="keep">Commander en ligne</a></li>
        </ul>
      </div>

      <div>
        <h4>La carte</h4>
        <ul>
          <li><a href="carte.html#cat-chaud">Sandwichs chauds</a></li>
          <li><a href="carte.html#cat-froid">Panuozzos Signature</a></li>
          <li><a href="carte.html#cat-petite-faim">Petite faim</a></li>
          <li><a href="carte.html#cat-boissons">Boissons</a></li>
        </ul>
      </div>

      <div>
        <h4>Nous trouver</h4>
        <ul>
          <li><a href="{MAPS}" target="_blank" rel="noopener">{ADDR}</a></li>
          <li><a href="tel:{TELLINK}">{TEL}</a></li>
          <li>Fermé le lundi</li>
        </ul>
        <div class="socials" style="margin-top:14px">
          <a class="btn btn--ghost-light btn--sm" data-social="instagram" href="#" target="_blank" rel="noopener">Instagram</a>
          <a class="btn btn--ghost-light btn--sm" data-social="tiktok" href="#" target="_blank" rel="noopener">TikTok</a>
          <a class="btn btn--ghost-light btn--sm" data-social="facebook" href="#" target="_blank" rel="noopener">Facebook</a>
        </div>
      </div>
    </div>

    <div class="footer__bottom">
      <span>© 2026 Dilemme · Villiers-sur-Marne</span>
      <span><a href="mentions-legales.html">Mentions légales &amp; confidentialité</a></span>
    </div>
  </div>
</footer>
"""

# Panier, modale produit et voile : présents sur toutes les pages
SHELL = """
<div class="overlay" id="overlay" hidden-aria></div>

<aside class="sheet" id="sheet" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Détail du produit">
  <div class="sheet__head" id="sheet-head"></div>
  <div class="sheet__body" id="sheet-body"></div>
  <div class="sheet__foot" id="sheet-foot"></div>
</aside>

<aside class="cart" id="cart" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Panier">
  <div class="cart__head">
    <h2>Mon panier</h2>
    <button type="button" class="sheet__close" data-cart-close aria-label="Fermer le panier">✕</button>
  </div>
  <div class="cart__body" id="cart-body"></div>
  <div class="cart__foot" id="cart-foot"></div>
</aside>
"""

def page(path, title, desc, page_id, body, extra='', jsonld='', ogtype='website',
         robots='index, follow, max-image-preview:large, max-snippet:-1'):
    canon = f'{SITE}/' if path == 'index.html' else f'{SITE}/{path}'
    html = (HEAD
            .replace('__TITLE__', title)
            .replace('__DESC__', desc)
            .replace('__CANON__', canon)
            .replace('__SITE__', SITE)
            .replace('__OGTYPE__', ogtype)
            .replace('__PAGE__', page_id)
            .replace('__EXTRA__', extra)
            .replace('__JSONLD__', jsonld)
            .replace('__ROBOTS__', robots))
    html += header(page_id if page_id in ('index', 'carte', 'infos') else '')
    html += body
    html += FOOTER + SHELL + '\n</body>\n</html>\n'
    html = html.replace(' hidden-aria', '')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'  {path:26s} {len(html)//1024} Ko')

print('Génération des pages :')

# =========================================================== ACCUEIL
INDEX = f"""
<main id="main">

<section class="hero hero--photo">
  <div class="hero__media" id="hero-media">
    <img src="assets/img/hero-01.jpg"
         srcset="assets/img/hero-01-sm.jpg 900w, assets/img/hero-01.jpg 1800w"
         sizes="100vw" width="1800" height="1013"
         alt="Assortiment de panuozzos et sandwichs italiens Dilemme sur planches de bois"
         fetchpriority="high" decoding="async">
  </div>
  <button type="button" class="hero__sound" id="hero-sound" hidden></button>

  <div class="wrap hero__inner">
    <p class="eyebrow eyebrow--light">Villiers-sur-Marne · Click &amp; Collect</p>
    <h1>
      <span class="line wordmark">Sandwichs</span>
      <span class="line wordmark">&amp; Panuozzo</span>
    </h1>
    <span class="hero__script">Chaud ou froid,</span>
    <p class="hero__lead">
      Le panuozzo, ce pain napolitain cuit au four&nbsp;: moelleux dedans, croustillant dehors.
      Garni de charcuteries italiennes ou de viandes grillées, préparé à la commande,
      prêt à emporter en 20&nbsp;minutes.
    </p>

    <div class="hero__cta">
      <a class="btn btn--lg" data-order-cta data-order-cta-label="keep">Commander en ligne</a>
      <a class="btn btn--lg btn--ghost-light" href="carte.html">Découvrir la carte</a>
    </div>

    <div class="hero__meta">
      <span class="status" data-status></span>
      <a class="hero__pill" href="{MAPS}" target="_blank" rel="noopener">📍 {ADDR}</a>
      <a class="hero__pill" href="tel:{TELLINK}">☎ {TEL}</a>
    </div>

    <div class="pledges">
      <div class="pledge"><span class="medallion" aria-hidden="true">🥪</span><span>Sandwichs<br>gourmands</span></div>
      <div class="pledge"><span class="medallion" aria-hidden="true">🥖</span><span>Panuozzo<br>authentique</span></div>
      <div class="pledge"><span class="medallion" aria-hidden="true">🌿</span><span>Ingrédients<br>frais</span></div>
      <div class="pledge"><span class="medallion" aria-hidden="true">♡</span><span>Fait avec<br>passion</span></div>
    </div>
  </div>
</section>

<div class="marquee" aria-hidden="true">
  <div class="marquee__track">
    <span>Panuozzo cuit au four</span><span>Charcuteries italiennes</span>
    <span>Frites maison</span><span>Click &amp; Collect</span><span>Villiers-sur-Marne</span>
    <span>Panuozzo cuit au four</span><span>Charcuteries italiennes</span>
    <span>Frites maison</span><span>Click &amp; Collect</span><span>Villiers-sur-Marne</span>
  </div>
</div>

<!-- ------------------------------------------------ Click and collect -->
<section class="section" id="click-and-collect">
  <div class="wrap">
    <div class="section__head">
      <p class="eyebrow">Click &amp; Collect</p>
      <h2>Commandez maintenant,<br>récupérez quand vous voulez</h2>
      <p>Pas de file d’attente, pas de sandwich qui refroidit&nbsp;: vous choisissez votre créneau,
      on prépare tout juste avant votre arrivée.</p>
    </div>

    <div class="steps">
      <article class="step">
        <span class="step__num" aria-hidden="true">1</span>
        <h3>Composez votre commande</h3>
        <p>Toute la carte est en ligne&nbsp;: sandwichs chauds servis avec frites et boisson,
        panuozzos froids à l’italienne, salades et snacks.</p>
      </article>
      <article class="step">
        <span class="step__num" aria-hidden="true">2</span>
        <h3>Choisissez votre heure</h3>
        <p>Dès que possible ou plus tard dans la journée&nbsp;: le créneau de retrait
        s’adapte à votre pause déjeuner comme à votre soirée.</p>
      </article>
      <article class="step">
        <span class="step__num" aria-hidden="true">3</span>
        <h3>Retirez sur place</h3>
        <p>Vous vous présentez au comptoir avec votre prénom&nbsp;: la commande est prête,
        emballée, et vous repartez aussitôt.</p>
      </article>
    </div>
  </div>
</section>

<!-- ------------------------------------------------- Incontournables -->
<section class="section section--paper" id="incontournables">
  <div class="wrap">
    <div class="section__head">
      <p class="eyebrow">Les incontournables</p>
      <h2>Ceux qu’on commande<br>et recommande</h2>
      <p>Une sélection de nos spécialités les plus demandées. Le reste de la carte
      vous attend juste à côté.</p>
    </div>
    <div class="picks" data-highlights></div>
    <div style="margin-top:28px">
      <a class="btn btn--ghost" href="carte.html">Voir toute la carte</a>
    </div>
  </div>
</section>

<!-- ------------------------------------------------------- Réseaux -->
<section class="section section--paper" id="reseaux">
  <div class="wrap">
    <div class="section__head">
      <p class="eyebrow">Ne rien manquer</p>
      <h2>Suivez-nous</h2>
      <p>Nouveautés de la carte, coulisses du four, éditions limitées&nbsp;:
      tout passe d’abord par nos réseaux.</p>
    </div>
    <div class="reels" id="reels-root"></div>
    <div class="socials" style="margin-top:26px">
      <a class="btn btn--ghost btn--sm" data-social="instagram" href="#" target="_blank" rel="noopener">Nous suivre sur Instagram</a>
      <a class="btn btn--ghost btn--sm" data-social="tiktok" href="#" target="_blank" rel="noopener">Nous suivre sur TikTok</a>
    </div>
  </div>
</section>

<div class="gallery" aria-hidden="true">
  <div class="gallery__track" id="gallery-track"></div>
</div>

<!-- ------------------------------------------------------ La maison -->
<section class="section" id="le-panuozzo">
  <div class="wrap about">
    <div>
      <p class="eyebrow">Notre spécialité</p>
      <h2>Le panuozzo,<br>c’est quoi&nbsp;?</h2>
      <p>Né dans les environs de Naples, le panuozzo part d’une pâte à pizza cuite au four,
      ouverte en deux, garnie, puis repassée quelques instants au four. Résultat&nbsp;: un pain
      moelleux au cœur, croustillant sur les bords, qui tient la garniture sans se détremper.</p>
      <p>Chez Dilemme, on le décline de deux façons. <strong>Chaud</strong>&nbsp;: viandes grillées,
      escalope panée, œuf, cheddar fondu, servi avec frites maison et boisson.
      <strong>Froid</strong>&nbsp;: charcuteries italiennes, stracciatella, burrata, roquette,
      tomates confites, crème de truffe ou pesto.</p>
      <p class="script" style="font-size:1.6rem;color:var(--sage-700)">Chaud ou froid, délicieux sera le choix.</p>
      <a class="btn" data-order-cta data-order-cta-label="keep">Commander en ligne</a>
    </div>
    <div class="about__media">
      <img src="assets/img/hero-02.jpg"
           srcset="assets/img/hero-02-sm.jpg 900w, assets/img/hero-02.jpg 1800w"
           sizes="(min-width: 900px) 46vw, 92vw"
           alt="Panuozzos garnis de charcuterie italienne, roquette et stracciatella"
           loading="lazy" decoding="async" width="1800" height="1013">
      <span class="about__seal"><img src="assets/img/logo.png" alt="" width="84" height="84" loading="lazy"></span>
    </div>
  </div>
</section>

<!-- ------------------------------------------------ Infos pratiques -->
<section class="infobar" id="infos-pratiques">
  <div class="wrap infobar__grid">
    <div>
      <h3>Nous trouver</h3>
      <p><a href="{MAPS}" target="_blank" rel="noopener">{ADDR}</a></p>
      <p style="margin-top:10px">À deux pas du centre-ville, retrait au comptoir.</p>
      <p style="margin-top:14px"><a class="btn btn--light btn--sm" href="{MAPS}" target="_blank" rel="noopener">Itinéraire</a></p>
    </div>
    <div>
      <h3>Horaires</h3>
      <ul class="hours-list" data-hours></ul>
    </div>
    <div>
      <h3>Contact</h3>
      <p>Une question, une commande de groupe, un imprévu&nbsp;?</p>
      <p style="margin-top:10px"><a href="tel:{TELLINK}">{TEL}</a></p>
      <p style="margin-top:14px"><span class="status status--onLight" data-status></span></p>
    </div>
  </div>
</section>

<!-- -------------------------------------------------------- Questions -->
<section class="section" id="faq">
  <div class="wrap" style="max-width:820px">
    <div class="section__head">
      <p class="eyebrow">Questions fréquentes</p>
      <h2>Bon à savoir</h2>
    </div>
    {''.join(f'''
    <details class="panel" style="margin-bottom:12px">
      <summary style="cursor:pointer;font-weight:500;font-size:1.05rem">{q}</summary>
      <p style="margin:14px 0 0;color:var(--ink-soft)">{a}</p>
    </details>''' for q, a in FAQ)}
  </div>
</section>

</main>
"""

page('index.html',
     'Dilemme — Sandwichs &amp; Panuozzo à Villiers-sur-Marne | Click &amp; Collect',
     'Sandwicherie italienne à Villiers-sur-Marne : panuozzo cuit au four, sandwichs chauds '
     'servis avec frites et boisson, panuozzos froids à la charcuterie italienne. Commandez en '
     'ligne et retirez sur place au 4 Place Joséphine Piquet.',
     'index', INDEX,
     extra='<link rel="preload" as="image" href="assets/img/hero-01.jpg" imagesrcset="assets/img/hero-01-sm.jpg 900w, assets/img/hero-01.jpg 1800w" imagesizes="100vw">',
     jsonld=ld(RESTAURANT_LD, WEBSITE_LD, FAQ_LD))

# ============================================================= LA CARTE
CARTE = f"""
<main id="main">

<section class="section section--tight">
  <div class="wrap">
    <p class="eyebrow">La carte</p>
    <h1 style="font-size:clamp(2.2rem,7.5vw,4rem)">Notre carte</h1>
    <p class="text-soft" style="max-width:62ch">
      Sandwichs chauds servis avec frites maison et boisson, panuozzos froids à l’italienne,
      snacks et salades. Tout est préparé à la commande, dans le pain panuozzo cuit au four.
    </p>
    <div class="search" style="margin-top:22px">
      <span aria-hidden="true">🔍</span>
      <label class="visually-hidden" for="menu-search">Rechercher un produit</label>
      <input type="search" id="menu-search" placeholder="Chercher un sandwich, un ingrédient…"
             autocomplete="off">
    </div>
  </div>
</section>

<div class="catnav">
  <nav class="catnav__scroll" id="catnav" aria-label="Catégories de la carte"></nav>
</div>

<div class="wrap">
  <div id="dispo-message" role="status" aria-live="polite"></div>
  <div id="menu-root"></div>
</div>

<section class="section">
  <div class="wrap">
    <div class="panel panel--accent" style="text-align:center;max-width:680px;margin-inline:auto">
      <p class="eyebrow" style="justify-content:center">Prêt à commander&nbsp;?</p>
      <h2 style="font-size:clamp(1.7rem,4.6vw,2.4rem)">Votre commande vous attend au comptoir</h2>
      <p class="text-soft">Choisissez votre créneau, on prépare tout juste avant votre arrivée.</p>
      <a class="btn btn--lg btn--block" data-order-cta data-order-cta-label="keep">Commander en ligne</a>
      <div class="leaf-divider" aria-hidden="true">🌿</div>
      <p class="field__hint">
        Toutes nos viandes sont halal.<br>
        Prix en euros, taxes incluses. Photos non contractuelles.<br>
        Informations sur les allergènes disponibles au comptoir&nbsp;: {TEL}.
      </p>
    </div>
  </div>
</section>

</main>

<div class="cartbar" id="cartbar">
  <span class="cartbar__info">
    <span class="cartbar__count" data-bar-count>0 article</span>
    <span class="cartbar__total" data-bar-total>0,00 €</span>
  </span>
  <button type="button" class="btn btn--light btn--sm" data-cart-open>Voir le panier</button>
</div>
"""

page('carte.html',
     'La carte — Panuozzo, sandwichs chauds et froids | Dilemme Villiers-sur-Marne',
     'Découvrez la carte Dilemme : Le Suisse, Le DZ, Le Suprême, émincé de bœuf, noix de veau, '
     'panuozzos froids Pesto, Truffe, Black Angus, L’Olive, salades et snacks. Prix et '
     'composition, commande en ligne pour un retrait à Villiers-sur-Marne.',
     'carte', CARTE,
     jsonld=ld(breadcrumb('La carte', 'carte.html')) + '\n<!-- SEO:MENU-JSONLD --><!-- /SEO:MENU-JSONLD -->')

# ============================================================== COMMANDE
COMMANDE = f"""
<main id="main">
<section class="section section--tight">
  <div class="wrap">
    <p class="eyebrow">Click &amp; Collect</p>
    <h1 style="font-size:clamp(2rem,6.5vw,3.2rem)">Ma commande</h1>
    <p class="text-soft" style="max-width:60ch">Retrait au comptoir&nbsp;:
      <span data-pickup-address>{ADDR}</span>.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <div class="checkout" id="checkout-root">
      <div>
        <form id="order-form" novalidate>

          <div class="panel">
            <div class="panel__head">
              <span class="panel__step" aria-hidden="true">1</span>
              <h2>Heure de retrait</h2>
            </div>
            <div class="field" data-field="slot" style="margin-bottom:0">
              <div class="dayrow" id="pickup-days" role="group" aria-label="Jour de retrait"></div>
              <div id="pickup-slots" role="group" aria-label="Heure de retrait"></div>
              <p class="field__error">Choisissez une heure de retrait.</p>
            </div>
          </div>

          <div class="panel">
            <div class="panel__head">
              <span class="panel__step" aria-hidden="true">2</span>
              <h2>Vos coordonnées</h2>
            </div>
            <div class="field-row">
              <div class="field" data-field="name">
                <label for="name">Prénom (annoncé au retrait)</label>
                <input type="text" id="name" name="name" autocomplete="given-name" required>
                <p class="field__error"></p>
              </div>
              <div class="field" data-field="phone">
                <label for="phone">Téléphone</label>
                <input type="tel" id="phone" name="phone" autocomplete="tel"
                       placeholder="06 12 34 56 78" required>
                <p class="field__error"></p>
              </div>
            </div>
            <div class="field" data-field="email">
              <label for="email">E-mail (facultatif)</label>
              <input type="email" id="email" name="email" autocomplete="email">
              <p class="field__hint">Uniquement pour vous envoyer le récapitulatif.</p>
              <p class="field__error"></p>
            </div>
            <div class="field">
              <label for="note">Précision pour la cuisine (facultatif)</label>
              <textarea id="note" name="note" placeholder="Allergie, sans oignon, sauce à part…"></textarea>
            </div>
          </div>

          <div class="panel">
            <div class="panel__head">
              <span class="panel__step" aria-hidden="true">3</span>
              <h2>Paiement</h2>
            </div>
            <div class="payopts">
              <label class="opt">
                <input type="radio" name="payment" value="sur-place" checked>
                <span class="opt__label"><strong>Sur place au retrait</strong><br>
                  <span class="text-soft" style="font-size:.86rem">Carte bancaire ou espèces au comptoir</span>
                </span>
              </label>
            </div>
            <div class="field" data-field="consent" style="margin:16px 0 0">
              <label class="opt" style="align-items:flex-start">
                <input type="checkbox" name="consent" style="margin-top:3px">
                <span class="opt__label">J’accepte d’être contacté par le restaurant au sujet de
                  cette commande. Mes coordonnées ne servent qu’à la préparer.</span>
              </label>
              <p class="field__error"></p>
            </div>
          </div>

          <button type="submit" class="btn btn--lg btn--block" id="submit-order">
            Valider ma commande
          </button>
          <p class="field__hint" style="text-align:center">
            En validant, la commande complète est transmise au restaurant.
          </p>
        </form>
      </div>

      <aside class="checkout__aside">
        <div class="panel">
          <div class="panel__head"><span class="panel__step" aria-hidden="true">✓</span><h2>Récapitulatif</h2></div>
          <div id="order-summary"></div>
          <div class="leaf-divider" aria-hidden="true">🌿</div>
          <form id="promo-form">
            <div class="field" style="margin-bottom:10px">
              <label for="promo-input">Code promo</label>
              <input type="text" id="promo-input" placeholder="BIENVENUE10" autocomplete="off">
            </div>
            <button type="submit" class="btn btn--ghost btn--sm btn--block">Appliquer le code</button>
            <p class="notice" id="promo-feedback" hidden style="margin-top:12px"></p>
          </form>
        </div>
      </aside>
    </div>
  </div>
</section>
</main>
"""

page('commande.html',
     'Commander en click &amp; collect | Dilemme Villiers-sur-Marne',
     'Passez commande chez Dilemme et choisissez votre créneau de retrait au 4 Place Joséphine '
     'Piquet à Villiers-sur-Marne. Préparation à la commande, retrait au comptoir.',
     'commande', COMMANDE,
     jsonld=ld(breadcrumb('Commander', 'commande.html')))

# ========================================================== CONFIRMATION
CONFIRMATION = """
<main id="main">
<section class="section section--tight">
  <div class="wrap" style="max-width:720px" id="confirm-root"></div>
</section>
</main>
"""

page('confirmation.html',
     'Commande confirmée | Dilemme Villiers-sur-Marne',
     'Votre commande Dilemme est enregistrée. Retrouvez le récapitulatif et l’heure de retrait.',
     'confirmation', CONFIRMATION,
     robots='noindex, follow')

# ================================================================ INFOS
INFOS = f"""
<main id="main">
<section class="section section--tight">
  <div class="wrap">
    <p class="eyebrow">Infos pratiques</p>
    <h1 style="font-size:clamp(2rem,6.5vw,3.4rem)">Horaires, adresse<br>et contact</h1>
    <p class="text-soft" style="max-width:60ch">
      Dilemme, sandwicherie italienne au cœur de Villiers-sur-Marne&nbsp;: panuozzo cuit au four,
      à emporter ou à récupérer en click and collect.
    </p>
    <p style="margin-top:18px"><span class="status status--onLight" data-status></span></p>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap checkout">
    <div>
      <div class="panel">
        <div class="panel__head"><span class="panel__step" aria-hidden="true">📍</span><h2>Adresse</h2></div>
        <p style="font-size:1.1rem;margin-bottom:6px"><strong>Dilemme — Sandwichs &amp; Panuozzo</strong></p>
        <p>{ADDR}</p>
        <p class="text-soft">En transports&nbsp;: gare RER E de Villiers-sur-Marne – Le Plessis-Trévise,
        puis quelques minutes à pied. Stationnement à proximité.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
          <a class="btn btn--sm" href="{MAPS}" target="_blank" rel="noopener">Ouvrir l’itinéraire</a>
          <a class="btn btn--ghost btn--sm" href="tel:{TELLINK}">Appeler {TEL}</a>
        </div>
      </div>

      <div class="panel">
        <div class="panel__head"><span class="panel__step" aria-hidden="true">🛍️</span><h2>Le click and collect</h2></div>
        <p>Vous commandez en ligne, vous choisissez l’heure à laquelle vous passez, et votre
        commande est préparée juste avant votre arrivée. Comptez environ 20&nbsp;minutes de
        préparation aux heures calmes, un peu plus au rush du midi et du soir.</p>
        <p class="text-soft">Le retrait se fait au comptoir&nbsp;: annoncez votre prénom
        ou le numéro de commande, et c’est prêt.</p>
        <p class="text-soft">Toutes nos viandes sont halal.</p>
        <a class="btn" data-order-cta data-order-cta-label="keep" style="margin-top:6px">Commander en ligne</a>
      </div>

      <div class="panel">
        <div class="panel__head"><span class="panel__step" aria-hidden="true">?</span><h2>Questions fréquentes</h2></div>
        <p>Composition, options végétariennes, formules, allergènes&nbsp;: les réponses aux
        questions les plus posées sont réunies sur la page d’accueil.</p>
        <a class="btn btn--ghost btn--sm" href="index.html#faq">Voir les questions fréquentes</a>
      </div>
    </div>

    <aside class="checkout__aside">
      <div class="panel panel--accent">
        <div class="panel__head"><span class="panel__step" aria-hidden="true">🕒</span><h2>Horaires</h2></div>
        <ul class="hours-list" data-hours style="color:var(--ink)"></ul>
        <p class="field__hint">Dernière commande environ 15&nbsp;minutes avant la fermeture.</p>
      </div>
    </aside>
  </div>
</section>
</main>

<style>
  /* La liste d'horaires reprend les couleurs claires sur cette page */
  #main .hours-list li {{ border-bottom-color: var(--line); }}
  #main .hours-list .is-today {{ color: var(--sage-800); font-weight: 500; }}
  #main .hours-list .is-closed {{ color: var(--ink-soft); }}
</style>
"""

page('infos.html',
     'Horaires, adresse et contact | Dilemme Villiers-sur-Marne',
     'Dilemme, sandwichs et panuozzo au 4 Place Joséphine Piquet, 94350 Villiers-sur-Marne. '
     'Ouvert du mardi au dimanche de 12h à 23h (vendredi dès 14h30), fermé le lundi. '
     'Téléphone : 06 29 98 60 50.',
     'infos', INFOS,
     jsonld=ld(RESTAURANT_LD, breadcrumb('Infos & horaires', 'infos.html')))

# ==================================================== MENTIONS LÉGALES
MENTIONS = f"""
<main id="main">
<section class="section section--tight">
  <div class="wrap" style="max-width:780px">
    <p class="eyebrow">Informations légales</p>
    <h1 style="font-size:clamp(1.9rem,6vw,3rem)">Mentions légales<br>et confidentialité</h1>

    <div class="panel">
      <h2 style="font-size:1.3rem">Éditeur du site</h2>
      <p><strong>O’DILEMME</strong>, société par actions simplifiée (SAS), exploitant
      le restaurant <strong>Dilemme — Sandwichs &amp; Panuozzo</strong>.</p>
      <ul style="display:grid;gap:8px;margin:0 0 14px">
        <li>· Siège social : {ADDR}</li>
        <li>· SIREN : 105 882 096 — SIRET du siège : 105 882 096 00016</li>
        <li>· TVA intracommunautaire : FR12 105 882 096</li>
        <li>· Activité : restauration de type rapide (code APE 56.10C)</li>
        <li>· Immatriculée au registre du commerce et des sociétés de Créteil</li>
        <li>· Téléphone : <a href="tel:{TELLINK}" style="text-decoration:underline">{TEL}</a></li>
      </ul>
      <p class="text-soft"><em>À compléter : capital social, nom du directeur de la
      publication (président de la SAS) et adresse e-mail de contact.</em></p>
    </div>

    <div class="panel">
      <h2 style="font-size:1.3rem">Hébergement</h2>
      <p>Site hébergé par <strong>Vercel Inc.</strong><br>
      440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br>
      <a href="https://vercel.com" target="_blank" rel="noopener" style="text-decoration:underline">vercel.com</a></p>
      <p class="text-soft">Nom de domaine enregistré auprès de GoDaddy.</p>
    </div>

    <div class="panel">
      <h2 style="font-size:1.3rem">Données personnelles</h2>
      <p>Le site ne crée aucun compte client et n’utilise aucun cookie publicitaire
      ni traceur de mesure d’audience.</p>
      <ul style="display:grid;gap:10px;margin:0 0 14px">
        <li>· <strong>Panier et coordonnées</strong> : le contenu de votre panier, votre
        prénom, votre téléphone et, si vous le renseignez, votre e-mail sont conservés
        dans la mémoire de votre navigateur (stockage local), sur votre appareil. Vous
        pouvez les effacer en vidant les données du site.</li>
        <li>· <strong>Transmission de la commande</strong> : à la validation, le
        récapitulatif est transmis au restaurant par messagerie WhatsApp, à votre
        initiative. WhatsApp applique alors sa propre politique de confidentialité.</li>
        <li>· <strong>Finalité et durée</strong> : ces informations servent uniquement à
        préparer et remettre votre commande, et à vous joindre en cas de problème. Elles
        ne sont ni revendues, ni utilisées à des fins publicitaires.</li>
        <li>· <strong>Vos droits</strong> : accès, rectification, suppression et
        opposition, sur simple demande au {TEL}. Vous pouvez également saisir la CNIL
        (<a href="https://www.cnil.fr" target="_blank" rel="noopener" style="text-decoration:underline">cnil.fr</a>).</li>
      </ul>
    </div>

    <div class="panel">
      <h2 style="font-size:1.3rem">Propriété intellectuelle</h2>
      <p>Le nom Dilemme, le logotype, les textes, les photographies et les vidéos
      présentés sur ce site appartiennent à O’DILEMME et ne peuvent être reproduits
      sans autorisation écrite préalable.</p>
    </div>

    <div class="panel">
      <h2 style="font-size:1.3rem">Allergènes et informations produits</h2>
      <p>Les photographies sont non contractuelles. Les prix sont indiqués en euros,
      toutes taxes comprises. Les informations relatives aux allergènes présents dans
      nos préparations sont communiquées sur demande au comptoir ou par téléphone au
      {TEL}. Nos produits sont préparés dans un atelier où sont manipulés gluten, lait,
      œufs, fruits à coque et sésame : une contamination croisée ne peut être exclue.</p>
    </div>

    <div class="panel">
      <h2 style="font-size:1.3rem">Médiation de la consommation</h2>
      <p class="text-soft">Tout professionnel vendant à des particuliers doit désigner un
      médiateur de la consommation et en indiquer les coordonnées ici.
      <em>À compléter : nom et adresse du médiateur retenu.</em></p>
    </div>

    <a class="btn btn--ghost" href="index.html">Retour à l’accueil</a>
  </div>
</section>
</main>
"""

page('mentions-legales.html',
     'Mentions légales et confidentialité | Dilemme Villiers-sur-Marne',
     'Mentions légales du site Dilemme, sandwichs et panuozzo à Villiers-sur-Marne, et '
     'informations sur le traitement des données personnelles.',
     'mentions', MENTIONS,
     robots='index, nofollow')
