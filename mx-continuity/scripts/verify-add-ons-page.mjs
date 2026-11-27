import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const fail=message=>{throw new Error("MX Continuity add-ons QA FAIL: "+message)};
const home=read("index.html"),page=read("add-ons.html"),css=read("assets/add-ons.css"),js=read("assets/add-ons.js");
const ids=[...page.matchAll(/<article class="addon-card" id="([^"]+)">/g)].map(m=>m[1]);
const help=[...page.matchAll(/<details class="addon-help">/g)];
if(ids.length!==19)fail("expected all 19 menu items, found "+ids.length);
if(new Set(ids).size!==ids.length)fail("add-on IDs are not unique");
if(help.length!==19)fail("every item must have a help disclosure");
if((page.match(/<summary aria-label="Details for /g)||[]).length!==19)fail("every help control needs a specific accessible label");
for(const token of ["noindex,nofollow,noarchive","add-ons.css","add-ons.js","MX one-time add-on service fee","Third-party charges","This page does not submit an inquiry","customer-owned"]){
 if(!page.toLowerCase().includes(token.toLowerCase()))fail("missing required disclosure: "+token);
}
for(const token of ["$99","$349","$109","$149","$299","$39","$59","$179","$429","$519","$15","$329","From $149","From $99"]){
 if(!page.includes(token))fail("menu fee missing: "+token);
}
if(!home.includes('href="add-ons.html"')||!home.includes("Save 10% on one add-on service fee"))fail("package-page offer/button missing");
if(!home.includes("Third-party costs")&&!home.includes("Third-party charges"))fail("offer cost exclusion missing");
if(/<form[\s>]/i.test(page)||/checkoutEnabled\s*:\s*true|stripe\.com\/checkout|functions\/v1\/veil-create-checkout/i.test(page+js))fail("add-ons page must stay informational with no active checkout");
if(!js.includes('event.key!=="Escape"')||!js.includes("other.open=false"))fail("help popovers need close and one-open-at-a-time behavior");
if(!css.includes("background:#08070b")||!css.includes("border:1px solid #aeb0b7")||!css.includes("color:#fff"))fail("help popovers need black background, gray border and white text");
console.log("MX Continuity add-ons QA PASS: 19 scoped menu cards, accessible help disclosures, offer link, vendor-cost guardrails, no form or checkout.");
