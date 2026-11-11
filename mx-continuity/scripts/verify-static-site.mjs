import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function check(ok,why){if(!ok)throw new Error("MX Continuity QA FAIL: "+why);}
const required=[
 "index.html","about.html","contact.html","support.html","terms.html","ownership.html",
 "refunds.html","cancellation.html","privacy.html","project-order.html",
 "monthly-care-authorization.html","change-order.html","404.html","assets/site.js","assets/style.css",
 "assets/contact-email.js","assets/support-email.js","assets/intake-config.js",
 "assets/support-config.js","assets/mx-logo-horizontal.svg","assets/mx-hero-laptop.webp"
];
for(const file of required)check(fs.existsSync(path.join(root,file)),"missing "+file);
const home=read("index.html"),site=read("assets/site.js"),contact=read("contact.html");
const portal=read("app/index.html"),portalJs=read("app/portal.js");
check(home.includes('href="app/"'),"homepage missing client portal route");
check(portal.includes("Client &amp; Checkup Center"),"client portal page missing");
check(portal.includes("noindex,nofollow,noarchive"),"client portal must stay unindexed");
check(!/sb_secret_|service_role|sk_live_/i.test(portalJs),"client portal contains a server-side credential");
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
check(supportJs.includes('"mailto:"') && ticket.includes("TheUrbanMatrixLab@outlook.com"),"support fallback email recipient missing");
check(support.includes("assets/support-config.js"),"support backend config script missing");
check(supportJs.includes("/functions/v1/veil-public-support") && supportJs.includes("turnstileToken") && supportJs.includes("request_id"),"secure tracked support integration missing");
check(supportJs.includes("reportValidity"),"support validation missing");
for(const file of ["contact.html","support.html"]){
 check(!read(file).includes('disabled="" type="submit"'),"public form still presents disabled CTA: "+file);
}
for(const file of ["project-order.html","monthly-care-authorization.html"]){
 check(read(file).includes('Customer signature:'),"printable customer form blank: "+file);
}
// Legal-content consistency checks catch stale drafts and mismatches before publishing.
const legalPages=["terms.html","ownership.html","refunds.html","cancellation.html","privacy.html"];
for(const file of legalPages){
 const html=read(file);
 check(html.includes("November 9, 2026"),"policy lacks current effective/update date: "+file);
 check(!/Version 1\.0|Version 2\.0|Before publishing this notice|temporary business contact|draft for review|must be verified before this agreement/i.test(html),
   "policy has draft instructions or temporary information: "+file);
}
check(read("terms.html").includes("Basic includes one contact form"),"contract excludes advertised Basic form");
check(read("terms.html").includes("MX will test the agreed form delivery"),"form delivery acceptance not specified");
check(read("terms.html").includes("signed the Project Order"),"copyright signature condition missing");
check(read("ownership.html").includes("Project Order signed by an authorized MX representative"),"assignment execution ambiguous");
check(read("project-order.html").includes("It incorporates the"),"project order doesn't incorporate legal terms");
check(read("project-order.html").includes('href="change-order.html"'),"Project Order lacks change-order link");
check(read("terms.html").includes('href="change-order.html"'),"Service Agreement lacks change-order link");
const changeOrder=read("change-order.html");
for(const phrase of ["Change Order &amp; Additional Work Authorization","Original signed Project Order","scope, changes to the schedule","Itemized cost","Total net one-time change amount","Revised delivery/go-live milestone","No additional billable work","Customer signature:","Provider representative signature:","separate affirmative Monthly-Care Authorization","signature of this Change Order by an authorized MX representative"]){
 check(changeOrder.includes(phrase),"Change Order missing "+phrase);
}

for(const phrase of ["Customer pays MX","MX issues a credit/refund","Consent to electronic records","signer authentication and audit reference","Signed document delivery method","change-order work actually completed","not automatically applied to a separate Change Order","rights that applicable law independently recognizes"]){
 check(changeOrder.includes(phrase),"revised #10 missing "+phrase);
}
// Contract-to-advertisement consistency guards; maintain one definitive signing form.
const agreement=read("terms.html"),order=read("project-order.html"),careConsent=read("monthly-care-authorization.html");
check(!home.includes("Basic on-page search setup")&&!agreement.includes("Basic on-page search setup")&&!order.includes("basic on-page search setup"),"search-service promises must stay outside MX Continuity");
check(home.includes("hosting coordination is $99")&&agreement.includes("separately authorized $99")&&order.includes("$99 one-time service accepted"),"separate $99 add-on disclosure inconsistent");
check(agreement.includes("no undisclosed absolute liability cap")&&agreement.includes("even if the Customer has not authorized public go-live"),"risk and paid handoff terms not aligned");
check(read("refunds.html").includes("ten business days after receipt of the request"),"refund decision deadline not guaranteed");
check(home.includes("Priority handling of routine maintenance requests")&&agreement.includes("Continuity priority support")&&order.includes("Continuity maintenance-request priority")&&careConsent.includes("Continuity priority handling"),"continuity support priority promises inconsistent");
check(home.includes("Minor existing-content updates")&&agreement.includes("Routine existing-content updates")&&order.includes("content-update allowance")&&careConsent.includes("monthly content-update allowance"),"routine content updates not bounded or recorded");
check(!agreement.includes("greater of (i) $500")&&agreement.includes("no undisclosed absolute liability cap"),"unexpected standard liability cap");
check(!agreement.includes("<h2>Project Order and signatures</h2>")&&agreement.includes("standalone Project Order is the controlling execution form")&&order.includes("Customer signature:"),"agreement has competing signature form");
check(agreement.includes("30 consecutive days of included care")&&careConsent.includes("no earlier than day 31"),"included care and first subscription charge conflict");

check(read("terms.html").includes("signed Change Order procedure"),"contract amendment rule disagrees with Change Order");
check(read("refunds.html").includes("not automatically applied"),"refund rule does not distinguish change-only work");
check(read("refunds.html").includes('href="change-order.html"'),"refund policy lacks Change Order link");
check(read("cancellation.html").includes('href="change-order.html"'),"cancellation policy lacks Change Order link");
check(read("monthly-care-authorization.html").includes("Recurring-billing disclosure"),"monthly consent missing recurring terms");
check(read("refunds.html").includes("ten business days after approval"),"refund initiation timing missing");
check(read("refunds.html").includes("Cancellation and refunds are distinct"),"refund/cancellation distinction missing");
check(read("cancellation.html").includes("is effective for that upcoming renewal"),"cancellation effective-date clause missing");
check(!read("cancellation.html").includes("becomes effective for that renewal;"),"cancellation clause contains old sentence error");
check(read("cancellation.html").includes("Cancel%20MX%20monthly%20care"),"direct cancellation route missing");
check(read("refunds.html").includes("Refund%20Request"),"direct refund contact missing");
check(read("privacy.html").includes("email application"),"email collection disclosure missing");
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
