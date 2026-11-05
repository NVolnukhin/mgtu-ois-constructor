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

/** Все картинки базы с подписью, где каждая используется. */
export function baseImages(base: KnowledgeBase): { image: ImageRef; where: string }[] {
  const found: { image: ImageRef; where: string }[] = [];
  const add = (image: ImageRef | undefined, where: string) => {
    if (image) found.push({ image, where });
  };
  add(base.image, 'обложка базы');
  for (const group of base.groups) add(group.image, `группа «${group.title}»`);
  for (const block of base.blocks) {
    for (const question of block.questions) {
      add(question.image, `вопрос «${question.parameter}»`);
      for (const option of question.options) add(option.image, `вариант «${option.text}»`);
    }
  }
  return found;
}
