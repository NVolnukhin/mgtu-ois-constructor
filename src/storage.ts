// Хранилище баз в браузере. У каждой базы свой ключ в localStorage и свои ответы.
// На github.io все сайты аккаунта делят один origin, а значит и localStorage с его лимитом около 5 МБ,
// поэтому все ключи начинаются с общего префикса, а неудачная запись не теряется молча: данные остаются
// в памяти, пользователь видит предупреждение, а запись повторяется при каждом следующем сохранении.

import { useSyncExternalStore } from 'react';
import exampleJson from '../content/example.json';
import { parseBase } from './engine/parse.ts';
import type { Answers, KnowledgeBase } from './engine/types.ts';

const PREFIX = 'mgtu-ois-constructor/';
const BASE_PREFIX = `${PREFIX}base/`;
const SESSION_PREFIX = `${PREFIX}session/`;

/** Сколько символов примерно вмещает localStorage. */
const STORAGE_LIMIT_CHARS = 5_000_000;

export const EXAMPLE_ID = 'example';

export interface BaseRecord {
  id: string;
  base: KnowledgeBase;
  createdAt: number;
  updatedAt: number;
  /** Встроенный пример: его нельзя менять, можно только сделать копию. */
  builtIn?: boolean;
}

/** Рабочая база данных одной базы: ответы пользователя и вопрос, на котором он остановился. */
export interface StoredSession {
  step: number;
  answers: Answers;
}

export type StorageProblem = 'quota' | 'unavailable';

interface StoreState {
  /** Базы пользователя, сначала недавно изменённые. Пример в этот список не входит. */
  records: BaseRecord[];
  /** id записей, которые не удалось прочитать. */
  broken: string[];
  /** Почему не удалось сохранить данные; null — всё сохранено. */
  problem: StorageProblem | null;
}

export const exampleRecord: BaseRecord = {
  id: EXAMPLE_ID,
  base: exampleJson as unknown as KnowledgeBase,
  createdAt: 0,
  updatedAt: 0,
  builtIn: true,
};

/** Что не удалось записать: ключ → последнее значение. Эти данные пока есть только в памяти. */
const pending = new Map<string, string>();
/** Уже разобранные записи: чтобы не менять объект базы, если её текст не изменился. */
const decoded = new Map<string, { raw: string; record: BaseRecord | null }>();
const listeners = new Set<() => void>();

