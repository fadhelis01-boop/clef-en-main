/* =====================================================================================
   RÉFÉRENTIEL RÉGLEMENTAIRE DATÉ — Clef en Main (gestion locative)
   -------------------------------------------------------------------------------------
   Toutes les valeurs légales utilisées par l'appli sont ici, et seulement ici.
   Chaque paramètre appartient à une CATÉGORIE, vise des TYPES DE BAIL (vide, meublé,
   étudiant, mobilité, ou « tous ») et porte des DATES D'EFFET.
   L'appli demande toujours « la valeur en vigueur à telle date » (fonction R) :
   une valeur ajoutée ici, ou reçue par regles.json lors de la veille mensuelle,
   s'applique donc d'office aux baux de la catégorie concernée, à partir de sa date.

   Publier une mise à jour : ajouter {du:'AAAA-MM-JJ', v:...} au paramètre concerné,
   changer `version`, ajouter une entrée au `journal` (avec `types` concernés),
   puis lancer `python tools/build.py` (régénère regles.json).
   ===================================================================================== */
const REG_DEFAULT = {
  schema: 1,
  version: '2026-10-02',
  categories: {
    bail:      'Contrat de bail',
    loyer:     'Loyer, révision, encadrement',
    depot:     'Dépôt de garantie',
    conge:     'Préavis et congés',
    energie:   'Performance énergétique et décence',
    impayes:   'Impayés et procédure',
    charges:   'Charges récupérables',
    diag:      'Diagnostics obligatoires',
    fiscal:    'Fiscalité des loyers',
    conserv:   'Conservation des documents'
  },
  params: {
    /* ---------------- Bail ---------------- */
    contratType: { cat:'bail', types:['tous'], label:'Version du contrat type applicable', unit:'texte',
      note:"Décret n° 2015-587 du 29 mai 2015, modifié par le décret n° 2026-596 du 6 juillet 2026 : pour les baux signés ou renouvelés depuis le 1er octobre 2026, clause résolutoire obligatoire (loyer, charges, dépôt de garantie), mention de l'éventuelle servitude de résidence principale (loi Le Meur), téléphones portables des parties (facultatif).",
      src:'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000030649868',
      values:[ {du:'2015-08-01', v:'2015'}, {du:'2026-10-01', v:'2026-10'} ] },
    dureeVidePhysique: { cat:'bail', types:['vide'], label:'Durée minimale — bail vide, bailleur personne physique ou SCI familiale', unit:'mois',
      src:'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028806308', values:[ {du:'1989-07-08', v:36} ] },
    dureeVideMorale: { cat:'bail', types:['vide'], label:'Durée minimale — bail vide, bailleur personne morale', unit:'mois', values:[ {du:'1989-07-08', v:72} ] },
    dureeReduiteMin: { cat:'bail', types:['vide'], label:'Durée réduite minimale (événement précis, art. 11)', unit:'mois', values:[ {du:'1989-07-08', v:12} ] },
    dureeMeuble: { cat:'bail', types:['meuble'], label:'Durée minimale — bail meublé', unit:'mois',
      src:'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028806354', values:[ {du:'2014-03-27', v:12} ] },
    dureeEtudiant: { cat:'bail', types:['etudiant'], label:'Durée — bail meublé étudiant (non reconductible)', unit:'mois', values:[ {du:'2014-03-27', v:9} ] },
    dureeMobiliteMax: { cat:'bail', types:['mobilite'], label:'Durée maximale — bail mobilité (1 à 10 mois, non renouvelable)', unit:'mois',
      src:'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000037642148', values:[ {du:'2018-11-25', v:10} ] },
    surfaceMinDecence: { cat:'bail', types:['tous'], label:'Surface minimale d\'un logement décent (ou volume 20 m³)', unit:'m²',
      note:'Pièce principale d\'au moins 9 m² avec 2,20 m sous plafond, ou volume habitable d\'au moins 20 m³ (décret 2002-120).',
      values:[ {du:'2002-01-30', v:9} ] },

    /* ---------------- Loyer ---------------- */
    irl: { cat:'loyer', types:['vide','meuble','etudiant'], label:'Indice de référence des loyers (IRL, métropole)', unit:'indice', kind:'serie',
      note:'Publié par l\'INSEE chaque trimestre. La révision n\'est possible qu\'une fois par an, si le bail la prévoit, et dans l\'année qui suit la date anniversaire (pas de rattrapage rétroactif). Le bail mobilité ne se révise pas pendant sa durée.',
      src:'https://www.insee.fr/fr/statistiques/serie/001515333',
      serie:{ '2018-T3':128.45,'2018-T4':129.03,'2019-T1':129.38,'2019-T2':129.72,'2019-T3':129.99,'2019-T4':130.26,
        '2020-T1':130.57,'2020-T2':130.57,'2020-T3':130.59,'2020-T4':130.52,'2021-T1':130.69,'2021-T2':131.12,'2021-T3':131.67,'2021-T4':132.62,
        '2022-T1':133.93,'2022-T2':135.84,'2022-T3':136.27,'2022-T4':137.26,'2023-T1':138.61,'2023-T2':140.59,'2023-T3':141.03,'2023-T4':142.06,
        '2024-T1':143.46,'2024-T2':145.17,'2024-T3':144.51,'2024-T4':144.64,'2025-T1':145.47,'2025-T2':146.68,'2025-T3':145.77,'2025-T4':145.78,
        '2026-T1':146.6,'2026-T2':148.37 },
      publie:{ '2025-T3':'2025-10-17','2025-T4':'2026-01-16','2026-T1':'2026-04-16','2026-T2':'2026-07-12' },
      prochaine:'2026-10-15' },
    irlCorse: { cat:'loyer', types:['vide','meuble','etudiant'], label:'IRL de la collectivité de Corse', unit:'indice', kind:'serie',
      note:'Indice propre à la Corse depuis le 3e trimestre 2022 (loi du 16 août 2022). Avant, l\'indice national s\'applique.',
      src:'https://www.insee.fr/fr/statistiques/serie/010760507',
      serie:{ '2021-T3':131.67,'2021-T4':132.62,'2022-T1':133.93,'2022-T2':135.84,'2022-T3':134.3,'2022-T4':135.27,'2023-T1':136.6,'2023-T2':138.55,'2023-T3':136.98,'2023-T4':137.97,
        '2024-T1':139.33,'2024-T2':143.07,'2024-T3':140.36,'2024-T4':140.48,'2025-T1':141.28,'2025-T2':144.56,'2025-T3':141.58,'2025-T4':141.59,'2026-T1':142.38,'2026-T2':146.22 } },
    irlOutremer: { cat:'loyer', types:['vide','meuble','etudiant'], label:'IRL des départements et régions d\'outre-mer (article 73)', unit:'indice', kind:'serie',
      note:'Guadeloupe, Martinique, Guyane, La Réunion, Mayotte. Indice propre depuis le 3e trimestre 2022.',
      src:'https://www.insee.fr/fr/statistiques/serie/010760509',
      serie:{ '2021-T3':131.67,'2021-T4':132.62,'2022-T1':133.93,'2022-T2':135.84,'2022-T3':134.96,'2022-T4':135.93,'2023-T1':137.27,'2023-T2':139.23,'2023-T3':138.33,'2023-T4':139.32,
        '2024-T1':140.7,'2024-T2':143.77,'2024-T3':141.74,'2024-T4':141.86,'2025-T1':142.67,'2025-T2':145.27,'2025-T3':142.97,'2025-T4':142.98,'2026-T1':143.78,'2026-T2':146.94 } },
    decenceDPEOutremer: { cat:'energie', types:['tous'], label:'Classe DPE minimale pour louer — Outre-mer', unit:'classe',
      note:'Guadeloupe, Martinique, Guyane, La Réunion, Mayotte : G interdit en 2028, F en 2031 (loi Climat et résilience).',
      values:[ {du:'2028-01-01', v:'F'}, {du:'2031-01-01', v:'E'} ] },
    gelLoyerFGOutremer: { cat:'loyer', types:['tous'], label:'Gel des loyers des logements F et G — Outre-mer', unit:'date', values:[ {du:'2024-07-01', v:true} ] },
    gelLoyerFG: { cat:'loyer', types:['tous'], label:'Gel des loyers des logements classés F ou G (révision, relocation, renouvellement interdits)', unit:'date',
      note:'Loi Climat et résilience, art. 159 : en métropole depuis le 24 août 2022 (Outre-mer : 1er juillet 2024).',
      src:'https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000043957170', values:[ {du:'2022-08-24', v:true} ] },
    zoneTendueRelocation: { cat:'loyer', types:['vide','meuble','etudiant'], label:'Zone tendue : à la relocation, le loyer ne peut dépasser celui de l\'ancien locataire', unit:'règle',
      note:'Sauf révision IRL non appliquée dans les 12 derniers mois, travaux importants (≥ 6 mois de loyer) ou loyer manifestement sous-évalué. Interdit de toute hausse si DPE F ou G. Décret de relocation reconduit chaque année.',
      src:'https://www.service-public.fr/particuliers/vosdroits/F1311', values:[ {du:'2012-08-01', v:true} ] },
    encadrementVilles: { cat:'loyer', types:['vide','meuble','etudiant'], label:'Territoires appliquant l\'encadrement des loyers (loyer de référence majoré)', unit:'liste',
      note:'Expérimentation prolongée jusqu\'en 2027 (à vérifier). Les loyers de référence sont publiés par arrêté préfectoral : consultez le simulateur de votre ville.',
      src:'https://www.service-public.fr/particuliers/vosdroits/F1314',
      values:[ {du:'2026-01-01', v:[
        {nom:'Paris', cp:['75']},
        {nom:'Lille, Hellemmes, Lomme', cp:['59000','59160','59260','59800','59777']},
        {nom:'Plaine Commune (Saint-Denis, Aubervilliers, Saint-Ouen…)', cp:['93200','93210','93300','93400','93450','93380','93430','93800','93240']},
        {nom:'Est Ensemble (Montreuil, Pantin, Bagnolet, Bobigny…)', cp:['93100','93500','93170','93000','93260','93310','93230','93130']},
        {nom:'Lyon, Villeurbanne', cp:['69001','69002','69003','69004','69005','69006','69007','69008','69009','69100']},
        {nom:'Montpellier', cp:['34000','34070','34080','34090']},
        {nom:'Bordeaux', cp:['33000','33100','33200','33300','33800']},
        {nom:'Pays basque (24 communes)', cp:['64100','64200','64600','64500','64210','64700','64122','64310','64250','64990']},
        {nom:'Grenoble-Alpes Métropole', cp:['38000','38100','38400','38130','38600','38170']}
      ]} ] },

    /* ---------------- Dépôt de garantie ---------------- */
    depotMaxVide: { cat:'depot', types:['vide'], label:'Dépôt de garantie maximum — bail vide', unit:'mois de loyer HC',
      src:'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028780849', values:[ {du:'2008-02-09', v:1} ] },
    depotMaxMeuble: { cat:'depot', types:['meuble','etudiant'], label:'Dépôt de garantie maximum — bail meublé', unit:'mois de loyer HC', values:[ {du:'2014-03-27', v:2} ] },
    depotMaxMobilite: { cat:'depot', types:['mobilite'], label:'Dépôt de garantie — bail mobilité (interdit)', unit:'mois de loyer HC', values:[ {du:'2018-11-25', v:0} ] },
    depotDelaiConforme: { cat:'depot', types:['tous'], label:'Délai de restitution si l\'état des lieux de sortie est conforme', unit:'mois', values:[ {du:'2014-03-27', v:1} ] },
    depotDelaiNonConforme: { cat:'depot', types:['tous'], label:'Délai de restitution en cas de différences entre les états des lieux', unit:'mois', values:[ {du:'2014-03-27', v:2} ] },
    depotPenalite: { cat:'depot', types:['tous'], label:'Pénalité de retard de restitution, par mois de retard commencé', unit:'% du loyer HC', values:[ {du:'2014-03-27', v:10} ] },
    depotRetenueCopro: { cat:'depot', types:['tous'], label:'Retenue maximale provisoire en copropriété (dans l\'attente de l\'arrêté des comptes)', unit:'% du dépôt', values:[ {du:'2014-03-27', v:20} ] },

    /* ---------------- Préavis et congés ---------------- */
    preavisLocVide: { cat:'conge', types:['vide'], label:'Préavis du locataire — bail vide (cas général)', unit:'mois',
      src:'https://www.service-public.fr/particuliers/vosdroits/F1168', values:[ {du:'1989-07-08', v:3} ] },
    preavisLocReduit: { cat:'conge', types:['vide'], label:'Préavis réduit du locataire (zone tendue, mutation, perte ou nouvel emploi, santé, RSA/AAH, logement social)', unit:'mois', values:[ {du:'2014-03-27', v:1} ] },
    preavisLocMeuble: { cat:'conge', types:['meuble','etudiant','mobilite'], label:'Préavis du locataire — meublé, étudiant, mobilité', unit:'mois', values:[ {du:'2014-03-27', v:1} ] },
    preavisBailleurVide: { cat:'conge', types:['vide'], label:'Préavis du bailleur — bail vide (avant l\'échéance)', unit:'mois', values:[ {du:'1989-07-08', v:6} ] },
    preavisBailleurMeuble: { cat:'conge', types:['meuble'], label:'Préavis du bailleur — bail meublé (avant l\'échéance)', unit:'mois', values:[ {du:'2014-03-27', v:3} ] },
    protectionAge: { cat:'conge', types:['vide','meuble'], label:'Âge du locataire protégé contre le congé (sous plafond de ressources)', unit:'ans',
      note:'Locataire de plus de 65 ans aux ressources inférieures au plafond PLAI (ou hébergeant une telle personne) : relogement obligatoire, sauf bailleur lui-même âgé de plus de 65 ans ou aux ressources modestes.',
      values:[ {du:'2014-03-27', v:65} ] },
    visitesHeures: { cat:'conge', types:['tous'], label:'Visites pendant le préavis ou pour une vente : maximum par jour ouvrable', unit:'heures', values:[ {du:'1989-07-08', v:2} ] },

    /* ---------------- Énergie et décence ---------------- */
    decenceDPE: { cat:'energie', types:['tous'], label:'Classe DPE minimale pour louer (nouveau bail, renouvellement, reconduction)', unit:'classe',
      note:'Métropole. Logements G+ (> 450 kWh/m²/an) interdits depuis 2023, G depuis 2025, F en 2028, E en 2034. Outre-mer : G en 2028, F en 2031. Un logement non décent ne peut être loué et le locataire peut exiger la mise en conformité.',
      src:'https://www.service-public.fr/particuliers/vosdroits/F2042',
      values:[ {du:'2023-01-01', v:'G+'}, {du:'2025-01-01', v:'F'}, {du:'2028-01-01', v:'E'}, {du:'2034-01-01', v:'D'} ] },
    dpeValidite: { cat:'diag', types:['tous'], label:'Validité du DPE', unit:'ans',
      note:'Les DPE réalisés entre 2013 et 2017 ne sont plus valables depuis le 1er janvier 2023 ; ceux réalisés entre 2018 et le 30 juin 2021 ne le sont plus depuis le 1er janvier 2025.',
      values:[ {du:'2021-07-01', v:10} ] },
    depensesEnergieBail: { cat:'energie', types:['tous'], label:'Mention obligatoire au bail du montant estimé des dépenses annuelles d\'énergie (issu du DPE)', unit:'règle', values:[ {du:'2023-01-01', v:true} ] },

    /* ---------------- Impayés ---------------- */
    commandementDelai: { cat:'impayes', types:['tous'], label:'Délai laissé par le commandement de payer avant que la clause résolutoire joue', unit:'semaines',
      note:'Loi n° 2023-668 du 27 juillet 2023. Le commandement est délivré par un commissaire de justice et doit être dénoncé à la caution sous 15 jours.',
      src:'https://www.service-public.fr/particuliers/vosdroits/F31312', values:[ {du:'1989-07-08', v:8}, {du:'2023-07-29', v:6} ] },
    cafSignalement: { cat:'impayes', types:['tous'], label:'Délai pour signaler un impayé à la CAF/MSA (aide versée au bailleur)', unit:'mois',
      note:'Impayé constitué : au moins 2 mois de loyer et charges nets de l\'aide. À défaut de signalement, la CAF peut réclamer les aides versées.', values:[ {du:'2016-09-01', v:2} ] },
    assuranceMajoration: { cat:'impayes', types:['tous'], label:'Majoration maximale si le bailleur souscrit l\'assurance pour le compte du locataire', unit:'% de la prime', values:[ {du:'2014-03-27', v:10} ] },
    prescriptionLoyers: { cat:'impayes', types:['tous'], label:'Prescription des actions nées du bail (loyers, charges)', unit:'ans', values:[ {du:'2014-03-27', v:3} ] },
    regulTardive: { cat:'charges', types:['tous'], label:'Régularisation tardive (après le terme de l\'année suivante) : étalement sur 12 mois à la demande du locataire', unit:'mois', values:[ {du:'2014-03-27', v:12} ] },
    justifCharges: { cat:'charges', types:['tous'], label:'Mise à disposition des justificatifs de charges après envoi du décompte', unit:'mois', values:[ {du:'2014-03-27', v:6} ] },
    regulPreavis: { cat:'charges', types:['vide','meuble','etudiant'], label:'Communication du décompte de charges avant la régularisation (exigibilité)', unit:'mois',
      note:'Article 23 de la loi de 1989 : le décompte par nature de charges est communiqué un mois avant la régularisation ; en copropriété, avec le mode de répartition entre copropriétaires et, pour le chauffage et l\'eau chaude collectifs, une note d\'information.',
      src:'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028806336', values:[ {du:'2014-03-27', v:1} ] },
    forfaitCharges: { cat:'charges', types:['meuble','etudiant','mobilite'], label:'Forfait de charges : possible en meublé et en colocation (obligatoire en bail mobilité), sans régularisation, révisable chaque année comme le loyer', unit:'règle',
      note:'Il ne doit pas être manifestement disproportionné par rapport à la dernière régularisation. En location vide hors colocation, seules les provisions avec régularisation annuelle sont permises.',
      values:[ {du:'2014-03-27', v:true} ] },

    /* ---------------- Fiscalité ---------------- */
    microFoncierPlafond: { cat:'fiscal', types:['vide'], label:'Micro-foncier : plafond de loyers bruts annuels', unit:'€',
      src:'https://www.impots.gouv.fr/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus', values:[ {du:'1998-01-01', v:15000} ] },
    microFoncierAbattement: { cat:'fiscal', types:['vide'], label:'Micro-foncier : abattement forfaitaire', unit:'%', values:[ {du:'1998-01-01', v:30} ] },
    microBicPlafond: { cat:'fiscal', types:['meuble','etudiant','mobilite'], label:'Micro-BIC location meublée longue durée : plafond de recettes', unit:'€',
      note:'77 700 € jusqu\'aux revenus 2025 ; 83 600 € annoncé pour les revenus 2026 (revalorisation triennale) — à confirmer par le BOFiP.',
      src:'https://www.impots.gouv.fr/particulier/questions/comment-declarer-les-revenus-dune-location-meublee', values:[ {du:'2023-01-01', v:77700}, {du:'2026-01-01', v:83600} ] },
    microBicAbattement: { cat:'fiscal', types:['meuble','etudiant','mobilite'], label:'Micro-BIC location meublée longue durée : abattement', unit:'%', values:[ {du:'2023-01-01', v:50} ] },
    deficitFoncierPlafond: { cat:'fiscal', types:['vide'], label:'Déficit foncier imputable sur le revenu global (hors intérêts d\'emprunt)', unit:'€/an',
      note:'Plafond doublé à 21 400 € pour des travaux de rénovation énergétique faisant sortir le logement des classes E, F ou G (dépenses payées de 2023 à 2025, prolongation à vérifier).',
      values:[ {du:'1993-01-01', v:10700} ] },
    fraisGestionForfait: { cat:'fiscal', types:['vide'], label:'Frais de gestion forfaitaires déductibles au réel (ligne 222 de la 2044), par local', unit:'€', values:[ {du:'2003-01-01', v:20} ] },
    prelevementsSociaux: { cat:'fiscal', types:['tous'], label:'Prélèvements sociaux sur les revenus fonciers', unit:'%',
      note:'Pour la location meublée non professionnelle, vérifier le taux applicable aux revenus 2026 (LFSS 2026).', values:[ {du:'2018-01-01', v:17.2} ] },
    seuilLMP: { cat:'fiscal', types:['meuble','etudiant','mobilite'], label:'Seuil de recettes meublées au-delà duquel on peut devenir loueur professionnel (LMP)', unit:'€',
      note:'LMP si recettes > 23 000 € ET supérieures aux autres revenus d\'activité du foyer.', values:[ {du:'2009-01-01', v:23000} ] },
    cfeExoneration: { cat:'fiscal', types:['meuble','etudiant','mobilite'], label:'Exonération de CFE si les recettes meublées sont inférieures à', unit:'€', values:[ {du:'2015-01-01', v:5000} ] },

    /* ---------------- Conservation ---------------- */
    conservFiscal: { cat:'conserv', types:['tous'], label:'Conservation des pièces fiscales (factures, relevés)', unit:'ans', values:[ {du:'2008-01-01', v:6} ] },
    conservBail: { cat:'conserv', types:['tous'], label:'Conservation des documents du bail après sa fin (prescription)', unit:'ans', values:[ {du:'2014-03-27', v:3} ] }
  },

  /* Diagnostics : durée de validité (ans, null = illimitée) et condition d'exigibilité. */
  diagnostics: [
    {k:'dpe',     l:'Diagnostic de performance énergétique (DPE)', ans:10, quand:'Toujours'},
    {k:'erp',     l:'État des risques et pollutions (ERP)', ans:0.5, quand:'Toujours — moins de 6 mois à la signature'},
    {k:'crep',    l:'Constat de risque d\'exposition au plomb (CREP)', ans:6, quand:'Immeuble construit avant le 1er janvier 1949 (illimité si absence de plomb)'},
    {k:'elec',    l:'État de l\'installation intérieure d\'électricité', ans:6, quand:'Installation de plus de 15 ans'},
    {k:'gaz',     l:'État de l\'installation intérieure de gaz', ans:6, quand:'Installation de plus de 15 ans'},
    {k:'amiante', l:'Dossier amiante parties privatives (DAPP)', ans:null, quand:'Permis de construire avant le 1er juillet 1997 — tenu à disposition'},
    {k:'bruit',   l:'Diagnostic bruit (zone d\'exposition au bruit d\'un aérodrome)', ans:null, quand:'Logement situé dans une zone de bruit d\'aérodrome'},
    {k:'surface', l:'Mesure de la surface habitable', ans:null, quand:'Location vide (mention obligatoire de la surface)'}
  ],

  /* Équipements minimum d'un logement meublé (décret n° 2015-981 du 31 juillet 2015). */
  equipementsMeuble: [
    'Literie comprenant couette ou couverture','Volets ou rideaux occultants dans les chambres','Plaques de cuisson',
    'Four ou four à micro-ondes','Réfrigérateur et congélateur (ou compartiment à -6 °C au plus)','Vaisselle en nombre suffisant pour les repas',
    'Ustensiles de cuisine','Table et sièges','Étagères de rangement','Luminaires','Matériel d\'entretien ménager adapté'
  ],

  /* Charges récupérables : liste LIMITATIVE du décret n° 87-713 du 26 août 1987 (8 rubriques + personnel).
     pct = part récupérable par défaut ; tout ce qui n'y figure pas reste à la charge du bailleur. */
  chargesNatures: [
    {k:'ascenseur', l:'Ascenseurs et monte-charge', pct:100, ex:'Électricité, exploitation, entretien courant, menues réparations. Si le contrat d\'entretien inclut des réparations importantes, seule la part « entretien courant » est récupérable.'},
    {k:'eau', l:'Eau froide et eau chaude', pct:100, ex:'Consommation, location et relevé des compteurs (y compris divisionnaires), assainissement et redevances, produits de traitement de l\'eau.'},
    {k:'chauffage', l:'Chauffage et eau chaude collectifs', pct:100, ex:'Combustible ou énergie, exploitation, entretien courant et menues réparations de la chaufferie, comptage individuel. Pas les gros travaux ni le remplacement de la chaudière.'},
    {k:'individuel', l:'Installations individuelles', pct:100, ex:'Entretien annuel de la chaudière ou du chauffe-eau, ramonage, entretien de la VMC et de la robinetterie — seulement si c\'est le bailleur qui a souscrit le contrat.'},
    {k:'communs', l:'Parties communes intérieures', pct:100, ex:'Électricité des communs, produits et matériel d\'entretien, ménage par une entreprise, minuterie, tapis, réparation des menus équipements.'},
    {k:'exterieurs', l:'Espaces extérieurs', pct:100, ex:'Entretien des voies, parkings, espaces verts, aires de jeux, éclairage extérieur.'},
    {k:'hygiene', l:'Hygiène', pct:100, ex:'Sacs et produits pour les déchets, désinsectisation, dératisation, désinfection, entretien du vide-ordures.'},
    {k:'gardien', l:'Gardien, concierge, employé d\'immeuble', pct:75, ex:'Gardien : 75 % du salaire et des charges sociales s\'il assure l\'entretien des parties communes ET l\'élimination des déchets, 40 % s\'il n\'assure que l\'une des deux. Employé d\'immeuble : 100 % de la part consacrée à l\'entretien. Jamais la part « gestion ».'},
    {k:'equipements', l:'Équipements divers', pct:100, ex:'Antenne TV collective ou câble, interphone, digicode, extincteurs, portes automatiques (entretien courant).'},
    {k:'taxes', l:'Impositions et redevances', pct:100, ex:'Taxe d\'enlèvement des ordures ménagères (TEOM) — sans les frais de gestion de la fiscalité locale facturés sur l\'avis —, taxe de balayage, redevance assainissement.'},
    {k:'non_recup', l:'Dépenses non récupérables', pct:0, ex:'Honoraires du syndic, assurance de l\'immeuble, gros travaux, fonds de travaux, frais de gestion de la TEOM, taxe foncière, frais bancaires du syndicat : à votre charge.'}
  ],

  /* Pièces que le bailleur peut demander au candidat (décret n° 2015-1437) — toute autre pièce est interdite. */
  piecesCandidat: [
    'Une pièce d\'identité (carte d\'identité, passeport, titre de séjour…)',
    'Un justificatif de domicile (3 dernières quittances, attestation d\'hébergement, avis de taxe foncière…)',
    'Justificatifs d\'activité professionnelle (contrat de travail, carte étudiant, extrait K-bis…)',
    'Justificatifs de ressources (dernier avis d\'imposition, 3 derniers bulletins de salaire, attestation de bourse, simulation d\'aides au logement…)'
  ],
  piecesInterdites: [
    'Photo d\'identité (hors celle de la pièce d\'identité)','Carte d\'assuré social / carte Vitale','Relevés de compte bancaire ou postal',
    'Attestation de bonne tenue de compte','Chèque de réservation','Dossier médical','Extrait de casier judiciaire',
    'Contrat de mariage, jugement de divorce (sauf partie relative à l\'autorité parentale)','Attestation d\'absence de crédit en cours','Autorisation de prélèvement automatique'
  ],

  /* Journal des évolutions : chaque entrée vise des types de bail ; l'appli prévient pour les baux concernés. */
  journal: [
    {date:'2026-10-02', titre:'Indices de loyers propres à la Corse et à l\'Outre-mer', types:['vide','meuble','etudiant'],
     texte:'Les baux situés en Corse ou dans un département d\'outre-mer sont révisés avec leur indice propre (publié par l\'INSEE depuis 2022). L\'appli choisit automatiquement le bon indice d\'après le code postal du logement.',
     src:'https://www.insee.fr/fr/statistiques/serie/010760507'},
    {date:'2026-10-01', titre:'Nouveau modèle de bail obligatoire', types:['vide','meuble','etudiant'],
     texte:'Depuis le 1er octobre 2026 (décret n° 2026-596 du 6 juillet 2026), tout bail signé ou renouvelé doit contenir la clause résolutoire (loyer, charges, dépôt de garantie) et mentionner l\'éventuelle servitude de résidence principale. Les baux générés par l\'appli l\'intègrent.',
     src:'https://www.anil.org/aj-contrats-types-de-location-de-logement-residence-principale/'},
    {date:'2026-07-10', titre:'IRL du 2e trimestre 2026 : 148,37 (+1,15 % sur un an)', types:['vide','meuble','etudiant'],
     texte:'Valeur à utiliser pour les baux dont l\'indice de référence est le 2e trimestre. Prochaine publication : 15 octobre 2026.',
     src:'https://www.insee.fr/fr/statistiques/9022797'},
    {date:'2026-02-19', titre:'Loi de finances 2026 : dispositif « Jeanbrun » (location nue)', types:['vide'],
     texte:'Nouvel amortissement possible pour les logements achetés jusqu\'à fin 2028 et loués nus à loyer plafonné pendant 9 ans. Ne s\'applique qu\'aux biens éligibles : parlez-en à votre conseiller avant d\'opter.',
     src:'https://www.actu-juridique.fr/fiscalite/fiscal-finances/location-nue-le-nouveau-dispositif-jeanbrun-en-faveur-des-bailleurs/'},
    {date:'2025-01-01', titre:'Logements classés G : plus de nouveau bail ni de renouvellement', types:['tous'],
     texte:'Un logement classé G n\'est plus décent. Prochaine étape : classe F au 1er janvier 2028.',
     src:'https://www.service-public.fr/particuliers/vosdroits/F2042'}
  ]
};

