"""Render the narration sentence by sentence with Kokoro and assemble exact pauses.

Pauses: 0.5 s between sentences, 1.5 s between paragraphs (inserted as digital silence).
Output: 24 kHz mono WAV master (normalized afterwards with ffmpeg loudnorm).
"""
import json
import re
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = sys.argv[1] if len(sys.argv) > 1 else "am_michael"
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 0.9
ONLY = sys.argv[3].split(",") if len(sys.argv) > 3 and sys.argv[3] else None
OUT = sys.argv[4] if len(sys.argv) > 4 else "master.wav"

SENT_PAUSE, PARA_PAUSE, EDGE = 0.5, 1.5, 0.3

kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
paragraphs = json.load(open("paragraphs.json"))


def trim(x, sr, thr_db=-45):
    """Remove leading/trailing silence so the inserted pauses are exact."""
    thr = 10 ** (thr_db / 20) * np.max(np.abs(x))
    idx = np.where(np.abs(x) > thr)[0]
    if idx.size == 0:
        return x
    pad = int(0.02 * sr)
    return x[max(idx[0] - pad, 0): idx[-1] + pad]


# espeak-ng G2P corrections (American English, Cambridge/Merriam-Webster reference).
GLOBAL_FIX = {
    "ɚrhˈɪθmiəz": "ɚɹˈɪðmiəz",          # arrhythmias
    "keɪlˈiːmiə": "kəlˈiːmiə",          # hyper-/hypokalemia
    "nætɹˈiːmiə": "nətɹˈiːmiə",         # hyper-/hyponatremia
    "dˌɪjuːɹˈɛɾɪks": "dˌaɪjəɹˈɛɾɪks",    # diuretics
    "dˈiːkɹiːst": "dᵻkɹˈiːst",          # decreased (verb)
    "wɪðˌɪn": "wɪðˈɪn",                 # within
    "ɐbnˈɔːɹməl": "æbnˈɔːɹməl",         # abnormal
    "ɑːbdʒˈɛktɪv": "əbdʒˈɛktɪv",        # objective
}
# Bare increase/decrease used as VERBS: stress on the 2nd syllable.
VERB_SENTENCES = {
    "Increase.", "Decrease.", "The verb is increase.",
    "Number five: increase and decrease, versus go up and go down.",
}


def to_phonemes(s):
    ph = kokoro.tokenizer.phonemize(s, "en-us")
    for a, b in GLOBAL_FIX.items():
        ph = ph.replace(a, b)
    if s in VERB_SENTENCES:
        ph = ph.replace("ˈɪŋkɹiːs", "ɪŋkɹˈiːs").replace("dˈiːkɹiːs", "dᵻkɹˈiːs")
    return ph


def sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.?!])\s+", text) if s.strip()]


chunks, sr, words, timeline = [], 24000, 0, []
for pid, text in paragraphs:
    if ONLY and pid not in ONLY:
        continue
    if chunks:
        chunks.append(np.zeros(int(PARA_PAUSE * sr), dtype=np.float32))
    start = sum(len(c) for c in chunks) / sr
    for i, s in enumerate(sentences(text)):
        audio, sr = kokoro.create(to_phonemes(s), voice=VOICE, speed=SPEED, is_phonemes=True)
        if i:
            chunks.append(np.zeros(int(SENT_PAUSE * sr), dtype=np.float32))
        chunks.append(trim(audio.astype(np.float32), sr))
    words += len(text.split())
    timeline.append((pid, start))

edge = np.zeros(int(EDGE * sr), dtype=np.float32)
out = np.concatenate([edge] + chunks + [edge])
sf.write(OUT, out, sr, subtype="PCM_16")
dur = len(out) / sr
print(f"voice={VOICE} speed={SPEED} words={words} dur={dur:.1f}s wpm={words / dur * 60:.1f}")
json.dump(timeline, open(OUT + ".timeline.json", "w"))
