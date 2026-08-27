# Dilemme — site vitrine & click and collect

Site du restaurant **Dilemme — Sandwichs & Panuozzo**, 4 Place Joséphine Piquet,
94350 Villiers-sur-Marne.

Site statique : uniquement du HTML, du CSS et du JavaScript. Aucune installation,
aucun serveur à maintenir, aucune base de données. Il s'ouvre aussi bien depuis un
téléphone que depuis un ordinateur, et se met en ligne en déposant les fichiers.

---

## 1. Les pages

| Page | Rôle |
|---|---|
| `index.html` | Accueil : photo d'ambiance, click & collect en 3 étapes, incontournables, vidéos, présentation du panuozzo, horaires, questions fréquentes |
| `carte.html` | Carte complète, recherche, fiches produit détaillées |
| `commande.html` | Commande (renvoi vers Lightspeed, ou tunnel intégré selon le réglage) |
| `confirmation.html` | Récapitulatif après une commande passée via le tunnel intégré |
| `infos.html` | Adresse, accès, horaires, contact |
| `mentions-legales.html` | Mentions légales et confidentialité |

Fichiers techniques : `assets/` (styles, script, images, polices, vidéo),
`robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `CNAME`, `tools/`.

---

## 2. Tout le contenu se modifie dans un seul fichier

**`assets/js/data.js`** contient la totalité du contenu éditorial. Il est commenté
en français, section par section :

| Section du fichier | Ce qu'elle règle |
|---|---|
| `RESTAURANT` | Nom, adresse, téléphone, délai de préparation |
| `OPENING_HOURS` | Horaires jour par jour (`null` = fermé). Accepte deux plages par jour |
| `CATEGORIES` | Les rubriques de la carte, leur ordre, leur pictogramme |
| `OPTION_GROUPS` | Les choix proposés : formules, sauces, suppléments, étapes du Composé |
| `PRODUCTS` | Les produits : nom, prix, description, photo, options |
| `PROMO_CODES` | Codes de réduction du tunnel intégré |
| `ORDERING` | **Quel système reçoit les commandes** (voir §4) |
| `ORDER_ROUTING` | Numéro WhatsApp et webhook du tunnel intégré |
| `SOCIAL` | Liens Instagram / TikTok / Facebook / avis Google |
| `REELS` | Vidéos verticales mises en avant sur l'accueil |
| `GALLERY` | Photos du bandeau défilant |

Après une modification de la carte ou des prix, relancer :

```bash
node tools/build-seo.js
```

Cette commande met à jour le plan du site et les données structurées de la carte
(celles que Google utilise pour afficher les plats et les prix).

### Ajouter un produit

Copier un bloc existant dans `PRODUCTS`, changer `id` (unique, sans accent ni
espace), `name`, `price`, `description`, `category`, et la liste `options`.

### Ajouter une photo de produit

1. Déposer l'image dans `assets/img/` sous deux tailles :
   `mon-produit.jpg` (900 px de large) et `mon-produit-sm.jpg` (480 px).
2. Ajouter `image: 'mon-produit',` dans le produit concerné.

Sans photo, une vignette avec l'émoji du produit s'affiche : jamais d'image cassée.
Les photos fournies ont été redimensionnées et compressées (40 Mo → 2,3 Mo) pour
que le site reste rapide, ce qui compte autant pour les visiteurs que pour Google.

---

## 3. Réseaux sociaux et vidéos

* **Comptes** : renseigner `SOCIAL` dans `data.js`. Un lien vide n'est pas affiché
  (aucun bouton ne mène nulle part).
* **Vidéos verticales** : dans `REELS`, deux possibilités par entrée :
  * `type: 'video'` + `src: 'assets/video/ma-video.mp4'` → lecture sur le site ;
  * `type: 'instagram'` + `url: 'https://www.instagram.com/reel/…'` → ouvre Instagram.
* La vidéo de présentation fournie est en place (`assets/video/presentation.mp4`).
  Elle ne se télécharge qu'au clic, pour ne pas consommer la data des visiteurs.
* Une entrée sans `src` ni `url` reste affichée comme simple visuel : la section
  garde son allure même sans vidéo.

---

## 4. Comment les commandes arrivent en caisse

Un seul réglage, dans `ORDERING` (`assets/js/data.js`) :

### `mode: 'lightspeed'` — réglage actuel, recommandé

Tous les boutons « Commander » ouvrent votre boutique
`mylightspeed.app/NVJMLHAQ/C-ordering/menu`. Les commandes arrivent **directement
dans votre caisse Lightspeed**, avec le ticket et le paiement gérés par Lightspeed.
C'est la solution la plus fiable : rien ne dépend d'un onglet resté ouvert.
Le site sert alors de vitrine : photos, carte, prix, horaires, référencement.

### `mode: 'maison'`

Active le tunnel intégré au site : panier, choix du créneau de retrait,
coordonnées, puis **envoi de la commande complète par WhatsApp** (numéro dans
`ORDER_ROUTING.whatsapp`). Le message est entièrement pré-rédigé : numéro de
commande, créneau, articles avec leurs options, total, coordonnées du client.
Utile si vous voulez encaisser uniquement sur place, sans passer par Lightspeed.

`ORDER_ROUTING.webhookUrl` permet, en mode maison, d'envoyer aussi chaque commande
en JSON vers un service d'automatisation (Make, Zapier, n8n, Google Apps Script) :
c'est ce webhook qui peut alors imprimer un ticket ou notifier un écran.

---

## 5. Référencement naturel

Ce qui est déjà en place :

* une balise titre et une description propres à chaque page, écrites autour des
  recherches réelles (« panuozzo Villiers-sur-Marne », « sandwich italien 94350 ») ;
* **données structurées schema.org** : fiche `Restaurant` (adresse, téléphone,
  horaires jour par jour, moyen de commande), `Menu` complet avec les 22 produits
  et leurs prix, `FAQPage`, `BreadcrumbList`, `WebSite` ;
* `sitemap.xml` et `robots.txt` (la page de confirmation est exclue de l'index) ;
* balises Open Graph et Twitter : un aperçu avec photo quand le lien est partagé
  sur WhatsApp, Instagram ou Facebook ;
* HTML sémantique, un seul `h1` par page, textes alternatifs descriptifs sur les
  images, libellés de formulaire, contrastes respectés ;
* performance : images compressées et servies en deux tailles, polices hébergées
  en local, aucune bibliothèque externe, aucun cookie de suivi ;
* du vrai contenu à lire (qu'est-ce qu'un panuozzo, questions fréquentes) — c'est
  ce qui fait la différence sur les recherches locales.

À faire de votre côté, hors du site — c'est là que se gagne le référencement local :

1. **Fiche établissement Google** (Google Business Profile) : la revendiquer, y
   mettre les mêmes horaires, la même adresse, le même numéro que le site, les
   photos, et le lien `https://www.dilemme-resto.fr`. C'est le premier levier.
