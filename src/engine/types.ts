// Модель данных экспертной системы. База знаний лежит в content/quiz.json и описана этими типами.

/** Атрибуты-сферы: совпадают с направлениями волонтёрства. */
export const DIRECTION_IDS = ['children', 'inclusion', 'seniors', 'ecology'] as const;

/** Атрибуты стиля: как устроена деятельность помимо сферы. */
export const STYLE_IDS = [
  'physical',
  'outdoor',
  'emotional',
  'regular',
  'training',
  'leading',
  'teaching',
  'creative',
  'personal',
] as const;

export const ATTRIBUTE_IDS = [...DIRECTION_IDS, ...STYLE_IDS] as const;

export type DirectionId = (typeof DIRECTION_IDS)[number];
export type StyleId = (typeof STYLE_IDS)[number];
export type AttributeId = DirectionId | StyleId;

/** Значения по всем атрибутам. */
export type AttributeValues = Record<AttributeId, number>;

/**
 * Веса варианта ответа — «преимущество», которое ответ даёт атрибутам (связь «параметр + атрибут»).
 * Хранятся только ненулевые: для сфер от 0 до 3, для стиля от −2 до 3.
 */
export type Weights = Partial<Record<AttributeId, number>>;

/** single — один ответ, multiple — несколько ответов. */
export type QuestionType = 'single' | 'multiple';

export interface Attribute {
  id: AttributeId;
  /** sphere — сфера (направление), style — стиль деятельности. */
  group: 'sphere' | 'style';
  title: string;
  /** Короткое название для таблиц. */
  short: string;
  description: string;
}

export interface Direction {
  id: DirectionId;
  title: string;
  short: string;
  tagline: string;
  /** Ключ картинки в content/images.json. */
  image: string;
  description: string;
  activities: string[];
  qualities: string[];
  firstSteps: string[];
}

/** Объект ранжирования — вид волонтёрской деятельности. */
export interface VolunteerObject {
  id: string;
  direction: DirectionId;
  title: string;
  description: string;
  /** Выраженность каждого атрибута у деятельности, от 0 до 3. */
  attributes: AttributeValues;
}

export interface Option {
  /** Буква варианта: a, b, c… */
  id: string;
  text: string;
  /** Короткая формулировка для объяснения в вопросах с несколькими ответами. */
  short?: string;
  /** Ключ картинки-превью в content/images.json. */
  image?: string;
  /** «Ничего из этого»: снимает остальные отметки и сам снимается при выборе другого варианта. */
  exclusive?: boolean;
  weights: Weights;
  /** Почему этот ответ говорит в пользу направления. Показывается на экране результата. */
  reasons?: Partial<Record<DirectionId, string>>;
}

export interface Question {
  id: string;
  type: QuestionType;
  /** Ситуационная задача: проверяет, как человек поступит в типичной ситуации направления. */
  situational?: boolean;
  /** Название параметра, под которым ответ хранится в рабочей базе данных. */
  parameter: string;
  text: string;
  /** Ключ картинки в content/images.json. */
  image: string;
  /** Обоснование весов — для документации. */
  note: string;
  /**
   * Общее объяснение для вопроса с несколькими ответами: {options} заменяется
   * списком коротких формулировок выбранных вариантов.
   */
  reasonTemplate?: Partial<Record<DirectionId, string>>;
  options: Option[];
}

export interface Block {
  id: string;
  /** Направление блока. У общего блока его нет. */
  direction?: DirectionId;
  title: string;
  description: string;
  questions: Question[];
}

/** Правило «параметр + параметр»: ЕСЛИ у параметра такое значение, ТО другой параметр получает значение. */
export interface Rule {
  id: string;
  /** Короткое обозначение для интерфейса: П1, П2… */
  title: string;
  if: { question: string; option: string };
  then: { question: string; option: string };
  note: string;
}

export interface Quiz {
  version: number;
  title: string;
  subtitle: string;
  description: string;
  estimatedMinutes: number;
  /** Ключ картинки для стартового экрана. */
  image: string;
  attributes: Attribute[];
  directions: Direction[];
  objects: VolunteerObject[];
  rules: Rule[];
  blocks: Block[];
}

/** Ответы пользователя: id вопроса → id выбранных вариантов. */
export type Answers = Record<string, string[]>;

export interface ImageCredit {
  author: string;
  title: string;
  /** Сайт, откуда взято фото. */
  source: string;
  /** Страница фото на этом сайте. */
  url: string;
  license: string;
  licenseUrl?: string;
}

/** Фото из content/images.json. */
export interface ImageInfo {
  /** Путь относительно папки public. */
  file: string;
  alt: string;
  /** CSS object-position: какую часть кадра сохранить при обрезке. */
  position: string;
  credit: ImageCredit;
}

export type Images = Record<string, ImageInfo>;
