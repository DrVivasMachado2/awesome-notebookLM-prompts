# -*- coding: utf-8 -*-
# %% [markdown]
# # 🎯 Baloto Master AI v5.0 — Edición refactorizada y honesta
#
# Reemplaza las ~16.000 líneas del notebook v4.0 por **un solo motor modular**:
#
# | Celda | Qué hace |
# |---|---|
# | 0 | Instalación opcional (solo OCR) |
# | 1 | Configuración y constantes |
# | 2 | Capa de datos: carga + validación estricta (sin datos inventados) |
# | 3 | Estadística descriptiva: frecuencias con IC, χ², vacíos, Markov 43×43 |
# | 4 | Motor de ponderación (estrategia lúdica, parámetros de la v4) |
# | 5 | Generador de combinaciones (sin "confianza" ficticia) |
# | 6 | Backtesting walk-forward contra azar puro |
# | 7 | OCR con confirmación manual + registro de nuevos sorteos |
# | 8 | Visualización (tema oscuro) |
# | 9 | Persistencia (CSV + JSON, sin pickle) y panel interactivo |
# | 10 | Ejecución |
#
# ⚖️ **Nota probabilística:** cada combinación de 5 balotas (1–43) + súper balota
# (1–16) tiene la misma probabilidad: 1 / 15.401.568. El análisis histórico es
# descriptivo y lúdico; no predice sorteos independientes. Juego responsable, +18.

# %%
# ── Celda 0 · Instalación opcional (solo si vas a usar OCR de imágenes) ──────────
INSTALAR_OCR = False

import subprocess
import sys

if INSTALAR_OCR:
    subprocess.run("apt-get -qq update && apt-get -qq install -y tesseract-ocr > /dev/null",
                   shell=True, check=False)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pytesseract"], check=False)

# %%
# ── Celda 1 · Configuración y constantes ─────────────────────────────────────────
import ast
import json
import logging
import math
import re
from dataclasses import asdict, dataclass, replace
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(levelname)s · %(message)s")
log = logging.getLogger("baloto")

VERSION = "5.0.0"
N_BALOTAS = 43                      # balotas principales 1..43
N_SB = 16                           # súper balota 1..16
K = 5                               # balotas por sorteo
COLS_B = [f"B{i}" for i in range(1, K + 1)]
COL_SB = "SB"
COMBINACIONES_TOTALES = math.comb(N_BALOTAS, K) * N_SB   # 15.401.568
TOTAL_FMT = f"{COMBINACIONES_TOTALES:,}".replace(",", ".")
MEDIA_ACIERTOS_AZAR = K * K / N_BALOTAS                  # 0,581 aciertos por ticket

ALIAS_COLUMNAS = {
    "b1": "B1", "b2": "B2", "b3": "B3", "b4": "B4", "b5": "B5",
    "sb": "SB", "superbalota": "SB", "super_balota": "SB", "súper balota": "SB",
    "super balota": "SB", "súper_balota": "SB",
    "fecha": "Fecha", "date": "Fecha",
    "juego": "Juego", "tipo": "Juego",
}


@dataclass(frozen=True)
class ConfigMotor:
    """Parámetros de la estrategia de ponderación (mismos valores por defecto que la v4)."""
    ventana_reciente: int = 60            # sorteos usados para "calientes"
    num_calientes: int = 12
    factor_caliente: float = 3.5
    factor_penalizacion_ultimo: float = 0.05   # antes "tensor de entropía"
    ventana_tibios: int = 20
    tibios_min: int = 2
    tibios_max: int = 4
    factor_tibios: float = 1.6
    peso_markov: float = 0.0              # 0 = sin Markov; 0..1 = mezcla lineal
    suavizado_markov: float = 1.0         # Laplace
    paso_temperatura: float = 0.15

    def __post_init__(self):
        if not 0 <= self.peso_markov <= 1:
            raise ValueError("peso_markov debe estar entre 0 y 1")
        if self.factor_penalizacion_ultimo <= 0 or self.factor_caliente <= 0 or self.factor_tibios <= 0:
            raise ValueError("Los factores multiplicativos deben ser > 0")
        if self.tibios_min > self.tibios_max:
            raise ValueError("tibios_min no puede ser mayor que tibios_max")


