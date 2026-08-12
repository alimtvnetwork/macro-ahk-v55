import { REPLACE_KEY_DEFAULT, REPLACE_VALUES_DEFAULT, normalizeReplaceValues, validateReplaceKey } from '../db/prompt-defaults';

export interface TokenRowEls { row: HTMLDivElement; input: HTMLInputElement; preview: HTMLSpanElement; error: HTMLSpanElement; }

export function buildTokenRow(initialKey: string): TokenRowEls {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
  const label = document.createElement('span');
  label.textContent = 'Token:';
  label.style.cssText = 'font-size:11px;color:hsl(var(--muted-foreground));';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = initialKey;
  input.placeholder = REPLACE_KEY_DEFAULT;
  input.style.cssText = 'width:120px;box-sizing:border-box;background:hsl(var(--background));color:hsl(var(--foreground));border:1px solid hsl(var(--muted));border-radius:6px;padding:3px 6px;font-family:ui-monospace,monospace;font-size:11px;';
  const preview = document.createElement('span');
  preview.style.cssText = 'font-family:ui-monospace,monospace;font-size:11px;color:hsl(var(--foreground));background:hsl(var(--background));border:1px solid hsl(var(--secondary));border-radius:4px;padding:2px 6px;';
  const error = document.createElement('span');
  error.style.cssText = 'font-size:10px;color:hsl(var(--destructive));margin-left:auto;';
  const update = (): void => {
    const key = input.value.trim();
    const err = validateReplaceKey(key);
    preview.textContent = err ? '{{ ? }}' : '{{' + key + '}}';
    error.textContent = err ?? '';
  };

  input.addEventListener('input', update);
  update();
  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(preview);
  row.appendChild(error);

  return { row, input, preview, error };
}

export interface ValuesRowEls { row: HTMLDivElement; input: HTMLInputElement; error: HTMLSpanElement; }

export function buildValuesRow(initialValues: string[]): ValuesRowEls {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
  const label = document.createElement('span');
  label.textContent = 'N options:';
  label.style.cssText = 'font-size:11px;color:hsl(var(--muted-foreground));';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = initialValues.join(', ');
  input.placeholder = REPLACE_VALUES_DEFAULT.join(', ');
  input.style.cssText = 'flex:1;box-sizing:border-box;background:hsl(var(--background));color:hsl(var(--foreground));border:1px solid hsl(var(--muted));border-radius:6px;padding:3px 6px;font-family:ui-monospace,monospace;font-size:11px;';
  const error = document.createElement('span');
  error.style.cssText = 'font-size:10px;color:hsl(var(--destructive));margin-left:auto;';
  const update = (): void => {
    const parsed = input.value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    error.textContent = normalizeReplaceValues(parsed) === null ? 'Enter one or more comma-separated values' : '';
  };

  input.addEventListener('input', update);
  update();
  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(error);

  return { row, input, error };
}
