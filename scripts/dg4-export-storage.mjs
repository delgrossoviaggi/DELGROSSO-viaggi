/**
 * DELGROSSO VIAGGI 4.0 — COPIA FISICA DELLO STORAGE
 * Node.js 20+, nessuna dipendenza NPM. SOLO LETTURA rispetto a Supabase.
 *
 * Variabili d'ambiente configurate SOLO sulla postazione autorizzata:
 *  DG4_PROJECT_ID = chkuayhbmitdmzmmvona  oppure  bhsanrbadsqcpbtxupmr
 *  DG4_SUPABASE_SERVICE_KEY = chiave privata del PROPRIO progetto (non committare!)
 *  DG4_BACKUP_ROOT = cartella locale PRIVATA fuori dal repository
 *
 * Avvio: node scripts/dg4-export-storage.mjs
 * Output: data directory separata per progetto/data e manifest.json con SHA-256.
 * IMPORTANTE: non caricare la cartella backup su GitHub/cloud non autorizzati.
 */
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_BUCKETS = Object.freeze({
  chkuayhbmitdmzmmvona: Object.freeze([
    'gestionale-documenti','ricevute-prenotazioni','preventivi-pdf',
    'locandine','buses','bus-images','trip-images'
  ]),
  bhsanrbadsqcpbtxupmr: Object.freeze(['site-media'])
});
const REQUEST_TIMEOUT_MS = 90_000;
const PAGE_SIZE = 100;

function assertPathPiece(v) {
  if (typeof v !== 'string' || !v || v === '.' || v === '..' ||
      v.includes('/') || v.includes('\\') || /[\u0000-\u001f]/.test(v) ||
      /^[A-Za-z]:/.test(v)) throw new Error('Invalid Storage path segment');
  return v;
}

function secureDestination(root, pieces) {
  const base = path.resolve(root);
  const p = path.resolve(base, ...pieces.map(assertPathPiece));
  if (!p.startsWith(base + path.sep)) throw new Error('Path escaping backup root');
  return p;
}

async function fetchLimited(fetcher, url, options={}) {
  let last;
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const res = await fetcher(url, {
        ...options,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) {
        throw new Error('Storage API rejected request (HTTP '+res.status+')');
      }
      last = new Error('Storage API temporarily unavailable (HTTP '+res.status+')');
    } catch (error) {
      last = error;
      if (String(error?.message).includes('rejected request')) break;
    }
    if (attempt<2) await new Promise(r=>setTimeout(r,(attempt+1)*1000));
  }
  throw last ?? new Error('Unknown Storage API error');
}

async function listFolder({fetcher,api,bucket,headers,prefix}) {
  const entries=[];
  for (let offset=0; ; offset+=PAGE_SIZE) {
    const response=await fetchLimited(fetcher,
      api+'/storage/v1/object/list/'+encodeURIComponent(bucket), {
        method:'POST',headers: {...headers,'Content-Type':'application/json'},
        body:JSON.stringify({prefix,limit:PAGE_SIZE,offset,sortBy:{column:'name',order:'asc'}})
      });
    const page=await response.json();
    if (!Array.isArray(page)) throw new Error('Unexpected Storage list response');
    entries.push(...page);
    if (page.length < PAGE_SIZE) break;
    if (offset>1_000_000) throw new Error('Storage folder pagination limit exceeded');
  }
  return entries;
}

