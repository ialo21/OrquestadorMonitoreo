
-- RECIBOS SIN PT360
--2.1_Reporte libro Recibo Caja.sql

/*
  INDICACIONES:
  Nombre archivo ejemplo: LibroReciboCajaFeb2020_SIN_PT360.xlsx

  PARÁMETROS DINÁMICOS:
  {{FECHA_FIN}} = Primer día del mes siguiente al periodo seleccionado
  Formato PostgreSQL: dd/mm/yyyy
  Ejemplo: Para el periodo Febrero 2024 → {{FECHA_FIN}} = 01/03/2024
*/

with aplica_recibo as (
--ok
select arc.id_recibo_caja
, max(coalesce(coalesce(p.id_planilla,p2.id_planilla),detm.id_planilla)) id_planilla
, sum(arc.MONTO_APLICADO_CANTIDAD) monto_aplicado
, max(arc.fecha_aplicacion) fecha_aplicacion
  from SAMP.APLICACION_RECIBO_CAJA arc
    left outer join SAMP.planilla p on arc.id_planilla_aplicado = p.id_planilla and p.estado_planilla <> 3
    left outer join (
         select dp.id_detalle_planilla, dp.id_planilla 
         from   SAMP.detalle_planilla dp 
                join SAMP.planilla p on dp.id_planilla = p.id_planilla and p.estado_planilla <> 3
        ) p2 on arc.id_detalle_Planilla_asociado = p2.id_detalle_planilla
    left outer join (
         select id_recibo_caja, max(id_detalle_movimiento) id_det_mov 
         from   SAMP.aplicacion_recibo_caja 
         where  id_detalle_movimiento is not null group by id_recibo_caja
        ) ard on arc.id_recibo_caja = ard.id_recibo_caja
    left outer join (
         select dm.id_planilla, dm.id_detalle_movimiento 
         from   SAMP.detalle_movimiento dm 
                join SAMP.planilla p on dm.id_planilla = p.id_planilla 
         where  dm.estado <> 2 and p.estado_planilla <> 3 
         ) detm on ard.id_det_mov = detm.id_detalle_movimiento
    inner join SAMP.recibo_caja rc on arc.id_recibo_caja = rc.id_recibo_caja
    and arc.fecha_aplicacion < to_date('{{FECHA_FIN}}','dd/mm/yyyy')
    and rc.tipo_recibo <> 1
    and coalesce(coalesce(p.id_planilla,p2.id_planilla),detm.id_planilla) is not null
        group by arc.id_recibo_caja
        
union
  select rc.id_recibo_caja, max(id_planilla) id_planilla , sum(dm.monto_movi_cantidad) monto_aplicado
  , max(dm.fecha_aplicacion) fecha_aplicacion
  from SAMP.recibo_caja rc
    inner join SAMP.detalle_movimiento dm on rc.id_abono = dm.id_abono
      where dm.fecha_aplicacion < to_date('{{FECHA_FIN}}','dd/mm/yyyy')
      and rc.id_cuenta_poliza <> 2452456 --> no tocar
      and dm.TIPO_MOVIMIENTO = 1 and dm.estado = 1 and dm.fecha_aplicacion > rc.FECHA_RECIBO
            group by rc.id_recibo_caja
                                  
),
aplica_recibo_2 as (
select arc.id_recibo_caja
  , max(coalesce(coalesce(p.id_planilla,p2.id_planilla),detm.id_planilla)) id_planilla
  , sum(arc.MONTO_APLICADO_CANTIDAD) monto_aplicado
  , max(arc.fecha_aplicacion) fecha_aplicacion
    from SAMP.APLICACION_RECIBO_CAJA arc
      left outer join SAMP.planilla p on arc.id_planilla_aplicado = p.id_planilla and p.estado_planilla <> 3
      left outer join (select dp.id_detalle_planilla, dp.id_planilla from SAMP.detalle_planilla dp join SAMP.planilla p on dp.id_planilla = p.id_planilla and p.estado_planilla <> 3) p2 on arc.id_detalle_Planilla_asociado = p2.id_detalle_planilla
      left outer join (select id_recibo_caja, max(id_detalle_movimiento) id_det_mov from SAMP.aplicacion_recibo_caja where id_detalle_movimiento is not null group by id_recibo_caja) ard on arc.id_recibo_caja = ard.id_recibo_caja
      left outer join (select dm.id_planilla, dm.id_detalle_movimiento from SAMP.detalle_movimiento dm join SAMP.planilla p on dm.id_planilla = p.id_planilla where dm.estado <> 2 and p.estado_planilla <> 3 ) detm on ard.id_det_mov = detm.id_detalle_movimiento
      inner join SAMP.recibo_caja rc on arc.id_recibo_caja = rc.id_recibo_caja
      and arc.fecha_aplicacion >= to_date('{{FECHA_FIN}}','dd/mm/yyyy')
      and rc.tipo_recibo <> 1
      and coalesce(coalesce(p.id_planilla,p2.id_planilla),detm.id_planilla) is not null
          group by arc.id_recibo_caja
  union
    select rc.id_recibo_caja, max(id_planilla) id_planilla , sum(dm.monto_movi_cantidad) monto_aplicado
    , max(dm.fecha_aplicacion) fecha_aplicacion
    from SAMP.recibo_caja rc
      inner join SAMP.detalle_movimiento dm on rc.id_abono = dm.id_abono
        where dm.fecha_aplicacion >= to_date('{{FECHA_FIN}}','dd/mm/yyyy')
        and dm.TIPO_MOVIMIENTO = 1 
        and dm.id_cuenta_poliza <> 2452456 --> no tocar
        and dm.estado = 1 and dm.fecha_aplicacion > rc.FECHA_RECIBO
              group by rc.id_recibo_caja
),
recibo_padre as (
  select distinct rc.id_recibo_caja id_recibo_hijo, dm.observacion, p.modo_recaudacion, rc2.id_recibo_caja id_recibo_padre 
  from SAMP.recibo_caja rc
  inner join samp.detalle_movimiento dm on rc.id_detalle_movimiento = dm.id_detalle_movimiento
  inner join samp.planilla p on dm.id_planilla = p.id_planilla
  inner join samp.detalle_planilla detp on p.id_planilla = detp.id_planilla
  left outer join samp.aplicacion_recibo_caja arc1 on p.id_planilla = arc1.id_planilla_aplicado
  left outer join samp.aplicacion_recibo_caja arc2 on detp.id_detalle_planilla = arc2.id_detalle_planilla_asociado
  left outer join samp.recibo_caja rc2 on coalesce(arc1.id_recibo_caja, arc2.id_recibo_caja) = rc2.id_recibo_caja
  where rc.tipo_recibo = 1 and rc.estado = 1 and rc.monto_saldo_cantidad > 0
        and p.estado_planilla <> 3 and dm.estado = 1 and p.modo_recaudacion = 2
        and rc2.monto_saldo_cantidad > 0
        and rc2.estado = 1
        and rc.id_cuenta_poliza <> 2452456 --> no tocar
),
abono_mov_bancario as (
select distinct rc.id_recibo_caja, dm.observacion
, case when dm.observacion = 'Otros - ExcepcionCuentas' then 'POLIZA/PROPUESTA GENERICA VIDA INDIVIDUAL'
  else coalesce(rc.gls_ramo,'') || ' ' || coalesce(rc.gls_subramo,'') || ' ' || coalesce(rc.gls_producto,'') || ' ' || coalesce(vw.DESCRIPCIONACUERDO,'')
  end desc_producto from SAMP.recibo_caja rc
inner join SAMP.detalle_movimiento dm on rc.id_detalle_movimiento = dm.id_detalle_movimiento
left join SAMP.cuenta_Poliza cp on dm.id_cuenta_Poliza = cp.id
left join interseguro.view_acuerdos_samp vw on cp.numero_Poliza = vw.IDENTIFICADORACUERDO
where dm.tipo_movimiento <> 1 and dm.estado = 1
and   cp.id <> 2452456
),
gls_banco as (
select rc.id_recibo_caja, dep.descripcion from SAMP.recibo_caja rc join SAMP.deposito dep on rc.id_deposito = dep.id_deposito
),
num_imp_original as (
select rc.id_recibo_caja,
case when dm.numero_poliza_original is null or dm.numero_poliza_original = 0 then dm.numero_propuesta_original
  else dm.numero_poliza_original end num_imp_original
from SAMP.detalle_movimiento dm join SAMP.recibo_caja rc on dm.id_detalle_movimiento = rc.id_detalle_movimiento
where dm.id_cuenta_poliza in (1,2,3,4)
and rc.monto_saldo_cantidad > 0
)
      /*inicio de consulta*/
