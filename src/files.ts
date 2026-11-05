// Обмен базами: экспорт и импорт файлом JSON.

import type { ParseResult } from './engine/parse.ts';
import type { KnowledgeBase } from './engine/types.ts';
import { parseForImport } from './engine/validate.ts';

/**
 * Больше в localStorage всё равно не поместится. Файл намного больше записи в хранилище:
 * в нём отступы, а кириллица занимает два байта на символ.
 */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Имя файла из названия базы: символы, запрещённые в именах файлов, заменяются пробелами. */
function fileName(title: string): string {
  const name = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 100);
  return `${name || 'База знаний'}.json`;
}

/** Скачивает базу файлом. Этот файл открывается в любом браузере через «Импорт JSON». */
export function downloadBase(base: KnowledgeBase): void {
  downloadText(JSON.stringify(base, null, 2), fileName(base.title));
}

export function downloadText(text: string, name: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Браузер начинает скачивание не сразу, поэтому ссылку освобождаем с запасом.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function readBaseFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_FILE_BYTES) {
    const size = (file.size / 1024 / 1024).toFixed(1).replace('.', ',');
    return { ok: false, errors: [`Файл слишком большой: ${size} МБ. В браузере на все базы есть около 5 МБ.`] };
  }
  try {
    return parseForImport(await file.text());
  } catch {
    return { ok: false, errors: ['Не удалось разобрать файл: он повреждён или слишком сложен.'] };
  }
}
