// Общие функции скриптов: загрузка примера и проверка его принципов, симуляция случайных ответов.
// Общие для всех баз проверки лежат в src/engine/validate.ts, здесь — только то, что строже для примера.

import { deepStrictEqual } from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { baseImages } from '../src/engine/images.ts';
import { parseBase } from '../src/engine/parse.ts';
import { allQuestions, evaluate, level, maxScores } from '../src/engine/scoring.ts';
import type { Answers, KnowledgeBase } from '../src/engine/types.ts';
import { checkRequirements, REQUIREMENTS, runTestProfiles } from '../src/engine/validate.ts';
import type { ProfileResult } from '../src/engine/validate.ts';

/** Важность атрибутов-сфер и атрибутов стиля в примере. */
const SPHERE_IMPORTANCE = 2;
const STYLE_IMPORTANCE = 1;

export function loadExample(): KnowledgeBase {
  const raw: unknown = JSON.parse(readFileSync(new URL('../content/example.json', import.meta.url), 'utf8'));
  const parsed = parseBase(raw);
  if (!parsed.ok) throw new Error(`Пример не проходит проверку структуры:\n${parsed.errors.join('\n')}`);
  // Импорт файла и его экспорт не должны ничего терять.
  deepStrictEqual(parsed.base, raw);
  return parsed.base;
}

/** Принципы расстановки весов и требования задания: для примера это ошибки, для чужих баз — нет. */
export function validateExamplePrinciples(base: KnowledgeBase): string[] {
  const errors: string[] = [];
  const spheres = new Set(base.groups.map((group) => group.attribute));
  const attributeIds = base.attributes.map((attribute) => attribute.id);

  for (const attribute of base.attributes) {
    const expected = spheres.has(attribute.id) ? SPHERE_IMPORTANCE : STYLE_IMPORTANCE;
    if (attribute.importance !== expected) errors.push(`Атрибут ${attribute.id}: важность должна быть ${expected}`);
  }

  // Объекты ранжирования
  for (const object of base.objects) {
    const at = `Объект ${object.id}`;
    const group = base.groups.find((g) => g.id === object.group);
    if (!group) errors.push(`${at}: нет группы`);
    if (!object.description.trim()) errors.push(`${at}: нет описания`);
    if (Object.keys(object.values).sort().join() !== [...attributeIds].sort().join()) {
      errors.push(`${at}: значения нужны ровно по ${attributeIds.length} атрибутам`);
    }
    if (group && level(object, group.attribute) < 2) errors.push(`${at}: слабо выражена своя сфера ${group.attribute}`);
  }

  // Вопросы — параметры рабочей базы данных
  for (const block of base.blocks) {
    const own = base.groups.find((g) => g.id === block.group);
    for (const question of block.questions) {
      const at = `Вопрос ${question.id}`;
      if (!question.note.trim()) errors.push(`${at}: нет обоснования весов`);
      if (question.options.length < 3) errors.push(`${at}: меньше трёх вариантов`);
      if (question.options.map((o) => o.id).join('') !== 'abcdefgh'.slice(0, question.options.length)) {
        errors.push(`${at}: варианты должны идти по порядку a, b, c…`);
      }
      if (own && !question.options.some((o) => (o.weights[own.attribute] ?? 0) > 0)) {
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
        for (const [id, value] of Object.entries(option.weights)) {
          const [min, max] = spheres.has(id) ? [0, 3] : [-2, 3];
          if (!Number.isInteger(value) || value === 0 || value < min || value > max) {
            errors.push(`${opt}: вес «${id}» должен быть целым ненулевым от ${min} до ${max}`);
          }
        }
        for (const group of base.groups) {
          const value = option.weights[group.attribute] ?? 0;
          const template = question.reasonTemplate?.[group.id];
          if (template && value > 0 && !option.short) errors.push(`${opt}: нужна короткая формулировка (short)`);
          if (!template && value >= 2 && !option.reasons?.[group.id]) errors.push(`${opt}: вес ${value} для «${group.id}» без объяснения`);
          if (option.reasons?.[group.id] && !(value > 0)) errors.push(`${opt}: есть объяснение для «${group.id}», но вес 0`);
        }
        if (option.exclusive) {
          if (question.type !== 'multiple') errors.push(`${opt}: «ничего из этого» бывает только при нескольких ответах`);
          if (Object.keys(option.weights).length > 0) errors.push(`${opt}: у «ничего из этого» не должно быть весов`);
        }
      }
    }
  }

  // Правила «параметр + параметр»
  const questions = allQuestions(base);
  const targets = new Map<string, string>();
  for (const rule of base.rules) {
    const at = `Правило ${rule.title}`;
    const question = questions.find((q) => q.id === rule.then.question);
    if (question?.type === 'multiple' && !question.options.find((o) => o.id === rule.then.option)?.exclusive) {
      errors.push(`${at}: в вопросе с несколькими ответами правило может выводить только «ничего из этого»`);
    }
    const previous = targets.get(rule.then.question);
    if (previous && previous !== rule.then.option) errors.push(`${at}: другое правило выводит для ${rule.then.question} иное значение`);
    targets.set(rule.then.question, rule.then.option);
    if (!rule.note.trim()) errors.push(`${at}: нет обоснования`);
  }

  // Количественные требования задания
  for (const row of checkRequirements(base)) {
    if (!row.ok) errors.push(`Требование «${row.title}»: нужно ${row.need}, в базе ${row.actual}`);
  }

  // Баланс сфер
  const max = maxScores(base);
  const maxima = base.groups.map((group) => max[group.attribute]);
  if (Math.min(...maxima) !== Math.max(...maxima)) {
    errors.push(`Максимумы направлений различаются: ${base.groups.map((g) => `${g.id} ${max[g.attribute]}`).join(', ')}`);
  }
  return errors;
}