TEMA = {"fondo": "#050814", "cian": "#00f2ff", "oro": "#ffdb3c", "rojo": "#ff5555",
        "verde": "#00ff88", "violeta": "#aa00ff", "texto": "#e0e6ff"}

# %%
# ── Celda 2 · Capa de datos: carga y validación ──────────────────────────────────


def _en_colab() -> bool:
    try:
        import google.colab  # noqa: F401
        return True
    except ImportError:
        return False


def _normalizar_columnas(df: pd.DataFrame) -> pd.DataFrame:
    mapeo = {c: ALIAS_COLUMNAS.get(str(c).strip().lower(), str(c).strip()) for c in df.columns}
    return df.rename(columns=mapeo)


def cargar_historico(ruta_csv: str | None = None) -> pd.DataFrame:
    """Lee el histórico oficial desde un CSV. Sin ruta y en Colab abre el diálogo de carga.

    Columnas mínimas: B1..B5, SB. Opcionales: Fecha, Juego (Baloto/Revancha).
    """
    if ruta_csv:
        return pd.read_csv(ruta_csv)
    if _en_colab():
        import io
        from google.colab import files
        print("📂 Sube el CSV del histórico oficial (columnas B1..B5, SB; opcional Fecha, Juego)")
        subidos = files.upload()
        if not subidos:
            raise FileNotFoundError("No se subió ningún archivo.")
        nombre = next(iter(subidos))
        return pd.read_csv(io.BytesIO(subidos[nombre]))
    raise FileNotFoundError("Indica RUTA_CSV o activa MODO_DEMO.")


def parsear_fechas(serie: pd.Series) -> pd.Series:
    """Acepta ISO (2026-10-07) y día/mes/año (07/10/2026). Lo que no encaje queda como NaT.

    No se usa un único `dayfirst=True`: con fechas ISO convierte 2026-10-07 en 10 de julio.
    """
    texto = serie.astype(str).str.strip()
    iso = pd.to_datetime(texto, errors="coerce", format="ISO8601")
    dmy = pd.to_datetime(texto, errors="coerce", dayfirst=True, format="mixed")
    return iso.fillna(dmy)


def validar_historico(df: pd.DataFrame, juego: str | None = None) -> tuple[pd.DataFrame, dict]:
    """Limpia y valida el histórico. Nunca rellena con datos aleatorios.

    Reglas: 5 balotas enteras únicas en 1..43, SB en 1..16, balotas ordenadas por fila,
    sin sorteos duplicados (Fecha+Juego) y orden cronológico si existe Fecha.
    """
    df = _normalizar_columnas(df.copy())
    faltantes = [c for c in COLS_B + [COL_SB] if c not in df.columns]
    if faltantes:
        raise ValueError(f"Faltan columnas obligatorias: {faltantes}. Detectadas: {list(df.columns)}")

    reporte = {"filas_entrada": len(df)}

    if juego and "Juego" in df.columns:
        df = df[df["Juego"].astype(str).str.strip().str.lower() == juego.lower()]
        reporte["filtro_juego"] = juego

    num = df[COLS_B + [COL_SB]].apply(pd.to_numeric, errors="coerce")
    entero = num.notna().all(axis=1) & (num.fillna(0) % 1 == 0).all(axis=1)
    mat = num.fillna(0).to_numpy()
    rango_ok = ((mat[:, :K] >= 1) & (mat[:, :K] <= N_BALOTAS)).all(axis=1) & \
               (mat[:, K] >= 1) & (mat[:, K] <= N_SB)
    unicas_ok = np.array([len(set(fila)) == K for fila in mat[:, :K]])
    validas = entero.to_numpy() & rango_ok & unicas_ok
    reporte["filas_invalidas"] = int((~validas).sum())

    df = df.loc[validas].copy()
    df[COLS_B + [COL_SB]] = num.loc[validas].astype(int)

    balotas = df[COLS_B].to_numpy()
    ordenadas = np.sort(balotas, axis=1)
    reporte["filas_reordenadas"] = int((balotas != ordenadas).any(axis=1).sum())
    df[COLS_B] = ordenadas

    if "Fecha" in df.columns:
        df["Fecha"] = parsear_fechas(df["Fecha"])
        reporte["fechas_invalidas"] = int(df["Fecha"].isna().sum())
        claves = ["Fecha"] + (["Juego"] if "Juego" in df.columns else [])
        con_fecha = df["Fecha"].notna()
        antes = len(df)
        # Solo se deduplica entre filas con fecha válida: dos NaT no son "el mismo sorteo"
        df = pd.concat([df[con_fecha].drop_duplicates(subset=claves, keep="last"), df[~con_fecha]])
        reporte["duplicados_eliminados"] = antes - len(df)
        df = df.sort_values("Fecha", kind="stable", na_position="first")

    df = df.reset_index(drop=True)
    reporte["filas_validas"] = len(df)
    if df.empty:
        raise ValueError("El histórico no contiene sorteos válidos tras la validación.")
    if reporte["filas_invalidas"]:
        log.warning("Se descartaron %d filas inválidas.", reporte["filas_invalidas"])
    return df, reporte


