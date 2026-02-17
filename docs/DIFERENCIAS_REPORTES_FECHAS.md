# Diferencias entre reportes del orquestador y producción

## Resumen del análisis (Reporte Históricos Tarjetas – cierre diciembre)

- **Orquestador** (ejecución 17/02/2026): **85.473 filas** → `Reporte Históricos Tarjetas_20260217_111102.xlsx`
- **Producción** (archivo Dic 2025): **~91.466 filas** → `ReporteHistoricoTarjetas2018_Dic_2025.csv`
- **Diferencia**: ~6.000 filas menos en el orquestador.

---

## Cómo funciona el periodo de cierre en el orquestador

La query **Reporte Históricos Tarjetas** usa solo el placeholder **`{{FECHA_FIN}}`**:

- Condición en el SQL: `FECHA_CREACION >= 01/01/2018 AND FECHA_CREACION < {{FECHA_FIN}}`
- El orquestador reemplaza `{{FECHA_FIN}}` por el **primer día del mes siguiente** al periodo elegido:
  - **Cierre diciembre 2025** → periodo Diciembre 2025 → `FECHA_FIN = 01/01/2026` (incluye todo hasta el 31/12/2025).
  - Cierre noviembre 2025 → `FECHA_FIN = 01/12/2025` (excluye diciembre).

Si se elige un mes anterior al deseado (por ejemplo noviembre en lugar de diciembre), el resultado tendrá **menos filas** porque se corta antes.

---

## Causas probables de la diferencia

### 1. Periodo seleccionado distinto al esperado

- En el modal de ejecución el periodo por defecto es el **mes anterior** al actual.
- Si no se cambia y se ejecuta en febrero 2026, el valor por defecto sería **Enero 2026**, no Diciembre 2025.
- Para **cierre diciembre 2025** hay que elegir explícitamente **Diciembre 2025** en el selector de periodo.
- **Mejora aplicada**: desde ahora la ejecución guarda el **periodo usado** (`year`, `month`) en cada ejecución, para poder auditar qué fechas se usaron en cada corrida.

### 2. Base de datos distinta (UAT vs producción)

- En la ejecución del orquestador figura la base **"Alloy - DBIOP - UAT"**.
- Si el archivo de producción (`ReporteHistoricoTarjetas2018_Dic_2025.csv`) se generó contra **producción**, es normal que los totales no coincidan: UAT suele tener menos (o distintos) datos que producción.
- Para comparar “manzanas con manzanas”, hay que ejecutar el orquestador contra la **misma base** que la que usó el reporte de producción, o generar el de producción desde la misma BD que usa el orquestador.

### 3. Otras queries con fechas

- Cualquier query que use `{{FECHA_INICIO}}` o `{{FECHA_FIN}}` depende del periodo elegido en el modal.
- Misma lógica: **FECHA_INICIO** = primer día del mes del periodo, **FECHA_FIN** = primer día del mes siguiente (límite exclusivo).
- Revisar en cada SQL que los comparadores sean los correctos (por ejemplo `< FECHA_FIN` para no incluir el mes siguiente).

---

## Recomendaciones

1. **Comprobar el periodo antes de ejecutar**: Para un “cierre diciembre 2025”, elegir explícitamente **Diciembre 2025** en el selector.
2. **Auditar ejecuciones**: En el listado/detalle de ejecuciones se puede ver el **periodo** guardado en cada una (a partir del cambio reciente).
3. **Comparar misma base de datos**: Si se contrasta con un archivo de producción, asegurarse de que el orquestador esté apuntando a la misma BD (producción vs UAT).
4. **Re-ejecutar con periodo correcto**: Volver a lanzar el reporte con periodo **Diciembre 2025** y, si es posible, contra la misma BD que el reporte de producción, y comparar de nuevo filas y totales.
