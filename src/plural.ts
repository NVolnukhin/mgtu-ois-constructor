/** Нужная форма слова для числа: pluralWord(5, ['вопрос', 'вопроса', 'вопросов']) → «вопросов». */
export function pluralWord(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
}

/** Число со словом в нужной форме: plural(5, ['вопрос', 'вопроса', 'вопросов']) → «5 вопросов». */
export function plural(n: number, forms: [string, string, string]): string {
  return `${n} ${pluralWord(n, forms)}`;
}
