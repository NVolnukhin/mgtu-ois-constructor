// Операции над базой, которые нужны редактору. Чистые функции без React.

import { DEFAULT_SETTINGS } from '../engine/parse.ts';
import { BASE_FORMAT, BASE_FORMAT_VERSION } from '../engine/types.ts';
import type { KnowledgeBase } from '../engine/types.ts';

/** Новая база: пустая, с одним блоком, чтобы сразу можно было добавлять вопросы. */
export function emptyBase(): KnowledgeBase {
  return {
    format: BASE_FORMAT,
    formatVersion: BASE_FORMAT_VERSION,
    title: 'Новая база знаний',
    subtitle: '',
    description: '',
    author: '',
    settings: { ...DEFAULT_SETTINGS },
    attributes: [],
    groups: [],
    objects: [],
    blocks: [{ id: 'b1', title: '', description: '', questions: [] }],
    rules: [],
    testProfiles: [],
  };
}

/** Копия базы: новое название, остальное как было. */
export function copyOf(base: KnowledgeBase): KnowledgeBase {
  return { ...structuredClone(base), title: `${base.title} (копия)` };
}
