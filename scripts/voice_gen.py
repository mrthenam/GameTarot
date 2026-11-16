"""Witch voice lines with Gemini TTS (generateContent, AUDIO modality).

  npm run voice                                    # rebuild scripts/voice_lines.json from the game data, then this
  python scripts/voice_gen.py                      # every line that is missing or whose text changed
  python scripts/voice_gen.py card-00 welcome-0 --force
  python scripts/voice_gen.py pick-1 --force --best 3   # up to 3 takes, keep the one Whisper understands best
  python scripts/voice_gen.py --audition Gacrux "Chào mừng lữ khách..."   # one test line to asset_src/voice/

Needs GOOGLE_API_KEY (or GEMINI_API_KEY) with a TTS model enabled, and ffmpeg on PATH.
Output: 24 kHz mono MP3 (48 kbps) in public/voice/<id>.mp3, plus public/voice/manifest.json
({id: {d: seconds, t: text}}); the game plays a file only when its recorded text matches the line on screen.
Voice: Erinome on gemini-2.5-flash-preview-tts, a young Northern girl at a brisk pace. Picked over Zephyr, Aoede,
Laomedeia, Leda (and the earlier Vindemiatrix) for the highest pitch, fastest delivery and the clearest long readings by
Whisper. gemini-3.8-flash-tts reads a plain-text style prompt aloud; it needs [bracket tags] instead.
"""
import base64, json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request, wave
from pathlib import Path

MODEL = os.environ.get('TTS_MODEL', 'gemini-2.5-flash-preview-tts')
VOICE = os.environ.get('TTS_VOICE', 'Erinome')
ROOT = Path(__file__).resolve().parent.parent
LINES = ROOT / 'scripts' / 'voice_lines.json'
OUT = ROOT / 'public' / 'voice'
STYLE = ('Read this aloud in Vietnamese with a natural Northern Vietnamese (Hanoi) accent, as a young, mysterious girl witch '
         'in her early twenties: youthful, clear and bright yet secretive, with a hint of a playful smile, crisp tones on '
         'every word. Speak at a brisk, fast pace with only tiny pauses')


def tts(text: str, style: str, voice: str) -> bytes:
    key = os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY')
    if not key:
        sys.exit('GOOGLE_API_KEY is not set')
    body = {
        'contents': [{'parts': [{'text': f'{style}:\n{text}'}]}],
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}},
        },
    }
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent'
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    for attempt in range(7):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.load(r)
            part = d['candidates'][0]['content']['parts'][0]['inlineData']
            return base64.b64decode(part['data'])
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            if e.code in (429, 500, 503) and attempt < 6:
                time.sleep(15 * (attempt + 1))
                continue
            sys.exit(f'TTS failed {e.code}: {msg}')
    sys.exit('TTS failed after retries')


def save_mp3(pcm: bytes, out: Path) -> float:
    """24 kHz 16-bit mono PCM -> trimmed MP3; returns seconds."""
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'line.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(pcm)
        # trim leading/trailing silence, gentle loudness normalisation
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-af',
                        'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,'
                        'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,'
                        'loudnorm=I=-17:TP=-1.5:LRA=11',
                        '-ar', '24000', '-ac', '1', '-b:a', '48k', str(out)], check=True)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)],
                           capture_output=True, text=True, check=True)
    return round(float(probe.stdout.strip()), 2)


def spoken(text: str) -> str:
    """What the TTS reads: lines written in capitals for the bubble are read as normal sentences."""
    return text.capitalize() if text.isupper() else text


class Judge:
    """Scores a take by how much of the intended text Whisper hears in it (see voice_check.py)."""

    def __init__(self):
        sys.path.insert(0, str(ROOT / 'scripts'))
        from faster_whisper import WhisperModel
        from voice_check import score
        self.model = WhisperModel('medium', device='cpu', compute_type='int8')
        self.score = score

    def __call__(self, mp3: Path, want: str) -> tuple[float, str]:
        segs, _ = self.model.transcribe(str(mp3), language='vi', beam_size=5)
        got = ' '.join(s.text.strip() for s in segs)
        return self.score(want, got), got


def main():
    args = sys.argv[1:]
    if args[:1] == ['--audition']:
        voice, text = args[1], args[2]
        out = ROOT / 'asset_src' / 'voice' / f'audition_{voice}.mp3'
        print(out, save_mp3(tts(text, STYLE, voice), out), 's')
        return
    force = '--force' in args
    best = int(args[args.index('--best') + 1]) if '--best' in args else 1
    only = [a for a in args if not a.startswith('--') and not (best > 1 and a == str(best))]
    judge = Judge() if best > 1 else None
    lines = json.loads(LINES.read_text(encoding='utf-8'))
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    ids = {item['id'] for item in lines}
    gone = [k for k in manifest if k not in ids]  # lines removed from the game
    for lid in gone:
        manifest.pop(lid)
        (OUT / f'{lid}.mp3').unlink(missing_ok=True)
    if gone:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    for item in lines:
        lid = item['id']
        if only and lid not in only:
            continue
        out = OUT / f'{lid}.mp3'
        have = manifest.get(lid)
        if out.exists() and isinstance(have, dict) and have.get('t') == item['text'] and not force:
            continue
        if judge:
            takes = []
            for k in range(best):
                tmp = OUT / f'{lid}.take{k}.mp3'
                secs = save_mp3(tts(spoken(item['text']), item.get('style', STYLE), VOICE), tmp)
                sc, got = judge(tmp, item['text'])
                print(f'  {lid} take {k}: {sc} | {got}', flush=True)
                takes.append((sc, secs, tmp))
                if sc >= 0.95:
                    break
            sc, secs, keep = max(takes, key=lambda t: t[0])
            keep.replace(out)
            for _, _, t in takes:
                t.unlink(missing_ok=True)
        else:
            secs = save_mp3(tts(spoken(item['text']), item.get('style', STYLE), VOICE), out)
        manifest[lid] = {'d': secs, 't': item['text']}
        # merge with what is on disk, so two runs on different lines can share the manifest
        disk = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
        disk[lid] = manifest[lid]
        manifest_path.write_text(json.dumps(disk, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'{lid}: {secs}s', flush=True)
    print('done', len(manifest), 'lines')


if __name__ == '__main__':
    main()
