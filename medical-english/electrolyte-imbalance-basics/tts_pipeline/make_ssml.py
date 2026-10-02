"""Generate the SSML narration script (paste-ready for Azure / Google / Amazon Polly / ElevenLabs).

0.5 s between sentences, 1.5 s between paragraphs, <emphasis> on the target structures,
<phoneme> for the verb/noun stress contrast of increase/decrease.
"""
import html
import json
import re

TARGETS = [
    "much too high", "far too high", "too very high", "too high", "too low", "too much", "too little",
    "too many", "too few", "not enough", "needs to be", "need to be", "doesn't need to be",
    "mustn't be", "higher than", "lower than", "within the reference range", "above the reference range",
    "below the reference range", "below the expected range", "above of the range",
]
PHONEMES = {
    "The verb is increase.": 'The verb is <phoneme alphabet="ipa" ph="ɪnˈkriːs">increase</phoneme>.',
    "The noun is an increase.": 'The noun is an <phoneme alphabet="ipa" ph="ˈɪnkriːs">increase</phoneme>.',
}

paragraphs = json.load(open("paragraphs.json"))
out = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">',
       '  <!-- Voice: American English, male, warm and didactic. Target: 110-120 wpm, -14 LUFS. -->',
       '  <prosody rate="90%" pitch="-2%">']
pattern = re.compile("|".join(re.escape(t) for t in sorted(TARGETS, key=len, reverse=True)), re.I)
for pid, text in paragraphs:
    sents = [s for s in re.split(r"(?<=[.?!])\s+", text) if s.strip()]
    out.append(f"    <!-- {pid} -->")
    out.append("    <p>")
    for i, s in enumerate(sents):
        body = PHONEMES.get(s) or pattern.sub(lambda m: f'<emphasis level="moderate">{m.group(0)}</emphasis>',
                                              html.escape(s, quote=False))
        brk = '<break time="0.5s"/>' if i < len(sents) - 1 else ""
        out.append(f"      <s>{body}</s>{brk}")
    out.append("    </p>")
    out.append('    <break time="1.5s"/>')
out += ["  </prosody>", "</speak>", ""]
open("../script_tts.ssml", "w").write("\n".join(out))
