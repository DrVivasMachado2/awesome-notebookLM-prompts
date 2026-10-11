"""Baloto Master AI — design system para notebooks (Google Colab, Jupyter, VS Code).

Uso rápido:
    import baloto_ds as bm
    bm.estilo_graficos()                       # matplotlib con la paleta del sistema
    bm.mostrar(bm.combinacion([4, 17, 22, 35, 41], 13, 94.2))
    bm.mostrar(bm.aviso(), tema="high-contrast")

Cada salida de Colab vive en su propio iframe, por eso `mostrar()` incluye
fuentes, tokens.css y bundle.css en cada celda. Los estilos salen de
tokens.css y bundle.css (este mismo directorio); no copies valores a mano.
"""
from __future__ import annotations

import html
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Sequence

DIR = Path(__file__).resolve().parent
TEMAS = ("dark", "high-contrast")
_tema_activo = "dark"

# Colores literales de los notebooks Baloto Master AI originales → token que los reemplaza.
# aplicar_tokens() los traduce al valor actual de tokens.json (y del tema activo).
HEX_FUENTE = {
    "#00f2ff": "primary-container", "#ffdb3c": "secondary-container", "#050814": "void",
    "#0e1225": "background", "#0a0e21": "night", "#dee1fc": "on-surface", "#e1fdff": "primary",
    "#b9cacb": "on-surface-variant", "#849495": "outline", "#3a494b": "outline-variant",
    "#303448": "surface-container-highest", "#161a2e": "surface-container-low",
    "#1b1e32": "surface-container", "#25293d": "surface-container-high", "#34384d": "surface-bright",
    "#00363a": "on-primary", "#fff9ef": "secondary", "#0088ff": "cyan-blue",
    "#0055ff": "electric-blue", "#aa00ff": "quantum", "#00ff88": "positive", "#ff5555": "negative",
    "#ff3366": "chart-rival", "#ffd700": "gold-spec", "#e0e6ff": "v4-ink", "#02000a": "v4-void",
    "#0a0a20": "v4-night",
}
RGB_FUENTE = {"0, 242, 255": "primary-container", "255, 219, 60": "secondary-container",
              "170, 0, 255": "quantum", "0, 255, 136": "positive"}
FUENTES = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900'
    '&family=Orbitron:wght@400;700;900&display=swap">'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined'
    ':wght,FILL@100..700,0..1&display=swap">'
)
AVISO_LEGAL = (
    "Baloto Master AI es una herramienta de análisis estadístico independiente y no tiene "
    "vinculación oficial con Operador Nacional de Juegos, Coljuegos ni el Gobierno Nacional de "
    "Colombia. Los pronósticos generados se basan en probabilidades históricas y no garantizan "
    "resultados ganadores. El juego de suerte y azar es para mayores de 18 años. Si sientes que "
    "el juego afecta tu vida, busca ayuda profesional."
)


def _leer(nombre: str) -> str:
    ruta = DIR / nombre
    if not ruta.exists():
        raise FileNotFoundError(
            f"No encuentro {ruta}. Descarga la carpeta design-system completa "
            "(ver design-system/README.md) y ejecuta build_tokens.py si falta tokens.css."
        )
    return ruta.read_text(encoding="utf-8")


def css() -> str:
    """tokens.css + bundle.css, en dos <style> (bundle.css empieza con @import)."""
    return f"<style>{_leer('tokens.css')}</style><style>{_leer('bundle.css')}</style>"


@lru_cache(maxsize=1)
def tokens() -> dict:
    """tokens.json como diccionario (para leer valores desde Python)."""
    return json.loads(_leer("tokens.json"))


def usar_tema(tema: str = "dark") -> None:
    """Fija el tema activo: lo usan color(), aplicar_tokens(), HTML() y estilo_graficos()."""
    global _tema_activo
    if tema not in TEMAS:
        raise ValueError(f"tema debe ser uno de {TEMAS}")
    _tema_activo = tema


def color(nombre: str, tema: str | None = None) -> str:
    """Valor hex de un token de color, siguiendo alias. Ej: color('primary-container').
    Sin `tema`, usa el tema activo (ver usar_tema)."""
    tema = tema or _tema_activo
    por_nombre = {t["name"]: t for t in tokens()["color"]["tokens"]}
    primero = tokens()["color"]["themes"][0]["id"]
    valor = por_nombre[nombre]["value"]
    while True:
        valor = valor.get(tema, valor[primero]) if isinstance(valor, dict) else valor
        if valor.startswith("{"):
            valor = por_nombre[valor[1:-1]]["value"]
            continue
        return valor


def pagina(cuerpo: str, tema: str | None = None, lienzo: bool = True, padding: int = 16) -> str:
    """Envuelve HTML con fuentes, estilos y el tema elegido (por defecto, el activo)."""
    tema = tema or _tema_activo
    if tema not in TEMAS:
        raise ValueError(f"tema debe ser uno de {TEMAS}")
    clase = "bm-canvas" if lienzo else ""
    return (f'{FUENTES}{css()}<div data-theme="{tema}" class="{clase}" '
            f'style="padding:{padding}px;border-radius:12px">{cuerpo}</div>')


