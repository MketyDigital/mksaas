/* eslint-disable @typescript-eslint/no-explicit-any */
import { moveRouteTarget } from "./route-order";

export function renderCustomerPortal(input: {
  customerName: string;
  hostname: string;
  email: string;
  role: string;
  brandColor?: string | null;
  logoUrl?: string | null;
}) {
  const initial = JSON.stringify(input).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.customerName)} AI</title>
<style>
:root{color-scheme:dark;--bg:#090a0f;--panel:#12141c;--panel2:#171a24;--line:#292d3c;--text:#f6f7fb;--muted:#969bad;--brand:#7c5cff;--danger:#ff6577;--ok:#65d6a6}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text)}
button,input,textarea,select{font:inherit}button{cursor:pointer}.shell{min-height:100vh;display:grid;grid-template-columns:230px 1fr}.side{border-right:1px solid var(--line);background:#0d0f16;padding:20px 14px;position:sticky;top:0;height:100vh}.brand{font-weight:800;font-size:17px;padding:5px 10px 22px}.brand small{display:block;color:var(--muted);font-size:11px;font-weight:500;margin-top:4px}.nav button{width:100%;text-align:left;padding:10px 11px;border:0;border-radius:9px;background:transparent;color:#c8ccda;margin:2px 0}.nav button.active,.nav button:hover{background:#1a1d29;color:white}.foot{position:absolute;bottom:18px;left:14px;right:14px;color:var(--muted);font-size:12px}.main{min-width:0}.top{height:62px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;background:rgba(9,10,15,.9);backdrop-filter:blur(14px);z-index:3}.content{padding:28px;max-width:1250px;margin:auto}.title{font-size:24px;margin:0 0 5px}.sub{color:var(--muted);margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}.metric{font-size:25px;font-weight:800;margin-top:8px}.muted{color:var(--muted)}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.spread{display:flex;align-items:center;justify-content:space-between;gap:12px}.btn{border:1px solid var(--line);background:#1a1d28;color:white;border-radius:9px;padding:9px 12px}.btn.primary{background:var(--brand);border-color:transparent}.btn.danger{color:#ff96a3}.btn:disabled{opacity:.45;cursor:not-allowed}.field{display:grid;gap:6px;margin:12px 0}.field label{font-size:12px;color:#b8bdcc}.input{width:100%;border:1px solid #34394b;background:#0d0f16;color:white;border-radius:9px;padding:10px 11px}.textarea{min-height:170px;resize:vertical}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}.table th{font-size:11px;text-transform:uppercase;color:#858b9f;letter-spacing:.05em}.pill{display:inline-flex;border:1px solid var(--line);border-radius:99px;padding:3px 8px;font-size:11px}.pill.ok{color:var(--ok)}.pill.warn{color:#ffc66f}.pill.danger{color:var(--danger)}.empty{padding:38px;text-align:center;color:var(--muted)}.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.modal{position:fixed;inset:0;background:#0009;display:none;place-items:center;z-index:10}.modal.open{display:grid}.dialog{width:min(680px,92vw);max-height:88vh;overflow:auto;background:#12141c;border:1px solid var(--line);border-radius:16px;padding:22px}.section{display:none}.section.active{display:block}.assistant-list{display:grid;gap:10px}.assistant-item{border:1px solid var(--line);background:var(--panel);padding:15px;border-radius:12px}.chat{display:grid;grid-template-columns:330px 1fr;gap:14px;min-height:520px}.conversation-list{border:1px solid var(--line);border-radius:12px;overflow:auto}.conversation{padding:12px;border-bottom:1px solid var(--line);cursor:pointer}.conversation:hover{background:#161924}.messages{border:1px solid var(--line);border-radius:12px;padding:15px;overflow:auto}.bubble{max-width:75%;padding:10px 12px;border-radius:12px;margin:8px 0;background:#1b1e2a}.bubble.assistant{margin-left:auto;background:#2b2358}.bubble.human{margin-left:auto;background:#1d493d}.toast{position:fixed;right:20px;bottom:20px;padding:12px 14px;border-radius:10px;background:#202432;border:1px solid var(--line);display:none;z-index:20}.toast.show{display:block}
@media(max-width:900px){.shell{grid-template-columns:1fr}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}.nav{display:flex;overflow:auto}.nav button{width:auto;white-space:nowrap}.foot{display:none}.grid,.three,.two{grid-template-columns:1fr 1fr}.chat{grid-template-columns:1fr}.top{position:static}}
@media(max-width:560px){.grid,.three,.two{grid-template-columns:1fr}.content{padding:18px}.top{padding:0 18px}}
</style>
<script src="https://checkout.flutterwave.com/v3.js"></script>
</head>
<body>
<div class="shell">
<aside class="side"><div class="brand" id="brand"></div><nav class="nav" id="nav"></nav><div class="foot"><div id="who"></div><button class="btn" id="logout" style="margin-top:8px;width:100%">Sign out</button></div></aside>
<main class="main"><header class="top"><div><strong id="topTitle">Dashboard</strong></div><div class="muted" id="host"></div></header><div class="content" id="content"></div></main>
</div>
<div class="modal" id="modal"><div class="dialog" id="dialog"></div></div><div class="toast" id="toast"></div>
<script>
const bindIds=root=>root.querySelectorAll('[id]').forEach(el=>{try{globalThis[el.id]=el}catch{}});
bindIds(document);
const byId=id=>document.getElementById(id);
const brand=document.getElementById('brand'),who=document.getElementById('who'),host=document.getElementById('host'),
  nav=document.getElementById('nav'),logout=document.getElementById('logout'),modal=document.getElementById('modal'),
  dialog=document.getElementById('dialog'),toast=document.getElementById('toast'),content=document.getElementById('content'),
  topTitle=document.getElementById('topTitle');
const APP=${initial};
const state={section:'dashboard',assistants:[],knowledge:[],usage:null,conversations:[],handoffs:[],reminders:[],humanApprovals:[],humanOperations:[],humanOpsDestinations:[],humanOpsMembers:[],humanOpsPermissions:{},automation:{paused:false},features:{},account:{status:'active',billingStatus:'pending',userControl:{state:'active'}}};
const sections=['dashboard','assistants','knowledge','conversations','handoffs','human-operations','reminders','usage','api','team','settings'];
const titles={dashboard:'Dashboard',assistants:'Assistants',knowledge:'Knowledge',conversations:'Conversations',handoffs:'Human Handoff','human-operations':'Human Operations',reminders:'Reminders',usage:'Usage & MKredit',api:'API Access',team:'Team',settings:'Settings'};
if(APP.brandColor&&/^#[0-9a-fA-F]{6}$/.test(APP.brandColor))document.documentElement.style.setProperty('--brand',APP.brandColor);
brand.innerHTML=(APP.logoUrl?'<img src="'+esc(APP.logoUrl)+'" alt="" style="width:28px;height:28px;object-fit:contain;vertical-align:middle;margin-right:8px">':'')+esc(APP.customerName)+' AI<small>Assistant Console</small>';
who.textContent=APP.email+' · '+APP.role;host.textContent=APP.hostname;
nav.innerHTML=sections.map(s=>'<button data-s="'+s+'">'+titles[s]+'</button>').join('');
nav.onclick=e=>{const b=e.target.closest('button[data-s]');if(b)go(b.dataset.s)};
logout.onclick=async()=>{await fetch('/api/auth/logout',{method:'POST'});location.reload()};
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toastMsg(s){toast.textContent=s;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2400)}
async function api(path,opt){const r=await fetch(path,opt);let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j}
function openModal(html){dialog.innerHTML=html;bindIds(dialog);modal.classList.add('open')}
function closeModal(){modal.classList.remove('open');dialog.innerHTML=''}
modal.onclick=e=>{if(e.target===modal)closeModal()}
async function refresh(){
 const [a,k,u,c,h,r,g,me,approvals,operations,destinations,team]=await Promise.all([
  api('/api/assistants'),api('/api/knowledge'),api('/api/usage'),api('/api/conversations'),api('/api/handoffs'),api('/api/reminders'),api('/api/automation'),api('/api/me'),api('/api/human-approvals'),api('/api/human-operations'),api('/api/human-ops-destinations'),api('/api/team')
 ]);
 state.assistants=a.assistants||[];state.knowledge=k.collections||[];state.usage=u;state.conversations=c.conversations||[];state.handoffs=h.handoffs||[];state.reminders=r.reminders||[];state.humanApprovals=approvals.approvals||[];state.humanOperations=operations.settings||[];state.humanOpsDestinations=destinations.destinations||[];state.humanOpsMembers=destinations.members||[];state.humanOpsPermissions=destinations.permissions||{};state.automation=g||{paused:false};state.features=me.features||{};state.account={status:me.accountStatus||'active',billingStatus:me.billingStatus||'pending',graceUntil:me.graceUntil||null,userControl:me.userControl||{state:'active'}};
 render();
}
function go(s){state.section=s;topTitle.textContent=titles[s];render()}
function render(){
 [...nav.querySelectorAll('button')].forEach(b=>b.classList.toggle('active',b.dataset.s===state.section));
 const renderers={dashboard:render_dashboard,assistants:render_assistants,knowledge:render_knowledge,conversations:render_conversations,handoffs:render_handoffs,'human-operations':render_human_operations,reminders:render_reminders,usage:render_usage,api:render_api,team:render_team,settings:render_settings};
 const fn=renderers[state.section];content.innerHTML=fn?fn():'';
 bindSection();
}
function render_dashboard(){
 const open=state.handoffs.filter(h=>h.status==='open').length,active=state.assistants.filter(a=>a.status==='active').length;
 const platform=String(state.account?.status||'active');
 const billing=String(state.account?.billingStatus||'pending');
 const control=String(state.account?.userControl?.state||'active');
 let accountLabel='Active',accountClass='ok',accountNote='Your Mkety Assist account is active.';
 if(control!=='active'){accountLabel=control[0].toUpperCase()+control.slice(1);accountClass=control==='banned'||control==='suspended'?'danger':'warn';accountNote='Your portal access is '+control+'.';}
 else if(platform!=='active'){accountLabel=platform==='paused'?'Paused':'Suspended';accountClass='warn';accountNote='Your Mkety Assist account is '+platform+'.';}
 else if(billing!=='current'){accountLabel='Payment pending';accountClass='warn';accountNote='Fund your credits to activate billing.';}
 return '<div class="spread"><div><h1 class="title">Dashboard</h1><p class="sub">Your assistants, conversations and usage in one place.</p></div><span class="pill '+accountClass+'">'+esc(accountLabel)+'</span></div>'+
 '<div class="card" style="margin-bottom:16px"><strong>Account status: '+esc(accountLabel)+'</strong><div class="muted">'+esc(accountNote)+'</div></div>'+
 '<div class="grid">'+metric('Assistants',active+'/'+state.assistants.length)+metric('MKredit',state.usage?.creditsAvailable??0)+metric('Open handoffs',open)+metric('Conversations',state.conversations.length)+
 '</div><div class="two" style="margin-top:16px"><div class="card"><div class="spread"><h3>Assistants</h3><button class="btn primary" data-action="new-assistant">New assistant</button></div>'+assistantRows(state.assistants.slice(0,5))+'</div>'+
 '<div class="card"><h3>Recent conversations</h3>'+conversationRows(state.conversations.slice(0,6))+'</div></div>';
}
function metric(label,value){return '<div class="card"><div class="muted">'+esc(label)+'</div><div class="metric">'+esc(value)+'</div></div>'}
function render_assistants(){return '<div class="spread"><div><h1 class="title">Assistants</h1><p class="sub">Each assistant has its own instructions, Telegram bot, model, knowledge, memory, tools and limits.</p></div><button class="btn primary" data-action="new-assistant">New assistant</button></div>'+assistantRows(state.assistants)}
function assistantRows(rows){return rows.length?'<div class="assistant-list">'+rows.map(a=>'<div class="assistant-item spread"><div><strong>'+esc(a.name)+'</strong><div class="muted">'+esc(a.model_alias)+' · '+esc(a.status)+'</div></div><button class="btn" data-edit-assistant="'+a.id+'">Manage</button></div>').join('')+'</div>':'<div class="empty">No assistants yet.</div>'}
function render_knowledge(){return '<div class="spread"><div><h1 class="title">Knowledge</h1><p class="sub">Reusable business knowledge that can be attached to assistants.</p></div><button class="btn primary" data-action="new-knowledge">New collection</button></div><div class="card">'+(state.knowledge.length?'<table class="table"><thead><tr><th>Collection</th><th>Items</th><th></th></tr></thead><tbody>'+state.knowledge.map(k=>'<tr><td>'+esc(k.name)+'</td><td>'+esc(k.items)+'</td><td><button class="btn" data-manage-knowledge="'+k.id+'">Manage</button> <button class="btn" data-add-knowledge="'+k.id+'">Add content</button></td></tr>').join('')+'</tbody></table>':'<div class="empty">Create a collection to start adding knowledge.</div>')+'</div>'}
function render_conversations(){return '<h1 class="title">Conversations</h1><p class="sub">Live Telegram conversation history across assistants.</p><div class="chat"><div class="conversation-list">'+conversationRows(state.conversations)+'</div><div class="messages" id="messages"><div class="empty">Select a conversation</div></div></div>'}
function conversationRows(rows){return rows.length?rows.map(c=>'<div class="conversation" data-conversation="'+c.id+'"><div class="spread"><strong>'+esc(c.assistant_name||'Assistant')+'</strong><span><button class="btn" data-takeover="'+c.id+'">Take over</button> <button class="btn" data-return-ai="'+c.id+'">AI on</button> <button class="btn" data-clear-memory="'+c.id+'">Clear AI memory</button> '+(c.sender_control_state&&c.sender_control_state!=='active'?'<button class="btn" data-sender-control="'+c.id+'" data-state="active">Restore sender</button>':'<button class="btn" data-sender-control="'+c.id+'" data-state="paused">Pause sender</button> <button class="btn danger" data-sender-control="'+c.id+'" data-state="banned">Ban sender</button>')+'</span></div><div class="muted">'+esc(c.channel)+' · '+new Date((c.updated_at||0)*1000).toLocaleString()+(c.sender_control_state&&c.sender_control_state!=='active'?' · sender '+esc(c.sender_control_state):'')+'</div><div>'+esc((c.last_message||'').slice(0,100))+'</div></div>').join(''):'<div class="empty">No conversations yet.</div>'}
function render_handoffs(){return '<div class="spread"><div><h1 class="title">Human Handoff</h1><p class="sub">Pause all automation, pause one assistant, or take over one conversation.</p></div><button class="btn '+(state.automation?.paused?'primary':'')+'" data-action="toggle-global-automation">'+(state.automation?.paused?'Resume all AI':'Pause all AI')+'</button></div><div class="card">'+(state.handoffs.length?'<table class="table"><thead><tr><th>Assistant</th><th>Status</th><th>Reason</th><th>Action</th></tr></thead><tbody>'+state.handoffs.map(h=>'<tr><td>'+esc(h.assistant_name)+'</td><td><span class="pill '+(h.status==='open'?'warn':'ok')+'">'+esc(h.status)+'</span></td><td>'+esc((h.reason||'').slice(0,120))+'</td><td>'+(h.status==='open'?'<button class="btn" data-reply-handoff="'+h.id+'">Reply</button> <button class="btn" data-resolve-handoff="'+h.id+'">Resolve</button>':'')+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No active handoffs.</div>')+'</div>'}
function render_human_operations(){
 const enabled=new Map(state.humanOperations.map(x=>[x.assistant_id,x]));
 const kinds=['verify_payment','verify_partner_signup','approve_action','human_answer','custom'];
 const permissionCards=state.humanOpsDestinations.map(d=>{
  const configured=state.humanOpsPermissions[d.id]||[];
  const byUser=new Map(configured.map(p=>[p.user_id,p]));
  const actors=state.humanOpsMembers.filter(m=>m.role!=='owner').map(m=>{
   const p=byUser.get(m.id)||{};let current=[];try{current=JSON.parse(p.allowed_kinds_json||'[]')}catch{}
   const controls=kinds.map(kind=>'<label class="row"><input type="checkbox" data-human-ops-kind data-destination="'+esc(d.id)+'" data-user="'+esc(m.id)+'" data-kind="'+kind+'" '+(current.includes(kind)?'checked':'')+'> '+kind.replaceAll('_',' ')+'</label>').join('');
   return '<div class="assistant-item"><strong>'+esc(m.display_name||m.email)+'</strong><div class="muted">'+esc(m.role)+' · '+(m.telegram_linked?'Telegram linked':'Telegram not linked')+'</div>'+controls+'<label class="row"><input type="checkbox" data-human-ops-reply data-destination="'+esc(d.id)+'" data-user="'+esc(m.id)+'" '+(Number(p.can_reply)===1?'checked':'')+'> Can send customer-bound replies</label>'+(APP.role==='owner'&&m.telegram_linked?'<button class="btn" data-save-human-ops-permission data-destination="'+esc(d.id)+'" data-user="'+esc(m.id)+'">Save access</button>':'')+'</div>';
  }).join('');
  return '<div class="card" style="margin-top:12px"><h4>Group access · '+esc(d.name)+'</h4><p class="muted">Owners always have full authority. Other linked team members start with no group authority; choose allowed request types and reply access.</p>'+ (actors||'<div class="empty">No non-owner team members.</div>')+'</div>';
 }).join('');
 return '<div class="spread"><div><h1 class="title">Human Operations</h1><p class="sub">Review records are off until enabled per assistant. Operations groups are separate internal destinations.</p></div><button class="btn primary" data-action="new-human-approval">Create review request</button></div>'+ 
 '<div class="card"><h3>Assistant settings</h3>'+state.assistants.map(a=>{const s=enabled.get(a.id)||{};return '<div class="assistant-item"><div class="spread"><div><strong>'+esc(a.name)+'</strong><div class="muted">Approvals '+(Number(s.approvals_enabled)===1?'enabled':'disabled')+'</div></div><label><input type="checkbox" data-approval-setting="'+esc(a.id)+'" '+(Number(s.approvals_enabled)===1?'checked':'')+'> Enable approvals</label></div><label><input type="checkbox" data-pause-conversation="'+esc(a.id)+'" '+(Number(s.pause_conversation)===1?'checked':'')+'> Pause assistant replies while a human review is pending</label><div class="field"><label>Neutral acknowledgement while review is pending</label><input class="input" data-human-ack="'+esc(a.id)+'" maxlength="600" value="'+esc(s.human_acknowledgement||'Thanks, I have that. I’ll continue from here.')+'"></div></div>'}).join('')+'</div>'+ 
 '<div class="card" style="margin-top:16px"><h3>Connect a Telegram operations group</h3><p class="muted">Choose a delivery bot and the assistants allowed to route reviews to this private group. Copy the one-time link command into that group from an owner/admin Telegram account already linked to Assist.</p><div class="two"><div class="field"><label>Delivery bot</label><select class="input" id="opsDeliveryAssistant">'+state.assistants.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('')+'</select></div><div><label class="muted">Assistant scope</label>'+state.assistants.map(a=>'<label class="row"><input type="checkbox" data-ops-assistant="'+esc(a.id)+'"> '+esc(a.name)+'</label>').join('')+'</div></div><button class="btn primary" data-action="link-human-ops-group">Create one-time group link</button><div class="muted" style="margin-top:8px">Only owners and team members explicitly authorized per request type can act. Ordinary group messages stay internal.</div></div>'+ 
 '<div class="card" style="margin-top:16px"><h3>Connected operations groups</h3>'+(state.humanOpsDestinations.length?'<table class="table"><thead><tr><th>Group</th><th>Delivery bot</th><th>Assistant scope</th><th>Status</th><th></th></tr></thead><tbody>'+state.humanOpsDestinations.map(d=>'<tr><td>'+esc(d.name)+'<div class="muted">'+esc(d.destination_type)+' · '+esc(d.chat_id)+'</div></td><td>'+esc(d.delivery_assistant_name)+'</td><td>'+esc((()=>{try{return JSON.parse(d.assistant_scope_json||'[]').map(id=>state.assistants.find(a=>a.id===id)?.name||id).join(', ')}catch{return ''}})())+'</td><td>'+esc(d.status)+'</td><td><button class="btn" data-human-ops-destination="'+esc(d.id)+'" data-next-status="'+(d.status==='active'?'paused':'active')+'">'+(d.status==='active'?'Pause':'Resume')+'</button> <button class="btn danger" data-human-ops-destination="'+esc(d.id)+'" data-next-status="revoked">Revoke</button></td></tr>').join('')+'</tbody></table>':'<div class="empty">No operations groups connected.</div>')+'</div>'+permissionCards+
 '<div class="card" style="margin-top:16px"><h3>Review history</h3>'+(state.humanApprovals.length?'<table class="table"><thead><tr><th>Assistant</th><th>Request</th><th>Status</th><th>Action</th></tr></thead><tbody>'+state.humanApprovals.map(a=>'<tr><td>'+esc(a.assistant_name)+'</td><td><strong>'+esc(a.kind)+'</strong><div class="muted">'+esc(a.question)+'</div></td><td>'+esc(a.status)+'</td><td>'+(a.status==='pending'?'<button class="btn" data-approval-decision="approved" data-approval-id="'+esc(a.id)+'">Approve</button> <button class="btn danger" data-approval-decision="rejected" data-approval-id="'+esc(a.id)+'">Reject</button>':'')+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No review requests.</div>')+'</div>';
}
function render_reminders(){return '<div class="spread"><div><h1 class="title">Reminders</h1><p class="sub">Scheduled messages are delivered by the connected Telegram assistant.</p></div><button class="btn primary" data-action="new-reminder">New reminder</button></div><div class="card">'+(state.reminders.length?'<table class="table"><thead><tr><th>Assistant</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>'+state.reminders.map(r=>'<tr><td>'+esc(r.assistant_name)+'</td><td>'+new Date(r.due_at*1000).toLocaleString()+'</td><td>'+esc(r.status)+'</td><td>'+(r.status==='scheduled'?'<button class="btn danger" data-cancel-reminder="'+r.id+'">Cancel</button>':'')+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No reminders.</div>')+'</div>'}
function render_usage(){
 const u=state.usage||{};
 const monthly=(Number(u.monthlyFeeMinor||0)/100).toFixed(2);
 const setup=(Number(u.setupFeeMinor||0)/100).toFixed(2);
 return '<div class="spread"><div><h1 class="title">Usage & MKredit</h1><p class="sub">Your MKredit balance and funding history.</p></div><div class="row"><button class="btn primary" data-action="pay-plan">Fund monthly MKredit</button><button class="btn" data-action="buy-credits">Add MKredit</button></div></div>'+
 '<div class="grid">'+metric('Monthly fee','$'+monthly)+(Number(u.setupFeeMinor||0)>0?metric('Setup fee','$'+setup):'')+metric('MKredit available',u.creditsAvailable??0)+metric('MKredit used',u.creditsUsed??0)+'</div>'+
 '<div class="card" style="margin-top:16px"><h3>Payment history</h3><div id="checkoutBox" class="muted">Loading…</div></div>';
}
function render_team(){return '<div class="spread"><div><h1 class="title">Team</h1><p class="sub">Simple portal access for owners, admins and members.</p></div><button class="btn primary" data-action="invite-member">Add member</button></div><div class="card" id="teamBox"><div class="empty">Loading team…</div></div>'}
function render_api(){
 return '<div class="spread"><div><h1 class="title">API Access</h1><p class="sub">Use your assistants from your own apps. API calls consume the same MKredit and limits as other Assist usage.</p></div><button class="btn primary" data-action="new-api-key">Create API key</button></div>'+
 '<div class="card" style="margin-bottom:16px"><h3>Raw Model API</h3><p class="muted">Opt in to direct model calls. These requests use no assistant, tools, knowledge, or saved assistant instructions. Existing keys remain in assistant mode.</p><label class="row"><input id="rawModelApiEnabled" type="checkbox"> Enable for this customer</label><div class="field"><label>Allowed stable Mkety model aliases (comma separated)</label><input class="input" id="rawModelAliases" placeholder="mkety-economy, mkety-smart"></div><p class="muted">Available aliases: <span id="rawModelAvailableAliases">Loading…</span></p><button class="btn" id="saveRawModelApi">Save Raw Model API settings</button></div>'+
 '<div class="card"><p><strong>OpenAI-compatible endpoint</strong></p><p><code>https://'+esc(APP.hostname)+'/v1/chat/completions</code></p><p class="muted">Send Authorization: Bearer &lt;your key&gt;. Keys are shown only once when created.</p><div id="apiKeysBox"><div class="empty">Loading API keys…</div></div></div>';
}
function render_settings(){return '<h1 class="title">Settings</h1><p class="sub">Branding, security, domains and recovery.</p>'+
'<div class="two"><div class="card"><h3>Branding</h3><div class="field"><label>Brand color</label><input class="input" id="brandColor" placeholder="#7c5cff" value="'+esc(APP.brandColor||'')+'"></div><div class="field"><label>Logo URL (HTTPS)</label><input class="input" id="logoUrl" placeholder="https://..." value="'+esc(APP.logoUrl||'')+'"></div><button class="btn primary" data-action="save-branding">Save branding</button></div>'+
'<div class="card"><h3>Security</h3><p class="muted">Change your password and revoke other signed-in sessions.</p><button class="btn primary" data-action="change-password">Change password</button> <button class="btn" data-action="manage-sessions">Manage sessions</button><h3 style="margin-top:20px">Telegram recovery</h3><p class="muted">Connect Telegram while signed in so it can receive recovery codes.</p><button class="btn" data-action="link-telegram">Connect Telegram</button></div></div>'+
'<div class="card" style="margin-top:16px"><h3>Owner alerts</h3><p class="muted">Telegram alerts use only a recovery identity securely linked to the same assistant.</p><div id="notificationPrefsBox"><div class="empty">Loading alert preferences…</div></div></div>'+
'<div class="card" style="margin-top:16px"><div class="spread"><div><h3 style="margin:0">Portal domain</h3><p class="muted">Use your own branded hostname for this Assist portal.</p></div><button class="btn" data-action="refresh-domains">Refresh</button></div><div id="domainSetupBox" class="two" style="margin:12px 0"><input class="input" id="customerNewDomain" placeholder="ai.yourcompany.com"><button class="btn primary" data-action="add-customer-domain">Add custom domain</button></div><div id="customerDomainsBox"><div class="empty">Loading domains…</div></div></div>'}
function newHumanApproval(){const conversations=state.conversations.filter(c=>c.id&&c.assistant_id);openModal('<h2>Create review request</h2><p class="muted">This creates a portal review record. It does not send a message into the customer conversation.</p><div class="field"><label>Conversation</label><select class="input" id="approvalConversation">'+conversations.map(c=>'<option value="'+esc(c.id)+'" data-assistant="'+esc(c.assistant_id)+'">'+esc(c.assistant_name||'Assistant')+' · '+esc(c.channel||'')+' · '+esc(c.id)+'</option>').join('')+'</select></div><div class="field"><label>Request type</label><select class="input" id="approvalKind"><option value="verify_payment">Verify payment</option><option value="verify_partner_signup">Verify partner signup</option><option value="approve_action">Approve action</option><option value="human_answer">Human answer</option><option value="custom">Custom review</option></select></div><div class="field"><label>Question</label><input class="input" id="approvalQuestion" maxlength="1000"></div><div class="field"><label>Summary</label><textarea class="input textarea" id="approvalSummary" maxlength="2000"></textarea></div><div class="row"><button class="btn primary" id="createApproval">Create request</button><button class="btn" id="cancelApproval">Cancel</button></div>');cancelApproval.onclick=closeModal;createApproval.onclick=async()=>{try{const selected=approvalConversation.selectedOptions[0];if(!selected)throw new Error('Select a conversation');await api('/api/human-approvals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assistantId:selected.dataset.assistant,conversationId:approvalConversation.value,kind:approvalKind.value,question:approvalQuestion.value,summary:approvalSummary.value,idempotencyKey:crypto.randomUUID()})});closeModal();toastMsg('Review request created');await refresh()}catch(e){toastMsg(e.message)}}}
function bindSection(){
 const saveHumanSetting=async assistantId=>{const checkbox=content.querySelector('[data-approval-setting="'+assistantId+'"]'),pause=content.querySelector('[data-pause-conversation="'+assistantId+'"]'),ack=content.querySelector('[data-human-ack="'+assistantId+'"]');await api('/api/human-operations',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({assistantId,approvalsEnabled:checkbox?.checked===true,pauseConversation:pause?.checked===true,humanAcknowledgement:ack?.value||''})});toastMsg('Human Operations setting saved');await refresh()};
 content.querySelectorAll('[data-approval-setting]').forEach(el=>el.onchange=async()=>{try{await saveHumanSetting(el.dataset.approvalSetting)}catch(e){el.checked=!el.checked;toastMsg(e.message)}});
 content.querySelectorAll('[data-pause-conversation]').forEach(el=>el.onchange=async()=>{try{await saveHumanSetting(el.dataset.pauseConversation)}catch(e){el.checked=!el.checked;toastMsg(e.message)}});
 content.querySelectorAll('[data-human-ack]').forEach(el=>el.onblur=async()=>{try{await saveHumanSetting(el.dataset.humanAck)}catch(e){toastMsg(e.message)}});
 content.querySelectorAll('[data-action="link-human-ops-group"]').forEach(button=>button.onclick=async()=>{try{const assistantIds=[...content.querySelectorAll('[data-ops-assistant]:checked')].map(el=>el.dataset.opsAssistant);const result=await api('/api/human-ops-destinations/link-challenges',{method:'POST',body:JSON.stringify({deliveryAssistantId:byId('opsDeliveryAssistant').value,assistantIds})});prompt('Send this command to the private group from your linked owner/admin Telegram account. It expires in 10 minutes:',result.command);await refresh()}catch(e){toastMsg(e.message)}});
 content.querySelectorAll('[data-human-ops-destination]').forEach(button=>button.onclick=async()=>{try{await api('/api/human-ops-destinations/'+encodeURIComponent(button.dataset.humanOpsDestination),{method:'PATCH',body:JSON.stringify({status:button.dataset.nextStatus})});await refresh()}catch(e){toastMsg(e.message)}});
 content.querySelectorAll('[data-save-human-ops-permission]').forEach(button=>button.onclick=async()=>{try{const destinationId=button.dataset.destination,userId=button.dataset.user,allowedKinds=[...content.querySelectorAll('[data-human-ops-kind]:checked')].filter(el=>el.dataset.destination===destinationId&&el.dataset.user===userId).map(el=>el.dataset.kind),reply=content.querySelector('[data-human-ops-reply][data-destination="'+destinationId+'"][data-user="'+userId+'"]');await api('/api/human-ops-destinations/'+encodeURIComponent(destinationId)+'/permissions',{method:'PUT',body:JSON.stringify({userId,allowedKinds,canReply:reply?.checked===true})});toastMsg('Group access saved');await refresh()}catch(e){toastMsg(e.message)}});
 content.querySelectorAll('[data-approval-decision]').forEach(el=>el.onclick=async()=>{try{await api('/api/human-approvals/'+el.dataset.approvalId,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({decision:el.dataset.approvalDecision})});toastMsg('Decision recorded');await refresh()}catch(e){toastMsg(e.message)}});
 content.querySelectorAll('[data-action="new-human-approval"]').forEach(b=>b.onclick=newHumanApproval);
 content.querySelectorAll('[data-action="new-assistant"]').forEach(b=>b.onclick=newAssistant);
 content.querySelectorAll('[data-edit-assistant]').forEach(b=>b.onclick=()=>editAssistant(b.dataset.editAssistant));
 content.querySelectorAll('[data-action="new-knowledge"]').forEach(b=>b.onclick=newKnowledge);
 content.querySelectorAll('[data-add-knowledge]').forEach(b=>b.onclick=()=>addKnowledge(b.dataset.addKnowledge));
 content.querySelectorAll('[data-manage-knowledge]').forEach(b=>b.onclick=()=>manageKnowledge(b.dataset.manageKnowledge));
 content.querySelectorAll('[data-conversation]').forEach(b=>b.onclick=e=>{if(!e.target.closest('button'))loadMessages(b.dataset.conversation)});
 content.querySelectorAll('[data-takeover]').forEach(b=>b.onclick=e=>{e.stopPropagation();setConversationAutomation(b.dataset.takeover,true)});
 content.querySelectorAll('[data-return-ai]').forEach(b=>b.onclick=e=>{e.stopPropagation();setConversationAutomation(b.dataset.returnAi,false)});
 content.querySelectorAll('[data-clear-memory]').forEach(b=>b.onclick=e=>{e.stopPropagation();clearConversationMemory(b.dataset.clearMemory)});
 content.querySelectorAll('[data-sender-control]').forEach(b=>b.onclick=e=>{e.stopPropagation();setSenderControl(b.dataset.senderControl,b.dataset.state)});
 content.querySelectorAll('[data-action="toggle-global-automation"]').forEach(b=>b.onclick=toggleGlobalAutomation);
 content.querySelectorAll('[data-reply-handoff]').forEach(b=>b.onclick=()=>replyHandoff(b.dataset.replyHandoff));
 content.querySelectorAll('[data-resolve-handoff]').forEach(b=>b.onclick=()=>resolveHandoff(b.dataset.resolveHandoff));
 content.querySelectorAll('[data-cancel-reminder]').forEach(b=>b.onclick=()=>cancelReminder(b.dataset.cancelReminder));
 content.querySelectorAll('[data-action="new-reminder"]').forEach(b=>b.onclick=newReminder);
 content.querySelectorAll('[data-action="link-telegram"]').forEach(b=>b.onclick=linkTelegram);
 content.querySelectorAll('[data-action="change-password"]').forEach(b=>b.onclick=changePassword);
 content.querySelectorAll('[data-action="manage-sessions"]').forEach(b=>b.onclick=manageSessions);
 content.querySelectorAll('[data-action="save-branding"]').forEach(b=>b.onclick=saveBranding);
 content.querySelectorAll('[data-action="refresh-domains"]').forEach(b=>b.onclick=loadCustomerDomains);
 content.querySelectorAll('[data-action="add-customer-domain"]').forEach(b=>b.onclick=addCustomerDomain);
 content.querySelectorAll('[data-action="invite-member"]').forEach(b=>b.onclick=inviteMember);
 content.querySelectorAll('[data-action="buy-credits"]').forEach(b=>b.onclick=buyCredits);
 content.querySelectorAll('[data-action="pay-plan"]').forEach(b=>b.onclick=payPlan);
 content.querySelectorAll('[data-action="new-api-key"]').forEach(b=>b.onclick=newApiKey);
 content.querySelectorAll('[data-revoke-api-key]').forEach(b=>b.onclick=()=>revokeApiKey(b.dataset.revokeApiKey));
 if(state.section==='team')loadTeam();
 if(state.section==='usage')loadCheckouts();
 if(state.section==='api')loadApiKeys();
 if(state.section==='settings'){loadCustomerDomains();loadNotificationPreferences();}
}
function newAssistant(){
 openModal('<h2>New assistant</h2><div class="field"><label>Name</label><input class="input" id="naName"></div><div class="field"><label>Instructions</label><textarea class="input textarea" id="naInstructions" placeholder="What should this assistant do?"></textarea></div><div class="field"><label>Model</label><select class="input" id="naModel"><option value="mkety-smart">Smart</option><option value="mkety-fast">Fast</option><option value="mkety-reasoning">Reasoning</option><option value="mkety-vision">Vision</option></select></div><div class="row"><button class="btn primary" id="naCreate">Create assistant</button><button class="btn" id="naCancel">Cancel</button></div>');
 naCancel.onclick=closeModal;naCreate.onclick=async()=>{try{await api('/api/assistants',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:naName.value,instructions:naInstructions.value,modelAlias:naModel.value})});closeModal();toastMsg('Assistant created');await refresh()}catch(e){toastMsg(e.message)}};
}
async function editAssistant(id){
 try{
  const [d,identityData]=await Promise.all([api('/api/assistants/'+id),api('/api/assistants/'+id+'/channel-identities').catch(()=>({identities:[]}))]),a=d.assistant||{},tg=a.telegram_config?JSON.parse(a.telegram_config):null;
  const secretaryIdentity=(identityData.identities||[]).find(x=>x.channel==='telegram'&&x.connection_mode==='secretary'&&x.is_self_identity);
  const knowledgeChecks=state.knowledge.map(k=>'<label class="row"><input type="checkbox" class="kcheck" value="'+k.id+'" '+((d.knowledge||[]).some(x=>x.id===k.id)?'checked':'')+'> '+esc(k.name)+'</label>').join('')||'<span class="muted">No knowledge collections yet.</span>';
  const reasoningCapabilities=new Set(Array.isArray(a.reasoning_capabilities)?a.reasoning_capabilities:['standard']);
  const reasoningTierOptions=[['standard','Standard'],['high','High'],['maximum','Maximum']].map(([value,label])=>'<option value="'+value+'" '+(value===(a.reasoning_mode||'standard')?'selected ':'')+(!reasoningCapabilities.has(value)?'disabled':'')+'>'+label+(!reasoningCapabilities.has(value)?' — unavailable on this route':'')+'</option>').join('');
  const tools=(d.tools||[]).map(t=>'<div class="spread"><span>'+esc(t.name)+' <small class="muted">'+esc(t.endpoint_url)+'</small></span><button class="btn danger" data-del-tool="'+t.id+'">Remove</button></div>').join('')||'<p class="muted">No tools configured.</p>';
  openModal('<div class="spread"><h2>'+esc(a.name)+'</h2><span class="pill '+(a.status==='active'?'ok':'warn')+'">'+esc(a.status)+'</span></div>'+
   '<div class="two"><div><div class="field"><label>Name</label><input class="input" id="eaName" value="'+esc(a.name)+'"></div><div class="field"><label>Status</label><select class="input" id="eaStatus"><option>active</option><option>paused</option><option>disabled</option></select></div><div class="field"><label>Model</label><select class="input" id="eaModel"><option value="mkety-smart">Smart</option><option value="mkety-fast">Fast</option><option value="mkety-reasoning">Reasoning</option><option value="mkety-vision">Vision</option></select></div><div class="field"><label>Reasoning level (charged to your business MKredits)</label><select class="input" id="eaReasoning">'+reasoningTierOptions+'</select><p class="muted">Higher reasoning can use more MKredits. Choices unavailable on your configured model route are disabled.</p></div><div class="field"><label>If this level is unavailable</label><select class="input" id="eaReasoningFallback"><option value="allow_lower_effort">Allow a lower supported level to keep replies available</option><option value="strict">Require the selected level</option></select><p class="muted">Assist tries your chosen level first. Lower effort is used only under this policy and is recorded in owner diagnostics.</p></div><div class="field"><label>Monthly assistant MKredit cap (optional)</label><input class="input" id="eaCap" type="number" min="0" value="'+esc(a.monthly_credit_cap??'')+'"></div><label class="row"><input id="eaMemory" type="checkbox" '+(a.memory_enabled?'checked':'')+'> Memory enabled</label><label class="row"><input id="eaAutomation" type="checkbox" '+(!a.automation_paused?'checked':'')+'> AI automation enabled</label><div class="card" style="margin-top:12px"><h3>Human-like reply timing</h3><label class="row"><input id="eaHumanDelay" type="checkbox" '+(a.human_delay_enabled?'checked':'')+'> Add a natural delay before AI replies</label><div class="field"><label>Quick timing</label><select class="input" id="eaDelayPreset"><option value="custom">Custom</option><option value="15">Around 15 seconds</option><option value="30">Around 30 seconds</option><option value="60">Around 1 minute</option><option value="120">Around 2 minutes</option><option value="300">Around 5 minutes</option></select></div><div class="two"><div class="field"><label>Minimum delay (seconds)</label><input class="input" id="eaDelayMin" type="number" min="0" max="3600" value="'+esc(a.human_delay_min_seconds??3)+'"></div><div class="field"><label>Maximum delay (seconds)</label><input class="input" id="eaDelayMax" type="number" min="0" max="3600" value="'+esc(a.human_delay_max_seconds??12)+'"></div></div><p class="muted">This is the natural pacing window. Provider capacity, rate limits or retries may safely extend delivery beyond it instead of dropping the message.</p><div class="field"><label>Pause AI after I reply manually (minutes)</label><input class="input" id="eaManualPause" type="number" min="1" max="1440" value="'+esc(Math.max(1,Math.round(Number(a.manual_reply_pause_seconds||900)/60)))+'"></div><p class="muted">Default is 15 minutes. Any manual Telegram Business reply pauses only that conversation, cancels queued AI replies, then AI resumes automatically after this cooldown unless you took over the conversation manually.</p></div></div>'+
   '<div><h3>Telegram</h3><p class="muted">'+(tg?'Connected to @'+esc(tg.username||'bot'):'Not connected')+'</p>'+(tg?'<div class="card" style="margin:10px 0"><div class="spread"><strong>Telegram Business / Secretary Mode</strong><span class="pill '+(secretaryIdentity?'ok':'warn')+'">'+(secretaryIdentity?'Connected':'Awaiting Business connection')+'</span></div><p class="muted" style="margin-bottom:0">'+(secretaryIdentity?'The real business account is protected as the self identity. Your own replies and Assist-sent echoes are ignored automatically.':'Enable this bot as the connected chatbot in Telegram Business. Assist will recognize the real account automatically when Telegram sends the Business connection.')+'</p></div>':'')+'<input class="input" id="eaBotToken" type="password" placeholder="Paste BotFather token"><div class="row"><button class="btn primary" id="eaConnect">Connect / replace</button><button class="btn danger" id="eaDisconnect">Disconnect</button></div></div></div>'+
   '<div class="field"><label>Instructions</label><textarea class="input textarea" id="eaInstructions">'+esc(a.instructions||'')+'</textarea></div>'+
   '<div class="card"><h3>Knowledge</h3>'+knowledgeChecks+'</div>'+
   '<div class="card" style="margin-top:12px"><h3>Tools</h3><div id="toolList">'+tools+'</div><div class="three"><input class="input" id="toolName" placeholder="Tool name"><input class="input" id="toolUrl" placeholder="https://api.example.com/action"><input class="input" id="toolAuth" placeholder="Authorization value (optional)"></div><input class="input" id="toolDesc" style="margin-top:8px" placeholder="What this tool does"><button class="btn" id="addTool" style="margin-top:8px">Add tool</button></div>'+
   '<div class="row" style="margin-top:16px"><button class="btn primary" id="eaSave">Save changes</button><button class="btn" id="eaVersions">History</button><button class="btn" id="eaArchive">Archive</button><button class="btn danger" id="eaDelete">Delete</button><button class="btn" id="eaClose">Close</button></div>');
  eaStatus.value=a.status;eaModel.value=a.model_alias;eaReasoning.value=a.reasoning_mode||'standard';eaReasoningFallback.value=a.reasoning_fallback_policy||'allow_lower_effort';eaClose.onclick=closeModal;
  const syncDelayPreset=()=>{
    if(!globalThis.eaDelayPreset)return;
    const min=Number(eaDelayMin.value||0),max=Number(eaDelayMax.value||0);
    const preset=[15,30,60,120,300].find(v=>min===Math.max(0,Math.floor(v*.8))&&max===Math.ceil(v*1.2));
    eaDelayPreset.value=preset?String(preset):'custom';
  };
  if(globalThis.eaDelayPreset)eaDelayPreset.onchange=()=>{if(eaDelayPreset.value!=='custom'){const v=Number(eaDelayPreset.value);eaDelayMin.value=String(Math.max(0,Math.floor(v*.8)));eaDelayMax.value=String(Math.ceil(v*1.2))}syncDelayPreset()};
  eaDelayMin.oninput=syncDelayPreset;eaDelayMax.oninput=syncDelayPreset;syncDelayPreset();
  const mediaInfo=document.createElement('div');mediaInfo.className='card';mediaInfo.style.marginTop='12px';mediaInfo.innerHTML='<h3>Message understanding</h3><div class="row"><span class="pill '+(state.features.vision_enabled?'ok':'warn')+'">Photos '+(state.features.vision_enabled?'enabled':'disabled')+'</span><span class="pill '+(state.features.voice_enabled?'ok':'warn')+'">Voice notes '+(state.features.voice_enabled?'enabled':'disabled')+'</span></div><p class="muted">When enabled, customers can send photos or voice notes naturally. Assist understands the media first, then the selected model answers normally—no special prompt format is required.</p>';eaInstructions.closest('.field').before(mediaInfo);
  eaSave.onclick=async()=>{try{await api('/api/assistants/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:eaName.value,status:eaStatus.value,modelAlias:eaModel.value,reasoningMode:eaReasoning.value,reasoningFallbackPolicy:eaReasoningFallback.value,instructions:eaInstructions.value,memoryEnabled:eaMemory.checked,monthlyCreditCap:eaCap.value?Number(eaCap.value):null,humanDelayEnabled:eaHumanDelay.checked,humanDelayMinSeconds:Number(eaDelayMin.value||0),humanDelayMaxSeconds:Number(eaDelayMax.value||0),manualReplyPauseSeconds:Math.max(60,Number(eaManualPause.value||15)*60)})});await api('/api/assistants/'+id+'/automation',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({paused:!eaAutomation.checked})});await api('/api/assistants/'+id+'/knowledge',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({collectionIds:[...document.querySelectorAll('.kcheck:checked')].map(x=>x.value)})});toastMsg('Assistant saved');closeModal();await refresh()}catch(e){toastMsg(e.message)}};
  eaVersions.onclick=async()=>{try{const v=await api('/api/assistants/'+id+'/versions');openModal('<h2>Version history</h2>'+(v.versions||[]).map(x=>'<div class="assistant-item spread"><span>Version '+esc(x.version)+' · '+new Date(x.created_at*1000).toLocaleString()+'</span><button class="btn" data-rollback-version="'+x.version+'">Restore</button></div>').join('')+'<div class="row" style="margin-top:12px"><button class="btn" id="versionClose">Close</button></div>');versionClose.onclick=closeModal;dialog.querySelectorAll('[data-rollback-version]').forEach(b=>b.onclick=async()=>{await api('/api/assistants/'+id+'/rollback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({version:Number(b.dataset.rollbackVersion)})});closeModal();toastMsg('Version restored');await refresh()})}catch(e){toastMsg(e.message)}};
  eaArchive.onclick=async()=>{try{await api('/api/assistants/'+id+'/archive',{method:'POST'});closeModal();toastMsg('Assistant archived');await refresh()}catch(e){toastMsg(e.message)}};
  eaDelete.onclick=async()=>{if(!confirm('Permanent delete requires the assistant to be archived first. Continue?'))return;try{await api('/api/assistants/'+id,{method:'DELETE'});closeModal();toastMsg('Assistant deleted');await refresh()}catch(e){toastMsg(e.message)}};
  eaConnect.onclick=async()=>{try{if(!eaBotToken.value)throw new Error('Paste a bot token first');const x=await api('/api/assistants/'+id+'/telegram',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({botToken:eaBotToken.value})});toastMsg('Telegram connected to @'+(x.bot.username||'bot'));closeModal();await editAssistant(id)}catch(e){toastMsg(e.message)}};
  eaDisconnect.onclick=async()=>{try{await api('/api/assistants/'+id+'/telegram',{method:'DELETE'});toastMsg('Telegram disconnected');closeModal();await editAssistant(id)}catch(e){toastMsg(e.message)}};
  addTool.onclick=async()=>{try{await api('/api/assistants/'+id+'/tools',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:toolName.value,description:toolDesc.value,endpointUrl:toolUrl.value,authHeader:toolAuth.value||null})});toastMsg('Tool added');closeModal();await editAssistant(id)}catch(e){toastMsg(e.message)}};
  dialog.querySelectorAll('[data-del-tool]').forEach(b=>b.onclick=async()=>{await api('/api/assistants/'+id+'/tools/'+b.dataset.delTool,{method:'DELETE'});closeModal();await editAssistant(id)});
 }catch(e){toastMsg(e.message)}
}
function newKnowledge(){openModal('<h2>New knowledge collection</h2><input class="input" id="knName" placeholder="e.g. Products, Policies, FAQs"><div class="row" style="margin-top:12px"><button class="btn primary" id="knCreate">Create</button><button class="btn" id="knCancel">Cancel</button></div>');knCancel.onclick=closeModal;knCreate.onclick=async()=>{try{await api('/api/knowledge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:knName.value})});closeModal();await refresh()}catch(e){toastMsg(e.message)}}}
async function manageKnowledge(collectionId){
 try{
  const d=await api('/api/knowledge/'+encodeURIComponent(collectionId));
  const items=d.items||[];
  openModal('<h2>Manage knowledge</h2><div class="field"><label>Collection name</label><input class="input" id="kcManageName" value="'+esc(d.collection?.name||'')+'"></div><div class="row"><button class="btn primary" id="kcRename">Save name</button><button class="btn danger" id="kcDelete">Delete collection</button></div><h3 style="margin-top:20px">Items</h3><div id="kcItems">'+(items.length?items.map(x=>'<div class="assistant-item"><div class="spread"><div><strong>'+esc(x.title)+'</strong><div class="muted">'+esc(x.status)+(x.error_code?' · '+esc(x.error_code):'')+'</div></div><span>'+(x.status==='error'?'<button class="btn" data-retry-knowledge="'+x.id+'">Retry</button> ':'')+'<button class="btn" data-rename-knowledge-item="'+x.id+'" data-title="'+esc(x.title)+'">Rename</button> <button class="btn danger" data-delete-knowledge-item="'+x.id+'">Delete</button></span></div></div>').join(''):'<div class="empty">No items.</div>')+'</div><div class="row" style="margin-top:12px"><button class="btn" id="kcClose">Close</button></div>');
  kcClose.onclick=closeModal;
  kcRename.onclick=async()=>{try{await api('/api/knowledge/'+encodeURIComponent(collectionId),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:kcManageName.value})});toastMsg('Collection renamed');await refresh()}catch(e){toastMsg(e.message)}};
  kcDelete.onclick=async()=>{if(!confirm('Delete this collection and its stored knowledge items?'))return;try{await api('/api/knowledge/'+encodeURIComponent(collectionId),{method:'DELETE'});closeModal();await refresh();toastMsg('Collection deleted')}catch(e){toastMsg(e.message)}};
  dialog.querySelectorAll('[data-retry-knowledge]').forEach(b=>b.onclick=async()=>{try{await api('/api/knowledge-items/'+encodeURIComponent(b.dataset.retryKnowledge)+'/retry',{method:'POST'});toastMsg('Retry completed');await manageKnowledge(collectionId)}catch(e){toastMsg(e.message)}});
  dialog.querySelectorAll('[data-delete-knowledge-item]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this knowledge item?'))return;try{await api('/api/knowledge-items/'+encodeURIComponent(b.dataset.deleteKnowledgeItem),{method:'DELETE'});await manageKnowledge(collectionId)}catch(e){toastMsg(e.message)}});
  dialog.querySelectorAll('[data-rename-knowledge-item]').forEach(b=>b.onclick=async()=>{const title=prompt('New item title:',b.dataset.title||'');if(!title)return;try{await api('/api/knowledge-items/'+encodeURIComponent(b.dataset.renameKnowledgeItem),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({title})});await manageKnowledge(collectionId)}catch(e){toastMsg(e.message)}});
 }catch(e){toastMsg(e.message)}
}
async function setSenderControl(conversationId,state){
 try{
  let reason=null;
  if(state!=='active')reason=prompt((state==='banned'?'Ban':'Pause')+' this sender — optional reason')||null;
  await api('/api/conversations/'+conversationId+'/sender-control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({state,reason})});
  toastMsg(state==='active'?'Sender restored':'Sender '+state);
  await refresh();
 }catch(e){toastMsg(e.message)}
}
async function clearConversationMemory(id){
 if(!confirm('Clear the AI memory for this conversation? The visible chat history will remain.'))return;
 try{await api('/api/conversations/'+encodeURIComponent(id)+'/memory',{method:'DELETE'});toastMsg('AI memory cleared')}catch(e){toastMsg(e.message)}
}
function addKnowledge(collectionId){openModal('<h2>Add knowledge</h2><div class="field"><label>Title</label><input class="input" id="kiTitle"></div><div class="field"><label>Paste text</label><textarea class="input textarea" id="kiContent"></textarea></div><p class="muted">Or upload TXT, Markdown, CSV, JSON or HTML (10 MB max).</p><input class="input" id="kiFile" type="file"><div class="row" style="margin-top:12px"><button class="btn primary" id="kiSave">Add</button><button class="btn" id="kiCancel">Cancel</button></div>');kiCancel.onclick=closeModal;kiSave.onclick=async()=>{try{if(kiFile.files[0]){const fd=new FormData();fd.append('collectionId',collectionId);fd.append('file',kiFile.files[0]);await api('/api/knowledge/item',{method:'POST',body:fd})}else{await api('/api/knowledge/item',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({collectionId,title:kiTitle.value,content:kiContent.value})})}closeModal();toastMsg('Knowledge added');await refresh()}catch(e){toastMsg(e.message)}}}
async function loadMessages(id){try{const d=await api('/api/conversations/'+id+'/messages');messages.innerHTML=(d.messages||[]).map(m=>'<div class="bubble '+esc(m.role)+'"><small class="muted">'+esc(m.role)+'</small><br>'+esc(m.content)+'</div>').join('')||'<div class="empty">No messages.</div>';messages.scrollTop=messages.scrollHeight}catch(e){toastMsg(e.message)}}
function replyHandoff(id){openModal('<h2>Reply as human</h2><textarea class="input textarea" id="hrText" placeholder="Your reply"></textarea><div class="row"><button class="btn primary" id="hrSend">Send</button><button class="btn" id="hrCancel">Cancel</button></div>');hrCancel.onclick=closeModal;hrSend.onclick=async()=>{try{await api('/api/handoffs/'+id+'/reply',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:hrText.value})});closeModal();toastMsg('Reply sent')}catch(e){toastMsg(e.message)}}}
async function resolveHandoff(id){try{await api('/api/handoffs/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:'resolved'})});toastMsg('Handoff resolved');await refresh()}catch(e){toastMsg(e.message)}}
async function toggleGlobalAutomation(){try{await api('/api/automation',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({paused:!state.automation?.paused})});await refresh();toastMsg(state.automation?.paused?'All AI paused':'AI resumed')}catch(e){toastMsg(e.message)}}
async function setConversationAutomation(id,paused){try{await api('/api/conversations/'+encodeURIComponent(id)+'/automation',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({paused})});toastMsg(paused?'Conversation taken over':'Conversation returned to AI');await refresh()}catch(e){toastMsg(e.message)}}
function newReminder(){
 const conversations=state.conversations.map(x=>'<option value="'+x.id+'" data-assistant="'+x.assistant_id+'">'+esc(x.assistant_name||'Assistant')+' · '+esc((x.last_message||'Conversation').slice(0,60))+'</option>').join('');
 if(!conversations){toastMsg('Start a customer conversation before scheduling a reminder.');return}
 openModal('<h2>New reminder</h2><div class="field"><label>Conversation</label><select class="input" id="remConversation">'+conversations+'</select></div><div class="field"><label>Due</label><input class="input" id="remDue" type="datetime-local"></div><div class="field"><label>Message</label><textarea class="input" id="remText"></textarea></div><div class="row"><button class="btn primary" id="remSave">Schedule</button><button class="btn" id="remCancel">Cancel</button></div>');
 remCancel.onclick=closeModal;
 remSave.onclick=async()=>{try{
   const option=remConversation.selectedOptions[0];
   await api('/api/reminders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assistantId:option.dataset.assistant,conversationId:remConversation.value,dueAt:new Date(remDue.value).toISOString(),text:remText.value})});
   closeModal();toastMsg('Reminder scheduled');await refresh()
 }catch(e){toastMsg(e.message)}}
}
async function cancelReminder(id){try{await api('/api/reminders/'+id,{method:'DELETE'});await refresh()}catch(e){toastMsg(e.message)}}
async function loadTeam(){try{const d=await api('/api/team');teamBox.innerHTML=(d.members||[]).length?'<table class="table"><thead><tr><th>Email</th><th>Role</th><th>Telegram</th></tr></thead><tbody>'+d.members.map(m=>'<tr><td>'+esc(m.email)+'</td><td>'+esc(m.role)+'</td><td>'+esc(m.telegram_username?'@'+m.telegram_username:'Not linked')+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No team members.</div>'}catch(e){teamBox.textContent=e.message}}
function inviteMember(){openModal('<h2>Add team member</h2><div class="field"><label>Email</label><input class="input" id="tmEmail" type="email"></div><div class="field"><label>Role</label><select class="input" id="tmRole"><option value="member">Member</option><option value="admin">Admin</option></select></div><div class="row"><button class="btn primary" id="tmAdd">Add member</button><button class="btn" id="tmCancel">Cancel</button></div>');tmCancel.onclick=closeModal;tmAdd.onclick=async()=>{try{const d=await api('/api/team',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:tmEmail.value,role:tmRole.value})});closeModal();if(d.setupUrl)prompt('Share this one-time setup link with the member:',d.setupUrl);await loadTeam();toastMsg('Team member added')}catch(e){toastMsg(e.message)}}}
async function loadApiKeys(){
 try{
  const [d,raw]=await Promise.all([api('/api/keys'),api('/api/raw-model-api')]);const keys=d.keys||[];state.rawModelApiSettings=raw;
  const enabled=byId('rawModelApiEnabled'),aliases=byId('rawModelAliases'),available=byId('rawModelAvailableAliases');
  if(enabled)enabled.checked=raw.enabled===true;if(aliases)aliases.value=(raw.allowedAliases||[]).join(', ');if(available)available.textContent=(raw.availableAliases||[]).join(', ')||'No active model routes';
  if(byId('saveRawModelApi'))byId('saveRawModelApi').onclick=async()=>{try{const allowedAliases=(byId('rawModelAliases').value||'').split(',').map(x=>x.trim()).filter(Boolean);await api('/api/raw-model-api',{method:'PUT',body:JSON.stringify({enabled:byId('rawModelApiEnabled').checked,allowedAliases})});toastMsg('Raw Model API settings saved');await loadApiKeys()}catch(e){toastMsg(e.message)}};
  apiKeysBox.innerHTML=keys.length?'<table class="table"><thead><tr><th>Name</th><th>Prefix</th><th>Mode</th><th>Assistant / models</th><th>Status</th><th>Last used</th><th></th></tr></thead><tbody>'+keys.map(k=>'<tr><td>'+esc(k.name)+'</td><td><code>'+esc(k.token_prefix)+'…</code></td><td>'+esc(k.mode||'assistant')+'</td><td>'+esc(k.mode==='raw_model'?JSON.parse(k.model_allowlist_json||'[]').join(', '):(k.assistant_name||'Any (assistant_id required)'))+'</td><td>'+esc(k.status)+'</td><td>'+esc(k.last_used_at?new Date(k.last_used_at*1000).toLocaleString():'Never')+'</td><td>'+(k.status==='active'?'<button class="btn danger" data-revoke-api-key="'+k.id+'">Revoke</button>':'')+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No API keys yet.</div>';
  apiKeysBox.querySelectorAll('[data-revoke-api-key]').forEach(b=>b.onclick=()=>revokeApiKey(b.dataset.revokeApiKey));
 }catch(e){apiKeysBox.textContent=e.message}
}
function newApiKey(){
 const opts='<option value="">Any assistant (request must send assistant_id)</option>'+state.assistants.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join('');
 const raw=(state.rawModelApiSettings||{});const rawDisabled=raw.enabled?'':' disabled';
 openModal('<h2>Create API key</h2><p class="muted">The secret is shown once. Calls spend from this customer credit balance.</p><div class="field"><label>Name</label><input class="input" id="akName" placeholder="Production app"></div><div class="field"><label>Key mode</label><select class="input" id="akMode"><option value="assistant">Assistant</option><option value="raw_model"'+rawDisabled+'>Raw Model API (opt in)</option></select></div><div class="field" id="akAssistantWrap"><label>Assistant scope</label><select class="input" id="akAssistant">'+opts+'</select></div><div class="field" id="akModelsWrap" hidden><label>Allowed model aliases</label><input class="input" id="akModels" placeholder="mkety-economy"><p class="muted">This key can use only aliases allowed in Raw Model API settings.</p></div><div class="field"><label>Requests per minute</label><input class="input" id="akRate" type="number" min="1" max="10000" value="60"></div><p class="muted">Scope: inference only.</p><div class="row"><button class="btn primary" id="akCreate">Create key</button><button class="btn" id="akCancel">Cancel</button></div>');
 akMode.onchange=()=>{akAssistantWrap.hidden=akMode.value==='raw_model';akModelsWrap.hidden=akMode.value!=='raw_model'};
 akCancel.onclick=closeModal;
 akCreate.onclick=async()=>{try{const mode=akMode.value;const body={name:akName.value,mode,assistantId:mode==='assistant'?(akAssistant.value||null):null,modelAllowlist:mode==='raw_model'?akModels.value.split(',').map(x=>x.trim()).filter(Boolean):[],scopes:['inference'],rateLimitPerMinute:Number(akRate.value||60)};const d=await api('/api/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});closeModal();prompt('Copy this API key now. It will not be shown again:',d.key);await loadApiKeys()}catch(e){toastMsg(e.message)}};
}
async function revokeApiKey(id){
 if(!confirm('Revoke this API key? Existing integrations using it will stop working.'))return;
 try{await api('/api/keys/'+encodeURIComponent(id),{method:'DELETE'});await loadApiKeys();toastMsg('API key revoked')}catch(e){toastMsg(e.message)}
}
async function loadNotificationPreferences(){
 try{
  const d=await api('/api/notifications/preferences'),p=d.preferences||{};
  notificationPrefsBox.innerHTML='<label class="row"><input type="checkbox" data-notify-kind="handoff" '+(p.handoff!==false?'checked':'')+'> Human handoff alerts</label><label class="row"><input type="checkbox" data-notify-kind="human_approval" '+(p.human_approval!==false?'checked':'')+'> Human approval requests</label><label class="row"><input type="checkbox" data-notify-kind="reminder_failure" '+(p.reminder_failure!==false?'checked':'')+'> Reminder failure alerts</label><label class="row"><input type="checkbox" data-notify-kind="channel_health" '+(p.channel_health!==false?'checked':'')+'> Channel health alerts</label>';
  notificationPrefsBox.querySelectorAll('[data-notify-kind]').forEach(x=>x.onchange=async()=>{try{await api('/api/notifications/preferences',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({[x.dataset.notifyKind]:x.checked})});toastMsg('Alert preference saved')}catch(e){toastMsg(e.message)}});
 }catch(e){notificationPrefsBox.textContent=e.message}
}
async function loadCustomerDomains(){
 try{
  const d=await api('/api/domains');const domains=d.domains||[];
  const activeCustom=domains.find(x=>x.kind==='custom'&&x.status==='active');
  const setup=document.getElementById('domainSetupBox');if(setup)setup.style.display=activeCustom?'none':'grid';
  if(activeCustom){
    customerDomainsBox.innerHTML='<div class="assistant-item"><div class="spread"><div><strong>'+esc(activeCustom.hostname)+'</strong><div class="muted">Custom domain · primary portal</div></div><span class="pill ok">Verified & active</span></div><p class="muted" style="margin-bottom:0">Your branded domain is connected and working. Provider diagnostics may finish later without changing this verified state.</p></div>';
  }else{
    const custom=domains.filter(x=>x.kind==='custom');
    customerDomainsBox.innerHTML=custom.length?custom.map(x=>'<div class="assistant-item"><div class="spread"><div><strong>'+esc(x.hostname)+'</strong><div class="muted">Waiting for DNS / HTTPS verification</div></div><span><span class="pill warn">Pending</span> <button class="btn" data-verify-domain="'+esc(x.hostname)+'">Verify now</button></span></div><p class="muted">Set CNAME <strong>'+esc(x.hostname)+'</strong> → <strong>'+esc(d.cnameTarget)+'</strong>, then verify.</p></div>').join(''):'<div class="muted">Add a custom domain above. Your hosted Assist address remains available as a fallback.</div>';
  }
  customerDomainsBox.querySelectorAll('[data-verify-domain]').forEach(b=>b.onclick=()=>verifyCustomerDomain(b.dataset.verifyDomain));
 }catch(e){customerDomainsBox.textContent=e.message}
}
async function addCustomerDomain(){
 try{
  const input=document.getElementById('customerNewDomain');
  const hostname=(input?.value||'').trim();
  if(!hostname)throw new Error('Enter a custom domain first');
  const x=await api('/api/domains',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hostname})});
  toastMsg('Domain added. Set CNAME to '+(x.cnameTarget||'mkety-assist.mkety.app'));
  if(input)input.value='';
  await loadCustomerDomains();
 }catch(e){toastMsg(e.message)}
}
async function verifyCustomerDomain(hostname){try{await api('/api/domains/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hostname})});toastMsg('Domain verification refreshed');await loadCustomerDomains()}catch(e){toastMsg(e.message)}}
async function saveBranding(){try{await api('/api/settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({brandColor:brandColor.value||null,logoUrl:logoUrl.value||null})});toastMsg('Branding saved');setTimeout(()=>location.reload(),500)}catch(e){toastMsg(e.message)}}
function paymentCurrencyOptions(){
 return '<option>USD</option><option>NGN</option><option>GHS</option><option>KES</option><option>GBP</option><option>EUR</option><option>ZAR</option><option>XAF</option><option>XOF</option><option>UGX</option><option>RWF</option><option>TZS</option><option>MWK</option><option>EGP</option>';
}
function launchFlutterwave(data){
 if(data.provider==='nowpayments'&&data.widgetUrl){
  const widgetUrl=String(data.widgetUrl),hostedUrl=String(data.hostedUrl||'');
  openModal('<div class="spread"><h2>Pay with crypto</h2><button class="btn" id="cryptoClose">Close</button></div><p class="muted">Secure NOWPayments checkout. Credits are added automatically only after NOWPayments confirms the payment.</p><iframe src="'+esc(widgetUrl)+'" title="NOWPayments secure cryptocurrency checkout" style="width:100%;height:640px;border:0;border-radius:12px;background:white" allow="clipboard-write; payment" referrerpolicy="strict-origin-when-cross-origin"></iframe>'+(hostedUrl?'<p class="muted">If the secure checkout does not load, <a href="'+esc(hostedUrl)+'" target="_blank" rel="noopener noreferrer">open it in a new tab</a>.</p>':''));
  cryptoClose.onclick=()=>{closeModal();loadCheckouts().catch(()=>{})};
  return;
 }
 if(data.checkoutExperience==='inline'&&data.inline){
  if(typeof window.FlutterwaveCheckout!=='function')throw new Error('Flutterwave checkout is still loading. Please try again.');
  const p=data.inline;
  window.FlutterwaveCheckout({
    public_key:p.publicKey,
    tx_ref:p.reference,
    amount:p.amount,
    currency:p.currency,
    redirect_url:'https://mkety-assist.mkety.app'+p.redirectPath,
    payload_hash:p.payloadHash,
    ...(p.paymentOptions?{payment_options:p.paymentOptions}:{}),
    ...(p.bankTransferOptions?{bank_transfer_options:p.bankTransferOptions}:{}),
    customer:{email:p.email,...(p.customerName?{name:p.customerName}:{})},
    meta:p.metadata||{},
    customizations:{title:'Mkety Assist',description:'Secure Mkety Assist payment'},
    onclose:()=>{toastMsg('Checkout closed. No credits are added until Mkety verifies payment.');loadCheckouts().catch(()=>{})},
  });
  return;
 }
 if(data.checkoutUrl){location.assign(data.checkoutUrl);return}
 throw new Error('Payment checkout unavailable');
}
async function paymentMethodOptions(){
 const d=await api('/api/billing/methods');
 const methods=d.methods||[];
 if(!methods.length)throw new Error('No payment method is currently available.');
 const labels={nowpayments:'Crypto · NOWPayments',flutterwave:'Flutterwave',kora:'Kora'};
 return {html:methods.map((m,i)=>'<option value="'+esc(m)+'" '+(m===d.defaultMethod||(!d.defaultMethod&&i===0)?'selected':'')+'>'+esc(labels[m]||m)+'</option>').join(''),defaultMethod:d.defaultMethod||methods[0]};
}
async function payPlan(){
 try{
  const [methods,offer]=await Promise.all([paymentMethodOptions(),api('/api/billing/credit-offer')]);
  const fullRecurring=(Number(offer.recurringAmountMinor||0)/100).toFixed(2);
  const minRecurring=(Number(offer.minimumFundingMinor||offer.recurringAmountMinor||0)/100).toFixed(2);
  const partial=offer.fundingMode==='prepaid_partial';
  openModal('<h2>Fund monthly MKredit</h2>'+
    (partial?'<div class="field"><label>Amount to fund (USD)</label><input class="input" id="planFundingAmount" inputmode="decimal" value="'+esc(fullRecurring)+'"><div class="muted">You can fund from $'+esc(minRecurring)+' up to $'+esc(fullRecurring)+'. Full funding is selected by default.</div></div>':'')+
    '<div class="card" id="planFundingQuote"><span class="muted">Calculating…</span></div>'+
    '<div class="field"><label>Payment method</label><select class="input" id="planMethod">'+methods.html+'</select></div>'+
    '<div class="field" id="planCurrencyWrap"><label>Payment currency</label><select class="input" id="planCurrency">'+paymentCurrencyOptions()+'</select></div>'+
    '<p id="planPayMsg" class="muted">Credits are added only after Mkety verifies the payment.</p><div class="row"><button class="btn primary" id="planPayStart">Fund credits</button><button class="btn" id="planPayCancel">Cancel</button></div>');
  planPayCancel.onclick=closeModal;
  const toggleCurrency=()=>{planCurrencyWrap.style.display=planMethod.value==='flutterwave'?'grid':'none'};planMethod.onchange=toggleCurrency;toggleCurrency();
  let quoteTimer=null;
  const refreshFundingQuote=async()=>{try{
    const q=await api('/api/billing/funding-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fundingAmountUsd:partial?planFundingAmount.value:undefined})});
    planFundingQuote.innerHTML='<div class="muted">You fund</div><div class="metric">$'+(Number(q.totalAmountMinor||0)/100).toFixed(2)+'</div><div style="font-size:20px;font-weight:800;margin-top:8px">→ '+esc(q.credits)+' Mkety credits</div>';
    return q;
  }catch(e){planFundingQuote.innerHTML='<span class="muted">'+esc(e.message)+'</span>';return null}};
  if(partial){planFundingAmount.oninput=()=>{if(quoteTimer)clearTimeout(quoteTimer);quoteTimer=setTimeout(refreshFundingQuote,250)}};await refreshFundingQuote();
  planPayStart.onclick=async()=>{try{
    planPayStart.disabled=true;planPayMsg.textContent='Preparing secure checkout…';
    const d=await api('/api/billing/plan/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      fundingAmountUsd:partial?planFundingAmount.value:undefined,
      paymentMethod:planMethod.value,
      ...(planMethod.value==='flutterwave'?{paymentCurrency:planCurrency.value}:{})
    })});
    planPayMsg.textContent='Opening secure checkout…';launchFlutterwave(d)
  }catch(e){planPayStart.disabled=false;planPayMsg.textContent=e.message}};
 }catch(e){toastMsg(e.message)}
}
async function buyCredits(){
 try{
  const [methods,offer]=await Promise.all([paymentMethodOptions(),api('/api/billing/credit-offer').catch(()=>({recurringAmountMinor:0}))]);
  const suggested=Number(offer.recurringAmountMinor||0)>0?(Number(offer.recurringAmountMinor)/100).toFixed(2):'';
  openModal('<h2>Add MKredit</h2><p class="muted">Type how much you want to add. The normal full monthly funding amount is suggested when available, but you can change it.</p><div class="field"><label>Amount (USD)</label><input class="input" id="topupAmount" inputmode="decimal" placeholder="Enter amount" value="'+esc(suggested)+'"></div><div class="card" id="creditQuote"><span class="muted">Enter an amount to see your credits.</span></div><div class="field"><label>Payment method</label><select class="input" id="topupMethod">'+methods.html+'</select></div><div class="field" id="topupCurrencyWrap"><label>Payment currency</label><select class="input" id="topupCurrency">'+paymentCurrencyOptions()+'</select></div><p id="topupMsg" class="muted">Credits are added only after Mkety verifies the payment.</p><div class="row"><button class="btn primary" id="topupStart">Add MKredit</button><button class="btn" id="topupCancel">Cancel</button></div>');
  topupCancel.onclick=closeModal;
  const toggleCurrency=()=>{topupCurrencyWrap.style.display=topupMethod.value==='flutterwave'?'grid':'none'};topupMethod.onchange=toggleCurrency;toggleCurrency();
  let quoteTimer=null;
  const refreshQuote=async()=>{if(!String(topupAmount.value||'').trim()){creditQuote.innerHTML='<span class="muted">Enter an amount to see your credits.</span>';return null}try{const q=await api('/api/billing/credit-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amountUsd:topupAmount.value})});creditQuote.innerHTML='<div class="muted">You add</div><div style="font-size:20px;font-weight:800">$'+(Number(q.amountMinor||0)/100).toFixed(2)+' → '+esc(q.credits)+' Mkety credits</div>';return q}catch(e){creditQuote.innerHTML='<span class="muted">'+esc(e.message)+'</span>';return null}};
  topupAmount.oninput=()=>{if(quoteTimer)clearTimeout(quoteTimer);quoteTimer=setTimeout(refreshQuote,250)};await refreshQuote();
  topupStart.onclick=async()=>{try{
    if(!String(topupAmount.value||'').trim())throw new Error('Enter an amount first');
    topupStart.disabled=true;topupMsg.textContent='Preparing secure checkout…';
    const d=await api('/api/billing/topup/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      amountUsd:topupAmount.value,
      paymentMethod:topupMethod.value,
      ...(topupMethod.value==='flutterwave'?{paymentCurrency:topupCurrency.value}:{})
    })});
    topupMsg.textContent='Opening secure checkout…';launchFlutterwave(d)
  }catch(e){topupStart.disabled=false;topupMsg.textContent=e.message}};
 }catch(e){toastMsg(e.message)}
}
async function loadCheckouts(){try{
 const d=await api('/api/billing/checkouts');const list=d.checkouts||[];
 checkoutBox.innerHTML=list.length?'<table class="table"><thead><tr><th>Funding</th><th>Credits</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>'+list.slice(0,10).map(x=>'<tr><td>'+esc(x.purchase_type==='plan'?'Monthly credits':'Added credits')+'</td><td>'+esc(x.credits)+'</td><td>'+esc(x.provider_currency||x.canonical_currency||'USD')+' '+esc(((Number(x.provider_amount_minor||x.canonical_amount_minor||0))/100).toFixed(2))+'</td><td><span class="pill '+(x.status==='paid'?'ok':x.status==='pending'?'warn':'')+'">'+esc(x.status)+'</span></td><td>'+new Date(x.created_at*1000).toLocaleString()+'</td></tr>').join('')+'</tbody></table>':'No payments yet.';
}catch(e){checkoutBox.textContent=e.message}}
async function changePassword(){
 openModal('<h2>Change password</h2><div class="field"><label>Current password</label><input class="input" id="currentPassword" type="password" autocomplete="current-password"></div><div class="field"><label>New password</label><input class="input" id="newPassword" type="password" minlength="12" autocomplete="new-password"></div><p id="passwordMsg" class="muted"></p><div class="row"><button class="btn primary" id="passwordSave">Update password</button><button class="btn" id="passwordCancel">Cancel</button></div>');
 passwordCancel.onclick=closeModal;
 passwordSave.onclick=async()=>{try{passwordSave.disabled=true;await api('/api/auth/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({currentPassword:currentPassword.value,newPassword:newPassword.value})});toastMsg('Password updated');closeModal()}catch(e){passwordSave.disabled=false;passwordMsg.textContent=e.message}};
}
async function manageSessions(){
 try{
  const d=await api('/api/auth/sessions');
  const rows=(d.sessions||[]).map(s=>'<tr><td>'+new Date(s.created_at*1000).toLocaleString()+'</td><td>'+new Date(s.last_seen_at*1000).toLocaleString()+'</td><td>'+(s.revoked_at?'Revoked':'Active')+'</td><td>'+(!s.revoked_at?'<button class="btn danger" data-revoke-session="'+esc(s.id)+'">Revoke</button>':'')+'</td></tr>').join('');
  openModal('<h2>Signed-in sessions</h2><div class="card">'+(rows?'<table class="table"><thead><tr><th>Created</th><th>Last seen</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':'<div class="empty">No sessions.</div>')+'</div><div class="row" style="margin-top:12px"><button class="btn" id="sessionsClose">Close</button></div>');
  sessionsClose.onclick=closeModal;
  dialog.querySelectorAll('[data-revoke-session]').forEach(b=>b.onclick=async()=>{try{await api('/api/auth/sessions/'+encodeURIComponent(b.dataset.revokeSession),{method:'DELETE'});toastMsg('Session revoked');await manageSessions()}catch(e){toastMsg(e.message)}});
 }catch(e){toastMsg(e.message)}
}
async function linkTelegram(){try{const d=await api('/api/auth/telegram/link/start',{method:'POST'});location.href=d.url}catch(e){toastMsg(e.message)}}
refresh().catch(e=>{content.innerHTML='<div class="card"><h2>Could not load console</h2><p class="muted">'+esc(e.message)+'</p></div>'});
</script>
</body></html>`;
}

export function renderOperatorPortal(customers: any[]) {
  const rows = JSON.stringify(customers).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mkety Assist Operator</title>
<style>
:root{color-scheme:dark;--bg:#090a0f;--p:#12141c;--l:#292d3c;--m:#969bad;--b:#7c5cff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#f7f7fb;font:14px/1.45 system-ui}
.wrap{max-width:1320px;margin:auto;padding:28px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:20px}
.card{background:var(--p);border:1px solid var(--l);border-radius:14px;padding:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.metric{font-size:24px;font-weight:800}.muted{color:var(--m)}
.btn,.input{border:1px solid var(--l);background:#191c27;color:#fff;border-radius:9px;padding:9px 11px}.btn{cursor:pointer}.primary{background:var(--b);border-color:transparent}.danger{color:#ff9aab}
.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;padding:10px;border-bottom:1px solid var(--l);vertical-align:top}.table th{font-size:11px;color:var(--m);text-transform:uppercase}#attemptsBox{max-width:100%;overflow-x:auto}
.field{display:grid;gap:5px;margin:10px 0}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.modal{position:fixed;inset:0;background:#0009;display:none;place-items:center;z-index:20}
.modal.open{display:grid}.dialog{width:min(760px,94vw);max-height:90vh;overflow:auto;background:var(--p);border:1px solid var(--l);border-radius:14px;padding:20px}
.pill{display:inline-flex;border:1px solid var(--l);border-radius:99px;padding:3px 8px;font-size:11px}.ok{color:#64d5a4}.warn{color:#ffc66f}
@media(max-width:820px){.grid,.two{grid-template-columns:1fr}.wrap{padding:18px}}
</style>
</head>
<body>
<main class="wrap">
  <div class="top"><div><h1 style="margin:0">Mkety Assist Operator</h1><p class="muted">Internal customer, commercial, domain, model and operations control.</p></div><div class="row"><button class="btn primary" id="newCustomer">New customer</button><button class="btn" id="opsLogout">Sign out</button></div></div>
  <div class="grid" id="metrics"></div>

  <div class="card" style="margin-top:16px">
    <div class="top" style="margin:0 0 10px"><h2 style="margin:0">Customers</h2><button class="btn" id="refreshCustomers">Refresh</button></div>
    <table class="table"><thead><tr><th>Customer</th><th>Portal</th><th>Credits</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="top" style="margin:0 0 10px"><h2 style="margin:0">Models & Rates</h2><button class="btn" id="refreshModels">Refresh</button></div><div id="modelsBox" class="muted">Authenticate to load models.</div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="top" style="margin:0 0 10px"><h2 style="margin:0">Providers</h2><div><button class="btn" id="refreshProviders">Refresh</button> <button class="btn primary" id="newProvider">Add</button></div></div><div id="providersBox" class="muted">Authenticate to load providers.</div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="top" style="margin:0 0 10px"><h2 style="margin:0">Uncertain inference attempts</h2><div><select class="input" id="attemptCustomer" aria-label="Customer for inference attempts"></select> <button class="btn" id="refreshAttempts">Refresh</button></div></div>
    <p class="muted">Only safe provider, model, usage, and status fields are shown. Repairs never run a new inference request.</p><div id="attemptsBox" class="muted">Authenticate to load attempts.</div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="top" style="margin:0 0 10px"><h2 style="margin:0">Operations</h2><button class="btn" id="refreshOps">Refresh</button></div>
    <div id="healthBox" class="muted">Authenticate to load health.</div><h3>Recent audit</h3><div id="auditBox" class="muted">—</div>
  </div>
</main>
<div class="modal" id="modal"><div class="dialog" id="dialog"></div></div>
<script>
const moveRouteTarget = ${moveRouteTarget.toString()};
let data=${rows};
let providerData=[];
const byId=id=>document.getElementById(id);
const modal=byId('modal'),dialog=byId('dialog'),metrics=byId('metrics'),rows=byId('rows'),
  providersBox=byId('providersBox'),modelsBox=byId('modelsBox'),healthBox=byId('healthBox'),auditBox=byId('auditBox'),
  attemptsBox=byId('attemptsBox'),attemptCustomer=byId('attemptCustomer'),refreshAttempts=byId('refreshAttempts'),
  newCustomer=byId('newCustomer'),opsLogout=byId('opsLogout'),refreshCustomers=byId('refreshCustomers'),
  refreshModels=byId('refreshModels'),refreshProviders=byId('refreshProviders'),newProvider=byId('newProvider'),refreshOps=byId('refreshOps');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
async function api(path,opt={}){opt.headers={'content-type':'application/json',...(opt.headers||{})};const r=await fetch(path,opt);let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j}
function toastOps(message){alert(message)}
function openModal(h){dialog.innerHTML=h;modal.classList.add('open')}
function closeModal(){modal.classList.remove('open');dialog.innerHTML=''}
modal.onclick=e=>{if(e.target===modal)closeModal()}
function renderCustomers(){
  metrics.innerHTML=[
    ['Customers',data.length],['Active',data.filter(x=>x.status==='active').length],
    ['Total credits',data.reduce((n,x)=>n+Number(x.balance||0),0)],['Product','Lite / Telegram-first']
  ].map(([a,b])=>'<div class="card"><div class="muted">'+esc(a)+'</div><div class="metric">'+esc(b)+'</div></div>').join('');
  rows.innerHTML=data.length?data.map(c=>'<tr><td><strong>'+esc(c.name)+'</strong><div class="muted">'+esc(c.slug)+'</div></td><td>'+esc(c.primary_hostname||'')+'</td><td>'+esc(c.balance??0)+'</td><td>'+esc(c.status)+'</td><td><button class="btn" data-customer="'+c.id+'">Manage</button></td></tr>').join(''):'<tr><td colspan="5" class="muted">No customers.</td></tr>';
  document.querySelectorAll('[data-customer]').forEach(b=>b.onclick=()=>manageCustomer(b.dataset.customer));
}
async function loadCustomers(){const x=await api('/api/ops/customers');data=x.customers||[];renderCustomers();await loadAttempts()}
async function loadProviders(){
  try{
    const x=await api('/api/ops/providers');providerData=x.providers||[];
    const builtIns='<div class="two" style="margin-bottom:12px"><div class="card"><strong>Mkety Hosted / Workers AI</strong><div class="muted">Built-in · uses the Assist Worker AI binding · no provider key required</div></div><div class="card"><strong>Mkety Managed</strong><div class="muted">Built-in managed route · no customer-visible provider credentials</div></div></div>';
    providersBox.innerHTML=builtIns+(providerData.length?'<table class="table"><thead><tr><th>Name</th><th>Provider / model</th><th>Owner</th><th>Validation</th><th></th></tr></thead><tbody>'+providerData.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.provider)+'<div class="muted">'+esc(p.default_model||'model not set')+' · '+esc(p.endpoint_url||'default')+'</div></td><td>'+esc(p.ownership||'mkety')+(p.customer_id?'<div class="muted">'+esc((data.find(c=>c.id===p.customer_id)||{}).name||p.customer_id)+'</div>':'')+'</td><td><span class="pill '+(p.status==='active'&&p.validated_at?'ok':'warn')+'">'+esc(p.status)+'</span><div class="muted">'+(p.validated_at?'tested '+new Date(p.validated_at*1000).toLocaleString():esc(p.validation_error||'test required'))+'</div></td><td><button class="btn" data-provider-test="'+p.id+'">'+(p.status==='active'?'Retest':'Test & enable')+'</button> '+(p.status==='active'?'<button class="btn danger" data-provider-disable="'+p.id+'">Disable</button> ':'')+'<button class="btn" data-provider-edit="'+p.id+'">Manage</button></td></tr>').join('')+'</tbody></table>':'<p class="muted">No external provider credentials configured.</p>');
    document.querySelectorAll('[data-provider-edit]').forEach(b=>b.onclick=()=>editProvider(providerData.find(p=>p.id===b.dataset.providerEdit)));
    document.querySelectorAll('[data-provider-test]').forEach(b=>b.onclick=()=>testProvider(b.dataset.providerTest));
    document.querySelectorAll('[data-provider-disable]').forEach(b=>b.onclick=()=>disableProvider(b.dataset.providerDisable));
  }catch(e){providersBox.textContent=e.message}
}
async function disableProvider(id){
  try{await api('/api/ops/providers/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({enabled:false})});toastOps('Provider disabled');await loadProviders();await loadModels()}
  catch(e){alert(e.message)}
}
async function testProvider(id){
  try{
    const x=await api('/api/ops/providers/'+encodeURIComponent(id)+'/test',{method:'POST'});
    toastOps(x.ok?'Provider real inference passed':(x.billingBlocked?'Credentials accepted; provider billing/credits are blocking inference':'Provider real inference failed'));
    await loadProviders();
  }catch(e){alert(e.message);await loadProviders()}
}
function providerExtraUi(provider,prefix,value){
  let extra={};try{extra=JSON.parse(value||'{}')}catch{}
  if(provider==='vertex')return '<div class="field"><label>Vertex service-account JSON (encrypted)</label><textarea class="input" id="'+prefix+'CredentialJson" rows="7" placeholder="Paste the complete Google service-account JSON here"></textarea></div><div class="field"><label>Vertex location</label><input class="input" id="'+prefix+'Location" value="'+esc(extra.location||'global')+'"></div>';
  if(provider==='bedrock')return '<div class="field"><label>Bedrock credentials JSON (encrypted)</label><textarea class="input" id="'+prefix+'CredentialJson" rows="6" placeholder="{&quot;accessKeyId&quot;:&quot;...&quot;,&quot;secretAccessKey&quot;:&quot;...&quot;,&quot;region&quot;:&quot;us-east-1&quot;}"></textarea></div><div class="field"><label>AWS region</label><input class="input" id="'+prefix+'Region" value="'+esc(extra.region||'us-east-1')+'"></div>';
  if(provider==='cloudflare-ai')return '<div class="field"><label>Cloudflare account ID</label><input class="input" id="'+prefix+'AccountId" value="'+esc(extra.accountId||'')+'"></div>';
  if(provider==='azure-openai')return '<div class="field"><label>API version (optional)</label><input class="input" id="'+prefix+'ApiVersion" value="'+esc(extra.apiVersion||'2024-10-21')+'"></div>';
  return '';
}
function readProviderExtra(provider,prefix){
  if(provider==='vertex'){const el=byId(prefix+'Location');return {location:(el&&el.value.trim())||'global'}}
  if(provider==='bedrock'){const el=byId(prefix+'Region');return {region:(el&&el.value.trim())||'us-east-1'}}
  if(provider==='cloudflare-ai'){const el=byId(prefix+'AccountId');return {accountId:(el&&el.value.trim())||''}}
  if(provider==='azure-openai'){const el=byId(prefix+'ApiVersion');return el&&el.value.trim()?{apiVersion:el.value.trim()}:{}}
  return {};
}
function readStructuredCredential(provider,prefix){
  if(provider!=='vertex'&&provider!=='bedrock')return undefined;
  const el=byId(prefix+'CredentialJson');
  return el&&el.value.trim()?el.value.trim():undefined;
}
function editProvider(p){
  const structured=p.provider==='vertex'||p.provider==='bedrock';
  openModal('<h2>Manage provider</h2><p class="muted">Saved secrets are never shown. Save disables the connection until a real provider inference test passes again.</p><div class="two"><div class="field"><label>Name</label><input class="input" id="epName" value="'+esc(p.name)+'"></div><div class="field"><label>Provider</label><input class="input" value="'+esc(p.provider)+'" disabled></div></div><div class="field"><label>Ownership</label><input class="input" value="'+esc(p.ownership||'mkety')+(p.customer_id?' · '+esc((data.find(c=>c.id===p.customer_id)||{}).name||p.customer_id):'')+'" disabled></div><div class="field"><label>Endpoint URL</label><input class="input" id="epEndpoint" value="'+esc(p.endpoint_url||'')+'" placeholder="'+(p.provider==='azure-foundry'?'https://resource.services.ai.azure.com/api/projects/project':'https://...')+'"></div><div class="field"><label>Model / deployment</label><input class="input" id="epModel" value="'+esc(p.default_model||'')+'" placeholder="'+(p.provider==='azure-foundry'?'gpt-5.6-sol-1':'model id')+'"></div>'+(structured?'':'<div class="field"><label>Replace API key / secret</label><input class="input" id="epKey" type="password" autocomplete="off" placeholder="Leave blank to keep current secret"></div>')+'<div id="epProviderExtra">'+providerExtraUi(p.provider,'ep',p.extra_json||'{}')+'</div><div class="row"><button class="btn primary" id="epSave">Save & require retest</button><button class="btn" id="epTest">Run real test now</button><button class="btn" id="epClose">Close</button></div>');
  const epName=byId('epName'),epEndpoint=byId('epEndpoint'),epModel=byId('epModel'),epKey=byId('epKey'),epSave=byId('epSave'),epTest=byId('epTest'),epClose=byId('epClose');
  epClose.onclick=closeModal;
  epSave.onclick=async()=>{try{
    const extra=readProviderExtra(p.provider,'ep'),credentialJson=readStructuredCredential(p.provider,'ep');
    await api('/api/ops/providers/'+encodeURIComponent(p.id),{method:'PATCH',body:JSON.stringify({name:epName.value,endpointUrl:epEndpoint.value||null,model:epModel?epModel.value:null,apiKey:epKey?epKey.value||undefined:undefined,credentialJson,extra})});
    closeModal();await loadProviders();alert('Saved. Run the real provider test before using it in a route.');
  }catch(e){alert(e.message)}};
  epTest.onclick=async()=>{closeModal();await testProvider(p.id)};
}
function providerOptions(selected,provider,customerId){
  const available=providerData.filter(p=>(!provider||p.provider===provider)&&p.status==='active'&&p.validated_at&&((p.ownership||'mkety')==='mkety'||(customerId&&p.customer_id===customerId)));
  return '<option value="">Built-in / no connection</option>'+available.map(p=>'<option value="'+p.id+'" '+(p.id===selected?'selected':'')+'>'+esc(p.name)+(p.default_model?' · '+esc(p.default_model):'')+(p.ownership==='customer'?' · customer BYOK':'')+'</option>').join('');
}
function addProvider(){
  const customers='<option value="">Select customer</option>'+data.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
  openModal('<h2>Add provider connection</h2><p class="muted">Azure Foundry uses Model + Endpoint + API Key. Vertex and Bedrock accept their complete credential JSON, which is encrypted before storage. Save immediately runs a real provider inference test.</p><div class="two"><div class="field"><label>Name</label><input class="input" id="prName" placeholder="Managed provider"></div><div class="field"><label>Provider</label><select class="input" id="prType"><option>openai</option><option>anthropic</option><option>gemini</option><option>vertex</option><option>cloudflare-ai</option><option>bedrock</option><option>azure-openai</option><option>azure-foundry</option><option>openai-compatible</option></select></div><div class="field"><label>Ownership</label><select class="input" id="prOwnership"><option value="mkety">Mkety managed</option><option value="customer">Customer BYOK</option></select></div><div class="field"><label>Customer (BYOK only)</label><select class="input" id="prCustomer" disabled>'+customers+'</select></div></div><div class="field"><label>Endpoint URL</label><input class="input" id="prEndpoint" placeholder="https://..."></div><div class="field"><label>Model / deployment</label><input class="input" id="prModel" placeholder="gpt-5.6-sol-1"></div><div class="field" id="prKeyWrap"><label>API key / secret</label><input class="input" id="prKey" type="password" autocomplete="off"></div><div id="prProviderExtra"></div><button class="btn primary" id="prSave">Save & run real test</button>');
  const prName=byId('prName'),prType=byId('prType'),prOwnership=byId('prOwnership'),prCustomer=byId('prCustomer'),prEndpoint=byId('prEndpoint'),prModel=byId('prModel'),prKey=byId('prKey'),prKeyWrap=byId('prKeyWrap'),prProviderExtra=byId('prProviderExtra'),prSave=byId('prSave');
  const refresh=()=>{
    prCustomer.disabled=prOwnership.value!=='customer';
    if(prKeyWrap)prKeyWrap.hidden=prType.value==='vertex'||prType.value==='bedrock';
    if(prProviderExtra)prProviderExtra.innerHTML=providerExtraUi(prType.value,'pr','{}');
    if(prType.value==='azure-foundry'){prEndpoint.placeholder='https://resource.services.ai.azure.com/api/projects/project';if(prModel)prModel.placeholder='gpt-5.6-sol-1'}
    else{prEndpoint.placeholder='https://...';if(prModel)prModel.placeholder='model id'}
  };
  prOwnership.onchange=refresh;prType.onchange=refresh;refresh();
  prSave.onclick=async()=>{try{
    const extra=readProviderExtra(prType.value,'pr'),credentialJson=readStructuredCredential(prType.value,'pr');
    const made=await api('/api/ops/providers',{method:'POST',body:JSON.stringify({name:prName.value,provider:prType.value,endpointUrl:prEndpoint.value||null,model:prModel?prModel.value:null,apiKey:prKeyWrap&&prKeyWrap.hidden?undefined:prKey.value,credentialJson,extra,ownership:prOwnership.value,customerId:prOwnership.value==='customer'?prCustomer.value:null})});
    closeModal();await testProvider(made.id);await loadModels();
  }catch(e){alert(e.message)}};
}
async function loadModels(){
  try{
    const x=await api('/api/ops/models');const models=x.models||[];
    modelsBox.innerHTML='<p class="muted">To reorder provider priority, select Edit for a model alias. Use Move up or Move down, review the proposed order, then publish it.</p>'+(models.length?'<table class="table"><thead><tr><th>Alias / readiness</th><th>Route</th><th>Token customer rate (MKredit / 1M)</th><th>Media customer rate</th><th>Provider cost (internal µUSD)</th><th>Route control</th></tr></thead><tbody>'+models.map(m=>{const r=m.route_readiness||{},paused=m.status!=='active',targets=Array.isArray(m.targets)?m.targets:[],effective=!paused&&targets.find(t=>Number(t.enabled??1)===1&&t.validated===true&&t.priced===true&&t.supported!==false),primary=effective||targets.find(t=>Number(t.enabled??1)===1)||targets[0]||m;return '<tr><td><strong>'+esc(m.alias)+'</strong><div class="muted">'+esc(r.state||'unknown')+' · '+esc(r.eligibleTargetCount??0)+' eligible of '+esc(r.targetCount??0)+' · reasoning: '+esc((r.reasoningCapabilities||['standard']).join(', '))+'</div></td><td>'+(!effective?'<div class="muted">No effective target · showing first configured</div>':'<div class="muted">Effective target</div>')+esc(primary.provider||m.provider)+'<div class="muted">'+esc(primary.provider_model||m.provider_model)+'</div></td><td>'+esc(primary.input_credits_per_million??m.input_credits_per_million??0)+' input / '+esc(primary.output_credits_per_million??m.output_credits_per_million??0)+' output</td><td>Voice: '+esc(primary.audio_credits_per_minute??m.audio_credits_per_minute??0)+' MKredit / minute<br>Image: '+esc(primary.image_credits??m.image_credits??0)+(Number(primary.image_credits??m.image_credits??0)>0?' MKredit / image':m.alias==='mkety-media-vision'?' MKredit / image · image tokens billed at input rate':' MKredit / image')+'</td><td>'+esc(primary.provider_input_cost_micros_per_million??m.provider_input_cost_micros_per_million??0)+' / '+esc(primary.provider_output_cost_micros_per_million??m.provider_output_cost_micros_per_million??0)+' per 1M<br>Voice: '+esc(primary.provider_audio_cost_micros_per_minute??m.provider_audio_cost_micros_per_minute??0)+' µUSD / minute · Image: '+esc(primary.provider_image_cost_micros??m.provider_image_cost_micros??0)+' µUSD / image</td><td><button class="btn" data-route-status="'+encodeURIComponent(m.alias)+'" data-next-status="'+(paused?'active':'paused')+'">'+(paused?'Resume alias':'Pause alias')+'</button> <button class="btn" data-model="'+encodeURIComponent(m.alias)+'">Edit</button></td></tr>'}).join('')+'</tbody></table>':'No model routes.');
    document.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>editModel(decodeURIComponent(b.dataset.model),models.find(m=>m.alias===decodeURIComponent(b.dataset.model))));
    document.querySelectorAll('[data-route-status]').forEach(b=>b.onclick=async()=>{try{await api('/api/ops/models/'+decodeURIComponent(b.dataset.routeStatus),{method:'PATCH',body:JSON.stringify({status:b.dataset.nextStatus})});await loadModels()}catch(e){alert(e.message)}});
    const media=x.media_readiness||{};const labels={"mkety-media-vision":"Image","mkety-media-speech":"Voice"};
    const mediaHtml=Object.entries(labels).map(([alias,label])=>{const r=media[alias]||{};const disabled=(r.customers||[]).filter(c=>c.state==='feature_disabled').length;const unavailable=(r.customers||[]).filter(c=>c.state==='route_unavailable').length;return '<div class="card" style="margin:8px 0"><strong>'+label+' route</strong><div class="muted">'+esc(r.state||'unavailable')+' · '+esc(r.eligibleTargetCount??0)+' validated, priced target(s) · '+esc(disabled)+' tenant(s) have this feature disabled · '+esc(unavailable)+' enabled tenant(s) have no usable route</div></div>'}).join('');
    modelsBox.insertAdjacentHTML('beforeend','<h3>Media readiness</h3>'+mediaHtml);
  }catch(e){modelsBox.textContent=e.message}
}
function editModel(alias,m){
  const providers=['workers-ai','mkety-managed','openai','anthropic','gemini','vertex','cloudflare-ai','bedrock','azure-openai','azure-foundry','openai-compatible'];
  const customers='<option value="">Select customer</option>'+data.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
  let targets=(Array.isArray(m.targets)&&m.targets.length?m.targets:[
    {provider:m.provider,provider_model:m.provider_model,provider_connection_id:m.provider_connection_id,enabled:1},
    ...(m.fallback_provider&&m.fallback_model?[{provider:m.fallback_provider,provider_model:m.fallback_model,provider_connection_id:m.fallback_provider_connection_id,enabled:1}]:[])
  ]).map(t=>({...t}));
  const originalTargets=targets.map(t=>({...t}));
  const targetRow=(t,i)=>{let caps=[];try{caps=t.reasoning_capabilities_json?JSON.parse(t.reasoning_capabilities_json):(t.reasoning_capabilities||[])}catch{}return '<div class="card" data-target-row="'+i+'" style="margin:10px 0"><div class="spread"><strong>'+(i===0?'Primary':'Fallback '+i)+'</strong><div class="row"><button class="btn" type="button" data-target-make-primary="'+i+'" '+(i===0?'disabled':'')+'>Make primary</button><button class="btn" type="button" data-target-move-up="'+i+'" '+(i===0?'disabled':'')+'>Move up</button><button class="btn" type="button" data-target-move-down="'+i+'" '+(i===targets.length-1?'disabled':'')+'>Move down</button></div></div><label><input type="checkbox" data-target-enabled="'+i+'" '+(Number(t.enabled??1)?'checked':'')+'> enabled</label><div class="three"><div class="field"><label>Provider</label><select class="input" data-target-provider="'+i+'">'+providers.map(p=>'<option '+(p===t.provider?'selected':'')+'>'+p+'</option>').join('')+'</select></div><div class="field"><label>Connection</label><select class="input" data-target-connection="'+i+'">'+providerOptions(t.provider_connection_id,t.provider,null)+'</select></div><div class="field"><label>Actual model</label><input class="input" data-target-model="'+i+'" value="'+esc(t.provider_model||'')+'"></div></div><div class="two"><div class="field"><label>Calculated base rates (MKredit)</label><div class="row"><label>Input / 1M tokens<input class="input" type="number" min="0" data-target-input="'+i+'" readonly value="'+esc(t.input_credits_per_million??m.input_credits_per_million??0)+'"></label><label>Output / 1M tokens<input class="input" type="number" min="0" data-target-output="'+i+'" readonly value="'+esc(t.output_credits_per_million??m.output_credits_per_million??0)+'"></label></div><div class="row"><label>Image / image<input class="input" type="number" min="0" data-target-image="'+i+'" readonly value="'+esc(t.image_credits??m.image_credits??0)+'"></label><label>Voice / minute<input class="input" type="number" min="0" data-target-audio="'+i+'" readonly value="'+esc(t.audio_credits_per_minute??m.audio_credits_per_minute??0)+'"></label></div><small class="muted">These base rates are calculated directly from provider cost and cannot be overridden here. Change the customer rate multiplier in the customer policy to adjust token, image, and voice prices together. Image tokens are also billed at the input-token rate.</small></div><div class="field"><label>Provider costs (internal µUSD)</label><div class="row"><label>Input / 1M tokens<input class="input" type="number" min="0" data-target-cost-input="'+i+'" value="'+esc(t.provider_input_cost_micros_per_million??m.provider_input_cost_micros_per_million??0)+'"></label><label>Output / 1M tokens<input class="input" type="number" min="0" data-target-cost-output="'+i+'" value="'+esc(t.provider_output_cost_micros_per_million??m.provider_output_cost_micros_per_million??0)+'"></label></div><div class="row"><label>Image / image<input class="input" type="number" min="0" data-target-cost-image="'+i+'" value="'+esc(t.provider_image_cost_micros??m.provider_image_cost_micros??0)+'"></label><label>Voice / minute<input class="input" type="number" min="0" data-target-cost-audio="'+i+'" value="'+esc(t.provider_audio_cost_micros_per_minute??m.provider_audio_cost_micros_per_minute??0)+'"></label></div></div></div><div class="two"><div class="field"><label>Reasoning support</label><div class="row"><label><input type="checkbox" data-target-reasoning-high="'+i+'" '+(caps.includes('high')?'checked':'')+'> High</label><label><input type="checkbox" data-target-reasoning-maximum="'+i+'" '+(caps.includes('maximum')?'checked':'')+'> Maximum</label></div><small class="muted">Declare only levels this exact provider model accepts.</small></div><div class="field"><label>Separate reasoning rates per 1M (optional)</label><div class="row"><input class="input" type="number" min="0" data-target-reasoning-credits="'+i+'" placeholder="Customer MKredit" value="'+esc(t.reasoning_credits_per_million??'')+'"><input class="input" type="number" min="0" data-target-reasoning-cost="'+i+'" placeholder="Provider µUSD" value="'+esc(t.provider_reasoning_cost_micros_per_million??'')+'"></div><small class="muted">Leave blank when reasoning tokens are included in output usage.</small></div></div>'+(i?'<button class="btn danger" data-target-remove="'+i+'">Remove fallback</button>':'')+'</div>'};
  openModal('<h2>'+esc(alias)+'</h2><p class="muted">Targets are tried in order. Disabled targets are skipped. Base MKredit rates are calculated from each target’s provider cost. The customer percentage multiplier applies consistently to token, image, and voice usage.</p><div class="two"><div class="field"><label>Route scope</label><select class="input" id="mScope"><option value="global">Global managed route</option><option value="customer">Customer override</option></select></div><div class="field"><label>Customer</label><select class="input" id="mCustomer" disabled>'+customers+'</select></div><div class="field"><label>Alias status</label><select class="input" id="mStatus"><option value="active">Active</option><option value="paused">Paused</option><option value="disabled">Disabled</option></select><small class="muted">Pausing an alias blocks all targets. Target pauses below preserve remaining fallbacks.</small></div><div class="field"><label>BYOK fallback policy</label><select class="input" id="mByokPolicy"><option value="managed">Managed</option><option value="strict_byok">Strict BYOK — no Mkety-funded fallback</option><option value="explicit_paid_fallback">Explicit paid fallback allowed</option></select></div></div><h3>Ordered provider chain</h3><div id="mTargets"></div><div class="card" id="mRouteOrderPreview"><strong>Review route order before publish</strong><div class="two"><div><strong>Current</strong><ol id="mRouteCurrent"></ol></div><div><strong>After publish</strong><ol id="mRouteNext"></ol></div></div></div><button class="btn" id="mAddTarget">Add fallback</button><div id="globalRateFields"><h3>Runtime limits</h3><div class="two"><div class="field"><label>Requests / second</label><input class="input" id="mRps" type="number" min="0" value="'+esc(m.requests_per_second??'')+'"></div><div class="field"><label>Requests / minute</label><input class="input" id="mRpm" type="number" min="0" value="'+esc(m.requests_per_minute??'')+'"></div><div class="field"><label>Tokens / minute</label><input class="input" id="mTpm" type="number" min="0" value="'+esc(m.tokens_per_minute??'')+'"></div><div class="field"><label>Retry base / max seconds</label><div class="row"><input class="input" id="mRetryBase" type="number" min="1" value="'+esc(m.retry_base_seconds??2)+'"><input class="input" id="mRetryMax" type="number" min="1" value="'+esc(m.retry_max_seconds??120)+'"></div></div></div></div><div class="row"><button class="btn primary" id="mSave">Publish ordered route</button></div>');
  const mScope=byId('mScope'),mCustomer=byId('mCustomer'),mStatus=byId('mStatus'),mByokPolicy=byId('mByokPolicy'),mTargets=byId('mTargets'),mRouteCurrent=byId('mRouteCurrent'),mRouteNext=byId('mRouteNext'),mAddTarget=byId('mAddTarget'),mSave=byId('mSave'),globalRateFields=byId('globalRateFields'),
    mRps=byId('mRps'),mRpm=byId('mRpm'),mTpm=byId('mTpm'),mRetryBase=byId('mRetryBase'),mRetryMax=byId('mRetryMax');
  mByokPolicy.value=m.byok_policy||'managed';mStatus.value=m.status||'active';
  const renderTargets=()=>{
    mTargets.innerHTML=targets.map(targetRow).join('');
    mTargets.querySelectorAll('[data-target-provider]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.targetProvider);targets[i].provider=el.value;const con=mTargets.querySelector('[data-target-connection="'+i+'"]');con.innerHTML=providerOptions('',el.value,mScope.value==='customer'?mCustomer.value:null);updateRoutePreview()});
    mTargets.querySelectorAll('[data-target-remove]').forEach(el=>el.onclick=()=>{targets.splice(Number(el.dataset.targetRemove),1);renderTargets();updateRoutePreview()});
    mTargets.querySelectorAll('[data-target-make-primary]').forEach(el=>el.onclick=()=>moveTarget(Number(el.dataset.targetMakePrimary),0));
    mTargets.querySelectorAll('[data-target-move-up]').forEach(el=>el.onclick=()=>moveTarget(Number(el.dataset.targetMoveUp),Number(el.dataset.targetMoveUp)-1));
    mTargets.querySelectorAll('[data-target-move-down]').forEach(el=>el.onclick=()=>moveTarget(Number(el.dataset.targetMoveDown),Number(el.dataset.targetMoveDown)+1));
    mTargets.querySelectorAll('[data-target-model]').forEach(el=>el.oninput=()=>{targets[Number(el.dataset.targetModel)].provider_model=el.value;updateRoutePreview()});
  };
  const renderOrder=list=>'<ol>'+list.map(t=>'<li>'+esc(t.provider||'Provider')+' / '+esc(t.provider_model||'(model not set)')+'</li>').join('')+'</ol>';
  const updateRoutePreview=()=>{mRouteCurrent.innerHTML=renderOrder(originalTargets);mRouteNext.innerHTML=renderOrder(targets)};
  const syncTargetInputs=()=>mTargets.querySelectorAll('[data-target-row]').forEach((row,i)=>{
    const t=targets[i];
    t.provider=row.querySelector('[data-target-provider]').value;
    t.provider_connection_id=row.querySelector('[data-target-connection]').value||null;
    t.provider_model=row.querySelector('[data-target-model]').value;
    t.enabled=row.querySelector('[data-target-enabled]').checked?1:0;
    t.input_credits_per_million=Number(row.querySelector('[data-target-input]').value||0);
    t.output_credits_per_million=Number(row.querySelector('[data-target-output]').value||0);
    t.image_credits=Number(row.querySelector('[data-target-image]').value||0);
    t.audio_credits_per_minute=Number(row.querySelector('[data-target-audio]').value||0);
    t.provider_input_cost_micros_per_million=Number(row.querySelector('[data-target-cost-input]').value||0);
    t.provider_output_cost_micros_per_million=Number(row.querySelector('[data-target-cost-output]').value||0);
    t.provider_image_cost_micros=Number(row.querySelector('[data-target-cost-image]').value||0);
    t.provider_audio_cost_micros_per_minute=Number(row.querySelector('[data-target-cost-audio]').value||0);
    t.reasoning_capabilities=['standard',...(row.querySelector('[data-target-reasoning-high]').checked?['high']:[]),...(row.querySelector('[data-target-reasoning-maximum]').checked?['maximum']:[])];
    t.reasoning_credits_per_million=row.querySelector('[data-target-reasoning-credits]').value===''?null:Number(row.querySelector('[data-target-reasoning-credits]').value);
    t.provider_reasoning_cost_micros_per_million=row.querySelector('[data-target-reasoning-cost]').value===''?null:Number(row.querySelector('[data-target-reasoning-cost]').value);
  });
  const moveTarget=(from,to)=>{syncTargetInputs();targets=moveRouteTarget(targets,from,to);renderTargets();updateRoutePreview();mSave.textContent='Publish new route order'};
  mAddTarget.onclick=()=>{targets.push({provider:'azure-foundry',provider_model:'',provider_connection_id:null,enabled:1,input_credits_per_million:0,output_credits_per_million:0,image_credits:0,audio_credits_per_minute:0,provider_input_cost_micros_per_million:0,provider_output_cost_micros_per_million:0,provider_image_cost_micros:0,provider_audio_cost_micros_per_minute:0});renderTargets();updateRoutePreview()};
  mScope.onchange=()=>{const customer=mScope.value==='customer';mCustomer.disabled=!customer;globalRateFields.style.display=customer?'none':'';renderTargets()};
  mCustomer.onchange=renderTargets;renderTargets();updateRoutePreview();
  mSave.onclick=async()=>{try{
    const collected=[...mTargets.querySelectorAll('[data-target-row]')].map((row,i)=>({
      provider:row.querySelector('[data-target-provider]').value,
      providerConnectionId:row.querySelector('[data-target-connection]').value||null,
      providerModel:row.querySelector('[data-target-model]').value,
      enabled:row.querySelector('[data-target-enabled]').checked,
      inputCreditsPerMillion:Number(row.querySelector('[data-target-input]').value||0),
      outputCreditsPerMillion:Number(row.querySelector('[data-target-output]').value||0),
      providerInputCostMicrosPerMillion:Number(row.querySelector('[data-target-cost-input]').value||0),
      providerOutputCostMicrosPerMillion:Number(row.querySelector('[data-target-cost-output]').value||0),
      reasoningCapabilities:['standard',...(row.querySelector('[data-target-reasoning-high]').checked?['high']:[]),...(row.querySelector('[data-target-reasoning-maximum]').checked?['maximum']:[])],
      reasoningCreditsPerMillion:row.querySelector('[data-target-reasoning-credits]').value===''?null:Number(row.querySelector('[data-target-reasoning-credits]').value),
      providerReasoningCostMicrosPerMillion:row.querySelector('[data-target-reasoning-cost]').value===''?null:Number(row.querySelector('[data-target-reasoning-cost]').value),
      imageCredits:Number(row.querySelector('[data-target-image]').value||0),audioCreditsPerMinute:Number(row.querySelector('[data-target-audio]').value||0),
      providerImageCostMicros:Number(row.querySelector('[data-target-cost-image]').value||0),providerAudioCostMicrosPerMinute:Number(row.querySelector('[data-target-cost-audio]').value||0)
    }));
    if(!collected.length)throw new Error('Add at least one target');
    const first=collected[0],second=collected[1]||null;
    const payload={provider:first.provider,providerConnectionId:first.providerConnectionId,providerModel:first.providerModel,fallbackProvider:second?second.provider:null,fallbackProviderConnectionId:second?second.providerConnectionId:null,fallbackModel:second?second.providerModel:null,targets:collected,byokPolicy:mByokPolicy.value,status:mStatus.value,customerId:mScope.value==='customer'?mCustomer.value:null};
    if(mScope.value==='global')Object.assign(payload,{providerInputCostMicrosPerMillion:first.providerInputCostMicrosPerMillion,providerOutputCostMicrosPerMillion:first.providerOutputCostMicrosPerMillion,providerImageCostMicros:first.providerImageCostMicros,providerAudioCostMicrosPerMinute:first.providerAudioCostMicrosPerMinute,inputCreditsPerMillion:first.inputCreditsPerMillion,outputCreditsPerMillion:first.outputCreditsPerMillion,imageCredits:first.imageCredits,audioCreditsPerMinute:first.audioCreditsPerMinute,requestsPerSecond:mRps.value?Number(mRps.value):null,requestsPerMinute:mRpm.value?Number(mRpm.value):null,tokensPerMinute:mTpm.value?Number(mTpm.value):null,retryBaseSeconds:Number(mRetryBase.value||2),retryMaxSeconds:Number(mRetryMax.value||120)});
    await api('/api/ops/models/'+encodeURIComponent(alias),{method:'PATCH',body:JSON.stringify(payload)});closeModal();await loadModels()
  }catch(e){alert(e.message)}};
}
async function loadOps(){
  try{
    const [h,a]=await Promise.all([api('/api/ops/health'),api('/api/ops/audit')]);
    healthBox.innerHTML='<p>Status: <strong>'+esc(h.status)+'</strong></p><p>Active customers: '+esc(h.activeCustomers)+' · Assistants: '+esc(h.activeAssistants)+'</p><p>Webhook errors (24h): '+esc(h.webhookErrors24h)+' · Overdue reminders: '+esc(h.overdueReminders)+' · Open handoffs: '+esc(h.openHandoffs)+'</p>';
    auditBox.innerHTML=(a.events||[]).slice(0,12).map(e=>'<div style="padding:7px 0;border-bottom:1px solid var(--l)"><strong>'+esc(e.action)+'</strong><div class="muted">'+new Date(e.created_at*1000).toLocaleString()+' · '+esc(e.target_type||'')+' '+esc(e.target_id||'')+'</div></div>').join('')||'No audit events.';
  }catch(e){healthBox.textContent=e.message}
}
async function loadAttempts(){
  try{
    if(!attemptCustomer)return;
    const selected=attemptCustomer.value;
    attemptCustomer.innerHTML=data.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');
    if(selected&&data.some(c=>String(c.id)===selected))attemptCustomer.value=selected;
    if(!attemptCustomer.value){attemptsBox.textContent='Select a customer to inspect attempts.';return}
    const x=await api('/api/ops/inference-attempts?customerId='+encodeURIComponent(attemptCustomer.value));
    const attempts=x.attempts||[];
    attemptsBox.innerHTML=attempts.length?'<table class="table"><thead><tr><th>Started</th><th>Workload / route</th><th>Status</th><th>Usage</th><th>Action</th></tr></thead><tbody>'+attempts.map(a=>'<tr><td>'+new Date(Number(a.started_at)*1000).toLocaleString()+'<div class="muted">'+esc(a.attempt_id)+'</div></td><td>'+esc(a.workload_type==='api_key'?('API key '+a.workload_id):(a.assistant_id||''))+'<div class="muted">'+esc(a.model_alias)+' · '+esc(a.provider)+' · '+esc(a.model)+'</div></td><td>'+esc(a.status)+(a.media_kind?' · '+esc(a.media_kind):'')+'</td><td>'+esc(a.input_units??'—')+' in / '+esc(a.output_units??'—')+' out · '+esc(a.reasoning_units??0)+' reasoning · '+esc(a.provider_cost_micros??'—')+' µUSD</td><td><button class="btn" data-resolve-attempt="'+esc(a.attempt_id)+'" data-assistant="'+esc(a.assistant_id||'')+'" data-workload-type="'+esc(a.workload_type||'')+'" data-workload-id="'+esc(a.workload_id||'')+'">Resolve</button></td></tr>').join('')+'</tbody></table>':'No unresolved attempts.';
    attemptsBox.querySelectorAll('[data-resolve-attempt]').forEach(button=>button.onclick=()=>resolveAttemptDialog(button.dataset.resolveAttempt,button.dataset.assistant,button.dataset.workloadType,button.dataset.workloadId));
  }catch(e){attemptsBox.textContent=e.message}
}
function resolveAttemptDialog(attemptId,assistantId,workloadType,workloadId){
  openModal('<h2>Resolve uncertain provider attempt</h2><p class="muted">Choose an action supported by evidence. Recovered results come only from the durable journal.</p><div class="field"><label>Outcome</label><select class="input" id="resolutionOutcome"><option value="unresolved">Keep held and unresolved</option><option value="confirmed_not_submitted">Confirmed not submitted · release reservation</option><option value="recovered_result">Recover journaled result · deliver reply</option><option value="provider_charged_no_result">Provider charged, no result · settle exact usage</option><option value="mkety_absorbed_cost">Mkety absorbs exact provider cost · release customer credits</option></select></div><div class="field"><label>Evidence summary</label><input class="input" id="resolutionEvidence" maxlength="500"></div><div class="field"><label>Reason</label><input class="input" id="resolutionReason" maxlength="500"></div><div class="field"><label>Idempotency key</label><input class="input" id="resolutionKey" maxlength="160"></div><div id="resolutionUsage" hidden><div class="field"><label>Exact input units (provider charge only)</label><input class="input" id="resolutionInputUnits" type="number" min="0"></div><div class="field"><label>Exact output units</label><input class="input" id="resolutionOutputUnits" type="number" min="0"></div><div class="field"><label>Exact reasoning units</label><input class="input" id="resolutionReasoningUnits" type="number" min="0" value="0"></div><div class="field"><label>Image units</label><input class="input" id="resolutionImageUnits" type="number" min="0" value="0"></div><div class="field"><label>Audio seconds</label><input class="input" id="resolutionAudioSeconds" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>Exact provider cost (µUSD)</label><input class="input" id="resolutionProviderCost" type="number" min="0"></div><div class="field"><label>Usage or provider-cost evidence</label><input class="input" id="resolutionUsageEvidence" maxlength="500"></div></div><div class="top"><button class="btn" id="cancelResolution">Cancel</button><button class="btn primary" id="submitResolution">Record audited resolution</button></div>');
  byId('resolutionKey').value='ops-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
  const outcome=byId('resolutionOutcome'),usage=byId('resolutionUsage');
  outcome.onchange=()=>usage.hidden=!['provider_charged_no_result','mkety_absorbed_cost'].includes(outcome.value);
  byId('cancelResolution').onclick=closeModal;
  byId('submitResolution').onclick=async()=>{
    try{
      const body={customerId:attemptCustomer.value,outcome:outcome.value,idempotencyKey:byId('resolutionKey').value,evidenceSummary:byId('resolutionEvidence').value,reason:byId('resolutionReason').value};
      if(workloadType==='api_key'){body.workloadType=workloadType;body.workloadId=workloadId}else body.assistantId=assistantId;
      if(outcome.value==='provider_charged_no_result')body.usage={inputUnits:Number(byId('resolutionInputUnits').value||0),outputUnits:Number(byId('resolutionOutputUnits').value||0),reasoningUnits:Number(byId('resolutionReasoningUnits').value||0),imageUnits:Number(byId('resolutionImageUnits').value||0),audioSeconds:Number(byId('resolutionAudioSeconds').value||0),providerCostMicros:Number(byId('resolutionProviderCost').value),evidence:byId('resolutionUsageEvidence').value};
      if(outcome.value==='mkety_absorbed_cost')body.absorbedProviderCost={providerCostMicros:Number(byId('resolutionProviderCost').value),evidence:byId('resolutionUsageEvidence').value};
      await api('/api/ops/inference-attempts/'+encodeURIComponent(attemptId)+'/resolve',{method:'POST',body:JSON.stringify(body)});
      closeModal();await loadAttempts();
    }catch(e){alert(e.message)}
  };
}
function newCustomerDialog(){
  openModal('<h2>Create customer</h2>'+
    '<p class="muted">Commercial setup mirrors Main Enterprise AI. Enter customer-facing USD amounts and percentages; Mkety stores the internal units automatically.</p>'+
    '<div class="two">'+
      '<div class="field"><label>Company</label><input class="input" id="nName"></div>'+
      '<div class="field"><label>Slug</label><input class="input" id="nSlug"></div>'+
      '<div class="field"><label>Admin email</label><input class="input" id="nEmail" type="email"></div>'+
      '<div class="field"><label>Custom domain (optional)</label><input class="input" id="nDomain" placeholder="ai.customer.com"></div>'+
      '<div class="field"><label>Monthly price (USD)</label><input class="input" id="nPrice" inputmode="decimal" placeholder="100.00"></div>'+
      '<div class="field"><label>Included MKredit per billing period</label><input class="input" id="nCredits" type="number" min="0" placeholder="Manual override only"></div>'+
      '<div class="field"><label>Credit allocation mode</label><select class="input" id="nAutoCredits"><option value="yes">Automatic — recommended</option><option value="no">Manual override</option></select></div>'+
      '<div class="field"><label>Funding mode</label><select class="input" id="nFundingMode"><option value="full_period">Full monthly payment</option><option value="prepaid_partial">Prepaid partial funding / top-ups</option></select></div>'+
      '<div class="field"><label>Minimum funding / top-up (USD)</label><input class="input" id="nMinimumFunding" inputmode="decimal" placeholder="25.00"></div>'+
      '<div class="field"><label>Setup fee (USD, optional)</label><input class="input" id="nSetupFee" inputmode="decimal" value="0"></div>'+
      '<div class="field"><label>Managed AI cost envelope % <span class="muted">(internal only)</span></label><input class="input" id="nEnvelope" inputmode="decimal" value="15"></div>'+
      '<div class="field"><label>Max assistants</label><input class="input" id="nMax" type="number" value="5" min="1"></div>'+
    '</div>'+
    '<details class="card" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Internal pricing policy — never customer-visible</summary>'+
      '<div class="two" style="margin-top:10px">'+
        '<div class="field"><label>Operations / safety reserve %</label><input class="input" id="nReserve" type="number" min="0" max="99.99" step="0.01" value="10"></div>'+
        '<div class="field"><label>Text rate multiplier %</label><input class="input" id="nMultiplier" type="number" min="100" max="1000" step="0.01" value="100"></div>
        <div class="field"><label>Media/voice rate multiplier %</label><input class="input" id="nMediaMultiplier" type="number" min="100" max="1000" step="0.01" value="100"><small class="muted">Missing image/voice provider prices use 20 MKredit per image/minute before this multiplier.</small></div></div>'+
      '</div>'+
      '<p class="muted">Provider cost envelope, reserve, provider pricing, rate multiplier and credit-unit conversion stay internal. Customers see only price/top-ups, credits, usage and enabled features.</p>'+
    '</details>'+
    '<div class="row" style="margin-top:14px"><button class="btn" id="nCalc" type="button">Calculate included credits</button><button class="btn primary" id="nCreate">Create customer</button></div>');
  const nName=byId('nName'),nSlug=byId('nSlug'),nEmail=byId('nEmail'),nDomain=byId('nDomain'),
    nPrice=byId('nPrice'),nCredits=byId('nCredits'),nAutoCredits=byId('nAutoCredits'),nFundingMode=byId('nFundingMode'),
    nMinimumFunding=byId('nMinimumFunding'),nSetupFee=byId('nSetupFee'),nEnvelope=byId('nEnvelope'),
    nReserve=byId('nReserve'),nMultiplier=byId('nMultiplier'),nMediaMultiplier=byId('nMediaMultiplier'),nMax=byId('nMax'),nCalc=byId('nCalc'),nCreate=byId('nCreate');
  nFundingMode.onchange=()=>{nMinimumFunding.disabled=nFundingMode.value!=='prepaid_partial'};
  nFundingMode.onchange();
  nAutoCredits.onchange=()=>{nCredits.disabled=nAutoCredits.value==='yes'};
  nAutoCredits.onchange();
  nCalc.onclick=async()=>{try{
    const x=await api('/api/ops/pricing/calculate',{method:'POST',body:JSON.stringify({
      monthlyPriceUsd:nPrice.value,managedCostSharePercent:nEnvelope.value,operationsReservePercent:nReserve.value,customerRateMultiplierPercent:nMultiplier.value
    })});
    nCredits.value=x.includedCredits;
    alert('Managed provider-cost ceiling: $'+(x.providerEnvelopeUsdMicros/1000000).toFixed(2)+'\\nUsable provider capacity after reserve: $'+(x.usableProviderUsdMicros/1000000).toFixed(2)+'\\nIncluded MKredit: '+x.includedCredits);
  }catch(e){alert(e.message)}};
  nCreate.onclick=async()=>{try{
    const x=await api('/api/ops/customers',{method:'POST',body:JSON.stringify({
      name:nName.value,slug:nSlug.value,adminEmail:nEmail.value,customHostname:nDomain.value||null,
      monthlyPriceUsd:nPrice.value,includedCredits:Number(nCredits.value||0),autoIncludedCredits:nAutoCredits.value,
      fundingMode:nFundingMode.value,minimumFundingUsd:nMinimumFunding.value||nPrice.value,setupFeeUsd:nSetupFee.value||'0',
      managedCostSharePercent:nEnvelope.value,operationsReservePercent:nReserve.value,customerRateMultiplierPercent:nMultiplier.value,customerMediaRateMultiplierPercent:nMediaMultiplier.value,
      maxAssistants:Number(nMax.value||5)
    })});
    closeModal();await loadCustomers();await manageCustomer(x.customerId);
  }catch(e){alert(e.message)}};
}
async function manageCustomer(id){
  try{
    const d=await api('/api/ops/customer?id='+encodeURIComponent(id));const c=d.customer,p=d.commercial||{},f=d.features||{},domains=d.domains||[],credits=d.credits||{},members=d.members||[];
    openModal('<div class="top" style="margin:0 0 10px"><div><h2 style="margin:0">'+esc(c.name)+'</h2><div class="muted">MKredit balance: '+esc(credits.balance??0)+' · Billing: '+esc(c.billing_status||'current')+'</div></div></div>'+
      '<p class="muted">'+domains.map(x=>esc(x.hostname)+' · '+esc(x.status)+' / '+esc(x.ssl_status||'')).join('<br>')+'</p>'+
      '<h3>Customer access</h3><div class="card"><p class="muted">The hosted portal remains the recovery-safe entry point even when a custom domain is pending.</p><p><strong>'+(domains.find(x=>x.kind==='hosted')?esc(domains.find(x=>x.kind==='hosted').hostname):'Hosted portal unavailable')+'</strong></p>'+
      (d.ownerAccess?'<div class="field"><label>Active owner access link · expires '+new Date(d.ownerAccess.expiresAt*1000).toLocaleString()+'</label><div class="row"><input class="input" id="ownerAccessUrl" style="flex:1;min-width:260px" readonly value="'+esc(d.ownerAccess.accessUrl)+'"><button class="btn" id="copyOwnerAccess">Copy link</button></div></div>':'<p class="muted">No active revealable owner link. Generate one below.</p>')+
      '<div class="row"><button class="btn primary" id="regenerateAccess">Generate fresh owner access link</button><button class="btn danger" id="deleteUnpaid">Delete unpaid customer</button></div><p id="accessStatus" class="muted">The link remains here until it is used or expires. Delete is blocked automatically after any verified payment or AI usage.</p></div>'+
      '<h3>User controls</h3><div class="card">'+(members.length?members.map(m=>'<div class="assistant-item spread"><div><strong>'+esc(m.email)+'</strong><div class="muted">'+esc(m.role)+' · '+esc(m.control_state||'active')+(m.control_reason?' · '+esc(m.control_reason):'')+'</div></div><span>'+(m.control_state&&m.control_state!=='active'?'<button class="btn" data-ops-user-control="'+m.id+'" data-state="active">Restore</button>':'<button class="btn" data-ops-user-control="'+m.id+'" data-state="paused">Pause</button> <button class="btn" data-ops-user-control="'+m.id+'" data-state="suspended">Suspend</button> <button class="btn danger" data-ops-user-control="'+m.id+'" data-state="banned">Ban</button>')+'</span></div>').join(''):'<div class="empty">No users.</div>')+'</div>'+
      '<h3>Commercial agreement</h3><div class="two">'+
        '<div class="field"><label>Monthly price (USD)</label><input class="input" id="pPrice" inputmode="decimal" value="'+(Number(p.subscription_amount_minor||0)/100).toFixed(2)+'"></div>'+
        '<div class="field"><label>Included MKredit per billing period</label><input class="input" id="pCredits" type="number" value="'+esc(p.included_credits||0)+'"></div>'+
        '<div class="field"><label>Credit allocation mode</label><select class="input" id="pAutoCredits"><option value="yes">Automatic — recommended</option><option value="no">Manual override</option></select></div>'+
        '<div class="field"><label>Funding mode</label><select class="input" id="pFundingMode"><option value="full_period">Full monthly payment</option><option value="prepaid_partial">Prepaid partial funding / top-ups</option></select></div>'+
        '<div class="field"><label>Minimum funding / top-up (USD)</label><input class="input" id="pMinimumFunding" inputmode="decimal" value="'+(Number(p.minimum_funding_minor||p.subscription_amount_minor||0)/100).toFixed(2)+'"></div>'+
        '<div class="field"><label>Setup fee (USD)</label><input class="input" id="pSetupFee" inputmode="decimal" value="'+(Number(p.setup_fee_minor||0)/100).toFixed(2)+'"></div>'+
        '<div class="field"><label>Managed AI cost envelope % <span class="muted">(internal only)</span></label><input class="input" id="pEnvelope" type="number" step="0.01" value="'+(Number(p.provider_envelope_bps||1500)/100).toFixed(2)+'"></div>'+
        '<div class="field"><label>Max assistants</label><input class="input" id="pMax" type="number" value="'+esc(f.max_assistants||5)+'"></div>'+
      '</div>'+
      '<details class="card" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Internal pricing policy — never customer-visible</summary><div class="two" style="margin-top:10px">'+
        '<div class="field"><label>Operations / safety reserve %</label><input class="input" id="pReserve" type="number" min="0" max="99.99" step="0.01" value="'+(Number(p.operations_reserve_bps||1000)/100).toFixed(2)+'"></div>'+
        '<div class="field"><label>Text rate multiplier %</label><input class="input" id="pMultiplier" type="number" min="100" max="1000" step="0.01" value="'+(Number(p.rate_multiplier_bps||10000)/100).toFixed(2)+'"><small class="muted">Applies to text and token charges.</small></div>
      <div class="field"><label>Media/voice rate multiplier %</label><input class="input" id="pMediaMultiplier" type="number" min="100" max="1000" step="0.01" value="'+(Number(p.media_rate_multiplier_bps||p.rate_multiplier_bps||10000)/100).toFixed(2)+'"><small class="muted">Applies to image and voice charges. When provider pricing is missing, the base is 20 MKredit per image or minute.</small></div></div>'+
      '</div></details>'+
      '<div class="row" style="margin-top:10px"><button class="btn" id="calcCredits">Recalculate included credits</button></div>'+
      '<h3>Features</h3><div class="two"><label><input id="fTelegram" type="checkbox" '+(f.telegram_enabled?'checked':'')+'> Telegram</label><label><input id="fVision" type="checkbox" '+(f.vision_enabled?'checked':'')+'> Vision</label><label><input id="fVoice" type="checkbox" '+(f.voice_enabled?'checked':'')+'> Voice</label><label><input id="fKnowledge" type="checkbox" '+(f.knowledge_enabled?'checked':'')+'> Knowledge</label><label><input id="fReminders" type="checkbox" '+(f.reminders_enabled?'checked':'')+'> Reminders</label><label><input id="fHandoff" type="checkbox" '+(f.human_handoff_enabled?'checked':'')+'> Human handoff</label><label><input id="fTools" type="checkbox" '+(f.tools_enabled?'checked':'')+'> Tools</label></div>'+
      '<h3>Funding / ledger</h3><div class="two"><div class="field"><label>Credit adjustment (+ add / − remove)</label><input class="input" id="creditDelta" type="number" value="0"><small class="muted">A removal lowers available MKredit and adds the same amount to Used.</small></div><div class="field"><label>Reason</label><input class="input" id="creditReason" placeholder="Goodwill / support adjustment"></div></div>'+
      '<div class="row"><button class="btn" id="adjustCredits">Apply adjustment</button><button class="btn" id="showLedger">Funding history</button></div>'+
      '<h3>Domains</h3><p class="muted">Customer DNS uses one CNAME. Mkety handles the Cloudflare Custom Hostname, SSL and Worker route.</p><div id="opsDomains">'+domains.map(x=>{let v={};try{v=x.validation_json?JSON.parse(x.validation_json):{}}catch{}return '<div class="card" style="margin-bottom:8px"><div class="spread"><div><strong>'+esc(x.hostname)+'</strong><div class="muted">'+esc(x.kind)+' · '+esc(x.status)+' · SSL '+esc(x.ssl_status||'pending')+(x.is_primary?' · primary':'')+'</div></div>'+(x.kind==='custom'?'<button class="btn" data-refresh-domain="'+esc(x.hostname)+'">Refresh status</button>':'')+'</div>'+(x.kind==='custom'?'<p class="muted">Customer DNS: CNAME <strong>'+esc(x.hostname)+'</strong> → <strong>'+esc(v.cname_target||'mkety-assist.mkety.app')+'</strong><br>Worker route: <code>'+esc(v.worker_route||x.hostname+'/*')+'</code></p>':'')+'</div>'}).join('')+'</div><div class="two"><input class="input" id="newDomain" placeholder="ai.customer.com"><button class="btn" id="addDomain">Configure custom domain</button></div>'+
      '<div class="row" style="margin-top:16px"><button class="btn primary" id="savePolicy">Save amended commercial policy</button><button class="btn" id="closeCustomer">Close</button></div>');
    const closeCustomer=byId('closeCustomer'),calcCredits=byId('calcCredits'),pPrice=byId('pPrice'),pCredits=byId('pCredits'),
      pAutoCredits=byId('pAutoCredits'),pFundingMode=byId('pFundingMode'),pMinimumFunding=byId('pMinimumFunding'),pSetupFee=byId('pSetupFee'),
      pEnvelope=byId('pEnvelope'),pReserve=byId('pReserve'),pMultiplier=byId('pMultiplier'),pMediaMultiplier=byId('pMediaMultiplier'),pMax=byId('pMax'),
      fTelegram=byId('fTelegram'),fVision=byId('fVision'),fVoice=byId('fVoice'),fKnowledge=byId('fKnowledge'),
      fReminders=byId('fReminders'),fHandoff=byId('fHandoff'),fTools=byId('fTools'),
      creditDelta=byId('creditDelta'),creditReason=byId('creditReason'),adjustCredits=byId('adjustCredits'),
      showLedger=byId('showLedger'),newDomain=byId('newDomain'),addDomain=byId('addDomain'),savePolicy=byId('savePolicy'),
      regenerateAccess=byId('regenerateAccess'),deleteUnpaid=byId('deleteUnpaid'),ownerAccessUrl=byId('ownerAccessUrl'),
      copyOwnerAccess=byId('copyOwnerAccess'),accessStatus=byId('accessStatus');
    pFundingMode.value=p.funding_mode||'full_period';
    pFundingMode.onchange=()=>{pMinimumFunding.disabled=pFundingMode.value!=='prepaid_partial'};pFundingMode.onchange();
    pAutoCredits.value='yes';pAutoCredits.onchange=()=>{pCredits.disabled=pAutoCredits.value==='yes'};pAutoCredits.onchange();
    closeCustomer.onclick=closeModal;
    if(copyOwnerAccess&&ownerAccessUrl)copyOwnerAccess.onclick=async()=>{try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(ownerAccessUrl.value);
      else{ownerAccessUrl.focus();ownerAccessUrl.select();document.execCommand('copy')}
      accessStatus.textContent='Owner access link copied.';
    }catch(e){accessStatus.textContent='Could not copy automatically. Select the link field and copy it manually.'}};
    dialog.querySelectorAll('[data-ops-user-control]').forEach(btn=>btn.onclick=async()=>{try{
      const state=btn.dataset.state,userId=btn.dataset.opsUserControl;
      const reason=state==='active'?null:(prompt((state==='banned'?'Ban':state==='suspended'?'Suspend':'Pause')+' this user — optional reason')||null);
      await api('/api/ops/user-control',{method:'POST',body:JSON.stringify({customerId:id,userId,state,reason})});
      closeModal();await manageCustomer(id);
    }catch(e){alert(e.message)}});
    regenerateAccess.onclick=async()=>{try{
      regenerateAccess.disabled=true;accessStatus.textContent='Generating a fresh owner access link…';
      await api('/api/ops/customer/access-link',{method:'POST',body:JSON.stringify({customerId:id})});
      closeModal();await manageCustomer(id);
    }catch(e){regenerateAccess.disabled=false;accessStatus.textContent=e.message}};
    deleteUnpaid.onclick=async()=>{try{
      const phrase=prompt('This permanently deletes the unpaid/unused customer and any custom-domain Cloudflare routing. Type DELETE '+c.slug+' to continue.');
      if(phrase!=='DELETE '+c.slug)return;
      const x=await api('/api/ops/customer?id='+encodeURIComponent(id),{method:'DELETE'});
      alert('Deleted unpaid customer '+x.slug+'. You can recreate the contract cleanly now.');
      closeModal();await loadCustomers();
    }catch(e){alert(e.message)}};
    calcCredits.onclick=async()=>{try{
      const x=await api('/api/ops/pricing/calculate',{method:'POST',body:JSON.stringify({
        monthlyPriceUsd:pPrice.value,managedCostSharePercent:pEnvelope.value,operationsReservePercent:pReserve.value,customerRateMultiplierPercent:pMultiplier.value
      })});
      pCredits.value=x.includedCredits;
      alert('Managed provider-cost ceiling: $'+(x.providerEnvelopeUsdMicros/1000000).toFixed(2)+'\\nUsable provider capacity after reserve: $'+(x.usableProviderUsdMicros/1000000).toFixed(2)+'\\nIncluded MKredit: '+x.includedCredits);
    }catch(e){alert(e.message)}};
    savePolicy.onclick=async()=>{try{
      await api('/api/ops/policy',{method:'PATCH',body:JSON.stringify({
        customerId:id,monthlyPriceUsd:pPrice.value,includedCredits:Number(pCredits.value),autoCalculateCredits:pAutoCredits.value==='yes',
        fundingMode:pFundingMode.value,minimumFundingUsd:pMinimumFunding.value||pPrice.value,setupFeeUsd:pSetupFee.value||'0',
        managedCostSharePercent:pEnvelope.value,operationsReservePercent:pReserve.value,customerRateMultiplierPercent:pMultiplier.value,customerMediaRateMultiplierPercent:pMediaMultiplier.value,
        creditRollover:true,maxAssistants:Number(pMax.value),telegramEnabled:fTelegram.checked,visionEnabled:fVision.checked,voiceEnabled:fVoice.checked,
        knowledgeEnabled:fKnowledge.checked,remindersEnabled:fReminders.checked,humanHandoffEnabled:fHandoff.checked,toolsEnabled:fTools.checked
      })});
      alert('Commercial policy saved');
    }catch(e){alert(e.message)}};
    adjustCredits.onclick=async()=>{try{const x=await api('/api/ops/credits',{method:'POST',body:JSON.stringify({customerId:id,delta:Number(creditDelta.value),reason:creditReason.value})});alert('Available: '+x.balance+' MKredit · Used: '+x.used+' MKredit');closeModal();await manageCustomer(id)}catch(e){alert(e.message)}};
    showLedger.onclick=async()=>{try{const x=await api('/api/ops/ledger?customerId='+encodeURIComponent(id));alert((x.entries||[]).slice(0,20).map(e=>new Date(e.created_at*1000).toLocaleString()+' | '+e.kind+' | '+e.delta+' | balance '+e.balance_after).join('\\n')||'No ledger entries.')}catch(e){alert(e.message)}};
    addDomain.onclick=async()=>{try{const x=await api('/api/ops/domains',{method:'POST',body:JSON.stringify({customerId:id,hostname:newDomain.value})});alert('Configured. Customer CNAME: '+newDomain.value+' -> '+x.cnameTarget+'\\nWorker route: '+x.workerRoute);closeModal();await manageCustomer(id)}catch(e){alert(e.message)}};
    dialog.querySelectorAll('[data-refresh-domain]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;const x=await api('/api/ops/domains/status?hostname='+encodeURIComponent(btn.dataset.refreshDomain));alert(x.status==='active'?'Domain verified and active.':'Domain is still waiting for public DNS/HTTPS verification.');closeModal();await manageCustomer(id)}catch(e){btn.disabled=false;alert(e.message)}});
  }catch(e){alert(e.message)}
}
async function loadOps(){
  try{const [h,a]=await Promise.all([api('/api/ops/health'),api('/api/ops/audit')]);healthBox.innerHTML='<p>Status: <strong>'+esc(h.status)+'</strong></p><p>Active customers: '+esc(h.activeCustomers)+' · Assistants: '+esc(h.activeAssistants)+'</p><p>Webhook errors (24h): '+esc(h.webhookErrors24h)+' · Overdue reminders: '+esc(h.overdueReminders)+' · Open handoffs: '+esc(h.openHandoffs)+'</p>';auditBox.innerHTML=(a.events||[]).slice(0,14).map(e=>'<div style="padding:7px 0;border-bottom:1px solid var(--l)"><strong>'+esc(e.action)+'</strong><div class="muted">'+new Date(e.created_at*1000).toLocaleString()+' · '+esc(e.target_type||'')+' '+esc(e.target_id||'')+'</div></div>').join('')||'No audit events.'}catch(e){healthBox.textContent=e.message}
}
async function boot(){
  try{await Promise.all([loadCustomers(),loadProviders(),loadModels(),loadOps()])}
  catch(e){if(String(e.message).includes('unauthorized')) location.reload(); else rows.innerHTML='<tr><td colspan="5">'+esc(e.message)+'</td></tr>'}
}
try{
  if(!modal||!dialog||!metrics||!rows||!newCustomer||!opsLogout) throw new Error('Operator UI controls failed to initialize');
  newCustomer.onclick=newCustomerDialog;
  refreshCustomers.onclick=loadCustomers;
  refreshProviders.onclick=loadProviders;
  newProvider.onclick=addProvider;
  refreshModels.onclick=loadModels;
  refreshOps.onclick=loadOps;
  refreshAttempts.onclick=loadAttempts;
  attemptCustomer.onchange=loadAttempts;
  opsLogout.onclick=async()=>{await fetch('/api/ops/auth/logout',{method:'POST'});location.reload()};
  renderCustomers();
  boot();
}catch(e){
  document.body.insertAdjacentHTML('afterbegin','<div style="padding:12px;background:#5a1f2b;color:white;font:14px system-ui">Operator UI failed to initialize: '+esc(e.message)+'</div>');
}
</script>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c] || c));
}
