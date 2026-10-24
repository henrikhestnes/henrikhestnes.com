import { ADMIN_HTML, ADMIN_JS } from './admin.mjs';

const enc=new TextEncoder();
const security={
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'Cache-Control':'no-store'
};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{...security,'Content-Type':'application/json; charset=utf-8',...headers}});
const html=(body,status=200,headers={})=>new Response(body,{status,headers:{...security,'Content-Type':'text/html; charset=utf-8',...headers}});
const publicHeaders={'Access-Control-Allow-Origin':'*'};
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const unb64=text=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function signingKey(secret){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function sign(value,secret){return b64(new Uint8Array(await crypto.subtle.sign('HMAC',await signingKey(secret),enc.encode(value))));}
async function passwordMatches(a,b){
 const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',enc.encode(s))));
 return new Uint8Array(x).reduce((sum,v,i)=>sum|(v^new Uint8Array(y)[i]),0)===0;
}
async function isOwner(request,env){
 if(!env.ADMIN_PASSWORD)return false;
 const token=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('postcards_owner='))?.slice(16);
 if(!token)return false;
 try{
  const [expires,signature,...extra]=token.split('.');
  if(extra.length||!/^\d+$/.test(expires)||Number(expires)<Date.now()||Number(expires)>Date.now()+43200000)return false;
  return crypto.subtle.verify('HMAC',await signingKey(env.ADMIN_PASSWORD),unb64(signature),enc.encode(expires));
 }catch{return false;}
}
function originAllowed(request,env){
 const origin=request.headers.get('Origin'),own=new URL(request.url).origin;
 if(origin===own)return true;
 if(origin==='null'&&env.ALLOW_FILE_PREVIEW==='true')return true;
 return (env.PUBLIC_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean).includes(origin);
}
async function readInput(request){
 const type=(request.headers.get('Content-Type')||'').split(';')[0];
 if(!['application/json','application/x-www-form-urlencoded'].includes(type))throw new Error('Use a supported form format.');
 if(Number(request.headers.get('Content-Length'))>8192)throw new Error('This postcard is too long.');
 const reader=request.body?.getReader();let size=0;const chunks=[];
 if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new Error('This postcard is too long.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const text=new TextDecoder().decode(bytes);
 try{return type==='application/json'?JSON.parse(text):Object.fromEntries(new URLSearchParams(text));}catch{throw new Error('The postcard could not be read.');}
}
function text(value,max){if(typeof value!=='string'||value.length>max)throw new Error('Please check the field lengths.');return value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');}
async function rateLimit(request,env,kind,limit,seconds){
 const now=Date.now(),bucket=Math.floor(now/(seconds*1000));
 const ip=request.headers.get('CF-Connecting-IP')||'local';
 const digest=await sign(`${kind}:${bucket}:${ip}`,env.ADMIN_PASSWORD);
 const key=`${kind}:${digest}`;
 await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
 const row=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count').bind(key,now+seconds*2000,limit).first();
 return Boolean(row);
}
function received(request){
 if((request.headers.get('Content-Type')||'').startsWith('application/json'))return json({ok:true,message:'Thank you. Your postcard will appear after Henrik approves it.'},202,publicHeaders);
 return new Response(null,{status:303,headers:{...security,Location:'/thanks'}});
}
// ---------- Owner notification: Cloudflare Email Workers send binding, no third party ----------
const b64std=text=>btoa(String.fromCharCode(...enc.encode(text)));
const headerSafe=value=>String(value).replace(/[\r\n]+/g,' ').trim();
const encodedWord=value=>/^[\x20-\x7e]*$/.test(value)?value:`=?UTF-8?B?${b64std(value)}?=`;
export function postcardNotification(card,from,to,adminUrl){
 const name=headerSafe(card.name),city=headerSafe(card.city||'');
 const subject=`New postcard from ${name}${city?` (${city})`:''}`;
 const when=new Date(card.created_at);
 const body=['A new postcard is waiting for you.','',`From: ${name}`,`City: ${city||'—'}`,`Sent: ${when.toUTCString()}`,'',card.message,'',`Review it: ${adminUrl}`,'','Nothing is public until you approve it.'].join('\r\n');
 const encodedBody=b64std(body).replace(/.{76}/g,'$&\r\n');
 return [`From: Postcards <${from}>`,`To: <${to}>`,`Subject: ${encodedWord(subject)}`,`Date: ${when.toUTCString()}`,`Message-ID: <${card.id}@${from.split('@')[1]||'postcards'}>`,'MIME-Version: 1.0','Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64','',encodedBody,''].join('\r\n');
}
async function notifyOwner(env,card,adminUrl){
 if(!env.NOTIFY||!env.NOTIFY_TO||!env.NOTIFY_FROM)return;
 try{
  const raw=postcardNotification(card,env.NOTIFY_FROM,env.NOTIFY_TO,adminUrl);
  const mod=await import('cloudflare:email').catch(()=>null);
  const message=mod?.EmailMessage?new mod.EmailMessage(env.NOTIFY_FROM,env.NOTIFY_TO,raw):{from:env.NOTIFY_FROM,to:env.NOTIFY_TO,raw};
  await env.NOTIFY.send(message);
 }catch(error){console.error('Postcard notification failed',error?.message||error);}
}
const thanks='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Postcard received</title><style>body{max-width:36rem;margin:15vh auto;padding:2rem;background:#F2EBDD;color:#173C3A;font:18px/1.6 system-ui}h1{font-size:2.5rem}</style><h1>Postcard received.</h1><p>Thank you for saying hello. Your note will appear after Henrik approves it.</p><p>You can return to the homepage using your browser’s Back button.</p></html>';

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  const cors=path==='/api/postcards'?publicHeaders:{};
  try{
   if(method==='OPTIONS'&&path==='/api/postcards')return new Response(null,{status:204,headers:{...security,...publicHeaders,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
   if(method==='GET'&&path==='/thanks')return html(thanks);
   if(method==='GET'&&path==='/admin')return html(ADMIN_HTML);
   if(method==='GET'&&path==='/admin.js')return new Response(ADMIN_JS,{headers:{...security,'Content-Type':'text/javascript; charset=utf-8'}});
   if(!path.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):json({error:'Not found'},404);
   if(!env.DB||!env.ADMIN_PASSWORD)return json({error:'The guestbook is temporarily unavailable.'},503,cors);
   if(method==='GET'&&path==='/api/postcards'){
    const data=await env.DB.prepare("SELECT id,name,city,message,created_at FROM postcards WHERE status='approved' ORDER BY created_at DESC,id DESC LIMIT 30").all();
    return json({postcards:data.results},200,publicHeaders);
   }
   if(method==='POST'&&path==='/api/postcards'){
    if(!originAllowed(request,env))return json({error:'Please send your postcard from Henrik’s homepage.'},403,publicHeaders);
    let data;try{data=await readInput(request);}catch(e){return json({error:e.message},400,publicHeaders);}
    if(!data||typeof data!=='object')return json({error:'Please complete the postcard.'},400,publicHeaders);
    if(data.website)return received(request); // Invisible honeypot; no record is written.
    let name,city,message;
    try{name=text(data.name,60);city=text(data.city||'',80);message=text(data.message,500);}catch(e){return json({error:e.message},400,publicHeaders);}
    if(!name||!message)return json({error:'Please add your name and a message.'},400,publicHeaders);
    const id=data.id||crypto.randomUUID();
    if(typeof id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return json({error:'Please refresh the form and try again.'},400,publicHeaders);
    if(await env.DB.prepare('SELECT id FROM postcards WHERE id=?').bind(id).first())return received(request);
    if(!await rateLimit(request,env,'post',3,3600))return json({error:'You’ve sent a few postcards already. Please try again in an hour.'},429,{...publicHeaders,'Retry-After':'3600'});
    const createdAt=Date.now();
    const inserted=await env.DB.prepare("INSERT INTO postcards(id,name,city,message,status,created_at) VALUES (?,?,?,?,'pending',?) ON CONFLICT(id) DO NOTHING").bind(id,name,city,message,createdAt).run();
    if(inserted.meta?.changes!==0){
     const notice=notifyOwner(env,{id,name,city,message,created_at:createdAt},`${url.origin}/admin`);
     if(ctx?.waitUntil)ctx.waitUntil(notice);else await notice;
    }
    return received(request);
   }
   if(path.startsWith('/api/admin/')){
    if(method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin.'},403);
    if(path==='/api/admin/login'&&method==='POST'){
     if(!await rateLimit(request,env,'login',8,600))return json({error:'Please try again in ten minutes.'},429);
     let data;try{data=await readInput(request);}catch{return json({error:'Invalid sign-in.'},400);}
     if(typeof data?.password!=='string'||data.password.length>256||!await passwordMatches(data.password,env.ADMIN_PASSWORD))return json({error:'The password was not accepted.'},401);
     const expires=String(Date.now()+43200000),token=`${expires}.${await sign(expires,env.ADMIN_PASSWORD)}`;
     return json({ok:true},200,{'Set-Cookie':`postcards_owner=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin/; Max-Age=43200`});
    }
    if(!await isOwner(request,env))return json({error:'Sign in to manage postcards.'},401);
    if(path==='/api/admin/logout'&&method==='POST')return json({ok:true},200,{'Set-Cookie':'postcards_owner=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin/; Max-Age=0'});
    if(path==='/api/admin/postcards'&&method==='GET'){
     const status=url.searchParams.get('status')==='approved'?'approved':'pending';
     return json({postcards:(await env.DB.prepare('SELECT id,name,city,message,status,created_at FROM postcards WHERE status=? ORDER BY created_at DESC LIMIT 100').bind(status).all()).results});
    }
    const match=path.match(/^\/api\/admin\/postcards\/([0-9a-f-]{36})\/(approve|delete)$/i);
    if(match&&method==='POST'){
     const result=match[2]==='approve'?await env.DB.prepare("UPDATE postcards SET status='approved' WHERE id=?").bind(match[1]).run():await env.DB.prepare('DELETE FROM postcards WHERE id=?').bind(match[1]).run();
     if(!result.meta.changes)return json({error:'This postcard was not found.'},404);
     return json({ok:true});
    }
   }
   return json({error:'Not found'},404,cors);
  }catch(error){console.error('Postcard request failed',error?.name||'Error');return json({error:'The guestbook is temporarily unavailable. Please try again soon.'},503,cors);}
 }
};
