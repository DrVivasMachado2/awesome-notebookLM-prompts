# Baloto Master AI · tema para VS Code

Dos temas generados desde `design-system/tokens.json`:

- **Baloto Master AI**: noche profunda, cian para datos y palabras clave, oro para cadenas. Sintaxis con ≥4.5:1 de contraste.
- **Baloto Master AI · Alto contraste**: fondo negro, bordes visibles y sintaxis con ≥7:1 (WCAG AAA).

Incluye snippets en HTML y Python: `bm-combo`, `bm-ticket`, `bm-panel`, `bm-stat`, `bm-btn`, `bm-aviso`, `bm-mostrar`, `bm-setup`.

## Instalar

1. `Ctrl/Cmd + Shift + P` → **Extensions: Install from VSIX…** → elige `baloto-master-ai-theme-1.0.0.vsix`.
2. `Ctrl/Cmd + K`, luego `Ctrl/Cmd + T` → elige **Baloto Master AI**.

## Regenerar

```bash
python design-system/build_tokens.py
python design-system/vscode-theme/build_theme.py
cd design-system/vscode-theme && npx @vscode/vsce package
```
