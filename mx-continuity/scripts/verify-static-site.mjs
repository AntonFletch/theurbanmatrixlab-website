import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function check(ok,why){if(!ok)throw new Error("MX Continuity QA FAIL: "+why);}
const required=[
 "index.html","about.html","contact.html","support.html","terms.html","ownership.html",
 "refunds.html","cancellation.html","privacy.html","project-order.html",
 "monthly-care-authorization.html","404.html","assets/site.js","assets/style.css",
 "assets/contact-email.js","assets/support-email.js","assets/intake-config.js",
 "assets/support-config.js","assets/mx-logo-horizontal.svg","assets/mx-hero-laptop.webp"
];
for(const file of required)check(fs.existsSync(path.join(root,file)),"missing "+file);
const home=read("index.html"),site=read("assets/site.js"),contact=read("contact.html");
const support=read("support.html"),intake=read("assets/intake-config.js");
const ticket=read("assets/support-config.js"),contactJs=read("assets/contact-email.js");
const supportJs=read("assets/support-email.js");
for(const value of ["$89","$199","$400","$25","$49","$89","Care that continues",
  "assets/mx-logo-horizontal.svg","noindex,nofollow,noarchive"]){
 check(home.includes(value),"original homepage pricing/branding missing "+value);
}
for(const tier of ["basic","business","continuity"]){
 check(home.includes("contact.html?package="+tier),"package action broken: "+tier);
}
check(!home.includes('disabled="" type="button"'),"package buttons still disabled");
for(const token of ["prelaunch:true","checkoutEnabled:false","contactEnabled:false"]){
 check(site.includes(token),"backend safety flag missing: "+token);
}
check(intake.includes("enabled:false"),"backend intake activated unintentionally");
check(ticket.includes("enabled: false"),"support backend activated unintentionally");
check(contact.includes('id="email-inquiry-btn"'),"working inquiry email action missing");
check(contact.includes('name="contact_consent"'),"inquiry privacy consent missing");
check(contact.includes("assets/contact-email.js"),"inquiry email script missing");
check(contactJs.includes("mailto:TheUrbanMatrixLab@outlook.com"),"inquiry email recipient missing");
check(contactJs.includes("form"),"inquiry email script malformed");
check(contactJs.includes("reportValidity"),"inquiry validation missing");
check(support.includes('id="email-support-btn"'),"working support email action missing");
check(support.includes("assets/support-email.js"),"support email script missing");
check(supportJs.includes("mailto:TheUrbanMatrixLab@outlook.com"),"support email recipient missing");
check(supportJs.includes("reportValidity"),"support validation missing");
for(const file of ["contact.html","support.html"]){
 check(!read(file).includes('disabled="" type="submit"'),"public form still presents disabled CTA: "+file);
}
for(const file of ["project-order.html","monthly-care-authorization.html"]){
 check(read(file).includes('Customer signature:'),"printable customer form blank: "+file);
}
const htmls=fs.readdirSync(root).filter(f=>f.endsWith(".html"));
let references=0;
for(const file of htmls){
 const html=read(file);
 const visible=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
                   .replace(/<[^>]*>/g," ").replace(/\s+/g," ");
 check(!/\bpre[ -]?launch\b/i.test(visible),"public launch warning still visible on "+file);
 const rx=/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
 let match;
 while((match=rx.exec(html))){
  const url=match[1].trim();
  if(!url||/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(url))continue;
  const rel=url.split(/[?#]/)[0];
  if(!rel)continue;
  const resolved=path.resolve(root,path.dirname(file),rel);
  check(resolved.startsWith(root+path.sep),"reference outside project: "+file+" "+rel);
  check(fs.existsSync(resolved),"broken local reference: "+file+" -> "+rel);
  references++;
 }
}
const publicSources=[home,contact,support,site,contactJs,supportJs,intake,ticket].join("\n");
check(!/sk_live_[A-Za-z0-9]{6}|sk_test_[A-Za-z0-9]{6}|sb_secret_[A-Za-z0-9]{6}|whsec_[A-Za-z0-9]{10}|re_[A-Za-z0-9]{24}/.test(publicSources),
 "secret credentials accidentally included in public website");
console.log("MX Continuity PASS: "+htmls.length+" pages, "+required.length+" required assets, "+
references+" local references, original brand/pricing, functional email CTAs, safety gates and public copy.");
