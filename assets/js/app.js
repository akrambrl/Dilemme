/* ==========================================================================
   DILEMME — moteur du site (aucune dépendance)
   Chargé sur toutes les pages, après data.js. Chaque page s'initialise via
   l'attribut data-page du <body>.

   Sommaire
     1.  Utilitaires
     2.  Horaires & créneaux de retrait
     3.  Prix et options d'un produit
     4.  Panier (persistant)
     5.  En-tête, menu mobile, notifications
     6.  Tiroir panier
     7.  Modale produit
     8.  Page Carte
     9.  Page Accueil / horaires affichés
     10. Page Commande
     11. Page Confirmation
     12. Amorçage
   ========================================================================== */

/* ------------------------------------------------------- 1. Utilitaires */
const STORAGE_CART = 'dilemme.cart.v1';
const STORAGE_ORDER = 'dilemme.order.v1';
const STORAGE_CUSTOMER = 'dilemme.customer.v1';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Prix formaté en euros, à la française : 12,90 € */
function euro(value) {
  return `${(Math.round(value * 100) / 100).toFixed(2).replace('.', ',')} €`;
}

/** Échappe le HTML : tout texte issu des données ou du formulaire passe ici. */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Lecture JSON tolérante du stockage local (navigation privée, quota…) */
function readStore(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    /* stockage indisponible : le site reste utilisable le temps de la visite */
  }
}

const productById = (id) => PRODUCTS.find((p) => p.id === id);

/* ------------------------------------------------------ Mode de commande
   'lightspeed' : les commandes partent vers la boutique Lightspeed, qui les
   envoie dans la caisse. Le panier intégré est alors désactivé.
   'maison'     : panier + créneau + envoi WhatsApp gérés par ce site. */
const isLightspeed = () =>
  typeof ORDERING !== 'undefined' && ORDERING.mode === 'lightspeed' && !!ORDERING.lightspeedUrl;

const orderCtaLabel = () =>
  (typeof ORDERING !== 'undefined' && ORDERING.ctaLabel) || 'Commander';

/** Applique la bonne destination à tous les boutons « Commander » du site. */
function wireOrderCtas() {
  $$('[data-order-cta]').forEach((el) => {
    if (isLightspeed()) {
      el.href = ORDERING.lightspeedUrl;
      el.target = '_blank';
      el.rel = 'noopener';
    } else {
      el.href = el.dataset.orderCta === 'checkout' ? 'commande.html' : 'carte.html';
      el.removeAttribute('target');
    }
    if (el.dataset.orderCtaLabel !== 'keep') el.textContent = orderCtaLabel();
  });

  /* En mode Lightspeed, le panier intégré n'a plus lieu d'être. */
  if (isLightspeed()) {
    $$('[data-cart-open]').forEach((el) => el.remove());
    $('#cartbar')?.remove();
    $('#cart')?.remove();
  }
}

/** Un groupe d'options peut être nommé (clé de OPTION_GROUPS) ou défini en ligne. */
function resolveGroups(product) {
  return (product.options || [])
    .map((entry) => (typeof entry === 'string' ? OPTION_GROUPS[entry] : entry))
    .filter(Boolean);
}

/* --------------------------------------- 2. Horaires & créneaux de retrait */
const SLOT_STEP_MINUTES = 15;   // granularité des créneaux
const LAST_ORDER_MARGIN = 15;   // dernier créneau avant la fermeture
const DAYS_AHEAD = 6;           // nombre de jours proposés en plus d'aujourd'hui

function minutesFromHM(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function hmFromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const rangesForDay = (weekday) => OPENING_HOURS[weekday] || null;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Le restaurant est-il ouvert à cet instant précis ? */
function isOpenAt(date = new Date()) {
  const ranges = rangesForDay(date.getDay());
  if (!ranges) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return ranges.some((r) => now >= minutesFromHM(r.open) && now < minutesFromHM(r.close));
}

/** Prochaine ouverture : { date, label } ou null si rien dans les 7 jours. */
function nextOpening(from = new Date()) {
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = startOfDay(from);
    day.setDate(day.getDate() + offset);
    const ranges = rangesForDay(day.getDay());
    if (!ranges) continue;
    const nowMinutes = from.getHours() * 60 + from.getMinutes();
    for (const range of ranges) {
      const open = minutesFromHM(range.open);
      if (offset > 0 || open > nowMinutes) {
        const when = new Date(day);
        when.setMinutes(open);
        let label;
        if (offset === 0) label = `aujourd’hui à ${range.open}`;
        else if (offset === 1) label = `demain à ${range.open}`;
        else label = `${DAY_NAMES[day.getDay()].toLowerCase()} à ${range.open}`;
        return { date: when, label };
      }
    }
  }
  return null;
}

