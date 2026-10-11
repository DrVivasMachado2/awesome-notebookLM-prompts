# -*- coding: utf-8 -*-
"""Lección 1 · De la captura de baloto.com al CSV que entiende el motor v5.

Ejecuta en Colab después de `%run baloto_master_ai_v5.py`.
"""
import re
import pandas as pd

# 1) Lo que ves en la pantalla, transcrito tal cual (una línea por sorteo)
TEXTO_PANTALLA = """
Baloto   | 7 de Octubre de 2026    | 05 - 17 - 19 - 27 - 39 - 08
Revancha | 7 de Octubre de 2026    | 06 - 09 - 16 - 36 - 39 - 04
Baloto   | 5 de Octubre de 2026    | 13 - 14 - 16 - 25 - 28 - 08
Revancha | 5 de Octubre de 2026    | 14 - 15 - 32 - 40 - 42 - 16
Baloto   | 3 de Octubre de 2026    | 03 - 10 - 14 - 26 - 31 - 10
Revancha | 3 de Octubre de 2026    | 19 - 23 - 27 - 38 - 40 - 14
Baloto   | 30 de Septiembre de 2026 | 11 - 18 - 22 - 30 - 32 - 10
Revancha | 30 de Septiembre de 2026 | 04 - 10 - 14 - 18 - 23 - 07
Baloto   | 28 de Septiembre de 2026 | 12 - 13 - 15 - 25 - 29 - 10
Revancha | 28 de Septiembre de 2026 | 16 - 19 - 24 - 26 - 28 - 02
"""

# 2) Diccionario: traduce el mes en palabras al número que entiende pandas
MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
         "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}


def fecha_a_iso(texto: str) -> str:
    """'7 de Octubre de 2026' -> '2026-10-07' (formato ISO, el que nunca se malinterpreta)."""
    dia, mes, anio = re.match(r"(\d{1,2}) de (\w+) de (\d{4})", texto.strip()).groups()
    return f"{anio}-{MESES[mes.lower()]:02d}-{int(dia):02d}"


def parsear_linea(linea: str) -> dict:
    """Convierte 'Baloto | 7 de Octubre de 2026 | 05 - 17 - ... - 08' en una fila con nombre por columna."""
    juego, fecha, resultado = [parte.strip() for parte in linea.split("|")]
    numeros = [int(n) for n in resultado.split("-")]          # '05' -> 5
    if len(numeros) != 6:
        raise ValueError(f"Esperaba 6 números y encontré {len(numeros)}: {linea}")
    balotas, sb = numeros[:5], numeros[5]
    fila = {"Fecha": fecha_a_iso(fecha), "Juego": juego}
    fila.update({f"B{i + 1}": b for i, b in enumerate(balotas)})
    fila["SB"] = sb
    return fila


def texto_a_dataframe(texto: str) -> pd.DataFrame:
    lineas = [l for l in texto.strip().splitlines() if l.strip()]   # ignora líneas vacías
    return pd.DataFrame([parsear_linea(l) for l in lineas])


if __name__ == "__main__":
    df_semilla = texto_a_dataframe(TEXTO_PANTALLA)
    df_semilla.to_csv("historico_semilla.csv", index=False)
    print(df_semilla)
