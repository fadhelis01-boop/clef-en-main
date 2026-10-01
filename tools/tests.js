// Tests automatiques des calculs (sans navigateur) :  node tools/tests.js
// Lancés par tools/build.py avant toute publication.
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.join(__dirname,'..');
const ctx={console, setTimeout, clearTimeout, window:{addEventListener(){}}, document:{addEventListener(){}}, navigator:{}, location:{protocol:'file:'}};
vm.createContext(ctx);
for(const f of ['regles.js','js/core.js','js/store.js','js/metier.js','js/docs.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'), ctx, {filename:f});
let ok=0, ko=0;
const t=(nom, got, exp)=>{ const g=JSON.stringify(got), e=JSON.stringify(exp); if(g===e){ ok++; } else { ko++; console.log('ÉCHEC', nom, '\n  obtenu :', g, '\n  attendu:', e); } };
vm.runInContext(`
  STATE = emptyState(); save = function(){};
  todayISO = function(){ return '2026-10-02'; };
  STATE.bailleurs.push({id:'bl1', type:'physique', nom:'Durand', prenom:'Claire', adresse:'1 rue A', cp:'69003', ville:'Lyon'});
  STATE.biens.push({id:'bi1', bailleurId:'bl1', statut:'actif', adresse:'5 rue B', cp:'69004', ville:'Lyon', surface:42, pieces:2, dpe:{classe:'D'}, diagnostics:{erp:'2026-09-15', dpe:'2024-03-10'}, zoneTendue:true, encadrement:{actif:true, loyerRefMaj:16.2}, servitudeRPConnue:true, regime:'mono'});
  STATE.baux.push({id:'ba1', bienId:'bi1', bailleurId:'bl1', statut:'actif', type:'vide', dateDebut:'2025-03-10', jourPaiement:5, terme:'echoir', loyerHC:680, charges:60, chargesType:'provision', depot:680,
    irl:{trimestre:'2024-T4'}, revision:true, historiqueLoyer:[{du:'2025-03-10', loyerHC:680, charges:60}], locataires:[{nom:'Martin', prenom:'Paul'}], garants:[]});
`, ctx);
const R_=(c)=>vm.runInContext(c, ctx);
// référentiel daté
t('IRL T2 2026', R_("irlValeur('2026-T2')"), 148.37);
t('Dépôt max vide', R_("R('depotMaxVide')"), 1);
t('Décence 2026 : minimum F', R_("R('decenceDPE','2026-10-02')"), 'F');
t('Décence 2028 : minimum E', R_("R('decenceDPE','2028-01-01')"), 'E');
t('Commandement 2022 : 8 semaines', R_("R('commandementDelai','2022-01-01')"), 8);
t('Commandement 2026 : 6 semaines', R_("R('commandementDelai')"), 6);
t('Classe G interdite en 2026', R_("classeInterdite('G','2026-10-02')"), 'err');
t('Classe F autorisée en 2026', R_("classeInterdite('F','2026-10-02')"), false);
// dates
t('addMonths fin de mois', R_("addMonths('2026-01-31',1)"), '2026-02-28');
t('Prorata 1er mois (22 j / 31)', R_("echeancesBail(byId('baux','ba1'),'2025-03-31')[0].montant"), 525.16);
t('Échéance bail vide 3 ans', R_("echeanceBail(byId('baux','ba1'),'2026-10-02')"), '2028-03-09');
t('Congé bailleur : 6 mois avant', R_("dateLimiteCongeBailleur(byId('baux','ba1')).limite"), '2027-09-10');
t('Préavis locataire zone tendue', R_("preavisLocataire(byId('baux','ba1'))"), 1);
// compte locatif
R_(`upsert('paiements',{id:'p1', bailId:'ba1', date:'2026-07-05', montant:12365.16}); upsert('paiements',{id:'p2', bailId:'ba1', date:'2026-08-06', montant:300});`);
t('Solde dû', R_("compteLocatif(byId('baux','ba1')).solde"), 1180);
t('Mois impayés', R_("moisImpayes(byId('baux','ba1')).map(l=>l.key+':'+l.etat)"), ['2026-08:partiel','2026-09:impaye']);
t('Date de paiement de juillet', R_("etatMois(byId('baux','ba1'),'2026-07').payeLe"), '2026-07-05');
// révision IRL
t('Révision IRL', R_("(r=>[r.ref,r.prochainTrim,r.nouveau,r.enRetard])(revisionInfo(byId('baux','ba1')))"), ['2024-T4','2025-T4',685.36,true]);
R_(`byId('biens','bi1').dpe.classe='F';`);
t('Gel des loyers classe F', R_("revisionInfo(byId('baux','ba1')).possible"), false);
R_(`byId('biens','bi1').dpe.classe='D';`);
// contrôles de conformité
t('Encadrement dépassé', R_("controlesBail(Object.assign({},byId('baux','ba1'),{loyerHC:720}), byId('biens','bi1')).some(c=>c.lv==='err' && /Encadrement/.test(c.t))"), true);
t('Dépôt trop élevé', R_("controlesBail(Object.assign({},byId('baux','ba1'),{depot:1400}), byId('biens','bi1')).some(c=>c.lv==='err' && /Dépôt/.test(c.t))"), true);
t('Bail mobilité sans dépôt', R_("depotMax({type:'mobilite', loyerHC:600})"), 0);
t('Meublé : 2 mois', R_("depotMax({type:'meuble', loyerHC:600})"), 1200);
// dépôt de garantie : délai et pénalité
R_(`const b=byId('baux','ba1'); b.fin={remiseCles:'2026-07-01', edlConforme:true};`);
t('Restitution : 1 mois, 3 mois de retard', R_("(r=>[r.limite,r.retard,r.penalite])(restitutionInfo(byId('baux','ba1')))"), ['2026-08-01',3,204]);
delete ctx.x;
// vétusté
t('Vétusté peinture 6 ans', R_("partLocataireVetuste(1000,'peinture',6)"), 428.57);
// documents : génération sans erreur
const types=Object.keys(R_('DOCS')).filter(k=>!['solde','conge'].includes(k));
let genErr=[];
R_(`byId('baux','ba1').fin=null; byId('baux','ba1').garants=[{type:'personne', nom:'Martin', prenom:'Jean', adresse:'Dijon'}];`);
for(const k of types){ try{ const html=R_(`DOCS['${k}'].gen(ctxBail('ba1'), {mois:'2026-07', annee:'2025', niveau:'1', montant:100, nouveau:690, effet:'2026-11-01', motif:'vente', prix:200000, remiseCles:'2026-07-01', retenues:'Peinture ; 100', typeAtt:'loyer_caf', rooms:[], dateReception:'2026-09-20', objet:'x', texte:'y', faits:'z', nature:'w', demande:'d', reponse:'accord', expose:'e', dateEffet:'2026-12-31', nb:3, debut:'2026-11-01', garant:0, plafond:20000, duree:'determinee', dateFin:'2029-03-10', items:'a\\nb'})`); if(!html || html.length<200) genErr.push(k); }catch(e){ genErr.push(k+': '+e.message); } }
t('Tous les modèles se génèrent ('+types.length+')', genErr, []);
console.log(`Tests : ${ok} réussis, ${ko} en échec.`);
process.exit(ko?1:0);
