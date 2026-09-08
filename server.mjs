import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
function safePath(urlPath){
  const clean = decodeURIComponent((urlPath.split('?')[0] || '/').replaceAll('\\','/'));
  const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const full = path.resolve(ROOT, rel);
  return full.startsWith(ROOT + path.sep) || full === ROOT ? full : null;
}
const server = http.createServer((req,res)=>{
  if(req.method !== 'GET' && req.method !== 'HEAD'){res.writeHead(405);return res.end('Method Not Allowed');}
  const full = safePath(req.url || '/');
  if(!full){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(full,(err,st)=>{
    if(err || !st.isFile()){
      res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); return res.end('404 - File non trovato');
    }
    const ext=path.extname(full).toLowerCase();
    const headers={'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':'no-cache'};
    res.writeHead(200,headers);
    if(req.method==='HEAD') return res.end();
    fs.createReadStream(full).pipe(res);
  });
});
server.listen(PORT,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${PORT}/`;
  console.log(`DELGROSSO SITO avviato: ${url}`);
  console.log(`Gestionale: ${url}GESTIONALE/login.html`);
  if(process.platform==='win32') spawn('cmd',['/c','start','',`${url}GESTIONALE/login.html`],{detached:true,stdio:'ignore'}).unref();
});