def generar_historico_sintetico(n: int = 500, semilla: int = 42) -> pd.DataFrame:
    """SOLO para demo/pruebas. Marca el DataFrame como sintético."""
    rng = np.random.default_rng(semilla)
    b = np.sort(np.array([rng.choice(N_BALOTAS, K, replace=False) + 1 for _ in range(n)]), axis=1)
    df = pd.DataFrame(b, columns=COLS_B)
    df[COL_SB] = rng.integers(1, N_SB + 1, size=n)
    df.attrs["sintetico"] = True
    log.warning("⚠️ MODO DEMO: datos SINTÉTICOS. No representan sorteos reales.")
    return df


def matriz_balotas(df: pd.DataFrame) -> np.ndarray:
    return df[COLS_B].to_numpy(dtype=int)

# %%
# ── Celda 3 · Estadística descriptiva ────────────────────────────────────────────


def _intervalo_wilson(exitos: np.ndarray, n: int, z: float = 1.96) -> tuple[np.ndarray, np.ndarray]:
    p = exitos / n
    den = 1 + z**2 / n
    centro = (p + z**2 / (2 * n)) / den
    margen = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / den
    return centro - margen, centro + margen


def _chi2_sf(x: float, gl: int) -> float:
    try:
        from scipy.stats import chi2
        return float(chi2.sf(x, gl))
    except ImportError:  # aproximación de Wilson-Hilferty
        z = ((x / gl) ** (1 / 3) - (1 - 2 / (9 * gl))) / math.sqrt(2 / (9 * gl))
        return 0.5 * math.erfc(z / math.sqrt(2))


def tabla_frecuencias(df: pd.DataFrame, ventana: int | None = None) -> pd.DataFrame:
    """Frecuencia por balota, proporción de sorteos donde aparece e IC 95 % (Wilson)."""
    mat = matriz_balotas(df)[-ventana:] if ventana else matriz_balotas(df)
    n = len(mat)
    conteo = np.bincount(mat.ravel(), minlength=N_BALOTAS + 1)[1:]
    li, ls = _intervalo_wilson(conteo, n)
    return pd.DataFrame({
        "Balota": np.arange(1, N_BALOTAS + 1),
        "Frecuencia": conteo,
        "Esperada": round(n * K / N_BALOTAS, 2),
        "Proporción": conteo / n,
        "IC95_inf": li,
        "IC95_sup": ls,
    })


