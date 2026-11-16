"""Transcribe voice files back to text (faster-whisper) to check what the TTS actually said.

  python scripts/voice_check.py asset_src/voice/audition_Gacrux.mp3 [more.mp3 ...]
  python scripts/voice_check.py --all        # every line in scripts/voice_lines.json vs public/voice
Prints the transcript and a rough word-match score against the intended text.
"""
import json, re, sys, unicodedata
from pathlib import Path
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent


def norm(s: str) -> list[str]:
    s = unicodedata.normalize('NFC', s.lower())
    return re.findall(r'\w+', s)


def score(want: str, got: str) -> float:
    a, b = norm(want), norm(got)
    if not a:
        return 0.0
    hit = sum(1 for w in a if w in set(b))
    extra = max(0, len(b) - len(a))
    return round(hit / len(a) - extra / max(len(a), 1) * 0.5, 2)


def main():
    model = WhisperModel('medium', device='cpu', compute_type='int8')
    args = sys.argv[1:]
    jobs = []
    if args == ['--all']:
        for item in json.loads((ROOT / 'scripts' / 'voice_lines.json').read_text(encoding='utf-8')):
            f = ROOT / 'public' / 'voice' / f"{item['id']}.mp3"
            if f.exists():
                jobs.append((f, item['text']))
    else:
        jobs = [(Path(a), '') for a in args]
    for f, want in jobs:
        segs, _ = model.transcribe(str(f), language='vi', beam_size=5)
        got = ' '.join(s.text.strip() for s in segs)
        print(f'{f.name}: {score(want, got) if want else "-"} | {got}')


if __name__ == '__main__':
    main()
