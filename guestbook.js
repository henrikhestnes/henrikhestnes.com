// Approved postcards live on the server; this client never treats browser storage as the guestbook.
(() => {
 const section=document.getElementById('guestbook'),form=document.getElementById('postcard-form');
 if(!section||!form)return;
 const list=document.getElementById('postcards'),status=document.getElementById('postcard-status');
 const submit=form.querySelector('button[type=submit]'),retry=document.getElementById('postcard-retry');
 const endpoint=document.querySelector('meta[name=postcards-api]')?.content.trim()||'/api/postcards';
 let requestId=crypto.randomUUID(),loading=false;
 submit.disabled=true;
 if(/^https:\/\//.test(endpoint))form.action=endpoint;
 const controller=()=>{const c=new AbortController();const timer=setTimeout(()=>c.abort(),10000);return {signal:c.signal,done:()=>clearTimeout(timer)};};
 async function load(){
  if(loading)return;loading=true;retry.hidden=true;
  const timeout=controller();
  try{
   const r=await fetch(endpoint,{signal:timeout.signal,credentials:'omit',cache:'no-store'});
   if(!r.ok)throw new Error();const data=await r.json();if(!Array.isArray(data.postcards))throw new Error();
   list.replaceChildren();
   if(!data.postcards.length){const p=document.createElement('p');p.className='postcard-empty';p.textContent='No postcards yet. Yours could be the first.';list.append(p);}
   for(const card of data.postcards){
    const article=document.createElement('article'),note=document.createElement('p'),footer=document.createElement('footer'),name=document.createElement('strong'),city=document.createElement('span'),date=document.createElement('time');
    article.className='postcard';note.className='postcard-note';note.textContent=card.message;name.textContent=card.name;city.textContent=card.city||'Somewhere in the world';
    const created=new Date(card.created_at);date.dateTime=created.toISOString();date.textContent=created.toLocaleDateString(undefined,{month:'short',year:'numeric'});
    footer.append(name,city,date);article.append(note,footer);list.append(article);
   }
   submit.disabled=false;status.textContent='';section.dataset.connected='true';
  }catch{status.textContent='The guestbook is taking a short break. Please try again soon.';retry.hidden=false;submit.disabled=true;}
  finally{timeout.done();loading=false;}
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!form.reportValidity())return;submit.disabled=true;status.textContent='Sending your postcard…';
  const data=Object.fromEntries(new FormData(form));data.id=requestId;
  const timeout=controller();
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify(data),signal:timeout.signal});
   const body=await r.json();if(!r.ok)throw new Error(body.error||'Your postcard could not be sent. Please try again.');
   status.textContent=body.message;form.reset();requestId=crypto.randomUUID();
  }catch(e){status.textContent=e.name==='AbortError'?'That took a little too long. Your message is still here; please try again.':e.message;}
  finally{timeout.done();submit.disabled=false;}
 });
 retry.addEventListener('click',load);
 // Revisit from another tab/device and see newly approved cards without a permanent polling loop.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&section.dataset.connected==='true')load();});
 load();
})();
