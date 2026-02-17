

--2.7_Reporte Resumen Registro Ventas.sql

--en ASAR/Interseg

/*
INDICACIONES:
Este script se debe consultar en el servidor Asar BD Interseg.

PARÁMETROS DINÁMICOS:
{{FECHA_INICIO}} = Primer día del periodo seleccionado
{{FECHA_FIN}}    = Primer día del mes siguiente al periodo seleccionado
Formato SQL Server: YYYYMMDD
Ejemplo: Para el periodo Febrero 2024 → {{FECHA_INICIO}} = 20240201, {{FECHA_FIN}} = 20240301
*/

select  c.ASIENTO
    , sum(case when c.tipo = 'N/C' then -1 else 1 end * d.MONTO_LOCAL) total_soles
    , sum(case when c.tipo = 'N/C' then -1 else 1 end * d.MONTO_DOLAR) total_dolar
    , sum(case when c.tipo = 'N/C' then -1 else 1 end * case when c.MONEDA = 'SOL' then  d.IMPUESTO_1 else d.IMPUESTO_1 * d.TIPO_CAMBIO_SBS end) suma_igv_sol 
    , sum(case when c.tipo = 'N/C' then -1 else 1 end * case when c.MONEDA = 'DOL' then  d.IMPUESTO_1 else d.IMPUESTO_1 / d.TIPO_CAMBIO_SBS end) suma_igv_dol 
from interseg.comprobante c
inner join interseg.detalle_comprobante d on c.documento = d.documento
where c.asiento in 
(select distinct asiento from interseg.comprobante where fecha >= '{{FECHA_INICIO}}' and fecha < '{{FECHA_FIN}}') --de 1ro a 1ro segun periodo
group by c.asiento;
