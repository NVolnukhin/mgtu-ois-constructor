// Проверки базы знаний: ошибки в базе, требования ДЗ, тестовые профили.
// Чистые функции: их используют и экран «Проверка» в браузере, и npm run check.

import { baseImages, isSafeImagePosition, isSafeImageUrl, isSafeLinkUrl } from './images.ts';
import { parseBaseText } from './parse.ts';
import type { ParseResult } from './parse.ts';
import { allQuestions, askedQuestions, evaluate, infer, maxScores, questionBounds, ruleTitle, selectedOptions, weight } from './scoring.ts';
import type { Evaluation } from './scoring.ts';
import type { KnowledgeBase, Question, Rule, TestProfile } from './types.ts';

/** Раздел редактора, где правится найденная проблема. */
export type IssueSection = 'general' | 'attributes' | 'groups' | 'objects' | 'questions' | 'rules' | 'settings';

export interface Issue {
  /** error — тест по такой базе не запускается, warning — запускается, но автору стоит посмотреть. */
  severity: 'error' | 'warning';
  section: IssueSection;
  message: string;
  /** id сущности, к которой относится проблема. */
  target?: string;
  /** Повторяющийся id или ссылка в никуда: в редакторе такое не исправить, поэтому файл не импортируется. */
  integrity?: boolean;
}

/** Допустимые веса варианта ответа. */
export const WEIGHT_RANGE = { min: -3, max: 3 };
/** Шкала выраженности атрибута у объекта. */
export const VALUE_RANGE = { min: 0, max: 3 };
/** Наибольшая важность атрибута. Слишком большое число переполнило бы косинусную меру. */
export const IMPORTANCE_MAX = 100;
/** Минимальная выраженность атрибута своей группы у объекта: слабее — повод пересмотреть группу или значения. */
const OWN_GROUP_LEVEL = 2;

/** Сколько вопросов задаётся в худшем случае: все, кроме тех, что могут быть выведены правилами. */
export function minAskedQuestions(base: KnowledgeBase): number {
  return allQuestions(base).length - new Set(base.rules.map((rule) => rule.then.question)).size;
}

function questionLabel(question: Question, index: number): string {
  return `Вопрос ${index + 1}${question.parameter ? ` «${question.parameter}»` : ''}`;
}

