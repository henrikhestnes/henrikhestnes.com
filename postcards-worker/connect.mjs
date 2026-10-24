// Run after deployment: node connect.mjs https://your-worker.workers.dev https://your-homepage.example
import {readFileSync,writeFileSync} from 'node:fs';
const [workerOrigin,homepageOrigin]=process.argv.slice(2);
let api,home;
try{api=new URL(workerOrigin);home=new URL(homepageOrigin);if(api.protocol!=='https:'||home.protocol!=='https:'||api.username||api.password||home.username||home.password||api.search||api.hash||home.search||home.hash)throw new Error();}catch{console.error('Supply the deployed HTTPS Worker origin and the HTTPS homepage origin.');process.exit(1);}
const endpoint=api.origin+'/api/postcards';
const file=new URL('../index.html',import.meta.url),configFile=new URL('wrangler.jsonc',import.meta.url);
const html=readFileSync(file,'utf8').replace(/(<meta name="postcards-api" content=")[^"]*(">)/,`$1${endpoint}$2`).replace(/(<form id="postcard-form"[^>]* action=")[^"]*(")/,`$1${endpoint}$2`);
writeFileSync(file,html);
const config=JSON.parse(readFileSync(configFile,'utf8'));config.vars.PUBLIC_ORIGINS=home.origin;writeFileSync(configFile,JSON.stringify(config,null,2)+'\n');
console.log('Connected the homepage form and API metadata. Redeploy the Worker to apply the allowed homepage origin, then publish the updated homepage.');
