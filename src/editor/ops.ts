// Операции редактора над черновиком базы. Чистые функции без React: они меняют переданный черновик
// и следят за целостностью, чтобы после удаления не оставалось ссылок в никуда.

import { DEFAULT_SETTINGS } from '../engine/parse.ts';
import { allQuestions } from '../engine/scoring.ts';
import { BASE_FORMAT, BASE_FORMAT_VERSION } from '../engine/types.ts';
import type { Attribute, Block, Group, KnowledgeBase, Option, Question, RankedObject, Rule, TestProfile } from '../engine/types.ts';

/** Новая база: пустая, с одним блоком, чтобы сразу можно было добавлять вопросы. */
export function emptyBase(): KnowledgeBase {
  return {
    format: BASE_FORMAT,
    formatVersion: BASE_FORMAT_VERSION,
    title: 'Новая база знаний',
    subtitle: '',
    description: '',
    author: '',
    settings: { ...DEFAULT_SETTINGS },
    attributes: [],
    groups: [],
    objects: [],
    blocks: [{ id: 'b1', title: '', description: '', questions: [] }],
    rules: [],
    testProfiles: [],
  };
}

/** Копия базы: новое название, остальное как было. */
export function copyOf(base: KnowledgeBase): KnowledgeBase {
  return { ...structuredClone(base), title: `${base.title} (копия)` };
}

/** Первый свободный id вида prefix1, prefix2, … */
function nextId(prefix: string, items: { id: string }[]): string {
  const used = new Set(items.map((item) => item.id));
  let number = items.length + 1;
  while (used.has(`${prefix}${number}`)) number++;
  return `${prefix}${number}`;
}

/** Сдвигает элемент списка на одну позицию. За границы списка не выходит. */
export function moveItem<T>(list: T[], index: number, direction: -1 | 1): void {
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
}

// ---------- Атрибуты ----------

export function addAttribute(base: KnowledgeBase, title = ''): Attribute {
  const attribute: Attribute = { id: nextId('a', base.attributes), title, short: '', description: '', importance: 1 };
  base.attributes.push(attribute);
  return attribute;
}

/** Что пропадёт вместе с атрибутом: для вопроса перед удалением. */
export function attributeUsage(base: KnowledgeBase, id: string): { values: number; weights: number; groups: Group[] } {
  return {
    values: base.objects.filter((object) => (object.values[id] ?? 0) !== 0).length,
    weights: allQuestions(base).flatMap((q) => q.options).filter((option) => (option.weights[id] ?? 0) !== 0).length,
    groups: base.groups.filter((group) => group.attribute === id),
  };
}

export function removeAttribute(base: KnowledgeBase, id: string): void {
  for (const group of base.groups.filter((item) => item.attribute === id)) removeGroup(base, group.id);
  base.attributes = base.attributes.filter((attribute) => attribute.id !== id);
  for (const object of base.objects) delete object.values[id];
  for (const question of allQuestions(base)) {
    for (const option of question.options) delete option.weights[id];
  }
}

// ---------- Группы ----------

/** Группа связана с атрибутом. Если свободного атрибута нет, он создаётся вместе с группой. */
export function addGroup(base: KnowledgeBase): Group {
  const id = nextId('g', base.groups);
  const title = `Группа ${base.groups.length + 1}`;
  const free = base.attributes.find((attribute) => !base.groups.some((group) => group.attribute === attribute.id));
  const attribute = free ?? addAttribute(base, title);
  const group: Group = { id, attribute: attribute.id, title: free ? attribute.title : title, description: '' };
  base.groups.push(group);
  return group;
}

export function removeGroup(base: KnowledgeBase, id: string): void {
  base.groups = base.groups.filter((group) => group.id !== id);
  for (const object of base.objects) {
    if (object.group === id) delete object.group;
  }
  for (const block of base.blocks) {
    if (block.group === id) delete block.group;
  }
  for (const question of allQuestions(base)) {
    deleteKey(question, 'reasonTemplate', id);
    for (const option of question.options) deleteKey(option, 'reasons', id);
  }
  for (const profile of base.testProfiles) {
    if (profile.expectGroup) profile.expectGroup = profile.expectGroup.filter((groupId) => groupId !== id);
  }
}

/** Убирает ключ из необязательного словаря, а опустевший словарь — целиком. */
function deleteKey<K extends string>(holder: { [P in K]?: Record<string, unknown> }, field: K, key: string): void {
  const map = holder[field];
  if (!map) return;
  delete map[key];
  if (Object.keys(map).length === 0) delete holder[field];
}

// ---------- Объекты ----------

export function addObject(base: KnowledgeBase): RankedObject {
  const object: RankedObject = { id: nextId('o', base.objects), title: '', description: '', values: {} };
  base.objects.push(object);
  return object;
}

export function removeObject(base: KnowledgeBase, id: string): void {
  base.objects = base.objects.filter((object) => object.id !== id);
  for (const profile of base.testProfiles) {
    if (profile.expectTop) profile.expectTop = profile.expectTop.filter((objectId) => objectId !== id);
  }
}

// ---------- Блоки и вопросы ----------

export function addBlock(base: KnowledgeBase): Block {
  const block: Block = { id: nextId('b', base.blocks), title: '', description: '', questions: [] };
  base.blocks.push(block);
  return block;
}

