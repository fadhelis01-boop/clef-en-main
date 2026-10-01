# Clef en Main — gestion locative sans agence

Application pour les propriétaires qui gèrent eux-mêmes jusqu'à **6 logements** loués en résidence principale (location vide, meublée, étudiante, bail mobilité). Elle fonctionne sur **Android, iPhone, iPad, ordinateur**, hors connexion, sans compte ni serveur.

## Installer

1. Ouvrez l'adresse de l'appli dans le navigateur (Chrome sur Android, Safari sur iPhone).
2. **iPhone / iPad** : bouton Partager › « Sur l'écran d'accueil ». **Android** : menu ⋮ › « Installer l'application ». **Ordinateur** : icône d'installation dans la barre d'adresse.
3. L'appli s'ouvre ensuite comme une application normale, même sans réseau.

## Ce que fait l'appli

| Moment | Ce que vous obtenez |
|---|---|
| Mise en location | Assistant par questions simples (vide/meublé, étudiant, mobilité, durée réduite, colocation, garant, zone tendue, encadrement, DPE) ; contrat au modèle officiel en vigueur depuis le 1er octobre 2026 ; acte de caution ; état des lieux avec photos et inventaire du meublé ; récépissé des annexes ; lettre d'accueil ; contrôle de conformité bloquant (dépôt, loyer, décence énergétique, diagnostics). |
| Chaque mois | Loyers attendus et reçus, prorata, paiements partiels, compte locatif ; quittances (reçu automatique si paiement incomplet) ; avis d'échéance ; envoi par e-mail avec PDF joint, courrier, recommandé ou main propre, avec historique des envois. |
| Charges locatives | Onglet « Charges » de chaque logement : provision ou forfait détaillé par nature (liste limitative du décret 87-713 : eau, ascenseur, chauffage collectif, parties communes, gardien 75 %/40 %, TEOM hors frais de gestion…) ; décompte annuel des charges réelles sur l'exercice exact du syndic, avec quote-part ; régularisation de chaque bail au prorata de présence (y compris l'ancien locataire parti en cours d'année), exigible un mois après envoi, étalement sur 12 mois si tardive, alerte de prescription, nouvelle provision proposée ; lettre de changement de provision ; détail des charges sur avis d'échéance, quittances et bail ; bilan des charges (provisions, récupérables payées, période vacante) et traitement fiscal. |
| Attestations | Loyer (CAF, MSA, Action Logement), location/domicile, paiements à jour, relevé annuel des sommes payées, dépôt de garantie versé, fin de bail et libération des lieux, remise des clés, attestation pour fournisseur, bon voisinage ; autorisations de travaux et de sous-location ; demandes de justificatifs au locataire (entretien chaudière, ramonage, préavis réduit, nouvelle adresse, relevés) ; état locatif pour la banque, le notaire ou un acheteur. |
| Chaque année | Révision IRL calculée avec l'indice INSEE (et bloquée si DPE F/G) ; régularisation des charges au prorata ; attestation d'assurance ; bilan fiscal (micro-foncier / réel 2044, micro-BIC / LMNP), export tableur pour le comptable. |
| Problèmes | Relance amiable puis ferme, mise en demeure, information et appel de la caution, plan d'apurement, signalement CAF/MSA, saisine du commissaire de justice, troubles de voisinage, manquements, travaux, visites, avenant, commission de conciliation. |
| Fin du bail | Réponse au congé du locataire (préavis calculé), congé du bailleur (vente, reprise, motif sérieux, délais contrôlés), état des lieux de sortie comparé à l'entrée, restitution du dépôt (délai, pénalité de 10 %, retenue copropriété), résiliation amiable, archivage. |
| Aide | Guides « Que faire si… » (impayés, départ, vente, décès, travaux, litige, colocation, sous-location, choix du locataire, impôts), outils de calcul (IRL, préavis, vétusté, prorata), 8 e-mails types. |

## Vos questions

**Que devient un bail terminé ? Libère-t-il une place ?**
Les 6 places correspondent à des **logements**, pas à des baux. Quand un bail se termine (préavis échu, bail étudiant ou mobilité arrivé à terme), l'appli le fait passer d'elle-même en « Parti — à solder » : le logement redevient **libre pour un nouveau bail** immédiatement. Une fois le dépôt restitué et le compte soldé, le bail est **archivé automatiquement** dans l'historique du logement. Vous n'avez rien à supprimer.

**Les données sont-elles conservées ?**
Oui. Un bail archivé reste consultable (documents, paiements, photos) et figure dans vos sauvegardes. La loi impose de garder les documents au moins 3 ans après la fin du bail (prescription) et 6 ans pour les pièces fiscales ; l'appli le rappelle avant toute suppression. Une suppression passe par une **corbeille de 30 jours**. Pour libérer une place, on **archive** le logement (vendu, repris) : son historique reste.

**Synchronisation automatique entre appareils (GitHub)**
Réglages › Synchronisation › « Activer ». Les données sont chiffrées sur l'appareil (AES-256) puis rangées dans le dépôt GitHub **privé** `clef-en-main-donnees` : GitHub ne voit que des fichiers illisibles. Chaque modification part quelques secondes après ; les autres appareils la reçoivent à l'ouverture, au retour sur l'appli et toutes les 2 minutes. En cas de modifications simultanées, les fiches sont fusionnées (la plus récente l'emporte, les suppressions sont respectées). Premier appareil : créez une clé d'accès GitHub limitée à ce dépôt (le lien pré-rempli est dans l'appli) et collez-la. Autres appareils : collez le « code de liaison » affiché par le premier. La clé expire après un an : l'accueil prévient. Chaque envoi laisse une version dans l'historique du dépôt.

