// Тесты движка на придуманных базах: то, чего в примере нет, но что конструктор обещает.
// Запускаются из npm run check.

import { deepStrictEqual, strictEqual } from 'node:assert';
import { parseBase, parseBaseText } from '../src/engine/parse.ts';
import { askedQuestions, evaluate, infer, isComplete, liveRanking } from '../src/engine/scoring.ts';
import type { KnowledgeBase, Question } from '../src/engine/types.ts';
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
