// npm run check — проверяет базу знаний, прогоняет персоны и случайные анкеты.
// Завершается с ошибкой, если нарушены требования задания или принципы из docs/methodology.md.

import { DIRECTION_IDS } from '../src/engine/types.ts';
import { allQuestions, attributeRules, maxScores } from '../src/engine/scoring.ts';
import {
  loadImages,
  loadQuiz,
  minAskedQuestions,
  percent,
  REQUIREMENTS,
  runPersonas,
  simulate,
  validateImages,
  validateQuiz,
} from './lib.ts';
import { compareWithBaseline, writeBaseline } from './baseline.ts';
import { plural } from '../src/plural.ts';

/** Допустимая доля побед одного направления на случайных ответах. */
const FAIR_SHARE = { min: 0.2, max: 0.3 };
/** Ни один вид деятельности не должен доминировать, и каждый должен регулярно попадать в пятёрку лидеров. */
const OBJECT_SHARE = { maxFirst: 0.2, minTopFive: 0.03 };

const quiz = loadQuiz();
const short = Object.fromEntries(quiz.directions.map((d) => [d.id, d.short]));
let failed = false;

const errors = [...validateQuiz(quiz), ...validateImages(quiz, loadImages())];
const questions = allQuestions(quiz);
const single = questions.filter((q) => q.type === 'single');
const situational = single.filter((q) => q.situational).length;
console.log(
  `База знаний: ${plural(quiz.objects.length, ['объект', 'объекта', 'объектов'])} × ${plural(quiz.attributes.length, ['атрибут', 'атрибута', 'атрибутов'])}, ` +
    `${plural(questions.length, ['вопрос-параметр', 'вопроса-параметра', 'вопросов-параметров'])} в ${plural(quiz.blocks.length, ['блоке', 'блоках', 'блоках'])}, ` +
    `${plural(attributeRules(quiz).length + quiz.rules.length, ['правило', 'правила', 'правил'])}: ` +
    `${attributeRules(quiz).length} «параметр + атрибут» и ${quiz.rules.length} «параметр + параметр».`,
);
console.log(
  `Один ответ — ${single.length} (из них ${situational} ситуационные задачи), несколько ответов — ${questions.length - single.length}. ` +
    `Задаётся не меньше ${minAskedQuestions(quiz)} вопросов.`,
);
console.log(
  `Требования: вопросов ≥ ${REQUIREMENTS.questions}, параметров ≥ ${REQUIREMENTS.parameters}, ` +
    `объектов ≥ ${REQUIREMENTS.objects}, свойств у объекта ≥ ${REQUIREMENTS.attributes}.`,
);
if (errors.length > 0) {
  failed = true;
  console.log(`\n✗ Ошибки в базе знаний (${errors.length}):`);
  for (const error of errors) console.log(`  – ${error}`);
}

const max = maxScores(quiz);
console.log(`Максимум по сферам (M): ${DIRECTION_IDS.map((id) => `${short[id]} ${max[id]}`).join(' · ')}`);

console.log('\nПерсоны:');
for (const { persona, evaluation, asked, problems } of runPersonas(quiz)) {
  const { winner, runnerUp } = evaluation;
  const flags = [evaluation.isClose && 'почти равное второе место', evaluation.isWeak && 'склонность слабая']
    .filter(Boolean)
    .join(', ');
  const top = evaluation.objects
    .slice(0, 3)
    .map((item) => `${item.object.title} ${percent(item.score * 100)}`)
    .join('; ');
  console.log(
    `  ${problems.length ? '✗' : '✓'} ${persona.name}: ${winner.direction.short} ${percent(winner.percent)}, ` +
      `второе — ${runnerUp.direction.short} ${percent(runnerUp.percent)}${flags ? ` (${flags})` : ''}; задано ${plural(asked, ['вопрос', 'вопроса', 'вопросов'])}`,
  );
  console.log(`      тройка: ${top}`);
  for (const problem of problems) console.log(`      ${problem}`);
  if (problems.length > 0) failed = true;
}

const sim = simulate(quiz);
console.log(`\nСлучайные ответы, ${sim.runs.toLocaleString('ru-RU')} анкет:`);
console.log(`  Побед направлений: ${DIRECTION_IDS.map((id) => `${short[id]} ${percent(sim.wins[id], sim.runs)}`).join(' · ')}`);
console.log(`  Средний процент: ${DIRECTION_IDS.map((id) => `${short[id]} ${percent(sim.meanPercent[id])}`).join(' · ')}`);
console.log(`  Слабая склонность: ${percent(sim.weak, sim.runs)} анкет, почти равное второе место: ${percent(sim.close, sim.runs)}`);
console.log(`  Наименьшее число заданных вопросов: ${sim.minAsked}`);
for (const id of DIRECTION_IDS) {
  const share = sim.wins[id] / sim.runs;
  if (share < FAIR_SHARE.min || share > FAIR_SHARE.max) {
    failed = true;
    console.log(`  ✗ ${short[id]} побеждает в ${percent(share, 1)} случаев — веса несбалансированы`);
  }
}
const objectShares = quiz.objects
  .map((object) => ({ object, share: sim.firstPlace[object.id] / sim.runs, top: sim.topFive[object.id] / sim.runs }))
  .sort((a, b) => b.share - a.share);
console.log('  Первое место среди видов деятельности:');
console.log(
  objectShares.map(({ object, share, top }) => `    ${object.title}: ${percent(share, 1)} (в пятёрке — ${percent(top, 1)})`).join('\n'),
);
for (const { object, share, top } of objectShares) {
  if (share > OBJECT_SHARE.maxFirst) {
    failed = true;
    console.log(`  ✗ «${object.title}» на первом месте в ${percent(share, 1)} случаев — доминирует`);
  }
  if (top < OBJECT_SHARE.minTopFive) {
    failed = true;
    console.log(`  ✗ «${object.title}» попадает в пятёрку лишь в ${percent(top, 1)} случаев`);
  }
}

if (process.argv.includes('--update-baseline')) {
  writeBaseline(quiz);
  console.log('\nЭталон обновлён: scripts/example-baseline.json.');
}
const drift = compareWithBaseline(quiz);
if (drift.length > 0) {
  failed = true;
  console.log(`\n✗ Результаты разошлись со сданной версией (${drift.length}):`);
  for (const problem of drift) console.log(`  – ${problem}`);
} else {
  console.log('\nРезультаты совпадают со сданной версией: персоны и случайные анкеты, точно до 10 знаков.');
}

console.log(failed ? '\nПроверка не пройдена.' : '\nВсё в порядке.');
process.exit(failed ? 1 : 0);
