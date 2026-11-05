// Механизм логического вывода экспертной системы.
//   1. Правила «параметр + параметр» выводят значения части параметров из ответов пользователя.
//   2. Связи «параметр + атрибут» превращают ответы в профиль предпочтений по 13 атрибутам.
//   3. Объекты ранжируются по совпадению своих атрибутов с профилем, а атрибуты-сферы профиля
//      дают итоговую направленность.
// Файл без зависимостей от React, чтобы его можно было запускать из скриптов проверки.

import { ATTRIBUTE_IDS } from './types.ts';
import type {
  Answers,
  AttributeId,
  AttributeValues,
  Direction,
  DirectionId,
  Option,
  Question,
  Quiz,
  Rule,
  VolunteerObject,
} from './types.ts';

/** Если даже лучшее направление набрало меньше этого процента, выраженной склонности нет. */
export const WEAK_PERCENT = 50;

/** Если второе место отстаёт меньше чем на столько процентных пунктов, оно почти равно первому. */
export const CLOSE_GAP = 10;

/** Сколько лучших объектов показывать после каждого ответа. */
export const TOP_COUNT = 5;

/** Вес атрибутов-сфер в сравнении с объектами: сфера важнее отдельной черты стиля. */
export const SPHERE_WEIGHT = 2;

export function zeroValues(): AttributeValues {
  return Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, 0])) as AttributeValues;
}

export function weight(option: Option, attribute: AttributeId): number {
  return option.weights[attribute] ?? 0;
}

export function allQuestions(quiz: Quiz): Question[] {
  return quiz.blocks.flatMap((block) => block.questions);
}

/** Правило «параметр + атрибут»: ЕСЛИ параметр получил значение ТО атрибутам даётся «преимущество». */
export interface AttributeRule {
  /** Обозначение: А1, А2, … — по порядку вопросов и вариантов в базе знаний. */
  title: string;
  question: Question;
  option: Option;
  /** Заключения правила: атрибут и вес, в порядке атрибутов. */
  effects: { attribute: AttributeId; weight: number }[];
}

/**
 * Правила «параметр + атрибут» базы знаний. Каждый вариант ответа с весами — одно продукционное правило
 * с одним или несколькими заключениями. Варианты без весов (отказы, ошибочные решения ситуационных задач)
 * правил не дают.
 */
export function attributeRules(quiz: Quiz): AttributeRule[] {
  const rules: AttributeRule[] = [];
  for (const question of allQuestions(quiz)) {
    for (const option of question.options) {
      const effects = ATTRIBUTE_IDS.filter((id) => weight(option, id) !== 0).map((id) => ({ attribute: id, weight: weight(option, id) }));
      if (effects.length > 0) rules.push({ title: `А${rules.length + 1}`, question, option, effects });
    }
  }
  return rules;
}

export function selectedOptions(question: Question, answers: Answers): Option[] {
  const selected = answers[question.id] ?? [];
  return question.options.filter((option) => selected.includes(option.id));
}

/**
 * Какие варианты будут отмечены после нажатия на optionId. В вопросе с одним ответом
 * выбор заменяется, с несколькими — переключается; «ничего из этого» снимает остальные
 * отметки, а любой другой вариант снимает «ничего из этого».
 */
export function toggleOption(question: Question, selected: string[], optionId: string): string[] {
  if (question.type === 'single') return [optionId];
  if (selected.includes(optionId)) return selected.filter((id) => id !== optionId);
  const exclusive = new Set(question.options.filter((o) => o.exclusive).map((o) => o.id));
  if (exclusive.has(optionId)) return [optionId];
  return [...selected.filter((id) => !exclusive.has(id)), optionId];
}

// ---------- 1. Правила «параметр + параметр» ----------

export interface Inference {
  /** Ответы пользователя вместе с выведенными значениями — рабочая база данных. */
  answers: Answers;
  /** id вопроса → правило, которым выведено значение. Эти вопросы пользователю не задаются. */
  inferred: Map<string, Rule>;
}

/**
 * Прямой вывод: пока есть правило, условие которого выполнено, а заключение ещё не выведено,
 * применяем его. Выведенное значение заменяет ответ пользователя на тот же вопрос, если он был
 * (например, пользователь вернулся назад и изменил ответ-условие).
 */
export function infer(quiz: Quiz, answers: Answers): Inference {
  const effective: Answers = { ...answers };
  const inferred = new Map<string, Rule>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of quiz.rules) {
      if (inferred.has(rule.then.question)) continue;
      if (!(effective[rule.if.question] ?? []).includes(rule.if.option)) continue;
      effective[rule.then.question] = [rule.then.option];
      inferred.set(rule.then.question, rule);
      changed = true;
    }
  }
  return { answers: effective, inferred };
}

/** Вопросы, которые задаются пользователю: все, кроме выведенных правилами. */
export function askedQuestions(quiz: Quiz, answers: Answers): Question[] {
  const { inferred } = infer(quiz, answers);
  return allQuestions(quiz).filter((question) => !inferred.has(question.id));
}

