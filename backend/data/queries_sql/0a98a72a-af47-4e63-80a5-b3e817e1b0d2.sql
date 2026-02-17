

/*RECIBOS SOLO PT 360*/
-- SOLO EJECUTAR NO REQUIERE CONFIGURACION DE PARAMETROS
-- Nombre archivo ejemplo: LibroReciboCajaFeb2020_SoloPT360.xlsx

select rc.id_recibo_caja, rc.numero_recibo, rc.monto_recibo_cantidad, rc.monto_saldo_cantidad, 
       TO_CHAR(rc.fecha_recibo, 'dd-mm-yyyy') as fecha_Recibo,       
       cp.numero_poliza,
       dm.numero_certificado,
       TO_CHAR(dm.fecha_inicio_cobertura, 'dd-mm-yyyy') as fecha_inicio_cobertura,
       TO_CHAR(dm.fecha_fin_cobertura, 'dd-mm-yyyy') as fecha_fin_cobertura,
       ROW_NUMBER() OVER (PARTITION BY dm.id_cuenta_poliza ORDER BY rc.id_recibo_caja) NRO
from   SAMP.PLANILLA P
       inner join samp.detalle_movimiento dm on DM.ID_PLANILLA = P.ID_PLANILLA
       INNER JOIN samp.recibo_caja rc ON RC.ID_DETALLE_MOVIMIENTO = DM.ID_DETALLE_MOVIMIENTO
       inner join samp.cuenta_poliza cp on rc.id_cuenta_poliza = cp.id 
where  P.ORIGEN_RECAUDACION = 31 --> no tocar
       AND dm.id_cuenta_poliza = 2452456 --> no tocar
       and rc.estado = 1
       and rc.monto_saldo_cantidad>0
       ;
