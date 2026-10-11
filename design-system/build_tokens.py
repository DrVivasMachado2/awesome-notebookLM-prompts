"""Genera los derivados del design system Baloto Master AI a partir de tokens.json.

Uso:  python design-system/build_tokens.py

Salidas (no editar a mano):
  tokens.css                      variables CSS de los dos temas
  baloto-dark.mplstyle            estilo matplotlib, tema Oscuro
  baloto-high-contrast.mplstyle   estilo matplotlib, tema Alto contraste
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
TOKENS = json.loads((HERE / "tokens.json").read_text(encoding="utf-8"))
THEMES = [t["id"] for t in TOKENS["color"]["themes"]]
FIRST = THEMES[0]
OTHER_FAMILIES = [k for k, v in TOKENS.items()
                  if isinstance(v, dict) and "tokens" in v and k not in ("color", "shadow")]


def raw(token, theme):
    value = token["value"]
    if isinstance(value, dict):
        return value.get(theme, value[FIRST])
    return value


def css_value(token, theme):
    value = raw(token, theme)
    alias = re.fullmatch(r"\{(.+)\}", value)
    return f"var(--{alias.group(1)})" if alias else value


def resolve(name, theme):
    """Valor hex final de un color, siguiendo alias."""
    by_name = {t["name"]: t for t in TOKENS["color"]["tokens"]}
    value = raw(by_name[name], theme)
    while (alias := re.fullmatch(r"\{(.+)\}", value)):
        value = raw(by_name[alias.group(1)], theme)
    return value


def build_css():
    out = [f"/* {TOKENS['name']} — generated from tokens.json */"]
    themed = TOKENS["color"]["tokens"] + TOKENS.get("shadow", {}).get("tokens", [])
    for i, theme in enumerate(THEMES):
        selector = f':root, [data-theme="{theme}"]' if i == 0 else f'[data-theme="{theme}"]'
        # Temas siguientes: solo lo que cambia, más los alias (se re-declaran para que resuelvan ahí).
        def wanted(t):
            v = t["value"]
            return i == 0 or (isinstance(v, dict) and theme in v) or raw(t, theme).startswith("{")
        decls = "\n".join(f"  --{t['name']}: {css_value(t, theme)};" for t in themed if wanted(t))
        out.append(f"{selector} {{\n{decls}\n}}")
    lines = []
    for fam in OTHER_FAMILIES:
        lines += [f"  --{t['name']}: {t['value']};" for t in TOKENS[fam]["tokens"]]
    lines += [f"  --font-{k}: {v};" for k, v in TOKENS["type"]["families"].items()]
    out.append(":root {\n" + "\n".join(lines) + "\n}")
    (HERE / "tokens.css").write_text("\n\n".join(out) + "\n", encoding="utf-8")


def build_mplstyle(theme):
    c = lambda n: resolve(n, theme).lstrip("#")
    cycle = ["primary-container", "secondary-container", "positive", "chart-rival", "quantum", "cyan-blue"]
    style = f"""# {TOKENS['name']} — matplotlib, tema {theme} (generado desde tokens.json)
figure.facecolor: {c('void')}
figure.edgecolor: {c('void')}
savefig.facecolor: {c('void')}
axes.facecolor: {c('background')}
axes.edgecolor: {c('outline-variant')}
axes.labelcolor: {c('on-surface-variant')}
axes.titlecolor: {c('on-surface')}
axes.titleweight: bold
axes.titlesize: 14
axes.labelsize: 11
axes.grid: True
axes.spines.top: False
axes.spines.right: False
axes.prop_cycle: cycler('color', [{', '.join(repr(c(n)) for n in cycle)}])
grid.color: {c('primary-container')}
grid.alpha: {0.35 if theme == 'high-contrast' else 0.12}
grid.linewidth: 0.8
text.color: {c('on-surface')}
xtick.color: {c('on-surface-variant')}
ytick.color: {c('on-surface-variant')}
legend.facecolor: {c('surface-container-high')}
legend.edgecolor: {c('outline-variant')}
legend.labelcolor: {c('on-surface')}
lines.linewidth: 2.5
patch.edgecolor: {c('void')}
font.family: sans-serif
font.sans-serif: Inter, DejaVu Sans, Arial, sans-serif
"""
    (HERE / f"baloto-{theme}.mplstyle").write_text(style, encoding="utf-8")


if __name__ == "__main__":
    build_css()
    for theme in THEMES:
        build_mplstyle(theme)
    print("OK:", ", ".join(["tokens.css", *[f"baloto-{t}.mplstyle" for t in THEMES]]))
