/* ==========================================================================
   Dilemme — Panuozzos & sandwichs italiens · Villiers-sur-Marne
   Tout le contenu éditorial est ici : restaurant, horaires, carte, options,
   codes promo. Éditer ce fichier suffit à faire évoluer le site.

   Carte transcrite depuis les menus du restaurant.
   Photos : la clé `image` contient le nom de base d'un fichier de
   assets/img/. Le site charge assets/img/<nom>.jpg sur grand écran et
   assets/img/<nom>-sm.jpg sur mobile (srcset). Sans clé `image`, une
   vignette dégradée avec l'émoji s'affiche : jamais d'image cassée.
   ========================================================================== */

/* Le restaurant — point de retrait unique du click & collect */
const RESTAURANT = {
  name: 'Dilemme',
  tagline: 'Panuozzos & sandwichs italiens',
  address: '4 Pl. Joséphine Piquet, 94350 Villiers-sur-Marne',
  phone: '06 29 98 60 50',
  phoneLink: '+33629986050',
  mapsQuery: '4 Place Joséphine Piquet 94350 Villiers-sur-Marne',
  /* Délai de préparation minimum avant le premier créneau de retrait */
  prepMinutes: 20,
};

/* Horaires, indexés sur Date.getDay() : 0 = dimanche … 6 = samedi.
   null = fermé. Plusieurs plages par jour sont acceptées, par exemple :
   [{ open: '12:00', close: '14:30' }, { open: '18:00', close: '23:00' }] */
const OPENING_HOURS = {
  0: [{ open: '12:00', close: '23:00' }], // dimanche
  1: null,                                // lundi — fermé
  2: [{ open: '12:00', close: '23:00' }], // mardi
  3: [{ open: '12:00', close: '23:00' }], // mercredi
  4: [{ open: '12:00', close: '23:00' }], // jeudi
  5: [{ open: '14:30', close: '23:00' }], // vendredi
  6: [{ open: '12:00', close: '23:00' }], // samedi
};

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const CATEGORIES = [
  { id: 'chaud', label: 'Sandwichs chauds', icon: '🔥', note: 'Servis avec frites maison et une boisson' },
  { id: 'froid', label: 'Panuozzos Signature', icon: '🇮🇹', note: 'Sandwichs froids, pain panuozzo cuit au four' },
  { id: 'petite-faim', label: 'Petite faim', icon: '🍟', note: 'Snacks et salades' },
  { id: 'boissons', label: 'Boissons', icon: '🥤' },
];

/* --------------------------------------------------------------- OPTIONS
   type 'single' = un seul choix (radio) · 'multi' = plusieurs (cases)
   Pour les groupes 'multi' :
     max        → nombre maximum de choix cochables
     freeUpTo   → nombre de choix inclus ; au-delà, extraPrice s'applique
     extraPrice → prix unitaire des choix au-delà de freeUpTo
   -------------------------------------------------------------------- */
