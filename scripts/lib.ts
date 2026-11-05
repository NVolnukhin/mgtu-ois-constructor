// Общие функции скриптов: загрузка и проверка базы знаний, прогон персон, симуляция случайных ответов.

import { existsSync, readFileSync } from 'node:fs';
import { ATTRIBUTE_IDS, DIRECTION_IDS, STYLE_IDS } from '../src/engine/types.ts';
import type { Answers, AttributeId, DirectionId, Images, Quiz } from '../src/engine/types.ts';
import { allQuestions, askedQuestions, evaluate, infer, maxScores, selectedOptions, zeroValues } from '../src/engine/scoring.ts';
import type { Evaluation } from '../src/engine/scoring.ts';
import { PERSONAS } from './personas.ts';
import type { Persona } from './personas.ts';

/** Требования к прототипу экспертной системы из задания. */
export const REQUIREMENTS = { questions: 20, parameters: 10, objects: 20, attributes: 10, top: 5 };

export function loadQuiz(): Quiz {
  return JSON.parse(readFileSync(new URL('../content/quiz.json', import.meta.url), 'utf8')) as Quiz;
}

export function loadImages(): Images {
  return JSON.parse(readFileSync(new URL('../content/images.json', import.meta.url), 'utf8')) as Images;
}

/** Сколько вопросов задаётся в худшем случае: все, кроме тех, что могут быть выведены правилами. */
export function minAskedQuestions(quiz: Quiz): number {
  return allQuestions(quiz).length - new Set(quiz.rules.map((rule) => rule.then.question)).size;
}