export async function exportBucket({fetcher=fetch,projectId,bucket,key,root}) {
  if (!PROJECT_BUCKETS[projectId]?.includes(bucket)) throw new Error('Project/bucket not allowlisted');
  if (!key) throw new Error('Storage authorization missing');
  if (!path.isAbsolute(root)) throw new Error('Backup root must be an absolute path');
  const base=path.resolve(root);
  const api='https://'+projectId+'.supabase.co';
  const headers={apikey:key,Authorization:'Bearer '+key};
  const records=[],seenObjects=new Set(),visitedFolders=new Set();
  async function traverse(prefix='') {
    if (visitedFolders.has(prefix)) throw new Error('Duplicate folder traversal');
    visitedFolders.add(prefix);
    const entries=await listFolder({fetcher,api,bucket,headers,prefix});
    for (const item of entries) {
      const name=assertPathPiece(item?.name);
      if (!item.id && item.metadata == null) {
        await traverse(prefix+name+'/');
        continue;
      }
      const objectPath=prefix+name;
      if (seenObjects.has(objectPath)) throw new Error('Repeated object in listing');
      seenObjects.add(objectPath);
      const parts=objectPath.split('/').map(assertPathPiece);
      const target=secureDestination(base,[bucket,...parts]);
      const temp=target+'.partial';
      await mkdir(path.dirname(target),{recursive:true,mode:0o700});
      const u=api+'/storage/v1/object/'+encodeURIComponent(bucket)+'/'+parts.map(encodeURIComponent).join('/');
      const res=await fetchLimited(fetcher,u,{headers});
      if (!res.body) throw new Error('Empty file response stream');
      const digest=createHash('sha256');
      let bytes=0;
      const hashStream=new Transform({transform(chunk,_enc,callback){
        bytes+=chunk.length; digest.update(chunk); callback(null,chunk);
      }});
      try {
        await pipeline(Readable.fromWeb(res.body),hashStream,createWriteStream(temp,{flags:'wx',mode:0o600}));
        const expected=Number(item.metadata?.size);
        if (Number.isFinite(expected) && expected>=0 && bytes!==expected) {
          throw new Error('Downloaded size mismatch for an object');
        }
        await rename(temp,target);
      } catch (err) {
        await rm(temp,{force:true}).catch(()=>{});
        throw err;
      }
      records.push({bucket,path:objectPath,size:bytes,sha256:digest.digest('hex')});
    }
  }
  await traverse();
  return records;
}

export async function run(env=process.env,fetcher=fetch) {
  const projectId=String(env.DG4_PROJECT_ID||'').trim();
  const key=String(env.DG4_SUPABASE_SERVICE_KEY||'').trim();
  const root=String(env.DG4_BACKUP_ROOT||'').trim();
  if (!PROJECT_BUCKETS[projectId]) throw new Error('Invalid project ID');
  if (!key) throw new Error('DG4_SUPABASE_SERVICE_KEY is not set');
  if (!root || !path.isAbsolute(root)) throw new Error('Use an absolute, private DG4_BACKUP_ROOT');
  const folder=path.resolve(root,projectId,new Date().toISOString().replace(/[:.]/g,'-'));
  await mkdir(folder,{recursive:true,mode:0o700});
  const all=[];
  for(const bucket of PROJECT_BUCKETS[projectId]) {
    const items=await exportBucket({fetcher,projectId,bucket,key,root:folder});
    all.push(...items);
    console.log('Bucket verified:',bucket,'files:',items.length);
  }
  const manifest={
    format:'DG4-Storage-Backup-v1',project_id:projectId,
    generated_at:new Date().toISOString(),count:all.length,
    bytes:all.reduce((n,x)=>n+x.size,0),files:all
  };
  const manifestPath=path.join(folder,'manifest.json');
  await writeFile(manifestPath,JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
  const manifestSha=createHash('sha256').update(JSON.stringify(manifest,null,2)).digest('hex');
  await writeFile(path.join(folder,'manifest.sha256'),manifestSha+'  manifest.json\n',{mode:0o600,flag:'wx'});
  console.log('Storage export completed:',projectId,'files:',manifest.count,'bytes:',manifest.bytes);
  console.log('Manifest SHA-256:',manifestSha);
  console.log('IMPORTANT: verify recovery on an isolated staging environment; this is not a PostgreSQL backup.');
  return manifest;
}
if (process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  run().catch(e=>{console.error('BACKUP FAILED:',String(e?.message||e));process.exitCode=1;});
}
