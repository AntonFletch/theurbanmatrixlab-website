import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../umx-auth.js',import.meta.url),'utf8')).replace(/^import .*;\n/m,'').replace(/\bexport\s+/g,'');
// Unit adapter only. This does not sign in, provide tokens, or access any account.
function harness({role='admin',user={id:'unit-user'},authError=null,profileError=null}={}) {
 const status={textContent:'',setAttribute(){}},host={querySelector:()=>status};
 const auth={getUser:async()=>({data:{user},error:authError}),onAuthStateChange(){}};
 Object.defineProperty(auth,'mfa',{get(){throw Error('Authenticator must not be required');}});
 const client={auth,from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role},error:profileError})})})})};
 const context={createClient:()=>client,setInterval:()=>1,clearInterval(){},window:{addEventListener(){}},document:{hidden:false,createElement:()=>status},navigator:{onLine:true}};
 return {authorize:vm.runInNewContext(source+'\n({authorize})',context).authorize,host,status};
}
test('verified password-only staff passes authorization without an authenticator dependency',async()=>{
 const h=harness(),access=await h.authorize(h.host,{staffOnly:true});assert.equal(access.user.id,'unit-user');assert.equal(access.staff,true);
});
test('password-only employees retain worker access and cannot open staff-only workspaces',async()=>{
 const h=harness({role:'employee'});assert.equal((await h.authorize(h.host)).staff,false);assert.equal(await h.authorize(h.host,{staffOnly:true}),null);
});
test('signed-out, anonymous and unverifiable identities remain denied',async()=>{
 for(const options of [{user:null},{user:{id:'unit-user',is_anonymous:true}},{profileError:Error('unavailable')},{role:'unknown'},{authError:Error('expired')}]) {
  const h=harness(options);assert.equal(await h.authorize(h.host),null);
 }
});