const OPTION_GROUPS = {
  /* --- Sandwichs chauds : frites + boisson incluses --- */
  boissonIncluse: {
    id: 'boissonIncluse',
    label: 'Boisson incluse',
    type: 'single',
    required: true,
    hint: 'Comprise dans le prix du menu',
    choices: [
      { id: 'coca', label: 'Coca-Cola 33 cl', price: 0 },
      { id: 'coca-zero', label: 'Coca-Cola Zero 33 cl', price: 0 },
      { id: 'fanta', label: 'Fanta orange 33 cl', price: 0 },
      { id: 'sprite', label: 'Sprite 33 cl', price: 0 },
      { id: 'oasis', label: 'Oasis tropical 33 cl', price: 0 },
      { id: 'ice-tea', label: 'Ice Tea 33 cl', price: 0 },
      { id: 'eau', label: 'Eau minérale 50 cl', price: 0 },
    ],
  },
  sauceCurry: {
    id: 'sauceCurry',
    label: 'Votre sauce',
    type: 'single',
    required: true,
    choices: [
      { id: 'curry', label: 'Curry', price: 0 },
      { id: 'tandoori', label: 'Tandoori', price: 0 },
    ],
  },
  saucesAPart: {
    id: 'saucesAPart',
    label: 'Sauces à part',
    type: 'multi',
    max: 3,
    hint: 'Jusqu’à 3 pots offerts',
    choices: [
      { id: 'algerienne', label: 'Algérienne', price: 0 },
      { id: 'blanche', label: 'Blanche ail & fines herbes', price: 0 },
      { id: 'samourai', label: 'Samouraï', price: 0 },
      { id: 'mayo', label: 'Mayonnaise', price: 0 },
      { id: 'ketchup', label: 'Ketchup', price: 0 },
      { id: 'barbecue', label: 'Barbecue', price: 0 },
      { id: 'harissa', label: 'Harissa', price: 0 },
    ],
  },
  cuisson: {
    id: 'cuisson',
    label: 'Cuisson du pain',
    type: 'single',
    required: true,
    choices: [
      { id: 'moelleux', label: 'Moelleux', price: 0 },
      { id: 'croustillant', label: 'Bien croustillant', price: 0 },
    ],
  },
  sansIngredient: {
    id: 'sansIngredient',
    label: 'Je retire',
    type: 'multi',
    choices: [
      { id: 'sans-oignon', label: 'Sans oignon', price: 0 },
      { id: 'sans-tomate', label: 'Sans tomate', price: 0 },
      { id: 'sans-roquette', label: 'Sans roquette', price: 0 },
      { id: 'sans-poivron', label: 'Sans poivron', price: 0 },
      { id: 'sans-cornichon', label: 'Sans cornichon', price: 0 },
      { id: 'sans-piquant', label: 'Sans piquant', price: 0 },
    ],
  },

  /* --- Le Composé : les 4 étapes du menu --- */
  composeSauce: {
    id: 'composeSauce',
    label: '1 · Votre sauce',
    type: 'single',
    required: true,
    hint: 'Une seule sauce au choix',
    choices: [
      { id: 'sans', label: 'Sans sauce', price: 0 },
      { id: 'pesto', label: 'Sauce pesto', price: 0 },
      { id: 'poivrons', label: 'Crème de poivrons', price: 0 },
      { id: 'truffe', label: 'Crème de truffe', price: 1.0 },
    ],
  },
  composeFromage: {
    id: 'composeFromage',
    label: '2 · Votre fromage',
    type: 'single',
    required: true,
    hint: 'Un seul fromage inclus — le second est en supplément (+2 €)',
    choices: [
      { id: 'stracciatella', label: 'Stracciatella', price: 0 },
      { id: 'mozzarella', label: 'Mozzarella', price: 0 },
      { id: 'gorgonzola', label: 'Crème de gorgonzola', price: 0 },
      { id: 'parmesan', label: 'Copeaux de parmesan', price: 0 },
    ],
  },
  composeFromageSup: {
    id: 'composeFromageSup',
    label: 'Fromage supplémentaire',
    type: 'multi',
    choices: [
      { id: 'stracciatella-sup', label: 'Stracciatella', price: 2.0 },
      { id: 'mozzarella-sup', label: 'Mozzarella', price: 2.0 },
      { id: 'gorgonzola-sup', label: 'Crème de gorgonzola', price: 2.0 },
      { id: 'parmesan-sup', label: 'Copeaux de parmesan', price: 2.0 },
    ],
  },
  composeLegumes: {
    id: 'composeLegumes',
    label: '3 · Vos légumes',
    type: 'multi',
    freeUpTo: 4,
    extraPrice: 1.0,
    hint: 'Jusqu’à 4 légumes inclus, +1 € au-delà',
    choices: [
      { id: 'oignons', label: 'Oignons', price: 0 },
      { id: 'roquette', label: 'Roquette', price: 0 },
      { id: 'mache', label: 'Mâche', price: 0 },
      { id: 'tomates-cerises', label: 'Tomates cerises', price: 0 },
      { id: 'tomates-confites', label: 'Tomates confites', price: 0 },
      { id: 'poivrons-grilles', label: 'Poivrons grillés', price: 0 },
      { id: 'cornichons', label: 'Cornichons', price: 0 },
    ],
  },
  composeViandes: {
    id: 'composeViandes',
    label: '4 · Vos viandes',
    type: 'multi',
    max: 2,
    required: true,
    hint: 'Jusqu’à 2 viandes',
    choices: [
      { id: 'jambon-dinde', label: 'Jambon de dinde', price: 0 },
      { id: 'jambon-poulet', label: 'Jambon de poulet', price: 0 },
      { id: 'mortadelle-pistache', label: 'Mortadelle pistache', price: 0 },
      { id: 'mortadelle-olive', label: 'Mortadelle olive', price: 0 },
      { id: 'pastrami', label: 'Pastrami au poivre', price: 0 },
      { id: 'bresaola', label: 'Bresaola de bœuf', price: 2.0 },
      { id: 'black-angus', label: 'Black Angus', price: 2.5 },
    ],
  },
};

