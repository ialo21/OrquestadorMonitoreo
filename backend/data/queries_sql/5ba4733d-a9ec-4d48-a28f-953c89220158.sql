--2.5_Reporte Facturas No Pago.sql

/* 
DetalleNoPagoFebrero2020.xlsx

INDICACIONES:
Este reporte contiene un resumen y detalle (2 consultas).
La fecha 01/01/2013 es fija y no cambia.

PARÁMETROS DINÁMICOS:
{{FECHA_INICIO}} = Primer día del periodo seleccionado
{{FECHA_FIN}}    = Primer día del mes siguiente al periodo seleccionado
Formato PostgreSQL: dd/mm/yyyy
Ejemplo: Para el periodo Febrero 2024 → {{FECHA_INICIO}} = 01/02/2024, {{FECHA_FIN}} = 01/03/2024
*/

with pago_ant as (select id_comprobante, sum(monto_movi_cantidad)  monto_aplicado from (
select distinct dm.id_detalle_movimiento, c.id_comprobante, dm.monto_movi_cantidad
     from samp.detalle_movimiento dm
          left outer join samp.abo_car_dev_col acdc on dm.id_abono = acdc.id_abono and acdc.estado = 1
          inner join samp.comprobante c on dm.id_comprobante = c.id_comprobante
          inner join samp.planilla p on dm.id_planilla = p.id_planilla
          where dm.tipo_movimiento = 1 and dm.tipo_detalle = 17 and p.estado_planilla <> 3
          and dm.fecha_aplicacion >= to_date('01/01/2013','dd/mm/yyyy') -- no tocar: esta fecha se queda tal cual
          and dm.fecha_aplicacion < to_date('{{FECHA_INICIO}}','dd/mm/yyyy') and dm.estado = 1 ) q
          group by q.id_comprobante
          ),
pago_durante as (
select id_comprobante, sum(monto_movi_cantidad)  monto_aplicado from (
select distinct dm.id_detalle_movimiento, c.id_comprobante, dm.monto_movi_cantidad
     from samp.detalle_movimiento dm
          left outer join samp.abo_car_dev_col acdc on dm.id_abono = acdc.id_abono and acdc.estado = 1
          inner join samp.comprobante c on dm.id_comprobante = c.id_comprobante
          inner join samp.planilla p on dm.id_planilla = p.id_planilla
          where dm.tipo_movimiento = 1 and dm.tipo_detalle = 17 and p.estado_planilla <> 3
          and dm.fecha_aplicacion >= to_date('{{FECHA_INICIO}}','dd/mm/yyyy')
          and dm.fecha_aplicacion < to_date('{{FECHA_FIN}}','dd/mm/yyyy')
          and dm.estado = 1 ) q
          group by q.id_comprobante

)
-- SHEET: width
select distinct   c.id_comprobante
  , c.serie_comprobante || '-' || c.num_comprobante documento
  , c.num_poliza
  , c.afecto
  , c.no_afecto
  , c.impuesto
  , c.total
  , c.total - coalesce(pa.monto_aplicado,0) saldo_inicial
  , c.total - (coalesce(pa.monto_aplicado,0) + coalesce(pd.monto_aplicado,0)) saldo_final
  , c.fecha_creacion
  , c.cod_ramo
  , c.cod_subramo
  , c.cod_producto
  , c.asiento
from samp.detalle_movimiento dm
  inner join samp.planilla p on dm.id_planilla = p.id_planilla
  and p.origen_recaudacion = 19 and p.estado_planilla <> 3
  inner join samp.comprobante c on p.id_planilla = c.id_planilla
  left outer join pago_ant pa on c.id_comprobante = pa.id_comprobante
  left outer join pago_durante pd on c.id_comprobante = pd.id_comprobante
  where dm.tipo_movimiento = 1
  and dm.tipo_detalle = 16
  and dm.estado = 1
  and c.cod_estado <> 3
  and p.fecha_creacion < to_date('{{FECHA_FIN}}','dd/mm/yyyy')
and c.asiento is not null
  order by c.id_comprobante asc;

-- SHEET: detalle
select    c.id_comprobante
                , cc.numero_poliza
                , cc.numero_certificado
                , cc.prima_cantidad
                , sum(case when vw.detalle = 'DetPriNeta' then vw.valor
                        when vw.detalle = 'DetIGV' then 0
                        when vw.detalle = 'DetGasEmis' then 0 end )     DetPriNeta

                , sum(case when vw.detalle = 'DetPriNeta' then 0
                        when vw.detalle = 'DetIGV' then vw.valor
                        when vw.detalle = 'DetGasEmis' then 0 end )     DetIGV

                , sum(case when vw.detalle = 'DetPriNeta' then 0
                        when vw.detalle = 'DetIGV' then 0
                        when vw.detalle = 'DetGasEmis' then vw.valor end )     DetGasEmis

                , cc.estado_cargo_colectivo
                , cc.estado_openitem
                , cc.estado_certificado
                , cc.id_open_item
                from samp.detalle_movimiento dm
                  inner join samp.abo_car_dev_col acdc on dm.id_abono = acdc.id_abono and acdc.estado = 1
                  inner join samp.cargo_colectivo cc on acdc.id_car_col = cc.id_cargo_colectivo
                  inner join samp.comprobante c on cc.id_comprobante_asociado = c.id_comprobante
                  inner join samp.planilla p on dm.id_planilla = p.id_planilla
                  left outer join interseguro.view_openitemdetails_samp vw on cc.id_open_item = vw.OPENITEMID
                  where dm.tipo_movimiento = 1
                  and dm.tipo_detalle = 17
                  and dm.fecha_aplicacion >= to_date('{{FECHA_INICIO}}','dd/mm/yyyy')
                  and dm.fecha_aplicacion < to_date('{{FECHA_FIN}}','dd/mm/yyyy')
                  and dm.estado = 1
                  and p.estado_planilla <> 3
                  group by c.id_comprobante
                , cc.numero_poliza
                , cc.numero_certificado
                , cc.prima_cantidad
                , cc.estado_cargo_colectivo
                , cc.estado_openitem
                , cc.estado_certificado
                , cc.id_open_item;
