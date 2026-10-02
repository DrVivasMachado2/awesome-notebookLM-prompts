"""Two-voice rendering of Dialogue 1: [M] am_michael, [F] af_heart.

0.5 s between sentences, 1.5 s between turns; each turn RMS-matched so both voices sit at the same level.
"""
import json
import sys

import numpy as np
import soundfile as sf

sys.argv = ["build.py"]
exec(open("build.py").read().split("def sentences")[0])  # kokoro, to_phonemes, trim
exec("def sentences" + open("build.py").read().split("def sentences")[1].split("chunks, sr")[0])

VOICES = {"M": "am_michael", "F": "af_heart"}
SPEED, SENT, TURN, EDGE, SR = 0.9, 0.5, 1.5, 0.3, 24000
turns = json.load(open("dialogue1.json"))
target_rms, parts, words = 0.08, [], 0
for n, (who, text) in enumerate(turns):
    seg = []
    for i, s in enumerate(sentences(text)):
        a, _ = kokoro.create(to_phonemes(s), voice=VOICES[who], speed=SPEED, is_phonemes=True)
        if i:
            seg.append(np.zeros(int(SENT * SR), np.float32))
        seg.append(trim(a.astype(np.float32), SR))
    seg = np.concatenate(seg)
    voiced = seg[np.abs(seg) > 0.01]
    seg *= target_rms / np.sqrt(np.mean(voiced ** 2))
    if n:
        parts.append(np.zeros(int(TURN * SR), np.float32))
    parts.append(seg)
    words += len(text.split())
edge = np.zeros(int(EDGE * SR), np.float32)
out = np.clip(np.concatenate([edge] + parts + [edge]), -1, 1)
sf.write("dialogue1.wav", out, SR, subtype="PCM_16")
print(f"words={words} dur={len(out)/SR:.1f}s wpm={words/(len(out)/SR)*60:.1f}")
