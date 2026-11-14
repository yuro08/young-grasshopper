import{readFile}from'node:fs/promises';
import{access}from'node:fs/promises';for(const f of ['public/index.html','public/app.js','public/styles.css','public/core.js','api/generate.js','api/auth.js','api/state.js','supabase/schema.sql','public/auth-callback.html','public/callback.js'])await access(f);console.log('Vercel static assets and API present.');

for(const name of ["index.mjs","LICENSE"]){const upstream=await readFile("node_modules/ts-fsrs/"+(name==="LICENSE"?name:"dist/"+name));const vendor=await readFile("public/vendor/"+(name==="LICENSE"?"ts-fsrs-LICENSE.txt":"ts-fsrs-5.4.2.mjs"));if(!upstream.equals(vendor))throw Error("Vendored FSRS differs from pinned dependency");}console.log("Pinned FSRS vendor matches installed package.");
