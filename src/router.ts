// Маршруты в адресе после #: сайт лежит на статическом хостинге, сервера нет. Зато работают кнопка «Назад»,
// перезагрузка страницы и открытие экрана в новой вкладке.

import { useMemo, useSyncExternalStore } from 'react';

export type BaseSection = 'start' | 'test' | 'result' | 'kb' | 'wm' | 'credits' | 'checks' | 'edit';

export type Route =
  | { name: 'home' }
  /** tab — раздел внутри экрана: например, раздел редактора. */
  | { name: 'base'; id: string; section: BaseSection; tab?: string };

const SECTIONS: BaseSection[] = ['test', 'result', 'kb', 'wm', 'credits', 'checks', 'edit'];

function parseRoute(hash: string): Route {
  const [root, encodedId, section, tab] = hash.replace(/^#\/?/, '').split('/');
  if (root !== 'base' || !encodedId) return { name: 'home' };
  let id: string;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    // Адрес набрали вручную с ошибкой: неверный % не должен ронять приложение.
    return { name: 'home' };
  }
  if (section === undefined || !SECTIONS.includes(section as BaseSection)) return { name: 'base', id, section: 'start' };
  return { name: 'base', id, section: section as BaseSection, tab };
}

export const HOME_PATH = '#/';

export function basePath(id: string, section: BaseSection = 'start', tab?: string): string {
  const root = `#/base/${encodeURIComponent(id)}`;
  if (section === 'start') return root;
  return tab ? `${root}/${section}/${tab}` : `${root}/${section}`;
}

const listeners = new Set<() => void>();

/**
 * replace — не оставлять текущий экран в истории: кнопка «Назад» его пропустит.
 * Событие hashchange приходит позже, поэтому подписчиков уведомляем сразу: новый маршрут
 * и изменения состояния, сделанные рядом с переходом, должны попасть в один рендер.
 */
export function navigate(path: string, replace = false): void {
  if (replace) location.replace(path);
  else location.hash = path;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('hashchange', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', listener);
  };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return useMemo(() => parseRoute(hash), [hash]);
}
