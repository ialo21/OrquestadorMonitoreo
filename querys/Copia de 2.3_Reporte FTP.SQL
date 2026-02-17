--2.3_Reporte FTP.sql

/*  
INDICACIONES:

Solo ejecutar la consulta, no requiere fechas.
--FTP.xlsx

*/

select distinct dep.id_deposito, dep.fecha_registro, dep.descripcion, dep.monto_cantidad, dep.monto_moneda, dep.numero_operacion, dep.nombre_archivo, dep.estado_deposito
        ,rc.id_recibo_caja, rc.numero_recibo, rc.MONTO_RECIBO_CANTIDAD, rc.MONTO_SALDO_CANTIDAD
        ,coalesce(coalesce(p.id_planilla,p2.id_planilla),p3.id_planilla) id_planilla, coalesce(coalesce(p.fecha_planilla,p2.fecha_planilla),p3.fecha_planilla) fecha_planilla
from samp.deposito dep
join samp.producto_financiero pf on dep.id_producto_financiero = pf.id
left outer join samp.deposito_planilla depp on dep.id_deposito = depp.id_deposito
left outer join samp.planilla p on depp.id_planilla = p.id_planilla
left outer join samp.recibo_caja rc on dep.id_deposito = rc.id_deposito
left outer join samp.aplicacion_recibo_caja arc on rc.id_recibo_caja = arc.id_recibo_caja
left outer join samp.planilla p2 on arc.id_planilla_aplicado = p2.id_planilla
left outer join samp.detalle_planilla dp on arc.id_detalle_planilla_asociado = dp.id_detalle_planilla
left outer join samp.planilla p3 on dp.id_planilla = p3.id_planilla
where pf.numero = '0573000217794' order by dep.id_deposito asc;
