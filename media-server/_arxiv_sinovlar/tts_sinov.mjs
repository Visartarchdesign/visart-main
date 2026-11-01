// Bir xil gap, 3 yozuv: qaysi biri to'g'ri o'zbekcha eshitiladi?  node tts_sinov.mjs
import fs from 'fs';
import { ovozYarat } from './montaj.js';
for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const G = "Mana bu yerda devor yo'q. Mehmonxona, stol va oshxona bitta bo'shliqda, shuning uchun deraza yorug'ligi hamma burchakka yetib boradi. O'zbekiston, ma'no, qo'lingiz, g'oya.";
for (const [nom, y] of [['1_oddiy', ''], ['2_lotin_maxsus', 'lotin2'], ['3_kirill', 'kirill']]) {
  process.env.TTS_YOZUV = y;
  await ovozYarat(process.env, G, `sinov_${nom}.mp3`, process.env.TEMP || '.');
  console.log('tayyor', nom);
}
