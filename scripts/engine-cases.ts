// Тесты на придуманных базах: то, чего в примере нет, но что конструктор обещает.
// Движок, разбор чужих файлов, операции редактора. Запускаются из npm run check.

import { deepStrictEqual, strictEqual } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  addAttribute,
  addBlock,
  addCondition,
  addGroup,
  addObject,
  addProfile,
  addQuestion,
  addRule,
  copyOf,
  emptyBase,
  moveItem,
  moveQuestion,
  newOption,
  removeAttribute,
  removeBlock,
  removeGroup,
  removeObject,
  removeOption,
  removeQuestion,
  setPhrase,
  setQuestionType,
  setWeight,
} from '../src/editor/ops.ts';
import { parseBase, parseBaseText } from '../src/engine/parse.ts';
import { askedQuestions, evaluate, infer, isComplete, liveRanking, maxScores, questionBounds } from '../src/engine/scoring.ts';
import type { KnowledgeBase, Question, TestProfile } from '../src/engine/types.ts';
import { checkRequirements, hasErrors, minAskedQuestions, parseForImport, runTestProfiles, validateBase } from '../src/engine/validate.ts';

function question(id: string, type: Question['type'] = 'single'): Question {
  return {
    id,
    parameter: `Параметр ${id}`,
    text: `Вопрос ${id}?`,
    type,
    note: '',
    options: [
      { id: 'a', text: 'Первый', weights: { x: 2 } },
      { id: 'b', text: 'Второй', weights: { y: 2 } },
    ],
  };
}

/** Маленькая база: два атрибута, два объекта, четыре вопроса, без групп и правил. */
function smallBase(): KnowledgeBase {
  return {
    format: 'es-constructor',
    formatVersion: 1,
    title: 'Тестовая база',
    subtitle: '',
    description: '',
    author: '',
    settings: { topCount: 5, closeGap: 10, weakPercent: 50 },
    attributes: [
      { id: 'x', title: 'Икс', short: '', description: '', importance: 1 },
      { id: 'y', title: 'Игрек', short: '', description: '', importance: 1 },
    ],
    groups: [],
    objects: [
      { id: 'ox', title: 'Объект икс', description: '', values: { x: 3 } },
      { id: 'oy', title: 'Объект игрек', description: '', values: { y: 3 } },
    ],
    blocks: [{ id: 'b', title: 'Блок', description: '', questions: ['q1', 'q2', 'q3', 'q4'].map((id) => question(id)) }],
    rules: [],
    testProfiles: [],
  };
}

/** База проходит импорт: повторов id и ссылок в никуда нет, файл разбирается без потерь. */
function assertImportable(base: KnowledgeBase, why: string): void {
  const parsed = parseForImport(JSON.stringify(base));
  strictEqual(parsed.ok, true, `${why}: ${parsed.ok ? '' : parsed.errors.join('; ')}`);
  if (parsed.ok) deepStrictEqual(parsed.base, JSON.parse(JSON.stringify(base)), why);
}

function loadExampleCopy(): KnowledgeBase {
  const parsed = parseBase(JSON.parse(readFileSync(new URL('../content/example.json', import.meta.url), 'utf8')));
  if (!parsed.ok) throw new Error('пример не разобран');
  return copyOf(parsed.base);
}