export function removeBlock(base: KnowledgeBase, id: string): void {
  const block = base.blocks.find((item) => item.id === id);
  for (const question of block?.questions ?? []) removeQuestion(base, question.id);
  base.blocks = base.blocks.filter((item) => item.id !== id);
}

/** Вариант ответа с первой свободной буквой: a, b, c… */
export function newOption(question: Pick<Question, 'options'>): Option {
  const used = new Set(question.options.map((option) => option.id));
  const letter = [...'abcdefghijklmnopqrstuvwxyz'].find((candidate) => !used.has(candidate));
  return { id: letter ?? nextId('o', question.options), text: '', weights: {} };
}

export function addQuestion(base: KnowledgeBase, blockId: string): Question {
  const question: Question = { id: nextId('q', allQuestions(base)), parameter: '', text: '', type: 'single', note: '', options: [] };
  question.options.push(newOption(question));
  question.options.push(newOption(question));
  base.blocks.find((block) => block.id === blockId)?.questions.push(question);
  return question;
}

/** Правила, которым нужен этот вопрос (или только этот его вариант). Без условия правило изменило бы смысл. */
export function rulesUsing(base: KnowledgeBase, questionId: string, optionId?: string): Rule[] {
  const matches = (part: { question: string; option: string }) =>
    part.question === questionId && (optionId === undefined || part.option === optionId);
  return base.rules.filter((rule) => matches(rule.then) || rule.if.some(matches));
}

export function removeQuestion(base: KnowledgeBase, id: string): void {
  const dependent = new Set(rulesUsing(base, id));
  base.rules = base.rules.filter((rule) => !dependent.has(rule));
  for (const block of base.blocks) block.questions = block.questions.filter((question) => question.id !== id);
  for (const profile of base.testProfiles) delete profile.answers[id];
}

export function removeOption(base: KnowledgeBase, questionId: string, optionId: string): void {
  const dependent = new Set(rulesUsing(base, questionId, optionId));
  base.rules = base.rules.filter((rule) => !dependent.has(rule));
  const question = allQuestions(base).find((item) => item.id === questionId);
  if (question) question.options = question.options.filter((option) => option.id !== optionId);
  for (const profile of base.testProfiles) {
    const selected = profile.answers[questionId];
    if (selected) profile.answers[questionId] = selected.filter((id) => id !== optionId);
  }
}

/** Двигает вопрос внутри блока, а на границе блока — в соседний блок. */
export function moveQuestion(base: KnowledgeBase, questionId: string, direction: -1 | 1): void {
  const blockIndex = base.blocks.findIndex((block) => block.questions.some((question) => question.id === questionId));
  if (blockIndex < 0) return;
  const block = base.blocks[blockIndex];
  const index = block.questions.findIndex((question) => question.id === questionId);
  const target = index + direction;
  if (target >= 0 && target < block.questions.length) {
    moveItem(block.questions, index, direction);
    return;
  }
  const neighbour = base.blocks[blockIndex + direction];
  if (!neighbour) return;
  const [question] = block.questions.splice(index, 1);
  if (direction < 0) neighbour.questions.push(question);
  else neighbour.questions.unshift(question);
}

/** «Ничего из этого» и общие объяснения работают только при нескольких ответах. */
export function setQuestionType(question: Question, type: Question['type']): void {
  question.type = type;
  if (type === 'single') {
    delete question.reasonTemplate;
    for (const option of question.options) delete option.exclusive;
  }
}

/** Вес варианта ответа. Нулевые веса не хранятся. */
export function setWeight(option: Option, attribute: string, value: number): void {
  if (value === 0) delete option.weights[attribute];
  else option.weights[attribute] = value;
}

/** Фраза в необязательном словаре объяснений. Пустая фраза убирает ключ. */
export function setPhrase<K extends string>(holder: { [P in K]?: Record<string, string> }, field: K, key: string, text: string): void {
  if (text) {
    const map = (holder[field] ?? {}) as Record<string, string>;
    map[key] = text;
    (holder as Record<K, Record<string, string>>)[field] = map;
  } else {
    deleteKey(holder, field, key);
  }
}

// ---------- Правила «параметр + параметр» ----------

/** Новое правило: второй вопрос выводится из первого. Нужно хотя бы два вопроса. */
export function addRule(base: KnowledgeBase): Rule | null {
  const questions = allQuestions(base).filter((question) => question.options.length > 0);
  if (questions.length < 2) return null;
  const [source, target] = questions;
  const numbers = base.rules.map((rule) => Number(/^П(\d+)$/.exec(rule.title)?.[1] ?? 0));
  const rule: Rule = {
    id: nextId('r', base.rules),
    title: `П${Math.max(0, ...numbers) + 1}`,
    if: [{ question: source.id, option: source.options[0].id }],
    then: { question: target.id, option: target.options[0].id },
    note: '',
  };
  base.rules.push(rule);
  return rule;
}

// ---------- Тестовые профили ----------

export function addProfile(base: KnowledgeBase, profile?: Partial<TestProfile>): TestProfile {
  const created: TestProfile = { name: `Профиль ${base.testProfiles.length + 1}`, answers: {}, ...profile };
  base.testProfiles.push(created);
  return created;
}
