// Поля редактора. Изменения сохраняются сразу, поэтому значение в базу попадает при вводе,
// а то, что сохранять нельзя (недопустимый адрес, не число), остаётся только в поле с пометкой об ошибке.

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Photo } from '../components/Photo.tsx';
import { isSafeImagePosition, isSafeImageUrl, isSafeLinkUrl } from '../engine/images.ts';
import type { ImageCredit, ImageRef } from '../engine/types.ts';
import type { Issue } from '../engine/validate.ts';

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
        <textarea className="field__input field__input--area" rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="field__input" type="text" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

interface CheckedTextFieldProps extends Omit<TextFieldProps, 'multiline' | 'rows'> {
  /** Можно ли сохранить такое значение. */
  check: (value: string) => boolean;
  errorText: string;
  onBlur?: () => void;
}

/** Текстовое поле с проверкой: недопустимое значение не сохраняется, а поле показывает ошибку. */
export function CheckedTextField({ label, value, onChange, check, errorText, hint, placeholder, className, onBlur }: CheckedTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const invalid = !check(draft);

  // Значение изменилось снаружи (например, в другой вкладке).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span className="field__label">{label}</span>
      <input
        className={invalid ? 'field__input field__input--invalid' : 'field__input'}
        type="text"
        value={draft}
        placeholder={placeholder}
        aria-invalid={invalid}
        onBlur={onBlur}
        onChange={(event) => {
          setDraft(event.target.value);
          if (check(event.target.value)) onChange(event.target.value);
        }}
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

/** Числовое поле: пока введено не подходящее значение, в базе остаётся прежнее. */
export function NumberField({ label, value, onChange, check, errorText, hint, className }: NumberFieldProps) {
  const parse = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));
  const [draft, setDraft] = useState(String(value));
  const parsed = parse(draft);
  const invalid = !Number.isFinite(parsed) || !check(parsed);

  useEffect(() => {
    setDraft((current) => (parse(current) === value ? current : String(value)));
  }, [value]);

  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span className="field__label">{label}</span>
      <input
        className={invalid ? 'field__input field__input--invalid' : 'field__input'}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-invalid={invalid}
        onBlur={() => invalid && setDraft(String(value))}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = parse(event.target.value);
          if (Number.isFinite(next) && check(next)) onChange(next);
        }}
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
  onRemove?: () => void;
}

/** Кнопки «выше», «ниже», «удалить». Если действия нет, кнопка неактивна. */
export function RowActions({ label, onUp, onDown, onRemove }: RowActionsProps) {
  return (
    <span className="row-actions">
      <button type="button" className="icon-btn" aria-label={`Выше: ${label}`} title="Выше" disabled={!onUp} onClick={onUp}>
        ↑
      </button>
      <button type="button" className="icon-btn" aria-label={`Ниже: ${label}`} title="Ниже" disabled={!onDown} onClick={onDown}>
        ↓
      </button>
      <button type="button" className="icon-btn icon-btn--danger" aria-label={`Удалить: ${label}`} title="Удалить" disabled={!onRemove} onClick={onRemove}>
        ×
      </button>
    </span>
  );
}

/** Картинка в редакторе: только адрес, файлы в базу не встраиваются. Автор и лицензия необязательны. */
export function ImageField({ label, image, onChange }: { label: string; image: ImageRef | undefined; onChange: (image: ImageRef | undefined) => void }) {
  // Превью обновляется, когда адрес дописан: иначе браузер запрашивал бы каждую часть адреса.
  const [previewUrl, setPreviewUrl] = useState(image?.url ?? '');
  const credit = image?.credit;

  /** Обычно адрес стирают, чтобы вставить новый, поэтому подпись и авторы остаются, пока они есть. */
  function setUrl(url: string) {
    const details = image?.alt || image?.position || image?.credit;
    onChange(url || details ? { ...image, url } : undefined);
    if (!url) setPreviewUrl('');
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
        {previewUrl && <Photo image={{ url: previewUrl, alt: image?.alt, position: image?.position }} className="image-field__preview" decorative />}
        <div className="image-field__fields">
          <CheckedTextField
            label="Адрес картинки"
            value={image?.url ?? ''}
            placeholder="https://… или images/photo.webp"
            check={isSafeImageUrl}
            errorText="Допускаются только адреса http(s) и относительные пути."
            hint="Файл в базу не встраивается: картинка должна быть доступна по ссылке."
            onChange={setUrl}
            onBlur={() => setPreviewUrl(image?.url ?? '')}
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
      <h2 className="editor-section__title">{title}</h2>
      {children && <p className="editor-section__lead">{children}</p>}
    </header>
  );
}