def test_uniformidad(df: pd.DataFrame) -> dict:
    """χ² de bondad de ajuste a la uniforme (aproximación) para balotas y súper balota."""
    mat = matriz_balotas(df)
    n = len(mat)
    obs_b = np.bincount(mat.ravel(), minlength=N_BALOTAS + 1)[1:]
    exp_b = n * K / N_BALOTAS
    chi_b = float(((obs_b - exp_b) ** 2 / exp_b).sum())
    obs_sb = np.bincount(df[COL_SB].to_numpy(dtype=int), minlength=N_SB + 1)[1:]
    exp_sb = n / N_SB
    chi_sb = float(((obs_sb - exp_sb) ** 2 / exp_sb).sum())
    return {
        "n_sorteos": n,
        "chi2_balotas": chi_b, "gl_balotas": N_BALOTAS - 1, "p_balotas": _chi2_sf(chi_b, N_BALOTAS - 1),
        "chi2_sb": chi_sb, "gl_sb": N_SB - 1, "p_sb": _chi2_sf(chi_sb, N_SB - 1),
        "advertencia_muestra": exp_sb < 5 or exp_b < 5,
    }


def resumen_descriptivo(df: pd.DataFrame) -> dict:
    mat = matriz_balotas(df)
    sumas = mat.sum(axis=1)
    vacios = np.diff(mat, axis=1).ravel()
    rangos = pd.cut(mat.ravel(), bins=[0, 10, 20, 30, 43], labels=["1-10", "11-20", "21-30", "31-43"])
    return {
        "suma_media": float(sumas.mean()), "suma_std": float(sumas.std(ddof=1)) if len(sumas) > 1 else 0.0,
        "pares_media": float((mat % 2 == 0).sum(axis=1).mean()),
        "vacio_medio": float(vacios.mean()), "vacio_std": float(vacios.std(ddof=1)) if len(vacios) > 1 else 0.0,
        "distribucion_rangos": pd.Series(rangos).value_counts(normalize=True).sort_index().round(3).to_dict(),
        "sb_mas_frecuente": int(df[COL_SB].mode().iloc[0]),
    }


def matriz_transicion_markov(df: pd.DataFrame, alpha: float = 1.0) -> np.ndarray:
    """Matriz 43×43: P[i, j] = P(j aparece en t+1 | i apareció en t), suavizado de Laplace."""
    mat = matriz_balotas(df) - 1
    conteos = np.zeros((N_BALOTAS, N_BALOTAS))
    if len(mat) > 1:
        previos, siguientes = mat[:-1], mat[1:]
        filas = np.repeat(previos, K, axis=1).ravel()      # cada i del sorteo t ...
        cols = np.tile(siguientes, (1, K)).ravel()          # ... contra cada j de t+1
        np.add.at(conteos, (filas, cols), 1)
    conteos += alpha
    totales = conteos.sum(axis=1, keepdims=True)
    return np.divide(conteos, totales, out=np.full_like(conteos, 1 / N_BALOTAS), where=totales > 0)


def vector_markov(P: np.ndarray, ultimo_sorteo: np.ndarray) -> np.ndarray:
    v = P[np.asarray(ultimo_sorteo, dtype=int) - 1].mean(axis=0)
    return v / v.sum()

# %%
# ── Celda 4 · Motor de ponderación (estrategia lúdica) ───────────────────────────


def _pesos_desde_matriz(mat: np.ndarray, cfg: ConfigMotor, P_markov: np.ndarray | None = None) -> np.ndarray:
    """Función pura: siempre parte de pesos uniformes (corrige la mutación acumulativa de la v4)."""
    w = np.ones(N_BALOTAS)
    if len(mat) == 0:
        return w / N_BALOTAS

    recientes = np.bincount(mat[-cfg.ventana_reciente:].ravel(), minlength=N_BALOTAS + 1)[1:]
    calientes = np.argsort(-recientes, kind="stable")[:cfg.num_calientes]
    w[calientes] *= cfg.factor_caliente

    w[mat[-1] - 1] *= cfg.factor_penalizacion_ultimo

    tibios_conteo = np.bincount(mat[-cfg.ventana_tibios:].ravel(), minlength=N_BALOTAS + 1)[1:]
    tibios = (tibios_conteo >= cfg.tibios_min) & (tibios_conteo <= cfg.tibios_max)
    w[tibios] *= cfg.factor_tibios
    w /= w.sum()

    if cfg.peso_markov > 0 and len(mat) > 1:
        if P_markov is None:
            P_markov = matriz_transicion_markov(pd.DataFrame(mat, columns=COLS_B), cfg.suavizado_markov)
        w = (1 - cfg.peso_markov) * w + cfg.peso_markov * vector_markov(P_markov, mat[-1])
    return w / w.sum()


