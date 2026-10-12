# Barcha qoidalar_*.py dan db/seed_norma_qoidalari.sql yaratadi (tasdiqlangan=false).
import glob,importlib.util,os
def q(v):
    if v is None:return 'null'
    if isinstance(v,(int,float)):return str(v)
    return "'"+str(v).replace("'","''")+"'"
rows=[];manba=set();manba_extra=[]
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__),'qoidalar_*.py'))):
    sp=importlib.util.spec_from_file_location('m',f);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
    rows+=m.R
    manba_extra+=getattr(m,'MANBA',[])
out=['-- AVTOMATIK: db/bilim/yarat_sql.py. Manba: kitoblar (ma\'ruza/amaliy matnlari). tasdiqlangan=false -> admin tasdiqlamaguncha tekshiruvda ishlatilmaydi.']
for r in rows:manba.add(r[0])
for kod,nom,tur,ver,iz in manba_extra:
    out.append(f"insert into norma_manba(kod,nom,tur,versiya,izoh) values ({q(kod)},{q(nom)},{q(tur)},{q(ver)},{q(iz)}) on conflict (kod,versiya) do nothing;")
for m in sorted(manba):out.append(f"insert into norma_manba(kod,nom,tur,versiya) values ({q(m)},{q(m)},'ichki','kitoblar') on conflict (kod,versiya) do nothing;")
for r in rows:
    mn,band,soha,ob,xona,par,op,mi,ma,bi,ji,iz=r
    out.append(f"insert into norma_qoidalari(manba_id,band,soha,obyekt_turi,xona_turi,parametr,operator,qiymat_min,qiymat_max,birlik,jiddiylik,izoh,tasdiqlangan) select id,{q(band)},{q(soha)},{q(ob)},{q(xona)},{q(par)},{q(op)},{q(mi)},{q(ma)},{q(bi)},{q(ji)},{q(iz)},false from norma_manba where kod={q(mn)} and versiya='kitoblar';")
import json
mrows=[]
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__),'material_*.py'))):
    sp=importlib.util.spec_from_file_location('mm',f);mm=importlib.util.module_from_spec(sp);sp.loader.exec_module(mm);mrows+=mm.M
for t,nom,br,ish,bi,ol,tx,iz in mrows:
    out.append(f"insert into material_bazasi(toifa,nom,brend,ishlab_chiqaruvchi,birlik,olcham,texnik_jadval,izoh,mavjud_uzbekistonda) values ({q(t)},{q(nom)},{q(br)},{q(ish)},{q(bi)},{q(ol)},{q(json.dumps(tx,ensure_ascii=False))}::jsonb,{q(iz)},true);")
print(len(mrows),'material')
open(os.path.join(os.path.dirname(__file__),'..','seed_norma_qoidalari.sql'),'w',encoding='utf8').write('\n'.join(out)+'\n')
print(len(rows),'qoida')