/** Libellé court d'une date : « Aujourd’hui », « Demain », « Sam. 30 août ». */
function dayLabel(date, offset) {
  if (offset === 0) return 'Aujourd’hui';
  if (offset === 1) return 'Demain';
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Créneaux de retrait disponibles pour un jour donné.
 * Aujourd'hui : on part de maintenant + temps de préparation, arrondi au
 * quart d'heure suivant. Les autres jours : toute la plage d'ouverture.
 */
function slotsForOffset(offset, now = new Date()) {
  const day = startOfDay(now);
  day.setDate(day.getDate() + offset);
  const ranges = rangesForDay(day.getDay());
  if (!ranges) return [];

  let earliest = 0;
  if (offset === 0) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes() + RESTAURANT.prepMinutes;
    earliest = Math.ceil(nowMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
  }

  const slots = [];
  ranges.forEach((range) => {
    const open = minutesFromHM(range.open);
    const close = minutesFromHM(range.close) - LAST_ORDER_MARGIN;
    let t = Math.max(open, earliest);
    t = Math.ceil(t / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
    for (; t <= close; t += SLOT_STEP_MINUTES) slots.push(hmFromMinutes(t));
  });
  return slots;
}

/** Les jours proposés au client, avec leurs créneaux. */
function pickupDays(now = new Date()) {
  const days = [];
  for (let offset = 0; offset <= DAYS_AHEAD; offset += 1) {
    const date = startOfDay(now);
    date.setDate(date.getDate() + offset);
    const slots = slotsForOffset(offset, now);
    days.push({
      offset,
      date,
      iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      label: dayLabel(date, offset),
      sub: rangesForDay(date.getDay())
        ? rangesForDay(date.getDay()).map((r) => `${r.open}–${r.close}`).join(' · ')
        : 'Fermé',
      closed: !rangesForDay(date.getDay()),
      slots,
    });
  }
  return days;
}

/* ------------------------------------------ 3. Prix et options d'un produit */
/**
 * Calcule le prix unitaire et le détail lisible d'une sélection d'options.
 * selection : { groupId: [choiceId, …] }
 * Règles supportées : prix par choix, max, freeUpTo + extraPrice.
 */
function priceSelection(product, selection) {
  let price = product.price;
  const details = [];

  resolveGroups(product).forEach((group) => {
    const picked = selection[group.id] || [];
    if (!picked.length) return;

    const labels = [];
    let paidCount = 0;

    picked.forEach((choiceId, index) => {
      const choice = group.choices.find((c) => c.id === choiceId);
      if (!choice) return;
      let add = choice.price || 0;
      /* Au-delà du nombre inclus, chaque choix supplémentaire est facturé */
      if (group.freeUpTo != null && index >= group.freeUpTo) {
        add += group.extraPrice || 0;
        paidCount += 1;
      }
      price += add;
      labels.push(add > 0 ? `${choice.label} (+${euro(add)})` : choice.label);
    });

    if (labels.length) details.push({ group: group.label, values: labels, paidCount });
  });

  return { price: Math.round(price * 100) / 100, details };
}

/** Sélection par défaut : premier choix des groupes obligatoires. */
function defaultSelection(product) {
  const selection = {};
  resolveGroups(product).forEach((group) => {
    /* le premier choix encore disponible, jamais un choix épuisé */
    const premier = group.choices.find((c) => optionDisponible(c.id));
    if (group.type === 'single' && group.required && premier) {
      selection[group.id] = [premier.id];
    } else {
      selection[group.id] = [];
    }
  });
  return selection;
}

/** Groupes obligatoires non renseignés — bloque l'ajout au panier. */
function missingRequired(product, selection) {
  return resolveGroups(product)
    .filter((group) => group.required && !(selection[group.id] || []).length)
    .map((group) => group.label);
}

/** Résumé texte des options, pour le panier, le récapitulatif et WhatsApp. */
function selectionSummary(product, selection) {
  return priceSelection(product, selection)
    .details.map((d) => `${d.group} : ${d.values.join(', ')}`);
}


/* --------------------------------------------- 3 bis. Disponibilités
   Ce que le restaurant a, ou n'a plus, à l'instant T. La source est le
   fichier disponibilites.json, relu à chaque visite.

   Principe retenu : en cas d'échec (réseau, fichier absent, JSON invalide),
   tout reste commandable. Un incident technique ne doit jamais faire perdre
   une vente ; à l'inverse, une rupture non signalée se rattrape au comptoir.
   -------------------------------------------------------------------- */
const Dispo = {
  produits: new Set(),
  options: new Set(),
  quantites: {},      // identifiant → portions restantes ; absent = non compté
  message: '',
  chargee: false,
};

async function lireDispo(url, signal) {
  const reponse = await fetch(url, { cache: 'no-store', signal });
  if (!reponse.ok) throw new Error(reponse.status);
  return reponse.json();
}

async function loadDisponibilites() {
  const stop = new AbortController();
  const minuteur = setTimeout(() => stop.abort(), 4000);
  const horodatage = Date.now();
  try {
    let data;
    try {
      /* Source de référence : la page admin écrit ici. */
      data = await lireDispo(`/api/disponibilites?t=${horodatage}`, stop.signal);
    } catch (err) {
      /* Repli : le fichier versionné, qui suffit si l'API n'est pas déployée. */
      data = await lireDispo(`disponibilites.json?t=${horodatage}`, stop.signal);
    }
    Dispo.produits = new Set(data.produitsIndisponibles || []);
    Dispo.options = new Set(data.optionsIndisponibles || []);
    Dispo.quantites = data.quantites || {};
    Dispo.message = data.message || '';
  } catch (err) {
    /* on garde tout disponible, voir le commentaire ci-dessus */
  } finally {
    clearTimeout(minuteur);
    Dispo.chargee = true;
    document.dispatchEvent(new CustomEvent('dispo:change'));
  }
}

/**
 * Portions encore commandables pour un produit.
 * null = produit non compté (stock illimité côté site).
 * Le compteur est tenu à la main par le restaurant : c'est un garde-fou pour
 * la commande en ligne, pas un inventaire — les ventes au comptoir n'y sont
 * pas déduites.
 */
function quantiteRestante(id) {
  const q = Dispo.quantites[id];
  return Number.isInteger(q) ? q : null;
}

/** Portions déjà réservées dans le panier, toutes variantes confondues. */
function dejaAuPanier(productId) {
  return Cart.items
    .filter((l) => l.productId === productId)
    .reduce((n, l) => n + l.qty, 0);
}

/** Un produit épuisé, ou dont le compteur est à zéro, n'est plus commandable. */
const produitDisponible = (id) => !Dispo.produits.has(id) && quantiteRestante(id) !== 0;

/** Un choix d'option épuisé (sauce, viande, boisson) est verrouillé. */
const optionDisponible = (id) => !Dispo.options.has(id);

/**
 * Lignes du panier à corriger avant de commander : produit devenu épuisé, ou
 * quantité supérieure à ce qu'il reste. Le stock ayant pu bouger pendant que
 * le client compose sa commande, on revérifie à chaque affichage.
 */
function lignesACorriger() {
  const vues = {};
  return Cart.items.map((ligne) => {
    if (!produitDisponible(ligne.productId)) return { ligne, raison: 'epuise' };
    const reste = quantiteRestante(ligne.productId);
    if (reste === null) return null;
    /* plusieurs lignes d'un même produit puisent dans le même stock */
    const dejaCompte = vues[ligne.productId] || 0;
    vues[ligne.productId] = dejaCompte + ligne.qty;
    const disponiblePourCetteLigne = Math.max(0, reste - dejaCompte);
    if (ligne.qty > disponiblePourCetteLigne) {
      return { ligne, raison: 'excedent', reste: disponiblePourCetteLigne };
    }
    return null;
  }).filter(Boolean);
}

/* ------------------------------------------------ 4. Panier (persistant) */
const Cart = {
  items: readStore(STORAGE_CART, []),

  save() {
    writeStore(STORAGE_CART, this.items);
    document.dispatchEvent(new CustomEvent('cart:change'));
  },

  /** Clé d'unicité d'une ligne : produit + options choisies. */
  lineKey(productId, selection) {
    const parts = Object.keys(selection)
      .sort()
      .map((g) => `${g}=${(selection[g] || []).slice().sort().join('+')}`)
      .filter((s) => !s.endsWith('='));
    return [productId].concat(parts).join('|');
  },

  add(product, selection, qty = 1) {
    if (!produitDisponible(product.id)) return false;   // garde-fou
    const reste = quantiteRestante(product.id);
    if (reste !== null) {
      const place = reste - dejaAuPanier(product.id);
      if (place <= 0) return false;
      qty = Math.min(qty, place);
    }
    const key = this.lineKey(product.id, selection);
    const existing = this.items.find((line) => line.key === key);
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, 30);
    } else {
      const { price } = priceSelection(product, selection);
      this.items.push({
        key,
        productId: product.id,
        name: product.name,
        emoji: product.emoji || '🥖',
        unitPrice: price,
        qty,
        selection,
        summary: selectionSummary(product, selection),
      });
    }
    this.save();
  },

  setQty(key, qty) {
    const line = this.items.find((l) => l.key === key);
    if (!line) return;
    if (qty <= 0) this.remove(key);
    else {
      line.qty = Math.min(qty, 30);
      this.save();
    }
  },

  remove(key) {
    this.items = this.items.filter((l) => l.key !== key);
    this.save();
  },

  clear() {
    this.items = [];
    this.save();
  },

  count() {
    return this.items.reduce((sum, l) => sum + l.qty, 0);
  },

  subtotal() {
    return Math.round(this.items.reduce((sum, l) => sum + l.unitPrice * l.qty, 0) * 100) / 100;
  },

  /* -------- Code promo -------- */
  promoCode: readStore('dilemme.promo.v1', null),

  applyPromo(code) {
    const clean = String(code || '').trim().toUpperCase();
    const promo = PROMO_CODES[clean];
    if (!promo) return { ok: false, message: 'Ce code n’est pas reconnu.' };
    if (promo.min && this.subtotal() < promo.min) {
      return { ok: false, message: `Ce code est valable à partir de ${euro(promo.min)} de commande.` };
    }
    this.promoCode = clean;
    writeStore('dilemme.promo.v1', clean);
    document.dispatchEvent(new CustomEvent('cart:change'));
    return { ok: true, message: promo.label };
  },

  clearPromo() {
    this.promoCode = null;
    writeStore('dilemme.promo.v1', null);
    document.dispatchEvent(new CustomEvent('cart:change'));
  },

  discount() {
    const promo = this.promoCode && PROMO_CODES[this.promoCode];
    if (!promo) return 0;
    const sub = this.subtotal();
    if (promo.min && sub < promo.min) return 0;
    const value = promo.type === 'percent' ? (sub * promo.value) / 100 : promo.value;
    return Math.round(Math.min(value, sub) * 100) / 100;
  },

  total() {
    return Math.round((this.subtotal() - this.discount()) * 100) / 100;
  },
};

