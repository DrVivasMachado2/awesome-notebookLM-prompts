#!/usr/bin/env bash
# Master the narration: peak-limit, two-pass EBU R128 loudnorm to -14 LUFS / -1.5 dBTP, MP3 320 kbps + WAV.
set -euo pipefail
IN=${1:-master.wav}; OUT=${2:-electrolyte_imbalance_basics_narration}
ffmpeg -hide_banner -y -loglevel error -i "$IN" -af "volume=10dB,alimiter=limit=0.6:attack=5:release=50:level=false" -c:a pcm_s16le pre.wav
LN=$(ffmpeg -hide_banner -i pre.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' | python3 -c "
import json,sys;d=json.load(sys.stdin)
print('loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}:linear=true'.format(**d))")
ffmpeg -hide_banner -y -loglevel error -i pre.wav -af "$LN,aresample=44100" -ar 44100 -ac 1 -c:a libmp3lame -b:a 320k -id3v2_version 3 \
  -metadata title="Electrolyte Imbalance Basics - Narration" -metadata artist="Word Maestro - Medical English" -metadata album="Medical English B1-C1" -metadata date=2026 "$OUT.mp3"
ffmpeg -hide_banner -y -loglevel error -i pre.wav -af "$LN,aresample=44100" -ar 44100 -ac 1 -c:a pcm_s16le "$OUT.wav"
ffmpeg -hide_banner -nostats -i "$OUT.mp3" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p' | grep -E " I:|Peak:"
rm -f pre.wav
