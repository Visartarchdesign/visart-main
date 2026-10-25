// Telegram orqali B seriya: /reelb -> senariy (tasdiqlash tugmalari bilan) -> video + oblojka.
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';
import { senariyYoz, reelB } from './reelB.mjs';

const ILDIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), 'loyihalar');
const REG = path.join(ILDIZ, 'ishlatilgan.json');
let band = false;

const oqi = () => { try { return JSON.parse(fs.readFileSync(REG, 'utf8')); } catch (e) { return []; } };
const bor = () => fs.readdirSync(ILDIZ, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(ILDIZ, d.name, 'reja.png'))).map((d) => d.name);
const tg = (env, metod, body) => fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/${metod}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
async function tgFayl(env, metod, chatId, maydon, yol, mime, caption) {
  const fd = new FormData();
  fd.append('chat_id', String(chatId)); if (caption) fd.append('caption', caption.slice(0, 1000));
  fd.append(maydon, new Blob([fs.readFileSync(yol)], { type: mime }), path.basename(yol));
  const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/${metod}`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`Telegram ${metod} ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
}

export async function bajarReelSenariy({ env, adminChatId, loyiha, qayta = false }) {
  if (!fs.existsSync(ILDIZ)) throw new Error('loyihalar\\ papkasi yo\'q');
  const nom = loyiha || bor().find((n) => !oqi().includes(n));
  if (!nom) { await tg(env, 'sendMessage', { chat_id: adminChatId, text: "Ishlatilmagan loyiha qolmadi. loyihalar\\ ga yangi loyiha (reja.png + 1.jpg...) qo'shing." }); return; }
  const dir = path.join(ILDIZ, nom);
  if (!fs.existsSync(path.join(dir, 'reja.png'))) throw new Error(`${nom}: reja.png topilmadi`);
  if (qayta) fs.rmSync(path.join(dir, 'senariy.json'), { force: true });
  await tg(env, 'sendMessage', { chat_id: adminChatId, text: `🧠 "${nom}" rejasi o'qilmoqda, senariy yozilmoqda (1–2 daqiqa)...` });
  const S = await senariyYoz(env, dir, nom);
  const matn = [`🎬 B seriya senariysi: ${nom}`, '', `🪝 Hook: ${S.hook}`, `🖼 Oblojka: ${S.oblojka}`, '',
    ...S.zonalar.map((z, i) => `${i + 1}) ${z.sar} (${z.xona})\n📏 ${z.qoida}\n✅ ${z.sabab}\n❌ ${z.boshqa}`), '', `📣 ${S.oxir}`].join('\n');
  await tg(env, 'sendMessage', { chat_id: adminChatId, text: matn.slice(0, 3900), reply_markup: { inline_keyboard: [
    [{ text: '✅ Video yaratish (~40 s)', callback_data: `rb:uzun:${nom}` }, { text: '⚡ Teaser (~18 s)', callback_data: `rb:teaser:${nom}` }],
    [{ text: '🔄 Senariyni qayta yozish', callback_data: `rb:qayta:${nom}` }]] } });
}

export async function bajarReelYarat({ env, adminChatId, loyiha, variant = 'uzun' }) {
  if (band) { await tg(env, 'sendMessage', { chat_id: adminChatId, text: '⏳ Boshqa video tayyorlanmoqda, tugagach qayta bosing.' }); return; }
  band = true;
  try {
    const dir = path.join(ILDIZ, loyiha);
    if (!fs.existsSync(path.join(dir, 'reja.png'))) throw new Error(`${loyiha}: papka topilmadi`);
    await tg(env, 'sendMessage', { chat_id: adminChatId, text: `🎙 Ovoz va video tayyorlanmoqda (${variant === 'teaser' ? 'teaser' : 'to\'liq'}), 4–8 daqiqa...` });
    const out = path.join(os.tmpdir(), `reelB_${loyiha.replace(/\W+/g, '_')}_${variant}_${Date.now()}.mp4`);
    await reelB(env, { dir, out, variant, nom: loyiha });
    await tgFayl(env, 'sendVideo', adminChatId, 'video', out, 'video/mp4', `🎬 ${loyiha} — ${variant}`);
    const cover = out.replace(/\.mp4$/, '_oblojka.jpg');
    if (fs.existsSync(cover)) await tgFayl(env, 'sendPhoto', adminChatId, 'photo', cover, 'image/jpeg', '🖼 Oblojka');
    const matnF = out.replace(/\.mp4$/, '_matn.txt');
    if (fs.existsSync(matnF)) await tg(env, 'sendMessage', { chat_id: adminChatId, text: `📝 Ovoz matni:\n${fs.readFileSync(matnF, 'utf8').slice(0, 3500)}` });
    const ishl = oqi(); if (!ishl.includes(loyiha)) { ishl.push(loyiha); fs.writeFileSync(REG, JSON.stringify(ishl, null, 2)); }
    for (const f of [out, cover, matnF]) fs.rmSync(f, { force: true });
  } finally { band = false; }
}
