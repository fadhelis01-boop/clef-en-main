/* =====================================================================================
   CORE — utilitaires communs (dates locales, montants, échappement, fenêtres, messages)
   ===================================================================================== */
const APP_VERSION = '2.3.0';
const MAX_BIENS = 6;

function uid(p){ return (p||'id')+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function esc(s){ return (s===undefined||s===null?'':String(s)).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function num(v){ const n = parseFloat(String(v===undefined||v===null?'':v).replace(',', '.').replace(/\s/g,'')); return isNaN(n)?0:n; }
function r2(n){ return Math.round((n+Number.EPSILON)*100)/100; }
function eur(n){ return num(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }
function eur0(n){ return Math.round(num(n)).toLocaleString('fr-FR')+' €'; }

/* ---- Dates : toujours en heure locale (jamais toISOString qui passe en UTC) ---- */
function isoOf(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayISO(){ return isoOf(new Date()); }
function parseISO(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,(m||1)-1,d||1); }
function fdate(iso){ if(!iso) return '—'; const d=parseISO(iso.slice(0,10)); return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }
function fdateCourt(iso){ if(!iso) return '—'; const d=parseISO(iso.slice(0,10)); return d.toLocaleDateString('fr-FR'); }
function addDays(iso,n){ const d=parseISO(iso); d.setDate(d.getDate()+n); return isoOf(d); }
function addMonths(iso,n){
  const d=parseISO(iso); const day=d.getDate();
  d.setDate(1); d.setMonth(d.getMonth()+n);
  const dim=new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  d.setDate(Math.min(day,dim)); return isoOf(d);
}
function diffDays(a,b){ return Math.round((parseISO(b)-parseISO(a))/86400000); }
function monthKey(iso){ return iso.slice(0,7); }
function monthFirst(key){ return key+'-01'; }
function monthLast(key){ const [y,m]=key.split('-').map(Number); return isoOf(new Date(y,m,0)); }
function daysInMonth(key){ const [y,m]=key.split('-').map(Number); return new Date(y,m,0).getDate(); }
function nextMonthKey(key){ const [y,m]=key.split('-').map(Number); return isoOf(new Date(y,m,1)).slice(0,7); }
function prevMonthKey(key){ const [y,m]=key.split('-').map(Number); return isoOf(new Date(y,m-2,1)).slice(0,7); }
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function monthLabel(key){ if(!key) return '—'; const [y,m]=key.split('-').map(Number); return MOIS[m-1]+' '+y; }
function monthLabelCap(key){ const s=monthLabel(key); return s.charAt(0).toUpperCase()+s.slice(1); }
/* « Mars 2026 » → « 2026-03 » (reprise des anciennes quittances) */
function parseMoisTexte(t){
  if(!t) return null; const s=t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const noms=MOIS.map(m=>m.normalize('NFD').replace(/[̀-ͯ]/g,''));
  const y=(s.match(/(20\d\d)/)||[])[1]; if(!y) return null;
  const i=noms.findIndex(n=>s.includes(n)); if(i<0) return null;
  return y+'-'+String(i+1).padStart(2,'0');
}
function trimestreOf(iso){ const d=parseISO(iso); return d.getFullYear()+'-T'+(Math.floor(d.getMonth()/3)+1); }
function trimestreLabel(t){ if(!t) return '—'; const [y,q]=t.split('-T'); return (q==='1'?'1er':q+'e')+' trimestre '+y; }

/* ---- Messages et fenêtres ---- */
function toast(msg, ms){
  const t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(), ms||2800);
}
let MODAL_STACK = [];
/* openModal({title, body, actions:[{label, cls, onClick(close) → false pour garder ouvert}], wide, onOpen}) */
function openModal(opt){
  const bg=document.createElement('div'); bg.className='modalbg';
  const id=uid('m');
  bg.innerHTML=`<div class="modal ${opt.wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="${id}">
    <div class="modal-head"><h2 id="${id}">${opt.title}</h2><button class="closebtn" aria-label="Fermer">✕</button></div>
    <div class="modal-body">${opt.body||''}</div>
    ${(opt.actions&&opt.actions.length)?`<div class="modal-foot">${opt.actions.map((a,i)=>`<button class="btn ${a.cls||'btn-ghost'}" data-act="${i}">${a.label}</button>`).join('')}</div>`:''}
  </div>`;
  const close=()=>{ bg.remove(); MODAL_STACK=MODAL_STACK.filter(x=>x!==bg); document.removeEventListener('keydown', onKey); };
  const onKey=e=>{ if(e.key==='Escape' && MODAL_STACK[MODAL_STACK.length-1]===bg) close(); };
  document.addEventListener('keydown', onKey);
  bg.querySelector('.closebtn').onclick=close;
  bg.addEventListener('mousedown', e=>{ if(e.target===bg && !opt.sticky) close(); });
  (opt.actions||[]).forEach((a,i)=>{
    bg.querySelector(`[data-act="${i}"]`).onclick=async()=>{ const r = a.onClick ? await a.onClick(close, bg) : undefined; if(r!==false) close(); };
  });
  document.body.appendChild(bg); MODAL_STACK.push(bg);
  try{ if(typeof annoterLexique==='function') annoterLexique(bg.querySelector('.modal-body')); }catch(e){}
  const first=bg.querySelector('.modal-body input:not([type=hidden]):not([disabled]), .modal-body select, .modal-body textarea');
  if(first && !opt.noFocus) setTimeout(()=>first.focus(), 30);
  if(opt.onOpen) opt.onOpen(bg, close);
  return {el:bg, close};
}
function confirmBox(title, html, okLabel, danger){
  return new Promise(res=>{
    openModal({title, body:`<div class="prose">${html}</div>`, actions:[
      {label:'Annuler', cls:'btn-ghost', onClick:()=>res(false)},
      {label:okLabel||'Confirmer', cls:danger?'btn-brick':'btn-teal', onClick:()=>res(true)}
    ], onOpen:(bg)=>{ bg.querySelector('.closebtn').addEventListener('click',()=>res(false)); }});
  });
}
function promptBox(title, label, def){
  return new Promise(res=>{
    openModal({title, body:`<div class="field"><label>${label}</label><input type="text" id="pbx" value="${esc(def||'')}"></div>`, actions:[
      {label:'Annuler', onClick:()=>res(null)},
      {label:'Valider', cls:'btn-teal', onClick:(c,bg)=>res(bg.querySelector('#pbx').value.trim()||null)}
    ]});
  });
}

/* ---- Formulaires déclaratifs ----
   champ : {n:nom, l:libellé, t:'text'|'number'|'date'|'month'|'select'|'textarea'|'check'|'radio'|'info', v:valeur,
            o:[[valeur,libellé]], h:aide, req:true, col:2|3 (largeur), step, min, max, show:fn(valeurs)} */
function fieldHtml(f, prefix){
  const id=(prefix||'f')+'_'+f.n;
  const v = f.v===undefined||f.v===null ? '' : f.v;
  const help = f.h ? `<div class="hint">${f.h}</div>` : '';
  const req = f.req ? ' required' : '';
  if(f.t==='info') return `<div class="field infobox ${f.cls||''}" data-fname="${f.n||''}">${f.l}</div>`;
  if(f.t==='check') return `<div class="field checkfield" data-fname="${f.n}"><label class="check"><input type="checkbox" name="${f.n}" id="${id}" ${v?'checked':''}> <span>${f.l}</span></label>${help}</div>`;
  if(f.t==='radio') return `<div class="field" data-fname="${f.n}"><div class="flabel">${f.l}</div><div class="radios">${f.o.map(([val,lab])=>`<label class="radio ${String(v)===String(val)?'on':''}"><input type="radio" name="${f.n}" value="${esc(val)}" ${String(v)===String(val)?'checked':''}> <span>${lab}</span></label>`).join('')}</div>${help}</div>`;
  let input;
  if(f.t==='select') input=`<select name="${f.n}" id="${id}"${req}>${f.o.map(([val,lab])=>`<option value="${esc(val)}" ${String(v)===String(val)?'selected':''}>${esc(lab)}</option>`).join('')}</select>`;
  else if(f.t==='textarea') input=`<textarea name="${f.n}" id="${id}" rows="${f.rows||3}" placeholder="${esc(f.ph||'')}"${req}>${esc(v)}</textarea>`;
  else {
    const type = f.t==='number' ? 'text' : (f.t||'text');
    const im = f.t==='number' ? ` inputmode="decimal" data-num="1"` : '';
    input=`<input type="${type}" name="${f.n}" id="${id}" value="${esc(v)}" placeholder="${esc(f.ph||'')}"${im}${req}${f.min?` min="${f.min}"`:''}${f.max?` max="${f.max}"`:''}${f.ro?' readonly':''}>`;
  }
  return `<div class="field" data-fname="${f.n}"><label for="${id}">${f.l}${f.req?' <span class="req">*</span>':''}</label>${input}${help}</div>`;
}
function formHtml(fields, prefix){
  let out='', row=[];
  const flush=()=>{ if(row.length){ out+= row.length>1 ? `<div class="grid${row.length}">${row.join('')}</div>` : row[0]; row=[]; } };
  fields.forEach(f=>{
    if(f.t==='section'){ flush(); out+=`<h3 class="fsect">${f.l}</h3>${f.h?`<p class="hint">${f.h}</p>`:''}`; return; }
    const h=fieldHtml(f,prefix);
    if(f.col){ row.push(h); if(row.length>=f.col){ flush(); } }
    else { flush(); out+=h; }
  });
  flush(); return out;
}
function formValues(root){
  const o={};
  root.querySelectorAll('input[name],select[name],textarea[name]').forEach(el=>{
    if(el.type==='checkbox') o[el.name]=el.checked;
    else if(el.type==='radio'){ if(el.checked) o[el.name]=el.value; else if(!(el.name in o)) o[el.name]=''; }
    else o[el.name]= el.dataset.num ? (el.value.trim()===''?'':num(el.value)) : el.value.trim();
  });
  return o;
}
function formCheckRequired(root){
  for(const el of root.querySelectorAll('[required]')){
    if(!String(el.value||'').trim()){ el.focus(); el.classList.add('err'); toast('Merci de compléter : '+(el.closest('.field')?.querySelector('label')?.textContent||'champ obligatoire').replace('*','').trim()); return false; }
  }
  return true;
}
/* radios cliquables (style) */
document.addEventListener('change', e=>{
  if(e.target.type==='radio'){
    const grp=e.target.closest('.radios'); if(grp) grp.querySelectorAll('.radio').forEach(l=>l.classList.toggle('on', l.querySelector('input').checked));
  }
  if(e.target.classList && e.target.classList.contains('err')) e.target.classList.remove('err');
});

function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function downloadBlob(blob, name){
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 5000);
}
function slug(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,40); }
function plural(n, s, p){ return n+' '+(n>1?(p||s+'s'):s); }
