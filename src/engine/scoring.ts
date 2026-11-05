// Механизм логического вывода экспертной системы.
//   1. Правила «параметр + параметр» выводят значения части параметров из ответов пользователя.
//   2. Правила «параметр + атрибут» превращают ответы в профиль предпочтений по атрибутам базы.
//   3. Объекты ранжируются по совпадению своих атрибутов с профилем. Если в базе есть группы,
//      доли баллов их атрибутов дают итог.
// Файл без зависимостей от React, чтобы его можно было запускать из скриптов проверки.

import type {
  Answers,
  Attribute,
  AttributeValues,
  Group,
  KnowledgeBase,
  Option,
  Question,
  RankedObject,
  Rule,
} from './types.ts';

export function zeroValues(base: KnowledgeBase): AttributeValues {
  return Object.fromEntries(base.attributes.map((attribute) => [attribute.id, 0]));
}

export function weight(option: Option, attribute: string): number {
  return option.weights[attribute] ?? 0;
}

/** Выраженность атрибута у объекта. Если значения нет, оно равно 0. */
export function level(object: RankedObject, attribute: string): number {
  return object.values[attribute] ?? 0;
}

/** Короткое название атрибута для таблиц и подписей. */
export function attributeLabel(attribute: Attribute): string {
  return attribute.short || attribute.title;
}

/** Обозначение правила для текстов: в чужом файле его может не быть. */
export function ruleTitle(rule: Rule): string {
  return rule.title.trim() || 'без обозначения';
}

export function allQuestions(base: KnowledgeBase): Question[] {
  return base.blocks.flatMap((block) => block.questions);
}

/** Правило «параметр + атрибут»: ЕСЛИ параметр получил значение ТО атрибутам даётся «преимущество». */
export interface AttributeRule {
  /** Обозначение: А1, А2, … — по порядку вопросов и вариантов в базе знаний. */
  title: string;
  question: Question;
  option: Option;
  /** Заключения правила: атрибут и вес, в порядке атрибутов. */
  effects: { attribute: string; weight: number }[];
}

/**
 * Правила «параметр + атрибут» базы знаний. Каждый вариант ответа с весами — одно продукционное правило
 * с одним или несколькими заключениями. Варианты без весов (отказы, ошибочные решения ситуационных задач)
 * правил не дают.
 */
