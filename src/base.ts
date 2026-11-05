// Выбранная база в контексте React и то, что интерфейс считает из её данных.

import { createContext, useContext } from 'react';
import { attributeRules, isComplete } from './engine/scoring.ts';
import type { AttributeRule } from './engine/scoring.ts';
import type { Answers, Attribute, Block, Condition, Group, KnowledgeBase, Option, Question } from './engine/types.ts';
import { hasErrors, validateBase } from './engine/validate.ts';
import type { Issue } from './engine/validate.ts';
import { basePath } from './router.ts';
import type { BaseRecord } from './storage.ts';

/** Вопрос вместе с блоком — в том порядке, в каком они идут в базе знаний. */
export interface Step {
  index: number;
  question: Question;
  block: Block;
  blockIndex: number;
}

export interface CompiledBase {
  /** id записи в хранилище. */
  id: string;
  base: KnowledgeBase;
  /** Встроенный пример: его нельзя менять. */
  builtIn: boolean;
  steps: Step[];
  /** Правила «параметр + атрибут» (А1, А2, …) — по одному на вариант ответа с весами. */
  attributeRules: AttributeRule[];
  /** Правило «параметр + атрибут» для варианта ответа; у вариантов без весов его нет. */
  attributeRuleOf: (questionId: string, optionId: string) => AttributeRule | undefined;
  /** Всего правил в базе знаний: «параметр + атрибут» и «параметр + параметр». */
  ruleCount: number;
  attributeById: Record<string, Attribute>;
  groupById: Record<string, Group>;
  questionById: Record<string, Question>;
  /** Ошибки и предупреждения проверки. */
  issues: Issue[];
  /** Ошибок нет — тест можно проходить. */
  canRun: boolean;
}

export function compileBase({ id, base, builtIn = false }: BaseRecord): CompiledBase {
  const steps = base.blocks
    .flatMap((block, blockIndex) => block.questions.map((question) => ({ question, block, blockIndex })))
    .map((step, index) => ({ ...step, index }));
  const rules = attributeRules(base);
  const ruleByOption = new Map(rules.map((rule) => [`${rule.question.id}/${rule.option.id}`, rule]));
  const issues = validateBase(base);
  return {
    id,
    base,
    builtIn,
    steps,
    attributeRules: rules,
    attributeRuleOf: (questionId, optionId) => ruleByOption.get(`${questionId}/${optionId}`),
    ruleCount: rules.length + base.rules.length,
    attributeById: Object.fromEntries(base.attributes.map((a) => [a.id, a])),
    groupById: Object.fromEntries(base.groups.map((g) => [g.id, g])),
    questionById: Object.fromEntries(steps.map(({ question }) => [question.id, question])),
    issues,
    canRun: !hasErrors(issues),
  };
}

export const BaseContext = createContext<CompiledBase | null>(null);

export function useBase(): CompiledBase {
  const value = useContext(BaseContext);
  if (!value) throw new Error('useBase вызван вне выбранной базы');
  return value;
}

/** Условие правила: вопрос и вариант. Правило может ссылаться на то, чего уже нет: это ошибка, но показать его надо. */
export function resolveCondition(compiled: CompiledBase, condition: Condition): { parameter: string; option: Option | undefined; optionText: string } {
  const question = compiled.questionById[condition.question];
  const option = question?.options.find((o) => o.id === condition.option);
  return { parameter: question?.parameter ?? condition.question, option, optionText: option?.text ?? condition.option };
}

/** Куда вернуться с других экранов: к результату, к текущему вопросу или на стартовый экран теста. */
export function testPath(compiled: CompiledBase, answers: Answers | undefined): string {
  const hasAnswers = answers !== undefined && Object.values(answers).some((ids) => ids.length > 0);
  if (!compiled.canRun || !hasAnswers) return basePath(compiled.id);
  return basePath(compiled.id, isComplete(compiled.base, answers) ? 'result' : 'test');
}

export function groupsTitle(base: KnowledgeBase): string {
  return base.settings.groupsTitle || 'Группы';
}

/** Сколько минут примерно занимает тест: около 18 секунд на вопрос. */
export function estimatedMinutes(questions: number): number {
  return Math.max(1, Math.round(questions * 0.3));
}

/** Доля от 0 до 1 в процентах: 0,724 → «72 %». */
export function percent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

/**
 * Предпочтение по атрибуту для показа: где сумма баллов лежит между наименьшей и наибольшей
 * возможной — 0 % все ответы против, 50 % поровну, 100 % все за. Внутри движка это p от −1 до 1.
 */
export function preferencePercent(preference: number): string {
  return `${Math.round((preference + 1) * 50)} %`;
}