function storedBaseKeys(): string[] {
  try {
    return Object.keys(localStorage).filter((key) => key.startsWith(BASE_PREFIX));
  } catch {
    return [];
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function decode(key: string, raw: string): BaseRecord | null {
  const cached = decoded.get(key);
  if (cached?.raw === raw) return cached.record;
  let record: BaseRecord | null = null;
  try {
    const stored = JSON.parse(raw);
    const parsed = parseBase(stored.base);
    if (parsed.ok) {
      record = {
        id: key.slice(BASE_PREFIX.length),
        base: parsed.base,
        createdAt: Number(stored.createdAt) || 0,
        updatedAt: Number(stored.updatedAt) || 0,
      };
    }
  } catch {
    // Повреждённая запись: покажем её в списке как нечитаемую.
  }
  decoded.set(key, { raw, record });
  return record;
}

function byUpdatedAt(a: BaseRecord, b: BaseRecord): number {
  return b.updatedAt - a.updatedAt;
}

function readAll(problem: StorageProblem | null): StoreState {
  const records: BaseRecord[] = [];
  const broken: string[] = [];
  const keys = new Set([...storedBaseKeys(), ...[...pending.keys()].filter((key) => key.startsWith(BASE_PREFIX))]);
  for (const key of keys) {
    const raw = pending.get(key) ?? readStored(key);
    if (raw === null) continue;
    const record = decode(key, raw);
    if (record) records.push(record);
    else broken.push(key.slice(BASE_PREFIX.length));
  }
  return { records: records.sort(byUpdatedAt), broken, problem };
}

let state = readAll(null);

function publish(next: StoreState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Повторяет неудавшиеся записи. Возвращает, почему записать не удалось, или null. */
function flush(): StorageProblem | null {
  let problem: StorageProblem | null = null;
  for (const [key, value] of pending) {
    try {
      localStorage.setItem(key, value);
      pending.delete(key);
    } catch (error) {
      // В разных браузерах переполнение называется по-разному; остальное — запрет на хранение данных.
      const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      problem = quota ? 'quota' : 'unavailable';
    }
  }
  return problem;
}

/** Повторяет записи и обновляет предупреждение, если что-то изменилось. */
function settle(): void {
  const problem = flush();
  if (problem !== state.problem) publish({ ...state, problem });
}

function encode(record: BaseRecord): string {
  const { createdAt, updatedAt, base } = record;
  return JSON.stringify({ createdAt, updatedAt, base });
}

function newRecordId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Базы ----------

/** Сохраняет новую базу и возвращает её id. Ничего не перезаписывает. */
export function createBase(base: KnowledgeBase): string {
  const now = Date.now();
  const record: BaseRecord = { id: newRecordId(), base, createdAt: now, updatedAt: now };
  const key = `${BASE_PREFIX}${record.id}`;
  const raw = encode(record);
  decoded.set(key, { raw, record });
  pending.set(key, raw);
  publish({ ...state, records: [record, ...state.records], problem: flush() });
  return record.id;
}

/** Меняет копию базы и сразу сохраняет её: редактор работает без кнопки «Сохранить». */
export function updateBase(id: string, change: (draft: KnowledgeBase) => void): void {
  const current = state.records.find((record) => record.id === id);
  if (!current) return;
  const base = structuredClone(current.base);
  change(base);
  // Запись, которую нельзя прочитать обратно, — это потерянная база. Лучше не сохранить одну правку.
  const check = parseBase(base);
  if (!check.ok) {
    console.error('Правка не сохранена: после неё база не читается.', check.errors);
    return;
  }
  const record: BaseRecord = { ...current, base, updatedAt: Date.now() };
  const key = `${BASE_PREFIX}${id}`;
  const raw = encode(record);
  decoded.set(key, { raw, record });
  pending.set(key, raw);
  const records = [record, ...state.records.filter((item) => item.id !== id)];
  publish({ ...state, records, problem: flush() });
}

/** Удаляет базу вместе с её ответами. Освободившееся место сразу идёт на неудавшиеся записи. */
export function deleteBase(id: string): void {
  const key = `${BASE_PREFIX}${id}`;
  const sessionKey = `${SESSION_PREFIX}${id}`;
  pending.delete(key);
  pending.delete(sessionKey);
  decoded.delete(key);
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(sessionKey);
  } catch {
    // Если хранилище недоступно, в нём и так ничего не сохранилось.
  }
  publish({
    records: state.records.filter((record) => record.id !== id),
    broken: state.broken.filter((brokenId) => brokenId !== id),
    problem: flush(),
  });
}

/** Текст записи как есть: нечитаемую запись можно скачать и поправить вручную. */
export function rawRecord(id: string): string | null {
  const key = `${BASE_PREFIX}${id}`;
  return pending.get(key) ?? readStored(key);
}

// ---------- Подписка для React ----------

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, () => state);
}

if (typeof window !== 'undefined') {
  // Другая вкладка изменила базы — показываем их здесь. Несохранённое здесь остаётся как есть,
  // а если там освободилось место, записываем его.
  window.addEventListener('storage', (event) => {
    const problem = pending.size > 0 ? flush() : state.problem;
    if (event.key === null || event.key.startsWith(BASE_PREFIX)) publish(readAll(problem));
    else if (problem !== state.problem) publish({ ...state, problem });
  });
  // Несохранённые данные есть только в памяти: перед закрытием вкладки браузер переспросит.
  window.addEventListener('beforeunload', (event) => {
    if (pending.size > 0) event.preventDefault();
  });
}

// ---------- Ответы ----------

function isAnswers(value: unknown): value is Answers {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((selected) => Array.isArray(selected) && selected.every((id) => typeof id === 'string'))
  );
}

export function loadSession(id: string): StoredSession | null {
  const key = `${SESSION_PREFIX}${id}`;
  try {
    const saved = JSON.parse(pending.get(key) ?? readStored(key) ?? 'null');
    if (saved && Number.isInteger(saved.step) && isAnswers(saved.answers)) {
      return { step: saved.step, answers: saved.answers };
    }
  } catch {
    // Повреждённые данные — просто начинаем сначала.
  }
  return null;
}

export function saveSession(id: string, session: StoredSession): void {
  pending.set(`${SESSION_PREFIX}${id}`, JSON.stringify(session));
  settle();
}

export function clearSession(id: string): void {
  const key = `${SESSION_PREFIX}${id}`;
  pending.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // Если хранилище недоступно, в нём и так ничего не сохранилось.
  }
  settle();
}

// ---------- Сколько места занято ----------

/** Какая доля localStorage занята всеми сайтами на этом origin, от 0 до 1. */
export function storageUsage(): number {
  let chars = 0;
  try {
    for (const key of Object.keys(localStorage)) chars += key.length + (localStorage.getItem(key)?.length ?? 0);
  } catch {
    return 0;
  }
  return Math.min(1, chars / STORAGE_LIMIT_CHARS);
}
