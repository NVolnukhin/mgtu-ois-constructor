// Картинки базы знаний: какие адреса допустимы и где картинки встречаются.
// База может прийти от другого человека, поэтому адрес из неё нельзя вставлять в страницу без проверки.

import type { ImageRef, KnowledgeBase } from './types.ts';

/** Управляющие символы и обратные слэши: браузер их нормализует, и схема адреса может оказаться другой. */
const SUSPICIOUS = /[\u0000-\u001f\u007f\\]/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

function schemeOf(url: string): string | undefined {
  return SCHEME.exec(url.trim())?.[1].toLowerCase();
}

/** Адрес картинки: http(s) или относительный путь. data:, javascript: и прочие схемы не допускаются. */
export function isSafeImageUrl(url: string): boolean {
  if (SUSPICIOUS.test(url)) return false;
  const scheme = schemeOf(url);
  return scheme === undefined || scheme === 'http' || scheme === 'https';
}

/** Адрес внешней ссылки (автор, лицензия): только http(s). */
export function isSafeLinkUrl(url: string): boolean {
  if (SUSPICIOUS.test(url)) return false;
  const scheme = schemeOf(url);
  return scheme === 'http' || scheme === 'https';
}

/** Значение CSS object-position: слова, числа и проценты, например «50% 30%» или «center top». */
export function isSafeImagePosition(position: string): boolean {
  return /^[a-z0-9\s.%-]*$/i.test(position);
}

export interface FoundImage {
  image: ImageRef;
  /** Где используется: для сообщений о проблемах. */
  where: string;
  /** Раздел редактора, где картинка правится. */
  section: 'general' | 'groups' | 'questions';
}

/** Все картинки базы. */
export function baseImages(base: KnowledgeBase): FoundImage[] {
  const found: FoundImage[] = [];
  const add = (image: ImageRef | undefined, where: string, section: FoundImage['section']) => {
    if (image) found.push({ image, where, section });
  };
  add(base.image, 'обложка базы', 'general');
  for (const group of base.groups) add(group.image, `группа «${group.title}»`, 'groups');
  for (const block of base.blocks) {
    for (const question of block.questions) {
      add(question.image, `вопрос «${question.parameter}»`, 'questions');
      for (const option of question.options) add(option.image, `вариант «${option.text}»`, 'questions');
    }
  }
  return found;
}
