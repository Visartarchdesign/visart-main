# Barcha qoidalar_*.py dan db/seed_norma_qoidalari.sql yaratadi (tasdiqlangan=false).
import glob,importlib.util,os
def q(v):
    if v is None:return 'null'
    if isinstance(v,(int,float)):return str(v)
    return "'"+str(v).replace("'","''")+"'"
rows=[];manba=set()
for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__),'qoidalar_*.py'))):
    sp=importlib.util.spec_from_file_location('m',f);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
    rows+=m.R
out=['-- AVTOMATIK: db/bilim/yarat_sql.py. Manba: kitoblar (ma\'ruza/amaliy matnlari). tasdiqlangan=false -> admin tasdiqlamaguncha tekshiruvda ishlatilmaydi.']
for r in rows:manba.add(r[0])
for m in sorted(manba):out.append(f"insert into norma_manba(kod,nom,tur,versiya) values ({q(m)},{q(m)},'ichki','kitoblar') on conflict (kod,versiya) do nothing;")
for r in rows:
    mn,band,soha,ob,xona,par,op,mi,ma,bi,ji,iz=r
    out.append(f"insert into norma_qoidalari(manba_id,band,soha,obyekt_turi,xona_turi,parametr,operator,qiymat_min,qiymat_max,birlik,jiddiylik,izoh,tasdiqlangan) select id,{q(band)},{q(soha)},{q(ob)},{q(xona)},{q(par)},{q(op)},{q(mi)},{q(ma)},{q(bi)},{q(ji)},{q(iz)},false from norma_manba where kod={q(mn)} and versiya='kitoblar';")
open(os.path.join(os.path.dirname(__file__),'..','seed_norma_qoidalari.sql'),'w',encoding='utf8').write('\n'.join(out)+'\n')
print(len(rows),'qoida')
