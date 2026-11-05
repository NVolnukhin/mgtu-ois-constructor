// Эталон результатов примера: что давала сданная версия на всех персонах и случайных анкетах.
// Снят со старого движка до перехода на новый формат. Если результаты разошлись, npm run check
// падает. Обновлять эталон (npm run check -- --update-baseline) можно только после намеренной
// правки примера: для правок движка расхождение и есть поломка.

import { readFileSync, writeFileSync } from 'node:fs';
import type { Quiz } from '../src/engine/types.ts';
import { runPersonas, simulate } from './lib.ts';

const FILE = new URL('./example-baseline.json', import.meta.url);

function round(value: number): number {
  return Math.round(value * 1e10) / 1e10;
}

interface Snapshot {
  profiles: { name: string }[];
  random: object;
}

function takeSnapshot(quiz: Quiz): Snapshot {
  const profiles = runPersonas(quiz).map(({ persona, evaluation, asked }) => ({
    name: persona.name,
    asked,
    winner: evaluation.winner.direction.id,
    isClose: evaluation.isClose,
    isWeak: evaluation.isWeak,
    groups: evaluation.ranking.map((s) => [s.direction.id, s.points, s.max, round(s.percent), s.generalPoints]),
    objects: evaluation.objects.map((o) => [o.object.id, round(o.score)]),
    reasons: evaluation.reasons.map((r) => r.text),
  }));
  const sim = simulate(quiz);
  const random = {
    runs: sim.runs,
    wins: sim.wins,
    meanPercent: Object.fromEntries(Object.entries(sim.meanPercent).map(([id, value]) => [id, round(value)])),
    weak: sim.weak,
    close: sim.close,
    minAsked: sim.minAsked,
    firstPlace: sim.firstPlace,
    topFive: sim.topFive,
  };
  return { profiles, random };
}

export function writeBaseline(quiz: Quiz): void {
  const { profiles, random } = takeSnapshot(quiz);
  const lines = [
    '{',
    '  "profiles": [',
    profiles.map((profile) => `    ${JSON.stringify(profile)}`).join(',\n'),
    '  ],',
    `  "random": ${JSON.stringify(random)}`,
    '}',
  ];
  writeFileSync(FILE, lines.join('\n') + '\n');
}

/** Сравнивает результаты с эталоном. Возвращает список расхождений. */
export function compareWithBaseline(quiz: Quiz): string[] {
  const expected = JSON.parse(readFileSync(FILE, 'utf8')) as Snapshot;
  const actual = takeSnapshot(quiz);
  const problems: string[] = [];
  if (actual.profiles.length !== expected.profiles.length) {
    problems.push(`персон ${actual.profiles.length}, в эталоне ${expected.profiles.length}`);
  }
  expected.profiles.forEach((profile, index) => {
    if (JSON.stringify(profile) !== JSON.stringify(actual.profiles[index])) {
      problems.push(`«${profile.name}»: результаты отличаются от эталона`);
    }
  });
  if (JSON.stringify(expected.random) !== JSON.stringify(actual.random)) {
    problems.push('случайные анкеты: результаты отличаются от эталона');
  }
  return problems;
}
