// Sayt ichki statistikasi — mijoz tomoni skripti. Cookie ishlatmaydi, IP saqlanmaydi.
// Brauzerda tasodifiy anonim ID (localStorage) va sessiya ID (sessionStorage) ishlatiladi.
// Admin panelga kirgan qurilma (localStorage.visart_notrack=1) hisobga olinmaydi.
export const TRACKER_SCRIPT = `(function(){try{
if(localStorage.getItem('visart_notrack')==='1'||navigator.webdriver)return;
var L=location,P=(L.pathname.replace(/\\/+$/,'')||'/').slice(0,120);
if(P.indexOf('/admin')===0)return;
function id(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36)}
var vid,sid,first=true;
try{vid=localStorage.getItem('v_id');if(!vid){vid=id();localStorage.setItem('v_id',vid)}}catch(e){vid=id()}
try{sid=sessionStorage.getItem('v_sid');if(!sid){sid=id();sessionStorage.setItem('v_sid',sid)}first=!sessionStorage.getItem('v_s1');sessionStorage.setItem('v_s1','1')}catch(e){sid=id()}
var dev=innerWidth<768?'m':innerWidth<1100?'t':'d';
function lang(){if(P.indexOf('/ru')===0)return'ru';var l='uz';try{l=localStorage.getItem('visart_lang')||'uz'}catch(e){}return l==='ru'?'ru':'uz'}
function send(t,b,n,x){var d={t:t,v:vid,s:sid,p:P,d:dev,l:lang(),b:b||'',n:n||0};if(x)for(var k in x)d[k]=x[k];var j=JSON.stringify(d);
try{if(navigator.sendBeacon&&navigator.sendBeacon('/api/t',new Blob([j],{type:'text/plain'})))return}catch(e){}
try{fetch('/api/t',{method:'POST',body:j,keepalive:true,headers:{'Content-Type':'text/plain'}})}catch(e){}}
var u='';try{u=new URLSearchParams(L.search).get('utm_source')||''}catch(e){}
send('pv','',0,{r:first?document.referrer:'',u:first?u:''});
var mx=0,act=0,last=Date.now(),vis=!document.hidden;
function sc(){var h=document.documentElement.scrollHeight-innerHeight;if(h<=0){mx=100;return}var p=Math.round(scrollY/h*100);if(p>mx)mx=p}
addEventListener('scroll',sc,{passive:true});sc();
function tick(){var n=Date.now();if(vis)act+=n-last;last=n}
function flush(){tick();if(act<800)return;send('leave',String(Math.min(mx,100)),Math.min(Math.round(act/1000),1800));act=0}
document.addEventListener('visibilitychange',function(){if(document.hidden){flush();vis=false}else{last=Date.now();vis=true}});
addEventListener('pagehide',flush);
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href],button');if(!a)return;
var h=(a.getAttribute('href')||'').toLowerCase(),b='';
if(h.indexOf('tel:')===0)b='phone';else if(/(^|\\/\\/)(t\\.me|telegram\\.me)\\//.test(h)||h.indexOf('t.me/')>-1)b='telegram';
else if(/wa\\.me|whatsapp/.test(h))b='whatsapp';else if(h.indexOf('instagram.com')>-1)b='instagram';else if(h.indexOf('mailto:')===0)b='email';
else if(/\\/(loyihalar|proekty)\\/[^\\/?#]+/.test(h))b='project:'+decodeURIComponent(h.split('?')[0].split('#')[0].split('/').filter(Boolean).pop()).slice(0,60);
else if(/\\/(xizmatlar|uslugi)\\/[^\\/?#]+/.test(h))b='service:'+h.split('?')[0].split('#')[0].split('/').filter(Boolean).pop().slice(0,60);
else if(h.indexOf('calc=')>-1||h.indexOf('#pricing')>-1)b='to_calc';else if(h.indexOf('#contact')>-1)b='to_contact';
if(b)send('click',b)},true);
document.addEventListener('submit',function(e){if(e.target&&e.target.tagName==='FORM')send('click','form_submit')},true);
var cu=false;function cuse(e){if(cu||!e.target.closest||!e.target.closest('#pricing'))return;cu=true;send('click','calc_use')}
document.addEventListener('change',cuse,true);document.addEventListener('input',cuse,true);
if(P==='/'||P==='/ru'){document.addEventListener('DOMContentLoaded',function(){if(!('IntersectionObserver'in window))return;
var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){send('sec',x.target.id);io.unobserve(x.target)}})},{threshold:.35});
['services','process','projects','pricing','about','faq','contact'].forEach(function(i){var el=document.getElementById(i);if(el)io.observe(el)})})}
}catch(e){}})();`;
