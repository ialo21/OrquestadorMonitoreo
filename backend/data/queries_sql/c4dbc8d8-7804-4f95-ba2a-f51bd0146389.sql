
--2.2_Reporte Históricos Tarjetas.sql

/*
INDICACIONES:
Si el periodo de ejecución fuera Enero la fecha sería 01/02/2020 - Reemplazar la fecha actual por la que
sería acorde al periodo de ejecución. La fecha 01/01/2018 se queda de esta forma debido a que los usuarios 
requieren saber lo pendiente desde esa fecha hasta el último mes del periodo.
--ReporteHistoricoTarjetas2018_2020.xlsx

*/

with diario_1 as (select distinct asiento_samp,id_deposito,numero_cuenta from samp.DIARIO_RECAUDACION
          where estado_detalle = 2 and id_deposito is not null),
     diario_2 as (select distinct asiento_samp,numero_recibo,numero_cuenta from samp.DIARIO_RECAUDACION
          where estado_detalle = 2 and numero_recibo is not null)
select distinct
      dp.id_detalle_planilla
      , p.ID_PLANILLA
      , via.nombre "Operadora"
      ,TO_CHAR(p.FECHA_CREACION,'DD/MM/YYYY') "Fecha de Creación"
      , estp.descripcion  "Estado planilla"
      ,p.total_moneda  "M.O. Planilla"
      ,p.TOTAL_CANTIDAD "Monto planilla M.O."
      ,case when p.total_moneda = 'PEN' then p.TOTAL_CANTIDAD else p.total_cantidad * a.valor_moneda_origen END "Monto planilla S/."
      , case when cp.numero_poliza is null or cp.numero_poliza <= 0 then cp.numero_propuesta else cp.numero_poliza end "POLIZA PROPUESTA/ POLIZA"
      , a.monto_origen_moneda  "Moneda Desglose planilla"
      , a.monto_origen_cantidad "Importe M.O. Desglose planilla"
      , CASE WHEN a.monto_origen_moneda = 'USD' THEN a.valor_soles_abono ELSE a.monto_origen_cantidad END "Importe S/. Desglose planilla"
      ,TO_CHAR(p.FECHA_PLANILLA,'DD/MM/YYYY') "Fecha de operación"
      ,TO_CHAR(p.FECHA_CREACION,'YYYY') "Año de Creación"
      ,p.DESCRIPCION "Concepto"
      ,null ASIENTO_EXACTUS
      ,m.DESCRIPCION "Modo Recaudación"
      ,o.Descripcion "Origen Recaudación"
      ,null "Fecha Asociación"
      ,null "Id Deposito"
      ,null "Monto depósito"
      ,null "Numero Cuenta"
      ,null BANCO
      ,null DESCRIPCION
      ,null "Fecha depósito"
      from samp.PLANILLA p
          join samp.MODO_RECAUDACION m on p.MODO_RECAUDACION = m.ID_MODO_RECAUDACION
          join samp.ORIGEN_RECAUDACION_PLANILLA o on p.ORIGEN_RECAUDACION = o.ID_ORIGEN_RECA_PLANILLA
          join samp.DETALLE_PLANILLA dp on p.ID_PLANILLA = dp.ID_PLANILLA
          inner join SAMP.ESTADO_PLANILLA estp on p.estado_planilla = estp.ID
          left outer join samp.abono a on dp.id_abono = a.id_abono
          left outer join samp.cuenta_poliza cp on a.id_cuenta_poliza = cp.id
          left outer join samp.pre_planilla pre on pre.id_planilla = p.id_planilla
          left outer join samp.via_cobro via on coalesce(pre.id_via_cobro, p.id_via_cobro) = via.id
          where (p.FECHA_CREACION >= To_date('01/01/2018','dd/mm/yyyy') --> no tocar esta fecha se mantiene
          AND p.FECHA_CREACION < To_date('01/01/2026','dd/mm/yyyy')) --Solo cambia esta fecha
          AND ( p.ORIGEN_RECAUDACION in (7, 4, 11, 15) AND P.ESTADO_PLANILLA not in (3,5)
          or (p.origen_recaudacion = 2 and p.modo_recaudacion = 0 AND P.ESTADO_PLANILLA not in (3,5)));