const CASES: Record<string, () => void> = {
  'условия правила работают через И'() {
    const base = smallBase();
    base.rules = [
      {
        id: 'r',
        title: 'П1',
        if: [
          { question: 'q1', option: 'a' },
          { question: 'q2', option: 'a' },
        ],
        then: { question: 'q3', option: 'b' },
        note: '',
      },
    ];
    strictEqual(infer(base, { q1: ['a'], q2: ['b'] }).inferred.size, 0, 'одного условия мало');
    strictEqual(infer(base, { q1: ['a'] }).inferred.size, 0, 'неотвеченное условие не выполнено');
    const { inferred, answers } = infer(base, { q1: ['a'], q2: ['a'] });
    strictEqual(inferred.get('q3')?.id, 'r');
    deepStrictEqual(answers.q3, ['b']);
    strictEqual(askedQuestions(base, { q1: ['a'], q2: ['a'] }).length, 3);
  },

  'ИЛИ — это два правила'() {
    const base = smallBase();
    base.rules = [
      { id: 'r1', title: 'П1', if: [{ question: 'q1', option: 'a' }], then: { question: 'q3', option: 'b' }, note: '' },
      { id: 'r2', title: 'П2', if: [{ question: 'q2', option: 'a' }], then: { question: 'q3', option: 'b' }, note: '' },
    ];
    strictEqual(infer(base, { q1: ['a'] }).inferred.get('q3')?.id, 'r1');
    strictEqual(infer(base, { q2: ['a'] }).inferred.get('q3')?.id, 'r2');
    strictEqual(minAskedQuestions(base), 3, 'выводимый параметр считается один раз');
  },

  'цепочки вывода работают, даже если правила идут в обратном порядке'() {
    const base = smallBase();
    base.rules = [
      { id: 'second', title: 'П2', if: [{ question: 'q2', option: 'b' }], then: { question: 'q3', option: 'a' }, note: '' },
      { id: 'first', title: 'П1', if: [{ question: 'q1', option: 'a' }], then: { question: 'q2', option: 'b' }, note: '' },
    ];
    const { inferred, answers } = infer(base, { q1: ['a'] });
    strictEqual(inferred.get('q2')?.id, 'first');
    strictEqual(inferred.get('q3')?.id, 'second');
    deepStrictEqual(answers.q3, ['a']);
    strictEqual(hasErrors(validateBase(base)), false);
  },

  'устаревший ответ пользователя не запускает цепочку'() {
    const base = smallBase();
    // Пользователь ответил на q2 = a, потом изменил q1, и правило вывело q2 = b.
    // Правило «q2 = a → q3 = a» идёт в списке первым, но сработать не должно.
    base.rules = [
      { id: 'stale', title: 'П1', if: [{ question: 'q2', option: 'a' }], then: { question: 'q3', option: 'a' }, note: '' },
      { id: 'real', title: 'П2', if: [{ question: 'q1', option: 'a' }], then: { question: 'q2', option: 'b' }, note: '' },
    ];
    const { inferred, answers } = infer(base, { q1: ['a'], q2: ['a'] });
    strictEqual(inferred.has('q3'), false);
    deepStrictEqual(answers.q2, ['b']);
  },

  'смена ответа-условия отменяет вывод'() {
    const base = smallBase();
    base.rules = [{ id: 'r', title: 'П1', if: [{ question: 'q1', option: 'a' }], then: { question: 'q2', option: 'b' }, note: '' }];
    deepStrictEqual(infer(base, { q1: ['b'], q2: ['a'] }).answers.q2, ['a']);
    deepStrictEqual(infer(base, { q1: ['a'], q2: ['a'] }).answers.q2, ['b']);
  },

  'правило с условием после вывода — ошибка, но не зацикливает вывод'() {
    const base = smallBase();
    base.rules = [
      { id: 'r1', title: 'П1', if: [{ question: 'q3', option: 'a' }], then: { question: 'q2', option: 'a' }, note: '' },
      { id: 'r2', title: 'П2', if: [{ question: 'q2', option: 'a' }], then: { question: 'q3', option: 'a' }, note: '' },
    ];
    strictEqual(hasErrors(validateBase(base)), true);
    infer(base, { q2: ['a'], q3: ['a'] });
  },

  'база без групп: есть рейтинг, итога нет'() {
    const base = smallBase();
    const answers = { q1: ['a'], q2: ['a'], q3: ['a'], q4: ['a'] };
    strictEqual(isComplete(base, answers), true);
    const evaluation = evaluate(base, answers);
    strictEqual(evaluation.verdict, null);
    strictEqual(evaluation.objects[0].object.id, 'ox');
    strictEqual(hasErrors(validateBase(base)), false);
  },

  'группы и настройки берутся из базы'() {
    const base = smallBase();
    base.groups = [
      { id: 'gx', attribute: 'x', title: 'Группа икс', description: '' },
      { id: 'gy', attribute: 'y', title: 'Группа игрек', description: '' },
    ];
    base.objects[0].group = 'gx';
    base.objects[1].group = 'gy';
    const answers = { q1: ['a'], q2: ['a'], q3: ['a'], q4: ['b'] };
    const verdict = evaluate(base, answers).verdict!;
    strictEqual(verdict.winner.group.id, 'gx');
    strictEqual(verdict.winner.percent, 75);
    strictEqual(verdict.runnerUp?.percent, 25);
    strictEqual(verdict.isClose, false);
    strictEqual(verdict.isWeak, false);
    base.settings.closeGap = 60;
    base.settings.weakPercent = 80;
    const tuned = evaluate(base, answers).verdict!;
    strictEqual(tuned.isClose, true);
    strictEqual(tuned.isWeak, true);
  },

  'важность атрибута меняет рейтинг'() {
    const base = smallBase();
    base.objects = [
      { id: 'both', title: 'Оба', description: '', values: { x: 3, y: 3 } },
      { id: 'only', title: 'Только икс', description: '', values: { x: 3 } },
    ];
    const answers = { q1: ['a'], q2: ['a'], q3: ['b'] };
    const plain = liveRanking(base, answers).map((item) => item.score);
    base.attributes[0].importance = 5;
    const weighted = liveRanking(base, answers).map((item) => item.score);
    strictEqual(plain.join() === weighted.join(), false);
  },

  'черновик и пустая база не ломают движок'() {
    const base = smallBase();
    base.attributes = [];
    base.objects = [{ id: 'o', title: 'О', description: '', values: {} }];
    base.blocks = [{ id: 'b', title: '', description: '', questions: [{ ...question('q'), options: [] }] }];
    base.groups = [{ id: 'g', attribute: 'нет такого', title: 'Г', description: '' }];
    const evaluation = evaluate(base, {});
    strictEqual(evaluation.objects[0].score, 0.5);
    strictEqual(evaluation.verdict?.winner.percent, 0);
    strictEqual(hasErrors(validateBase(base)), true);
    checkRequirements(base);
    runTestProfiles(base);
  },

  'тестовые профили находят расхождения'() {
    const base = smallBase();
    base.testProfiles = [
      { name: 'Верный', answers: { q1: ['a'], q2: ['a'], q3: ['a'], q4: ['a'] }, expectTop: ['ox'] },
      { name: 'Неполный', answers: { q1: ['a'] } },
      { name: 'С чужим вариантом', answers: { q1: ['нет'], q2: ['a'], q3: ['a'], q4: ['a'] } },
    ];
    const [ok, partial, broken] = runTestProfiles(base);
    deepStrictEqual(ok.problems, []);
    strictEqual(partial.problems.length > 0, true);
    strictEqual(broken.problems.length > 0, true);
  },

  '«ничего из этого» с весом не складывается с остальными вариантами'() {
    const base = smallBase();
    base.blocks[0].questions = [
      {
        ...question('q1', 'multiple'),
        options: [
          { id: 'a', text: 'А', weights: { x: 3 } },
          { id: 'b', text: 'Б', weights: { x: 3, y: -1 } },
          { id: 'c', text: 'Ничего', exclusive: true, weights: { x: 3, y: -2 } },
        ],
      },
    ];
    const [q] = base.blocks[0].questions;
    deepStrictEqual(questionBounds(q, 'x'), [0, 6]);
    deepStrictEqual(questionBounds(q, 'y'), [-2, 0]);
    strictEqual(maxScores(base).x, 6);
    delete q.options[2].exclusive;
    deepStrictEqual(questionBounds(q, 'x'), [0, 9], 'без отметки варианты складываются как обычно');
  },

  'проверка: важность атрибута не ломает расчёт'() {
    const base = smallBase();
    base.attributes[0].importance = 1e308;
    strictEqual(hasErrors(validateBase(base)), true, 'запредельная важность — ошибка');
    base.attributes[0].importance = 0;
    base.attributes[1].importance = 0;
    strictEqual(hasErrors(validateBase(base)), true, 'все важности 0 — рейтинг не работает');
    base.attributes[1].importance = 100;
    strictEqual(hasErrors(validateBase(base)), false);
  },

  'импорт: ссылки в никуда в тестовых профилях отклоняются'() {
    const imported = (profile: Partial<TestProfile>) => {
      const base = smallBase();
      base.testProfiles = [{ name: 'П', answers: {}, ...profile }];
      return parseForImport(JSON.stringify(base)).ok;
    };
    strictEqual(imported({}), true);
    strictEqual(imported({ answers: { нет: ['a'] } }), false, 'неизвестный вопрос');
    strictEqual(imported({ answers: { q1: ['нет'] } }), false, 'неизвестный вариант');
    strictEqual(imported({ expectGroup: ['нет'] }), false, 'неизвестная группа');
    strictEqual(imported({ expectTop: ['нет'] }), false, 'неизвестный объект');
  },

  'профиль с ожиданиями об итоге в базе без групп не проходит молча'() {
    const base = smallBase();
    base.testProfiles = [{ name: 'П', answers: { q1: ['a'], q2: ['a'], q3: ['a'], q4: ['a'] }, expectWeak: true }];
    strictEqual(runTestProfiles(base)[0].problems.length, 1);
  },

  'разбор файла: очень большой вопрос не роняет расчёт'() {
    const base = smallBase();
    const options = Array.from({ length: 200_000 }, (_, index) => ({ id: `o${index}`, text: '', weights: { x: index % 3 } }));
    base.blocks[0].questions[0].options = options;
    deepStrictEqual(questionBounds(base.blocks[0].questions[0], 'x'), [0, 2]);
  },

  'разбор файла: хорошая база проходит без потерь'() {
    const base = smallBase();
    const parsed = parseBase(JSON.parse(JSON.stringify(base)));
    strictEqual(parsed.ok, true);
    if (parsed.ok) deepStrictEqual(parsed.base, base);
    strictEqual(parseBaseText(`﻿${JSON.stringify(base)}`).ok, true, 'BOM в начале файла не мешает');
  },

  'разбор файла: чужие и опасные данные отклоняются'() {
    const rejected = (mutate: (json: any) => void, why: string) => {
      const json = JSON.parse(JSON.stringify(smallBase()));
      mutate(json);
      strictEqual(parseBase(json).ok, false, why);
    };
    strictEqual(parseBaseText('это не json').ok, false);
    strictEqual(parseBase([]).ok, false);
    strictEqual(parseBase({ title: 'нет отметки формата' }).ok, false);
    rejected((j) => (j.formatVersion = 999), 'версия новее');
    rejected((j) => (j.image = { url: 'javascript:alert(1)' }), 'javascript: в картинке');
    rejected((j) => (j.image = { url: 'java\nscript:alert(1)' }), 'перевод строки в схеме');
    rejected((j) => (j.image = { url: 'data:image/png;base64,AAAA' }), 'файл внутри базы');
    rejected((j) => (j.image = { url: 'a.png', credit: { url: 'javascript:alert(1)' } }), 'javascript: в ссылке на автора');
    rejected((j) => (j.image = { url: 'a.png', position: 'url(x)' }), 'чужое значение в CSS');
    rejected((j) => (j.attributes[0].id = 'constructor'), 'id совпадает со свойством объекта');
    rejected((j) => (j.attributes[0].importance = -1), 'отрицательная важность');
    rejected((j) => (j.objects = 'строка'), 'не список');
    rejected((j) => (j.objects[0].values = { x: 'три' }), 'значение не число');
    rejected((j) => delete j.blocks, 'нет блоков');
    rejected((j) => (j.blocks[0].questions[0].type = 'text'), 'неизвестный тип вопроса');
    rejected((j) => (j.blocks[0].questions[0].options[0].weights = JSON.parse('{"__proto__": 1}')), '__proto__ в весах');
    rejected((j) => (j.rules = [{ id: 'r', if: {}, then: { question: 'q2', option: 'a' } }]), 'условия не списком');
    rejected((j) => (j.settings = { topCount: 0 }), 'число лучших меньше 1');
    strictEqual(parseBase({ ...JSON.parse(JSON.stringify(smallBase())), objects: [{ id: 'o', values: { x: 1e999 } }] }).ok, false, 'бесконечность');
  },

  'импорт: повторы id и ссылки в никуда отклоняются, а исправимые ошибки — нет'() {
    const imported = (mutate: (base: KnowledgeBase) => void) => {
      const base = smallBase();
      mutate(base);
      return parseForImport(JSON.stringify(base)).ok;
    };
    strictEqual(imported(() => {}), true);
    strictEqual(imported((b) => (b.attributes[1].id = 'x')), false, 'повторяется id атрибута');
    strictEqual(imported((b) => (b.blocks[0].questions[1].id = 'q1')), false, 'повторяется id вопроса');
    strictEqual(imported((b) => (b.blocks[0].questions[0].options[1].id = 'a')), false, 'повторяется id варианта');
    strictEqual(imported((b) => (b.blocks[0].questions[0].options[0].weights = { опечатка: 3 })), false, 'вес неизвестного атрибута');
    strictEqual(imported((b) => (b.objects[0].values = { опечатка: 3 })), false, 'значение неизвестного атрибута');
    strictEqual(imported((b) => (b.objects[0].group = 'нет')), false, 'неизвестная группа');
    strictEqual(
      imported((b) => (b.rules = [{ id: 'r', title: 'П1', if: [{ question: 'нет', option: 'a' }], then: { question: 'q2', option: 'a' }, note: '' }])),
      false,
      'правило на несуществующий вопрос',
    );
    strictEqual(imported((b) => (b.title = '')), true, 'пустое название можно исправить в редакторе');
    strictEqual(imported((b) => (b.objects = [])), true, 'черновик без объектов тоже можно импортировать');
    strictEqual(imported((b) => (b.objects[0].values = { x: 9 })), true, 'значение вне шкалы можно исправить в редакторе');
  },

  'редактор: новая база собирается с нуля, id не повторяются'() {
    const base = emptyBase();
    strictEqual(hasErrors(validateBase(base)), true, 'пустая база — черновик с ошибками');
    assertImportable(base, 'пустая база');
    const x = addAttribute(base, 'Икс');
    const y = addAttribute(base, 'Игрек');
    strictEqual(x.id === y.id, false);
    const group = addGroup(base);
    strictEqual(group.attribute, x.id, 'группа берёт первый свободный атрибут');
    addGroup(base);
    const third = addGroup(base);
    strictEqual(base.attributes.length, 3, 'свободных атрибутов нет — создаётся новый');
    strictEqual(third.attribute, base.attributes[2].id);
    const object = addObject(base);
    object.title = 'Объект';
    object.values[x.id] = 3;
    const blockId = base.blocks[0].id;
    const first = addQuestion(base, blockId);
    const second = addQuestion(base, blockId);
    strictEqual(first.id === second.id, false);
    for (const [index, question] of [first, second].entries()) {
      question.text = `Вопрос ${index + 1}`;
      question.parameter = `Параметр ${index + 1}`;
      question.options[0].text = 'Да';
      question.options[1].text = 'Нет';
    }
    setWeight(first.options[0], x.id, 2);
    setWeight(first.options[1], x.id, 0);
    deepStrictEqual(first.options[1].weights, {}, 'нулевые веса не хранятся');
    const rule = addRule(base);
    strictEqual(rule?.title, 'П1');
    strictEqual(rule?.if[0].question, first.id);
    strictEqual(rule?.then.question, second.id);
    strictEqual(addRule(base)?.title, 'П2');
    assertImportable(base, 'собранная база');
    strictEqual(validateBase(base).some((issue) => issue.severity === 'error' && issue.section === 'rules'), false, 'новое правило сразу правильное');
  },

  'редактор: удалённые id не используются снова, тип вопроса чистит лишнее'() {
    const base = smallBase();
    const question = base.blocks[0].questions[0];
    // Новый вопрос или вариант не должен получить сохранённый ответ на удалённый.
    const blockId = base.blocks[0].id;
    const added = addQuestion(base, blockId);
    removeQuestion(base, added.id);
    strictEqual(addQuestion(base, blockId).id === added.id, false, 'id вопроса не повторяется');
    const option = newOption(question);
    question.options.push(option);
    removeOption(base, question.id, option.id);
    strictEqual(newOption(question).id === option.id, false, 'id варианта не повторяется');
    question.options[0].exclusive = true;
    question.reasonTemplate = { g: 'Шаблон: {options}' };
    setQuestionType(question, 'multiple');
    strictEqual(question.options[0].exclusive, true);
    setQuestionType(question, 'single');
    strictEqual('exclusive' in question.options[0], false);
    strictEqual('reasonTemplate' in question, false);
    const first = question.options[0];
    setPhrase(first, 'reasons', 'g', 'Причина');
    deepStrictEqual(first.reasons, { g: 'Причина' });
    setPhrase(first, 'reasons', 'g', '');
    strictEqual('reasons' in first, false, 'опустевший словарь не остаётся');
  },

  'редактор: удаление не оставляет ссылок в никуда'() {
    const check = (why: string, change: (base: KnowledgeBase) => void) => {
      const base = loadExampleCopy();
      change(base);
      assertImportable(base, why);
      strictEqual(validateBase(base).some((issue) => issue.integrity), false, why);
    };
    check('атрибут со связанной группой', (base) => removeAttribute(base, 'children'));
    check('атрибут стиля', (base) => removeAttribute(base, 'physical'));
    check('группа', (base) => removeGroup(base, 'ecology'));
    check('объект', (base) => removeObject(base, 'mentor'));
    check('вопрос-условие правила', (base) => removeQuestion(base, 'general-time'));
    check('вопрос, который выводит правило', (base) => removeQuestion(base, 'children-commitment'));
    check('вариант-условие правила', (base) => removeOption(base, 'general-time', 'c'));
    check('вариант, который выводит правило', (base) => removeOption(base, 'children-commitment', 'd'));
    check('блок', (base) => removeBlock(base, 'children'));
    check('все блоки', (base) => [...base.blocks].forEach((block) => removeBlock(base, block.id)));
    check('все атрибуты', (base) => [...base.attributes].forEach((attribute) => removeAttribute(base, attribute.id)));
    check('все группы', (base) => [...base.groups].forEach((group) => removeGroup(base, group.id)));

    const base = loadExampleCopy();
    removeQuestion(base, 'general-time');
    strictEqual(base.rules.some((rule) => rule.title === 'П2'), false, 'правило без условия удаляется целиком');
    strictEqual(base.rules.some((rule) => rule.title === 'П1'), true, 'остальные правила остаются');
    strictEqual(base.testProfiles.some((profile) => 'general-time' in profile.answers), false, 'ответы профилей чистятся');
  },

  'редактор: всё, что он сохраняет, читается заново из хранилища'() {
    // Хранилище проверяет записи через parseBase: нечитаемая запись — это потерянная база.
    const reloads = (base: KnowledgeBase, why: string) => strictEqual(parseBase(JSON.parse(JSON.stringify(base))).ok, true, why);
    const base = emptyBase();
    reloads(base, 'пустая база');
    const attribute = addAttribute(base);
    const group = addGroup(base);
    const object = addObject(base);
    object.group = group.id;
    addBlock(base);
    const question = addQuestion(base, base.blocks[0].id);
    reloads(base, 'пустые тексты — не ошибка структуры');
    setWeight(question.options[0], attribute.id, -3);
    setPhrase(question.options[0], 'reasons', group.id, 'Причина');
    question.options = [];
    reloads(base, 'вопрос без вариантов');
    addProfile(base, { answers: { [question.id]: [] }, expectGroup: [group.id], expectTop: [object.id] });
    reloads(base, 'профиль');
    removeGroup(base, group.id);
    reloads(base, 'после удаления группы');
  },

  'редактор: условие в правило без условий добавляется настоящее'() {
    const base = smallBase();
    const rule = { id: 'r', title: 'П1', if: [], then: { question: 'q2', option: 'a' }, note: '' };
    base.rules = [rule];
    assertImportable(base, 'правило без условий из чужого файла');
    addCondition(base, rule);
    deepStrictEqual(rule.if, [{ question: 'q1', option: 'a' }]);
    addCondition(base, rule);
    strictEqual(rule.if.length, 2);
    assertImportable(base, 'после добавления условий');
  },

  'редактор: профили не проверяют то, чего больше нет'() {
    const base = smallBase();
    base.groups = [
      { id: 'gx', attribute: 'x', title: 'Икс', description: '' },
      { id: 'gy', attribute: 'y', title: 'Игрек', description: '' },
    ];
    const answers = { q1: ['a'], q2: ['a'], q3: ['a'], q4: ['a'] };
    addProfile(base, { answers, expectGroup: ['gx'], expectTop: ['ox'], expectClose: false, expectWeak: false });
    removeGroup(base, 'gx');
    strictEqual('expectGroup' in base.testProfiles[0], false, 'опустевшее ожидание убирается');
    strictEqual(base.testProfiles[0].expectWeak, false, 'пока группы есть, ожидание об итоге остаётся');
    removeGroup(base, 'gy');
    deepStrictEqual(Object.keys(base.testProfiles[0]).sort(), ['answers', 'expectTop', 'name'], 'групп нет — ожиданий об итоге нет');
    removeObject(base, 'ox');
    strictEqual('expectTop' in base.testProfiles[0], false);
    assertImportable(base, 'профиль после удалений');
  },

  'редактор: копия примера независима и даёт те же результаты'() {
    const original = loadExampleCopy();
    const copy = copyOf(original);
    copy.attributes[0].importance = 5;
    strictEqual(original.attributes[0].importance, 2);
    strictEqual(copy.title.endsWith('(копия)'), true);
    const answers = original.testProfiles[0].answers;
    deepStrictEqual(evaluate(copyOf(original), answers).objects.map((item) => item.score), evaluate(original, answers).objects.map((item) => item.score));
  },

  'редактор: порядок и профили'() {
    const base = smallBase();
    addBlock(base);
    const [first] = base.blocks[0].questions;
    moveQuestion(base, first.id, -1);
    strictEqual(base.blocks[0].questions[0].id, first.id, 'первый вопрос первого блока выше не уходит');
    moveQuestion(base, first.id, 1);
    strictEqual(base.blocks[0].questions[1].id, first.id);
    const last = base.blocks[0].questions[3];
    moveQuestion(base, last.id, 1);
    strictEqual(base.blocks[1].questions[0].id, last.id, 'с края блока вопрос уходит в соседний');
    moveQuestion(base, last.id, -1);
    strictEqual(base.blocks[0].questions[3].id, last.id, 'и возвращается обратно');
    const list = [1, 2, 3];
    moveItem(list, 0, -1);
    moveItem(list, 2, 1);
    deepStrictEqual(list, [1, 2, 3], 'за границы списка не выходит');
    moveItem(list, 0, 1);
    deepStrictEqual(list, [2, 1, 3]);
    strictEqual(addProfile(base).name, 'Профиль 1');
    strictEqual(addProfile(base).name, 'Профиль 2');
    assertImportable(base, 'база с профилями');
  },

  'разбор файла: лишние поля отбрасываются, картинка без адреса считается пустой'() {
    const json = JSON.parse(JSON.stringify(smallBase()));
    json.evil = 'x';
    json.image = {};
    json.attributes[0].evil = 'x';
    const parsed = parseBase(json);
    strictEqual(parsed.ok, true);
    if (parsed.ok) {
      strictEqual('evil' in parsed.base, false);
      strictEqual('image' in parsed.base, false);
      strictEqual('evil' in parsed.base.attributes[0], false);
    }
  },
};

/** Возвращает описания упавших тестов. */
export function runEngineCases(): string[] {
  return Object.entries(CASES).flatMap(([name, run]) => {
    try {
      run();
      return [];
    } catch (error) {
      return [`${name}: ${error instanceof Error ? error.message : String(error)}`];
    }
  });
}
