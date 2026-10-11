# -*- coding: utf-8 -*-
"""Lección 2b · Ruta de respaldo con Selenium para páginas que se dibujan con JavaScript.

Instalación en Colab (una sola celda, solo si `requests` devolvió una tabla vacía):
    !wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    !apt-get install -y -qq ./google-chrome-stable_current_amd64.deb > /dev/null
    !pip install -q selenium

Uso:
    %run lecciones/leccion_02_scraper.py
    %run lecciones/leccion_02b_selenium.py
    df = descargar_historico_auto()          # prueba requests y, si falla, cambia solo a Selenium
"""
import time
from pathlib import Path

import pandas as pd
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

import leccion_02_scraper as S

RUTA_CHROME = None          # None = Selenium busca Chrome solo; o una ruta como "/usr/bin/google-chrome"
ESPERA_MAX = 20             # segundos máximos esperando a que JavaScript dibuje la tabla


# ── Paso 1 · Abrir un navegador invisible una sola vez ───────────────────────────
def abrir_navegador() -> webdriver.Chrome:
    opciones = Options()
    opciones.add_argument("--headless=new")          # sin ventana: Colab no tiene pantalla
    opciones.add_argument("--no-sandbox")            # obligatorio cuando corres como root (Colab)
    opciones.add_argument("--disable-dev-shm-usage") # evita quedarse sin memoria compartida
    opciones.add_argument("--window-size=1400,1000")
    if RUTA_CHROME:
        opciones.binary_location = RUTA_CHROME
    return webdriver.Chrome(options=opciones)        # Selenium ≥ 4.6 descarga el driver correcto solo


# ── Paso 2 · Esperar a que la tabla exista de verdad, no un tiempo fijo ──────────
def _tabla_lista(driver) -> bool:
    return bool(S.PATRON_RESULTADO.search(driver.find_element("tag name", "body").text))


def descargar_pagina_selenium(numero: int, driver: webdriver.Chrome) -> str:
    """Misma caché que la lección 2: si requests ya guardó la página, no se vuelve a abrir."""
    S.CARPETA_CACHE.mkdir(exist_ok=True)
    archivo = S.CARPETA_CACHE / f"pagina_{numero:03d}.html"
    if archivo.exists() and S.extraer_sorteos(archivo.read_text(encoding="utf-8")):
        return archivo.read_text(encoding="utf-8")

    driver.get(f"{S.URL_BASE}?{S.PARAMETRO_PAGINA}={numero}")
    try:
        WebDriverWait(driver, ESPERA_MAX).until(_tabla_lista)   # espera activa: sigue en cuanto aparece
    except TimeoutException:
        print(f"   ⚠️ Página {numero}: la tabla no apareció en {ESPERA_MAX} s.")
    html = driver.page_source                                   # el HTML YA dibujado por JavaScript
    archivo.write_text(html, encoding="utf-8")
    return html


# ── Paso 3 · Recorrido completo, reutilizando el parser de la lección 2 ──────────
def descargar_historico_selenium(max_paginas: int | None = None, pausa: float = S.PAUSA_SEGUNDOS,
                                 salida: str = "historico_baloto_com.csv") -> pd.DataFrame:
    driver = abrir_navegador()
    try:
        html1 = descargar_pagina_selenium(1, driver)
        primeros = S.extraer_sorteos(html1)
        if not primeros:
            raise RuntimeError("Ni con Selenium aparecen resultados. Revisa cache_html/pagina_001.html "
                               "y ajusta PATRON_RESULTADO / PATRON_FECHA en leccion_02_scraper.py.")
        total = S.detectar_total_paginas(html1)
        ultima = min(total or 10_000, max_paginas or 10_000)
        print(f"📄 [Selenium] Página 1 OK: {len(primeros)} sorteos. Total: {total}. Hasta la {ultima}.")
        filas = list(primeros)
        for n in range(2, ultima + 1):
            time.sleep(pausa)
            nuevos = S.extraer_sorteos(descargar_pagina_selenium(n, driver))
            if not nuevos:
                print(f"🛑 Página {n} vacía: fin del histórico.")
                break
            filas.extend(nuevos)
            if n % 10 == 0:
                print(f"   … página {n}/{ultima}, {len(filas)} sorteos acumulados")
                pd.DataFrame(filas).to_csv(salida, index=False)
    finally:
        driver.quit()                                           # SIEMPRE cerrar el navegador
    df = pd.DataFrame(filas)
    df.to_csv(salida, index=False)
    print(f"✅ {len(df)} sorteos guardados en {salida}")
    return df


def descargar_historico_auto(**kwargs) -> pd.DataFrame:
    """Intenta la ruta rápida (requests). Si la página 1 llega vacía, cambia a Selenium."""
    try:
        return S.descargar_historico(**kwargs)
    except RuntimeError as e:
        print(f"ℹ️ requests no sirvió ({e}).\n🔁 Cambiando a Selenium…")
        return descargar_historico_selenium(**kwargs)


if __name__ == "__main__":
    df_web = descargar_historico_auto()
    print(df_web.head(10))
