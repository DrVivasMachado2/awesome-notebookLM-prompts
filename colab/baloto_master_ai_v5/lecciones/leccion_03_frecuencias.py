# -*- coding: utf-8 -*-
"""Lección 3 · Frecuencias e intervalos de confianza: por qué un número "caliente" casi nunca lo es.

Uso en Colab (después de `%run baloto_master_ai_v5.py`):
    %run lecciones/leccion_03_frecuencias.py
"""
import math

import numpy as np
import pandas as pd

import baloto_master_ai_v5 as B

RUTA_CSV = "lecciones/historico_semilla.csv"
JUEGO = "Revancha"


# ── Paso 1 · Frecuencia observada vs esperada ────────────────────────────────────
def tabla_calientes(df: pd.DataFrame, top: int = 5) -> pd.DataFrame:
    """Los `top` números más vistos, con su IC 95 % y la proporción esperada bajo azar (5/43)."""
    t = B.tabla_frecuencias(df)                       # ya calcula frecuencia e IC Wilson
    t["Esperada_prop"] = B.K / B.N_BALOTAS            # 5/43 = 0,116: cada balota sale en 11,6 % de sorteos
    t["IC_incluye_azar"] = (t["IC95_inf"] <= t["Esperada_prop"]) & (t["Esperada_prop"] <= t["IC95_sup"])
    return t.sort_values("Frecuencia", ascending=False).head(top).round(3)


# ── Paso 2 · ¿Qué tan ancho es el intervalo según N? ─────────────────────────────
def ancho_ic_vs_n(ns=(10, 50, 100, 250, 635, 1270, 5000)) -> pd.DataFrame:
    """Para una balota con la frecuencia esperada, cuánto mide el IC 95 % a distintos tamaños de muestra."""
    filas = []
    for n in ns:
        exitos = np.array([n * B.K / B.N_BALOTAS])    # la frecuencia "justa"
        li, ls = B._intervalo_wilson(exitos, n)
        filas.append({"N sorteos": n, "Proporción": round(B.K / B.N_BALOTAS, 3),
                      "IC95_inf": round(float(li[0]), 3), "IC95_sup": round(float(ls[0]), 3),
                      "Ancho": round(float(ls[0] - li[0]), 3)})
    return pd.DataFrame(filas)


# ── Paso 3 · Simulación: en un juego PERFECTAMENTE justo, ¿cuánto sale el "más caliente"? ──
def simular_maximo(n_sorteos: int, repeticiones: int = 20_000, semilla: int = 7) -> np.ndarray:
    """Repite `repeticiones` veces: sortea n_sorteos justos y anota cuántas veces salió el número más frecuente."""
    rng = np.random.default_rng(semilla)
    maximos = np.empty(repeticiones, dtype=int)
    for i in range(repeticiones):
        bolas = np.array([rng.choice(B.N_BALOTAS, B.K, replace=False) for _ in range(n_sorteos)]).ravel()
        maximos[i] = np.bincount(bolas, minlength=B.N_BALOTAS).max()
    return maximos


def probabilidad_de_ver(maximos: np.ndarray, umbral: int) -> float:
    """P(el número más repetido salga `umbral` veces o más) en un juego justo."""
    return float((maximos >= umbral).mean())


# ── Paso 4 · ¿Cuántos sorteos harían falta para detectar un sesgo real? ──────────
def n_para_detectar(p_real: float, p0: float = B.K / B.N_BALOTAS, z_alfa: float = 1.96, z_beta: float = 0.84) -> int:
    """Tamaño de muestra para detectar que una balota sale con probabilidad p_real en vez de p0 (α=5 %, potencia 80 %)."""
    num = (z_alfa * math.sqrt(p0 * (1 - p0)) + z_beta * math.sqrt(p_real * (1 - p_real))) ** 2
    return math.ceil(num / (p_real - p0) ** 2)


def graficar_ic(df: pd.DataFrame, titulo: str):
    import matplotlib.pyplot as plt
    t = B.tabla_frecuencias(df)
    fig, ax = plt.subplots(figsize=(15, 5))
    ax.errorbar(t["Balota"], t["Proporción"], yerr=[t["Proporción"] - t["IC95_inf"], t["IC95_sup"] - t["Proporción"]],
                fmt="o", color=B.TEMA["cian"], ecolor="#4a6", capsize=3, label="Proporción observada ± IC 95 %")
    ax.axhline(B.K / B.N_BALOTAS, color=B.TEMA["oro"], linestyle="--", label="Esperada bajo azar (5/43)")
    ax.set_xticks(t["Balota"])
    B._tema(ax, titulo, "Balota", "Proporción de sorteos en que aparece")
    ax.legend(facecolor=B.TEMA["fondo"], labelcolor="white")
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    df, rep = B.validar_historico(pd.read_csv(RUTA_CSV), juego=JUEGO)
    n = len(df)
    print(f"📊 {JUEGO}: N = {n} sorteos\n")

    print("1) Los 5 números más vistos y su intervalo de confianza:")
    print(tabla_calientes(df)[["Balota", "Frecuencia", "Proporción", "IC95_inf", "IC95_sup", "Esperada_prop", "IC_incluye_azar"]].to_string(index=False))

    print("\n2) Ancho del IC 95 % según el tamaño de muestra:")
    print(ancho_ic_vs_n().to_string(index=False))

    print(f"\n3) Simulación de un juego JUSTO ({n} sorteos, 20.000 repeticiones):")
    maximos = simular_maximo(n)
    obs_max = int(B.tabla_frecuencias(df)["Frecuencia"].max())
    for u in range(3, 8):
        print(f"   P(algún número salga ≥ {u} veces) = {probabilidad_de_ver(maximos, u):.1%}")
    print(f"   → En tus datos el máximo fue {obs_max}. P(≥ {obs_max} en un juego justo) = {probabilidad_de_ver(maximos, obs_max):.1%}")

    print("\n4) Sorteos necesarios para detectar un sesgo real (α = 5 %, potencia 80 %):")
    for p in (0.15, 0.13, 0.125):
        print(f"   si una balota saliera el {p:.1%} de las veces en vez del 11,6 %: N ≈ {n_para_detectar(p):,}".replace(",", "."))

    graficar_ic(df, f"{JUEGO} · proporción por balota con IC 95 % (N = {n})")
