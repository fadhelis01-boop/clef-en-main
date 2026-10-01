// Faux serveur GitHub (API « contents ») pour tester la synchronisation sans compte réel.
//   node tools/mock-github.js   → http://127.0.0.1:8793   (jeton accepté : test-token)
// Dans le navigateur : localStorage.setItem('cem-gh-api','http://127.0.0.1:8793') puis recharger.
const http=require('http'), crypto=require('crypto');
const files={}; let writes=0;
const send=(res, code, obj, raw)=>{ res.writeHead(code, {'Content-Type':raw?'text/plain':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,PUT,DELETE,OPTIONS','Access-Control-Expose-Headers':'*'}); res.end(raw?obj:JSON.stringify(obj)); };
http.createServer((req,res)=>{
  if(req.method==='OPTIONS') return send(res,204,{});
  if(req.url==='/__stats') return send(res,200,{writes, files:Object.keys(files)});
  if((req.headers.authorization||'')!=='Bearer test-token') return send(res,401,{message:'Bad credentials'});
  let body=''; req.on('data',d=>body+=d); req.on('end',()=>{
    const u=new URL(req.url,'http://x'); const p=u.pathname;
    if(p==='/user') return send(res,200,{login:'testeur'});
    let m=p.match(/^\/repos\/([^/]+)\/([^/]+)$/); if(m) return send(res,200,{private:true, permissions:{push:true}});
    m=p.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/); if(!m) return send(res,404,{});
    const path=decodeURIComponent(m[3]); const f=files[path];
    if(req.method==='GET'){
      if(!f){ const list=Object.keys(files).filter(k=>k.startsWith(path+'/')).map(k=>({path:k, sha:files[k].sha})); return list.length? send(res,200,list) : send(res,404,{message:'Not Found'}); }
      if((req.headers.accept||'').includes('raw')) return send(res,200,f.text,true);
      return send(res,200,{sha:f.sha, encoding:'base64', content:Buffer.from(f.text).toString('base64')});
    }
    if(req.method==='PUT'){
      const b=JSON.parse(body||'{}');
      if(f && !b.sha) return send(res,422,{message:'sha wasn\'t supplied'});
      if(f && b.sha!==f.sha) return send(res,409,{message:'conflict'});
      if(!f && b.sha) return send(res,409,{message:'conflict'});
      const text=Buffer.from(b.content,'base64').toString(); const sha=crypto.createHash('sha1').update(text+Date.now()+Math.random()).digest('hex');
      files[path]={text, sha}; writes++; return send(res,f?200:201,{content:{sha}});
    }
    if(req.method==='DELETE'){ delete files[path]; return send(res,200,{}); }
    send(res,405,{});
  });
}).listen(8793,'127.0.0.1',()=>console.log('mock GitHub prêt sur 8793'));