def mostrar(*partes: str, tema: str | None = None, separacion: int = 16) -> None:
    """Muestra componentes en la celda actual. Acepta varias piezas de HTML."""
    from IPython.display import HTML, display
    cuerpo = f'<div style="display:grid;gap:{separacion}px">' + "".join(partes) + "</div>"
    display(HTML(pagina(cuerpo, tema=tema)))


def estilo_graficos(tema: str | None = None) -> None:
    """Aplica el estilo matplotlib del sistema (baloto-<tema>.mplstyle) y fija el tema activo."""
    import matplotlib.pyplot as plt
    usar_tema(tema or _tema_activo)
    plt.style.use(str(DIR / f"baloto-{_tema_activo}.mplstyle"))


def aplicar_tokens(codigo: str, tema: str | None = None) -> str:
    """Traduce los colores literales de los notebooks originales (hex y rgba de cian/oro/violeta/verde)
    a los valores actuales de tokens.json en el tema activo. Sirve para HTML, CSS, SVG,
    JavaScript y configuraciones de Tailwind sin reescribirlos."""
    tema = tema or _tema_activo
    patron_hex = re.compile("(" + "|".join(HEX_FUENTE) + r")(?![0-9a-fA-F])", re.IGNORECASE)
    codigo = patron_hex.sub(lambda m: color(HEX_FUENTE[m.group(1).lower()], tema), codigo)

    def rgb(nombre):
        h = color(nombre, tema).lstrip("#")
        return ", ".join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    patron_rgb = re.compile(r"(rgba?\(\s*)(" + "|".join(re.escape(k).replace(r"\ ", r"\s*")
                                                     for k in RGB_FUENTE) + r")")
    claves = {re.sub(r"\s", "", k): v for k, v in RGB_FUENTE.items()}
    return patron_rgb.sub(lambda m: m.group(1) + rgb(claves[re.sub(r"\s", "", m.group(2))]), codigo)


def HTML(data=None, url=None, filename=None, metadata=None, tema: str | None = None):
    """Igual que IPython.display.HTML, pero pasa el HTML por aplicar_tokens()."""
    from IPython.display import HTML as _HTML
    if isinstance(data, str):
        data = aplicar_tokens(data, tema)
    return _HTML(data=data, url=url, filename=filename, metadata=metadata)


# ---------------------------------------------------------------- componentes
_e = lambda x: html.escape(str(x))
_n = lambda n: f"{int(n):02d}"


def _items(numeros: Sequence[int], super_balota: int | None, variante: str) -> str:
    clase = {"ticket": "bola", "panel": "bm-ball", "resultado": "bm-tile", "v4": "bola-v4"}[variante]
    sup = {"ticket": "bola super", "panel": "bm-ball super", "resultado": "bm-tile super",
           "v4": "bola-v4 super-v4"}[variante]
    items = "".join(f'<div class="{clase}">{_n(n)}</div>' for n in numeros)
    if super_balota is not None:
        if variante in ("ticket", "v4", "panel"):
            items += '<span class="plus-sign">+</span>'
        items += f'<div class="{sup}">{_n(super_balota)}</div>'
    return items


def balotas(numeros: Sequence[int], super_balota: int | None = None, variante: str = "ticket") -> str:
    """Fila de balotas. variante: 'ticket' (bola), 'panel' (bm-ball), 'resultado' (bm-tile), 'v4'."""
    return f'<div class="bm-balls">{_items(numeros, super_balota, variante)}</div>'


def combinacion(numeros: Sequence[int], super_balota: int, confianza: float, nivel: int = 1) -> str:
    """Fila del Generador Cuántico. nivel 1 = destacada (neón), 2 y 3 = atenuadas."""
    lvl = "" if nivel == 1 else f" lvl-{nivel}"
    neon_c, neon_g = (" neon-text-cyan", " neon-text-gold") if nivel == 1 else ("", "")
    bolas = "".join(f'<div class="bm-ball{lvl}{neon_c}">{_n(n)}</div>' for n in numeros)
    bolas += (f'<span class="bm-plus">+</span>'
              f'<div class="bm-ball super{lvl}{neon_g}">{_n(super_balota)}</div>')
    caja = " neon-box-cyan" if nivel == 1 else lvl
    metric = "bm-metric neon-text-cyan" if nivel == 1 else 'bm-metric" style="color:var(--primary)'
    return (f'<div class="bm-combo{caja}"><div class="bm-balls">{bolas}</div>'
            f'<div class="bm-score"><span class="bm-micro" style="color:var(--primary-container)">'
            f'Confianza</span><span class="{metric}">{confianza:.1f}%</span></div></div>')


