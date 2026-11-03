import { OukitelLocal } from './oukitel-protocol.js';
import { Capacitor } from '@capacitor/core';

function initPowerHub(){
 document.title='PowerHub · BLUETTI + OUKITEL';
 const styles=document.createElement('style');styles.textContent=
 '.hub-nav{position:sticky;top:0;z-index:40;display:flex;gap:8px;padding:12px 14px 8px;background:#0b1020e8;backdrop-filter:blur(15px);max-width:560px;margin:auto}.hub-nav button{flex:1;border:1px solid #364b69;background:#15233a;color:#b7c9e5;border-radius:14px;padding:12px 6px;font:750 13px system-ui}.hub-nav button.current{background:#155e4c;color:#e4fff4;border-color:#35af88}.hub-oukitel{max-width:560px;margin:0 auto;padding:8px 14px 80px;display:none}.oukitel-active .hub-oukitel{display:block}.oukitel-active main.shell{display:none}.hub-card{padding:17px;border:1px solid #344864;background:#14233c;border-radius:20px;margin:13px 0}.hub-card h2{font-size:19px;margin:0 0 10px}.hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.hub-tile{padding:13px;border-radius:14px;background:#0f1b30}.hub-tile b{font-size:26px;display:block;margin-top:6px}.hub-tile span{font-size:12px;color:#a9bbd4}.hub-field{display:block;margin-top:10px;color:#b9c9e0;font-size:13px}.hub-field input{display:block;margin-top:5px;width:100%;padding:13px;background:#0b172a;border-radius:12px;border:1px solid #455673;color:#fff;font-size:16px}.hub-note{font-size:12px;color:#a8bad4;line-height:1.55}.hub-warning{color:#ffd28e}.hub-btn{border-radius:13px;border:1px solid #405b78;background:#263c5c;color:#eef5ff;padding:12px;margin-top:9px;font-weight:750}.hub-btn:disabled{opacity:.4}.hub-wide{width:100%}.hub-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px}.hub-controls .hub-btn{margin:0;min-height:65px}.hub-status{white-space:pre-line;font-size:12px;color:#9cddc6;line-height:1.6}.hub-pill{display:inline-block;padding:5px 9px;border-radius:10px;background:#283b57;font-size:11px;color:#becce2}.hub-error{color:#ffadad}';
 document.head.append(styles);
 const nav=document.createElement('div');nav.className='hub-nav';nav.innerHTML='<button id="hubBluetti" class="current">🔵 BLUETTI EB3A</button><button id="hubOukitel">🟢 OUKITEL P2001E+</button>';
 document.body.prepend(nav);
 const panel=document.createElement('section');panel.className='hub-oukitel';panel.innerHTML=
 '<div class="hub-card"><h2>⚡ OUKITEL P2001E Plus</h2><span class="hub-pill" id="ouState">Не підключено</span><p class="hub-note">Локальне з’єднання Wi-Fi → TCP 6607, без Home Assistant та ESP32. iPhone і станція мають бути в одній домашній мережі.</p><div class="hub-grid"><div class="hub-tile"><span>Заряд</span><b id="ouSoc">—%</b></div><div class="hub-tile"><span>Автономність</span><b id="ouTime">—</b></div><div class="hub-tile"><span>Вхідна потужність</span><b id="ouIn">— Вт</b></div><div class="hub-tile"><span>Вихідна потужність</span><b id="ouOut">— Вт</b></div></div><p class="hub-note" id="ouFresh">Ще немає даних від станції</p></div>'+
 '<div class="hub-card"><h2>🔐 Підключення до OUKITEL</h2><label class="hub-field">IPv4-адреса станції у Wi-Fi<input id="ouHost" type="text" autocomplete="off" inputmode="decimal" placeholder="Наприклад 192.168.1.50"></label><label class="hub-field">Персональний authKey (Base64)<input id="ouKey" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ключ із WonderFree/Quectel"></label><p class="hub-note hub-warning">Ключ не завантажується на GitHub, не надсилається нам і не зберігається у браузері. Потрібен ключ саме твоєї станції, який отримують через обліковий запис WonderFree. У цій версії автоматичне отримання ключа ще не реалізоване.</p><button id="ouConnect" class="hub-btn hub-wide">Підключити через Wi-Fi</button><button id="ouDisconnect" class="hub-btn hub-wide" disabled>Від’єднати</button><p id="ouLog" class="hub-status">Очікування налаштування</p></div>'+
 '<div class="hub-card"><h2>🔌 Виходи</h2><div class="hub-controls"><button id="ouAC" class="hub-btn" disabled>AC: —</button><button id="ouDC" class="hub-btn" disabled>DC: —</button><button id="ouUSB" class="hub-btn" disabled>USB: —</button></div><p class="hub-note">Перемикачі активуються після отримання стану з пристрою. Кожне вимкнення живлення потребує підтвердження; стан оновлюється тільки з телеметрії.</p></div>'+
 '<div class="hub-card"><h2>ℹ️ Підключення без серверів</h2><p class="hub-note">Доступ до OUKITEL працює лише в нативній iOS-версії Capacitor. Звичайний Safari/PWA не може відкрити TCP 6607. Для керування OUKITEL необхідний локальний authKey. Поки інтеграція не пройшла перевірку на твоєму P2001E Plus, вважай її тестовою.</p></div>';
 document.body.append(panel);
 const $=id=>document.getElementById(id);
 function select(which) {
  document.body.classList.toggle('oukitel-active',which==='oukitel');
  $('hubBluetti').classList.toggle('current',which==='bluetti');
  $('hubOukitel').classList.toggle('current',which==='oukitel');
 }
 $('hubBluetti').onclick=()=>select('bluetti');$('hubOukitel').onclick=()=>select('oukitel');
 const native=Capacitor.isNativePlatform();
 let last={},client=null,lastAt=0;
 const log=(s,error=false)=>{$('ouLog').textContent=s;$('ouLog').classList.toggle('hub-error',error)};
 function refreshControls(){
  for(const [id,tag] of [['ouAC',43],['ouDC',46],['ouUSB',44]]){
   const v=last[tag],valid=typeof v==='boolean';
   $(id).disabled=!client?.ready||!valid;$(id).textContent=id.slice(2)+': '+(valid?(v?'Увімкнено':'Вимкнено'):'—');
  }
 }
 const onData=(values,t)=>{
  last=values;lastAt=t;
  const fmt=(v,unit='')=>Number.isFinite(Number(v))&&v!=null?String(v)+unit:'—';
  $('ouSoc').textContent=fmt(values[1],'%');
  $('ouTime').textContent=fmt(values[2],' хв');
  $('ouIn').textContent=fmt(values[4],' Вт');
  $('ouOut').textContent=fmt(values[5],' Вт');
  $('ouFresh').textContent='Оновлено: '+new Date(t).toLocaleTimeString('uk-UA');
  $('ouState').textContent='Отримано живі дані';refreshControls();
 };
 const onStatus=s=>{log(s);$('ouState').textContent=s};
 if(!native){$('ouConnect').disabled=true;log('Ця інтеграція вимагає встановленого на iPhone застосунку Capacitor.',true)}
 else {
  $('ouConnect').onclick=async()=>{
   if(client)return;
   $('ouConnect').disabled=true;
   const host=$('ouHost').value.trim(),key=$('ouKey').value.trim();
   try{
    client=new OukitelLocal({onStatus,onData});await client.connect(host,key);
    $('ouKey').value='';$('ouDisconnect').disabled=false;
    try{localStorage.setItem('powerhub-oukitel-ip',host)}catch(e){}
   }catch(e){
    log('Помилка: '+e.message,true);
    if(client)await client.disconnect().catch(()=>{});
    client=null;$('ouConnect').disabled=false;$('ouDisconnect').disabled=true;
   }
  };
  $('ouDisconnect').onclick=async()=>{
   await client?.disconnect();client=null;last={};$('ouConnect').disabled=false;$('ouDisconnect').disabled=true;refreshControls();$('ouState').textContent='Від’єднано';
  };
  for(const [id,tag] of [['ouAC',43],['ouDC',46],['ouUSB',44]])$(id).onclick=async()=>{
   if(!client?.ready||typeof last[tag]!=='boolean')return;
   const next=!last[tag];
   if(!confirm((next?'Увімкнути':'Вимкнути')+' '+id.slice(2)+' на OUKITEL?\n\nПеревір, що до виходу не підключено критичне обладнання.'))return;
   $(id).disabled=true;try{await client.setOutput(tag,next)}catch(e){log('Помилка перемикання: '+e.message,true)}finally{refreshControls()}
  };
 }
 try{$('ouHost').value=localStorage.getItem('powerhub-oukitel-ip')||''}catch(e){}
 setInterval(()=>{if(lastAt&&Date.now()-lastAt>30000){$('ouFresh').textContent='⚠ Дані застаріли: '+new Date(lastAt).toLocaleTimeString('uk-UA')}},7000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPowerHub,{once:true});else initPowerHub();
