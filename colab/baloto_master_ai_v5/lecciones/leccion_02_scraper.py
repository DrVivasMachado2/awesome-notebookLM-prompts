# -*- coding: utf-8 -*-
"""Lección 2 · Descargar el histórico completo de baloto.com (127 páginas) de forma robusta.

Uso en Colab (después de `%run baloto_master_ai_v5.py`):
    %run lecciones/leccion_02_scraper.py          # descarga todo y guarda historico_baloto_com.csv
    df = descargar_historico(max_paginas=3)        # prueba corta

Estrategia: no se depende de nombres de clases CSS (cambian sin aviso). Se busca el PATRÓN
de un resultado: 5 números separados por guiones y una fecha en español en el mismo bloque.
"""
import re
import time
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

URL_BASE = "https://baloto.com/resultados"
PARAMETRO_PAGINA = "page"            # cámbialo si la URL de la página 2 usa otro nombre (p. ej. "pagina")
PAUSA_SEGUNDOS = 1.5                 # cortesía con el servidor: ~127 peticiones en ~3 minutos
CABECERAS = {"User-Agent": "Mozilla/5.0 (BalotoMasterAI v5; uso personal y educativo)"}
CARPETA_CACHE = Path("cache_html")   # cada página descargada se guarda aquí (reanudable)

MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
         "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}
PATRON_RESULTADO = re.compile(r"\b(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\b")
PATRON_FECHA = re.compile(r"(\d{1,2})\s+de\s+([A-Za-zñ]+)\s+de\s+(\d{4})", re.IGNORECASE)
PATRON_TOTAL = re.compile(r"P[áa]gina\s+\d+\s+de\s+(\d+)", re.IGNORECASE)


# ── Paso 1 · Descargar una página con reintentos ─────────────────────────────────
def descargar_pagina(numero: int, sesion: requests.Session, reintentos: int = 3) -> str:
    """Devuelve el HTML de la página `numero`. Usa caché en disco: si ya la bajaste, no la pide otra vez."""
    CARPETA_CACHE.mkdir(exist_ok=True)
    archivo = CARPETA_CACHE / f"pagina_{numero:03d}.html"
    if archivo.exists():
        return archivo.read_text(encoding="utf-8")

    for intento in range(1, reintentos + 1):
        try:
            r = sesion.get(URL_BASE, params={PARAMETRO_PAGINA: numero}, headers=CABECERAS, timeout=20)
            r.raise_for_status()                      # lanza error si el servidor respondió 4xx/5xx
            archivo.write_text(r.text, encoding="utf-8")
            return r.text
        except requests.RequestException as e:
            print(f"   ⚠️ Página {numero}, intento {intento}/{reintentos}: {e}")
            time.sleep(2 ** intento)                  # espera 2, 4, 8 s (backoff exponencial)
    raise ConnectionError(f"No se pudo descargar la página {numero} tras {reintentos} intentos.")


# ── Paso 2 · Leer los sorteos del HTML sin depender de clases CSS ────────────────
def _fecha_iso(dia: str, mes: str, anio: str) -> str | None:
    numero_mes = MESES.get(mes.lower())
    return f"{anio}-{numero_mes:02d}-{int(dia):02d}" if numero_mes else None


def extraer_sorteos(html: str) -> list[dict]:
    """Busca cada bloque de texto que contenga '5 números con guiones' y, cerca, una fecha y el juego."""
    soup = BeautifulSoup(html, "html.parser")
    sorteos = []
    for nodo in soup.find_all(string=PATRON_RESULTADO):        # nodos de texto que parecen un resultado
        bloque = nodo
        texto = ""
        # Subimos por los "padres" del nodo hasta encontrar uno que también contenga la fecha
        for _ in range(6):
            bloque = bloque.parent
            if bloque is None:
                break
            texto = bloque.get_text(" ", strip=True)
            if PATRON_FECHA.search(texto):
                break
        m_res, m_fecha = PATRON_RESULTADO.search(texto), PATRON_FECHA.search(texto)
        if not (m_res and m_fecha):
            continue
        balotas = [int(x) for x in m_res.groups()]
        # La súper balota es el número que sigue al bloque de 5 (en la web va en la bolita roja)
        resto = texto[m_res.end():]
        m_sb = re.search(r"\b(\d{1,2})\b", resto)
        if not m_sb:
            continue
        juego = "Revancha" if "revancha" in texto.lower() else "Baloto"
        sorteos.append({
            "Fecha": _fecha_iso(*m_fecha.groups()), "Juego": juego,
            **{f"B{i + 1}": b for i, b in enumerate(balotas)}, "SB": int(m_sb.group(1)),
        })
    # Quitamos repeticiones exactas: el mismo sorteo puede aparecer en nodos anidados
    unicos = {tuple(s.items()): s for s in sorteos}
    return list(unicos.values())


def detectar_total_paginas(html: str) -> int | None:
    m = PATRON_TOTAL.search(BeautifulSoup(html, "html.parser").get_text(" ", strip=True))
    return int(m.group(1)) if m else None


# ── Paso 3 · Recorrer todas las páginas ──────────────────────────────────────────
def descargar_historico(max_paginas: int | None = None, pausa: float = PAUSA_SEGUNDOS,
                        salida: str = "historico_baloto_com.csv") -> pd.DataFrame:
    sesion = requests.Session()
    html1 = descargar_pagina(1, sesion)
    total = detectar_total_paginas(html1)
    primeros = extraer_sorteos(html1)
    if not primeros:
        raise RuntimeError(
            "La página 1 no contiene resultados reconocibles. Abre cache_html/pagina_001.html: "
            "si la tabla está vacía, el contenido se carga con JavaScript y hace falta la ruta Selenium "
            "(ver README). Si está llena, ajusta los patrones PATRON_RESULTADO / PATRON_FECHA."
        )
    if total is None:
        print("⚠️ No encontré 'Página X de N'; seguiré hasta que una página venga vacía.")
    ultima = min(total or 10_000, max_paginas or 10_000)
    print(f"📄 Página 1 OK: {len(primeros)} sorteos. Total detectado: {total}. Descargaré hasta la {ultima}.")

    filas = list(primeros)
    for n in range(2, ultima + 1):
        time.sleep(pausa)
        nuevos = extraer_sorteos(descargar_pagina(n, sesion))
        if not nuevos:
            print(f"🛑 Página {n} vacía: fin del histórico.")
            break
        filas.extend(nuevos)
        if n % 10 == 0:
            print(f"   … página {n}/{ultima}, {len(filas)} sorteos acumulados")
            pd.DataFrame(filas).to_csv(salida, index=False)      # punto de control

    df = pd.DataFrame(filas)
    df.to_csv(salida, index=False)
    print(f"✅ {len(df)} sorteos guardados en {salida}")
    return df


if __name__ == "__main__":
    df_web = descargar_historico()
    print(df_web.head(10))
