// ElevenLabs: bir gap, bir necha variant. node el_sinov.mjs   -> el_*.mp3 fayllari
import fs from 'fs';
import { ovozYarat } from './montaj.js';
for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const G = "Mana bu yerda devor yo'q. Mehmonxona, stol va oshxona bitta bo'shliqda, shuning uchun deraza yorug'ligi hamma burchakka yetib boradi.";
const V = [
  ['1_oddiy_uz_kod', { EL_YOZUV: '', EL_STABILITY: '0.5' }],
  ['2_oddiy_barqaror', { EL_YOZUV: '', EL_STABILITY: '1.0' }],
  ['3_kirill', { EL_YOZUV: 'kirill', EL_STABILITY: '0.5' }],
  ['4_kirill_barqaror', { EL_YOZUV: 'kirill', EL_STABILITY: '1.0' }],
  ['5_lotin_maxsus', { EL_YOZUV: 'lotin2', EL_STABILITY: '1.0' }],
];
for (const [nom, o] of V) {
  Object.assign(process.env, o);
  await ovozYarat({ ...process.env, EDGE_YOQ: '1' }, G, `el_${nom}.mp3`, process.env.TEMP || '.');
  console.log('tayyor', nom);
}
