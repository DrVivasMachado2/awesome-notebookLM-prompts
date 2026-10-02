# TTS pipeline (reproducible)

1. `pip install kokoro-onnx soundfile`
2. Download `kokoro-v1.0.onnx` and `voices-v1.0.bin` from
   https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 into this folder.
3. `python3 build.py am_michael 0.9` → `master.wav` (sentence-level synthesis, exact 0.5 s / 1.5 s pauses, G2P fixes).
4. `./master.sh master.wav ../electrolyte_imbalance_basics_narration` → MP3 320 kbps + WAV at -14 LUFS.
5. `python3 make_ssml.py` → `../script_tts.ssml` for any professional TTS engine.

Edit `paragraphs.json` to change the narration text.