export function attributeRules(base: KnowledgeBase): AttributeRule[] {
  const rules: AttributeRule[] = [];
  for (const question of allQuestions(base)) {
    for (const option of question.options) {
      const effects = base.attributes
        .filter(({ id }) => weight(option, id) !== 0)
        .map(({ id }) => ({ attribute: id, weight: weight(option, id) }));
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
 * Прямой вывод. Условия правила стоят раньше выводимого вопроса, поэтому хватает одного прохода по вопросам:
 * когда очередь доходит до вопроса, значения всех его условий уже окончательные, в том числе выведенные
 * другими правилами (так работают цепочки). Если сработало несколько правил, берётся первое по порядку в базе.
 * Выведенное значение заменяет ответ пользователя на тот же вопрос, если он был (например, пользователь
 * вернулся назад и изменил ответ-условие).
 */
export function infer(base: KnowledgeBase, answers: Answers): Inference {
  const effective: Answers = { ...answers };
  const inferred = new Map<string, Rule>();
  if (base.rules.length === 0) return { answers: effective, inferred };

  const byTarget = new Map<string, Rule[]>();
  for (const rule of base.rules) {
    const rules = byTarget.get(rule.then.question);
    if (rules) rules.push(rule);
    else byTarget.set(rule.then.question, [rule]);
  }
  for (const question of allQuestions(base)) {
    const fired = byTarget
      .get(question.id)
      ?.find((rule) => rule.if.every((condition) => (effective[condition.question] ?? []).includes(condition.option)));
    if (fired) {
      effective[question.id] = [fired.then.option];
      inferred.set(question.id, fired);
    }
  }
  return { answers: effective, inferred };
}

/** Вопросы, которые задаются пользователю: все, кроме выведенных правилами. */
export function askedQuestions(base: KnowledgeBase, answers: Answers): Question[] {
  const { inferred } = infer(base, answers);
  return allQuestions(base).filter((question) => !inferred.has(question.id));
}

/** Все параметры получены: от пользователя или выведены правилами. */
export function isComplete(base: KnowledgeBase, answers: Answers): boolean {
  const { answers: effective } = infer(base, answers);
  return allQuestions(base).every((question) => selectedOptions(question, effective).length > 0);
}

/** Ближайший вопрос в направлении direction, который задаётся пользователю (не выведен правилом). */
export function nearestAsked(base: KnowledgeBase, from: number, direction: 1 | -1, answers: Answers): number | null {
  const questions = allQuestions(base);
  const { inferred } = infer(base, answers);
  for (let i = from; i >= 0 && i < questions.length; i += direction) {
    if (!inferred.has(questions[i].id)) return i;
  }
  return null;
}

/** Первый задаваемый вопрос без ответа. Он может оказаться позади текущего, если базу изменили после начала теста. */
export function firstUnanswered(base: KnowledgeBase, answers: Answers): number | null {
  const { answers: effective, inferred } = infer(base, answers);
  const index = allQuestions(base).findIndex((question) => !inferred.has(question.id) && selectedOptions(question, effective).length === 0);
  return index >= 0 ? index : null;
}

/** С какого вопроса продолжить тест: с первого без ответа, если он позади, иначе с ближайшего задаваемого. */
export function resumeStep(base: KnowledgeBase, answers: Answers, step: number): number {
  const from = Math.min(Math.max(0, step), Math.max(0, allQuestions(base).length - 1));
  const missing = firstUnanswered(base, answers);
  if (missing !== null && missing < from) return missing;
  return nearestAsked(base, from, 1, answers) ?? nearestAsked(base, from, -1, answers) ?? 0;
}

// ---------- 2. Правила «параметр + атрибут»: профиль предпочтений ----------

/**
 * Наименьшая и наибольшая сумма, которую вопрос может дать атрибуту: в вопросе с одним ответом —
 * наименьший и наибольший вес среди вариантов, с несколькими — сумма отрицательных и сумма положительных.
 * «Ничего из этого» нельзя совместить с другими вариантами, поэтому его вес с ними не складывается.
 */
export function questionBounds(question: Question, attribute: string): [number, number] {
  if (question.options.length === 0) return [0, 0];
  let low = Infinity;
  let high = -Infinity;
  if (question.type === 'single') {
    for (const option of question.options) {
      low = Math.min(low, weight(option, attribute));
      high = Math.max(high, weight(option, attribute));
    }
    return [low, high];
  }
  low = 0;
  high = 0;
  for (const option of question.options) {
    if (option.exclusive) continue;
    const value = weight(option, attribute);
    if (value < 0) low += value;
    else high += value;
  }
  for (const option of question.options) {
    if (!option.exclusive) continue;
    low = Math.min(low, weight(option, attribute));
    high = Math.max(high, weight(option, attribute));
  }
  return [low, high];
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

export function buildProfile(base: KnowledgeBase, effective: Answers, questions = allQuestions(base)): Profile {
  const points = zeroValues(base);
  const low = zeroValues(base);
  const high = zeroValues(base);
  const preference = zeroValues(base);
  for (const question of questions) {
    const chosen = selectedOptions(question, effective);
    if (chosen.length === 0) continue;
    for (const { id } of base.attributes) {
      const [min, max] = questionBounds(question, id);
      low[id] += min;
      high[id] += max;
      for (const option of chosen) points[id] += weight(option, id);
    }
  }
  for (const { id } of base.attributes) {
    const span = high[id] - low[id];
    preference[id] = span > 0 ? (2 * (points[id] - low[id])) / span - 1 : 0;
  }
  return { points, low, high, preference };
}

// ---------- 3. Ранжирование объектов ----------

export interface Contribution {
  attribute: string;
  /** Выраженность атрибута у объекта, 0–3. */
  level: number;
  /** Предпочтение пользователя по атрибуту, от −1 до 1. */
  preference: number;
  /** Вклад атрибута в косинус: положительный — атрибут совпал с предпочтениями, отрицательный — противоречит им. */
  value: number;
}

export interface ObjectScore {
  object: RankedObject;
  /** Косинус угла между профилем пользователя и атрибутами объекта, от −1 до 1. */
  cosine: number;
  /**
   * Совпадение от 0 до 1: (1 + cosine) / 2. 1 — объект в точности такой, как хочет пользователь,
   * 0,5 — не связан с его предпочтениями, меньше 0,5 — его свойства скорее противоречат ответам.
   */
  score: number;
  /** Место в рейтинге, начиная с 1. */
  rank: number;
  /** Вклад атрибутов, от самого большого к самому маленькому. */
  contributions: Contribution[];
}

/**
 * Совпадение объекта с профилем. Сначала считается косинусная мера сходства векторов: предпочтений
 * пользователя (от −1 до 1) и выраженности атрибутов объекта (от 0 до 3), где каждый атрибут идёт со своей
 * важностью. Косинус лежит от −1 до 1, поэтому для показа он переводится в шкалу от 0 до 1:
 * (1 + cosine) / 2. Перевод линейный, так что порядок объектов от него не зависит.
 */
export function rankObjects(base: KnowledgeBase, preference: AttributeValues): ObjectScore[] {
  const attributes = base.attributes;
  const preferenceNorm = Math.sqrt(attributes.reduce((sum, { id, importance }) => sum + importance * preference[id] ** 2, 0));
  const scored = base.objects.map((object) => {
    const objectNorm = Math.sqrt(attributes.reduce((sum, { id, importance }) => sum + importance * level(object, id) ** 2, 0));
    const norm = preferenceNorm * objectNorm;
    const contributions = attributes
      .filter(({ id }) => level(object, id) > 0)
      .map(({ id, importance }) => ({
        attribute: id,
        level: level(object, id),
        preference: preference[id],
        value: norm > 0 ? (importance * preference[id] * level(object, id)) / norm : 0,
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
export function liveRanking(base: KnowledgeBase, answers: Answers): ObjectScore[] {
  const { answers: effective } = infer(base, answers);
  return rankObjects(base, buildProfile(base, effective).preference);
}

// ---------- Итог по группам ----------

/** M — максимальная сумма баллов по каждому атрибуту при ответах на все вопросы. */
export function maxScores(base: KnowledgeBase): AttributeValues {
  const max = zeroValues(base);
  for (const question of allQuestions(base)) {
    for (const { id } of base.attributes) max[id] += questionBounds(question, id)[1];
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
export function breakdown(base: KnowledgeBase, answers: Answers): QuestionBreakdown[] {
  const { answers: effective, inferred } = infer(base, answers);
  return allQuestions(base).map((question) => {
    const selected = selectedOptions(question, effective);
    const points = zeroValues(base);
    for (const option of selected) {
      for (const { id } of base.attributes) points[id] += weight(option, id);
    }
    return { question, selected, points, rule: inferred.get(question.id) };
  });
}

export interface GroupScore {
  group: Group;
  points: number;
  max: number;
  /** Доля от максимума в процентах, без округления. Отрицательные веса могут увести сумму в минус, но доля ниже нуля не опускается. */
  percent: number;
  /** Баллы из общих блоков — решают при равенстве процентов. */
  generalPoints: number;
}

export interface Reason {
  questionId: string;
  points: number;
  text: string;
}

/** Итог по группам; есть, только если в базе заданы группы. */
export interface Verdict {
  /** Группы от самой подходящей к наименее подходящей. */
  ranking: GroupScore[];
  winner: GroupScore;
  /** Второго места нет, если группа одна. */
  runnerUp?: GroupScore;
  /** Второе место отстаёт меньше чем на closeGap п. п. */
  isClose: boolean;
  /** Лучшая группа набрала меньше weakPercent % максимума. */
  isWeak: boolean;
  /** Самые весомые ответы в пользу победившей группы. */
  reasons: Reason[];
}

export interface Evaluation {
  verdict: Verdict | null;
  /** Все объекты по рангу. */
  objects: ObjectScore[];
  profile: Profile;
  inferred: Map<string, Rule>;
}

export function evaluate(base: KnowledgeBase, answers: Answers): Evaluation {
  const { answers: effective, inferred } = infer(base, answers);
  const profile = buildProfile(base, effective);
  return {
    verdict: groupVerdict(base, effective, profile),
    objects: rankObjects(base, profile.preference),
    profile,
    inferred,
  };
}

function groupVerdict(base: KnowledgeBase, effective: Answers, profile: Profile): Verdict | null {
  if (base.groups.length === 0) return null;
  const max = maxScores(base);
  const generalQuestions = base.blocks.filter((block) => !block.group).flatMap((block) => block.questions);
  const general = buildProfile(base, effective, generalQuestions).points;

  // Больший процент выигрывает; при равенстве — больше баллов в общих блоках (там человек
  // сам выбирает между группами); потом среди ушедших в минус тот, кто ушёл меньше;
  // дальше — порядок групп в базе знаний (сортировка стабильная).
  const ranking = base.groups
    .map((group) => {
      const points = profile.points[group.attribute] ?? 0;
      const groupMax = max[group.attribute] ?? 0;
      return {
        group,
        points,
        max: groupMax,
        percent: groupMax > 0 ? Math.max(0, points / groupMax) * 100 : 0,
        generalPoints: general[group.attribute] ?? 0,
      };
    })
    .sort((a, b) => b.percent - a.percent || b.generalPoints - a.generalPoints || Math.min(b.points, 0) - Math.min(a.points, 0));

  const [winner, runnerUp] = ranking;
  return {
    ranking,
    winner,
    runnerUp,
    isClose: runnerUp !== undefined && winner.percent - runnerUp.percent < base.settings.closeGap,
    isWeak: winner.percent < base.settings.weakPercent,
    reasons: explain(base, effective, winner.group),
  };
}

/** Какие ответы сильнее всего говорят в пользу группы — подсистема объяснений. */
export function explain(base: KnowledgeBase, effective: Answers, group: Group, limit = 5): Reason[] {
  const reasons: Reason[] = [];
  for (const question of allQuestions(base)) {
    const chosen = selectedOptions(question, effective).filter((option) => weight(option, group.attribute) > 0);
    if (chosen.length === 0) continue;

    const template = question.reasonTemplate?.[group.id];
    if (template) {
      const list = chosen.map((option) => option.short || option.text).join(', ');
      reasons.push({
        questionId: question.id,
        points: chosen.reduce((sum, option) => sum + weight(option, group.attribute), 0),
        text: template.replace('{options}', () => list),
      });
      continue;
    }
    for (const option of chosen) {
      const text = option.reasons?.[group.id];
      if (text) reasons.push({ questionId: question.id, points: weight(option, group.attribute), text });
    }
  }
  // Сначала самые весомые ответы, при равных баллах — в порядке вопросов (сортировка стабильная).
  return reasons.sort((a, b) => b.points - a.points).slice(0, limit);
}