/** Проверяет структуру базы знаний и принципы расстановки весов. Возвращает список ошибок. */
export function validateQuiz(quiz: Quiz): string[] {
  const errors: string[] = [];
  const isSphere = (id: string) => (DIRECTION_IDS as readonly string[]).includes(id);

  // Атрибуты и направления
  if (quiz.attributes.map((a) => a.id).join() !== ATTRIBUTE_IDS.join()) {
    errors.push(`Атрибуты должны быть ровно такими и в таком порядке: ${ATTRIBUTE_IDS.join(', ')}`);
  }
  for (const attribute of quiz.attributes) {
    if (attribute.group !== (isSphere(attribute.id) ? 'sphere' : 'style')) {
      errors.push(`Атрибут ${attribute.id}: неверная группа ${attribute.group}`);
    }
  }
  if (quiz.directions.map((d) => d.id).join() !== DIRECTION_IDS.join()) {
    errors.push(`Направления должны быть ровно такими и в таком порядке: ${DIRECTION_IDS.join(', ')}`);
  }

  // Объекты ранжирования
  const objectIds = new Set<string>();
  for (const object of quiz.objects) {
    const at = `Объект ${object.id}`;
    if (objectIds.has(object.id)) errors.push(`${at}: id повторяется`);
    objectIds.add(object.id);
    if (!DIRECTION_IDS.includes(object.direction)) errors.push(`${at}: неизвестное направление ${object.direction}`);
    if (!object.title?.trim() || !object.description?.trim()) errors.push(`${at}: нет названия или описания`);
    if (Object.keys(object.attributes ?? {}).sort().join() !== [...ATTRIBUTE_IDS].sort().join()) {
      errors.push(`${at}: значения нужны ровно по ${ATTRIBUTE_IDS.length} атрибутам`);
      continue;
    }
    for (const id of ATTRIBUTE_IDS) {
      const value = object.attributes[id];
      if (!Number.isInteger(value) || value < 0 || value > 3) errors.push(`${at}: «${id}» должно быть целым от 0 до 3`);
    }
    if (object.attributes[object.direction] < 2) errors.push(`${at}: слабо выражена своя сфера ${object.direction}`);
  }

  // Вопросы — параметры рабочей базы данных
  const seen = new Set<string>();
  const parameters = new Set<string>();
  for (const block of quiz.blocks) {
    const own = block.direction;
    if (own && !DIRECTION_IDS.includes(own)) errors.push(`Блок ${block.id}: неизвестное направление ${own}`);

    for (const question of block.questions) {
      const at = `Вопрос ${question.id}`;
      if (seen.has(question.id)) errors.push(`${at}: id повторяется`);
      seen.add(question.id);
      if (!question.parameter?.trim()) errors.push(`${at}: нет названия параметра`);
      if (parameters.has(question.parameter)) errors.push(`${at}: параметр «${question.parameter}» уже есть`);
      parameters.add(question.parameter);

      if (question.type !== 'single' && question.type !== 'multiple') {
        errors.push(`${at}: тип должен быть single (один ответ) или multiple (несколько ответов)`);
      }
      if (!question.text?.trim() || !question.note?.trim()) errors.push(`${at}: нет текста или обоснования весов`);
      if (question.options.length < 3) errors.push(`${at}: меньше трёх вариантов`);
      if (question.options.map((o) => o.id).join('') !== 'abcdefgh'.slice(0, question.options.length)) {
        errors.push(`${at}: варианты должны идти по порядку a, b, c…`);
      }
      if (own && !question.options.some((o) => (o.weights[own] ?? 0) > 0)) {
        errors.push(`${at}: ни один вариант не даёт баллов направлению своего блока`);
      }
      if (question.reasonTemplate && question.type !== 'multiple') {
        errors.push(`${at}: общее объяснение (reasonTemplate) бывает только в вопросах с несколькими ответами`);
      }
      for (const template of Object.values(question.reasonTemplate ?? {})) {
        if (!template.includes('{options}')) errors.push(`${at}: в общем объяснении нет {options}`);
      }

      for (const option of question.options) {
        const opt = `${at}, вариант ${option.id}`;
        for (const [id, value] of Object.entries(option.weights ?? {})) {
          if (!(ATTRIBUTE_IDS as readonly string[]).includes(id)) {
            errors.push(`${opt}: неизвестный атрибут «${id}»`);
            continue;
          }
          const [min, max] = isSphere(id) ? [0, 3] : [-2, 3];
          if (!Number.isInteger(value) || value === 0 || value < min || value > max) {
            errors.push(`${opt}: вес «${id}» должен быть целым ненулевым от ${min} до ${max}`);
          }
        }
        for (const id of DIRECTION_IDS) {
          const value = option.weights[id] ?? 0;
          const template = question.reasonTemplate?.[id];
          if (template && value > 0 && !option.short) errors.push(`${opt}: нужна короткая формулировка (short)`);
          if (!template && value >= 2 && !option.reasons?.[id]) errors.push(`${opt}: вес ${value} для «${id}» без объяснения`);
        }
        for (const id of Object.keys(option.reasons ?? {}) as DirectionId[]) {
          if (!((option.weights[id] ?? 0) > 0)) errors.push(`${opt}: есть объяснение для «${id}», но вес 0`);
        }
        if (option.exclusive) {
          if (question.type !== 'multiple') errors.push(`${opt}: «ничего из этого» бывает только при нескольких ответах`);
          if (Object.keys(option.weights).length > 0) errors.push(`${opt}: у «ничего из этого» не должно быть весов`);
        }
      }
    }
  }

  // Правила «параметр + параметр»
  const questions = allQuestions(quiz);
  const position = new Map(questions.map((q, i) => [q.id, i]));
  const ruleIds = new Set<string>();
  const targets = new Map<string, string>();
  for (const rule of quiz.rules) {
    const at = `Правило ${rule.title}`;
    if (ruleIds.has(rule.id)) errors.push(`${at}: id повторяется`);
    ruleIds.add(rule.id);
    for (const part of [rule.if, rule.then]) {
      const question = questions.find((q) => q.id === part.question);
      if (!question) errors.push(`${at}: нет вопроса ${part.question}`);
      else if (!question.options.some((o) => o.id === part.option)) errors.push(`${at}: у ${part.question} нет варианта ${part.option}`);
      else if (question.type === 'multiple' && part === rule.then && !question.options.find((o) => o.id === part.option)?.exclusive) {
        errors.push(`${at}: в вопросе с несколькими ответами правило может выводить только «ничего из этого»`);
      }
    }
    if ((position.get(rule.then.question) ?? -1) <= (position.get(rule.if.question) ?? Infinity)) {
      errors.push(`${at}: выводимый вопрос должен идти после вопроса-условия`);
    }
    const previous = targets.get(rule.then.question);
    if (previous && previous !== rule.then.option) errors.push(`${at}: другое правило выводит для ${rule.then.question} иное значение`);
    targets.set(rule.then.question, rule.then.option);
    if (!rule.note?.trim()) errors.push(`${at}: нет обоснования`);
  }

  // Количественные требования задания
  if (questions.length < REQUIREMENTS.questions) errors.push(`Вопросов ${questions.length}, нужно не меньше ${REQUIREMENTS.questions}`);
  if (minAskedQuestions(quiz) < REQUIREMENTS.questions) {
    errors.push(`При срабатывании всех правил задаётся ${minAskedQuestions(quiz)} вопросов, нужно не меньше ${REQUIREMENTS.questions}`);
  }
  if (parameters.size < REQUIREMENTS.parameters) errors.push(`Параметров ${parameters.size}, нужно не меньше ${REQUIREMENTS.parameters}`);
  if (quiz.objects.length < REQUIREMENTS.objects) errors.push(`Объектов ${quiz.objects.length}, нужно не меньше ${REQUIREMENTS.objects}`);
  if (quiz.attributes.length < REQUIREMENTS.attributes) errors.push(`Атрибутов ${quiz.attributes.length}, нужно не меньше ${REQUIREMENTS.attributes}`);

  // Баланс сфер
  const max = maxScores(quiz);
  const values = DIRECTION_IDS.map((id) => max[id]);
  if (Math.min(...values) !== Math.max(...values)) {
    errors.push(`Максимумы направлений различаются: ${DIRECTION_IDS.map((id) => `${id} ${max[id]}`).join(', ')}`);
  }
  return errors;
}

