"use strict";
(() => {
  const SUPABASE_URL = "https://xdaxbueyftyljsrhabpx.supabase.co";
  const KEY = "sb_publishable_eZ5ydFnC0SESdeT9Up_-0A_Mez9ljvZ";
  const $ = id => document.getElementById(id);
  const db = window.supabase?.createClient(SUPABASE_URL, KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const state={user:null,owner:false,audience:"client",rooms:[],room:null,busy:false};
  let poll=null,noticeTimeout=null,accessLoad=null,recoveryMode=false;
  const temporaryError=err=>/abort|network|fetch|timeout|connection/i.test(String(err?.message||err||""));
  async function retrySecureRequest(makeRequest){
    let lastError;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const result=await makeRequest();
        if(result.error)throw result.error;
        return result;
      }catch(err){
        lastError=err;
        if(!temporaryError(err)||attempt===2)throw err;
        await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
      }
    }
    throw lastError;
  }
  function loadAccess(user){
    if(user && accessLoad?.id===user.id)return accessLoad.promise;
    const promise=setUser(user);
    const entry={id:user?.id||null,promise};
    accessLoad=entry;
    promise.finally(()=>{if(accessLoad===entry)accessLoad=null;});
    return promise;
  }
  const label={client:"Client",employee:"Employee",guest:"Guest"};
  const stamp=value=>new Date(value).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"});
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
  const active=room=>room?.status==="open" && Date.now()>=Date.parse(room.starts_at) && Date.now()<=Date.parse(room.ends_at);
  const isMeetingURL=value=>{try{
    const u=new URL(value);
    if(u.protocol!=="https:")return false;
    if((u.hostname==="zoom.us"||u.hostname.endsWith(".zoom.us"))&&u.pathname!=="/")return true;
    return u.hostname==="meet.google.com"&&/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(u.pathname);
  }catch{return false;}};
  function notify(message){const e=$("notice");e.hidden=false;e.textContent=message;clearTimeout(noticeTimeout);noticeTimeout=setTimeout(()=>e.hidden=true,8500);}
  function setSignInMode(signedIn){
    $("signin").hidden=signedIn||recoveryMode;
    $("workspace").hidden=!signedIn||recoveryMode;
    $("password-recovery").hidden=!recoveryMode;
    $("signout").hidden=!signedIn||recoveryMode;
  }
  function roomsForGroup(){return state.rooms.filter(r=>r.audience===state.audience)
    .sort((a,b)=>Number(active(b))-Number(active(a))||Date.parse(a.starts_at)-Date.parse(b.starts_at));}
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
    $("stage-title").textContent=canEnter?"Your private video meeting":"Appointment room locked";
    $("stage-status").textContent=canEnter?"Room is open. Only approved attendees can join.":r.status==="closed"?"This appointment is closed.":r.status==="scheduled"?"Waiting for the host to open this room.":"Access is available only during the appointment window.";
    $("join-video").disabled=true;
    $("join-video").textContent=canEnter?"Checking meeting availability…":"Video available at appointment";
    $("message").disabled=!canEnter;
    $("message-form").querySelector("button").disabled=!canEnter;
    $("messages").replaceChildren(node("p","muted",canEnter?"Loading private messages…":"Group chat unlocks when this appointment is open."));
    if(state.owner){$("edit-status").value=r.status;$("edit-zoom").value="";}
    if(!canEnter)return;
    // A signed-in participant can retrieve the Zoom link only during the approved window.
    // Keep the Join control disabled if no real meeting has been configured.
    const {data,error}=await db.rpc("mx_live_get_join_link",{p_room:r.id});
    if(state.room?.id!==r.id)return;
    if(error||!data||!isMeetingURL(data)){
      $("join-video").disabled=true;
      $("join-video").textContent="Video meeting not configured";
      $("stage-status").textContent="The host has not connected a video meeting to this appointment.";
      return;
    }
    $("join-video").disabled=false;
    $("join-video").textContent="Join video meeting";
  }
  async function refresh(preserve=true){
    if(!state.user||state.busy)return;
    state.busy=true;
    try{
      const {data}=await retrySecureRequest(()=>db.from("mx_live_rooms").select("id,audience,title,starts_at,ends_at,status,created_at")
        .order("starts_at",{ascending:false}).limit(150));
      state.rooms=data||[];
      const wanted=preserve?state.room?.id:null;
      const previous=state.room;
      state.room=state.rooms.find(r=>r.id===wanted)||roomsForGroup()[0]||null;
      const changed=!previous||!state.room||previous.id!==state.room.id||
        previous.status!==state.room.status||previous.starts_at!==state.room.starts_at||
        previous.ends_at!==state.room.ends_at;
      if(changed){
        setGroup(state.audience);
      }else{
        showRooms();
        if(active(state.room))await loadMessages();
      }
      return true;
    }catch(err){
      notify("Unable to load private rooms. Tap Refresh to retry: "+(err.message||err));
      $("room-list").replaceChildren(node("p","muted","Connection interrupted. Tap Refresh above to retry."));
      return false;
    }finally{state.busy=false;}
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
      if(!data){if(meetingTab)meetingTab.close();notify("The host has not assigned an active video meeting link.");return;}
      if(!isMeetingURL(data)){if(meetingTab)meetingTab.close();notify("The configured video meeting link is invalid.");return;}
      if(meetingTab)meetingTab.location.replace(data);
      else window.location.assign(data);
    }catch(err){if(meetingTab)meetingTab.close();notify("Unable to join: "+err.message);}
    finally{button.disabled=false;button.textContent="Join video meeting";}
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
    if(zoom&&!isMeetingURL(zoom)){notify("Enter a valid Zoom or Google Meet URL.");return;}
    const b=$("create-form").querySelector('button[type="submit"]');b.disabled=true;
    try{
      const {data,error}=await db.from("mx_live_rooms").insert({
        audience,title,starts_at:start.toISOString(),ends_at:end.toISOString(),
        status:"scheduled",created_by:state.user.id
      }).select("id").single();if(error)throw error;
      if(zoom){const link=await db.rpc("mx_live_set_zoom_link",{p_room:data.id,p_url:zoom});if(link.error)notify("Room created, but video link was not saved: "+link.error.message);}
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
    if(typeof data==="string" && data.startsWith("No existing sign-in account")){
      const {data:invited,error:inviteError}=await db.functions.invoke("mx-live-invite",{
        body:{room_id:state.room.id,email}
      });
      if(inviteError || !invited?.ok){
        notify("New-account invitation unavailable. Check Supabase Auth email delivery.");return;
      }
      $("invite-email").value="";
      notify(invited.message);return;
    }
    $("invite-email").value="";notify(data||"Room access granted.");
  }
  async function saveZoom(){
    if(!state.owner||!state.room)return;const link=$("edit-zoom").value.trim();
    if(!isMeetingURL(link)){notify("Enter a valid Zoom or Google Meet URL.");return;}
    const {error}=await db.rpc("mx_live_set_zoom_link",{p_room:state.room.id,p_url:link});
    if(error){notify("Link not saved: "+error.message);return;}
    $("edit-zoom").value="";notify("Private meeting link saved. It remains locked until the room opens.");await showRoom();
  }
  async function setUser(user){
    const previous=state.user?.id;
    state.user=user;clearInterval(poll);poll=null;
    setSignInMode(!!user);
    if(!user){state.owner=false;state.room=null;state.rooms=[];$("owner-tools").hidden=true;return;}
    if(previous!==user.id){state.owner=false;state.room=null;state.rooms=[];$("owner-tools").hidden=true;}
    try{
      const {data}=await retrySecureRequest(()=>db.from("veil_memberships")
        .select("role,active").eq("user_id",user.id).maybeSingle());
      if(state.user?.id!==user.id)return;
      state.owner=!!(data?.active&&data.role==="origin");
      $("owner-tools").hidden=!state.owner;
      const loaded=await refresh(false);
      if(!loaded)throw Error("Room list could not be loaded.");
      if(state.user?.id!==user.id)return;
      // Open the first authorized group for guests rather than leaving them on an empty Client tab.
      if(!state.owner && !state.rooms.some(r=>r.audience===state.audience)){
        const first=state.rooms.find(r=>r.audience==="guest")||state.rooms[0];
        if(first)setGroup(first.audience);
      }
      poll=setInterval(async()=>{if(state.user&&!state.busy){await refresh();}},12000);
    }catch(err){
      if(state.user?.id!==user.id)return;
      $("owner-tools").hidden=true;
      $("room-list").replaceChildren(node("p","muted","Private rooms did not load. Tap Refresh to try again."));
      notify("Your sign-in worked, but room loading was interrupted. Tap Refresh to retry.");
    }
  }
  async function start(){
    if(!db){$("signin").querySelector("p").textContent="Secure sign-in could not load. Refresh this page, or try disabling Brave Shields for this website.";return;}
    document.querySelectorAll("[data-audience]").forEach(b=>b.addEventListener("click",()=>setGroup(b.dataset.audience)));
    $("reload").addEventListener("click",async()=>{
      const btn=$("reload");if(btn.disabled)return;
      btn.disabled=true;btn.textContent="Checking…";
      try{
        if(state.user)await loadAccess(state.user);
        else{
          const {data}=await db.auth.getSession();
          await loadAccess(data.session?.user||null);
        }
      }finally{btn.disabled=false;btn.textContent="Refresh";}
    });
    $("join-video").addEventListener("click",joinVideo);
    $("message-form").addEventListener("submit",sendMessage);
    $("create-form").addEventListener("submit",createRoom);
    $("save-status").addEventListener("click",saveStatus);
    $("invite").addEventListener("click",addMember);
    $("save-zoom").addEventListener("click",saveZoom);
    const signStatus=node("p","fineprint","");
    signStatus.id="signin-status";
    signStatus.setAttribute("role","status");
    signStatus.setAttribute("aria-live","polite");
    signStatus.style.cssText="margin:3px 0 0;padding:12px 14px;border:1px solid #806b8e;border-radius:9px;background:#272033;color:#f2d29f;font-size:.9rem;overflow-wrap:anywhere";
    signStatus.hidden=true;
    $("signin-form").append(signStatus);
    const signBtn=$("signin-form").querySelector('button[type="submit"]');
    const magicBtn=$("magic");
    function signFeedback(message,isError=false){
      signStatus.textContent=message;
      signStatus.style.color=isError?"#ffd7d7":"#f2d29f";
      signStatus.style.borderColor=isError?"#b87676":"#806b8e";
      signStatus.hidden=false;
      signStatus.scrollIntoView({block:"nearest",behavior:"instant"});
    }
    $("signin-form").addEventListener("submit",async e=>{
      e.preventDefault();
      if(signBtn.disabled)return;
      const email=$("email").value.trim(),password=$("password").value;
      if(!email||!password){signFeedback("Enter your email and password, or use Send sign-in link.",true);return;}
      signBtn.disabled=true;signBtn.textContent="Signing in…";
      signFeedback("Checking your private account…");
      try{
        const {data,error}=await db.auth.signInWithPassword({email,password});
        if(error){
          const reason=error.message||"Unknown authentication error";
          signFeedback(reason==="Invalid login credentials"
            ?"Email or password not accepted. If you forgot your password, use Forgot password when email delivery is available."
            : "Sign-in failed: "+reason,true);
        }else if(data?.session){
          signFeedback("Signed in. Loading your approved rooms…");
        }else{
          signFeedback("Sign-in was not completed. Try Send sign-in link.",true);
        }
      }catch(err){
        signFeedback("Could not contact secure sign-in. Check your connection, disable Brave Shields for this site if enabled, then retry.",true);
      }finally{signBtn.disabled=false;signBtn.textContent="Sign in";}
    });
    magicBtn.addEventListener("click",async()=>{
      const email=$("email").value.trim();if(!email){signFeedback("Enter your email first.",true);return;}
      magicBtn.disabled=true;magicBtn.textContent="Sending link…";
      signFeedback("Requesting your personal sign-in link…");
      try{
        const {error}=await db.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
        if(error && (error.status===429||/email rate limit|too many requests/i.test(error.message||""))){
          signFeedback("Email service has reached its sending limit. No link was sent. Do not keep retrying; password sign-in still works if you know your password.",true);
          magicBtn.disabled=true;
          magicBtn.textContent="Email temporarily unavailable";
          return;
        }
        signFeedback(error?"Sign-in link failed: "+error.message:"Check your inbox and Spam for your personal sign-in link.",!!error);
      }catch(err){
        signFeedback("Could not send sign-in link. Check your connection and browser shields.",true);
      }finally{
        if(magicBtn.textContent!=="Email temporarily unavailable"){
          magicBtn.disabled=false;magicBtn.textContent="Send sign-in link";
        }
      }
    });
    const forgotBtn=$("forgot");
    forgotBtn.addEventListener("click",async()=>{
      const email=$("email").value.trim();
      if(!email){signFeedback("Enter your email first, then select Forgot password.",true);return;}
      if(forgotBtn.disabled)return;
      forgotBtn.disabled=true;forgotBtn.textContent="Requesting reset…";
      try{
        const {error}=await db.auth.resetPasswordForEmail(email,{
          redirectTo:location.origin+location.pathname
        });
        if(error){
          if(error.status===429||/email rate limit|too many requests/i.test(error.message||"")){
            forgotBtn.textContent="Email temporarily unavailable";
            signFeedback("Password reset email is blocked by the provider's sending limit. No reset was sent. Please do not keep requesting links. Your account and meeting access are unchanged.",true);
            return;
          }
          signFeedback("Password reset request failed: "+error.message,true);
        }else{
          signFeedback("If the account is registered and email delivery is available, check your inbox and Spam for a password reset link.");
        }
      }catch(err){signFeedback("Could not request password reset: "+(err.message||err),true);}
      finally{if(forgotBtn.textContent!=="Email temporarily unavailable"){
        forgotBtn.disabled=false;forgotBtn.textContent="Forgot password? Request reset";
      }}
    });
    $("new-password-form").addEventListener("submit",async e=>{
      e.preventDefault();
      if(!recoveryMode)return;
      const password=$("new-password").value;
      const confirmation=$("confirm-password").value;
      const notice=$("password-recovery-notice");
      notice.hidden=false;
      if(password.length<12||password!==confirmation){
        notice.textContent="Use at least 12 characters, and make sure both passwords match.";
        return;
      }
      const save=$("new-password-form").querySelector('button[type="submit"]');
      save.disabled=true;save.textContent="Saving securely…";
      try{
        const {error}=await db.auth.updateUser({password});
        if(error)throw error;
        $("new-password-form").reset();
        recoveryMode=false;
        notice.hidden=true;
        const {data}=await db.auth.getUser();
        await loadAccess(data?.user||null);
        notify("Password updated. Your approved private rooms are loading.");
      }catch(err){
        notice.textContent="Password could not be changed: "+(err.message||err);
      }finally{save.disabled=false;save.textContent="Save new password";}
    });
    window.__mxLiveReady=true;
    $("signout").addEventListener("click",async()=>{await db.auth.signOut();});
    db.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"){
        recoveryMode=true;
        setSignInMode(true);
        return;
      }
      if(event==="SIGNED_OUT")recoveryMode=false;
      if(["INITIAL_SESSION","SIGNED_IN","SIGNED_OUT"].includes(event) && !recoveryMode){
        setTimeout(()=>loadAccess(session?.user||null),0);
      }
    });
    try{
      const {data,error}=await db.auth.getUser();
      if(error&&error.name!=="AuthSessionMissingError")notify("Session check interrupted. Tap Refresh if needed.");
      await loadAccess(data?.user||null);
    }catch(err){
      const {data}=await db.auth.getSession();
      await loadAccess(data?.session?.user||null);
    }
  }
  start().catch(err=>notify("Private room setup failed: "+err.message));
})();