/* ---------------------------------------------------------------- LA CARTE */
const PRODUCTS = [
  /* ------------------------------------------------- Sandwichs chauds
     Tous servis avec frites maison et une boisson.                     */
  {
    id: 'le-suisse',
    name: 'Le Suisse',
    category: 'chaud',
    price: 10.9,
    emoji: '🧅',
    image: 'le-suisse',
    tags: ['best-seller'],
    description: 'Escalope de poulet, Boursin, fromage cheddar, oignons.',
    includes: 'Frites maison + boisson',
    options: ['boissonIncluse', 'cuisson', 'saucesAPart', 'sansIngredient'],
  },
  {
    id: 'le-dz',
    name: 'Le DZ',
    category: 'chaud',
    price: 11.9,
    emoji: '🍟',
    image: 'le-dz',
    tags: ['signature'],
    description: 'Viande hachée, frites maison, omelette, sauce Vache Qui Rit, fromage cheddar.',
    includes: 'Frites maison + boisson',
    options: ['boissonIncluse', 'cuisson', 'saucesAPart', 'sansIngredient'],
  },
  {
    id: 'chicken-curry-tandoori',
    name: 'Chicken Curry ou Tandoori',
    category: 'chaud',
    price: 10.9,
    emoji: '🍛',
    tags: [],
    description: 'Filet de poulet, sauce curry ou tandoori, fromage cheddar.',
    includes: 'Frites maison + boisson',
    options: ['sauceCurry', 'boissonIncluse', 'cuisson', 'saucesAPart', 'sansIngredient'],
  },
  {
    id: 'le-mega',
    name: 'Le Mega',
    category: 'chaud',
    price: 11.9,
    emoji: '🥓',
    tags: [],
    description: '3 steaks, œuf, bacon, fromage cheddar.',
    includes: 'Frites maison + boisson',
    options: ['boissonIncluse', 'cuisson', 'saucesAPart', 'sansIngredient'],
  },
  {
    id: 'le-supreme',
    name: 'Le Suprême',
    category: 'chaud',
    price: 12.9,
    emoji: '👑',
    image: 'le-supreme',
    tags: ['best-seller'],
    description: '3 steaks, escalope, œuf, bacon, fromage cheddar.',
    includes: 'Frites maison + boisson',
    options: ['boissonIncluse', 'cuisson', 'saucesAPart', 'sansIngredient'],
  },
  {
    id: 'noix-de-veau',
    name: 'Noix de veau',
    category: 'chaud',
    price: 12.9,
    emoji: '🥩',
    image: 'noix-de-veau',
    tags: ['signature'],
    description: 'Émincé de veau, oignons, fromage cheddar.',
    includes: 'Frites maison + boisson',
    options: ['boissonIncluse', 'cuisson', 'saucesAPart', 'sansIngredient'],
  },
  {
    id: 'emince-de-boeuf',
    name: 'Émincé de bœuf',
    category: 'chaud',
    price: 12.9,
    emoji: '🔥',
    image: 'emince-de-boeuf',
    tags: ['signature'],
    description: 'Émincé de bœuf, oignons, poivrons, fromage cheddar.',
    includes: 'Frites maison + boisson',
    options: ['boissonIncluse', 'cuisson', 'saucesAPart', 'sansIngredient'],
  },

  /* --------------------------------------- Panuozzos Signature (froids) */
  {
    id: 'le-pesto',
    name: 'Le Pesto',
    category: 'froid',
    price: 9.9,
    emoji: '🌿',
    image: 'le-pesto',
    tags: [],
    description: 'Jambon cru, mozzarella, tomates fraîches, tomates confites, roquette, pesto.',
    options: ['cuisson', 'sansIngredient'],
  },
  {
    id: 'l-olive',
    name: 'L’Olive',
    category: 'froid',
    price: 10.9,
    emoji: '🫒',
    image: 'l-olive',
    tags: [],
    description:
      'Bresaola, parmesan, roquette, tomates fraîches, tomates confites, huile d’olive.',
    options: ['cuisson', 'sansIngredient'],
  },
  {
    id: 'le-compose',
    name: 'Le Composé',
    category: 'froid',
    price: 11.9,
    emoji: '🧩',
    tags: ['à composer'],
    description:
      'Votre panuozzo sur mesure : une sauce, un fromage, jusqu’à 4 légumes et 2 viandes.',
    options: [
      'composeSauce',
      'composeFromage',
      'composeFromageSup',
      'composeLegumes',
      'composeViandes',
      'cuisson',
    ],
  },
  {
    id: 'le-black-angus',
    name: 'Le Black Angus',
    category: 'froid',
    price: 13.9,
    emoji: '🐂',
    image: 'le-black-angus',
    tags: ['best-seller'],
    description:
      'Bœuf Black Angus, stracciatella, poivrons grillés, tomates confites, roquette.',
    options: ['cuisson', 'sansIngredient'],
  },
  {
    id: 'la-truffe',
    name: 'La Truffe',
    category: 'froid',
    price: 12.5,
    emoji: '🍄',
    image: 'la-truffe',
    tags: ['signature'],
    description:
      'Mortadelle, burrata, roquette, parmesan, crème de truffe, oignons confits.',
    options: ['cuisson', 'sansIngredient'],
  },

  /* ------------------------------------------------------- Petite faim */
  {
    id: 'tenders-x3',
    name: 'Tenders x3',
    category: 'petite-faim',
    price: 3.9,
    emoji: '🍤',
    image: 'tenders-x3',
    tags: [],
    description: 'Filets de poulet panés, croustillants et moelleux.',
    options: ['saucesAPart'],
  },
  {
    id: 'mozza-stick-x4',
    name: 'Mozza Stick x4',
    category: 'petite-faim',
    price: 3.9,
    emoji: '🧈',
    image: 'mozza-stick-x4',
    tags: [],
    description: 'Bâtonnets de mozzarella panés, cœur fondant.',
    options: ['saucesAPart'],
  },
  {
    id: 'nuggets-x4',
    name: 'Nuggets x4',
    category: 'petite-faim',
    price: 3.9,
    emoji: '🍗',
    image: 'nuggets-x4',
    tags: [],
    description: 'Nuggets de poulet panés, dorés à la commande.',
    options: ['saucesAPart'],
  },
  {
    id: 'poulet-dynamite',
    name: 'Poulet Dynamite',
    category: 'petite-faim',
    price: 9.9,
    emoji: '🌶️',
    tags: ['piquant'],
    description: 'Bouchées de poulet croustillantes, sauce dynamite sucrée-piquante, sésame.',
    options: ['saucesAPart'],
  },
  {
    id: 'tomates-mozzarella',
    name: 'Tomates Mozzarella',
    category: 'petite-faim',
    price: 7.9,
    emoji: '🍅',
    tags: ['végé'],
    description: 'Tomates, mozzarella, basilic, pesto, huile d’olive.',
    options: [],
  },
  {
    id: 'burrata',
    name: 'Burrata',
    category: 'petite-faim',
    price: 9.5,
    emoji: '🤍',
    tags: ['végé'],
    description: 'Burrata crémeuse, tomates cerises, basilic, pesto, huile d’olive.',
    options: [],
  },
  {
    id: 'salade-cesar',
    name: 'Salade César',
    category: 'petite-faim',
    price: 10.9,
    emoji: '🥗',
    tags: ['best-seller'],
    description: 'Poulet grillé, sucrine, parmesan, croûtons, sauce césar.',
    options: [],
  },

  /* ----------------------------------------------------------- Boissons
     Limonades siciliennes Polara. Prix à confirmer : ils ne figuraient pas
     sur les menus transmis, 3,00 € est une valeur d'attente.               */
  {
    id: 'polara-limonata',
    name: 'Polara Limonata',
    category: 'boissons',
    price: 3.0,
    emoji: '🍋',
    image: 'polara-limonata',
    imageExt: 'webp',
    imageFit: 'contain',
    tags: ['sicilien'],
    description: 'Limonade artisanale au citron de Sicile.',
    options: [],
  },
  {
    id: 'polara-arancia-rossa',
    name: 'Polara Arancia Rossa Zero',
    category: 'boissons',
    price: 3.0,
    emoji: '🍊',
    image: 'polara-arancia-rossa',
    imageExt: 'webp',
    imageFit: 'contain',
    tags: ['sans sucres'],
    description: 'Orange sanguine de Sicile, version sans sucres.',
    options: [],
  },
  {
    id: 'polara-mandarino',
    name: 'Polara Mandarino Verde',
    category: 'boissons',
    price: 3.0,
    emoji: '🍈',
    image: 'polara-mandarino',
    imageExt: 'webp',
    imageFit: 'contain',
    tags: ['sicilien'],
    description: 'Soda pétillant au mandarin vert de Sicile.',
    options: [],
  },
  {
    id: 'polara-cola',
    name: 'Polara Cola',
    category: 'boissons',
    price: 3.0,
    emoji: '🥤',
    image: 'polara-cola',
    imageExt: 'webp',
    imageFit: 'contain',
    tags: ['sicilien'],
    description: 'Cola artisanal de la maison sicilienne Polara.',
    options: [],
  },
  {
    id: 'canette',
    name: 'Canette 33 cl',
    category: 'boissons',
    price: 2.0,
    emoji: '🥤',
    tags: [],
    description: 'Bien fraîche, parfum au choix.',
    options: [
      {
        id: 'canetteParfum',
        label: 'Parfum',
        type: 'single',
        required: true,
        choices: [
          { id: 'coca', label: 'Coca-Cola', price: 0 },
          { id: 'coca-zero', label: 'Coca-Cola Zero', price: 0 },
          { id: 'fanta', label: 'Fanta orange', price: 0 },
          { id: 'sprite', label: 'Sprite', price: 0 },
          { id: 'oasis', label: 'Oasis tropical', price: 0 },
          { id: 'ice-tea', label: 'Ice Tea pêche', price: 0 },
        ],
      },
    ],
  },
  {
    id: 'eau-50cl',
    name: 'Eau minérale 50 cl',
    category: 'boissons',
    price: 1.5,
    emoji: '💧',
    tags: [],
    description: 'Plate ou pétillante.',
    options: [],
  },
];

