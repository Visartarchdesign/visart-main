-- VISART Moliya ilovasi Supabase (inorfzronmjlkzggznyp) -- SQL Editor'da BIR MARTA.
-- Muammo: current_kompaniya_id() prorab VA mijoz uchun ham kompaniyani qaytaradi,
-- shuning uchun `tenant_isolation` (ALL) siyosati mijozga ham to'liq o'qish/yozish
-- bergan. Bundan tashqari bir nechta "keng" siyosat (OR bilan birlashadi) kompaniya
-- to'sig'ini butunlay ochib qo'ygan.
-- Yechim: prorab = o'z kompaniyasida hammasi; mijoz = FAQAT o'z obyektini o'qiydi
-- (kassa qoldig'i hisoblanishi uchun usta/pudratchi to'lovlari ham o'qiladi).

begin;

-- ── 1) Keng/ziddiyatli siyosatlarni olib tashlash ──
drop policy if exists "allow all - chat"        on chat_xabarlar;
drop policy if exists prorab_chat               on chat_xabarlar;
drop policy if exists chat_prorab_all           on chat_xabarlar;
drop policy if exists chat_mark_read            on chat_xabarlar;
drop policy if exists chat_insert               on chat_xabarlar;
drop policy if exists prorab_read_own_mijozlar  on mijozlar;
drop policy if exists prorab_update_own_mijozlar on mijozlar;
drop policy if exists mijozlar_prorab_read      on mijozlar;
drop policy if exists sozlamalar_prorab         on sozlamalar;  -- frontend ishlatmaydi
drop policy if exists prorab_sozlamalar         on sozlamalar;
drop policy if exists xizmat_prorab_all         on xizmat_tolovlar;

-- ── 2) tenant_isolation (mijozga ham ochiq) -> prorab-only ──
drop policy if exists tenant_isolation on chat_xabarlar;
drop policy if exists tenant_isolation on mijozlar;
drop policy if exists tenant_isolation on prorablar;
drop policy if exists tenant_isolation on ustalar;
drop policy if exists tenant_isolation on usta_tolovlari;
drop policy if exists tenant_isolation on kontragentlar;
drop policy if exists tenant_isolation on kontragent_tolovlari;
drop policy if exists tenant_isolation on xizmat_tolovlar;

-- prorab: o'z kompaniyasida hammasi
create policy chat_prorab_tenant        on chat_xabarlar       for all using (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab()) with check (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab());
create policy mijozlar_prorab_tenant    on mijozlar            for all using (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab()) with check (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab());
create policy prorablar_prorab_tenant   on prorablar           for all using (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab()) with check (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab());
create policy ustalar_prorab_tenant     on ustalar             for all using (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab()) with check (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab());
create policy usta_tol_prorab_tenant    on usta_tolovlari      for all using (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab()) with check (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab());
create policy kontr_prorab_tenant       on kontragentlar       for all using (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab()) with check (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab());
create policy kontr_tol_prorab_tenant   on kontragent_tolovlari for all using (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab()) with check (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab());
create policy xizmat_prorab_tenant      on xizmat_tolovlar     for all using (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab()) with check (kompaniya_id = current_kompaniya_id() and company_is_active() and is_prorab());

-- mijoz: faqat o'z obyekti, faqat o'qish (kassa qoldig'i hisobi uchun)
create policy ustalar_mijoz_read   on ustalar              for select using (kompaniya_id = current_kompaniya_id() and company_is_active() and obyekt_id = my_obyekt_id());
create policy usta_tol_mijoz_read  on usta_tolovlari       for select using (kompaniya_id = current_kompaniya_id() and company_is_active() and obyekt_id = my_obyekt_id());
create policy kontr_mijoz_read     on kontragentlar        for select using (kompaniya_id = current_kompaniya_id() and company_is_active() and obyekt_id = my_obyekt_id());
create policy kontr_tol_mijoz_read on kontragent_tolovlari for select using (kompaniya_id = current_kompaniya_id() and company_is_active() and obyekt_id = my_obyekt_id());
-- (xizmat_tolovlar uchun xizmat_mijoz_read, chat uchun mijoz_chat/chat_mijoz_read,
--  mijozlar uchun mijoz_self_*, prorablar uchun prorablar_self allaqachon bor)

commit;

-- ── SINOV (ishga tushirgandan keyin darhol) ──
-- 1) Prorab sifatida kiring: obyektlar, to'lovlar, chat, mijozlar, ustalar ochilsin.
-- 2) Mijoz sifatida kiring: o'z obyekti, kassa qoldig'i, chat ochilsin.
-- 3) Biror narsa bo'sh qolsa -- menga qaysi bo'lim ekanini yuboring.
