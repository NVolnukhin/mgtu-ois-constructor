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
  const [root, id, section, tab] = hash.replace(/^#\/?/, '').split('/');
  if (root !== 'base' || !id) return { name: 'home' };
  if (section === undefined || !SECTIONS.includes(section as BaseSection)) return { name: 'base', id: decodeURIComponent(id), section: 'start' };
  return { name: 'base', id: decodeURIComponent(id), section: section as BaseSection, tab };
}

export const HOME_PATH = '#/';

export function basePath(id: string, section: BaseSection = 'start', tab?: string): string {
  const root = `#/base/${encodeURIComponent(id)}`;
  if (section === 'start') return root;
  return tab ? `${root}/${section}/${tab}` : `${root}/${section}`;
}

/** replace — не оставлять текущий экран в истории: кнопка «Назад» его пропустит. */
export function navigate(path: string, replace = false): void {
  if (replace) location.replace(path);
  else location.hash = path;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return useMemo(() => parseRoute(hash), [hash]);
}