/** У каждой картинки из квиза есть файл, описание для незрячих и автор с лицензией. */
export function validateImages(quiz: Quiz, images: Images): string[] {
  const errors: string[] = [];
  const used = [
    quiz.image,
    ...quiz.directions.map((d) => d.image),
    ...allQuestions(quiz).flatMap((q) => [q.image, ...q.options.flatMap((o) => (o.image ? [o.image] : []))]),
  ];
  for (const key of used) {
    if (!images[key]) errors.push(`Картинки «${key}» нет в content/images.json`);
  }
  for (const [key, image] of Object.entries(images)) {
    if (!used.includes(key)) errors.push(`Картинка «${key}» нигде не используется`);
    if (!existsSync(new URL(`../public/${image.file}`, import.meta.url))) errors.push(`Нет файла public/${image.file}`);
    if (!image.alt?.trim()) errors.push(`У картинки «${key}» нет описания (alt)`);
    const { author, source, url, license } = image.credit ?? {};
    if (!author || !source || !url || !license) errors.push(`У картинки «${key}» не указаны автор, источник или лицензия`);
  }
  return errors;
}

/**
 * Превращает анкету персоны ('a', 'ac', …) в ответы по id вопросов.
 * «-» — пользователь этот вопрос не видел: значение должно вывести правило.
 */
export function sheetToAnswers(quiz: Quiz, sheet: string[]): Answers {
  const questions = allQuestions(quiz);
  if (sheet.length !== questions.length) {
    throw new Error(`В анкете ${sheet.length} ответов, а вопросов ${questions.length}`);
  }
  const answers: Answers = {};
  questions.forEach((question, index) => {
    const where = `Вопрос ${index + 1} (${question.id})`;
    if (sheet[index] === '-') return;
    const ids = [...sheet[index]];
    if (question.type === 'single' && ids.length !== 1) throw new Error(`${where}: нужен ровно один ответ`);
    for (const id of ids) {
      const option = question.options.find((o) => o.id === id);
      if (!option) throw new Error(`${where}: нет варианта ${id}`);
      if (option.exclusive && ids.length > 1) throw new Error(`${where}: «ничего из этого» нельзя совмещать`);
    }
    answers[question.id] = ids;
  });
  const { answers: effective } = infer(quiz, answers);
  questions.forEach((question, index) => {
    if (selectedOptions(question, effective).length === 0) {
      throw new Error(`Вопрос ${index + 1} (${question.id}): нет ни ответа, ни правила, которое бы его вывело`);
    }
  });
  return answers;
}

export interface PersonaResult {
  persona: Persona;
  evaluation: Evaluation;
  asked: number;
  problems: string[];
}

export function runPersonas(quiz: Quiz): PersonaResult[] {
  return PERSONAS.map((persona) => {
    const answers = sheetToAnswers(quiz, persona.sheet);
    const evaluation = evaluate(quiz, answers);
    const asked = askedQuestions(quiz, answers).length;
    const problems: string[] = [];
    if (!persona.expect.includes(evaluation.winner.direction.id)) {
      problems.push(`ожидали направление ${persona.expect.join(' или ')}, получили ${evaluation.winner.direction.id}`);
    }
    if (persona.expectClose !== undefined && persona.expectClose !== evaluation.isClose) {
      problems.push(persona.expectClose ? 'второе место должно быть почти равным' : 'второе место не должно быть почти равным');
    }
    if ((persona.expectWeak ?? false) !== evaluation.isWeak) {
      problems.push(persona.expectWeak ? 'склонность должна быть слабой' : 'склонность должна быть выраженной');
    }
    const top3 = evaluation.objects.slice(0, 3).map((item) => item.object.id);
    if (persona.expectTop && !persona.expectTop.some((id) => top3.includes(id))) {
      problems.push(`в тройке лидеров ${top3.join(', ')}, а ожидали хотя бы одно из: ${persona.expectTop.join(', ')}`);
    }
    if (asked < REQUIREMENTS.questions) problems.push(`задано ${asked} вопросов — меньше ${REQUIREMENTS.questions}`);
    return { persona, evaluation, asked, problems };
  });
}

