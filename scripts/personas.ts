// Тестовые персоны: ответы подобраны по смыслу вариантов, а не по весам.
// Если после правки весов персона получает не то направление или не те виды деятельности,
// веса перестали отражать смысл ответов.

import type { DirectionId } from '../src/engine/types.ts';

export interface Persona {
  name: string;
  story: string;
  /** Направление, которое должно победить (или одно из нескольких). */
  expect: DirectionId[];
  /** Хотя бы один из этих видов деятельности должен попасть в тройку лидеров. */
  expectTop?: string[];
  /** Второе место должно быть почти равным первому. */
  expectClose?: boolean;
  /** Выраженной склонности быть не должно. */
  expectWeak?: boolean;
  /**
   * Ответы в порядке вопросов 1–23. Одна буква — один ответ, несколько букв — несколько ответов,
   * «-» — вопрос не задавался, его значение выводит правило. Вопросы с несколькими ответами: 2, 9, 13, 17, 21.
   */
  sheet: string[];
}

export const PERSONAS: Persona[] = [
  {
    name: 'Аня, вожатая',
    story: 'Три лета работала вожатой, ведёт кружок для младших школьников, любит шумные игры.',
    expect: ['children'],
    expectTop: ['counselor', 'hospital', 'tutor', 'mentor'],
    //      1    2     3    4    5    6    7    8    9      10   11   12   13   14   15   16   17   18   19   20   21    22   23
    sheet: ['a', 'ac', 'a', 'a', 'a', 'a', 'a', 'a', 'abc', 'b', 'a', 'c', 'a', 'd', 'b', 'b', 'a', 'c', 'c', 'b', 'ac', 'c', 'c'],
  },
  {
    name: 'Дима, брат девочки с ДЦП',
    story: 'У младшей сестры ДЦП, с детства помогает ей в городе, хочет выучить жестовый язык.',
    expect: ['inclusion'],
    expectTop: ['escort', 'signLanguage', 'specialKids', 'inclusiveSport'],
    sheet: ['b', 'b', 'c', 'd', 'a', 'a', 'a', 'b', 'd', 'd', 'c', 'a', 'abc', 'c', 'a', 'c', 'b', 'c', 'c', 'c', 'b', 'c', 'b'],
  },
  {
    name: 'Катя, внучка',
    story: 'Каждые выходные у бабушки, научила её и соседок пользоваться смартфоном.',
    expect: ['seniors'],
    expectTop: ['digital', 'homeHelp', 'careHome', 'phoneFriend'],
    sheet: ['c', 'ac', 'b', 'c', 'a', 'b', 'b', 'c', 'a', 'b', 'c', 'c', 'd', 'd', 'b', 'a', 'abc', 'b', 'b', 'b', 'b', 'c', 'c'],
  },
  {
    name: 'Лёша, экоактивист',
    story: 'Сортирует отходы, ездит на уборки берегов и летом волонтёрит в заповеднике.',
    expect: ['ecology'],
    expectTop: ['cleanup', 'reserve', 'greening'],
    sheet: ['d', 'd', 'd', 'b', 'b', 'b', 'a', 'c', 'b', 'd', 'd', 'c', 'a', 'd', 'c', 'b', 'd', 'c', 'c', 'a', 'abd', 'b', 'a'],
  },
  {
    name: 'Маша, будущий педагог-эколог',
    story: 'Учится на педагога, ведёт экоуроки в школе — одинаково тянется к детям и к природе.',
    expect: ['children', 'ecology'],
    expectTop: ['ecoTeacher'],
    expectClose: true,
    sheet: ['d', 'ad', 'a', 'a', 'a', 'a', 'b', 'b', 'abc', 'b', 'b', 'c', 'e', 'd', 'c', 'c', 'd', 'c', 'c', 'a', 'abc', 'b', 'b'],
  },
  {
    name: 'Олег, спокойный интроверт',
    story: 'Не любит шум и физическую работу, умеет слушать, терпеливо объясняет. С детьми ему неуютно.',
    expect: ['seniors'],
    expectTop: ['phoneFriend', 'memories', 'digital', 'signLanguage', 'audioDescription'],
    sheet: ['c', 'bc', 'b', 'c', 'a', 'b', 'c', 'd', 'e', 'b', '-', 'b', 'ad', 'c', 'b', 'b', 'ac', 'b', 'b', 'c', 'd', 'c', 'd'],
  },
  {
    name: 'Вера, которой интересно всё',
    story: 'Везде выбирает самые активные ответы, но в общем блоке ставит на первое место инклюзию.',
    expect: ['inclusion'],
    expectTop: ['escort', 'signLanguage', 'inclusiveArt', 'specialKids', 'inclusiveSport', 'audioDescription', 'accessibility'],
    sheet: ['b', 'abcd', 'c', 'd', 'a', 'a', 'a', 'a', 'abcd', 'b', 'a', 'b', 'abcd', 'c', 'a', 'a', 'abcd', 'b', 'a', 'b', 'abcd', 'b', 'b'],
  },
  {
    name: 'Лена, будущий дефектолог',
    story: 'Учится на дефектолога и занимается с детьми с аутизмом: одинаково близки и дети, и инклюзия.',
    expect: ['children', 'inclusion'],
    expectTop: ['specialKids'],
    expectClose: true,
    sheet: ['a', 'ab', 'c', 'd', 'a', 'a', 'b', 'a', 'abd', 'b', 'a', 'b', 'ab', 'c', 'a', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c'],
  },
  {
    name: 'Таня, организатор концертов',
    story: 'Устраивает концерты и праздники, хочет каждую неделю ходить в дом престарелых, к тяжёлым темам готова.',
    expect: ['seniors'],
    expectTop: ['careHome', 'hospice', 'memories'],
    sheet: ['c', 'c', 'b', 'b', 'a', 'b', 'b', 'c', 'b', 'd', 'c', 'c', 'd', 'd', 'b', 'a', 'c', 'b', 'a', 'c', 'e', 'c', 'c'],
  },
  {
    name: 'Саша, пока не определился',
    story: 'Опыта нет, ни одно направление не зажигает, на многое отвечает «пока не знаю».',
    expect: ['ecology', 'seniors'],
    expectWeak: true,
    sheet: ['d', 'c', 'b', 'b', 'd', 'b', 'b', 'c', 'e', 'c', 'c', 'c', 'e', 'd', 'c', 'c', 'e', 'c', 'c', 'c', 'a', 'c', 'c'],
  },
  {
    name: 'Ира, у которой мало времени',
    story: 'Готова помогать только на разовых событиях, учиться заранее не хочет, любит движение и праздники.',
    expect: ['inclusion', 'ecology'],
    expectTop: ['inclusiveSport', 'cleanup', 'accessibility', 'escort', 'greening'],
    sheet: ['b', 'bd', 'a', 'a', 'c', 'c', 'a', 'c', 'b', 'd', '-', 'b', 'a', 'c', 'b', 'c', 'e', 'c', 'c', 'b', 'ab', 'c', 'a'],
  },
  {
    name: 'Гоша, которому нельзя нагрузку',
    story: 'После операции противопоказана физическая нагрузка; живёт с бабушкой, любит поговорить.',
    expect: ['seniors'],
    expectTop: ['phoneFriend', 'memories', 'digital'],
    sheet: ['c', 'c', 'b', 'c', 'a', 'b', 'd', 'c', 'a', 'b', 'c', 'c', 'b', 'd', 'b', 'a', 'ac', 'b', 'b', 'c', 'e', 'c', '-'],
  },
  {
    name: 'Костя, программист',
    story: 'Дети и экология его не трогают, времени мало, нагрузка противопоказана; зато умеет объяснять технику.',
    expect: ['seniors'],
    expectTop: ['digital', 'memories'],
    sheet: ['c', 'c', 'b', 'b', 'c', 'b', 'd', 'd', 'e', 'a', '-', 'c', 'd', 'd', 'c', 'b', 'a', 'b', 'c', 'd', '-', 'a', '-'],
  },
];
