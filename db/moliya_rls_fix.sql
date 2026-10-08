-- VISART Moliya ilovasi Supabase'ida (inorfzronmjlkzggznyp) ishga tushiriladi.
-- RLS siyosatlari OR bilan birlashadi: bitta "keng" siyosat kompaniyalar
-- ajratilishini butunlay bekor qiladi. Quyida shunday siyosatlar olib tashlanadi;
-- har jadvalda kompaniya-chegarali (tenant_isolation / *_prorab_all) siyosat qoladi.
-- OLDIN: 0-bo'limdagi tekshiruvlarni yuriting. Keyin 1-bo'limni BITTA tranzaksiyada.

-- 0) TEKSHIRUV (natijani yuboring)
-- select pg_get_functiondef('current_kompaniya_id'::regproc);
-- select pg_get_functiondef('is_prorab'::regproc);
-- select pg_get_functiondef('current_prorab_login'::regproc);
-- select tablename, policyname, roles, cmd from pg_policies where schemaname='public' and tablename in ('chat_xabarlar','mijozlar','sozlamalar','xizmat_tolovlar');
-- select count(*) from sozlamalar;  -- ichida nima borligini ham ko'ring: select kalit from sozlamalar;

begin;

-- chat_xabarlar: "allow all" (true) -- butun internetga ochiq edi
drop policy if exists "allow all - chat" on chat_xabarlar;
drop policy if exists prorab_chat        on chat_xabarlar;  -- har qanday prorab, har kompaniya
drop policy if exists chat_prorab_all    on chat_xabarlar;  -- is_prorab() = kompaniyasiz
drop policy if exists chat_mark_read     on chat_xabarlar;
drop policy if exists chat_insert        on chat_xabarlar;
-- qoladi: tenant_isolation, mijoz_chat, chat_mijoz_read

-- mijozlar: har qanday prorab barcha kompaniyalar mijozlarini o'qir/yangilar edi
drop policy if exists prorab_read_own_mijozlar   on mijozlar;
drop policy if exists prorab_update_own_mijozlar on mijozlar;
drop policy if exists mijozlar_prorab_read       on mijozlar;
-- qoladi: tenant_isolation, mijoz_self_*, mijozlar_self*

-- sozlamalar: ilova frontendi bu jadvalga umuman murojaat qilmaydi
drop policy if exists sozlamalar_prorab on sozlamalar;
drop policy if exists prorab_sozlamalar on sozlamalar;
-- (policy qolmaydi => faqat service_role / Edge Function kira oladi)

-- xizmat_tolovlar
drop policy if exists xizmat_prorab_all on xizmat_tolovlar;
-- qoladi: tenant_isolation, xizmat_mijoz_read

commit;

-- 2) NATIJANI TEKSHIRISH: ilovada prorab sifatida kiring -- obyektlar, to'lovlar,
-- chat, mijozlar ro'yxati ochilishi kerak. Biror narsa "bo'sh" bo'lib qolsa,
-- darhol ROLLBACK o'rniga shu siyosatni qayta yarating (quyida namuna):
-- create policy chat_insert on chat_xabarlar for insert with check (kompaniya_id = current_kompaniya_id());
