// Проверка структуры базы: JSON от другого человека — чужие данные. Функция собирает базу заново, поле за полем,
// и берёт только известные поля нужных типов, поэтому дальше движок и интерфейс могут доверять типам.
// Смысловые ошибки (пустые названия, ссылки на несуществующие вопросы) ищет validateBase: такую базу можно
// импортировать и поправить в редакторе.

import { isSafeImagePosition, isSafeImageUrl, isSafeLinkUrl } from './images.ts';
import { BASE_FORMAT, BASE_FORMAT_VERSION } from './types.ts';
import type {
  Answers,
  Attribute,
  Block,
  Condition,
  Group,
  ImageCredit,
  ImageRef,
  KnowledgeBase,
  Option,
  Question,
  RankedObject,
  Rule,
  Settings,
  TestProfile,
} from './types.ts';

export const DEFAULT_SETTINGS: Settings = { topCount: 5, closeGap: 10, weakPercent: 50 };

export type ParseResult = { ok: true; base: KnowledgeBase } | { ok: false; errors: string[] };

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Убирает незаполненные необязательные поля, чтобы их не было и в файле экспорта. */
function prune<T extends object>(value: T): T {
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] === undefined) delete value[key];
  }
  return value;
}

/** Ключи вроде constructor и __proto__ совпали бы со свойствами обычного объекта JavaScript. */
function isSafeKey(key: string): boolean {
  return key !== '' && !(key in Object.prototype);
}

export function parseBaseText(text: string): ParseResult {
  let json: unknown;
  try {
    // Некоторые редакторы в Windows дописывают в начало файла невидимый символ BOM.
    json = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, errors: ['Это не файл JSON: не удалось его прочитать.'] };
  }
  return parseBase(json);
}

