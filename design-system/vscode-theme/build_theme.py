"""Genera el tema de VS Code y los snippets a partir de ../tokens.json.

Uso:  python design-system/vscode-theme/build_theme.py
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
TOKENS = json.loads((HERE.parent / "tokens.json").read_text(encoding="utf-8"))
BY_NAME = {t["name"]: t for t in TOKENS["color"]["tokens"]}
FIRST = TOKENS["color"]["themes"][0]["id"]


def c(name, theme, alpha=""):
    v = BY_NAME[name]["value"]
    while True:
        v = v.get(theme, v[FIRST]) if isinstance(v, dict) else v
        if v.startswith("{"):
            v = BY_NAME[v[1:-1]]["value"]
            continue
        return v + alpha


def luminance(hex_):
    h = hex_.lstrip("#")[:6]
    r = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    r = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in r]
    return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]


def contrast(a, b):
    x, y = sorted([luminance(a), luminance(b)], reverse=True)
    return (x + 0.05) / (y + 0.05)


def theme(theme_id):
    k = lambda n, a="": c(n, theme_id, a)
    hc = theme_id == "high-contrast"
    syntax = {
        "comment": k("outline"),
        "keyword": k("primary-container"),
        "function": k("primary"),
        "string": k("secondary-container"),
        "number": k("positive"),
        "type": k("secondary"),
        "constant": k("chart-rival"),
        "variable": k("on-surface"),
        "punctuation": k("on-surface-variant"),
        "invalid": k("negative"),
    }
    colors = {
        "focusBorder": k("secondary-container"),
        "foreground": k("on-surface"),
        "descriptionForeground": k("on-surface-variant"),
        "errorForeground": k("negative"),
        "selection.background": k("primary-container", "55"),
        "widget.shadow": "#00000080",
        "editor.background": k("background"),
        "editor.foreground": k("on-surface"),
        "editorCursor.foreground": k("primary-container"),
        "editor.selectionBackground": k("primary-container", "40"),
        "editor.inactiveSelectionBackground": k("primary-container", "22"),
        "editor.wordHighlightBackground": k("primary-container", "26"),
        "editor.findMatchBackground": k("secondary-container", "55"),
        "editor.findMatchHighlightBackground": k("secondary-container", "30"),
        "editor.lineHighlightBackground": k("surface-container-low"),
        "editorLineNumber.foreground": k("outline"),
        "editorLineNumber.activeForeground": k("primary-container"),
        "editorIndentGuide.background1": k("outline-variant"),
        "editorIndentGuide.activeBackground1": k("primary-container", "99"),
        "editorBracketMatch.border": k("primary-container"),
        "editorBracketHighlight.foreground1": k("primary-container"),
        "editorBracketHighlight.foreground2": k("secondary-container"),
        "editorBracketHighlight.foreground3": k("quantum"),
        "editorError.foreground": k("negative"),
        "editorWarning.foreground": k("secondary-container"),
        "editorInfo.foreground": k("primary-container"),
        "editorGutter.addedBackground": k("positive"),
        "editorGutter.modifiedBackground": k("primary-container"),
        "editorGutter.deletedBackground": k("negative"),
        "editorWidget.background": k("surface-container"),
        "editorWidget.border": k("outline-variant"),
        "editorSuggestWidget.selectedBackground": k("surface-container-highest"),
        "editorHoverWidget.background": k("surface-container"),
        "activityBar.background": k("void"),
        "activityBar.foreground": k("primary-container"),
        "activityBar.inactiveForeground": k("outline"),
        "activityBarBadge.background": k("secondary-container"),
        "activityBarBadge.foreground": k("void"),
        "activityBar.activeBorder": k("primary-container"),
        "sideBar.background": k("void"),
        "sideBar.foreground": k("on-surface-variant"),
        "sideBarTitle.foreground": k("primary-container"),
        "sideBarSectionHeader.background": k("background"),
        "sideBarSectionHeader.foreground": k("on-surface"),
        "list.activeSelectionBackground": k("surface-container-highest"),
        "list.activeSelectionForeground": k("on-surface"),
        "list.hoverBackground": k("surface-container-low"),
        "list.inactiveSelectionBackground": k("surface-container"),
        "list.highlightForeground": k("primary-container"),
        "titleBar.activeBackground": k("void"),
        "titleBar.activeForeground": k("on-surface"),
        "titleBar.inactiveBackground": k("void"),
        "tab.activeBackground": k("background"),
        "tab.activeForeground": k("on-surface"),
        "tab.inactiveBackground": k("void"),
        "tab.inactiveForeground": k("outline"),
        "tab.activeBorderTop": k("primary-container"),
        "tab.border": k("void"),
        "editorGroupHeader.tabsBackground": k("void"),
        "panel.background": k("void"),
        "panel.border": k("outline-variant"),
        "panelTitle.activeBorder": k("primary-container"),
        "panelTitle.activeForeground": k("on-surface"),
        "statusBar.background": k("void"),
        "statusBar.foreground": k("primary-container"),
        "statusBar.border": k("outline-variant"),
        "statusBar.debuggingBackground": k("secondary-container"),
        "statusBar.debuggingForeground": k("void"),
        "statusBarItem.remoteBackground": k("primary-container"),
        "statusBarItem.remoteForeground": k("void"),
        "button.background": k("primary-container"),
        "button.foreground": k("void"),
        "button.hoverBackground": k("cyan-blue"),
        "badge.background": k("secondary-container"),
        "badge.foreground": k("void"),
        "input.background": k("surface-container-low"),
        "input.foreground": k("on-surface"),
        "input.border": k("outline-variant"),
        "inputOption.activeBorder": k("primary-container"),
        "dropdown.background": k("surface-container"),
        "textLink.foreground": k("primary-container"),
        "textLink.activeForeground": k("primary"),
        "scrollbarSlider.background": k("primary-container", "33"),
        "scrollbarSlider.hoverBackground": k("primary-container", "66"),
        "scrollbarSlider.activeBackground": k("primary-container", "99"),
        "progressBar.background": k("primary-container"),
        "notebook.cellBorderColor": k("outline-variant"),
        "notebook.focusedCellBorder": k("primary-container"),
        "notebook.selectedCellBorder": k("outline"),
        "notebook.cellEditorBackground": k("surface-container-low"),
        "notebook.outputContainerBackgroundColor": k("void"),
        "notebookStatusSuccessIcon.foreground": k("positive"),
        "notebookStatusErrorIcon.foreground": k("negative"),
        "terminal.background": k("void"),
        "terminal.foreground": k("on-surface"),
        "terminalCursor.foreground": k("primary-container"),
        "terminal.ansiBlack": k("surface-container-highest"),
        "terminal.ansiRed": k("negative"),
        "terminal.ansiGreen": k("positive"),
        "terminal.ansiYellow": k("secondary-container"),
        "terminal.ansiBlue": k("cyan-blue"),
        "terminal.ansiMagenta": k("quantum"),
        "terminal.ansiCyan": k("primary-container"),
        "terminal.ansiWhite": k("on-surface"),
        "terminal.ansiBrightBlack": k("outline"),
        "terminal.ansiBrightRed": k("chart-rival"),
        "terminal.ansiBrightGreen": k("positive"),
        "terminal.ansiBrightYellow": k("secondary-container"),
        "terminal.ansiBrightBlue": k("primary"),
        "terminal.ansiBrightMagenta": k("quantum"),
        "terminal.ansiBrightCyan": k("primary-container"),
        "terminal.ansiBrightWhite": "#ffffff",
    }
    if hc:
        colors.update({"contrastBorder": k("outline-variant"), "contrastActiveBorder": k("secondary-container")})
    S = syntax
    token_colors = [
        {"scope": ["comment", "punctuation.definition.comment"], "settings": {"foreground": S["comment"], "fontStyle": "italic"}},
        {"scope": ["keyword", "storage", "storage.type", "keyword.control", "keyword.operator.logical"], "settings": {"foreground": S["keyword"]}},
        {"scope": ["entity.name.function", "support.function", "meta.function-call"], "settings": {"foreground": S["function"]}},
        {"scope": ["string", "string.quoted", "punctuation.definition.string"], "settings": {"foreground": S["string"]}},
        {"scope": ["constant.numeric", "constant.character.escape"], "settings": {"foreground": S["number"]}},
        {"scope": ["entity.name.type", "entity.name.class", "support.class", "support.type", "entity.other.inherited-class"], "settings": {"foreground": S["type"], "fontStyle": "bold"}},
        {"scope": ["constant.language", "support.constant", "variable.language.self", "variable.language.this"], "settings": {"foreground": S["constant"]}},
        {"scope": ["variable", "variable.parameter", "meta.definition.variable"], "settings": {"foreground": S["variable"]}},
        {"scope": ["punctuation", "meta.brace", "keyword.operator"], "settings": {"foreground": S["punctuation"]}},
        {"scope": ["entity.name.tag"], "settings": {"foreground": S["keyword"]}},
        {"scope": ["entity.other.attribute-name"], "settings": {"foreground": S["function"]}},
        {"scope": ["support.type.property-name.css", "variable.css", "variable.argument.css"], "settings": {"foreground": S["function"]}},
        {"scope": ["markup.heading", "entity.name.section"], "settings": {"foreground": S["keyword"], "fontStyle": "bold"}},
        {"scope": ["markup.bold"], "settings": {"fontStyle": "bold"}},
        {"scope": ["markup.italic"], "settings": {"fontStyle": "italic"}},
        {"scope": ["markup.inline.raw", "markup.fenced_code"], "settings": {"foreground": S["string"]}},
        {"scope": ["markup.underline.link"], "settings": {"foreground": S["keyword"]}},
        {"scope": ["invalid", "invalid.illegal"], "settings": {"foreground": S["invalid"]}},
    ]
    bg = k("background")
    report = {n: round(contrast(v, bg), 2) for n, v in syntax.items()}
    name = "Baloto Master AI" + (" · Alto contraste" if hc else "")
    return {"$schema": "vscode://schemas/color-theme", "name": name, "type": "hc" if hc else "dark",
            "semanticHighlighting": True, "colors": colors, "tokenColors": token_colors}, report


SNIPPETS = {
    "Baloto · combinación": {"prefix": ["bm-combo", "bm-combinacion"], "description": "CombinationRow del Generador Cuántico",
        "html": ['<div class="bm-combo neon-box-cyan">', '  <div class="bm-balls">',
                 '    <div class="bm-ball neon-text-cyan">${1:04}</div><div class="bm-ball neon-text-cyan">${2:17}</div><div class="bm-ball neon-text-cyan">${3:22}</div><div class="bm-ball neon-text-cyan">${4:35}</div><div class="bm-ball neon-text-cyan">${5:41}</div>',
                 '    <span class="bm-plus">+</span><div class="bm-ball super neon-text-gold">${6:13}</div>', '  </div>',
                 '  <div class="bm-score"><span class="bm-micro">Confianza</span><span class="bm-metric neon-text-cyan">${7:94.2}%</span></div>', '</div>'],
        "python": "bm.combinacion([${1:4}, ${2:17}, ${3:22}, ${4:35}, ${5:41}], ${6:13}, ${7:94.2})"},
    "Baloto · ticket": {"prefix": ["bm-ticket"], "description": "TicketCard",
        "html": ['<div class="ticket-glass">', '  <div class="t-header"><span>${1:TICKET 1}</span><span class="badge">${2:Premio \\$12.500M}</span></div>',
                 '  <div class="bolas-wrapper"><div class="bola">${3:04}</div><div class="bola">${4:17}</div><div class="bola">${5:22}</div><div class="bola">${6:35}</div><div class="bola">${7:41}</div><span class="plus-sign">+</span><div class="bola super">${8:13}</div></div>', '</div>'],
        "python": "bm.ticket(\"${1:TICKET 1}\", [${2:4, 17, 22, 35, 41}], ${3:13}, insignia=\"${4:Premio \\$12.500M}\")"},
    "Baloto · panel glass": {"prefix": ["bm-panel", "bm-glass"], "description": "GlassPanel con eyebrow y título",
        "html": ['<section class="glass-panel">', '  <p class="bm-eyebrow neon-text-cyan">${1:Generador Cuántico}</p>', '  <p class="bm-title">${2:Combinaciones de Alta Probabilidad}</p>', '  $0', '</section>'],
        "python": "bm.panel(\"${1:Generador Cuántico}\", \"${2:Combinaciones de Alta Probabilidad}\", ${3:contenido})"},
    "Baloto · estadística": {"prefix": ["bm-stat"], "description": "StatTile",
        "html": ['<div class="bm-stat neon-box-cyan"><span class="bm-micro">${1:Pares}</span><p class="value neon-text-${2|cyan,gold|}">${3:60%}</p></div>'],
        "python": "bm.estadistica(\"${1:Pares}\", \"${2:60%}\", tono=\"${3|cyan,gold|}\")"},
    "Baloto · botón principal": {"prefix": ["bm-btn"], "description": "btn-master (uno por vista)",
        "html": ['<button class="${1|btn-master,btn-cuantico,bm-btn-ghost neon-text-cyan,btn-quantum-v4|}">${2:Generar Suerte}</button>'],
        "python": "bm.boton(\"${1:Generar Suerte}\", tipo=\"${2|master,cuantico,fantasma,v4|}\")"},
    "Baloto · aviso legal": {"prefix": ["bm-aviso", "bm-disclaimer"], "description": "Disclaimer obligatorio de juego responsable",
        "html": ['<aside class="bm-disclaimer" role="note"><span class="material-symbols-outlined filled" aria-hidden="true">18_up_rating</span><p style="margin:0"><strong>Juega con responsabilidad.</strong> Baloto Master AI es una herramienta de análisis estadístico independiente y no tiene vinculación oficial con Operador Nacional de Juegos, Coljuegos ni el Gobierno Nacional de Colombia. Los pronósticos generados se basan en probabilidades históricas y no garantizan resultados ganadores. El juego de suerte y azar es para mayores de 18 años. Si sientes que el juego afecta tu vida, busca ayuda profesional.</p></aside>'],
        "python": "bm.aviso()"},
    "Baloto · mostrar": {"prefix": ["bm-mostrar", "bm-show"], "description": "Pintar componentes en la celda",
        "python": "bm.mostrar(\n    ${1:bm.aviso()},\n    tema=\"${2|dark,high-contrast|}\",\n)"},
    "Baloto · setup notebook": {"prefix": ["bm-setup"], "description": "Importar el design system y aplicar el estilo de gráficos",
        "python": "import sys\nsys.path.insert(0, \"${1:design-system}\")\nimport baloto_ds as bm\nbm.estilo_graficos(\"${2|dark,high-contrast|}\")"},
}


def build_snippets():
    per_lang = {"html": {}, "python": {}}
    workspace = {}
    for name, s in SNIPPETS.items():
        for lang in ("html", "python"):
            if lang in s:
                body = s[lang] if isinstance(s[lang], list) else s[lang].split("\n")
                entry = {"prefix": s["prefix"], "body": body, "description": s["description"]}
                per_lang[lang][name] = entry
                workspace[f"{name} ({lang})"] = {**entry, "scope": lang}
    (HERE / "snippets").mkdir(exist_ok=True)
    for lang, data in per_lang.items():
        (HERE / "snippets" / f"{lang}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / ".vscode").mkdir(exist_ok=True)
    (ROOT / ".vscode" / "baloto.code-snippets").write_text(json.dumps(workspace, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    ok = True
    for tid, fname in (("dark", "baloto-master-ai-color-theme.json"),
                       ("high-contrast", "baloto-master-ai-hc-color-theme.json")):
        data, report = theme(tid)
        (HERE / "themes" / fname).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        floor = 7 if tid == "high-contrast" else 4.5
        bad = {n: r for n, r in report.items() if r < floor}
        print(f"{tid}: contraste sintaxis sobre editor.background (mín {floor}:1) ->", report)
        if bad:
            ok = False
            print("  ⚠ por debajo del mínimo:", bad)
    build_snippets()
    print("OK: temas y snippets generados")
    sys.exit(0 if ok else 1)
