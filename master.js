/* UMX Master Command Center — read-only, owner-only oversight.
   Data access is granted by Supabase RLS; never use a service-role key here. */
"use strict";
(function () {
  const API_URL = "https://xdaxbueyftyljsrhabpx.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ";
  const $ = id => document.getElementById(id);
  const client = window.supabase && window.supabase.createClient(API_URL, PUBLISHABLE_KEY, {
    auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}
  });
  let owner = null;
  let db = {};
  let failures = {};
  let alerts = [];
  let activities = [];
  let active = "overview";
  const currentDay = new Date();

  const specs = [
    ["umxRequests","umx_service_requests",'id,name,service,status,created_at',"created_at",120],
    ["umxJobs","umx_jobs",'id,title,status,scheduled_start,created_at',"created_at",120],
    ["umxInvoices","umx_invoices",'id,number,status,total,amount_paid,due_date',"due_date",120],
    ["umxContracts","umx_contracts",'id,contract_title,status,created_at',"created_at",80],
    ["umxNotifications","umx_notifications",'id,user_id,title,body,read_at,created_at,link',"created_at",120],
    ["mxLeads","veil_leads",'id,business_name,status,created_at',"created_at",120],
    ["mxClients","veil_clients",'id,business_name,package_name,project_status,created_at',"created_at",120],
    ["mxTickets","veil_support_tickets",'id,ticket_code,subject,priority,status,created_at',"created_at",120],
    ["mxProjects","veil_projects",'id,name,status,created_at',"created_at",120],
    ["mxInvoices","veil_invoices",'id,invoice_no,amount_cents,status,paid_at,created_at',"created_at",120],
    ["mxHealth","veil_system_health",'id,component,status,last_checked_at,detail',"last_checked_at",80],
    ["mxLaunch","veil_launch_checklist",'item_code,label,status,detail,updated_at',"updated_at",120],
    ["scheduler","mx_ops_scheduler_runs",'id,step,affected_count,detail,executed_at',"executed_at",100],
    ["monitorTargets","mx_ops_monitor_targets",'id,site_url,tier,is_active,care_entitled_until,created_at',"created_at",100],
    ["inspections","mx_ops_inspections",'id,inspection_type,status,scheduled_date,completed_at,detail,manual_review_status,mobile_test,desktop_test,form_test,security_test,backup_test,created_at',"created_at",120],
    ["mxInquiries","mx_client_inquiries",'id,subject,status,contact_name,created_at',"created_at",120],
    ["profiles","profiles",'id,"Full_Name","Email",role',"created_at",80],
  ];
  function rows(key) {return db[key] || [];}
  function available(key) {return !failures[key];}
  function n(key) {return available(key) ? String(rows(key).length) : "—";}
  function el(name,cls,text) { const e=document.createElement(name); if(cls)e.className=cls; if(text!==undefined)e.textContent=String(text); return e; }
  function append(id,node) {const root=$(id);if(root)root.appendChild(node);}
  function clear(id) {const root=$(id);if(root)root.replaceChildren();}
  function text(id,value) {if($(id))$(id).textContent=String(value);}
  function fmtDate(value) {if(!value)return "Not recorded"; const d=new Date(value); return Number.isFinite(d.getTime())?d.toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):String(value);}
  function usd(value) {return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(value)||0);}
  function statusStyle(value) {
    const s=String(value||"").toLowerCase();
    if (["paid","active","completed","healthy","ok","success","passed","done","resolved","approved","live","delivered","sent"].includes(s))return "good";
    if (["failed","failure","error","critical","blocked","cancelled","declined","unhealthy","overdue"].includes(s))return "bad";
    if (["pending","open","in_progress","scheduled","awaiting","review","needs_review","manual_review","warning"].includes(s))return "warn";
    return "neutral";
  }
  function pill(value,variant) {const p=el("span","pill "+(variant||statusStyle(value)),String(value||"Not recorded").replaceAll("_"," "));return p;}
  function empty(msg) {return el("div","empty",msg||"No records found in this connected source.");}
  function record(title,meta,detail,status,link) {
    const wrap=el("div","record"),head=el("div","record-head"),left=el("div");
    left.appendChild(el("strong","",title||"Untitled"));
    if(meta)left.appendChild(el("small","",meta));
    head.appendChild(left);
    if(status)head.appendChild(pill(status));
    wrap.appendChild(head);
    if(detail)wrap.appendChild(el("p","",String(detail).slice(0,450)));
    if(link && /^\/[a-z0-9/#?=&._-]*$/i.test(link)){const a=el("a","record-link","Open workspace ↗");a.href=link;wrap.appendChild(a);}
    return wrap;
  }
  function list(id,key,collection,mapFn,limit) {
    clear(id);if(key && !available(key)){append(id,el("div","error","Source unavailable: "+failures[key]));return;}
    const arr=(collection||[]).slice(0,limit||15);
    if(!arr.length){append(id,empty());return;}
    arr.forEach(x=>append(id,mapFn(x)));
  }
  function addAlert(title,detail,origin,severity,link) {
    alerts.push({title,detail,origin,severity:severity||"warn",link});
  }
  function buildAlerts() {
    alerts=[];
    if(available("umxNotifications"))rows("umxNotifications").filter(x=>!x.read_at).forEach(x=>addAlert(x.title||"Unread UMX notification",x.body||"Open the source workspace.","UMX notifications","warn",x.link&&x.link.startsWith("/")?x.link:"/owner.html"));
    if(available("mxTickets"))rows("mxTickets").filter(x=>!["closed","resolved","completed","cancelled"].includes(String(x.status).toLowerCase())).forEach(x=>{
      const critical=["critical","urgent","high"].includes(String(x.priority).toLowerCase());
      addAlert(x.subject||"Open support ticket","Ticket "+(x.ticket_code||"")+" · "+fmtDate(x.created_at),"MX Support",critical?"bad":"warn","/mx-continuity/app/");
    });
    if(available("mxHealth"))rows("mxHealth").filter(x=>["failed","error","critical","unhealthy","degraded","warning"].includes(String(x.status).toLowerCase())).forEach(x=>addAlert(x.component||"System health issue",String(x.detail||"Requires review"),"System health","bad"));
    if(available("inspections"))rows("inspections").filter(x=>["failed","error","critical"].includes(String(x.status).toLowerCase()) || ["failed","rejected"].includes(String(x.manual_review_status).toLowerCase())).forEach(x=>addAlert("Website inspection needs review",String(x.inspection_type||"Check")+" · "+fmtDate(x.completed_at||x.created_at),"Monitoring","bad","/mx-continuity/app/"));
    if(available("scheduler"))rows("scheduler").filter(x=>["failed","error"].includes(String(x.step).toLowerCase())).forEach(x=>addAlert("Automation run failed",String(x.detail||"Scheduler error")+" · "+fmtDate(x.executed_at),"MX scheduler","bad"));
    if(available("umxInvoices"))rows("umxInvoices").filter(x=>x.due_date && new Date(x.due_date+"T23:59:59")<new Date() && !["paid","void","cancelled"].includes(String(x.status).toLowerCase()) && Number(x.total||0)>Number(x.amount_paid||0)).forEach(x=>addAlert("UMX invoice past due","Invoice "+(x.number||"")+" · due "+x.due_date,"UMX billing","warn","/owner.html"));
    alerts.sort((a,b)=>(a.severity==="bad"?0:1)-(b.severity==="bad"?0:1));
  }
  function buildActivity() {
    const items=[];
    const add=(key,itemsHere,stamp,title,description,link)=>{if(available(key))(itemsHere||[]).forEach(x=>{const date=x[stamp];if(date)items.push({date,title:title(x),description:description(x),link});});};
    add("scheduler",rows("scheduler"),"executed_at",x=>"MX scheduler: "+x.step,x=>x.detail||"Run recorded","");
    add("inspections",rows("inspections"),"created_at",x=>"Website check: "+(x.inspection_type||"Inspection"),x=>x.status||"Status unrecorded","/mx-continuity/app/");
    add("mxTickets",rows("mxTickets"),"created_at",x=>"MX ticket: "+(x.ticket_code||"New ticket"),x=>x.subject||"Support","/mx-continuity/app/");
    add("umxJobs",rows("umxJobs"),"created_at",x=>"UMX job: "+(x.title||"New job"),x=>x.status||"Status pending","/owner.html");
    add("mxLeads",rows("mxLeads"),"created_at",x=>"New MX lead",x=>x.business_name||"Lead received","/mx-continuity/app/");
    add("umxRequests",rows("umxRequests"),"created_at",x=>"New UMX inquiry",x=>x.service||"Website request","/owner.html");
    add("mxInvoices",rows("mxInvoices"),"created_at",x=>"MX invoice: "+(x.invoice_no||"New"),x=>x.status||"Status pending","/mx-continuity/app/");
    add("umxNotifications",rows("umxNotifications"),"created_at",x=>"UMX notification",x=>x.title||"New notification","/owner.html");
    activities=items.sort((a,b)=>new Date(b.date)-new Date(a.date));
  }
  function paidTotal() {
    let amount=0;
    if(available("umxInvoices"))rows("umxInvoices").forEach(x=>amount+=Number(x.amount_paid)||0);
    if(available("mxInvoices"))rows("mxInvoices").filter(x=>String(x.status).toLowerCase()==="paid").forEach(x=>amount+=(Number(x.amount_cents)||0)/100);
    return amount;
  }
  function renderBusinesses(id) {
    clear(id);
    const configs=[
      {code:"UMX",name:"UMX Field Services",state:"Operating records connected",stateStyle:"info",detail:"Property services, Missoula field work, contracts, and outreach.",stat:(available("umxJobs")?rows("umxJobs").length:"—")+" jobs · "+n("umxRequests")+" website requests",links:[["Open field desk","/owner.html"],["Sector map","/map.html"]]},
      {code:"MX",name:"MX Continuity",state:"Operating records connected",stateStyle:"info",detail:"Websites, client care, technical checkups, inquiries, and support.",stat:n("mxClients")+" clients · "+n("mxTickets")+" support tickets",links:[["Open client center","/mx-continuity/app/"],["Website","/mx-continuity/"]]},
      {code:"MX",name:"MX Visibility",state:"In preparation",stateStyle:"warn",detail:"Search optimization and local business visibility. No independent operating data feed is connected yet.",stat:"No tracked revenue or customers connected",links:[["Open website","/mx-visibility/"]]}
    ];
    configs.forEach(c=>{
      const card=el("article","business-card");
      card.appendChild(el("div","iconmark",c.code));card.appendChild(el("h3","",c.name));
      card.appendChild(pill(c.state,c.stateStyle));
      card.appendChild(el("p","",c.detail));card.appendChild(el("div","card-stat",c.stat));
      const actions=el("div","card-actions");
      c.links.forEach(l=>{const a=el("a","",l[0]+" ↗");a.href=l[1];actions.appendChild(a);});
      card.appendChild(actions);append(id,card);
    });
  }
  function renderOverview() {
    text("metric-alerts",String(alerts.length));
    text("metric-jobs",available("umxJobs")?rows("umxJobs").filter(x=>!["completed","cancelled"].includes(String(x.status).toLowerCase())).length:"—");
    text("metric-tickets",available("mxTickets")?rows("mxTickets").filter(x=>!["closed","resolved","completed","cancelled"].includes(String(x.status).toLowerCase())).length:"—");
    text("metric-inspections",n("inspections"));
    text("metric-paid",(available("umxInvoices")&&available("mxInvoices"))?usd(paidTotal()):"—");
    text("metric-runs",n("scheduler"));
    renderBusinesses("overview-businesses");
    renderBusinesses("businesses-grid");
    list("overview-alerts",null,alerts,x=>record(x.title,x.origin,x.detail,x.severity==="bad"?"Critical":"Review",x.link),5);
    list("overview-activity",null,activities,x=>record(x.title,fmtDate(x.date),x.description,null,x.link),7);
  }
  function renderAlerts() {
    text("alert-counter",alerts.length||"");
    text("alert-summary",alerts.length===0?"None found in available sources":alerts.length+" flagged");
    list("alerts-list",null,alerts,x=>record(x.title,x.origin,x.detail,x.severity==="bad"?"Critical":"Review",x.link),100);
    clear("alert-coverage");
    ["umxNotifications","mxTickets","mxHealth","inspections","scheduler","umxInvoices"].forEach(key=>{
      const row=el("div");row.appendChild(el("strong","",key.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase())));
      row.appendChild(el("small","",available(key)?"Connected records readable":"Unavailable: "+failures[key]));append("alert-coverage",row);
    });
  }
  function automationCard(title,description,status,style,details) {
    const card=el("article","automation-card");
    card.appendChild(el("h3","",title));card.appendChild(pill(status,style));
    card.appendChild(el("p","",description));card.appendChild(el("small","",details||""));
    return card;
  }
  function renderAutomation() {
    clear("automation-cards");
    const runs=rows("scheduler");
    const last=runs[0];
    const targetCount=rows("monitorTargets").filter(x=>x.is_active).length;
    const haveRun=available("scheduler") && !!last;
    append("automation-cards",automationCard("MX Scheduled Checkups","Recorded website-check scheduler executions and last run.",haveRun?"Run history recorded":available("scheduler")?"No runs recorded":"Source unavailable",haveRun?"info":"warn",haveRun?"Last: "+fmtDate(last.executed_at):"No confirmed execution"));
    append("automation-cards",automationCard("Website Monitoring","Authorized monitored sites and recorded inspection results.",available("monitorTargets")?targetCount+" active target(s)":"Source unavailable",targetCount>0?"info":"warn",available("inspections")?rows("inspections").length+" inspections recorded":"Inspection source unavailable"));
    append("automation-cards",automationCard("Component Health Checks","Status history recorded by the MX system, if reporting has been configured.",available("mxHealth")&&rows("mxHealth").length?"Health records found":"No health records",rows("mxHealth").length?"info":"warn",rows("mxHealth").length?"Latest: "+fmtDate(rows("mxHealth")[0].last_checked_at):"A scheduled health monitor is not confirmed"));
    append("automation-cards",automationCard("Client Support Alerts","Support-ticket alerts and email delivery should be visible here when delivery receipts are integrated.","External delivery not linked","warn","Tickets themselves are monitored in this control center"));
    append("automation-cards",automationCard("Automated Market Briefs","ChatGPT-based market reports and recurring research.","External workflow not linked","warn","No run receipts are sent to this website yet"));
    list("scheduler-list","scheduler",runs,x=>record("Scheduler step: "+x.step,fmtDate(x.executed_at)+" · affected "+(x.affected_count??0),x.detail,"Recorded"),60);
  }
  function renderMonitoring() {
    list("targets-list","monitorTargets",rows("monitorTargets"),x=>record(x.site_url||"Monitored site","Care until "+(x.care_entitled_until||"not recorded"),"Tier: "+(x.tier||"not recorded"),x.is_active?"Active":"Inactive"),50);
    list("health-list","mxHealth",rows("mxHealth"),x=>record(x.component||"System",fmtDate(x.last_checked_at),x.detail,x.status),50);
    list("inspections-list","inspections",rows("inspections"),x=>{
      const checks=["mobile","desktop","form","security","backup"].map(k=>k+": "+(x[k+"_test"]||"not recorded")).join(" · ");
      return record(x.inspection_type||"Website inspection",fmtDate(x.completed_at||x.created_at),checks+(x.detail?" · "+x.detail:""),x.status||"Not recorded");
    },70);
    list("launch-list","mxLaunch",rows("mxLaunch"),x=>record(x.label||x.item_code,fmtDate(x.updated_at),x.detail,x.status),70);
  }
  function renderCustomers() {
    list("tickets-list","mxTickets",rows("mxTickets"),x=>record(x.subject||"Support request",(x.ticket_code||"Ticket")+" · "+fmtDate(x.created_at),"Priority: "+(x.priority||"Normal"),x.status,"/mx-continuity/app/"),40);
    const merged=[...rows("mxClients").map(x=>({title:x.business_name,meta:"Client · "+(x.package_name||"Package unrecorded"),status:x.project_status,date:x.created_at})),...rows("mxProjects").map(x=>({title:x.name,meta:"Project",status:x.status,date:x.created_at}))].sort((a,b)=>new Date(b.date)-new Date(a.date));
    clear("mx-clients-list");if(!available("mxClients")||!available("mxProjects"))append("mx-clients-list",el("div","error","One or more MX client sources are unavailable."));else if(!merged.length)append("mx-clients-list",empty());else merged.slice(0,35).forEach(x=>append("mx-clients-list",record(x.title,x.meta+" · "+fmtDate(x.date),"",x.status,"/mx-continuity/app/")));
    const leads=[...rows("mxLeads").map(x=>({title:x.business_name||"New lead",meta:"MX lead",status:x.status,date:x.created_at})),...rows("mxInquiries").map(x=>({title:x.subject||"Website inquiry",meta:"From "+(x.contact_name||"customer"),status:x.status,date:x.created_at}))].sort((a,b)=>new Date(b.date)-new Date(a.date));
    clear("leads-list");if(!available("mxLeads")||!available("mxInquiries"))append("leads-list",el("div","error","One or more MX inquiry sources are unavailable."));else if(!leads.length)append("leads-list",empty());else leads.slice(0,35).forEach(x=>append("leads-list",record(x.title,x.meta+" · "+fmtDate(x.date),"",x.status,"/mx-continuity/app/")));
    list("requests-list","umxRequests",rows("umxRequests"),x=>record(x.name||"New request",fmtDate(x.created_at),x.service||"Service not recorded",x.status,"/owner.html"),40);
  }
  function renderFinance() {
    const u=rows("umxInvoices"),m=rows("mxInvoices");
    text("finance-umx",available("umxInvoices")?usd(u.reduce((s,x)=>s+Number(x.total||0),0)):"—");
    text("finance-mx",available("mxInvoices")?usd(m.reduce((s,x)=>s+Number(x.amount_cents||0)/100,0)):"—");
    text("finance-paid",available("umxInvoices")&&available("mxInvoices")?usd(paidTotal()):"—");
    list("umx-invoices-list","umxInvoices",u,x=>record("Invoice "+(x.number||""),x.due_date?"Due "+x.due_date:"No due date",usd(x.total)+" · paid "+usd(x.amount_paid),x.status,"/owner.html"),50);
    list("mx-invoices-list","mxInvoices",m,x=>record("Invoice "+(x.invoice_no||""),fmtDate(x.created_at),usd(Number(x.amount_cents||0)/100),x.status),50);
  }
  function renderActivity() {list("activity-list",null,activities,x=>record(x.title,fmtDate(x.date),x.description,null,x.link),90);}
  function renderAccess() {
    text("identity-name",owner.profile.Full_Name||"UMX owner");
    text("identity-email",owner.user.email||owner.profile.Email||"");
    text("identity-role","UMX "+owner.profile.role+" · MX "+owner.member.role);
    clear("sources-list");
    specs.forEach(s=>{
      const node=el("div");
      node.appendChild(el("strong","",s[1]));
      node.appendChild(el("small","",available(s[0])?rows(s[0]).length+" records loaded (max "+s[5]+")":"Unavailable: "+failures[s[0]]));
      append("sources-list",node);
    });
  }
  function showTab(name) {
    if(!document.querySelector('[data-section="'+name+'"]'))name="overview";
    active=name;
    document.querySelectorAll("[data-section]").forEach(s=>s.hidden=s.dataset.section!==name);
    document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
    if(window.location.hash!=="#"+name)history.replaceState(null,"","#"+name);
    $("sidebar").classList.remove("open");
    $("mobile-nav").setAttribute("aria-expanded","false");
    window.scrollTo({top:0,behavior:"auto"});
  }
  async function loadAll() {
    const btn=$("refresh");btn.disabled=true;text("sync-text","Refreshing UMX OS records…");
    const response=await Promise.all(specs.map(async spec=>{
      const [key,table,columns,order,limit]=spec;
      try {
        const {data,error}=await client.from(table).select(columns).order(order,{ascending:false}).limit(limit);
        if(error)throw error;
        return {key,data:data||[],error:null};
      }catch(e){return {key,error:e.message||"Unable to read source"};}
    }));
    db={};failures={};
    response.forEach(x=>{if(x.error){failures[x.key]=x.error;db[x.key]=[];}else db[x.key]=x.data;});
    buildAlerts();buildActivity();
    renderOverview();renderAlerts();renderAutomation();renderMonitoring();renderCustomers();renderFinance();renderActivity();renderAccess();
    const errorCount=Object.keys(failures).length;
    text("sync-text",errorCount?errorCount+" source(s) unavailable — check Access & Integrations":"Connected sources refreshed. Counts show recorded data, not unverified live-service status.");
    text("last-refresh","Refreshed "+fmtDate(new Date().toISOString()));
    btn.disabled=false;
  }
  async function authorize() {
    if(!client)throw new Error("The secure login library could not load. Reload the page.");
    const {data,error}=await client.auth.getUser();
    if(error||!data||!data.user)throw new Error("Sign in through UMX Access to continue.");
    const user=data.user;
    const [p,m]=await Promise.all([
      client.from("profiles").select('id,role,"Full_Name","Email"').eq("id",user.id).maybeSingle(),
      client.from("veil_memberships").select("user_id,role,active").eq("user_id",user.id).maybeSingle()
    ]);
    if(p.error||m.error)throw new Error("Owner permissions could not be verified. Sign in again or check your account.");
    const role=String(p.data&&p.data.role||"").toLowerCase();
    const membership=String(m.data&&m.data.role||"").toLowerCase();
    if(!["owner","admin"].includes(role) || membership!=="origin" || m.data.active!==true)throw new Error("This workspace requires the UMX owner account. Staff and client workspaces are separate.");
    owner={user,profile:p.data,member:m.data};
  }
  async function init() {
    try {
      await authorize();
      $("gate").hidden=true;$("app").hidden=false;
      text("today",new Date().toLocaleDateString("en-US",{timeZone:"America/Denver",weekday:"long",month:"long",day:"numeric",year:"numeric"}));
      document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
      $("mobile-nav").addEventListener("click",()=>{
        const isOpen=$("sidebar").classList.toggle("open");
        $("mobile-nav").setAttribute("aria-expanded",isOpen?"true":"false");
      });
      window.addEventListener("hashchange",()=>showTab(location.hash.slice(1)));
      $("refresh").addEventListener("click",loadAll);
      $("signout").addEventListener("click",async()=>{
        await client.auth.signOut();
        location.replace("/login.html");
      });
      showTab(location.hash.slice(1)||"overview");
      await loadAll();
      // Only refresh while the owner's private workspace is open.
      setInterval(()=>{if(!document.hidden && owner)loadAll();},120000);
    }catch(err){
      $("gate").hidden=false;$("app").hidden=true;
      text("gate-message",err.message||"Unable to verify owner access.");
      $("gate-login").hidden=false;
    }
  }
  init();
})();