export function parseBase(input: unknown): ParseResult {
  if (!isObject(input) || input.format !== BASE_FORMAT) {
    return { ok: false, errors: ['Это не база конструктора: в файле нет отметки формата «es-constructor».'] };
  }
  if (typeof input.formatVersion === 'number' && input.formatVersion > BASE_FORMAT_VERSION) {
    return { ok: false, errors: ['Файл создан более новой версией конструктора. Обновите страницу или попросите файл в старом формате.'] };
  }
  if (input.formatVersion !== BASE_FORMAT_VERSION) {
    return { ok: false, errors: [`Неизвестная версия формата: ${String(input.formatVersion)}.`] };
  }

  const errors: string[] = [];
  const problem = (path: string, message: string) => {
    errors.push(`${path}: ${message}`);
  };

  /** Строка, которая в готовой базе есть всегда. Пустая строка — не ошибка структуры, её покажет validateBase. */
  const text = (source: Json, key: string, path: string): string => {
    const value = source[key];
    if (value === undefined) return '';
    if (typeof value !== 'string') {
      problem(`${path}.${key}`, 'должна быть строка');
      return '';
    }
    return value;
  };
  const optionalText = (source: Json, key: string, path: string): string | undefined =>
    source[key] === undefined ? undefined : text(source, key, path);

  const id = (source: Json, key: string, path: string): string => {
    const value = source[key];
    if (typeof value !== 'string' || !isSafeKey(value)) {
      problem(`${path}.${key}`, 'нужен непустой id; имена вроде constructor не подходят');
      return '';
    }
    return value;
  };
  const optionalId = (source: Json, key: string, path: string): string | undefined =>
    source[key] === undefined ? undefined : id(source, key, path);

  const flag = (source: Json, key: string, path: string): boolean | undefined => {
    const value = source[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
      problem(`${path}.${key}`, 'должно быть true или false');
      return undefined;
    }
    return value;
  };

  const list = (source: Json, key: string, path: string, required = false): unknown[] => {
    const value = source[key];
    if (value === undefined && !required) return [];
    if (!Array.isArray(value)) {
      problem(`${path}${path ? '.' : ''}${key}`, 'должен быть список');
      return [];
    }
    return value;
  };

  /** Разбирает элементы списка: не объект — ошибка, элемент пропускается. */
  const items = <T>(values: unknown[], path: string, read: (item: Json, itemPath: string, index: number) => T): T[] =>
    values.flatMap((value, index) => {
      const itemPath = `${path}[${index}]`;
      if (!isObject(value)) {
        problem(itemPath, 'должен быть объект');
        return [];
      }
      return [read(value, itemPath, index)];
    });

  const textList = (source: Json, key: string, path: string): string[] | undefined => {
    if (source[key] === undefined) return undefined;
    const values = list(source, key, path);
    if (values.some((value) => typeof value !== 'string')) {
      problem(`${path}.${key}`, 'должен быть список строк');
      return undefined;
    }
    return values as string[];
  };

  const numberMap = (source: Json, key: string, path: string): Record<string, number> => {
    const value = source[key];
    if (value === undefined) return {};
    if (!isObject(value)) {
      problem(`${path}.${key}`, 'должен быть объект вида { "id": число }');
      return {};
    }
    const entries = Object.entries(value).filter(([name, number]) => {
      if (isSafeKey(name) && typeof number === 'number' && Number.isFinite(number)) return true;
      problem(`${path}.${key}.${name}`, 'должно быть число');
      return false;
    });
    return Object.fromEntries(entries) as Record<string, number>;
  };

  const textMap = (source: Json, key: string, path: string): Record<string, string> | undefined => {
    const value = source[key];
    if (value === undefined) return undefined;
    if (!isObject(value)) {
      problem(`${path}.${key}`, 'должен быть объект вида { "id": "текст" }');
      return undefined;
    }
    const entries = Object.entries(value).filter(([name, string]) => {
      if (isSafeKey(name) && typeof string === 'string') return true;
      problem(`${path}.${key}.${name}`, 'должна быть строка');
      return false;
    });
    return Object.fromEntries(entries) as Record<string, string>;
  };

  const number = (source: Json, key: string, path: string, fallback: number, valid: (value: number) => boolean, rule: string): number => {
    const value = source[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || !valid(value)) {
      problem(`${path}.${key}`, rule);
      return fallback;
    }
    return value;
  };

  const link = (source: Json, key: string, path: string): string | undefined => {
    const value = optionalText(source, key, path);
    if (value && !isSafeLinkUrl(value)) {
      problem(`${path}.${key}`, 'в ссылке допускается только http(s)');
      return undefined;
    }
    return value;
  };

  const image = (source: Json, key: string, path: string): ImageRef | undefined => {
    const value = source[key];
    if (value === undefined) return undefined;
    const at = `${path}.${key}`;
    if (!isObject(value)) {
      problem(at, 'должен быть объект с полем url');
      return undefined;
    }
    const url = text(value, 'url', at);
    if (!url) return undefined;
    if (!isSafeImageUrl(url)) {
      problem(`${at}.url`, 'в адресе картинки допускаются только http(s) и относительные пути');
      return undefined;
    }
    const position = optionalText(value, 'position', at);
    if (position && !isSafeImagePosition(position)) problem(`${at}.position`, 'нужно значение вроде «50% 30%»');

    let credit: ImageCredit | undefined;
    if (value.credit !== undefined) {
      if (isObject(value.credit)) {
        const from = value.credit;
        const creditAt = `${at}.credit`;
        credit = prune({
          author: optionalText(from, 'author', creditAt),
          title: optionalText(from, 'title', creditAt),
          source: optionalText(from, 'source', creditAt),
          url: link(from, 'url', creditAt),
          license: optionalText(from, 'license', creditAt),
          licenseUrl: link(from, 'licenseUrl', creditAt),
        });
      } else {
        problem(`${at}.credit`, 'должен быть объект');
      }
    }
    return prune({ url, alt: optionalText(value, 'alt', at), position, credit });
  };

  const condition = (source: Json, path: string): Condition => ({
    question: id(source, 'question', path),
    option: id(source, 'option', path),
  });

  // ---------- Сама база ----------

  const settingsSource = input.settings === undefined ? {} : input.settings;
  let settings: Settings = { ...DEFAULT_SETTINGS };
  if (isObject(settingsSource)) {
    settings = prune({
      topCount: number(settingsSource, 'topCount', 'settings', DEFAULT_SETTINGS.topCount, (v) => Number.isInteger(v) && v >= 1, 'нужно целое число от 1'),
      closeGap: number(settingsSource, 'closeGap', 'settings', DEFAULT_SETTINGS.closeGap, (v) => v >= 0, 'нужно число от 0'),
      weakPercent: number(settingsSource, 'weakPercent', 'settings', DEFAULT_SETTINGS.weakPercent, (v) => v >= 0 && v <= 100, 'нужно число от 0 до 100'),
      groupsTitle: optionalText(settingsSource, 'groupsTitle', 'settings'),
      resultTitle: optionalText(settingsSource, 'resultTitle', 'settings'),
    });
  } else {
    problem('settings', 'должен быть объект');
  }

  const attributes = items<Attribute>(list(input, 'attributes', '', true), 'attributes', (source, path) => ({
    id: id(source, 'id', path),
    title: text(source, 'title', path),
    short: text(source, 'short', path),
    description: text(source, 'description', path),
    importance: number(source, 'importance', path, 1, (v) => v >= 0, 'важность — число от 0'),
  }));

  const groups = items<Group>(list(input, 'groups', ''), 'groups', (source, path) =>
    prune({
      id: id(source, 'id', path),
      attribute: id(source, 'attribute', path),
      title: text(source, 'title', path),
      tagline: optionalText(source, 'tagline', path),
      description: text(source, 'description', path),
      image: image(source, 'image', path),
      qualities: textList(source, 'qualities', path),
      firstSteps: textList(source, 'firstSteps', path),
    }),
  );

  const objects = items<RankedObject>(list(input, 'objects', '', true), 'objects', (source, path) =>
    prune({
      id: id(source, 'id', path),
      group: optionalId(source, 'group', path),
      title: text(source, 'title', path),
      description: text(source, 'description', path),
      values: numberMap(source, 'values', path),
    }),
  );

  const readOption = (source: Json, path: string): Option =>
    prune({
      id: id(source, 'id', path),
      text: text(source, 'text', path),
      short: optionalText(source, 'short', path),
      image: image(source, 'image', path),
      exclusive: flag(source, 'exclusive', path),
      weights: numberMap(source, 'weights', path),
      reasons: textMap(source, 'reasons', path),
    });

  const readQuestion = (source: Json, path: string): Question => {
    const type = source.type;
    if (type !== 'single' && type !== 'multiple') problem(`${path}.type`, 'тип — single (один ответ) или multiple (несколько ответов)');
    return prune({
      id: id(source, 'id', path),
      parameter: text(source, 'parameter', path),
      text: text(source, 'text', path),
      type: type === 'multiple' ? 'multiple' : 'single',
      situational: flag(source, 'situational', path),
      image: image(source, 'image', path),
      note: text(source, 'note', path),
      reasonTemplate: textMap(source, 'reasonTemplate', path),
      options: items<Option>(list(source, 'options', path, true), `${path}.options`, readOption),
    });
  };

  const blocks = items<Block>(list(input, 'blocks', '', true), 'blocks', (source, path) =>
    prune({
      id: id(source, 'id', path),
      group: optionalId(source, 'group', path),
      title: text(source, 'title', path),
      description: text(source, 'description', path),
      questions: items<Question>(list(source, 'questions', path, true), `${path}.questions`, readQuestion),
    }),
  );

  const rules = items<Rule>(list(input, 'rules', ''), 'rules', (source, path, index) => {
    const then = isObject(source.then) ? condition(source.then, `${path}.then`) : undefined;
    if (!then) problem(`${path}.then`, 'нужен объект { "question": …, "option": … }');
    return {
      id: id(source, 'id', path),
      title: source.title === undefined ? `П${index + 1}` : text(source, 'title', path),
      if: items<Condition>(list(source, 'if', path, true), `${path}.if`, condition),
      then: then ?? { question: '', option: '' },
      note: text(source, 'note', path),
    };
  });

  const testProfiles = items<TestProfile>(list(input, 'testProfiles', ''), 'testProfiles', (source, path) => {
    const answers: Answers = {};
    if (source.answers !== undefined && !isObject(source.answers)) problem(`${path}.answers`, 'должен быть объект');
    for (const [question, selected] of Object.entries(isObject(source.answers) ? source.answers : {})) {
      if (isSafeKey(question) && Array.isArray(selected) && selected.every((option) => typeof option === 'string')) {
        answers[question] = selected as string[];
      } else {
        problem(`${path}.answers.${question}`, 'должен быть список id вариантов');
      }
    }
    return prune({
      name: text(source, 'name', path),
      story: optionalText(source, 'story', path),
      answers,
      expectGroup: textList(source, 'expectGroup', path),
      expectTop: textList(source, 'expectTop', path),
      expectClose: flag(source, 'expectClose', path),
      expectWeak: flag(source, 'expectWeak', path),
    });
  });

  const root = 'база';
  const base: KnowledgeBase = prune({
    format: BASE_FORMAT,
    formatVersion: BASE_FORMAT_VERSION,
    title: text(input, 'title', root),
    subtitle: text(input, 'subtitle', root),
    description: text(input, 'description', root),
    author: text(input, 'author', root),
    imagesNote: optionalText(input, 'imagesNote', root),
    image: image(input, 'image', root),
    settings,
    attributes,
    groups,
    objects,
    blocks,
    rules,
    testProfiles,
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, base };
}