2. **Google Search Console** : ajouter le domaine, envoyer `sitemap.xml`.
3. Demander des avis Google à vos clients, et renseigner le lien dans
   `SOCIAL.googleReview`.
4. Mettre le lien du site dans les bios Instagram, TikTok, Facebook.
5. Vérifier que l'adresse, le téléphone et les horaires sont **identiques partout**
   (site, Google, Instagram, plateformes de livraison) : les incohérences font
   perdre des positions.

---

## 6. Mise en ligne

Le site est statique : n'importe quel hébergeur convient, sans configuration.
Deux chemins, tous les deux gratuits.

### Vercel — pendant que le domaine n'est pas encore acheté

Le fichier `vercel.json` est déjà en place (cache des images, en-têtes de
sécurité, et des adresses courtes pratiques pour les QR codes et la bio
Instagram : `/menu`, `/commander`, `/horaires`).

1. Aller sur **vercel.com**, se connecter avec le compte GitHub.
2. *Add New…* → *Project* → importer le dépôt **akrambrl/Dilemme**.
3. Ne rien changer aux réglages de build : Vercel détecte un site statique
   (aucune commande, dossier racine). Cliquer **Deploy**.
4. Au bout d'une minute, l'adresse `https://dilemme.vercel.app` (ou une variante
   selon le nom de projet choisi) est en ligne.

**Point de vigilance** : Vercel déploie par défaut la branche principale du
dépôt. Si le site vit encore sur une branche de travail, la choisir dans
*Settings → Git → Production Branch*, puis relancer un déploiement
(*Deployments → … → Redeploy*).

Ensuite, aligner les adresses du site sur celle de Vercel :

```bash
node tools/set-domain.js https://dilemme.vercel.app
```

Puis valider et pousser : Vercel redéploie automatiquement à chaque envoi.

### GitHub Pages — l'autre option, sans compte supplémentaire

*Settings → Pages* dans le dépôt, source *Deploy from a branch*, choisir la
branche et le dossier `/ (root)`. L'adresse est
`https://akrambrl.github.io/Dilemme`, à passer ensuite à `set-domain.js`.

### Le jour où le domaine dilemme-resto.fr est actif

```bash
node tools/set-domain.js https://www.dilemme-resto.fr        # sur Vercel
node tools/set-domain.js https://www.dilemme-resto.fr --cname # sur GitHub Pages
```

* **Sur Vercel** : *Settings → Domains*, ajouter `www.dilemme-resto.fr`, puis
  créer chez le registrar l'enregistrement `CNAME` indiqué par Vercel.
* **Sur GitHub Pages** : l'option `--cname` écrit le fichier attendu par GitHub.
  Créer chez le registrar un `CNAME` `www` → `akrambrl.github.io`, et quatre
  enregistrements `A` pour le domaine nu vers `185.199.108.153`,
  `185.199.109.153`, `185.199.110.153` et `185.199.111.153`. Saisir enfin le
  domaine dans *Settings → Pages* et cocher *Enforce HTTPS*.

Le fichier `CNAME` a été retiré volontairement : tant que les DNS ne sont pas
configurés, sa présence ferait servir par GitHub Pages une adresse qui ne
répond pas. `set-domain.js --cname` le recrée au bon moment.

### Voir le site en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## 7. À compléter

* `mentions-legales.html` : raison sociale, SIRET, TVA, responsable de publication,
  hébergeur. Obligations légales d'un site professionnel.
* `infos.html` : vérifier la phrase sur l'accès (gare, stationnement).
* Les informations d'accès et le délai de préparation (`RESTAURANT.prepMinutes`,
  20 minutes par défaut) sont à ajuster selon la réalité du service.
* Fermetures exceptionnelles (congés, jours fériés) : passer la journée à `null`
  dans `OPENING_HOURS`.

## 8. Origine des contenus

La carte a été transcrite depuis les menus du restaurant ; les photos, la vidéo et
le logotype sont ceux fournis par l'établissement. La charte (vert olive, crème, or
du logotype, serif élégante et anglaise) reprend l'identité visuelle existante.
