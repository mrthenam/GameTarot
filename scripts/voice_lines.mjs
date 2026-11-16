// Collects every line the witch speaks (card readings + LINES) into scripts/voice_lines.json
// for scripts/voice_gen.py. Run by `npm run voice`; needs Node >= 22.18 (imports .ts directly).
import { writeFileSync } from 'node:fs';
import { TAROT } from '../src/data/tarot.ts';
import { LINES } from '../src/data/lines.ts';

// delivery per moment (English, as the TTS model takes direction best in English)
const BASE = 'Read this aloud in Vietnamese with a natural Northern Vietnamese (Hanoi) accent, as a young, mysterious girl witch '
  + 'in her early twenties: youthful, clear and bright yet secretive, with a hint of a playful smile, crisp tones on every word. ';
const STYLE = {
  card: BASE + 'Speak at a brisk, fast pace with only tiny pauses, like confiding a secret',
  welcome: BASE + 'Welcoming and intriguing, at a brisk pace',
  idle: BASE + 'Softly coaxing, at a brisk pace',
  pick: BASE + 'Intrigued and pleased, at a brisk pace',
  seals: BASE + 'Commanding but playful, with rising energy, fast',
  upgrade: BASE + 'Suddenly astonished: breathless, excited, rising in pitch, fast',
  reveal: BASE + 'Wondering, building to delight, at a brisk pace',
  shuffle: BASE + 'Hushed and mysterious but clearly voiced (never a breathy whisper), at a brisk pace',
  noTurns: BASE + 'Gentle and a little wistful, kind',
  pity: BASE + 'Excited and certain, fast',
  offline: BASE + 'Apologetic and gentle, at a brisk pace',
  poke: BASE + 'Teasing and giggly, light and playful, fast',
};

const out = TAROT.map((c) => ({ id: `card-${String(c.id).padStart(2, '0')}`, text: c.message, style: STYLE.card }));
for (const [key, list] of Object.entries(LINES)) {
  list.forEach((entry, i) => {
    const texts = Array.isArray(entry) ? entry : [entry];
    texts.forEach((text, j) => {
      if (!text) return;
      const id = Array.isArray(entry) ? `${key}-${i}-${j}` : `${key}-${i}`;
      out.push({ id, text, style: STYLE[key] ?? STYLE.card });
    });
  });
}
writeFileSync(new URL('./voice_lines.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`voice_lines.json: ${out.length} lines`);