/** У каждой картинки примера есть файл, описание для незрячих и автор с лицензией, а лишних файлов нет. */
export function validateExampleImages(base: KnowledgeBase): string[] {
  const errors: string[] = [];
  const used = new Set<string>();
  for (const { image, where } of baseImages(base)) {
    used.add(image.url);
    if (!existsSync(new URL(`../public/${image.url}`, import.meta.url))) errors.push(`Нет файла public/${image.url} (${where})`);
    if (!image.alt?.trim()) errors.push(`У картинки ${image.url} нет описания (alt)`);
    const { author, source, url, license } = image.credit ?? {};
    if (!author || !source || !url || !license) errors.push(`У картинки ${image.url} не указаны автор, источник или лицензия`);
  }
  for (const file of readdirSync(new URL('../public/images/', import.meta.url))) {
    // Служебные файлы системы вроде .DS_Store на сайт попадают, но картинками не считаются.
    if (!file.startsWith('.') && !used.has(`images/${file}`)) errors.push(`Файл public/images/${file} нигде не используется`);
  }
  return errors;
}

/** Тестовые профили примера: к их ожиданиям добавляется требование задания о числе вопросов. */
export function runExampleProfiles(base: KnowledgeBase): ProfileResult[] {
  return runTestProfiles(base).map((result) => ({
    ...result,
    problems: [
      ...result.problems,
      ...(result.asked < REQUIREMENTS.questions ? [`задано ${result.asked} вопросов — меньше ${REQUIREMENTS.questions}`] : []),
    ],
  }));
}

/** Точное матожидание баллов сфер при случайных ответах без учёта правил. */
export function expectedRandomScores(base: KnowledgeBase): Record<string, number> {
  const expected = Object.fromEntries(base.groups.map((group) => [group.id, 0]));
  for (const question of allQuestions(base)) {
    const regular = question.options.filter((o) => !o.exclusive);
    const n = regular.length;
    // Если в вопросе с несколькими ответами нет «ничего из этого», пустой выбор заменяется случайным вариантом.
    const fallback = question.options.some((o) => o.exclusive) ? 0 : 0.5 ** n;
    for (const group of base.groups) {
      const total = regular.reduce((sum, o) => sum + (o.weights[group.attribute] ?? 0), 0);
      expected[group.id] += question.type === 'single' ? total / n : total / 2 + (fallback * total) / n;
    }
  }
  return expected;
}

export interface Simulation {
  runs: number;
  /** Сколько раз победила каждая группа. */
  wins: Record<string, number>;
  /** Средний процент группы. */
  meanPercent: Record<string, number>;
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
export function simulate(base: KnowledgeBase, runs = 20000, seed = 2026): Simulation {
  const random = mulberry32(seed);
  const wins = Object.fromEntries(base.groups.map((group) => [group.id, 0]));
  const percentSum = Object.fromEntries(base.groups.map((group) => [group.id, 0]));
  const firstPlace = Object.fromEntries(base.objects.map((o) => [o.id, 0]));
  const topFive = Object.fromEntries(base.objects.map((o) => [o.id, 0]));
  let weak = 0;
  let close = 0;
  let minAsked = Infinity;

  for (let run = 0; run < runs; run++) {
    const answers: Answers = {};
    for (const question of allQuestions(base)) {
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
    const evaluation = evaluate(base, answers);
    const verdict = evaluation.verdict!;
    wins[verdict.winner.group.id]++;
    for (const score of verdict.ranking) percentSum[score.group.id] += score.percent;
    if (verdict.isWeak) weak++;
    if (verdict.isClose) close++;
    firstPlace[evaluation.objects[0].object.id]++;
    for (const item of evaluation.objects.slice(0, 5)) topFive[item.object.id]++;
    minAsked = Math.min(minAsked, allQuestions(base).length - evaluation.inferred.size);
  }

  const meanPercent = Object.fromEntries(base.groups.map((group) => [group.id, percentSum[group.id] / runs]));
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

/** Короткие подписи атрибутов для отчётов. */
export function attributeTitles(base: KnowledgeBase): Record<string, string> {
  return Object.fromEntries(base.attributes.map((a) => [a.id, a.short]));
}

/** Короткие подписи групп для отчётов: у группы это подпись её атрибута. */
export function groupTitles(base: KnowledgeBase): Record<string, string> {
  const attributes = attributeTitles(base);
  return Object.fromEntries(base.groups.map((group) => [group.id, attributes[group.attribute]]));
}