def calcular_pesos(df: pd.DataFrame, cfg: ConfigMotor) -> np.ndarray:
    return _pesos_desde_matriz(matriz_balotas(df), cfg)

# %%
# ── Celda 5 · Generador de combinaciones ─────────────────────────────────────────


def generar_combinaciones(pesos: np.ndarray, n: int = 5, cfg: ConfigMotor = ConfigMotor(),
                          semilla: int | None = None, incluir_uniforme: bool = True) -> pd.DataFrame:
    """Genera n combinaciones únicas. Ticket 1 = azar uniforme (línea base) si incluir_uniforme.

    La súper balota se sortea uniforme (1..16): no hay evidencia de dependencia con las principales.
    """
    rng = np.random.default_rng(semilla)
    universo = np.arange(1, N_BALOTAS + 1)
    filas, vistas = [], set()
    i = 0
    while len(filas) < n:
        if incluir_uniforme and len(filas) == 0:
            p, metodo = None, "Uniforme (línea base)"
        else:
            T = 1.0 + cfg.paso_temperatura * len(filas)
            p = pesos ** (1 / T)
            p = p / p.sum()
            metodo = f"Ponderado T={T:.2f}"
        b = np.sort(rng.choice(universo, K, replace=False, p=p))
        sb = int(rng.integers(1, N_SB + 1))
        clave = (tuple(b.tolist()), sb)
        i += 1
        if clave in vistas and i < n * 50:
            continue
        vistas.add(clave)
        filas.append({
            "Ticket": len(filas) + 1, "Balotas": b.tolist(), "SB": sb,
            "Suma": int(b.sum()), "Rango": int(b[-1] - b[0]),
            "Pares": int((b % 2 == 0).sum()), "Método": metodo,
        })
    return pd.DataFrame(filas)

# %%
# ── Celda 6 · Backtesting walk-forward contra azar puro ──────────────────────────


def distribucion_teorica_aciertos() -> np.ndarray:
    """Hipergeométrica: P(k aciertos de 5) con 43 balotas."""
    total = math.comb(N_BALOTAS, K)
    return np.array([math.comb(K, k) * math.comb(N_BALOTAS - K, K - k) / total for k in range(K + 1)])


def backtest_walk_forward(df: pd.DataFrame, cfg: ConfigMotor, n_sorteos: int = 200,
                          tickets_por_sorteo: int = 5, min_historia: int = 100,
                          semilla: int = 2026) -> dict:
    """Para cada sorteo t usa SOLO datos < t (sin fuga de información) y compara
    aciertos del motor frente a tickets uniformes. Prueba pareada por sorteo."""
    mat = matriz_balotas(df)
    inicio = max(min_historia, len(mat) - n_sorteos)
    if inicio >= len(mat):
        raise ValueError(f"Histórico insuficiente: {len(mat)} sorteos (mínimo {min_historia + 1}).")

    rng = np.random.default_rng(semilla)
    universo = np.arange(1, N_BALOTAS + 1)
    hist_modelo = np.zeros(K + 1, dtype=int)
    hist_azar = np.zeros(K + 1, dtype=int)
    diferencias = []

    for t in range(inicio, len(mat)):
        w = _pesos_desde_matriz(mat[:t], cfg)
        objetivo = mat[t]
        am = [np.isin(rng.choice(universo, K, replace=False, p=w), objetivo).sum()
              for _ in range(tickets_por_sorteo)]
        aa = [np.isin(rng.choice(universo, K, replace=False), objetivo).sum()
              for _ in range(tickets_por_sorteo)]
        hist_modelo += np.bincount(am, minlength=K + 1)
        hist_azar += np.bincount(aa, minlength=K + 1)
        diferencias.append(np.mean(am) - np.mean(aa))

    d = np.asarray(diferencias)
    n = len(d)
    t_stat = d.mean() / (d.std(ddof=1) / math.sqrt(n)) if n > 1 and d.std(ddof=1) > 0 else 0.0
    p_valor = math.erfc(abs(t_stat) / math.sqrt(2))   # aproximación normal (n ≥ 30)
    total = hist_modelo.sum()
    return {
        "sorteos_evaluados": n,
        "tickets_por_sorteo": tickets_por_sorteo,
        "media_aciertos_modelo": float((hist_modelo * np.arange(K + 1)).sum() / total),
        "media_aciertos_azar": float((hist_azar * np.arange(K + 1)).sum() / total),
        "media_teorica": MEDIA_ACIERTOS_AZAR,
        "diferencia_media": float(d.mean()),
        "t": float(t_stat), "p_valor": float(p_valor),
        "tabla": pd.DataFrame({
            "Aciertos": np.arange(K + 1),
            "Motor": hist_modelo,
            "Azar": hist_azar,
            "Esperado teórico": np.round(distribucion_teorica_aciertos() * total, 1),
        }),
    }