/** Все параметры получены: от пользователя или выведены правилами. */
export function isComplete(quiz: Quiz, answers: Answers): boolean {
  const { answers: effective } = infer(quiz, answers);
  return allQuestions(quiz).every((question) => selectedOptions(question, effective).length > 0);
}

// ---------- 2. Связи «параметр + атрибут»: профиль предпочтений ----------

/**
 * Наименьшая и наибольшая сумма, которую вопрос может дать атрибуту: в вопросе с одним ответом —
 * наименьший и наибольший вес среди вариантов, с несколькими — сумма отрицательных и сумма положительных.
 */
export function questionBounds(question: Question, attribute: AttributeId): [number, number] {
  const weights = question.options.map((option) => weight(option, attribute));
  if (question.type === 'single') return [Math.min(...weights), Math.max(...weights)];
  return [
    weights.filter((w) => w < 0).reduce((sum, w) => sum + w, 0),
    weights.filter((w) => w > 0).reduce((sum, w) => sum + w, 0),
  ];
}

export interface Profile {
  /** Сумма весов выбранных вариантов по каждому атрибуту. */
  points: AttributeValues;
  /** Наименьшая и наибольшая возможная сумма по уже полученным параметрам. */
  low: AttributeValues;
  high: AttributeValues;
  /**
   * Предпочтение от −1 до 1: где сумма оказалась между наименьшей и наибольшей возможной.
   * −1 — все ответы против атрибута, 1 — все за, 0 — поровну или данных пока нет.
   */
  preference: AttributeValues;
}

export function buildProfile(quiz: Quiz, effective: Answers, questions = allQuestions(quiz)): Profile {
  const points = zeroValues();
  const low = zeroValues();
  const high = zeroValues();
  const preference = zeroValues();
  for (const question of questions) {
    const chosen = selectedOptions(question, effective);
    if (chosen.length === 0) continue;
    for (const id of ATTRIBUTE_IDS) {
      const [min, max] = questionBounds(question, id);
      low[id] += min;
      high[id] += max;
      for (const option of chosen) points[id] += weight(option, id);
    }
  }
  for (const id of ATTRIBUTE_IDS) {
    const span = high[id] - low[id];
    preference[id] = span > 0 ? (2 * (points[id] - low[id])) / span - 1 : 0;
  }
  return { points, low, high, preference };
}

// ---------- 3. Ранжирование объектов ----------

export interface Contribution {
  attribute: AttributeId;
  /** Выраженность атрибута у объекта, 0–3. */
  level: number;
  /** Предпочтение пользователя по атрибуту, от −1 до 1. */
  preference: number;
  /** Вклад атрибута в косинус: положительный — атрибут совпал с предпочтениями, отрицательный — противоречит им. */
  value: number;
}

export interface ObjectScore {
  object: VolunteerObject;
  /** Косинус угла между профилем пользователя и атрибутами объекта, от −1 до 1. */
  cosine: number;
  /**
   * Совпадение от 0 до 1: (1 + cosine) / 2. 1 — деятельность в точности такая, как хочет пользователь,
   * 0,5 — не связана с его предпочтениями, меньше 0,5 — её свойства скорее противоречат ответам.
   */
  score: number;
  /** Место в рейтинге, начиная с 1. */
  rank: number;
  /** Вклад атрибутов, от самого большого к самому маленькому. */
  contributions: Contribution[];
}

export function attributeWeight(quiz: Quiz, id: AttributeId): number {
  return quiz.attributes.find((a) => a.id === id)?.group === 'sphere' ? SPHERE_WEIGHT : 1;
}

/**
 * Совпадение объекта с профилем. Сначала считается косинусная мера сходства векторов: предпочтений
 * пользователя (от −1 до 1) и выраженности атрибутов объекта (от 0 до 3), где сферы идут с весом
 * SPHERE_WEIGHT. Косинус лежит от −1 до 1, поэтому для показа он переводится в шкалу от 0 до 1:
 * (1 + cosine) / 2. Перевод линейный, так что порядок объектов от него не зависит.
 */
export function rankObjects(quiz: Quiz, preference: AttributeValues): ObjectScore[] {
  const w = Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, attributeWeight(quiz, id)])) as AttributeValues;
  const preferenceNorm = Math.sqrt(ATTRIBUTE_IDS.reduce((sum, id) => sum + w[id] * preference[id] ** 2, 0));
  const scored = quiz.objects.map((object) => {
    const objectNorm = Math.sqrt(ATTRIBUTE_IDS.reduce((sum, id) => sum + w[id] * object.attributes[id] ** 2, 0));
    const norm = preferenceNorm * objectNorm;
    const contributions = ATTRIBUTE_IDS.filter((id) => object.attributes[id] > 0).map((id) => ({
      attribute: id,
      level: object.attributes[id],
      preference: preference[id],
      value: norm > 0 ? (w[id] * preference[id] * object.attributes[id]) / norm : 0,
    }));
    const cosine = contributions.reduce((sum, c) => sum + c.value, 0);
    contributions.sort((a, b) => b.value - a.value);
    return { object, cosine, score: (1 + cosine) / 2, rank: 0, contributions };
  });
  // При равенстве остаётся порядок объектов в базе знаний (сортировка стабильная).
  scored.sort((a, b) => b.score - a.score);
  scored.forEach((item, index) => (item.rank = index + 1));
  return scored;
}

