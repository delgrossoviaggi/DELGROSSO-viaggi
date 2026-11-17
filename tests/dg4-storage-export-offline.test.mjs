// Offline unit tests for DG4 Storage exporter; no real Supabase requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {exportBucket} from '../scripts/dg4-export-storage.mjs';

const projectId='chkuayhbmitdmzmmvona', bucket='ricevute-prenotazioni';
function fakeBackend({malicious=false}={}) {
  const calls=[];
  async function backend(url,options={}) {
    calls.push({url,method:options.method??'GET'});
    const u=new URL(url);
    if(u.pathname.endsWith('/object/list/'+bucket)) {
      const body=JSON.parse(options.body);
      const items = body.prefix === '' ?
        [{name:malicious?'..':'2026',id:null,metadata:null},{name:'root.pdf',id:'root',metadata:{size:3}}] :
        [{name:'receipt.pdf',id:'nested',metadata:{size:4}}];
      return new Response(JSON.stringify(items), {status:200,headers:{'content-type':'application/json'}});
    }
    if(u.pathname.endsWith('/root.pdf')) return new Response(Buffer.from('PDF'),{status:200});
    if(u.pathname.endsWith('/2026/receipt.pdf')) return new Response(Buffer.from('TEST'),{status:200});
    return new Response('missing',{status:404});
  }
  return {backend,calls};
}
test('exports nested and root files, preserving bytes and SHA-256',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'dg4-storage-test-'));
  try {
    const {backend,calls}=fakeBackend();
    const records=await exportBucket({fetcher:backend,projectId,bucket,key:'offline-test-token',root});
    assert.equal(records.length,2);
    assert.equal((await readFile(path.join(root,bucket,'root.pdf'))).toString(),'PDF');
    assert.equal((await readFile(path.join(root,bucket,'2026','receipt.pdf'))).toString(),'TEST');
    assert.ok(records.every(x=>x.sha256.length===64));
    assert.equal(calls.filter(x=>x.method==='POST').length,2);
    assert.equal(records.reduce((n,r)=>n+r.size,0),7);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('rejects Storage path traversal',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'dg4-storage-test-'));
  try {
    const {backend}=fakeBackend({malicious:true});
    await assert.rejects(
      exportBucket({fetcher:backend,projectId,bucket,key:'offline-test-token',root}),
      /Invalid Storage path segment/
    );
  } finally {await rm(root,{recursive:true,force:true});}
});
test('rejects unapproved projects, buckets and missing credentials',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'dg4-storage-test-'));
  try {
    const {backend}=fakeBackend();
    await assert.rejects(exportBucket({fetcher:backend,projectId:'unknown',bucket,key:'x',root}));
    await assert.rejects(exportBucket({fetcher:backend,projectId,bucket:'unknown',key:'x',root}));
    await assert.rejects(exportBucket({fetcher:backend,projectId,bucket,key:'',root}));
  } finally {await rm(root,{recursive:true,force:true});}
});