# %%
# ── Celda 7 · OCR asistido y registro manual de sorteos ──────────────────────────
PATRON_FECHA = re.compile(r"\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b")


def extraer_numeros_ocr(ruta_imagen: str) -> list[int]:
    """Devuelve los números candidatos (1..43) leídos de una imagen.

    NO registra nada: el resultado debe verificarse a ojo y pasarse a registrar_sorteo().
    """
    import cv2
    import pytesseract

    img = cv2.imread(ruta_imagen)
    if img is None:
        raise FileNotFoundError(f"No se pudo leer la imagen: {ruta_imagen}")
    gris = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gris = cv2.GaussianBlur(gris, (5, 5), 0)
    binaria = cv2.threshold(gris, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    texto = pytesseract.image_to_string(binaria, config="--psm 6")
    texto = PATRON_FECHA.sub(" ", texto)                 # evita que la fecha contamine
    candidatos = [int(x) for x in re.findall(r"\b\d{1,2}\b", texto) if 1 <= int(x) <= N_BALOTAS]
    print(f"👁️ Candidatos OCR (verifícalos contra la imagen): {candidatos}")
    return candidatos


def registrar_sorteo(df: pd.DataFrame, balotas, sb: int, fecha: str | None = None,
                     juego: str | None = None) -> pd.DataFrame:
    """Añade un sorteo verificado. Acepta lista o texto '[1, 2, 3, 4, 5]'. Devuelve un DataFrame nuevo."""
    if isinstance(balotas, str):
        balotas = ast.literal_eval(balotas)   # seguro (la v4 usaba eval)
    if len(balotas) != K:
        raise ValueError(f"Se requieren exactamente {K} balotas, recibidas {len(balotas)}.")
    fila = dict(zip(COLS_B, sorted(int(x) for x in balotas)))
    fila[COL_SB] = int(sb)
    if "Fecha" in df.columns or fecha:
        fila["Fecha"] = fecha
    if "Juego" in df.columns or juego:
        fila["Juego"] = juego
    nuevo = pd.concat([df, pd.DataFrame([fila])], ignore_index=True)
    validado, rep = validar_historico(nuevo)
    if rep["filas_invalidas"]:
        raise ValueError(f"Sorteo inválido: {fila}")
    if len(validado) == len(df):
        log.warning("El sorteo ya existía (misma Fecha/Juego): se conservó la versión nueva.")
    return validado

# %%
# ── Celda 8 · Visualización (tema oscuro) ────────────────────────────────────────


def _tema(ax, titulo: str, xlabel: str = "", ylabel: str = ""):
    ax.set_facecolor(TEMA["fondo"])
    ax.figure.patch.set_facecolor(TEMA["fondo"])
    ax.set_title(titulo, color="white", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel(xlabel, color="white")
    ax.set_ylabel(ylabel, color="white")
    ax.tick_params(colors="white")
    for s in ax.spines.values():
        s.set_color("#334")
    ax.grid(axis="y", linestyle="--", alpha=0.25, color=TEMA["cian"])


def graficar_frecuencias(tabla: pd.DataFrame, titulo: str = "Frecuencia histórica por balota"):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(15, 5))
    ax.bar(tabla["Balota"], tabla["Frecuencia"], color=TEMA["cian"], alpha=0.85)
    ax.axhline(tabla["Esperada"].iloc[0], color=TEMA["oro"], linestyle="--", label="Esperada bajo azar")
    ax.set_xticks(tabla["Balota"])
    _tema(ax, titulo, "Balota", "Apariciones")
    ax.legend(facecolor=TEMA["fondo"], labelcolor="white")
    plt.tight_layout()
    plt.show()


def graficar_markov(P: np.ndarray):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(9, 8))
    im = ax.imshow(P, cmap="magma", origin="lower", extent=[0.5, N_BALOTAS + 0.5, 0.5, N_BALOTAS + 0.5])
    _tema(ax, "Matriz de transición de Markov 43×43", "Balota en t+1", "Balota en t")
    ax.grid(False)
    cb = fig.colorbar(im, ax=ax)
    cb.ax.yaxis.set_tick_params(color="white", labelcolor="white")
    plt.tight_layout()
    plt.show()