/* ------------------------- 5. En-tête, menu mobile, notifications légères */
function initHeader() {
  const burger = $('#burger');
  const mobileNav = $('#mobile-nav');
  if (burger && mobileNav) {
    burger.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }

  /* Statut ouvert / fermé, partout où la pastille est présente */
  $$('[data-status]').forEach((el) => {
    const open = isOpenAt();
    const next = nextOpening();
    el.classList.toggle('status--closed', !open);
    const dot = '<span class="status__dot" aria-hidden="true"></span>';
    el.innerHTML = open
      ? `${dot}<span>Ouvert · commande jusqu’à ${lastPickupToday()}</span>`
      : `${dot}<span>Fermé · réouverture ${next ? next.label : 'prochainement'}</span>`;
  });
}

function lastPickupToday() {
  const slots = slotsForOffset(0);
  return slots.length ? slots[slots.length - 1] : '—';
}

let toastTimer = null;
function toast(message) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

/* --------------------------------------------------- 6. Tiroir panier */
const CartUI = {
  init() {
    this.drawer = $('#cart');
    this.overlay = $('#overlay');
    this.body = $('#cart-body');
    this.foot = $('#cart-foot');
    if (!this.drawer) return;

    $$('[data-cart-open]').forEach((btn) => btn.addEventListener('click', () => this.open()));
    $$('[data-cart-close]').forEach((btn) => btn.addEventListener('click', () => this.close()));
    this.overlay.addEventListener('click', () => {
      this.close();
      Sheet.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.close(); Sheet.close(); }
    });

    document.addEventListener('cart:change', () => this.render());
    this.render();
  },

  open() {
    if (!this.drawer) return;
    this.drawer.classList.add('is-open');
    this.overlay.classList.add('is-open');
    document.body.classList.add('no-scroll');
    this.drawer.setAttribute('aria-hidden', 'false');
    $('[data-cart-close]', this.drawer)?.focus();
  },

  close() {
    if (!this.drawer) return;
    this.drawer.classList.remove('is-open');
    if (!Sheet.isOpen()) {
      this.overlay.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }
    this.drawer.setAttribute('aria-hidden', 'true');
  },

  render() {
    updateCartCounters();
    if (!this.body) return;

    if (!Cart.items.length) {
      this.body.innerHTML = `
        <div class="empty">
          <div class="empty__emoji" aria-hidden="true">🥖</div>
          <p><strong>Votre panier est vide.</strong></p>
          <p class="text-soft">Chaud ou froid, délicieux sera le choix.</p>
          <a class="btn btn--ghost btn--sm" href="carte.html">Voir la carte</a>
        </div>`;
      this.foot.innerHTML = '';
      return;
    }

    this.body.innerHTML = Cart.items.map((line) => `
      <div class="cart-line">
        <div class="cart-line__thumb" aria-hidden="true">${esc(line.emoji)}</div>
        <div class="cart-line__body">
          <div class="cart-line__title">
            <span>${esc(line.name)}</span>
            <span>${euro(line.unitPrice * line.qty)}</span>
          </div>
          ${line.summary && line.summary.length
            ? `<div class="cart-line__opts">${line.summary.map(esc).join('<br>')}</div>`
            : ''}
          <div class="cart-line__actions">
            <div class="stepper">
              <button type="button" data-qty-down="${esc(line.key)}" aria-label="Retirer un ${esc(line.name)}">−</button>
              <output>${line.qty}</output>
              <button type="button" data-qty-up="${esc(line.key)}" aria-label="Ajouter un ${esc(line.name)}">+</button>
            </div>
            <button type="button" class="cart-line__remove" data-remove="${esc(line.key)}">Supprimer</button>
          </div>
        </div>
      </div>`).join('');

    const discount = Cart.discount();
    this.foot.innerHTML = `
      <div class="totals">
        <div class="totals__row"><span>Sous-total</span><span>${euro(Cart.subtotal())}</span></div>
        ${discount > 0
          ? `<div class="totals__row totals__row--promo">
               <span>Code ${esc(Cart.promoCode)}</span><span>−${euro(discount)}</span>
             </div>`
          : ''}
        <div class="totals__row totals__row--total"><span>Total</span><span>${euro(Cart.total())}</span></div>
      </div>
      <a class="btn btn--block btn--lg" href="commande.html">Commander · retrait sur place</a>
      <p class="field__hint" style="text-align:center">Paiement sur place au retrait · aucun frais</p>`;

    this.body.querySelectorAll('[data-qty-up]').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.qtyUp;
        const line = Cart.items.find((l) => l.key === key);
        Cart.setQty(key, line.qty + 1);
      }));
    this.body.querySelectorAll('[data-qty-down]').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.qtyDown;
        const line = Cart.items.find((l) => l.key === key);
        Cart.setQty(key, line.qty - 1);
      }));
    this.body.querySelectorAll('[data-remove]').forEach((b) =>
      b.addEventListener('click', () => Cart.remove(b.dataset.remove)));
  },
};

function updateCartCounters() {
  const count = Cart.count();
  $$('[data-cart-count]').forEach((el) => {
    el.textContent = count;
    el.classList.toggle('is-visible', count > 0);
  });
  const bar = $('#cartbar');
  if (bar) {
    bar.classList.toggle('is-visible', count > 0);
    const label = count > 1 ? `${count} articles` : `${count} article`;
    $('[data-bar-count]', bar).textContent = label;
    $('[data-bar-total]', bar).textContent = euro(Cart.total());
  }
}

