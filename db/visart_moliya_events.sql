-- VISART Moliya ilovasi Supabase'ida (ilovaning O'Z loyihasida) ishga tushiriladi.
-- Ilova kodiga TEGMAYDI: to'lov/xarajat/buyurtma qo'shilganda trigger
-- visartdesign.uz/api/visart-events'ga POST qiladi -> kunlik hisobotga tushadi.
-- 1) <SECRET> ni Cloudflare'dagi VISART_EVENTS_SECRET qiymatiga almashtiring.
-- 2) Supabase -> SQL Editor'da bir marta yuriting. (pg_net yoqilgan bo'lishi kerak:
--    create extension if not exists pg_net;)

create extension if not exists pg_net;

create or replace function visart_hodisa_yubor() returns trigger
language plpgsql security definer as $$
declare
  v_type text; v_matn text; v_summa numeric;
begin
  if tg_table_name = 'tolovlar' then
    v_type := 'tolov_qoshildi'; v_summa := new.summa;
    v_matn := 'To''lov qabul qilindi: ' || to_char(new.summa, 'FM999G999G999G990') || ' so''m' || coalesce(' (' || new.izoh || ')', '');
  elsif tg_table_name = 'xarajatlar' then
    v_type := 'xarajat_qoshildi'; v_summa := new.jami;
    v_matn := 'Xarajat: ' || coalesce(new.mahsulot, new.kat, 'xarajat') || ' — ' || to_char(new.jami, 'FM999G999G999G990') || ' so''m';
  elsif tg_table_name = 'zakazlar' then
    v_type := 'zakaz_qoshildi'; v_summa := new.umumiy;
    v_matn := 'Yangi buyurtma: ' || coalesce(new.nomi, '') || ' — ' || to_char(coalesce(new.umumiy,0), 'FM999G999G999G990') || ' so''m';
  else
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://visartdesign.uz/api/visart-events',
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Visart-Secret', '<SECRET>'),
      body := jsonb_build_object('type', v_type, 'obyekt_id', new.obyekt_id::text, 'matn', v_matn,
                                 'group', 'obyekt', 'urgent', false, 'summa', v_summa)
    );
  exception when others then
    null; -- hisobot xatosi ilovaning yozuvini to'xtatmasin
  end;
  return new;
end $$;

drop trigger if exists trg_visart_tolov on tolovlar;
create trigger trg_visart_tolov after insert on tolovlar for each row execute function visart_hodisa_yubor();
drop trigger if exists trg_visart_xarajat on xarajatlar;
create trigger trg_visart_xarajat after insert on xarajatlar for each row execute function visart_hodisa_yubor();
drop trigger if exists trg_visart_zakaz on zakazlar;
create trigger trg_visart_zakaz after insert on zakazlar for each row execute function visart_hodisa_yubor();
