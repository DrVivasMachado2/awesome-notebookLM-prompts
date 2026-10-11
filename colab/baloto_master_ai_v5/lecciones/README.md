# 📒 Bitácora del curso · Baloto Master AI v5

Guía para retomar el trabajo en cualquier sesión nueva (Claude, Gemini o tú mismo).
Pega este archivo al inicio de la conversación y di: "continuemos desde la bitácora".

## Estado actual (2026-10-11)

| Lección | Tema | Archivo | Estado |
|---|---|---|---|
| 0 | Auditoría y refactorización de la v4 → v5 | `../README.md`, `../baloto_master_ai_v5.py` | ✅ Probada de extremo a extremo |
| 1 | De la captura de baloto.com al CSV validado | `leccion_01_datos.py`, `historico_semilla.csv` | ✅ Probada (10 sorteos reales) |
| 2 | Scraper de las 127 páginas (`requests` + patrones) | `leccion_02_scraper.py` | ✅ Parser probado con HTML simulado; **pendiente verificar contra la web real en Colab** |
| 2b | Respaldo Selenium para páginas con JavaScript | `leccion_02b_selenium.py` | ⚠️ Compila; el navegador solo puede probarse en Colab |
| 3 | Frecuencias e intervalos de confianza | — | ⏳ Siguiente |
| 4 | Test χ² explicado con dados | — | ⏳ |
| 5 | Markov 43×43: qué es y qué NO puede hacer | — | ⏳ |
| 6 | Backtesting honesto | — | ⏳ |

## Próximo paso concreto

1. En Colab, ejecutar la orden para Gemini de la lección 2b (verificar página 1 de baloto.com).
2. Obtener `historico_baloto_com.csv` (~635 sorteos por juego) y validarlo con `validar_historico(df, juego=...)`.
3. Con ese CSV, empezar la Lección 3.

## Reglas del curso (no negociables)

- Nunca rellenar datos faltantes con `np.random`; sin datos, el código se detiene con error.
- Baloto y Revancha se analizan por separado (`juego=`).
- Nada de "confianza %", "probabilidad de ganar" ni ROI positivo: P(premio mayor) = 1 / 15.401.568 para toda combinación.
- Toda "mejora" del motor se valida con `backtest_walk_forward()` y se reporta el p-valor.
- Lenguaje accesible, código funcional explicado línea por línea y un checklist de buena práctica por lección.
