// npm run docs — собирает документацию по примеру из content/example.json:
// docs/knowledge-base.md, docs/objects.csv, docs/questions.csv, docs/validation.md, docs/credits.md.

import { writeFileSync } from 'node:fs';
import { baseImages } from '../src/engine/images.ts';
import { allQuestions, attributeRules, maxScores } from '../src/engine/scoring.ts';
import type { Condition, Question, Weights } from '../src/engine/types.ts';
import { checkRequirements, minAskedQuestions, validateBase } from '../src/engine/validate.ts';
import {
  attributeTitles,
  expectedRandomScores,
  groupTitles,
  loadExample,
  percent,
  runExampleProfiles,
  simulate,
  validateExampleImages,
  validateExamplePrinciples,
} from './lib.ts';
import { plural } from '../src/plural.ts';

const base = loadExample();
const errors = [...validateBase(base).map((issue) => issue.message), ...validateExamplePrinciples(base), ...validateExampleImages(base)];
if (errors.length > 0) {
  console.error(`В базе знаний ${errors.length} ошибок — подробности в npm run check.`);
  process.exit(1);
}

const questions = allQuestions(base);
const number = new Map(questions.map((question, index) => [question.id, index + 1]));
const attributeIds = base.attributes.map((attribute) => attribute.id);
const short = attributeTitles(base);
const groupShort = groupTitles(base);
const groupTitle = Object.fromEntries(base.groups.map((g) => [g.id, g.title]));
const max = maxScores(base);
const { closeGap, weakPercent } = base.settings;
const SOURCE = '`content/example.json`';
const generated = (source: string) =>
  `> Файл собирается из ${source} командой \`npm run docs\`. Правки вносятся туда, а не сюда.`;

function write(name: string, content: string): void {
  writeFileSync(new URL(`../docs/${name}`, import.meta.url), content);
  console.log(`docs/${name}`);
}

function typeLabel(question: Question): string {
  return question.type === 'single' ? 'Один ответ' : 'Несколько ответов';
}