/** Точное матожидание баллов сфер при случайных ответах без учёта правил. */
export function expectedRandomScores(quiz: Quiz): Record<DirectionId, number> {
  const expected = Object.fromEntries(DIRECTION_IDS.map((id) => [id, 0])) as Record<DirectionId, number>;
  for (const question of allQuestions(quiz)) {
    const regular = question.options.filter((o) => !o.exclusive);
    const n = regular.length;
    // Если в вопросе с несколькими ответами нет «ничего из этого», пустой выбор заменяется случайным вариантом.
    const fallback = question.options.some((o) => o.exclusive) ? 0 : 0.5 ** n;
    for (const id of DIRECTION_IDS) {
      const total = regular.reduce((sum, o) => sum + (o.weights[id] ?? 0), 0);
      expected[id] += question.type === 'single' ? total / n : total / 2 + (fallback * total) / n;
    }
  }
  return expected;
}

export interface Simulation {
  runs: number;
  /** Сколько раз победило каждое направление. */
  wins: Record<DirectionId, number>;
  /** Средний процент направления. */
  meanPercent: Record<DirectionId, number>;
  weak: number;
  close: number;
  /** Сколько раз объект оказался на первом месте и в пятёрке лидеров. */
  firstPlace: Record<string, number>;
  topFive: Record<string, number>;
  /** Наименьшее число заданных вопросов. */
  minAsked: number;
}

/**
 * Прогоняет анкеты со случайными ответами: в вопросе с одним ответом вариант выбирается
 * равновероятно, с несколькими — каждый вариант отмечается с вероятностью 1/2. Правила
 * «параметр + параметр» применяются так же, как в интерфейсе.
 */
export function simulate(quiz: Quiz, runs = 20000, seed = 2026): Simulation {
  const random = mulberry32(seed);
  const wins = Object.fromEntries(DIRECTION_IDS.map((id) => [id, 0])) as Record<DirectionId, number>;
  const percentSum = Object.fromEntries(DIRECTION_IDS.map((id) => [id, 0])) as Record<DirectionId, number>;
  const firstPlace = Object.fromEntries(quiz.objects.map((o) => [o.id, 0]));
  const topFive = Object.fromEntries(quiz.objects.map((o) => [o.id, 0]));
  let weak = 0;
  let close = 0;
  let minAsked = Infinity;

  for (let run = 0; run < runs; run++) {
    const answers: Answers = {};
    for (const question of allQuestions(quiz)) {
      const regular = question.options.filter((o) => !o.exclusive);
      if (question.type === 'single') {
        answers[question.id] = [regular[Math.floor(random() * regular.length)].id];
        continue;
      }
      const picked = regular.filter(() => random() < 0.5).map((o) => o.id);
      // Ничего не отмечено: берём «ничего из этого», а если его нет — любой вариант, иначе анкета неполная.
      const none = question.options.find((o) => o.exclusive);
      answers[question.id] =
        picked.length > 0 ? picked : [none?.id ?? regular[Math.floor(random() * regular.length)].id];
    }
    const evaluation = evaluate(quiz, answers);
    wins[evaluation.winner.direction.id]++;
    for (const score of evaluation.ranking) percentSum[score.direction.id] += score.percent;
    if (evaluation.isWeak) weak++;
    if (evaluation.isClose) close++;
    firstPlace[evaluation.objects[0].object.id]++;
    for (const item of evaluation.objects.slice(0, 5)) topFive[item.object.id]++;
    minAsked = Math.min(minAsked, allQuestions(quiz).length - evaluation.inferred.size);
  }

  const meanPercent = Object.fromEntries(DIRECTION_IDS.map((id) => [id, percentSum[id] / runs])) as Record<DirectionId, number>;
  return { runs, wins, meanPercent, weak, close, firstPlace, topFive, minAsked };
}

/** Детерминированный генератор случайных чисел, чтобы отчёт не менялся от запуска к запуску. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function percent(value: number, total = 100): string {
  return `${Math.round((value / total) * 1000) / 10}`.replace('.', ',') + ' %';
}

/** Подписи атрибутов для отчётов. */
export function attributeTitles(quiz: Quiz): Record<AttributeId, string> {
  return Object.fromEntries(quiz.attributes.map((a) => [a.id, a.short])) as Record<AttributeId, string>;
}

export { STYLE_IDS, zeroValues };