**Copie de sauvegarde (fichier)**
Les données sont enregistrées automatiquement sur l'appareil. « Sauvegarde › Faire une copie » crée un fichier `.clef` (protégeable par mot de passe) à ranger dans Google Drive, iCloud Drive, OneDrive ou à s'envoyer par e-mail ; « Ouvrir une copie » sur l'autre appareil **fusionne** les données (la fiche modifiée le plus récemment l'emporte, les suppressions sont respectées). L'accueil rappelle de faire une copie chaque mois.

**Mises à jour réglementaires**
Toutes les règles (durées, préavis, plafonds, IRL, DPE, fiscalité) sont dans un référentiel daté (`regles.js`), chaque règle étant rattachée à une catégorie et aux types de bail concernés. Une **veille mensuelle programmée** met à jour ce référentiel et le publie ; à l'ouverture, l'appli récupère `regles.json` et applique les nouvelles valeurs d'elle-même, à partir de leur date d'effet, aux baux concernés, en prévenant sur l'accueil. Le bouton « Rechercher les mises à jour » (Réglages) force la vérification.

## Limites (à connaître)

- Résidence principale uniquement (loi du 6 juillet 1989). Hors champ : location saisonnière ou touristique, résidence secondaire, bail commercial ou professionnel, logement conventionné, règles particulières d'Alsace-Moselle et d'Outre-mer.
- Les montants des loyers de référence (encadrement) et la liste des communes en zone tendue se vérifient sur les simulateurs officiels (liens dans l'appli).
- L'envoi d'un e-mail passe par votre messagerie (aucun serveur d'envoi) ; le recommandé se fait à La Poste ou par la lettre recommandée en ligne.
- Pas de rappels « push » quand l'appli est fermée : les échéances s'affichent à l'ouverture.
- Les documents suivent les textes en vigueur au 2 octobre 2026 mais ne remplacent pas un professionnel du droit. L'ADIL conseille gratuitement : 0 805 160 075.

## Pour la maintenance

- `regles.js` : seule source des valeurs légales. Ajouter une valeur datée, un élément au `journal`, changer `version`.
- `python tools/build.py` : vérifie la syntaxe, lance les tests (`node tools/tests.js`), régénère `regles.json`, renomme le cache hors ligne (les utilisateurs voient le bandeau « Nouvelle version »).
- Fichiers : `index.html`, `app.css`, `regles.js`, `js/` (core, store, metier, docs, envoi, edl, ui, assistant, app), `sw.js`, `manifest.webmanifest`, `icons/`.

## Corrections apportées à la version d'origine

1. **Durée du bail** : les notions « CDI / CDD » n'existent pas en bail d'habitation. Remplacées par les durées légales (3 ou 6 ans en vide, durée réduite de l'article 11 avec événement précis, 1 an en meublé, 9 mois étudiant, 1 à 10 mois mobilité).
2. **Contrat incomplet** : il manquait des mentions obligatoires du contrat type, dont la clause résolutoire et la servitude de résidence principale (obligatoires depuis le 1er octobre 2026), les dépenses d'énergie estimées, le trimestre IRL, le loyer du précédent locataire et les loyers de référence, les travaux, la solidarité et la liste des annexes. La phrase « document fourni à titre indicatif » figurait dans le corps du contrat : elle en a été retirée.
3. **Quittance** : elle était délivrée même sans paiement complet. Elle est désormais reliée aux paiements réels ; si le paiement est partiel, l'appli produit un reçu, comme le veut l'article 21.
4. **Impayés** : la mise en demeure annonçait une saisine directe du tribunal. Elle annonce désormais la bonne procédure : commandement de payer par un commissaire de justice, délai de 6 semaines, information de la caution, puis le juge.
5. **Congé** : un seul modèle servait au bailleur et au locataire, sans contrôle des délais. Il y a maintenant deux modèles. Côté bailleur : échéance contrôlée, offre de vente et droit de préemption, justification de la reprise, protection des locataires âgés, notice de l'arrêté de 2017.
6. **Dépôt de garantie** : aucun plafond n'était vérifié (1 mois en vide, 2 en meublé, interdit en bail mobilité). Il n'y avait ni délai de restitution, ni pénalité de 10 %, ni retenue provisoire en copropriété. Enfin, un solde négatif (dette du locataire) était masqué.
7. **État des lieux** : il indiquait toujours « non meublé », même pour un meublé, et n'avait pas d'inventaire. Ajoutés : inventaire, comparaison avec l'entrée, brouillon enregistré en continu.
8. **Dates** : la date du jour était calculée en heure UTC, donc fausse entre minuit et 2 h en France.
9. **Stockage** : le stockage du navigateur (environ 5 Mo) saturait vite avec les photos, et l'import pouvait écraser des données. Remplacé par IndexedDB, des photos stockées à part, une fusion fiche par fiche et une corbeille.
10. **Attestation « d'hébergement »** : ce terme désigne l'accueil gratuit d'une personne, pas une location. Elle devient une « attestation de location ».
11. **Confidentialité** : les polices Google étaient chargées depuis Internet (fuite de l'adresse IP, et pas de fonctionnement hors ligne). Elles sont remplacées par les polices du système.
