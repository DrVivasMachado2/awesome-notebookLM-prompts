# Baloto Master AI · Design System

Glassmorphism oscuro, **cian neón para los datos** y **oro para los premios**, listo para usar en **Google Colab**, **Jupyter** y **Visual Studio Code**.

Guía visual completa (tokens, componentes y reglas de uso): artefacto *Baloto Master AI* en claude.ai.

[![Abrir en Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/DrVivasMachado2/awesome-notebookLM-prompts/blob/claude/design-system-extraction-auyjde/design-system/Baloto_Design_System_Demo.ipynb)

## Contenido

| Archivo | Qué es |
| --- | --- |
| `tokens.json` | **Fuente única**: colores (temas Oscuro y Alto contraste), tipografía, espaciado, radios, sombras. |
| `tokens.css` | Variables CSS generadas (`--primary-container`, `--space-4`…). No editar a mano. |
| `bundle.css` | Estilos de los componentes (balotas, tickets, paneles glass, botones…). |
| `baloto_ds.py` | Módulo Python: pinta componentes en notebooks y aplica el estilo a matplotlib. |
| `baloto-dark.mplstyle`, `baloto-high-contrast.mplstyle` | Estilos de matplotlib/seaborn generados. |
| `Baloto_Design_System_Demo.ipynb` | Notebook de demostración (Colab / VS Code). |
| `vscode-theme/` | Extensión de VS Code: 2 temas de color + snippets, empaquetada en `.vsix`. |
| `build_tokens.py` | Regenera `tokens.css` y los `.mplstyle` desde `tokens.json`. |

## Google Colab

**Opción A — notebook de demostración:** pulsa el botón *Abrir en Colab* de arriba y ejecuta las celdas.

**Opción B — en tus notebooks Baloto Master AI:** añade esta celda al inicio:

```python
import os, sys, urllib.request
RAMA = "claude/design-system-extraction-auyjde"   # "main" cuando se fusione
os.makedirs("/content/design-system", exist_ok=True)
for f in ["baloto_ds.py", "tokens.json", "tokens.css", "bundle.css",
          "baloto-dark.mplstyle", "baloto-high-contrast.mplstyle"]:
    urllib.request.urlretrieve(
        f"https://raw.githubusercontent.com/DrVivasMachado2/awesome-notebookLM-prompts/{RAMA}/design-system/{f}",
        f"/content/design-system/{f}")
sys.path.insert(0, "/content/design-system")
import baloto_ds as bm
bm.estilo_graficos()          # matplotlib/seaborn con la paleta del sistema
```

Luego usa los componentes donde antes escribías HTML a mano:

```python
bm.mostrar(
    bm.combinaciones([([4, 17, 22, 35, 41], 13, 94.2), ([9, 12, 28, 33, 43], 7, 91.8)]),
    bm.tickets([bm.ticket("TICKET 1", [4, 17, 22, 35, 41], 13, insignia="Premio $12.500M")]),
    bm.aviso(),                # obligatorio con combinaciones o probabilidades
)
bm.mostrar(bm.aviso(), tema="high-contrast")   # versión WCAG AAA
```

| Función | Componente |
| --- | --- |
| `combinacion()`, `combinaciones()` | CombinationRow (hasta 3, ordenadas por confianza) |
| `ticket()`, `tickets()` | TicketCard (`v4=True` para la variante Quantum) |
| `balotas()` | Balota (`variante="ticket" \| "panel" \| "resultado" \| "v4"`) |
| `panel()` | GlassPanel |
| `estadistica()`, `estadisticas()` | StatTile |
| `chips()` | NumberChip ("Números Calientes") |
| `barra_superior()` | TopAppBar |
| `boton()` | Button (`tipo="master" \| "cuantico" \| "fantasma" \| "v4"`) |
| `consola()` | ResultsConsole |
| `aviso()` | Disclaimer de juego responsable |
| `color(nombre, tema)` | Valor hex de un token (para Plotly, seaborn, tablas) |

> Cada salida de Colab es un iframe aislado: `bm.mostrar()` incluye los estilos en cada celda. Las fuentes (Inter, Orbitron, Material Symbols) se cargan desde Google Fonts y necesitan conexión a internet.

## Visual Studio Code

1. **Tema:** `Ctrl/Cmd + Shift + P` → *Extensions: Install from VSIX…* → `design-system/vscode-theme/baloto-master-ai-theme-1.0.0.vsix`. Después, `Ctrl/Cmd + K` y `Ctrl/Cmd + T` → **Baloto Master AI** o **Baloto Master AI · Alto contraste**.
2. **Notebooks:** abre la carpeta del repositorio y abre `Baloto_Design_System_Demo.ipynb` con la extensión Jupyter (recomendada en `.vscode/extensions.json`). El notebook detecta la copia local y no descarga nada.
3. **Snippets:** en archivos `.py`, `.ipynb` y `.html` escribe `bm-` y elige: `bm-setup`, `bm-mostrar`, `bm-combo`, `bm-ticket`, `bm-panel`, `bm-stat`, `bm-btn`, `bm-aviso`. Funcionan dentro de este repositorio (`.vscode/baloto.code-snippets`) y en cualquier proyecto si instalas la extensión.

## Mantener sincronizado

Edita solo `tokens.json` (o cópialo desde el artefacto) y regenera:

```bash
python design-system/build_tokens.py                  # tokens.css + .mplstyle
python design-system/vscode-theme/build_theme.py      # temas de VS Code + snippets (verifica contraste)
cd design-system/vscode-theme && npx @vscode/vsce package
```

## Notas

- Los colores son los de la página del design system en este momento: `primary-container #00b7c1`, `primary #50c8ff` y `v4-ink #7f2d8e` fueron ajustados ahí respecto a los notebooks originales (`#00f2ff`, `#e1fdff`, `#e0e6ff`).
- `v4-ink #7f2d8e` tiene ~2:1 de contraste sobre el fondo V4; el texto V4 es difícil de leer en el tema Oscuro (en Alto contraste es blanco).
- Algunas notas de uso en `tokens.json` aún citan contrastes calculados con el cian original.
- Juego responsable: muestra siempre `bm.aviso()` junto a combinaciones o porcentajes de confianza.