/* Codes promo acceptés au moment de la commande */
const PROMO_CODES = {
  BIENVENUE10: { type: 'percent', value: 10, label: '-10 % offre de bienvenue' },
  CLICK5: { type: 'amount', value: 5, min: 30, label: '-5 € dès 30 € de commande' },
  ETUDIANT: { type: 'percent', value: 15, label: '-15 % tarif étudiant' },
};

/* ==========================================================================
   COMMANDE EN LIGNE — quel système reçoit les commandes ?

   mode: 'maison'  (réglage actuel)
     Le tunnel de commande intégré au site est actif : panier, choix du
     créneau de retrait calculé sur vos horaires réels, coordonnées du
     client, puis envoi de la commande complète par WhatsApp sur le numéro
     du restaurant (voir ORDER_ROUTING juste en dessous). Rien à payer,
     aucun abonnement.

   mode: 'lightspeed'
     À utiliser le jour où vous aurez VOTRE propre lien de commande en
     ligne (Lightspeed Order Anywhere, Zelty, Popina, Deliveroo…) : collez
     l'adresse dans lightspeedUrl et passez mode à 'lightspeed'. Tous les
     boutons « Commander » du site ouvriront alors votre boutique, et les
     commandes tomberont directement dans votre caisse.

   Attention : lightspeedUrl doit être VOTRE adresse de commande. Un lien
   appartenant à un autre restaurant enverrait vos clients chez lui.
   Tant que le champ est vide, le site reste en mode 'maison'.
   ========================================================================== */
