// Senarist v2: Claude yozadi (bitta mavzu, chuqur), alohida tanqidchi baholaydi, <8 bo'lsa qayta yozdiradi. Egasining tasdiq/rad qilganlaridan didi o'rganiladi.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const TF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'senariy_tajriba.json');
const URL_ = 'https://visartdesign.uz/api/senariy-yoz';

export const tajribaOqi = () => { try { return { yoqdi: [], rad: [], mavzular: [], ...JSON.parse(fs.readFileSync(TF, 'utf8')) }; } catch { return { yoqdi: [], rad: [], mavzular: [] }; } };
const qisqa = (S) => `[${S.mavzu || ''}] Hook: ${S.hook}. ` + (S.bolimlar || []).map((b) => b.ovoz).join(' ');
export function tajribaYoz(tur, S) {
  if (!S || !S.v2) return;
  const t = tajribaOqi(); const k = tur === 'yoqdi' ? 'yoqdi' : 'rad';
  t[k] = [...t[k].filter((x) => x !== qisqa(S)), qisqa(S)].slice(-12);
  if (tur === 'yoqdi' && S.mavzu) t.mavzular = [...t.mavzular.filter((x) => x !== S.mavzu), S.mavzu].slice(-30);
  try { fs.writeFileSync(TF, JSON.stringify(t, null, 1)); } catch { /* ixtiyoriy */ }
}
async function post(body, ms = 150000) {
  const r = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Media-Secret': process.env.MEDIA_SECRET || '' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  const d = await r.json().catch(() => ({ ok: false, error: 'HTTP ' + r.status }));
  if (!r.ok && d.ok !== false) d.ok = false; return d;
}
export async function senariyV2({ faktlar, renderlar }) {
  const tajriba = tajribaOqi(); let qayta = null, eng = null, oxirgiXato = '';
  for (let i = 0; i < 3; i++) {
    const y = await post({ faza: 'yoz', faktlar, renderlar, tajriba: { yoqdi: tajriba.yoqdi, rad: tajriba.rad }, oxirgiMavzular: tajriba.mavzular.slice(-10), qayta });
    if (!y.ok) { oxirgiXato = y.error || 'yoz xato'; console.log('Senariy v2 yozish xato:', oxirgiXato); break; }
    if (y.buzilish && y.buzilish.length) { console.log('v2 buzilish:', y.buzilish.join('; ')); qayta = { senariy: y.senariy, tanqid: { kamchiliklar: y.buzilish } }; oxirgiXato = y.buzilish.join('; '); continue; }
    const t = await post({ faza: 'baho', faktlar, senariy: y.senariy });
    const ball = t.ok ? t.ball : 7;
    console.log(`Senariy v2 urinish ${i + 1}: tanqidchi balli ${ball}`, (t.kamchiliklar || []).join(' | '));
    if (!eng || ball > eng.ball) eng = { S: y.senariy, ball, kamchiliklar: t.kamchiliklar || [] };
    if (ball >= 8) break;
    qayta = { senariy: y.senariy, tanqid: { kamchiliklar: t.kamchiliklar || [] } };
  }
  if (!eng) throw new Error('senariy v2 chiqmadi: ' + oxirgiXato);
  return eng;
}
