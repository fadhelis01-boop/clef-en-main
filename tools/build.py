# Fabrique la version publiable, en une commande :  python tools/build.py
#  1. vérifie la syntaxe de tous les scripts (node --check) ;
#  2. régénère regles.json à partir de regles.js ;
#  3. nomme le cache hors ligne (sw.js) d'après le contenu : tout changement déclenche le bandeau « Mettre à jour ».
import hashlib, os, re, subprocess, sys
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..')); os.chdir(ROOT)
SCRIPTS=['regles.js']+['js/'+f for f in ('core.js','store.js','metier.js','docs.js','envoi.js','edl.js','charges.js','ui.js','assistant.js','app.js')]
for f in SCRIPTS+['sw.js']:
    r=subprocess.run(['node','--check',f],capture_output=True,text=True)
    if r.returncode: print('ERREUR de syntaxe dans',f,'\n',r.stderr); sys.exit(1)
print('Syntaxe : OK')
subprocess.run(['node','tools/gen-regles.js'],check=True)
r=subprocess.run(['node','tools/tests.js'])
if r.returncode: print('Tests en échec : publication annulée.'); sys.exit(1)
sw=open('sw.js',encoding='utf-8').read()
files=re.findall(r"'\./([^']*)'", sw.split('const FILES')[1].split('];')[0])
for f in files:
    if f and not os.path.exists(f): print('ERREUR : fichier listé dans sw.js introuvable :',f); sys.exit(1)
version=re.search(r"APP_VERSION = '([^']+)'", open('js/core.js',encoding='utf-8').read()).group(1)
h=hashlib.sha256()
for f in ['index.html','app.css','manifest.webmanifest','regles.json']+SCRIPTS: h.update(open(f,'rb').read())
cache='clef-en-main-'+version+'-'+h.hexdigest()[:8]
sw=re.sub(r"const CACHE = '[^']*';","const CACHE = '"+cache+"';",sw)
open('sw.js','w',encoding='utf-8',newline='\n').write(sw)
print('Cache hors ligne :',cache)
