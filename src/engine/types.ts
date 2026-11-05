// Формат базы знаний: так база хранится в браузере и передаётся файлом JSON. Описание — docs/format.md.

export const BASE_FORMAT = 'es-constructor';
export const BASE_FORMAT_VERSION = 1;

/** Значения по атрибутам: id атрибута → число. */
export type AttributeValues = Record<string, number>;

/**
 * Веса варианта ответа — «преимущество», которое ответ даёт атрибутам (правило «параметр + атрибут»).
 * Нулевые веса не хранятся.
 */
export type Weights = Record<string, number>;

/** single — один ответ, multiple — несколько ответов. */
export type QuestionType = 'single' | 'multiple';

export interface ImageCredit {
  author?: string;
  title?: string;
  /** Сайт, откуда взята картинка. */
  source?: string;
  /** Страница картинки на этом сайте. */
  url?: string;
  license?: string;
  licenseUrl?: string;
}

/** Картинка — только ссылка: файлы в базу не встраиваются. */
export interface ImageRef {
  /** Адрес http(s) или относительный путь. */
  url: string;
  alt?: string;
  /** CSS object-position: какую часть кадра сохранить при обрезке. */
  position?: string;
  credit?: ImageCredit;
}

export interface Settings {
  /** Сколько лучших объектов показывать после каждого ответа. */
  topCount: number;
  /** Если второе место отстаёт меньше чем на столько процентных пунктов, оно почти равно первому. */
  closeGap: number;
  /** Если даже лучшая группа набрала меньше этого процента, выраженного итога нет. */
  weakPercent: number;
  /** Как называть группы в интерфейсе, например «Направления». */
  groupsTitle?: string;
  /** Подпись к итогу на экране результата, например «Твоя направленность». */
  resultTitle?: string;
}

export interface Attribute {
  id: string;
  title: string;
  /** Короткое название для таблиц; если пусто, показывается полное. */
  short: string;
  description: string;
  /** Важность атрибута при сравнении с объектами: его вес в косинусной мере. */
  importance: number;
}

/** Необязательная группа объектов. Группа связана с атрибутом: её итог — доля баллов этого атрибута. */
export interface Group {
  id: string;
  attribute: string;
  title: string;
  description: string;
  tagline?: string;
  image?: ImageRef;
  /** «Что пригодится» на экране результата. */
  qualities?: string[];
  /** «С чего начать» на экране результата. */
  firstSteps?: string[];
}

/** Объект ранжирования. */
export interface RankedObject {
  id: string;
  group?: string;
  title: string;
  description: string;
  /** Выраженность атрибутов у объекта, от 0 до 3. Если значения нет, оно равно 0. */
  values: AttributeValues;
}

export interface Option {
  id: string;
  text: string;
  /** Короткая формулировка для объяснения в вопросах с несколькими ответами. */
  short?: string;
  image?: ImageRef;
  /** «Ничего из этого»: снимает остальные отметки и сам снимается при выборе другого варианта. */
  exclusive?: boolean;
  weights: Weights;
  /** Почему этот ответ говорит в пользу группы: id группы → фраза. Показывается на экране результата. */
  reasons?: Record<string, string>;
}

export interface Question {
  id: string;
  /** Название параметра, под которым ответ хранится в рабочей базе данных. */
  parameter: string;
  text: string;
  type: QuestionType;
  /** Ситуационная задача: проверяет, как человек поступит в типичной ситуации. */
  situational?: boolean;
  image?: ImageRef;
  /** Обоснование весов — для автора базы и документации. */
  note: string;
  /**
   * Общее объяснение для вопроса с несколькими ответами: id группы → шаблон,
   * {options} заменяется списком коротких формулировок выбранных вариантов.
   */
  reasonTemplate?: Record<string, string>;
  options: Option[];
}

export interface Block {
  id: string;
  /** Группа блока. Блоки без группы — общие: при равенстве процентов побеждает группа, набравшая больше в них. */
  group?: string;
  title: string;
  description: string;
  questions: Question[];
}

export interface Condition {
  question: string;
  option: string;
}

/** Правило «параметр + параметр»: ЕСЛИ выполнены все условия, ТО другой параметр получает значение. */
export interface Rule {
  id: string;
  /** Короткое обозначение для интерфейса: П1, П2… */
  title: string;
  /** Условия через И. ИЛИ — это два правила. Все условия стоят раньше выводимого вопроса. */
  if: Condition[];
  then: Condition;
  note: string;
}

/** Ответы пользователя: id вопроса → id выбранных вариантов. */
export type Answers = Record<string, string[]>;

/** Тестовый профиль: выдуманный человек с ответами и тем, что система должна ему показать. */
export interface TestProfile {
  name: string;
  story?: string;
  /** Вопросы, значение которых выводит правило, можно не указывать. */
  answers: Answers;
  /** Итог должен быть одной из этих групп. */
  expectGroup?: string[];
  /** Хотя бы один из этих объектов должен попасть в тройку лидеров. */
  expectTop?: string[];
  /** Второе место должно быть почти равным первому (или не должно). */
  expectClose?: boolean;
  /** Итог должен быть слабо выраженным (или не должен). */
  expectWeak?: boolean;
}

export interface KnowledgeBase {
  format: typeof BASE_FORMAT;
  formatVersion: number;
  title: string;
  subtitle: string;
  description: string;
  author: string;
  /** Общее примечание об источниках картинок: показывается на экране с авторами. */
  imagesNote?: string;
  image?: ImageRef;
  settings: Settings;
  attributes: Attribute[];
  /** Группы необязательны: без них есть только рейтинг объектов. */
  groups: Group[];
  objects: RankedObject[];
  blocks: Block[];
  rules: Rule[];
  testProfiles: TestProfile[];
}
