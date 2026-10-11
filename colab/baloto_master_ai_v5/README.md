# 🎯 Baloto Master AI v5.0: auditoría, refactorización y guía para Colab

> **Origen:** `copia_de_copia_de_copia_de_copia_de_copia_de_baloto_master_ai_v4_0.py` (15.918 líneas, 698 KB, exportado desde Colab).
> **Resultado:** un motor modular de **~625 líneas** en 12 celdas, probado de principio a fin (0 errores, 4 gráficos).

| Archivo | Uso |
|---|---|
| `Baloto_Master_AI_v5.ipynb` | Notebook listo para abrir en Colab |
| `baloto_master_ai_v5.py` | El mismo código como script (sirve para `%run` o para importarlo como módulo) |

[![Abrir en Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/DrVivasMachado2/awesome-notebookLM-prompts/blob/claude/focused-hopper-0boppn/colab/baloto_master_ai_v5/Baloto_Master_AI_v5.ipynb)

---

## 1. Diagnóstico: errores encontrados en la v4.0

### 🔴 Críticos (corrompen los datos o engañan al usuario)

| # | Error | Dónde (línea en el .py original) | Impacto | Corrección en la v5 |
|---|---|---|---|---|
| 1 | **Datos inventados como "oficiales":** cuando el OCR falla, el código genera balotas al azar y las **inyecta en el histórico** como resultado real | 235, 390, 708, 808, 2435, 6243, 7676, 8134, 8950, 9078, 15619… | Contamina todo el análisis posterior | `extraer_numeros_ocr()` solo **propone** candidatos. El sorteo se registra a mano con `registrar_sorteo()`, que lo valida |
| 2 | **Histórico aleatorio de respaldo:** si no hay datos reales, se crea `df_base_v4` con `np.random.randint` (y la SB también) sin avisar | 195, 14776, 14904, 5100, 8712 | Las conclusiones salen de ruido | Sin datos el script **se detiene con un error claro**. El modo demo es explícito y queda marcado como `sintetico` |
| 3 | **"Confianza IA (%)" ficticia:** `94.2 - i*3.1 + ruido`, un valor fijo que no sale de ningún cálculo | 186, 809, 1433 … 14896, 15585 (20 copias) | Sugiere una precisión que no existe | Eliminada. Cada ticket muestra métricas reales: suma, rango, pares y método |
| 4 | **"Markov" y "covarianza" vacíos:** `_generar_historico_vectorizado` y `_analisis_covarianza_multivariada` son `pass`, y `cov_matrix` es la identidad, así que el ajuste de la SB por covarianza **siempre vale 0** | 124-126, 14889-14890 | Los nombres prometen modelos que no se ejecutan | Matriz de transición de **Markov 43×43 real**, vectorizada y con suavizado de Laplace. Su peso en la mezcla se controla con `peso_markov` |
| 5 | **Pesos que se acumulan:** `prob_weights` se modifica sobre sí mismo y nunca vuelve a uniforme, así que cada recalibración multiplica sobre la anterior | 137-148, 158-174 | Resultados distintos según cuántas veces ejecutes la celda | `_pesos_desde_matriz()` es una **función pura** que siempre parte de pesos uniformes |
| 6 | **Comparativa de ROI sin sentido:** el respaldo `np.mean(prob_weights)*1000-100` da siempre lo mismo (1/43 → −76,74 %) para cualquier configuración | 15745-15746 | "0,15 vs 0,05" sale idéntico por construcción | Backtest *walk-forward* real contra azar, con prueba pareada |
| 7 | **Súper balota sesgada:** se genera con `Normal(8.5, 1.5)` recortada, lo que concentra los valores en 6-11 | 185, 14895 | Nunca o casi nunca propone 1-3 ni 14-16 | Uniforme 1..16 |

### 🟠 Graves (seguridad, estabilidad, arquitectura)

| # | Error | Dónde | Corrección |
|---|---|---|---|
| 8 | El archivo **no es Python válido**: hay markdown pegado como código. La primera línea que rompe el parseo es la 38, y el bloque problemático va de la 10 a la 78 | 10-78 | Las notas van en celdas markdown |
| 9 | `eval()` sobre texto: riesgo de **inyección de código** | 313, 8967 | `ast.literal_eval()` |
| 10 | **10 copias** de `BalotoMasterEngineBase` y de `TendenciaReciente`, 41 clases en total, y el patrón `if 'X' not in globals()` | todo el archivo | Una sola definición por componente |
| 11 | 40 `!apt-get`/`!pip install` repetidos | todo el archivo | Una celda 0 opcional (`INSTALAR_OCR`) |
| 12 | `pickle.dump(motor)`: frágil entre versiones y riesgoso de cargar | 2502, 8677, 13978, 14078, 14600, 15803 | CSV para el histórico y JSON para la configuración |
| 13 | `runtime.unassign()` **apaga la sesión** de forma automática | 12755, 12864, 14618, 15827 | Eliminado |
| 14 | OCR: `dict.fromkeys` borra la SB cuando coincide con una balota principal, y la fecha de la imagen ("26-9-2026") se cuela como números | 222, 15606 | Se filtran las fechas y se conservan los duplicados legítimos |
| 15 | Mezcla de **Baloto y Revancha** en un mismo histórico (la columna "Revancha" contiene la SB) | 395 | Parámetro `JUEGO` y columna `Juego`: los análisis se hacen por separado |
| 16 | 46 llamadas a `np.random.seed()` globales | todo el archivo | `np.random.default_rng(semilla)` local, reproducible |
| 17 | Puente HTML/JS que parsea `text/plain` con expresiones regulares | 15137 | Panel con `ipywidgets`, nativo de Colab |
| 18 | `pd.to_datetime(DataFrame)` sobre `/tmp/date.csv`, un resto de pruebas | 15434-15437 | Eliminado |

---

## 2. Arquitectura v5

```
Celda 0  Instalación opcional (OCR)
Celda 1  ConfigMotor (dataclass inmutable y validada) + constantes
Celda 2  Datos      → cargar_historico() → validar_historico()   [sin rellenos]
Celda 3  Estadística → frecuencias + IC95 Wilson, χ², vacíos, Markov 43×43
Celda 4  Motor      → _pesos_desde_matriz()  (función pura)
Celda 5  Generador  → generar_combinaciones()  (ticket 1 = azar puro, línea base)
Celda 6  Validación → backtest_walk_forward()  (sin fuga de datos futuros)
Celda 7  OCR        → extraer_numeros_ocr() → verificación humana → registrar_sorteo()
Celda 8  Gráficos   → tema oscuro (frecuencias, Markov, vacíos, backtest)
Celda 9  Persistencia (CSV/JSON, Drive opcional) + panel ipywidgets
Celda 10 main()     → orquesta todo y devuelve un dict con los resultados
```

**Principios aplicados:** funciones puras y testeables, cero estado global oculto, validación en la entrada, configuración centralizada, reproducibilidad (semillas locales) y separación datos → modelo → presentación.

### Formato del CSV de entrada

```csv
Fecha,Juego,B1,B2,B3,B4,B5,SB
04/10/2026,Baloto,3,11,24,30,41,7
04/10/2026,Revancha,5,9,17,28,39,12
```

`Fecha` y `Juego` son opcionales. Se aceptan alias como `b1`, `superbalota` o `súper balota`. Las balotas desordenadas se ordenan solas, y las filas inválidas se descartan y se cuentan en el reporte.

---

## 3. 🚀 Orden práctica para ingresar a Colab

### Opción A: un clic (recomendada)
1. Pulsa el botón **"Abrir en Colab"** de arriba.
2. **Entorno de ejecución → Ejecutar todas** (`Ctrl+F9`).
3. Cuando aparezca el diálogo, sube tu CSV oficial. Para solo probar el código, cambia `MODO_DEMO = True` en la celda 10.

### Opción B: tu notebook actual
1. Crea un notebook nuevo. No sigas sobre la "Copia de Copia de…", porque arrastra estado viejo.
2. Sube `baloto_master_ai_v5.py` al panel 📁 de Colab.
3. En una celda:
   ```python
   %run baloto_master_ai_v5.py
   ```

### Uso diario (después de cada sorteo)
```python
r = main(ruta_csv="/content/historico_validado.csv", juego="Baloto")

# Nuevo resultado, verificado a ojo contra la imagen oficial:
candidatos = extraer_numeros_ocr("/content/resultado.png")   # solo propone
df = registrar_sorteo(r["df"], [3, 11, 24, 30, 41], sb=7, fecha="11/10/2026", juego="Baloto")
guardar_estado(df, CONFIG, usar_drive=True)
```

### 🤖 Prompt para pegar en Gemini (panel de Colab)

> Actúa como ingeniero de software senior en Python. Este notebook ya está refactorizado (Baloto Master AI v5). Reglas obligatorias para cualquier cambio:
> 1. **No inventes datos.** Si falta el histórico o el OCR falla, detén la ejecución con un error claro. Nunca uses `np.random` para rellenar resultados reales.
> 2. **No redefinas clases ni funciones** que ya existen. Modifica la función original en su celda (celdas 1-9).
> 3. Mantén las funciones **puras**: reciben `df` y `cfg` y devuelven resultados, sin `global` ni `if 'x' in globals()`.
> 4. Usa `np.random.default_rng(semilla)`, nunca `np.random.seed()`.
> 5. Prohibido mostrar "confianza", "asertividad", "probabilidad de ganar" o un ROI positivo. Todas las combinaciones tienen probabilidad 1/15.401.568.
> 6. Cualquier "mejora" del motor debe validarse con `backtest_walk_forward()` contra azar y reportar el p-valor. Si p ≥ 0,05, dilo explícitamente.
> 7. Nada de `eval`, `pickle` ni `runtime.unassign()`.
>
> Tarea: [describe aquí el cambio puntual].

---

## 4. Lectura honesta de los resultados

- **Probabilidad del premio mayor:** C(43,5) × 16 = **15.401.568** combinaciones. Todas son igual de probables.
- **Aciertos esperados por ticket al azar:** 5×5/43 = **0,581**. En la prueba con 400 sorteos y 10 tickets por sorteo, el motor obtuvo 0,585 y el azar 0,572, con **p = 0,45**: no hay diferencia significativa.
- La prueba anterior usó datos sintéticos uniformes, así que solo demuestra que el backtest funciona. **Ejecútalo con el histórico oficial real:** es la forma científica de evaluar cualquier ajuste de parámetros.
- La "penalización al último sorteo" y los "números calientes/tibios" se conservan como **estrategia lúdica configurable**, no como ventaja predictiva (falacia del jugador: Tversky & Kahneman, *Science* 1974; DOI: 10.1126/science.185.4157.1124).

### ✅ Checklist final
- [ ] Usar solo el CSV oficial (sin filas creadas por OCR automático)
- [ ] Analizar Baloto y Revancha por separado (`JUEGO`)
- [ ] Revisar el reporte de validación (filas inválidas, reordenadas, duplicadas)
- [ ] Ejecutar el backtest antes de "optimizar" parámetros
- [ ] Guardar el estado en Drive (CSV + JSON)
- [ ] Jugar con un presupuesto fijo. Juego responsable, +18