def graficar_vacios(df: pd.DataFrame):
    import matplotlib.pyplot as plt
    vacios = np.diff(matriz_balotas(df), axis=1).ravel()
    media, std = vacios.mean(), vacios.std(ddof=1)
    fig, ax = plt.subplots(figsize=(12, 5))
    ax.hist(vacios, bins=np.arange(1, vacios.max() + 2) - 0.5, color=TEMA["cian"], edgecolor=TEMA["fondo"])
    ax.axvline(media, color=TEMA["oro"], linestyle="--", label=f"Media {media:.1f}")
    ax.axvline(media + std, color=TEMA["rojo"], linestyle=":", label=f"+1 DE {media + std:.1f}")
    _tema(ax, "Vacíos entre balotas consecutivas", "Distancia", "Frecuencia")
    ax.legend(facecolor=TEMA["fondo"], labelcolor="white")
    plt.tight_layout()
    plt.show()


def graficar_backtest(res: dict):
    import matplotlib.pyplot as plt
    tabla = res["tabla"]
    x = tabla["Aciertos"].to_numpy()
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.bar(x - 0.27, tabla["Motor"], width=0.27, color=TEMA["violeta"], label="Motor v5")
    ax.bar(x, tabla["Azar"], width=0.27, color=TEMA["cian"], label="Azar uniforme")
    ax.bar(x + 0.27, tabla["Esperado teórico"], width=0.27, color=TEMA["oro"], label="Teórico")
    ax.set_yscale("log")
    _tema(ax, f"Backtest walk-forward · p = {res['p_valor']:.3f}", "Aciertos por ticket", "Tickets (log)")
    ax.legend(facecolor=TEMA["fondo"], labelcolor="white")
    plt.tight_layout()
    plt.show()

# %%
# ── Celda 9 · Persistencia y panel interactivo ───────────────────────────────────


def guardar_estado(df: pd.DataFrame, cfg: ConfigMotor, carpeta: str = "/content/BalotoMasterAI",
                   usar_drive: bool = False) -> Path:
    """Guarda histórico (CSV) y parámetros (JSON). Sin pickle: portable entre versiones."""
    if usar_drive and _en_colab():
        from google.colab import drive
        drive.mount("/content/drive")
        carpeta = "/content/drive/MyDrive/BalotoMasterAI"
    destino = Path(carpeta)
    destino.mkdir(parents=True, exist_ok=True)
    df.to_csv(destino / "historico_validado.csv", index=False)
    (destino / "config_motor.json").write_text(json.dumps(asdict(cfg), indent=2), encoding="utf-8")
    print(f"💾 Estado guardado en {destino}")
    return destino


def cargar_config(ruta_json: str) -> ConfigMotor:
    return ConfigMotor(**json.loads(Path(ruta_json).read_text(encoding="utf-8")))