/* --------------------------------------------------- 7. Modale produit */
const Sheet = {
  init() {
    this.el = $('#sheet');
    this.overlay = $('#overlay');
    if (!this.el) return;
    this.head = $('#sheet-head');
    this.body = $('#sheet-body');
    this.foot = $('#sheet-foot');
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-sheet-close]')) this.close();
    });
  },

  isOpen() {
    return this.el && this.el.classList.contains('is-open');
  },

  open(productId) {
    const product = productById(productId);
    if (!product || !this.el) return;

    this.product = product;
    this.selection = defaultSelection(product);
    this.qty = 1;

    this.head.innerHTML = `
      ${product.image ? `<span class="card__thumb${product.imageFit === 'contain' ? ' card__thumb--contain' : ''}" style="width:92px;height:92px">${productImage(product, '92px')}</span>` : ''}
      <div style="flex:1;min-width:0">
        <h2>${esc(product.name)}</h2>
        <p>${esc(product.description || '')}</p>
        ${product.includes ? `<p class="card__includes" style="margin-top:10px">🍟 ${esc(product.includes)}</p>` : ''}
      </div>
      <button type="button" class="sheet__close" data-sheet-close aria-label="Fermer">✕</button>`;

    if (isLightspeed()) this.renderLightspeed();
    else this.renderOptions();
    this.el.classList.add('is-open');
    this.overlay.classList.add('is-open');
    document.body.classList.add('no-scroll');
    this.el.setAttribute('aria-hidden', 'false');
    this.body.scrollTop = 0;
    $('.sheet__close', this.el)?.focus();
  },

  close() {
    if (!this.el) return;
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
    if (!$('#cart')?.classList.contains('is-open')) {
      this.overlay.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }
  },

  /* Fiche produit sans panier : les options et le paiement sont gérés par
     la boutique Lightspeed, on évite donc de les dupliquer ici. */
  renderLightspeed() {
    const product = this.product;
    const groups = resolveGroups(product);
    this.body.innerHTML = `
      ${product.includes ? `<div class="notice" style="margin-bottom:18px"><span aria-hidden="true">🍟</span><span>${esc(product.includes)} inclus dans le prix.</span></div>` : ''}
      ${groups.length ? `
        <h3 style="font-size:1.05rem">Personnalisation disponible</h3>
        <p class="optgroup__hint">Choisissez ${esc(groups.map((g) => g.label.toLowerCase()).join(', '))} au moment de la commande.</p>
        <div class="optlist">
          ${groups.map((g) => `
            <div class="opt" style="cursor:default">
              <span class="opt__label"><strong>${esc(g.label)}</strong><br>
                <span class="text-soft" style="font-size:.86rem">${esc(g.choices.map((c) => c.label).join(' · '))}</span>
              </span>
            </div>`).join('')}
        </div>` : '<p class="text-soft">Prêt à emporter, sans option à choisir.</p>'}`;

    this.foot.innerHTML = `
      <span class="card__price" style="margin-right:auto">${euro(product.price)}</span>
      <a class="btn" href="${esc(ORDERING.lightspeedUrl)}" target="_blank" rel="noopener">
        ${esc(orderCtaLabel())}
      </a>`;
  },

  renderOptions() {
    const product = this.product;
    const groups = resolveGroups(product);

    this.body.innerHTML = groups.length
      ? groups.map((group) => {
          const picked = this.selection[group.id] || [];
          const atMax = group.type === 'multi' && group.max != null && picked.length >= group.max;
          return `
            <fieldset class="optgroup" style="border:0;margin-inline:0;padding:0">
              <div class="optgroup__head">
                <h3>${esc(group.label)}</h3>
                ${group.required ? '<span class="optgroup__req">Obligatoire</span>' : ''}
              </div>
              ${group.hint ? `<p class="optgroup__hint">${esc(group.hint)}</p>` : ''}
              <div class="optlist">
                ${group.choices.map((choice) => {
                  const checked = picked.includes(choice.id);
                  const overflow = group.freeUpTo != null && !checked && picked.length >= group.freeUpTo;
                  const shown = (choice.price || 0) + (overflow ? group.extraPrice || 0 : 0);
                  const epuise = !optionDisponible(choice.id);
                  const disabled = epuise || (group.type === 'multi' && atMax && !checked);
                  return `
                    <label class="opt${epuise ? ' opt--epuise' : ''}">
                      <input type="${group.type === 'single' ? 'radio' : 'checkbox'}"
                             name="${esc(group.id)}"
                             value="${esc(choice.id)}"
                             ${checked && !epuise ? 'checked' : ''}
                             ${disabled ? 'disabled' : ''}>
                      <span class="opt__label">${esc(choice.label)}</span>
                      ${epuise
                        ? '<span class="opt__price" style="color:var(--brick-600)">épuisé</span>'
                        : shown > 0 ? `<span class="opt__price">+${euro(shown)}</span>` : ''}
                    </label>`;
                }).join('')}
              </div>
            </fieldset>`;
        }).join('')
      : '<p class="text-soft">Aucune option à choisir pour ce produit.</p>';

    this.body.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        const groupId = input.name;
        const group = groups.find((g) => g.id === groupId);
        if (group.type === 'single') {
          this.selection[groupId] = [input.value];
        } else {
          const list = this.selection[groupId] || [];
          if (input.checked) {
            if (group.max != null && list.length >= group.max) { input.checked = false; return; }
            this.selection[groupId] = list.concat(input.value);
          } else {
            this.selection[groupId] = list.filter((v) => v !== input.value);
          }
        }
        this.renderOptions();   // reprix + verrous à jour
      });
    });

    this.renderFoot();
  },

  renderFoot() {
    const { price } = priceSelection(this.product, this.selection);
    const missing = missingRequired(this.product, this.selection);
    const epuise = !produitDisponible(this.product.id);

    if (epuise) {
      this.foot.innerHTML = `
        <div class="notice notice--error" style="width:100%">
          <span aria-hidden="true">✕</span>
          <span><strong>Indisponible aujourd’hui.</strong> Ce produit est épuisé, il revient dès le prochain service.</span>
        </div>`;
      return;
    }
    /* Plafond : ce qu'il reste, moins ce que le panier réserve déjà. */
    const reste = quantiteRestante(this.product.id);
    const maxi = reste === null ? 30 : Math.max(1, Math.min(30, reste - dejaAuPanier(this.product.id)));
    if (this.qty > maxi) this.qty = maxi;

    this.foot.innerHTML = `
      <div class="stepper">
        <button type="button" data-sheet-minus aria-label="Diminuer la quantité" ${this.qty <= 1 ? 'disabled' : ''}>−</button>
        <output>${this.qty}</output>
        <button type="button" data-sheet-plus aria-label="Augmenter la quantité" ${this.qty >= maxi ? 'disabled' : ''}>+</button>
      </div>
      <button type="button" class="btn btn--block" data-sheet-add ${missing.length ? 'disabled' : ''}>
        ${missing.length ? `Choisir : ${esc(missing[0])}` : `Ajouter · ${euro(price * this.qty)}`}
      </button>`;

    $('[data-sheet-minus]', this.foot).addEventListener('click', () => {
      this.qty = Math.max(1, this.qty - 1);
      this.renderFoot();
    });
    $('[data-sheet-plus]', this.foot).addEventListener('click', () => {
      this.qty = Math.min(maxi, this.qty + 1);
      this.renderFoot();
    });
    const add = $('[data-sheet-add]', this.foot);
    if (!missing.length) {
      add.addEventListener('click', () => {
        Cart.add(this.product, this.selection, this.qty);
        this.close();
        toast(`${this.product.name} ajouté au panier`);
      });
    }
  },
};

/* ------------------------------------------------------- 8. Page Carte */
/** Texte alternatif utile aux lecteurs d'écran et au référencement images. */
function productAlt(product) {
  const cat = CATEGORIES.find((c) => c.id === product.category);
  return `${product.name} — ${cat ? cat.label.toLowerCase() : 'spécialité'} chez Dilemme à Villiers-sur-Marne`;
}

/**
 * Image d'un produit en deux tailles (srcset) : la version -sm sur mobile,
 * la version pleine sur grand écran. Si le fichier manque, onerror retire
 * la balise et la vignette émoji reprend sa place.
 */
