import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
function check(ok,why){if(!ok)throw Error("MX Continuity QA FAIL: "+why);}
const files=["index.html","about.html","contact.html","support.html","terms.html","ownership.html","refunds.html","cancellation.html","privacy.html","assets/site.js","assets/intake-config.js","assets/intake.js","assets/support-config.js","assets/support.js","assets/style.css","assets/mx-logo-horizontal.svg","assets/mx-hero-laptop.webp"];
for(const f of files)check(fs.existsSync(path.join(root,f)),"missing file "+f);
const home=read("index.html"),site=read("assets/site.js"),contact=read("contact.html"),support=read("assets/support-config.js"),intake=read("assets/intake-config.js"),handler=read("assets/intake.js");
for(const x of ["$89","$199","$400","$25","$49","Care that continues","assets/mx-logo-horizontal.svg","noindex,nofollow,noarchive"])check(home.includes(x),"homepage missing "+x);
for(const x of ["prelaunch:true","checkoutEnabled:false","contactEnabled:false"])check(site.includes(x),"prelaunch guard missing "+x);
check(support.includes("enabled: false"),"support must remain disabled");
check(intake.includes("enabled:false"),"intake must remain disabled");
for(const x of ['name="contact_consent"','id="inquiry-captcha"','assets/intake.js','disabled="" type="submit"'])check(contact.includes(x),"inquiry form missing "+x);
for(const x of ['action:"matrix_intake"','consent_version:"contact-v1"',"veil-public-intake"])check(handler.includes(x),"inquiry handler missing "+x);
for(const file of ["contact.html","support.html"])check(read(file).includes('disabled="" type="submit"'),file+" must be blocked prelaunch");
const all=[home,contact,site,support,intake,handler].join("\n");
check(!/sk_live_|sk_test_|sb_secret_|whsec_[A-Za-z0-9]{10}|re_[A-Za-z0-9]{24}/.test(all),"potential credential in public source");
const pages=fs.readdirSync(root).filter(x=>x.endsWith(".html"));let count=0;
for(const file of pages){
 const html=read(file),rx=/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;let match;
 while((match=rx.exec(html))){
  const url=match[1].trim();
  if(!url||/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(url))continue;
  const rel=url.split(/[?#]/)[0];
  if(!rel)continue;
  const full=path.resolve(root,path.dirname(file),rel);
  check(full.startsWith(root+path.sep),file+" path escapes site: "+rel);
  check(fs.existsSync(full),file+" broken local link: "+rel);
  count++;
 }
}
console.log("MX QA PASS: "+pages.length+" pages; "+files.length+" required files; "+count+" local links; disabled checkout/intake/support; brand and pricing intact.");
