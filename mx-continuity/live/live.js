"use strict";
(() => {
  const SUPABASE_URL = "https://xdaxbueyftyljsrhabpx.supabase.co";
  const KEY = "sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ";
  const $ = id => document.getElementById(id);
  const db = window.supabase?.createClient(SUPABASE_URL, KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const state={user:null,owner:false,audience:"client",rooms:[],room:null,busy:false};
  let poll=null,noticeTimeout=null;
  const label={client:"Client",employee:"Employee",guest:"Guest"};
  const stamp=value=>new Date(value).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"});
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  const active=room=>room?.status==="open" && Date.now()>=Date.parse(room.starts_at) && Date.now()<=Date.parse(room.ends_at);
  const isZoomURL=value=>{try{const u=new URL(value);return u.protocol==="https:"&&(u.hostname==="zoom.us"||u.hostname.endsWith(".zoom.us"))&&u.pathname!=="/";}catch{return false;}};
  function notify(message){const e=$("notice");e.hidden=false;e.textContent=message;clearTimeout(noticeTimeout);noticeTimeout=setTimeout(()=>e.hidden=true,8500);}
  function setSignInMode(signedIn){$("signin").hidden=signedIn;$("workspace").hidden=!signedIn;$("signout").hidden=!signedIn;}
  function roomsForGroup(){return state.rooms.filter(r=>r.audience===state.audience);}
  function setGroup(type){
    state.audience=type;
    document.querySelectorAll("[data-audience]").forEach(b=>b.classList.toggle("active",b.dataset.audience===type));
    $("group-name").textContent=label[type]+" rooms";
    const rooms=roomsForGroup();
    if(!state.room||!rooms.some(r=>r.id===state.room.id))state.room=rooms[0]||null;
    showRooms();showRoom();loadMessages();
  }
  function showRooms(){
    const rooms=roomsForGroup(),root=$("room-list");root.replaceChildren();
    $("room-count").textContent=rooms.length+" room"+(rooms.length===1?"":"s");
    if(!rooms.length){root.append(node("p","muted","No authorized "+state.audience+" rooms yet."));return;}
    for(const r of rooms){
      const b=node("button","room-item"+(state.room?.id===r.id?" active":""),undefined);
      b.type="button";b.append(node("strong","",r.title),node("small","",stamp(r.starts_at)+" · "+r.status));
      b.addEventListener("click",()=>{state.room=r;showRooms();showRoom();loadMessages();});
      root.append(b);
    }
  }
  async function showRoom(){
    const root=$("room-detail");root.replaceChildren();
    const r=state.room;
    $("video-stage").hidden=!r;$("chat-area").hidden=!r;
    $("manage-room").hidden=!state.owner||!r;
    if(!r){root.append(node("h2","","Select a private room."),node("p","","Only authorized appointments and chats appear here."));return;}
    root.append(node("span","pill",label[r.audience]+" • "+r.status),node("h2","",r.title),node("p","",stamp(r.starts_at)+" – "+stamp(r.ends_at)));
    const canEnter=active(r);
    $("stage-title").textContent=canEnter?"Your private Zoom session":"Appointment room locked";
    $("stage-status").textContent=canEnter?"Room is open. Only approved attendees can join.":r.status==="closed"?"This appointment is closed.":r.status==="scheduled"?"Waiting for the host to open this room.":"Access is available only during the appointment window.";
    $("join-video").disabled=!canEnter;
    $("join-video").textContent=canEnter?"Join Zoom video":"Video available at appointment";
    $("message").disabled=!canEnter;
    $("message-form").querySelector("button").disabled=!canEnter;
    $("messages").replaceChildren(node("p","muted",canEnter?"Loading private messages…":"Group chat unlocks when this appointment is open."));
    if(state.owner){$("edit-status").value=r.status;$("edit-zoom").value="";}
    if(!canEnter)return;
    // The Zoom URL never comes from the room listing. Fetch only from the access-checked RPC on click.
  }
  async function refresh(preserve=true){
    if(!state.user||state.busy)return;
    state.busy=true;
    try{
      const {data,error}=await db.from("mx_live_rooms").select("id,audience,title,starts_at,ends_at,status,created_at")
        .order("starts_at",{ascending:false}).limit(150);
      if(error)throw error;
      state.rooms=data||[];
      const wanted=preserve?state.room?.id:null;
      state.room=state.rooms.find(r=>r.id===wanted)||roomsForGroup()[0]||null;
      setGroup(state.audience);
    }catch(err){notify("Unable to load private rooms: "+err.message);}
    finally{state.busy=false;}
  }
  async function loadMessages(){
    const r=state.room,root=$("messages");
    if(!r||!active(r))return;
    const {data,error}=await db.from("mx_live_messages").select("id,room_id,author_id,body,created_at")
      .eq("room_id",r.id).order("created_at",{ascending:true}).limit(150);
    if(state.room?.id!==r.id)return;
    if(error){root.replaceChildren(node("p","muted","Messages unavailable: "+error.message));return;}
    root.replaceChildren();
    if(!data?.length){root.append(node("p","muted","No messages yet. Start the private conversation."));return;}
    for(const m of data){
      const row=node("div","msg");const head=node("div","msg-head");
      head.append(node("strong","",m.author_id===state.user.id?"You":"Participant"),node("span","",stamp(m.created_at)));
      row.append(head,node("p","",m.body));root.append(row);
    }
    root.scrollTop=root.scrollHeight;
    $("chat-count").textContent=data.length+" message"+(data.length===1?"":"s");
  }
  async function joinVideo(){
    const r=state.room;if(!r||!active(r)){notify("This video room is not active.");return;}
    const button=$("join-video");button.disabled=true;button.textContent="Checking access…";
    // Reserve the tab within the click event so mobile browsers do not block Zoom after async permission checks.
    const meetingTab=window.open("about:blank","_blank");
    if(meetingTab)meetingTab.opener=null;
    try{
      const {data,error}=await db.rpc("mx_live_get_join_link",{p_room:r.id});if(error)throw error;
      if(!data){if(meetingTab)meetingTab.close();notify("The host has not assigned an active Zoom meeting link.");return;}
      if(!isZoomURL(data)){if(meetingTab)meetingTab.close();notify("The configured Zoom link is invalid.");return;}
      if(meetingTab)meetingTab.location.replace(data);
      else window.location.assign(data);
    }catch(err){if(meetingTab)meetingTab.close();notify("Unable to join: "+err.message);}
    finally{button.disabled=false;button.textContent="Join Zoom video";}
  }
  async function sendMessage(e){
    e.preventDefault();const r=state.room,body=$("message").value.trim();
    if(!r||!active(r)){notify("Chat is locked outside the appointment window.");return;}
    if(!body||body.length>2000){notify("Enter a message up to 2,000 characters.");return;}
    const btn=$("message-form").querySelector("button");btn.disabled=true;
    try{const {error}=await db.from("mx_live_messages").insert({room_id:r.id,author_id:state.user.id,body});
      if(error)throw error;$("message").value="";await loadMessages();
    }catch(err){notify("Message not sent: "+err.message);}
    finally{btn.disabled=false;}
  }
  async function createRoom(e){
    e.preventDefault();
    if(!state.owner)return;
    const audience=$("new-audience").value,title=$("new-title").value.trim();
    const start=new Date($("new-start").value),end=new Date($("new-end").value),zoom=$("new-zoom").value.trim();
    if(title.length<3||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){notify("Enter a room name and valid start/end dates.");return;}
    if(zoom&&!isZoomURL(zoom)){notify("Enter an official https://…zoom.us/ meeting link.");return;}
    const b=$("create-form").querySelector('button[type="submit"]');b.disabled=true;
    try{
      const {data,error}=await db.from("mx_live_rooms").insert({
        audience,title,starts_at:start.toISOString(),ends_at:end.toISOString(),
        status:"scheduled",created_by:state.user.id
      }).select("id").single();if(error)throw error;
      if(zoom){const link=await db.rpc("mx_live_set_zoom_link",{p_room:data.id,p_url:zoom});if(link.error)notify("Room created, but Zoom link was not saved: "+link.error.message);}
      $("create-form").reset();state.audience=audience;await refresh(false);
      const selected=state.rooms.find(r=>r.id===data.id);
      if(selected){state.room=selected;showRooms();showRoom();loadMessages();}
      notify("Private room created. Add approved participants and open it at appointment time.");
    }catch(err){notify("Room not created: "+err.message);}
    finally{b.disabled=false;}
  }
  async function saveStatus(){
    if(!state.owner||!state.room)return;
    const desired=$("edit-status").value,id=state.room.id;
    const {error}=await db.from("mx_live_rooms").update({status:desired}).eq("id",id);
    if(error){notify("Status not saved: "+error.message);return;}
    notify("Room status saved. Appointment window restrictions still apply.");await refresh();
  }
  async function addMember(){
    if(!state.owner||!state.room)return;const email=$("invite-email").value.trim();
    if(!email){notify("Enter the participant's existing sign-in email.");return;}
    const {data,error}=await db.rpc("mx_live_add_member_by_email",{p_room:state.room.id,p_email:email});
    if(error){notify("Could not grant access: "+error.message);return;}
    $("invite-email").value="";notify(data||"Invitation processed.");
  }
  async function saveZoom(){
    if(!state.owner||!state.room)return;const link=$("edit-zoom").value.trim();
    if(!isZoomURL(link)){notify("Enter a valid https://…zoom.us/ meeting link.");return;}
    const {error}=await db.rpc("mx_live_set_zoom_link",{p_room:state.room.id,p_url:link});
    if(error){notify("Link not saved: "+error.message);return;}
    $("edit-zoom").value="";notify("Private Zoom link saved. It remains locked until the room opens.");
  }
  async function setUser(user){
    state.user=user;clearInterval(poll);poll=null;
    setSignInMode(!!user);
    if(!user){state.room=null;state.rooms=[];return;}
    try{
      const {data,error}=await db.from("veil_memberships").select("role,active").eq("user_id",user.id).maybeSingle();
      if(error)throw error;
      state.owner=!!(data?.active&&data.role==="origin");
      $("owner-tools").hidden=!state.owner;
      await refresh(false);
      poll=setInterval(async()=>{if(state.user&&!state.busy){await refresh();}},12000);
    }catch(err){notify("Unable to confirm access: "+err.message);}
  }
  async function start(){
    if(!db){$("signin").querySelector("p").textContent="Secure sign-in could not load.";return;}
    document.querySelectorAll("[data-audience]").forEach(b=>b.addEventListener("click",()=>setGroup(b.dataset.audience)));
    $("reload").addEventListener("click",()=>refresh());
    $("join-video").addEventListener("click",joinVideo);
    $("message-form").addEventListener("submit",sendMessage);
    $("create-form").addEventListener("submit",createRoom);
    $("save-status").addEventListener("click",saveStatus);
    $("invite").addEventListener("click",addMember);
    $("save-zoom").addEventListener("click",saveZoom);
    $("signin-form").addEventListener("submit",async e=>{
      e.preventDefault();const email=$("email").value.trim(),password=$("password").value;
      if(!password){notify("Enter a password or use the sign-in link.");return;}
      const {error}=await db.auth.signInWithPassword({email,password});
      if(error)notify("Sign-in failed: "+error.message);
    });
    $("magic").addEventListener("click",async()=>{
      const email=$("email").value.trim();if(!email){notify("Enter your email first.");return;}
      const {error}=await db.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
      notify(error?"Sign-in link failed: "+error.message:"If your account is approved, check your email for a sign-in link.");
    });
    $("signout").addEventListener("click",async()=>{await db.auth.signOut();});
    db.auth.onAuthStateChange((event,session)=>{if(["SIGNED_IN","SIGNED_OUT"].includes(event))setTimeout(()=>setUser(session?.user||null),0);});
    const {data:{user},error}=await db.auth.getUser();
    if(error&&error.name!=="AuthSessionMissingError")notify("Session check: "+error.message);
    await setUser(user);
  }
  start().catch(err=>notify("Private room setup failed: "+err.message));
})();