function productImage(product, sizes = '(min-width: 900px) 320px, 96px') {
  if (!product.image) return '';
  const base = `assets/img/${product.image}`;
  const ext = product.imageExt || 'jpg';
  const commun = `alt="${esc(productAlt(product))}" loading="lazy" decoding="async" onerror="this.remove()"`;

  /* Les visuels détourés (bouteilles) sont affichés en entier, sans recadrage,
     et servis en une seule taille : ils sont déjà très légers. */
  if (product.imageFit === 'contain') {
    return `<img src="${esc(base)}.${esc(ext)}" ${commun}>`;
  }
  return `<img src="${esc(base)}.${esc(ext)}"
       srcset="${esc(base)}-sm.${esc(ext)} 480w, ${esc(base)}.${esc(ext)} 900w"
       sizes="${esc(sizes)}"
       ${commun}>`;
}

function productCard(product) {
  const tag = product.tags && product.tags.length ? product.tags[0] : null;
  const tagClass = { 'best-seller': 'tag--brick', signature: 'tag', végé: 'tag--sage', piquant: 'tag--brick', 'à composer': 'tag--amber', nouveau: 'tag--amber' }[tag] || 'tag--soft';
  const epuise = !produitDisponible(product.id);
  const reste = quantiteRestante(product.id);
  /* On n'affiche le compteur qu'en fin de stock : au-delà, l'information
     n'apporte rien au client et vieillit mal. */
  const finDeStock = !epuise && reste !== null && reste <= 5;
  return `
    <button type="button" class="card${epuise ? ' card--epuise' : ''}" data-product="${esc(product.id)}">
      <span class="card__thumb${product.imageFit === 'contain' ? ' card__thumb--contain' : ''}">
        ${epuise
          ? '<span class="card__badge tag tag--brick">Épuisé</span>'
          : finDeStock
            ? `<span class="card__badge tag tag--amber">Plus que ${reste}</span>`
            : tag ? `<span class="card__badge tag ${tagClass}">${esc(tag)}</span>` : ''}
        ${productImage(product)}
        ${product.image ? '' : `<span aria-hidden="true">${product.emoji || '🥖'}</span>`}
      </span>
      <span class="card__body">
        <span class="card__title"><h3>${esc(product.name)}</h3></span>
        <span class="card__desc">${esc(product.description || '')}</span>
        ${product.includes ? `<span class="card__includes">🍟 ${esc(product.includes)}</span>` : ''}
        <span class="card__foot">
          <span class="card__price">${euro(product.price)}${product.includes ? '<small>menu complet</small>' : ''}</span>
          <span class="card__add">${epuise ? 'Indisponible' : isLightspeed() ? 'Commander' : 'Ajouter'}</span>
        </span>
      </span>
    </button>`;
}