def mostrar_panel(df: pd.DataFrame, cfg: ConfigMotor):
    """Panel con ipywidgets (incluido en Colab). Sustituye el puente HTML/JS frágil de la v4."""
    import ipywidgets as w
    from IPython.display import clear_output, display

    n_tickets = w.IntSlider(value=5, min=1, max=12, description="Tickets")
    penal = w.FloatSlider(value=cfg.factor_penalizacion_ultimo, min=0.01, max=1.0, step=0.01,
                          description="Penal. último")
    markov = w.FloatSlider(value=cfg.peso_markov, min=0, max=1, step=0.05, description="Peso Markov")
    boton = w.Button(description="🎲 Generar", button_style="info")
    salida = w.Output()

    def _generar(_):
        with salida:
            clear_output()
            c = replace(cfg, factor_penalizacion_ultimo=penal.value, peso_markov=markov.value)
            display(generar_combinaciones(calcular_pesos(df, c), n_tickets.value, c))
            print(f"⚖️ Cada combinación: 1 / {TOTAL_FMT} de ganar el premio mayor.")

    boton.on_click(_generar)
    display(w.VBox([w.HBox([n_tickets, penal, markov]), boton, salida]))

# %%
# ── Celda 10 · Ejecución ─────────────────────────────────────────────────────────
RUTA_CSV = None          # p. ej. "/content/historico_baloto.csv"; None = diálogo de carga en Colab
JUEGO = None             # "Baloto" o "Revancha" si tu CSV trae la columna Juego (no mezclar)
MODO_DEMO = False        # True = datos sintéticos (solo para probar el código)
NUM_TICKETS = 5
CONFIG = ConfigMotor()   # ajusta aquí: ConfigMotor(factor_penalizacion_ultimo=0.15, peso_markov=0.3)


def main(ruta_csv=RUTA_CSV, demo=MODO_DEMO, juego=JUEGO, cfg=CONFIG, graficos=True, panel=True) -> dict:
    from IPython.display import display

    crudo = generar_historico_sintetico() if demo else cargar_historico(ruta_csv)
    df, rep = validar_historico(crudo, juego=juego)
    print(f"✅ Baloto Master AI v{VERSION} · {rep['filas_validas']} sorteos válidos · reporte: {rep}")

    uni = test_uniformidad(df)
    desc = resumen_descriptivo(df)
    print(f"📊 χ² balotas p={uni['p_balotas']:.3f} · χ² SB p={uni['p_sb']:.3f} "
          f"(p ≥ 0,05 → consistente con azar uniforme)")
    print(f"📏 Suma media {desc['suma_media']:.1f} ± {desc['suma_std']:.1f} · vacío medio "
          f"{desc['vacio_medio']:.2f} ± {desc['vacio_std']:.2f}")

    frec = tabla_frecuencias(df)
    P = matriz_transicion_markov(df, cfg.suavizado_markov)
    pesos = calcular_pesos(df, cfg)
    tickets = generar_combinaciones(pesos, NUM_TICKETS, cfg)
    display(tickets)

    bt = None
    if len(df) > 150:
        bt = backtest_walk_forward(df, cfg)
        display(bt["tabla"])
        print(f"🧪 Backtest ({bt['sorteos_evaluados']} sorteos): motor {bt['media_aciertos_modelo']:.3f} vs "
              f"azar {bt['media_aciertos_azar']:.3f} aciertos/ticket (teórico {MEDIA_ACIERTOS_AZAR:.3f}), "
              f"p = {bt['p_valor']:.3f}")

    if graficos:
        graficar_frecuencias(frec)
        graficar_markov(P)
        graficar_vacios(df)
        if bt:
            graficar_backtest(bt)
    if panel and _en_colab():
        mostrar_panel(df, cfg)

    print(f"\n⚖️ Todas las combinaciones tienen la misma probabilidad: 1 / {TOTAL_FMT}. "
          "Análisis descriptivo y lúdico, no predictivo. Juego responsable, +18.")
    return {"df": df, "reporte": rep, "uniformidad": uni, "descriptivo": desc, "frecuencias": frec,
            "markov": P, "pesos": pesos, "tickets": tickets, "backtest": bt}


if __name__ == "__main__":
    resultados = main()
