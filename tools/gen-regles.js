// Génère regles.json (lu en ligne par l'appli) à partir de regles.js, source unique du référentiel.
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.join(__dirname,'..');
const ctx={console}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'regles.js'),'utf8')+'\n;this.REG_DEFAULT=REG_DEFAULT;', ctx);
fs.writeFileSync(path.join(root,'regles.json'), JSON.stringify(ctx.REG_DEFAULT,null,1));
console.log('regles.json : version', ctx.REG_DEFAULT.version);