/** Рейтинг объектов по текущим ответам — то, что показывается после каждого ответа. */
export function liveRanking(quiz: Quiz, answers: Answers): ObjectScore[] {
  const { answers: effective } = infer(quiz, answers);
  return rankObjects(quiz, buildProfile(quiz, effective).preference);
}

// ---------- Итог: направленность ----------

/** M — максимальная сумма баллов по каждому атрибуту при ответах на все вопросы. */
export function maxScores(quiz: Quiz): AttributeValues {
  const max = zeroValues();
  for (const question of allQuestions(quiz)) {
    for (const id of ATTRIBUTE_IDS) max[id] += questionBounds(question, id)[1];
  }
  return max;
}

export interface QuestionBreakdown {
  question: Question;
  selected: Option[];
  points: AttributeValues;
  /** Правило, которым выведено значение; у ответов пользователя его нет. */
  rule?: Rule;
}

/** Сколько баллов каждый параметр дал каждому атрибуту — для подробного расчёта. */
export function breakdown(quiz: Quiz, answers: Answers): QuestionBreakdown[] {
  const { answers: effective, inferred } = infer(quiz, answers);
  return allQuestions(quiz).map((question) => {
    const selected = selectedOptions(question, effective);
    const points = zeroValues();
    for (const option of selected) {
      for (const id of ATTRIBUTE_IDS) points[id] += weight(option, id);
    }
    return { question, selected, points, rule: inferred.get(question.id) };
  });
}

export interface DirectionScore {
  direction: Direction;
  points: number;
  max: number;
  /** Доля от максимума в процентах, без округления. */
  percent: number;
  /** Баллы из общего блока — решают при равенстве процентов. */
  generalPoints: number;
}

export interface Reason {
  questionId: string;
  points: number;
  text: string;
}

export interface Evaluation {
  /** Направления от самого подходящего к наименее подходящему. */
  ranking: DirectionScore[];
  winner: DirectionScore;
  runnerUp: DirectionScore;
  /** Второе место отстаёт меньше чем на CLOSE_GAP п. п. */
  isClose: boolean;
  /** Лучшее направление набрало меньше WEAK_PERCENT % максимума. */
  isWeak: boolean;
  /** Самые весомые ответы в пользу победившего направления. */
  reasons: Reason[];
  /** Все объекты по рангу. */
  objects: ObjectScore[];
  profile: Profile;
  inferred: Map<string, Rule>;
}

export function evaluate(quiz: Quiz, answers: Answers): Evaluation {
  const { answers: effective, inferred } = infer(quiz, answers);
  const profile = buildProfile(quiz, effective);
  const max = maxScores(quiz);
  const generalQuestions = quiz.blocks.filter((block) => !block.direction).flatMap((block) => block.questions);
  const general = buildProfile(quiz, effective, generalQuestions).points;

  // Больший процент выигрывает; при равенстве — больше баллов в общем блоке (там человек
  // сам выбирает между сферами); дальше — порядок направлений в базе знаний (сортировка стабильная).
  const ranking = quiz.directions
    .map((direction) => ({
      direction,
      points: profile.points[direction.id],
      max: max[direction.id],
      percent: max[direction.id] > 0 ? (profile.points[direction.id] / max[direction.id]) * 100 : 0,
      generalPoints: general[direction.id],
    }))
    .sort((a, b) => b.percent - a.percent || b.generalPoints - a.generalPoints);

  const [winner, runnerUp] = ranking;
  return {
    ranking,
    winner,
    runnerUp,
    isClose: winner.percent - runnerUp.percent < CLOSE_GAP,
    isWeak: winner.percent < WEAK_PERCENT,
    reasons: explain(quiz, effective, winner.direction.id),
    objects: rankObjects(quiz, profile.preference),
    profile,
    inferred,
  };
}

/** Какие ответы сильнее всего говорят в пользу направления — подсистема объяснений. */
export function explain(quiz: Quiz, effective: Answers, direction: DirectionId, limit = 5): Reason[] {
  const reasons: Reason[] = [];
  for (const question of allQuestions(quiz)) {
    const chosen = selectedOptions(question, effective).filter((option) => weight(option, direction) > 0);
    if (chosen.length === 0) continue;

    const template = question.reasonTemplate?.[direction];
    if (template) {
      reasons.push({
        questionId: question.id,
        points: chosen.reduce((sum, option) => sum + weight(option, direction), 0),
        text: template.replace('{options}', chosen.map((option) => option.short ?? option.text).join(', ')),
      });
      continue;
    }
    for (const option of chosen) {
      const text = option.reasons?.[direction];
      if (text) reasons.push({ questionId: question.id, points: weight(option, direction), text });
    }
  }
  // Сначала самые весомые ответы, при равных баллах — в порядке вопросов (сортировка стабильная).
  return reasons.sort((a, b) => b.points - a.points).slice(0, limit);
}