select q.* from (
select  tr.descripcion                  tipo_recibo
        , cc.codigo_transaccional     desc_contabilidad
        , cp.numero_propuesta
        , cp.numero_poliza
        , rc.ID_RECIBO_CAJA             cod_identificador
        , coalesce(rp.id_recibo_padre, rc.id_recibo_caja)            cod_identificador_madre
        , cc.centro_costo               centro_costo
        , cc.descripcion_centro_costo           linea_negocio
        , rc.numero_recibo            numero_recibo
        , conc.descripcion
        , to_char(rc.fecha_recibo,'DD/MM/YYYY')             fecha_recibo
        , to_char(rc.fecha_recibo,'YYYY')             anio
        , rc.CONTRATANTE              cliente
        , to_char(arec.fecha_aplicacion,'DD/MM/YYYY') fecha_ult_aplicacion
        , to_char(arec.fecha_aplicacion,'YYYY') anio_ult_aplicacion
        , rc.MONTO_RECIBO_MONEDA      recibo_moneda
        , rc.MONTO_RECIBO_CANTIDAD    recibo_monto_cantidad
        , coalesce(arec.monto_aplicado, coalesce(arec2.monto_aplicado,0)) recibo_monto_aplicado
        , case when rc.MONTO_SALDO_CANTIDAD <= rc.MONTO_RECIBO_CANTIDAD - coalesce(arec.monto_aplicado, coalesce(arec2.monto_aplicado,0))
               then rc.monto_saldo_cantidad else rc.MONTO_RECIBO_CANTIDAD - coalesce(arec.monto_aplicado, coalesce(arec2.monto_aplicado,0)) end recibo_saldo_calculado
        , rc.MONTO_SALDO_CANTIDAD recibo_saldo_final
        , CASE WHEN (rc.monto_recibo_moneda = 'PEN')
          then rc.MONTO_SALDO_CANTIDAD
            else rc.MONTO_SALDO_CANTIDAD * 3.345 end recibo_monto_saldo_origen
        , mr.descripcion        modo_recaudacion
        , ori.descripcion      origen_recaudacion
        , rc.usuario_creacion  usuario
        , conc.numero_abono
        , dep.fecha_registro fecha_abono_banc
        , dep.monto_moneda moneda_abono_banc
        , dep.monto_cantidad importe_abono_banc
        , cta.numero_exactus cta_cte_abono_banc
        , nio.num_imp_original numero_original
        , amb.observacion tipo_movimiento
        , amb.desc_producto producto
        , gb.descripcion gls_abono_bancario
        , rc.fecha_modificacion
from SAMP.recibo_caja rc
left outer join (
     select id_abono, a.numero_abono, cc.descripcion  
     from   SAMP.abono a 
            join samp.concepto_cobranza cc on a.cod_concepto_abono = cc.codigo
     where  a.id_cuenta_poliza<> 2452456 --> no tocar
  ) conc on rc.id_abono = conc.id_abono
left outer join recibo_padre rp on rc.id_recibo_caja = rp.id_recibo_hijo
inner join samp.tipo_recibo_caja tr on rc.TIPO_RECIBO = tr.ID
left outer join samp.cuenta_poliza cp on rc.id_cuenta_poliza = cp.id and cp.id<>2452456 --> no tocar
left outer join aplica_recibo arec on rc.id_recibo_caja = arec.id_recibo_caja
left outer join aplica_recibo_2 arec2 on rc.id_recibo_caja = arec2.id_recibo_caja
left outer join samp.planilla p on arec.id_planilla = p.id_planilla and p.estado_planilla <> 3
left outer join samp.modo_recaudacion mr on p.modo_recaudacion = mr.id_modo_recaudacion
left outer join samp.origen_recaudacion_planilla ori on p.origen_recaudacion = ori.id_origen_reca_planilla
left outer join (select dr.id_planilla,  coalesce(max(dr.id_cencto_codtransac),0) id_cencto_codtransac
                  from SAMP.diario_recaudacion dr
                  inner join SAMP.cencto_codtransac cen on dr.ID_CENCTO_CODTRANSAC = cen.ID_CENCTO_CODTRANSAC
                  where dr.estado_detalle = 2 group by id_planilla
                  ) cenrec on p.id_planilla = cenrec.id_planilla
left outer join (select dr.id_planilla,  coalesce(max(dr.id_cencto_codtransac),0) id_cencto_codtransac
                  from SAMP.diario_recaudacion_ventas dr
                  inner join SAMP.cencto_codtransac cen on dr.ID_CENCTO_CODTRANSAC = cen.ID_CENCTO_CODTRANSAC
                  where dr.estado_detalle = 2  group by id_planilla
                  ) cenapl on p.id_planilla = cenapl.id_planilla
left outer join samp.cencto_codtransac cc on coalesce(cenrec.id_cencto_codtransac,cenapl.id_cencto_codtransac) = cc.id_cencto_codtransac
left outer join abono_mov_bancario amb on rc.id_recibo_caja = amb.id_recibo_caja
left outer join gls_banco gb on rc.id_recibo_caja = gb.id_recibo_caja
left outer join samp.deposito dep on rc.id_deposito = dep.id_deposito
left outer join samp.producto_financiero pf on dep.id_producto_financiero = pf.id
left outer join samp.ctafin_extra cta on pf.numero = cta.numero_samp
left outer join num_imp_original nio on rc.id_recibo_caja = nio.id_recibo_caja
where
coalesce(rc.id_cuenta_poliza,0) <> 2452456 --> no tocar
and rc.MONTO_SALDO_CANTIDAD > 0
and rc.id_recibo_caja not in
(select rc.id_recibo_caja
        from SAMP.detalle_movimiento dm
             join SAMP.recibo_caja rc on dm.id_abono = rc.id_abono
                  where dm.tipo_detalle = 99 or rc.estado <> 1
union select rc.id_recibo_caja
             from samp.recibo_caja rc
                  left outer join samp.aplicacion_recibo_caja arc on rc.id_recibo_caja = arc.id_recibo_caja
                       where (rc.monto_saldo_cantidad = 0 and arc.id_aplicacion_recibo is null))
and rc.estado = 1
and rc.tipo_recibo <> 4

) q where
((
  q.recibo_saldo_calculado > 0)
or (q.recibo_saldo_final > 0));