function initCartePage() {
  const root = $('#menu-root');
  const chipsRoot = $('#catnav');
  const search = $('#menu-search');
  if (!root) return;

  function render(filter = '') {
    const term = filter.trim().toLowerCase();
    const blocks = CATEGORIES.map((cat) => {
      const items = PRODUCTS.filter((p) => p.category === cat.id).filter((p) => {
        if (!term) return true;
        return `${p.name} ${p.description || ''}`.toLowerCase().includes(term);
      });
      if (!items.length) return '';
      return `
        <section class="cat-block cat-block--${esc(cat.id)}" id="cat-${esc(cat.id)}">
          <div class="cat-block__head">
            <span class="cat-block__icon" aria-hidden="true">${esc(cat.icon)}</span>
            <h2>${esc(cat.label)}</h2>
          </div>
          ${cat.note ? `<p class="cat-block__note">✦ ${esc(cat.note)}</p>` : ''}
          <div class="grid-products">${items.map(productCard).join('')}</div>
        </section>`;
    }).join('');

    root.innerHTML = blocks || `
      <p class="no-result">Aucun produit ne correspond à « ${esc(filter)} ».<br>
      <button type="button" class="btn btn--ghost btn--sm" data-reset-search style="margin-top:14px">Voir toute la carte</button></p>`;

    root.querySelectorAll('[data-product]').forEach((card) =>
      card.addEventListener('click', () => Sheet.open(card.dataset.product)));
    root.querySelectorAll('[data-reset-search]').forEach((b) =>
      b.addEventListener('click', () => { search.value = ''; render(''); }));
  }

  /* Puces de catégories */
  if (chipsRoot) {
    chipsRoot.innerHTML = CATEGORIES.map((cat, i) => `
      <a class="chip${i === 0 ? ' is-active' : ''}" href="#cat-${esc(cat.id)}">
        <span aria-hidden="true">${esc(cat.icon)}</span>${esc(cat.label)}
      </a>`).join('');
  }

  if (search) {
    search.addEventListener('input', () => render(search.value));
  }

  /* Les disponibilités arrivent après le premier affichage : on réaffiche. */
  document.addEventListener('dispo:change', () => {
    render(search ? search.value : '');
    const hote = $('#dispo-message');
    if (hote) {
      hote.innerHTML = Dispo.message
        ? `<div class="notice notice--warn"><span aria-hidden="true">ℹ</span><span>${esc(Dispo.message)}</span></div>`
        : '';
    }
  });

  render(new URLSearchParams(location.search).get('q') || '');
  if (search) search.value = new URLSearchParams(location.search).get('q') || '';

  /* Surlignage de la catégorie visible */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id.replace('cat-', '');
      $$('.chip', chipsRoot).forEach((chip) =>
        chip.classList.toggle('is-active', chip.getAttribute('href') === `#cat-${id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('.cat-block').forEach((block) => observer.observe(block));

  /* Ouverture directe d'un produit via ?p=id */
  const wanted = new URLSearchParams(location.search).get('p');
  if (wanted && productById(wanted)) Sheet.open(wanted);
}

/* -------------------------------- 9. Horaires affichés (accueil, infos) */
function initHoursList() {
  $$('[data-hours]').forEach((list) => {
    const today = new Date().getDay();
    /* Semaine affichée du lundi au dimanche */
    const order = [1, 2, 3, 4, 5, 6, 0];
    list.innerHTML = order.map((weekday) => {
      const ranges = rangesForDay(weekday);
      const isToday = weekday === today;
      const cls = [isToday ? 'is-today' : '', ranges ? '' : 'is-closed'].filter(Boolean).join(' ');
      const value = ranges ? ranges.map((r) => `${r.open} – ${r.close}`).join(' · ') : 'Fermé';
      return `<li class="${cls}"><span class="day">${DAY_NAMES[weekday]}${isToday ? ' · aujourd’hui' : ''}</span><span>${value}</span></li>`;
    }).join('');
  });

  document.addEventListener('dispo:change', initHighlights);
  initHighlights();
}

function initHighlights() {
  $$('[data-highlights]').forEach((root) => {
    const picks = PRODUCTS.filter((p) => (p.tags || []).includes('best-seller') || (p.tags || []).includes('signature')).slice(0, 6);
    root.innerHTML = picks.map(productCard).join('');
    root.querySelectorAll('[data-product]').forEach((card) =>
      card.addEventListener('click', () => {
        location.href = `carte.html?p=${encodeURIComponent(card.dataset.product)}`;
      }));
  });
}


/* ------------------------------------- 11 bis. Reels, galerie, réseaux */

function initReels() {
  const root = $('#reels-root');
  if (!root || typeof REELS === 'undefined') return;

  /* Toutes les entrées sont affichées : celles qui portent une source sont
     cliquables (lecture ou Instagram), les autres restent de simples visuels.
     Aucun bouton ne mène donc à une vidéo inexistante. */
  const entries = REELS.filter((r) => r.poster || r.src || r.url);
  if (!entries.length) { root.closest('section')?.remove(); return; }

  root.innerHTML = entries.map((reel, i) => {
    const jouable = (reel.type === 'video' && reel.src) || (reel.type === 'instagram' && reel.url);
    const poster = reel.poster || 'hero-01';
    const media = `
      <img src="assets/img/${esc(poster)}.jpg"
           srcset="assets/img/${esc(poster)}-sm.jpg 480w, assets/img/${esc(poster)}.jpg 900w"
           sizes="(min-width: 760px) 280px, 45vw"
           alt="${esc(reel.title || 'Spécialité Dilemme')}" loading="lazy" decoding="async">
      ${jouable ? `<span class="reel__badge">${reel.type === 'instagram' ? 'Instagram' : 'Vidéo'}</span>
      <span class="reel__play" aria-hidden="true">▶</span>` : ''}
      <span class="reel__title">${esc(reel.title || '')}</span>`;

    return jouable
      ? `<button type="button" class="reel" data-reel="${i}"
                 aria-label="Lire la vidéo : ${esc(reel.title || 'Dilemme')}">${media}</button>`
      : `<figure class="reel" style="cursor:default;margin:0">${media}</figure>`;
  }).join('');

  root.querySelectorAll('[data-reel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const reel = entries[Number(btn.dataset.reel)];
      if (reel.type === 'instagram') window.open(reel.url, '_blank', 'noopener');
      else openVideo(reel.src, reel.poster);
    });
  });
}

function openVideo(src, poster) {
  let box = $('#lightbox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'lightbox';
    box.className = 'lightbox';
    box.innerHTML = `
      <button type="button" class="lightbox__close" aria-label="Fermer la vidéo">✕</button>
      <video controls playsinline preload="none"></video>`;
    document.body.appendChild(box);
    box.addEventListener('click', (e) => {
      if (e.target === box || e.target.closest('.lightbox__close')) closeVideo();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeVideo(); });
  }
  const video = $('video', box);
  video.src = src;
  if (poster) video.poster = `assets/img/${poster}.jpg`;
  box.classList.add('is-open');
  document.body.classList.add('no-scroll');
  video.play().catch(() => {});
}

function closeVideo() {
  const box = $('#lightbox');
  if (!box) return;
  const video = $('video', box);
  video.pause();
  video.removeAttribute('src');
  box.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
}

function initGallery() {
  const track = $('#gallery-track');
  if (!track || typeof GALLERY === 'undefined') return;
  const cards = GALLERY.map((name) => `
    <figure>
      <img src="assets/img/${esc(name)}-sm.jpg" alt="Spécialité Dilemme à Villiers-sur-Marne"
           loading="lazy" decoding="async" width="480" height="270">
    </figure>`).join('');
  /* dupliqué une fois : l'animation boucle sans saut visible */
  track.innerHTML = cards + cards;
}

function initSocial() {
  if (typeof SOCIAL === 'undefined') return;
  $$('[data-social]').forEach((el) => {
    const url = SOCIAL[el.dataset.social];
    if (url) el.href = url;
    else el.remove();   // pas de lien mort sur le site
  });
}


/* ------------------------------- 11 quater. Couverture vidéo du héros */

/**
 * Installe la vidéo de présentation en fond du héros.
 * La photo reste l'image d'attente : affichage net immédiat, puis la vidéo
 * prend le relais en fondu. Lecture automatique muette (seule autorisée par
 * les navigateurs), sauf si le visiteur a demandé moins d'animations ou
 * l'économiseur de données — dans ce cas la photo reste et un bouton propose
 * la lecture.
 */
function initHeroVideo() {
  const hote = $('#hero-media');
  const bouton = $('#hero-sound');
  if (!hote || typeof PRESENTATION === 'undefined' || !PRESENTATION.src) return;

  const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const economie = navigator.connection && navigator.connection.saveData;

  const video = document.createElement('video');
  video.src = PRESENTATION.src + '#t=0.1';   /* affiche une image dès le départ */
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = sobre || economie ? 'none' : 'metadata';
  video.poster = 'assets/img/hero-01.jpg';
  video.setAttribute('aria-label', PRESENTATION.titre || 'Vidéo de présentation du restaurant');
  video.tabIndex = -1;
  hote.appendChild(video);

  video.addEventListener('playing', () => video.classList.add('is-ready'));
  video.addEventListener('pause', majBouton);
  video.addEventListener('play', majBouton);

  function majBouton() {
    if (!bouton) return;
    bouton.hidden = false;
    const enLecture = !video.paused && !video.ended;
    if (!enLecture) {
      bouton.textContent = '▶ Lire la vidéo';
      bouton.setAttribute('aria-pressed', 'false');
    } else if (video.muted) {
      bouton.textContent = '🔇 Activer le son';
      bouton.setAttribute('aria-pressed', 'false');
    } else {
      bouton.textContent = '🔊 Couper le son';
      bouton.setAttribute('aria-pressed', 'true');
    }
  }

  if (bouton) {
    bouton.addEventListener('click', () => {
      if (video.paused) {
        video.muted = false;
        video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
      } else {
        video.muted = !video.muted;
      }
      majBouton();
    });
  }

  if (!sobre && !economie) {
    const essai = video.play();
    if (essai && essai.catch) essai.catch(majBouton);   /* lecture refusée : on propose le bouton */
  }
  majBouton();
}

/* --------------------------------------------------- 10. Page Commande */
function initCommandePage() {
  const form = $('#order-form');
  if (!form) return;

  /* En mode Lightspeed, la commande se finalise sur la boutique : on remplace
     le tunnel maison par un renvoi clair plutôt que deux parcours en double. */
  if (isLightspeed()) {
    const host = $('#checkout-root');
    if (host) {
      host.innerHTML = `
        <div class="panel panel--accent" style="text-align:center;max-width:620px;margin-inline:auto">
          <div class="medallion" style="margin:0 auto 18px" aria-hidden="true">🛍️</div>
          <h2>Commander pour un retrait</h2>
          <p class="text-soft">La commande et le paiement se font sur notre boutique en ligne
          sécurisée : vous choisissez vos produits, votre créneau de retrait, et la commande
          arrive directement en cuisine.</p>
          <a class="btn btn--lg btn--block" href="${esc(ORDERING.lightspeedUrl)}" target="_blank" rel="noopener">
            ${esc(orderCtaLabel())}
          </a>
          <div class="leaf-divider" aria-hidden="true">🌿</div>
          <p class="field__hint">Une question sur une commande ?
            <a href="tel:${esc(RESTAURANT.phoneLink)}" style="text-decoration:underline">${esc(RESTAURANT.phone)}</a>
          </p>
        </div>`;
    }
    return;
  }

  const daysRoot = $('#pickup-days');
  const slotsRoot = $('#pickup-slots');
  const summaryRoot = $('#order-summary');
  const days = pickupDays();
  const firstOpen = days.find((d) => d.slots.length);

  const state = {
    dayIso: firstOpen ? firstOpen.iso : null,
    slot: null,
    asap: false,
  };

  /* Pré-remplissage des coordonnées connues */
  const saved = readStore(STORAGE_CUSTOMER, null);
  if (saved) {
    ['name', 'phone', 'email'].forEach((k) => {
      const input = form.elements[k];
      if (input && saved[k]) input.value = saved[k];
    });
  }

  function renderDays() {
    daysRoot.innerHTML = days.map((day) => `
      <button type="button" class="daychip${day.iso === state.dayIso ? ' is-active' : ''}"
              data-day="${day.iso}" ${day.slots.length ? '' : 'disabled'}>
        <strong>${esc(day.label)}</strong>
        <span>${esc(day.closed ? 'Fermé' : day.slots.length ? day.sub : 'Complet')}</span>
      </button>`).join('');

    daysRoot.querySelectorAll('[data-day]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.dayIso = btn.dataset.day;
        state.slot = null;
        state.asap = false;
        renderDays();
        renderSlots();
      }));
  }

  function renderSlots() {
    const day = days.find((d) => d.iso === state.dayIso);
    if (!day || !day.slots.length) {
      slotsRoot.innerHTML = `<div class="notice notice--warn">🕒 Aucun créneau disponible ce jour-là. Choisissez un autre jour.</div>`;
      return;
    }
    const canAsap = day.offset === 0 && isOpenAt();
    slotsRoot.innerHTML = `
      ${canAsap ? `<div class="slots"><button type="button" class="slot slot--asap${state.asap ? ' is-active' : ''}" data-asap>
        ⚡ Dès que possible · prêt vers ${esc(day.slots[0])} (~${RESTAURANT.prepMinutes} min)
      </button></div>` : ''}
      <div class="slots">
        ${day.slots.map((slot) => `
          <button type="button" class="slot${!state.asap && state.slot === slot ? ' is-active' : ''}" data-slot="${esc(slot)}">${esc(slot)}</button>`).join('')}
      </div>`;

    slotsRoot.querySelectorAll('[data-slot]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.slot = btn.dataset.slot;
        state.asap = false;
        renderSlots();
        clearError('slot');
      }));
    const asapBtn = $('[data-asap]', slotsRoot);
    if (asapBtn) asapBtn.addEventListener('click', () => {
      state.asap = true;
      state.slot = day.slots[0];
      renderSlots();
      clearError('slot');
    });
  }

  function renderSummary() {
    if (!Cart.items.length) {
      summaryRoot.innerHTML = `
        <div class="empty">
          <div class="empty__emoji" aria-hidden="true">🥖</div>
          <p><strong>Votre panier est vide.</strong></p>
          <a class="btn btn--ghost btn--sm" href="carte.html">Composer ma commande</a>
        </div>`;
      $('#submit-order').disabled = true;
      return;
    }
    const aCorriger = lignesACorriger();
    $('#submit-order').disabled = aCorriger.length > 0;
    const discount = Cart.discount();
    summaryRoot.innerHTML = `
      ${aCorriger.length ? `
        <div class="notice notice--error" style="margin-bottom:16px">
          <span aria-hidden="true">✕</span>
          <span><strong>Votre panier doit être ajusté :</strong><br>
          ${aCorriger.map((c) => c.raison === 'epuise'
            ? `${esc(c.ligne.name)} — épuisé`
            : `${esc(c.ligne.name)} — il n’en reste que ${c.reste}`).join('<br>')}
          <br><button type="button" class="cart-line__remove" data-corriger-panier>Corriger le panier</button></span>
        </div>` : ''}
      <div class="summary__lines">
        ${Cart.items.map((line) => `
          <div class="summary__line">
            <span><span class="summary__qty">${line.qty}×</span> ${esc(line.name)}</span>
            <span>${euro(line.unitPrice * line.qty)}</span>
          </div>`).join('')}
      </div>
      <div class="totals">
        <div class="totals__row"><span>Sous-total</span><span>${euro(Cart.subtotal())}</span></div>
        ${discount > 0 ? `<div class="totals__row totals__row--promo"><span>Code ${esc(Cart.promoCode)}</span><span>−${euro(discount)}</span></div>` : ''}
        <div class="totals__row totals__row--total"><span>Total</span><span>${euro(Cart.total())}</span></div>
      </div>`;
  }

  /* Code promo */
  const promoForm = $('#promo-form');
  if (promoForm) {
    promoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#promo-input');
      const feedback = $('#promo-feedback');
      const result = Cart.applyPromo(input.value);
      feedback.className = result.ok ? 'notice' : 'notice notice--error';
      feedback.textContent = result.ok ? `✓ ${result.message}` : result.message;
      feedback.hidden = false;
      if (result.ok) input.value = '';
    });
  }

  function setError(name, message) {
    const field = form.querySelector(`[data-field="${name}"]`);
    if (!field) return;
    field.classList.add('has-error');
    const err = $('.field__error', field);
    if (err) err.textContent = message;
  }

  function clearError(name) {
    const field = form.querySelector(`[data-field="${name}"]`);
    if (field) field.classList.remove('has-error');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!Cart.items.length) return;

    /* Un produit peut devenir indisponible pendant que le client remplit le
       formulaire : on revérifie juste avant l'envoi. */
    const indisponibles = lignesACorriger();
    if (indisponibles.length) {
      renderSummary();
      summaryRoot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    ['name', 'phone', 'email', 'slot', 'consent'].forEach(clearError);
    let firstError = null;
    const data = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      email: form.elements.email.value.trim(),
      note: form.elements.note.value.trim(),
      payment: form.elements.payment.value,
    };

    if (data.name.length < 2) { setError('name', 'Indiquez le prénom qui sera annoncé au retrait.'); firstError = firstError || 'name'; }
    if (!/^(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}$/.test(data.phone)) {
      setError('phone', 'Numéro invalide. Exemple : 06 12 34 56 78.');
      firstError = firstError || 'phone';
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
      setError('email', 'Adresse e-mail invalide.');
      firstError = firstError || 'email';
    }
    if (!state.slot) { setError('slot', 'Choisissez une heure de retrait.'); firstError = firstError || 'slot'; }
    if (!form.elements.consent.checked) { setError('consent', 'Merci d’accepter d’être contacté au sujet de la commande.'); firstError = firstError || 'consent'; }

    if (firstError) {
      const field = form.querySelector(`[data-field="${firstError}"]`);
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      form.querySelector(`[data-field="${firstError}"] input`)?.focus();
      return;
    }

    const day = days.find((d) => d.iso === state.dayIso);
    const order = {
      reference: orderReference(),
      placedAt: new Date().toISOString(),
      pickup: {
        iso: state.dayIso,
        dayLabel: day.label,
        dateLabel: day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: state.slot,
        asap: state.asap,
      },
      customer: data,
      items: Cart.items.map((line) => ({
        name: line.name,
        qty: line.qty,
        unitPrice: line.unitPrice,
        total: Math.round(line.unitPrice * line.qty * 100) / 100,
        summary: line.summary,
      })),
      promo: Cart.promoCode,
      subtotal: Cart.subtotal(),
      discount: Cart.discount(),
      total: Cart.total(),
    };

    writeStore(STORAGE_ORDER, order);
    writeStore(STORAGE_CUSTOMER, { name: data.name, phone: data.phone, email: data.email });
    notifyRestaurant(order);        // webhook éventuel, en tâche de fond
    Cart.clear();
    Cart.clearPromo();
    location.href = 'confirmation.html';
  });

  document.addEventListener('cart:change', renderSummary);
  document.addEventListener('dispo:change', renderSummary);

  /* Retrait en un geste des lignes devenues indisponibles */
  summaryRoot.addEventListener('click', (e) => {
    if (!e.target.closest('[data-corriger-panier]')) return;
    /* Un produit épuisé sort du panier ; une quantité trop élevée est
       ramenée au disponible, plutôt que de supprimer la ligne entière. */
    lignesACorriger().forEach((c) => {
      if (c.raison === 'epuise') Cart.remove(c.ligne.key);
      else Cart.setQty(c.ligne.key, c.reste);
    });
    toast('Panier ajusté');
  });

  renderDays();
  renderSlots();
  renderSummary();

  /* Rappel du lieu de retrait */
  $$('[data-pickup-address]').forEach((el) => { el.textContent = RESTAURANT.address; });
}

/** Référence lisible : DIL-JJMM-XXXX */
function orderReference() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DIL-${day}${month}-${rand}`;
}

/* ---------------------------------- Message WhatsApp & webhook facultatif */
function orderAsText(order) {
  const lines = [];
  lines.push(`NOUVELLE COMMANDE ${order.reference}`);
  lines.push(`Retrait : ${order.pickup.dateLabel} à ${order.pickup.time}${order.pickup.asap ? ' (dès que possible)' : ''}`);
  lines.push(`Client : ${order.customer.name} — ${order.customer.phone}`);
  lines.push('');
  order.items.forEach((item) => {
    lines.push(`• ${item.qty}× ${item.name} — ${euro(item.total)}`);
    (item.summary || []).forEach((s) => lines.push(`    ${s}`));
  });
  lines.push('');
  if (order.discount > 0) {
    lines.push(`Sous-total : ${euro(order.subtotal)}`);
    lines.push(`Code ${order.promo} : −${euro(order.discount)}`);
  }
  lines.push(`TOTAL : ${euro(order.total)}`);
  lines.push(`Paiement : ${order.customer.payment === 'sur-place' ? 'sur place au retrait' : order.customer.payment}`);
  if (order.customer.note) lines.push(`Note : ${order.customer.note}`);
  return lines.join('\n');
}

function whatsappLink(order) {
  return `https://wa.me/${ORDER_ROUTING.whatsapp}?text=${encodeURIComponent(orderAsText(order))}`;
}

/**
 * Envoi automatique vers le webhook s'il est configuré. En « no-cors » :
 * on ne lit pas la réponse, mais la commande part sans bloquer le client.
 */
function notifyRestaurant(order) {
  if (!ORDER_ROUTING.webhookUrl) return;
  try {
    fetch(ORDER_ROUTING.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ ...order, text: orderAsText(order) }),
      keepalive: true,
    }).catch(() => {});
  } catch (err) {
    /* le canal WhatsApp reste disponible */
  }
}