def combinaciones(filas: Iterable[tuple[Sequence[int], int, float]]) -> str:
    """Hasta 3 combinaciones ordenadas por confianza, con la jerarquía visual del sistema."""
    filas = sorted(filas, key=lambda f: f[2], reverse=True)[:3]
    return '<div style="display:grid;gap:24px">' + "".join(
        combinacion(n, s, c, nivel=i + 1) for i, (n, s, c) in enumerate(filas)) + "</div>"


def ticket(nombre: str, numeros: Sequence[int], super_balota: int, insignia: str = "",
           v4: bool = False) -> str:
    """Tarjeta de ticket. insignia: texto del badge (premio o estado)."""
    if v4:
        badge = f'<span class="confianza-badge">{_e(insignia)}</span>' if insignia else ""
        return (f'<div class="ticket-card-v4"><div class="t-header-v4"><span>{_e(nombre)}</span>{badge}</div>'
                f'<div class="bolas-wrapper">{_items(numeros, super_balota, "v4")}</div></div>')
    badge = f'<span class="badge">{_e(insignia)}</span>' if insignia else ""
    return (f'<div class="ticket-glass"><div class="t-header"><span>{_e(nombre)}</span>{badge}</div>'
            f'<div class="bolas-wrapper">{_items(numeros, super_balota, "ticket")}</div></div>')


def tickets(lista: Iterable[str]) -> str:
    """Rejilla responsive de tickets (minmax 320px)."""
    return ('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px">'
            + "".join(lista) + "</div>")


def estadistica(etiqueta: str, valor: str, tono: str = "cyan") -> str:
    """Tarjeta Pares/Impares. tono: 'cyan' o 'gold' (solo premios/retorno)."""
    return (f'<div class="bm-stat neon-box-cyan"><span class="bm-micro">{_e(etiqueta)}</span>'
            f'<p class="value neon-text-{"gold" if tono == "gold" else "cyan"}">{_e(valor)}</p></div>')


def estadisticas(*tarjetas: str) -> str:
    return (f'<div style="display:grid;grid-template-columns:repeat({len(tarjetas)},1fr);gap:16px">'
            + "".join(tarjetas) + "</div>")


def chips(etiqueta: str, numeros: Sequence[int], icono: str = "local_fire_department") -> str:
    """Fila 'Números Calientes' con chips."""
    c = "".join(f'<span class="bm-chip neon-text-cyan">{_n(n)}</span>' for n in numeros)
    return (f'<div style="display:flex;justify-content:space-between;align-items:center;padding:16px;'
            f'border-radius:var(--radius-xl);background:rgba(37,41,61,0.4)">'
            f'<span style="display:flex;gap:12px;align-items:center">'
            f'<span class="material-symbols-outlined filled" style="color:var(--negative)">{_e(icono)}</span>'
            f'<span style="font-size:14px;font-weight:700">{_e(etiqueta)}</span></span>'
            f'<span style="display:flex;gap:8px">{c}</span></div>')


def barra_superior(estado: str = "AGENTE CENTRAL", acumulado: str = "") -> str:
    return (f'<header class="bm-topbar"><span style="display:flex;gap:16px;align-items:center">'
            f'<span class="bm-wordmark neon-text-cyan cyber-glitch">Baloto Master AI</span>'
            f'<span class="bm-pill neon-box-cyan"><span class="dot"></span>{_e(estado)}</span></span>'
            f'<span class="neon-text-cyan" style="font-weight:900;font-size:20px">{_e(acumulado)}</span></header>')


def panel(eyebrow: str, titulo: str, contenido: str = "") -> str:
    """GlassPanel con eyebrow y título."""
    return (f'<section class="glass-panel"><p class="bm-eyebrow neon-text-cyan">{_e(eyebrow)}</p>'
            f'<p class="bm-title">{_e(titulo)}</p><div style="margin-top:24px">{contenido}</div></section>')


def boton(texto: str, tipo: str = "master") -> str:
    """tipo: 'master' (principal, uno por vista), 'cuantico', 'fantasma', 'v4'."""
    clase = {"master": "btn-master", "cuantico": "btn-cuantico",
             "fantasma": "bm-btn-ghost neon-text-cyan", "v4": "btn-quantum-v4"}[tipo]
    return f'<button class="{clase}">{_e(texto)}</button>'


def consola(lineas: Iterable[str] = (), error: str = "", vacio: str = "") -> str:
    """ResultsConsole. lineas: texto ya formateado de cada ticket."""
    cuerpo = "".join(f'<div class="ticket-item">{_e(l)}</div>' for l in lineas)
    if error:
        cuerpo += f'<div class="bm-error">Error: {_e(error)}</div>'
    if vacio:
        cuerpo += f'<div class="status-msg">{_e(vacio)}</div>'
    return f'<div class="bm-console">{cuerpo}</div>'


def aviso() -> str:
    """Disclaimer obligatorio en toda vista con combinaciones o probabilidades."""
    return (f'<aside class="bm-disclaimer" role="note"><span class="material-symbols-outlined filled" '
            f'aria-hidden="true">18_up_rating</span><p style="margin:0"><strong>Juega con '
            f'responsabilidad.</strong> {_e(AVISO_LEGAL)}</p></aside>')