const ORDERING = {
  mode: 'maison',
  lightspeedUrl: '',
  /* Texte des boutons d'appel à l'action */
  ctaLabel: 'Commander en ligne',
};

/* ==========================================================================
   ACHEMINEMENT DES COMMANDES
   Le site est 100 % statique : il n'y a pas de serveur pour « pousser » la
   commande vers la caisse. Deux canaux sont donc prévus.

   1. whatsapp  — canal principal, fonctionne immédiatement.
      À la validation, WhatsApp s'ouvre avec la commande entièrement rédigée
      (numéro, créneau, articles, options, total, coordonnées). Le client
      n'a plus qu'à appuyer sur « Envoyer ». Vous recevez le message sur le
      téléphone du restaurant ou sur WhatsApp Web ouvert sur la caisse.
      Format : indicatif pays sans + ni espaces.

   2. webhookUrl — optionnel, à remplir le jour où vous voulez une réception
      automatique : collez ici l'URL d'un Google Apps Script, Make, Zapier
      ou n8n. Chaque commande y est envoyée en JSON (POST) dès la
      validation, sans action du client. C'est ce webhook qui peut ensuite
      imprimer le ticket, notifier la caisse ou envoyer le WhatsApp.
      Laissé vide = désactivé.
   ========================================================================== */