/** Ищет ошибки и слабые места в базе. Падать не должна: база может быть черновиком или чужим файлом. */
export function validateBase(base: KnowledgeBase): Issue[] {
  const issues: Issue[] = [];
  const error = (section: IssueSection, message: string, target?: string) => issues.push({ severity: 'error', section, message, target });
  const warning = (section: IssueSection, message: string, target?: string) => issues.push({ severity: 'warning', section, message, target });
  const broken = (section: IssueSection, message: string, target?: string) => issues.push({ severity: 'error', section, message, target, integrity: true });

  const questions = allQuestions(base);
  const attributeIds = new Set(base.attributes.map((a) => a.id));
  const groupIds = new Set(base.groups.map((g) => g.id));
  const repeated = (ids: string[]) => {
    const seen = new Set<string>();
    return ids.filter((id) => seen.has(id) || !seen.add(id));
  };
  /** Название атрибута в сообщении: служебный id человеку ни о чём не говорит. */
  const attributeName = (id: string) => `«${base.attributes.find((a) => a.id === id)?.title || 'без названия'}»`;

  // Основное
  if (!base.title.trim()) error('general', 'Нет названия базы.');
  for (const { image, where, section } of baseImages(base)) {
    if (!isSafeImageUrl(image.url)) error(section, `Картинка (${where}): допускаются только адреса http(s) и относительные пути.`);
    if (image.position && !isSafeImagePosition(image.position)) warning(section, `Картинка (${where}): кадрирование должно быть вроде «50% 30%».`);
    for (const link of [image.credit?.url, image.credit?.licenseUrl]) {
      if (link && !isSafeLinkUrl(link)) error(section, `Картинка (${where}): в ссылке на автора или лицензию допускается только http(s).`);
    }
  }

  // Настройки
  const { topCount, closeGap, weakPercent } = base.settings;
  if (!Number.isInteger(topCount) || topCount < 1) error('settings', 'Число лучших объектов должно быть целым и не меньше 1.');
  if (!(closeGap >= 0)) error('settings', 'Порог близких результатов не может быть отрицательным.');
  if (!(weakPercent >= 0 && weakPercent <= 100)) error('settings', 'Порог слабого итога должен быть от 0 до 100.');

  // Атрибуты
  if (base.attributes.length === 0) error('attributes', 'Нет ни одного атрибута: не с чем сравнивать объекты.');
  else if (base.attributes.every((attribute) => attribute.importance === 0)) {
    error('attributes', 'У всех атрибутов важность 0: рейтинг не работает, совпадение всегда будет 50\u00a0%.');
  }
  for (const id of new Set(repeated(base.attributes.map((a) => a.id)))) broken('attributes', `id атрибута «${id}» повторяется.`, id);
  base.attributes.forEach((attribute, index) => {
    const at = attribute.title.trim() ? `Атрибут «${attribute.title}»` : `Атрибут ${index + 1}`;
    if (!attribute.title.trim()) error('attributes', `${at}: нет названия.`, attribute.id);
    if (!(attribute.importance >= 0 && attribute.importance <= IMPORTANCE_MAX)) {
      error('attributes', `${at}: важность должна быть от 0 до ${IMPORTANCE_MAX}.`, attribute.id);
    }
    if (base.objects.length > 0 && !base.objects.some((o) => (o.values[attribute.id] ?? 0) > 0)) {
      warning('attributes', `${at}: он не выражен ни у одного объекта и не влияет на рейтинг.`, attribute.id);
    }
    if (questions.length > 0 && !questions.some((q) => q.options.some((o) => weight(o, attribute.id) !== 0))) {
      warning('attributes', `${at}: ни один вариант ответа не даёт ему весов, предпочтение всегда нулевое.`, attribute.id);
    }
  });

  // Группы
  for (const id of new Set(repeated(base.groups.map((g) => g.id)))) broken('groups', `id группы «${id}» повторяется.`, id);
  if (base.groups.length === 1) warning('groups', 'Группа всего одна: итог всегда будет один и тот же.', base.groups[0].id);
  const max = maxScores(base);
  const linked = new Map<string, string>();
  base.groups.forEach((group, index) => {
    const at = group.title.trim() ? `Группа «${group.title}»` : `Группа ${index + 1}`;
    if (!group.title.trim()) error('groups', `${at}: нет названия.`, group.id);
    if (!attributeIds.has(group.attribute)) {
      broken('groups', `${at}: нет связанного атрибута, а итог группы — это доля его баллов.`, group.id);
      return;
    }
    const other = linked.get(group.attribute);
    if (other) error('groups', `${at}: атрибут уже связан с другой группой (${other}), итоги групп всегда совпадали бы.`, group.id);
    linked.set(group.attribute, at);
    if (questions.length > 0 && !(max[group.attribute] > 0)) {
      warning('groups', `${at}: ни один вариант ответа не даёт её атрибуту баллов, итог группы всегда 0\u00a0%.`, group.id);
    }
    if (questions.some((q) => q.options.some((o) => weight(o, group.attribute) < 0))) {
      warning('groups', `${at}: у её атрибута есть отрицательные веса. Итог группы — доля от максимума, ниже 0\u00a0% он не опускается.`, group.id);
    }
    if (base.objects.length > 0 && !base.objects.some((o) => o.group === group.id)) {
      warning('groups', `${at}: в ней нет объектов.`, group.id);
    }
  });
  const maxima = base.groups.filter((g) => attributeIds.has(g.attribute)).map((g) => max[g.attribute]);
  if (maxima.length > 1 && questions.length > 0 && Math.min(...maxima) !== Math.max(...maxima)) {
    warning('groups', `Максимумы групп различаются: ${base.groups.filter((g) => attributeIds.has(g.attribute)).map((g) => `${g.title} ${max[g.attribute]}`).join(', ')}. Группе с меньшим максимумом легче набрать высокий процент.`);
  }

  // Объекты
  if (base.objects.length === 0) error('objects', 'Нет ни одного объекта: нечего ранжировать.');
  for (const id of new Set(repeated(base.objects.map((o) => o.id)))) broken('objects', `id объекта «${id}» повторяется.`, id);
  base.objects.forEach((object, index) => {
    const at = object.title.trim() ? `Объект «${object.title}»` : `Объект ${index + 1}`;
    if (!object.title.trim()) error('objects', `${at}: нет названия.`, object.id);
    if (object.group !== undefined && !groupIds.has(object.group)) broken('objects', `${at}: нет группы «${object.group}».`, object.id);
    for (const [id, value] of Object.entries(object.values)) {
      if (!attributeIds.has(id)) {
        broken('objects', `${at}: неизвестный атрибут «${id}».`, object.id);
      } else if (!Number.isInteger(value) || value < VALUE_RANGE.min || value > VALUE_RANGE.max) {
        error('objects', `${at}: значение атрибута ${attributeName(id)} должно быть целым от ${VALUE_RANGE.min} до ${VALUE_RANGE.max}.`, object.id);
      }
    }
    if (base.attributes.length > 0 && !base.attributes.some((a) => (object.values[a.id] ?? 0) > 0)) {
      warning('objects', `${at}: все значения нулевые, совпадение всегда будет 50\u00a0%.`, object.id);
    }
    const own = base.groups.find((g) => g.id === object.group);
    if (own && (object.values[own.attribute] ?? 0) < OWN_GROUP_LEVEL) {
      warning('objects', `${at}: атрибут своей группы выражен слабо (меньше ${OWN_GROUP_LEVEL}).`, object.id);
    }
  });

  // Блоки и вопросы
  if (questions.length === 0) error('questions', 'Нет ни одного вопроса.');
  for (const id of new Set(repeated(base.blocks.map((b) => b.id)))) broken('questions', `id блока «${id}» повторяется.`, id);
  for (const id of new Set(repeated(questions.map((q) => q.id)))) broken('questions', `id вопроса «${id}» повторяется.`, id);
  const groupOf = (id: string | undefined) => base.groups.find((g) => g.id === id);
  base.blocks.forEach((block, blockIndex) => {
    const at = `Блок ${blockIndex + 1}${block.title ? ` «${block.title}»` : ''}`;
    if (base.blocks.length > 1 && !block.title.trim()) warning('questions', `${at}: нет названия.`, block.id);
    if (block.questions.length === 0) warning('questions', `${at}: в нём нет вопросов.`, block.id);
    if (block.group !== undefined && !groupIds.has(block.group)) broken('questions', `${at}: нет группы «${block.group}».`, block.id);
    const own = groupOf(block.group);
    for (const question of block.questions) {
      if (own && !question.options.some((o) => weight(o, own.attribute) > 0)) {
        warning('questions', `${questionLabel(question, questions.indexOf(question))}: ни один вариант не даёт баллов группе своего блока.`, question.id);
      }
    }
  });

  const parameters = new Map<string, number>();
  questions.forEach((question, index) => {
    const at = questionLabel(question, index);
    if (!question.text.trim()) error('questions', `${at}: нет текста вопроса.`, question.id);
    if (!question.parameter.trim()) {
      error('questions', `${at}: нет названия параметра.`, question.id);
    } else {
      if (parameters.has(question.parameter)) error('questions', `${at}: параметр уже есть в вопросе ${parameters.get(question.parameter)}.`, question.id);
      else parameters.set(question.parameter, index + 1);
    }
    if (question.options.length < 2) error('questions', `${at}: нужно хотя бы два варианта ответа.`, question.id);
    for (const id of new Set(repeated(question.options.map((o) => o.id)))) broken('questions', `${at}: id варианта «${id}» повторяется.`, question.id);

    for (const [groupId, template] of Object.entries(question.reasonTemplate ?? {})) {
      if (!groupIds.has(groupId)) broken('questions', `${at}: в общем объяснении неизвестная группа «${groupId}».`, question.id);
      if (template && !template.includes('{options}')) warning('questions', `${at}: в общем объяснении нет {options}.`, question.id);
    }
    if (question.reasonTemplate && question.type !== 'multiple' && Object.keys(question.reasonTemplate).length > 0) {
      warning('questions', `${at}: общее объяснение работает только при нескольких ответах.`, question.id);
    }

    question.options.forEach((option, optionIndex) => {
      const opt = `${at}, вариант ${optionIndex + 1}`;
      if (!option.text.trim()) error('questions', `${opt}: нет текста.`, question.id);
      for (const [id, value] of Object.entries(option.weights)) {
        if (!attributeIds.has(id)) {
          broken('questions', `${opt}: вес неизвестного атрибута «${id}».`, question.id);
        } else if (!Number.isInteger(value) || value < WEIGHT_RANGE.min || value > WEIGHT_RANGE.max) {
          error('questions', `${opt}: вес атрибута ${attributeName(id)} должен быть целым от ${WEIGHT_RANGE.min} до ${WEIGHT_RANGE.max}.`, question.id);
        }
      }
      for (const [groupId, reason] of Object.entries(option.reasons ?? {})) {
        const group = groupOf(groupId);
        if (!group) broken('questions', `${opt}: объяснение для неизвестной группы «${groupId}».`, question.id);
        else if (reason && !(weight(option, group.attribute) > 0)) warning('questions', `${opt}: объяснение для «${group.title}» не покажется, у варианта нет баллов этой группы.`, question.id);
      }
      if (option.exclusive && question.type !== 'multiple') warning('questions', `${opt}: «ничего из этого» работает только при нескольких ответах.`, question.id);
    });

    const affects = base.attributes.some(({ id }) => {
      const [min, max] = questionBounds(question, id);
      return min !== max;
    });
    const usedByRules = base.rules.some((r) => r.if.some((c) => c.question === question.id));
    if (question.options.length >= 2 && !affects && !usedByRules && base.attributes.length > 0) {
      warning('questions', `${at}: ответ ни на что не влияет: у вариантов одинаковые веса, и в условиях правил этого вопроса нет.`, question.id);
    }
  });

  // Правила «параметр + параметр»
  for (const id of new Set(repeated(base.rules.map((r) => r.id)))) broken('rules', `id правила «${id}» повторяется.`, id);
  const position = new Map(questions.map((q, i) => [q.id, i]));
  const questionById = new Map(questions.map((q) => [q.id, q]));
  for (const title of new Set(repeated(base.rules.map((r) => r.title.trim()).filter(Boolean)))) {
    warning('rules', `Обозначение ${title} повторяется: в объяснениях правила будет не различить.`);
  }
  base.rules.forEach((rule, index) => {
    const at = rule.title.trim() ? `Правило ${rule.title}` : `Правило ${index + 1}`;
    if (!rule.title.trim()) warning('rules', `${at}: нет обозначения.`, rule.id);
    if (rule.if.length === 0) error('rules', `${at}: нет условий.`, rule.id);
    if (new Set(rule.if.map((c) => `${c.question}/${c.option}`)).size < rule.if.length) {
      warning('rules', `${at}: одно и то же условие указано дважды.`, rule.id);
    }
    for (const part of [...rule.if, rule.then]) {
      const question = questionById.get(part.question);
      if (!question) broken('rules', `${at}: нет вопроса «${part.question}».`, rule.id);
      else if (!question.options.some((o) => o.id === part.option)) broken('rules', `${at}: у вопроса «${question.parameter}» нет варианта «${part.option}».`, rule.id);
    }
    const target = position.get(rule.then.question);
    if (target !== undefined && rule.if.some((c) => (position.get(c.question) ?? -1) >= target)) {
      error('rules', `${at}: все условия должны стоять раньше выводимого вопроса, иначе вывод может зациклиться.`, rule.id);
    }
    // Два разных варианта одного вопроса с одним ответом не могут быть выбраны одновременно.
    const chosen = new Map<string, string>();
    for (const c of rule.if) {
      const previous = chosen.get(c.question);
      if (previous && previous !== c.option && questionById.get(c.question)?.type === 'single') {
        warning('rules', `${at}: условия противоречат друг другу, правило никогда не сработает.`, rule.id);
      }
      chosen.set(c.question, c.option);
    }
    const targetQuestion = questionById.get(rule.then.question);
    const targetOption = targetQuestion?.options.find((o) => o.id === rule.then.option);
    if (targetQuestion?.type === 'multiple' && targetOption && !targetOption.exclusive) {
      warning('rules', `${at}: в вопросе с несколькими ответами правило заменяет весь выбор одним вариантом. Обычно так выводят только «ничего из этого».`, rule.id);
    }
  });
  /** Условия без учёта порядка и повторов: так видно, что правила одинаковые. */
  const conditionsKey = (rule: Rule) => [...new Set(rule.if.map((c) => `${c.question}/${c.option}`))].sort().join();
  base.rules.forEach((rule, index) => {
    for (const other of base.rules.slice(index + 1)) {
      if (rule.then.question !== other.then.question) continue;
      if (rule.then.option === other.then.option) {
        if (conditionsKey(rule) === conditionsKey(other)) warning('rules', `Правила ${ruleTitle(rule)} и ${ruleTitle(other)} одинаковые: второе ничего не добавляет.`, other.id);
        continue;
      }
      const exclusive = rule.if.some((a) =>
        other.if.some((b) => a.question === b.question && a.option !== b.option && questionById.get(a.question)?.type === 'single'),
      );
      if (!exclusive) {
        warning('rules', `Правила ${ruleTitle(rule)} и ${ruleTitle(other)} могут сработать вместе и вывести разные значения. Сработает первое по порядку.`, other.id);
      }
    }
  });

  // Тестовые профили: удаление в редакторе чистит их само, поэтому ссылка в никуда бывает только в чужом файле.
  const objectIds = new Set(base.objects.map((o) => o.id));
  for (const profile of base.testProfiles) {
    const at = `Профиль «${profile.name || 'без названия'}»`;
    for (const [questionId, selected] of Object.entries(profile.answers)) {
      const question = questionById.get(questionId);
      if (!question) {
        broken('general', `${at}: ответ на неизвестный вопрос «${questionId}».`);
        continue;
      }
      for (const optionId of selected) {
        if (!question.options.some((o) => o.id === optionId)) broken('general', `${at}: у вопроса «${question.parameter}» нет варианта «${optionId}».`);
      }
    }
    for (const id of profile.expectGroup ?? []) {
      if (!groupIds.has(id)) broken('general', `${at}: ожидается неизвестная группа «${id}».`);
    }
    for (const id of profile.expectTop ?? []) {
      if (!objectIds.has(id)) broken('general', `${at}: ожидается неизвестный объект «${id}».`);
    }
  }

  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

/**
 * Разбор чужого файла при импорте: структура и целостность. Остальные ошибки файл не отклоняют:
 * такая база откроется, и их можно будет исправить в редакторе.
 */
export function parseForImport(text: string): ParseResult {
  const parsed = parseBaseText(text);
  if (!parsed.ok) return parsed;
  const errors = validateBase(parsed.base)
    .filter((issue) => issue.integrity)
    .map((issue) => issue.message);
  return errors.length > 0 ? { ok: false, errors } : parsed;
}

// ---------- Требования ДЗ ----------

/** Требования к прототипу экспертной системы из задания. */
export const REQUIREMENTS = { questions: 20, parameters: 10, objects: 20, attributes: 10, top: 5 };

export interface RequirementRow {
  title: string;
  need: string;
  actual: string;
  ok: boolean;
}

/** Требования ДЗ: для других задач они необязательны, поэтому это не ошибки базы. */
export function checkRequirements(base: KnowledgeBase): RequirementRow[] {
  const questions = allQuestions(base).length;
  const minAsked = minAskedQuestions(base);
  const parameters = new Set(allQuestions(base).map((q) => q.parameter).filter((name) => name.trim())).size;
  const shown = Math.min(base.settings.topCount, base.objects.length);
  return [
    {
      title: 'Вопросов',
      need: `≥ ${REQUIREMENTS.questions}`,
      actual: `${questions} (задаётся не меньше ${minAsked})`,
      ok: questions >= REQUIREMENTS.questions && minAsked >= REQUIREMENTS.questions,
    },
    {
      title: 'Параметров от пользователя',
      need: `≥ ${REQUIREMENTS.parameters}`,
      actual: String(parameters),
      ok: parameters >= REQUIREMENTS.parameters,
    },
    {
      title: 'Объектов ранжирования',
      need: `≥ ${REQUIREMENTS.objects}`,
      actual: String(base.objects.length),
      ok: base.objects.length >= REQUIREMENTS.objects,
    },
    {
      title: 'Свойств у объекта',
      need: `≥ ${REQUIREMENTS.attributes}`,
      actual: String(base.attributes.length),
      ok: base.attributes.length >= REQUIREMENTS.attributes,
    },
    {
      title: 'Вариантов после каждого ответа',
      need: `≥ ${REQUIREMENTS.top}`,
      actual: `${shown} лучших + весь рейтинг по кнопке`,
      ok: shown >= REQUIREMENTS.top,
    },
    // Эти два обеспечивает сам конструктор, какой бы ни была база.
    { title: 'В конце — все объекты по рангу', need: 'да', actual: 'экран результата', ok: true },
    { title: 'База знаний и рабочая БД с просмотром', need: 'да', actual: 'экраны «База знаний» и «Рабочая БД»', ok: true },
  ];
}

// ---------- Тестовые профили ----------

export interface ProfileResult {
  profile: TestProfile;
  evaluation: Evaluation;
  /** Сколько вопросов задано этому профилю. */
  asked: number;
  /** Что пошло не так; пустой список — профиль прошёл. */
  problems: string[];
}

/** Ответы профиля ссылаются на существующие варианты и закрывают все вопросы. */
function answerProblems(base: KnowledgeBase, profile: TestProfile): string[] {
  const problems: string[] = [];
  const questions = allQuestions(base);
  for (const [questionId, selected] of Object.entries(profile.answers)) {
    const question = questions.find((q) => q.id === questionId);
    if (!question) {
      problems.push(`в ответах неизвестный вопрос «${questionId}»`);
      continue;
    }
    if (question.type === 'single' && selected.length !== 1) problems.push(`«${question.parameter}»: нужен ровно один ответ`);
    for (const optionId of selected) {
      const option = question.options.find((o) => o.id === optionId);
      if (!option) problems.push(`«${question.parameter}»: нет варианта «${optionId}»`);
      else if (option.exclusive && selected.length > 1) problems.push(`«${question.parameter}»: «${option.text}» нельзя совмещать с другими вариантами`);
    }
  }
  const { answers: effective } = infer(base, profile.answers);
  questions.forEach((question, index) => {
    if (selectedOptions(question, effective).length === 0) {
      problems.push(`нет ответа на вопрос ${index + 1}${question.parameter ? ` «${question.parameter}»` : ''}, и правило его не выводит`);
    }
  });
  return problems;
}

export function runTestProfiles(base: KnowledgeBase): ProfileResult[] {
  const titleOfGroup = (id: string) => base.groups.find((g) => g.id === id)?.title ?? id;
  const titleOfObject = (id: string) => base.objects.find((o) => o.id === id)?.title ?? id;

  return base.testProfiles.map((profile) => {
    const evaluation = evaluate(base, profile.answers);
    const problems = answerProblems(base, profile);
    const { verdict } = evaluation;

    if (verdict) {
      const winner = verdict.winner.group;
      if (profile.expectGroup && profile.expectGroup.length > 0 && !profile.expectGroup.includes(winner.id)) {
        problems.push(`ожидали группу ${profile.expectGroup.map(titleOfGroup).join(' или ')}, получили ${winner.title}`);
      }
      if (profile.expectClose !== undefined && profile.expectClose !== verdict.isClose) {
        problems.push(profile.expectClose ? 'второе место должно быть почти равным' : 'второе место не должно быть почти равным');
      }
      if (profile.expectWeak !== undefined && profile.expectWeak !== verdict.isWeak) {
        problems.push(profile.expectWeak ? 'итог должен быть слабо выраженным' : 'итог должен быть выраженным');
      }
    } else if (profile.expectGroup?.length || profile.expectClose !== undefined || profile.expectWeak !== undefined) {
      problems.push('заданы ожидания об итоге, но в базе нет групп');
    }
    const top3 = evaluation.objects.slice(0, 3).map((item) => item.object.id);
    if (profile.expectTop && profile.expectTop.length > 0 && !profile.expectTop.some((id) => top3.includes(id))) {
      problems.push(`в тройке лидеров ${top3.map(titleOfObject).join(', ')}, а ожидали хотя бы одно из: ${profile.expectTop.map(titleOfObject).join(', ')}`);
    }
    return { profile, evaluation, asked: askedQuestions(base, profile.answers).length, problems };
  });
}
