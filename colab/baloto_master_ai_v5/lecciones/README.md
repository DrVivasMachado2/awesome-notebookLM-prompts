# 📒 Bitácora del curso · Baloto Master AI v5

Guía para retomar el trabajo en cualquier sesión nueva (Claude, Gemini o tú mismo).
Pega este archivo al inicio de la conversación y di: "continuemos desde la bitácora".

## Estado actual (2026-10-11)

| Lección | Tema | Archivo | Estado |
|---|---|---|---|
| 0 | Auditoría y refactorización de la v4 → v5 | `../README.md`, `../baloto_master_ai_v5.py` | ✅ Probada de extremo a extremo |
| 1 | De la captura de baloto.com al CSV validado | `leccion_01_datos.py`, `historico_semilla.csv` | ✅ Probada (20 sorteos reales, 19-sep → 10-oct 2026) |
| 2 | Scraper de las 127 páginas (`requests` + patrones) | `leccion_02_scraper.py` | ✅ Parser probado con HTML simulado; **pendiente verificar contra la web real en Colab** |
| 2b | Respaldo Selenium para páginas con JavaScript | `leccion_02b_selenium.py` | ⚠️ Compila; el navegador solo puede probarse en Colab |
| 3 | Frecuencias, IC de Wilson, simulación del máximo y tamaño muestral | `leccion_03_frecuencias.py` | ✅ Probada con datos reales |
| 4 | Test χ² explicado con dados (por qué p=0,007 con n=10 no significa nada) | — | ⏳ Siguiente |
| 5 | Markov 43×43: qué es y qué NO puede hacer | — | ⏳ |
| 6 | Backtesting honesto | — | ⏳ |

## Próximo paso concreto

1. Pendiente: ejecutar en Colab la orden para Gemini de la lección 2b (verificar el scraper contra baloto.com) y obtener `historico_baloto_com.csv` (~635 sorteos por juego).
2. Lección 4: test χ² explicado con dados, usando la SB de Baloto (p=0,007 con n=10) como ejemplo de test fuera de su rango de validez.
3. Tiquetes del 26-sep-2026 (S2714) ya verificados: T1 0/1 aciertos, T2 1, T3 2 en Revancha; sin premio.

## Reglas del curso (no negociables)

- Nunca rellenar datos faltantes con `np.random`; sin datos, el código se detiene con error.
- Baloto y Revancha se analizan por separado (`juego=`).
- Nada de "confianza %", "probabilidad de ganar" ni ROI positivo: P(premio mayor) = 1 / 15.401.568 para toda combinación.
- Toda "mejora" del motor se valida con `backtest_walk_forward()` y se reporta el p-valor.
- Lenguaje accesible, código funcional explicado línea por línea y un checklist de buena práctica por lección.
