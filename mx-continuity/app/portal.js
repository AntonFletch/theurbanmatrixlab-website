"use strict";
(() => {
  const CONFIG = Object.freeze({
    url: "https://xdaxbueyftyljsrhabpx.supabase.co",
    key: "sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ",
    refreshMs: 20000
  });
  const $ = (id) => document.getElementById(id);
  const fmt = (value) => value ? new Date(value).toLocaleString("en-US", {dateStyle:"medium",timeStyle:"short",timeZone:"America/Denver"}) + " MT" : "Not recorded";
  const stamp = (value) => value ? new Date(value).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}) : "Not scheduled";
  const state = { user:null,clients:[],targets:[],checks:[],inquiries:[],tickets:[],comments:[],selectedClient:"all",selectedCheck:null,tab:"overview",busy:false,isStaff:false,draft:"" };
  let db=null, timer=null, toastTimer=null;
  function element(tag, cls, text) {const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;}
  function empty(message){return element("p","empty",message);}
  function replace(id, nodes){const root=$(id);root.replaceChildren(...nodes);}
  function notice(message){$("toast").textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").textContent="",5000);}
  function pill(message,cls=""){return element("span","pill "+cls,message);}
  function view(ids){return state.selectedClient==="all" ? ids : ids.filter(row=>row.client_id===state.selectedClient);}
  function clientName(id){return state.clients.find(c=>c.id===id)?.business_name||"Client website";}
  function checkedStatus(status){return ["healthy","completed"].includes(status)?"good":["alert","error","critical"].includes(status)?"bad":"";}
  function nextSchedule(tier){
    const now=Date.now();
    for(let i=0;i<15;i++){const d=new Date();d.setUTCHours(16,0,0,0);d.setUTCDate(d.getUTCDate()+i);
      if(d.getTime()<=now)continue;
      if(d.getUTCDay()===1||(tier==="Continuity"&&d.getUTCDay()===5))return d;
    }
    return null;
  }
  function renderSchedule(){
    const targets=view(state.targets).filter(t=>t.is_active&&t.customer_authorized_at!==null&&!t.care_expired&&(!t.care_entitled_until||new Date(t.care_entitled_until)>new Date()));
    const candidates=targets.map(t=>({t,date:nextSchedule(t.tier)})).filter(x=>x.date).sort((a,b)=>a.date-b.date);
    const first=candidates[0];
    $("next-check").textContent=first ? fmt(first.date) : "No active care check scheduled";
    $("check-plan").textContent=first ?
      clientName(first.t.client_id)+" · "+first.t.tier+" care · "+first.t.site_url+
      ". The current system runs at 16:00 UTC (9 AM in winter / 10 AM in summer in Montana)." :
      "A client site must be authorized, live and covered by active care before checks are queued.";
  }
  function setTab(tab){
    state.tab=tab;
    const names={overview:"Overview",checkups:"Checkups",inquiries:"Customer inquiries",support:"Support"};
    document.querySelectorAll(".nav").forEach(button=>button.classList.toggle("active",button.dataset.tab===tab));
    document.querySelectorAll(".panel").forEach(panel=>panel.hidden=panel.id!==tab);
    $("page-title").textContent=names[tab]||"Overview";
    $("page-subtitle").textContent={
      overview:"Your website operations at a glance.",
      checkups:"Follow actual automated checks and talk through each result.",
      inquiries:"See and manage inquiries from your own customer website.",
      support:"See maintenance issues and support history."
    }[tab];
    render();
  }
  function drawRecent(checks){
    const box=checks.slice(0,5).map(c=>{const row=element("div","item");const head=element("div","item-header");
      head.append(element("strong","",clientName(c.client_id)),pill(c.status,checkedStatus(c.status)));row.append(head,element("p","",c.detail||"Inspection record created"),element("span","meta",stamp(c.scheduled_date)+" · "+(c.completed_at?fmt(c.completed_at):"In progress")));return row;});
    replace("recent-activity",box.length?box:[empty("No inspection records yet. The timeline will populate after the first authorized scheduled check.")]);
  }
  function renderOverview(){
    const targets=view(state.targets), checks=view(state.checks), inquiries=view(state.inquiries);
    $("stat-sites").textContent=targets.filter(t=>t.is_active).length;
    $("stat-checks").textContent=checks.length;
    $("stat-alerts").textContent=checks.filter(c=>c.status==="alert"||c.status==="error").length;
    $("stat-inquiries").textContent=inquiries.filter(i=>i.status==="new").length;
    renderSchedule();drawRecent(checks);
  }
  function renderCheckList(){
    const checks=view(state.checks);
    const rows=checks.map(c=>{const b=element("button","item"+(state.selectedCheck===c.id?" active":""),undefined);
      b.type="button";const head=element("div","item-header");head.append(element("strong","",clientName(c.client_id)+" • "+stamp(c.scheduled_date)),pill(c.status,checkedStatus(c.status)));
      b.append(head,element("p","",c.status==="healthy"?"HTTPS endpoint responded — manual checks still pending":c.detail||"Scheduled website check"),element("span","meta",c.completed_at?fmt(c.completed_at):"Queued / processing"));
      b.addEventListener("click",()=>{state.selectedCheck=c.id;state.draft="";renderCheckList();renderDetail();});return b;});
    replace("checkup-list",rows.length?rows:[empty("No checkups yet. Authorized plans begin creating records on their scheduled day.")]);
  }
  function fieldResult(label,value){
    const box=element("div","",undefined);box.append(element("strong","",label),element("span","",value.replaceAll("_"," ")));return box;
  }
  function renderDetail(){
    const root=$("checkup-detail");root.replaceChildren();
    const c=state.checks.find(x=>x.id===state.selectedCheck&&view(state.checks).includes(x));
    if(!c){root.append(empty("Select a checkup to see its actual results and add a comment."));return;}
    const prior=$("comment-text");if(prior)state.draft=prior.value;
    root.append(element("h3","",clientName(c.client_id)+" · "+stamp(c.scheduled_date)));
    const status=element("p","",undefined);status.append(pill(c.status,checkedStatus(c.status)));root.append(status);
    root.append(element("p","muted",c.detail||"Checkup is being processed."));
    const details=element("div","checklist");
    details.append(
      fieldResult("HTTPS availability",c.status==="healthy"?"Responded ("+(c.http_status||"2xx/3xx")+")":c.status),
      fieldResult("Mobile review",c.mobile_test),
      fieldResult("Desktop review",c.desktop_test),
      fieldResult("Contact form review",c.form_test),
      fieldResult("Security review",c.security_test),
      fieldResult("Backup review",c.backup_test)
    );
    root.append(details);
    root.append(element("h3","","Check-in conversation"));
    const comments=state.comments.filter(x=>x.inspection_id===c.id);
    if(!comments.length)root.append(element("p","muted","No notes yet. The business owner and MX team can join this checkup below."));
    comments.forEach(m=>{
      const b=element("div","comment"+(m.kind==="issue"?" issue":""),undefined);
      const author=m.author_id===state.user.id?"You":"Participant";
      b.append(element("strong","",author+" · "+(m.kind==="issue"?"Issue flagged":"Comment")+" · "+fmt(m.created_at)),element("p","",m.body));root.append(b);
    });
    const form=element("form","comment-form");form.id="comment-form";
    const textarea=element("textarea");textarea.id="comment-text";textarea.name="message";textarea.maxLength=1500;textarea.required=true;textarea.placeholder="Share an observation or ask a question about this check…";textarea.value=state.draft;
    const actions=element("div","row-actions");
    const kind=element("select","select-small");kind.id="comment-kind";[["comment","Comment"],["issue","Flag an issue"]].forEach(([val,label])=>{const o=element("option","",label);o.value=val;kind.append(o);});
    const send=element("button","btn primary","Post check-in");send.type="submit";
    actions.append(kind,send);form.append(textarea,actions);
    form.addEventListener("submit",e=>{e.preventDefault();sendComment(c,send);});root.append(form);
  }
  async function sendComment(c,button){
    const body=$("comment-text").value.trim();if(body.length<1||body.length>1500){notice("Write a comment between 1 and 1,500 characters.");return;}
    button.disabled=true;const kind=$("comment-kind").value;
    const {error}=await db.from("mx_ops_check_comments").insert({client_id:c.client_id,inspection_id:c.id,author_id:state.user.id,body,kind});
    button.disabled=false;if(error){notice("Comment not posted: "+error.message);return;}
    state.draft="";notice("Check-in recorded.");await refresh();
  }
  function renderInquiries(){
    const rows=view(state.inquiries).map(i=>{
      const b=element("article","item");const head=element("div","item-header");
      head.append(element("strong","",i.contact_name||"Website visitor"),pill(i.status));
      b.append(head,element("span","meta",clientName(i.client_id)+" · "+fmt(i.created_at)));
      if(i.subject)b.append(element("p","",i.subject));
      b.append(element("p","",i.message));
      if(i.contact_email)b.append(element("p","", "Email: "+i.contact_email));
      if(i.contact_phone)b.append(element("p","", "Phone: "+i.contact_phone));
      const row=element("div","row-actions");row.append(element("span","meta","Inquiry status"));
      const select=element("select","select-small");select.setAttribute("aria-label","Status for "+i.contact_name);
      ["new","contacted","closed"].forEach(s=>{const opt=element("option","",s);opt.value=s;opt.selected=s===i.status;select.append(opt);});
      select.addEventListener("change",async()=>{select.disabled=true;const {error}=await db.from("mx_client_inquiries").update({status:select.value}).eq("id",i.id);select.disabled=false;if(error){notice("Unable to change status: "+error.message);}else{notice("Inquiry status saved.");await refresh();}});
      row.append(select);b.append(row);return b;
    });
    replace("inquiry-list",rows.length?rows:[empty("No customer inquiries recorded. Public inquiry forms are not connected yet; we will activate each form only after the customer's site, consent and delivery tests are approved.")]);
  }
  function renderTickets(){
    const rows=view(state.tickets).map(t=>{const b=element("article","item");const head=element("div","item-header");
      head.append(element("strong","",t.subject||"Support issue"),pill(t.status,checkedStatus(t.priority)));
      b.append(head,element("span","meta",clientName(t.client_id)+" · "+(t.ticket_code||"Ticket")+" · "+fmt(t.created_at)),element("p","",t.description||"No further details"),element("span","meta","Priority: "+(t.priority||"normal")));return b;});
    replace("ticket-list",rows.length?rows:[empty("No support tickets for this business. If you have a website problem, use Contact support.")]);
  }
  function render(){renderOverview();renderCheckList();renderDetail();renderInquiries();renderTickets();}
  async function refresh(){
    if(!state.user||state.busy)return;state.busy=true;$("connection").textContent="Updating records…";
    try{
      const {data:clients,error:ce}=await db.from("veil_clients").select("id,business_name,domain,project_status,package_name,recurring_plan").order("business_name").limit(200);
      if(ce)throw ce;state.clients=clients||[];
      const sel=$("client-select"),current=state.selectedClient;
      sel.replaceChildren();
      const all=element("option","","All businesses");all.value="all";sel.append(all);
      for(const c of state.clients){const o=element("option","",c.business_name);o.value=c.id;sel.append(o);}
      if(current!=="all"&&!state.clients.find(c=>c.id===current))state.selectedClient="all";
      sel.value=state.selectedClient;
      if(!state.clients.length){
        state.targets=[];state.checks=[];state.inquiries=[];state.tickets=[];state.comments=[];state.selectedCheck=null;render();$("connection").textContent="No assigned clients";
        return;
      }
      const ids=state.clients.map(x=>x.id);
      const responses=await Promise.all([
        db.from("mx_ops_monitor_targets").select("id,client_id,site_url,tier,is_active,customer_authorized_at,care_entitled_until").in("client_id",ids).limit(200),
        db.from("mx_ops_inspections").select("id,client_id,target_id,scheduled_date,status,http_status,completed_at,detail,mobile_test,desktop_test,form_test,security_test,backup_test").in("client_id",ids).order("created_at",{ascending:false}).limit(200),
        db.from("mx_client_inquiries").select("id,client_id,contact_name,contact_email,contact_phone,subject,message,status,created_at").in("client_id",ids).order("created_at",{ascending:false}).limit(200),
        db.from("veil_support_tickets").select("id,client_id,ticket_code,subject,description,status,priority,created_at").in("client_id",ids).order("created_at",{ascending:false}).limit(100)
      ]);
      for(const r of responses)if(r.error)throw r.error;
      [state.targets,state.checks,state.inquiries,state.tickets]=responses.map(x=>x.data||[]);
      if(state.selectedCheck&&!state.checks.find(c=>c.id===state.selectedCheck))state.selectedCheck=null;
      if(!state.selectedCheck&&view(state.checks).length)state.selectedCheck=view(state.checks)[0].id;
      if(state.selectedCheck){
        const {data,error}=await db.from("mx_ops_check_comments").select("id,client_id,inspection_id,author_id,kind,body,created_at").eq("inspection_id",state.selectedCheck).order("created_at").limit(150);
        if(error)throw error;state.comments=data||[];
      }else state.comments=[];
      render();$("connection").textContent="Connected • updated "+new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
    }catch(err){$("connection").textContent="Refresh error";notice("Unable to load records: "+(err.message||"unknown error"));}
    finally{state.busy=false;}
  }
  async function updateSession(user){
    state.user=user;clearInterval(timer);timer=null;
    $("signin").hidden=!!user;$("workspace").hidden=!user;$("refresh").hidden=!user;$("signout").hidden=!user;
    if(!user){$("connection").textContent="Private workspace";return;}
    const {data:member}=await db.from("veil_memberships").select("role,active").eq("user_id",user.id).maybeSingle();
    state.isStaff=!!(member?.active&&["owner","admin","manager","staff","operator"].includes(member.role));
    $("account-type").textContent=state.isStaff?"MX CONTINUITY · TEAM":"MX CONTINUITY · CLIENT";
    await refresh();timer=setInterval(refresh,CONFIG.refreshMs);
  }
  async function signIn(event){
    event.preventDefault();const email=$("email").value.trim(),password=$("password").value;
    if(!email||!password){$("auth-note").textContent="Enter your password, or use Send me a sign-in email.";return;}
    $("auth-note").textContent="Checking your account…";
    const {error}=await db.auth.signInWithPassword({email,password});
    $("auth-note").textContent=error?"Sign-in failed: "+error.message:"Signed in.";
  }
  async function sendEmailLink(){
    const email=$("email").value.trim();if(!email){$("auth-note").textContent="Enter your account email first.";return;}
    $("auth-note").textContent="Requesting a sign-in link…";
    const {error}=await db.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
    $("auth-note").textContent=error?"Unable to send the link: "+error.message:"If this email has an approved account, a sign-in link has been requested. Check your inbox.";
  }
  async function start(){
    $("signin-form").addEventListener("submit",signIn);$("magic").addEventListener("click",sendEmailLink);
    $("signout").addEventListener("click",async()=>{await db.auth.signOut();notice("Signed out.");});
    $("refresh").addEventListener("click",refresh);
    $("client-select").addEventListener("change",()=>{state.selectedClient=$("client-select").value;state.selectedCheck=view(state.checks)[0]?.id||null;state.comments=[];refresh();});
    document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
    document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.go)));
    if(!window.supabase?.createClient){$("auth-note").textContent="Unable to load the secure sign-in library. Try again later.";return;}
    db=window.supabase.createClient(CONFIG.url,CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(()=>updateSession(session?.user||null),0);});
    const {data:{session}}=await db.auth.getSession();await updateSession(session?.user||null);
  }
  start().catch(err=>{$("auth-note").textContent="App startup problem: "+(err.message||"unknown error");});
})();