function cell(text: string): string {
  return text.replaceAll('|', '\\|');
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

function weightList(weights: Weights): string {
  const parts = attributeIds.filter((id) => weights[id]).map((id) => `${short[id]} ${signed(weights[id])}`);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function csv(rows: string[][]): string {
  const escape = (value: string) => (/[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  // BOM и разделитель «;» — чтобы Excel открыл кириллицу без танцев.
  return String.fromCharCode(0xfeff) + rows.map((row) => row.map(escape).join(';')).join('\n') + '\n';
}

/** Условие или заключение правила: «параметр» = «значение». */
function conditionText({ question: questionId, option: optionId }: Condition): string {
  const question = questions.find((q) => q.id === questionId)!;
  const option = question.options.find((o) => o.id === optionId)!;
  return `«${question.parameter}» = «${cell(option.text)}»`;
}

function knowledgeBaseMarkdown(): string {
  const rules = attributeRules(base);
  const ruleOf = new Map(rules.map((r) => [`${r.question.id}/${r.option.id}`, r.title]));
  const effects = rules.reduce((n, r) => n + r.effects.length, 0);
  const options = questions.reduce((n, q) => n + q.options.length, 0);
  const inferred = new Set(base.rules.map((r) => r.then.question)).size;
  const example = rules.find((r) => r.question.id === 'general-setting' && r.option.id === 'a') ?? rules[0];
  const single = questions.filter((q) => q.type === 'single');
  const situational = single.filter((q) => q.situational).map((q) => number.get(q.id));
  const multiple = questions.filter((q) => q.type === 'multiple').map((q) => number.get(q.id));
  const lines = [
    `# ${base.title} — база знаний`,
    '',
    generated(SOURCE),
    '',
    `База знаний: ${plural(base.attributes.length, ['атрибут', 'атрибута', 'атрибутов'])}, ${plural(base.objects.length, ['объект', 'объекта', 'объектов'])} ранжирования, ${plural(questions.length, ['вопрос-параметр', 'вопроса-параметра', 'вопросов-параметров'])} и ${plural(rules.length + base.rules.length, ['правило', 'правила', 'правил'])}: ${rules.length} «параметр + атрибут» и ${base.rules.length} «параметр + параметр». Как по ним принимается решение — в [методике](methodology.md).`,
    '',
    '## Атрибуты',
    '',
    'Каждый объект описан выраженностью всех атрибутов по шкале от 0 до 3.',
    '',
    '| Код | Атрибут | Группа | Что означает шкала |',
    '|---|---|---|---|',
    ...base.attributes.map(
      (a) => `| \`${a.id}\` | ${a.title} | ${base.groups.some((g) => g.attribute === a.id) ? `сфера (вес ${a.importance})` : 'стиль'} | ${cell(a.description)} |`,
    ),
    '',
    '## Объекты ранжирования',
    '',
    `| № | Вид деятельности | Направление | ${attributeIds.map((id) => short[id]).join(' | ')} |`,
    `|:-:|---|---|${attributeIds.map(() => ':-:').join('|')}|`,
    ...base.objects.map(
      (o, i) => `| ${i + 1} | ${cell(o.title)} | ${groupTitle[o.group!]} | ${attributeIds.map((id) => o.values[id] || '·').join(' | ')} |`,
    ),
    '',
    ...base.objects.flatMap((o, i) => [`${i + 1}. **${o.title}** — ${o.description}`]),
    '',
    '## Правила «параметр + атрибут»',
    '',
    `ЕСЛИ параметр получил значение, ТО атрибутам даётся «преимущество» — вес от −2 до 3. Каждый вариант ответа с весами — одно правило: ${plural(rules.length, ['правило', 'правила', 'правил'])} (А1–А${rules.length}) с ${plural(effects, ['заключением', 'заключениями', 'заключениями'])}. Остальные ${options - rules.length} из ${options} вариантов — отказы, «пока не знаю» и ошибочные решения ситуационных задач — правил не дают. Номер правила стоит у варианта в таблицах вопросов ниже; заключения сработавших правил складываются в профиль предпочтений.`,
    '',
    `Пример: **${example.title}.** ЕСЛИ «${example.question.parameter}» = «${example.option.text}» ТО ${weightList(example.option.weights)}.`,
    '',
    '## Правила «параметр + параметр»',
    '',
    'Если условие выполнено, система сама выводит значение другого параметра и этот вопрос не задаёт.',
    '',
    '| Правило | Если | То | Почему |',
    '|:-:|---|---|---|',
    ...base.rules.map(
      (rule) =>
        `| ${rule.title} | ${rule.if.map(conditionText).join(' И ')} | ${conditionText(rule.then)} (вопрос ${number.get(rule.then.question)} не задаётся) | ${cell(rule.note)} |`,
    ),
    '',
    `При срабатывании всех правил задаётся ${minAskedQuestions(base)} вопросов из ${questions.length}.`,
    '',
    `Таких правил немного намеренно. Каждое снимает вопрос, а задаваться должно не меньше 20 вопросов: при ${questions.length} вопросах правила могут выводить не больше ${plural(questions.length - 20, ['параметра', 'параметров', 'параметров'])}, и сейчас выводятся ${inferred}. Кроме того, правило отвечает за пользователя, поэтому оно задано только там, где вывод однозначен; вероятностные связи между ответами учтены правилами «параметр + атрибут».`,
    '',
    '## Вопросы — параметры рабочей базы данных',
    '',
    `Один ответ — ${single.length} вопросов (из них ${situational.length} — ситуационные задачи: № ${situational.join(', ')}), несколько ответов — ${multiple.length}: № ${multiple.join(', ')}.`,
    `Веса — это «преимущество», которое ответ даёт атрибутам (правило «параметр + атрибут»): для сфер от 0 до 3, для стиля от −2 до 3. Максимум по сфере у всех направлений одинаковый: ${base.groups.map((g) => `${short[g.attribute]} ${max[g.attribute]}`).join(', ')}.`,
  ];

  base.blocks.forEach((block, blockIndex) => {
    const owner = base.groups.find((g) => g.id === block.group);
    lines.push(
      '',
      `### Блок ${blockIndex + 1}. ${block.title}`,
      '',
      owner
        ? `Блок направления «${owner.title}». ${block.description}.`
        : `Общий блок: варианты сравнивают сферы между собой и описывают стиль. ${block.description}.`,
    );
    for (const question of block.questions) {
      const rule = base.rules.find((r) => r.then.question === question.id);
      lines.push(
        '',
        `#### ${number.get(question.id)}. ${question.text}`,
        '',
        `**${typeLabel(question)}**${question.situational ? ' — ситуационная задача' : ''} · параметр «${question.parameter}»${rule ? ` · может быть выведен правилом ${base.rules.filter((r) => r.then.question === question.id).map((r) => r.title).join(', ')}` : ''}`,
        '',
        '| | Вариант | Правило | Веса атрибутов |',
        '|:-:|---|:-:|---|',
        ...question.options.map(
          (o) =>
            `| ${o.id} | ${cell(o.text)}${o.exclusive ? ' _(снимает остальные отметки)_' : ''} | ${ruleOf.get(`${question.id}/${o.id}`) ?? '—'} | ${weightList(o.weights)} |`,
        ),
        '',
        `*Обоснование весов.* ${question.note}`,
      );
    }
  });
  return lines.join('\n') + '\n';
}

function objectsCsv(): string {
  return csv([
    ['№', 'Код', 'Вид деятельности', 'Направление', 'Описание', ...base.attributes.map((a) => a.title)],
    ...base.objects.map((o, i) => [
      String(i + 1),
      o.id,
      o.title,
      groupTitle[o.group!],
      o.description,
      ...attributeIds.map((id) => String(o.values[id])),
    ]),
  ]);
}

function questionsCsv(): string {
  const rows = [
    ['№', 'Блок', 'Код вопроса', 'Параметр', 'Вопрос', 'Можно выбрать', 'Ситуационная задача', 'Вариант', 'Текст варианта', ...base.attributes.map((a) => a.title)],
  ];
  base.blocks.forEach((block, blockIndex) => {
    for (const question of block.questions) {
      for (const option of question.options) {
        rows.push([
          String(number.get(question.id)),
          `${blockIndex + 1}. ${block.title}`,
          question.id,
          question.parameter,
          question.text,
          typeLabel(question).toLowerCase(),
          question.situational ? 'да' : '',
          option.id,
          option.text,
          ...attributeIds.map((id) => String(option.weights[id] ?? 0)),
        ]);
      }
    }
  });
  return csv(rows);
}

function validationMarkdown(): string {
  const sim = simulate(base);
  const expected = expectedRandomScores(base);
  const points = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',');
  const personas = runExampleProfiles(base);
  const [questionsRow, parametersRow, objectsRow, attributesRow, topRow] = checkRequirements(base);

  return [
    '# Проверка базы знаний',
    '',
    generated(SOURCE),
    'Та же проверка, но с ошибкой при нарушениях, — `npm run check`.',
    '',
    '## Требования задания',
    '',
    '| Требование | Нужно | В системе |',
    '|---|:-:|:-:|',
    ...[questionsRow, parametersRow, objectsRow, attributesRow, topRow].map((row) => `| ${row.title} | ${row.need} | ${row.actual} |`),
    '',
    '## Баланс сфер',
    '',
    `Максимум M у всех направлений одинаковый: ${base.groups.map((g) => `${groupShort[g.id]} — ${max[g.attribute]}`).join(', ')}.`,
    `Ожидаемая сумма баллов при случайных ответах без правил тоже одинаковая: ${base.groups.map((g) => `${groupShort[g.id]} — ${points(expected[g.id])}`).join(', ')}.`,
    '',
    '## Персоны',
    '',
    'Ответы персон подобраны по смыслу вариантов, а не по весам. Если после правки весов персона получает другое направление или в тройку лидеров не попадает ни один ожидаемый вид деятельности, значит, веса разошлись со смыслом ответов.',
    '',
    '| Персона | Кто это | Ожидали | Направленность | Тройка видов деятельности | Задано вопросов | |',
    '|---|---|---|---|---|:-:|:-:|',
    ...personas.map(({ profile, evaluation, asked, problems }) => {
      const expect = [
        (profile.expectGroup ?? []).map((id) => groupShort[id]).join(' или '),
        profile.expectClose && 'почти поровну',
        profile.expectWeak && 'склонность слабая',
      ]
        .filter(Boolean)
        .join(', ');
      const { winner } = evaluation.verdict!;
      const top = evaluation.objects
        .slice(0, 3)
        .map((item) => `${item.object.title} (${percent(item.score * 100)})`)
        .join('; ');
      return `| ${profile.name} | ${profile.story} | ${expect} | ${groupShort[winner.group.id]} ${percent(winner.percent)} | ${top} | ${asked} | ${problems.length ? '✗' : '✓'} |`;
    }),
    '',
    '## Случайные ответы',
    '',
    `${sim.runs.toLocaleString('ru-RU')} анкет: в вопросе с одним ответом вариант выбирается равновероятно, в вопросе с несколькими каждый вариант отмечается с вероятностью 1/2, правила применяются как в интерфейсе. Наименьшее число заданных вопросов — ${sim.minAsked}.`,
    '',
    '| Направление | Побед | Средний процент |',
    '|---|:-:|:-:|',
    ...base.groups.map((g) => `| ${g.title} | ${percent(sim.wins[g.id], sim.runs)} | ${percent(sim.meanPercent[g.id])} |`),
    '',
    `Слабо выраженная склонность (меньше ${weakPercent} %) — у ${percent(sim.weak, sim.runs)} анкет, почти равное второе место (разрыв меньше ${closeGap} п. п.) — у ${percent(sim.close, sim.runs)}.`,
    '',
    '«Дети» и «Экология» побеждают немного реже, потому что правила П1–П4 выводят отказные ответы именно в их блоках: при случайных ответах человек, который написал, что с детьми ему неуютно, дальше уже не может «случайно» пообещать ходить к детям полгода. У человека, отвечающего осознанно, такого перекоса нет — правило выводит тот ответ, который он дал бы сам.',
    '',
    '| Вид деятельности | Первое место | В пятёрке лидеров |',
    '|---|:-:|:-:|',
    ...base.objects
      .map((o) => ({ o, first: sim.firstPlace[o.id] / sim.runs, top: sim.topFive[o.id] / sim.runs }))
      .sort((a, b) => b.first - a.first)
      .map(({ o, first, top }) => `| ${o.title} | ${percent(first, 1)} | ${percent(top, 1)} |`),
    '',
    'Ни один вид деятельности не выигрывает чаще чем в 20 % случайных анкет, и каждый попадает в пятёрку лидеров хотя бы в 3 % из них. Реже всех на первое место выходят «универсалы» вроде центра для детей с особенностями развития: их профиль лежит между несколькими сферами, поэтому они побеждают у людей, которым близки обе, — это проверяет персона «Лена».',
    '',
  ].join('\n');
}

/** Авторы и лицензии фото — лицензии CC BY и CC BY-SA требуют их указывать. */
function creditsMarkdown(): string {
  const seen = new Set<string>();
  const images = baseImages(base).filter(({ image }) => !seen.has(image.url) && seen.add(image.url));
  return [
    '# Фотографии',
    '',
    generated(SOURCE),
    '',
    'Все фото взяты с Wikimedia Commons и Flickr под свободными лицензиями. Для сайта они обрезаны до 3:2, уменьшены и пересжаты в WebP. Фото под CC BY-SA распространяются на тех же условиях.',
    '',
    '| Файл | Что на фото | Автор | Лицензия | Источник |',
    '|---|---|---|---|---|',
    ...images.map(({ image }) => {
      const credit = image.credit!;
      const license = credit.licenseUrl ? `[${credit.license}](${credit.licenseUrl})` : credit.license;
      return `| \`${image.url.replace('images/', '')}\` | ${cell(image.alt!)} | ${cell(credit.author!)} | ${license} | [${credit.source}](${credit.url}) |`;
    }),
    '',
  ].join('\n');
}

write('knowledge-base.md', knowledgeBaseMarkdown());
write('objects.csv', objectsCsv());
write('questions.csv', questionsCsv());
write('validation.md', validationMarkdown());
write('credits.md', creditsMarkdown());
