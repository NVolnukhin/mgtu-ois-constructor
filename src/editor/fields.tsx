// Поля редактора. Обычный текст попадает в базу при вводе. Число и адрес — когда человек уходит из поля: по дороге
// к недопустимому 150 встречается допустимое 15, и сохранился бы этот обрывок. То, что сохранять нельзя,
// остаётся только в поле с пометкой об ошибке, а в базе остаётся прежнее значение.

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Photo } from '../components/Photo.tsx';
import { isSafeImagePosition, isSafeImageUrl, isSafeLinkUrl } from '../engine/images.ts';
import { MAX_TEXT_LENGTH } from '../engine/parse.ts';
import type { ImageCredit, ImageRef } from '../engine/types.ts';
import type { Issue } from '../engine/validate.ts';
import { refocus } from '../focus.ts';

/**
 * Сохраняет черновик поля, когда поле исчезает или закрывается вкладка: при переходе кнопкой браузера «Назад»
 * и при закрытии вкладки событие ухода из поля может не прийти.
 */
function useCommitOnLeave(commit: () => void): void {
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });
  useEffect(() => {
    const flush = () => latest.current();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}

export function TextField({ label, value, onChange, hint, placeholder, multiline = false, rows = 3, className }: TextFieldProps) {
  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span className="field__label">{label}</span>
      {multiline ? (
        <textarea className="field__input field__input--area" rows={rows} value={value} placeholder={placeholder} maxLength={MAX_TEXT_LENGTH} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="field__input" type="text" value={value} placeholder={placeholder} maxLength={MAX_TEXT_LENGTH} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

interface CheckedTextFieldProps extends Omit<TextFieldProps, 'multiline' | 'rows'> {
  /** Можно ли сохранить такое значение. */
  check: (value: string) => boolean;
  errorText: string;
}

/**
 * Текстовое поле с проверкой. Значение сохраняется, когда человек уходит из поля или нажимает Enter. Недопустимое
 * не сохраняется: поле показывает его с ошибкой, чтобы длинный адрес можно было поправить, а не набирать заново.
 */
export function CheckedTextField({ label, value, onChange, check, errorText, hint, placeholder, className }: CheckedTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const invalid = !check(draft);

  // Значение изменилось снаружи (например, в другой вкладке).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    if (draft !== value && check(draft)) onChange(draft);
  }
  useCommitOnLeave(commit);

  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span className="field__label">{label}</span>
      <input
        className={invalid ? 'field__input field__input--invalid' : 'field__input'}
        type="text"
        value={draft}
        placeholder={placeholder}
        maxLength={MAX_TEXT_LENGTH}
        aria-invalid={invalid}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
        onChange={(event) => setDraft(event.target.value)}
      />
      {invalid ? <span className="field__error">{errorText}</span> : hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Можно ли сохранить такое число. */
  check: (value: number) => boolean;
  errorText: string;
  hint?: string;
  className?: string;
}

/** Обычная запись числа, в том числе с запятой. 0x10 и 1e1 для человека не числа, хотя JavaScript их понимает. */
function parseNumber(text: string): number {
  return /^\s*-?(\d+[.,]?\d*|[.,]\d+)\s*$/.test(text) ? Number(text.trim().replace(',', '.')) : NaN;
}

/** Числовое поле: значение сохраняется, когда человек уходит из поля или нажимает Enter. Неподходящее откатывается к прежнему. */
export function NumberField({ label, value, onChange, check, errorText, hint, className }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const parsed = parseNumber(draft);
  const invalid = !Number.isFinite(parsed) || !check(parsed);

  useEffect(() => {
    setDraft((current) => (parseNumber(current) === value ? current : String(value)));
  }, [value]);

  function commit() {
    if (!invalid && parsed !== value) onChange(parsed);
  }
  useCommitOnLeave(commit);

  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span className="field__label">{label}</span>
      <input
        className={invalid ? 'field__input field__input--invalid' : 'field__input'}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-invalid={invalid}
        onBlur={() => (invalid ? setDraft(String(value)) : commit())}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
        onChange={(event) => setDraft(event.target.value)}
      />
      {invalid ? <span className="field__error">{errorText}</span> : hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  hint?: string;
  className?: string;
}

export function SelectField({ label, value, options, onChange, hint, className }: SelectFieldProps) {
  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span className="field__label">{label}</span>
      <select className="field__input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function CheckboxField({ label, checked, onChange, className }: { label: string; checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  return (
    <label className={className ? `checkbox ${className}` : 'checkbox'}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Список строк: каждая строка поля — один элемент. */
export function ListField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (value: string[]) => void; hint?: string }) {
  const [draft, setDraft] = useState(value.join('\n'));
  const clean = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

  // Значение изменилось снаружи. Пустые строки в черновике при этом не трогаем: человек может ещё печатать.
  useEffect(() => {
    setDraft((current) => (clean(current).join('\n') === value.join('\n') ? current : value.join('\n')));
  }, [value]);

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <textarea
        className="field__input field__input--area"
        rows={Math.max(3, draft.split('\n').length)}
        value={draft}
        maxLength={MAX_TEXT_LENGTH}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(clean(event.target.value));
        }}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

/** Выбор числа из шкалы для ячейки таблицы: значение нельзя ввести неправильно. */
export function ScaleSelect({ value, min, max, label, onChange, tone }: { value: number; min: number; max: number; label: string; onChange: (value: number) => void; tone: string }) {
  const scale: number[] = [];
  for (let number = min; number <= max; number++) scale.push(number);
  // В чужом файле значение может быть вне шкалы: его надо показать, а проверка отметит ошибку.
  if (!scale.includes(value)) scale.push(value);
  return (
    <select className={`scale-select ${tone}`} aria-label={label} value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {scale.map((number) => (
        <option key={number} value={number}>
          {number}
        </option>
      ))}
    </select>
  );
}

interface RowActionsProps {
  /** Что это за строка: для подписей кнопок. */
  label: string;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void | Promise<void>;
}

/**
 * Кнопки «выше», «ниже», «удалить». Если действия нет, кнопка неактивна, но остаётся доступной с клавиатуры:
 * иначе при переносе на край списка она потеряла бы фокус.
 */
export function RowActions({ label, onUp, onDown, onRemove }: RowActionsProps) {
  // Строка могла переехать, а вопрос при переносе в соседний блок создаётся заново. Фокус остаётся на той же кнопке той же строки.
  function move(event: MouseEvent<HTMLButtonElement>, action: (() => void) | undefined, name: 'up' | 'down') {
    if (!action) return;
    const button = event.currentTarget;
    const rowId = button.closest('[id^="entity-"]')?.id;
    action();
    refocus(() => (button.isConnected ? button : document.getElementById(rowId ?? '')?.querySelector<HTMLElement>(`[data-action="${name}"]`)));
  }

  // Строка исчезла вместе с кнопкой: фокус идёт на такую же кнопку соседней строки, а если строк не осталось — на заголовок раздела.
  async function remove(event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    const row = button.closest('li, tr');
    const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
    const heading = button.closest('section')?.querySelector('h2');
    await onRemove?.();
    refocus(() => neighbour?.querySelector<HTMLElement>('[data-action="remove"]') ?? heading);
  }

  return (
    <span className="row-actions">
      <button type="button" className="icon-btn" data-action="up" aria-label={`Выше: ${label}`} title="Выше" aria-disabled={!onUp} onClick={(event) => move(event, onUp, 'up')}>
        ↑
      </button>
      <button type="button" className="icon-btn" data-action="down" aria-label={`Ниже: ${label}`} title="Ниже" aria-disabled={!onDown} onClick={(event) => move(event, onDown, 'down')}>
        ↓
      </button>
      <button type="button" className="icon-btn icon-btn--danger" data-action="remove" aria-label={`Удалить: ${label}`} title="Удалить" onClick={remove}>
        ×
      </button>
    </span>
  );
}

/** Картинка в редакторе: только адрес, файлы в базу не встраиваются. Автор и лицензия необязательны. */
export function ImageField({ label, image, onChange }: { label: string; image: ImageRef | undefined; onChange: (image: ImageRef | undefined) => void }) {
  const credit = image?.credit;

  /** Обычно адрес стирают, чтобы вставить новый, поэтому подпись и авторы остаются, пока они есть. */
  function setUrl(url: string) {
    const details = image?.alt || image?.position || image?.credit;
    onChange(url || details ? { ...image, url } : undefined);
  }

  function setCredit(field: keyof ImageCredit, value: string) {
    if (!image) return;
    const next: ImageCredit = { ...credit, [field]: value || undefined };
    for (const key of Object.keys(next) as (keyof ImageCredit)[]) {
      if (next[key] === undefined) delete next[key];
    }
    const { credit: _old, ...rest } = image;
    onChange(Object.keys(next).length > 0 ? { ...rest, credit: next } : rest);
  }

  return (
    <fieldset className="image-field">
      <legend className="field__label">{label}</legend>
      <div className="image-field__main">
        {image?.url && <Photo image={image} className="image-field__preview" decorative />}
        <div className="image-field__fields">
          <CheckedTextField
            label="Адрес картинки"
            value={image?.url ?? ''}
            placeholder="https://… или images/photo.webp"
            check={isSafeImageUrl}
            errorText="Допускаются только адреса http(s) и относительные пути. В базе остался прежний адрес."
            hint="Файл в базу не встраивается: картинка должна быть доступна по ссылке."
            onChange={setUrl}
          />
          {image && (
            <TextField
              label="Описание для тех, кто не видит картинку"
              value={image.alt ?? ''}
              onChange={(alt) => {
                const { alt: _old, ...rest } = image;
                onChange(alt ? { ...rest, alt } : rest);
              }}
            />
          )}
        </div>
      </div>
      {image && (
        <details className="editor-details">
          <summary>Кадрирование, автор и лицензия</summary>
          <div className="form-grid">
            <CheckedTextField
              label="Какую часть кадра сохранить"
              value={image.position ?? ''}
              placeholder="50% 30%"
              check={isSafeImagePosition}
              errorText="Нужно значение вроде «50% 30%» или «center top»."
              onChange={(position) => {
                const { position: _old, ...rest } = image;
                onChange(position ? { ...rest, position } : rest);
              }}
            />
            <TextField label="Автор" value={credit?.author ?? ''} onChange={(value) => setCredit('author', value)} />
            <TextField label="Название работы" value={credit?.title ?? ''} onChange={(value) => setCredit('title', value)} />
            <TextField label="Лицензия" value={credit?.license ?? ''} placeholder="CC BY 4.0" onChange={(value) => setCredit('license', value)} />
            <CheckedTextField
              label="Ссылка на лицензию"
              value={credit?.licenseUrl ?? ''}
              placeholder="https://…"
              check={(url) => !url || isSafeLinkUrl(url)}
              errorText="Допускается только адрес http(s)."
              onChange={(value) => setCredit('licenseUrl', value)}
            />
            <TextField label="Источник" value={credit?.source ?? ''} placeholder="Wikimedia Commons" onChange={(value) => setCredit('source', value)} />
            <CheckedTextField
              label="Ссылка на источник"
              value={credit?.url ?? ''}
              placeholder="https://…"
              check={(url) => !url || isSafeLinkUrl(url)}
              errorText="Допускается только адрес http(s)."
              onChange={(value) => setCredit('url', value)}
            />
          </div>
        </details>
      )}
    </fieldset>
  );
}

/** Проблемы раздела. Если у проблемы есть цель, по нажатию открывается нужное место. */
export function IssueList({ issues, onSelect }: { issues: Issue[]; onSelect?: (target: string) => void }) {
  if (issues.length === 0) return null;
  const select = (target: string) => {
    onSelect?.(target);
    // Цель могла только что раскрыться, поэтому ждём следующий кадр.
    requestAnimationFrame(() => document.getElementById(`entity-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  return (
    <ul className="issues">
      {issues.map((issue, index) => (
        <li key={`${index}:${issue.message}`} className={issue.severity === 'error' ? 'issue issue--error' : 'issue issue--warning'}>
          <span className="issue__mark">{issue.severity === 'error' ? 'Ошибка' : 'Заметка'}</span>
          {issue.target ? (
            <button type="button" className="issue__text issue__text--link" onClick={() => select(issue.target!)}>
              {issue.message}
            </button>
          ) : (
            <span className="issue__text">{issue.message}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Заголовок раздела редактора. */
export function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="editor-section__head">
      <h2 tabIndex={-1} className="editor-section__title">
        {title}
      </h2>
      {children && <p className="editor-section__lead">{children}</p>}
    </header>
  );
}