const ORDER_ROUTING = {
  /* Numéro qui reçoit les commandes click and collect. Il peut être
     différent du numéro public affiché sur le site (RESTAURANT.phone) :
     celui-ci sert à joindre le restaurant, celui-là à recevoir les tickets.
     Format : indicatif pays sans + ni espaces. */
  whatsapp: '33749307070',
  webhookUrl: '',
  /* Copie de courtoisie par e-mail (lien mailto affiché en secours) */
  email: '',
};

/* ==========================================================================
   RÉSEAUX SOCIAUX & REELS
   Renseignez vos comptes : les liens n'apparaissent sur le site que si la
   valeur est remplie (pas de lien mort).
   ========================================================================== */
const SOCIAL = {
  instagram: '',   // ex. 'https://www.instagram.com/dilemme.villiers/'
  tiktok: '',      // ex. 'https://www.tiktok.com/@dilemme.villiers'
  facebook: '',
  googleReview: '', // lien « laisser un avis » Google, pour la fiche établissement
};

/* Vidéos verticales mises en avant sur l'accueil.
   Deux façons de renseigner une vidéo :
     · type 'video'     → src : un fichier .mp4 déposé dans assets/video/
                          (lecture directe sur le site, sans quitter la page)
     · type 'instagram' → url : le lien du reel (ouvre Instagram)
   poster : nom de base d'une image de assets/img/ (aperçu affiché).
   Une entrée sans src ni url est simplement ignorée : la section affiche
   alors la galerie photo. */
const REELS = [
  { type: 'video', src: '', poster: 'le-dz', title: 'Le DZ, à la découpe' },
  { type: 'video', src: '', poster: 'le-black-angus', title: 'Black Angus & stracciatella' },
  { type: 'video', src: '', poster: 'le-suisse', title: 'Le Suisse au four' },
  { type: 'video', src: '', poster: 'la-truffe', title: 'La Truffe, montage' },
];

/* Vidéo de présentation, mise en avant sur l'accueil avec son propre lecteur.
   Pour la changer : remplacer le fichier dans assets/video/ et ajuster `src`.
   Laisser src vide masque simplement la section. */
const PRESENTATION = {
  src: 'assets/video/presentation.mp4',
  titre: 'Bienvenue chez Dilemme',
};

/* Photos qui défilent dans le bandeau galerie de l'accueil */
const GALLERY = [
  'le-pesto', 'le-dz', 'la-truffe', 'le-suisse', 'le-black-angus',
  'emince-de-boeuf', 'l-olive', 'le-supreme', 'noix-de-veau', 'tenders-x3',
];
