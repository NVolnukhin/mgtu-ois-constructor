// База знаний для приложения. Структуру JSON проверяет npm run check, поэтому здесь только приведение типов.

import exampleJson from '../content/example.json';
import { attributeRules } from './engine/scoring.ts';
import type { AttributeRule } from './engine/scoring.ts';
import type { Attribute, Block, Group, KnowledgeBase, Question } from './engine/types.ts';

export const quiz = exampleJson as unknown as KnowledgeBase;

/** Вопрос вместе с блоком — в том порядке, в каком они идут в базе знаний. */
export interface Step {
  index: number;
  question: Question;
  block: Block;
  blockIndex: number;
}

export const steps: Step[] = quiz.blocks
  .flatMap((block, blockIndex) => block.questions.map((question) => ({ question, block, blockIndex })))
  .map((step, index) => ({ ...step, index }));

/** Правила «параметр + атрибут» (А1, А2, …) — по одному на вариант ответа с весами. */
export const attributeRuleList = attributeRules(quiz);
const attributeRuleByOption = new Map(attributeRuleList.map((rule) => [`${rule.question.id}/${rule.option.id}`, rule]));

/** Правило «параметр + атрибут» для варианта ответа; у вариантов без весов его нет. */
export function attributeRuleOf(questionId: string, optionId: string): AttributeRule | undefined {
  return attributeRuleByOption.get(`${questionId}/${optionId}`);
}

/** Всего правил в базе знаний: «параметр + атрибут» и «параметр + параметр». */
export const ruleCount = attributeRuleList.length + quiz.rules.length;

export const attributeById: Record<string, Attribute> = Object.fromEntries(quiz.attributes.map((a) => [a.id, a]));
export const groupById: Record<string, Group> = Object.fromEntries(quiz.groups.map((g) => [g.id, g]));

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