/* ---------------------------------------------------------------------------------------
   Lecture des valeurs : REG = référentiel courant (défaut fusionné avec regles.json reçu).
   --------------------------------------------------------------------------------------- */
let REG = REG_DEFAULT;
function R(key, dateISO){
  const p = REG.params[key];
  if(!p) { console.warn('Paramètre inconnu', key); return null; }
  const d = dateISO || todayISO();
  let val = null;
  for(const row of (p.values||[])){ if(row.du <= d) val = row.v; }
  if(val===null && p.values && p.values.length) val = p.values[0].v;
  return val;
}
/* IRL : trimestre 'AAAA-Tn' → valeur ; dernier trimestre publié. */
/* zone d'indice : 'metropole' | 'corse' | 'outremer' (le bon IRL s'applique selon le code postal du logement) */
const IRL_PARAM = {metropole:'irl', corse:'irlCorse', outremer:'irlOutremer'};
const IRL_NOM = {metropole:'IRL', corse:'IRL de Corse', outremer:'IRL Outre-mer'};
function irlZoneCp(cp){ cp=String(cp||''); if(/^20/.test(cp)) return 'corse'; if(/^97[1-46]/.test(cp)) return 'outremer'; return 'metropole'; }
function irlValeur(trim, zone){
  const p=REG.params[IRL_PARAM[zone||'metropole']]||REG.params.irl;
  return (p.serie||{})[trim] || (REG.params.irl.serie||{})[trim] || null;
}
function irlDernier(zone){
  const s=(REG.params[IRL_PARAM[zone||'metropole']]||REG.params.irl).serie||{};
  const keys = Object.keys(s).sort(); const k = keys[keys.length-1];
  return {trimestre:k, valeur:s[k]};
}
function irlMemeTrimestreAnneeSuivante(trim){
  const [y,t] = trim.split('-T');
  return (parseInt(y)+1)+'-T'+t;
}
/* Fusion d'un référentiel distant : on garde le plus récent par paramètre. */
function regFusion(remote){
  if(!remote || remote.schema!==1 || !remote.params) return REG;
  const out = JSON.parse(JSON.stringify(REG_DEFAULT));
  out.version = remote.version > REG_DEFAULT.version ? remote.version : REG_DEFAULT.version;
  for(const k in remote.params){
    const rp = remote.params[k];
    if(!out.params[k]) { out.params[k] = rp; continue; }
    if(rp.values) out.params[k].values = rp.values;
    if(rp.serie) out.params[k].serie = Object.assign({}, out.params[k].serie, rp.serie);
    if(rp.publie) out.params[k].publie = Object.assign({}, out.params[k].publie||{}, rp.publie);
    ['note','src','label','prochaine'].forEach(f=>{ if(rp[f]) out.params[k][f] = rp[f]; });
  }
  ['diagnostics','equipementsMeuble','piecesCandidat','piecesInterdites','chargesNatures'].forEach(f=>{ if(Array.isArray(remote[f])) out[f]=remote[f]; });
  if(Array.isArray(remote.journal)){
    const seen = new Set(out.journal.map(j=>j.date+j.titre));
    remote.journal.forEach(j=>{ if(!seen.has(j.date+j.titre)) out.journal.push(j); });
    out.journal.sort((a,b)=>b.date.localeCompare(a.date));
  }
  return out;
}
