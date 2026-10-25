// ElevenLabs: bir gap, bir necha variant. node el_sinov.mjs   -> el_*.mp3 fayllari
import fs from 'fs';
import { ovozYarat } from './montaj.js';
for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const T = "Mana bu yerda devor yo'q. Mehmonxona, stol va oshxona bitta bo'shliqda, shuning uchun deraza yorug'ligi hamma burchakka yetib boradi.";
const T2 = "Qarang, bu yerda devor yo'q. Mehmonxona, stol, oshxona - hammasi bitta bo'shliqda. Shuning uchun deraza yorug'ligi hamma burchakka yetib boradi.";
const V = [
  ['1_tezroq', '[confident, conversational, like telling a friend, fast]  ' + T, { EL_STABILITY: '0.5', EL_TEZLIK: '1.2' }],
  ['2_og_zaki_matn', '[confident, conversational, like telling a friend, fast]  ' + T2, { EL_STABILITY: '0.5', EL_TEZLIK: '1.2' }],
  ['3_og_zaki_ifodali', '[excited, confident, natural fast speech, not reading]  ' + T2, { EL_STABILITY: '0.3', EL_TEZLIK: '1.2' }],
];
for (const [nom, G, o] of V) {
  Object.assign(process.env, { EL_YOZUV: 'lotin2' }, o);
  await ovozYarat({ ...process.env }, G, `el_${nom}.mp3`, process.env.TEMP || '.');
  console.log('tayyor', nom);
}