/* ------------------------------------------------ 11. Page Confirmation */
function initConfirmationPage() {
  const root = $('#confirm-root');
  if (!root) return;
  const order = readStore(STORAGE_ORDER, null);

  if (!order) {
    root.innerHTML = `
      <div class="panel" style="text-align:center">
        <h2>Aucune commande à afficher</h2>
        <p class="text-soft">Votre commande a peut-être déjà été envoyée depuis un autre appareil.</p>
        <a class="btn" href="carte.html">Voir la carte</a>
      </div>`;
    return;
  }

  const wa = whatsappLink(order);
  root.innerHTML = `
    <div class="confirm">
      <div class="confirm__badge" aria-hidden="true">✓</div>
      <p class="eyebrow" style="justify-content:center">Commande enregistrée</p>
      <h1 style="font-size:clamp(2rem,6vw,3rem)">Merci ${esc(order.customer.name)} !</h1>
      <p class="confirm__num">${esc(order.reference)}</p>
    </div>

    <div class="confirm__slot">
      <span>Retrait ${esc(order.pickup.dateLabel)}</span>
      <strong>${esc(order.pickup.time)}</strong>
      <span>${esc(RESTAURANT.address)}</span>
    </div>

    <div class="notice notice--warn" style="margin-bottom:18px">
      <span aria-hidden="true">📲</span>
      <span><strong>Dernière étape :</strong> envoyez la commande au restaurant sur WhatsApp — le message est déjà rédigé, il ne reste qu’à appuyer sur « Envoyer ».</span>
    </div>

    <a class="btn btn--block btn--lg" href="${esc(wa)}" target="_blank" rel="noopener" id="wa-send">
      Envoyer ma commande sur WhatsApp
    </a>
    <p class="field__hint" style="text-align:center;margin-bottom:22px">
      Un souci ? Appelez le <a href="tel:${esc(RESTAURANT.phoneLink)}" style="text-decoration:underline">${esc(RESTAURANT.phone)}</a>
    </p>

    <div class="panel">
      <div class="panel__head"><span class="panel__step">✓</span><h2>Votre commande</h2></div>
      <div class="summary__lines">
        ${order.items.map((item) => `
          <div class="summary__line">
            <span><span class="summary__qty">${item.qty}×</span> ${esc(item.name)}
              ${(item.summary || []).length ? `<br><span class="text-soft" style="font-size:.84rem">${item.summary.map(esc).join('<br>')}</span>` : ''}
            </span>
            <span>${euro(item.total)}</span>
          </div>`).join('')}
      </div>
      <div class="totals">
        <div class="totals__row"><span>Sous-total</span><span>${euro(order.subtotal)}</span></div>
        ${order.discount > 0 ? `<div class="totals__row totals__row--promo"><span>Code ${esc(order.promo)}</span><span>−${euro(order.discount)}</span></div>` : ''}
        <div class="totals__row totals__row--total"><span>Total à payer sur place</span><span>${euro(order.total)}</span></div>
      </div>
      <div class="leaf-divider" aria-hidden="true">🌿</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn btn--ghost btn--sm" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(RESTAURANT.mapsQuery)}" target="_blank" rel="noopener">Itinéraire</a>
        <button type="button" class="btn btn--ghost btn--sm" onclick="window.print()">Imprimer</button>
        <a class="btn btn--ghost btn--sm" href="carte.html">Commander à nouveau</a>
      </div>
    </div>`;

  /* Ouverture spontanée de WhatsApp : si le navigateur la bloque,
     le bouton reste visible juste au-dessus. */
  const link = $('#wa-send');
  if (link && !sessionStorage.getItem(`wa-${order.reference}`)) {
    sessionStorage.setItem(`wa-${order.reference}`, '1');
    window.open(link.href, '_blank', 'noopener');
  }
}

/* --------------------------------------------------------- 12. Amorçage */
document.addEventListener('DOMContentLoaded', () => {
  /* Lancé sans attendre : la carte s'affiche tout de suite, puis les
     produits épuisés se grisent dès que le fichier est lu. */
  loadDisponibilites();
  wireOrderCtas();
  initHeader();
  Sheet.init();
  CartUI.init();
  initHoursList();
  initHeroVideo();
  initReels();
  initGallery();
  initSocial();

  const page = document.body.dataset.page;
  if (page === 'carte') initCartePage();
  if (page === 'commande') initCommandePage();
  if (page === 'confirmation') initConfirmationPage();

  /* Coordonnées du restaurant injectées partout où c'est utile */
  $$('[data-restaurant-address]').forEach((el) => { el.textContent = RESTAURANT.address; });
  $$('[data-restaurant-phone]').forEach((el) => { el.textContent = RESTAURANT.phone; });
});
