import type { GameOptions } from '../types';

export type ChallengeSeedResult =
  | { ok: true; seed: number; canonical: string }
  | { ok: false; message: string };

const MAX_SEED = 0xffff_ffff;
const SEED_MESSAGE = '0부터 4294967295까지 숫자를 입력해 주세요.';

/** Validate before converting: wrapping invalid numbers to uint32 hides input errors. */
export function parseChallengeSeed(raw: string): ChallengeSeedResult {
  const trimmed = raw.trim();
  if (!/^[0-9]{1,10}$/.test(trimmed)) return { ok: false, message: SEED_MESSAGE };
  const seed = Number(trimmed);
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    return { ok: false, message: SEED_MESSAGE };
  }
  return { ok: true, seed, canonical: String(seed) };
}

let nextControlId = 0;

/** The caller owns starting the game; this form only reports a validated option patch. */
export function createChallengeControls(
  options: GameOptions,
  onChange: (patch: Partial<GameOptions>) => void,
): HTMLElement {
  const prefix = `challenge-seed-${++nextControlId}`;
  const root = document.createElement('form');
  root.className = 'challenge-controls';
  root.setAttribute('aria-label', '시드 도전');
  root.noValidate = true;

  const field = document.createElement('label');
  field.className = 'challenge-controls__field';
  const caption = document.createElement('span');
  caption.className = 'challenge-controls__label';
  caption.textContent = '도전 시드';
  const input = document.createElement('input');
  input.className = 'challenge-controls__input';
  input.id = prefix;
  input.name = 'challenge-seed';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.maxLength = 32;
  input.placeholder = '0 … 4294967295';
  input.dataset.testid = 'challenge-seed';
  input.setAttribute('aria-describedby', `${prefix}-hint ${prefix}-error`);
  const initial = parseChallengeSeed(String(options.seed));
  input.value = initial.ok ? initial.canonical : '';
  field.append(caption, input);

  const hint = document.createElement('p');
  hint.id = `${prefix}-hint`;
  hint.className = 'challenge-controls__hint';
  hint.textContent = '같은 시드와 캐릭터로 같은 출발 조건에 도전하세요.';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'secondary-button challenge-controls__button';
  submit.textContent = '시드 도전 · 10분';
  submit.dataset.testid = 'start-challenge';

  const error = document.createElement('p');
  error.id = `${prefix}-error`;
  error.className = 'challenge-controls__error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const clearError = () => {
    input.removeAttribute('aria-invalid');
    error.textContent = '';
    error.hidden = true;
  };
  input.addEventListener('input', clearError);
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    const parsed = parseChallengeSeed(input.value);
    if (!parsed.ok) {
      input.setAttribute('aria-invalid', 'true');
      error.hidden = false;
      error.textContent = parsed.message;
      input.focus({ preventScroll: true });
      return;
    }
    clearError();
    input.value = parsed.canonical;
    onChange({ mode: 'challenge', seed: parsed.seed });
  });

  root.append(field, submit, hint, error);
  return root;
}
