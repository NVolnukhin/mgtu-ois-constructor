/**
 * Если элемент с фокусом исчез со страницы, браузер отдаёт фокус всему документу, и человек с клавиатуры
 * начинает обход страницы сначала. Функция после обновления экрана переводит фокус на подходящее место.
 * Если фокус никуда не делся (например, удаление отменили), ничего не делает.
 */
export function refocus(target: () => HTMLElement | null | undefined): void {
  requestAnimationFrame(() => {
    if (document.activeElement && document.activeElement !== document.body) return;
    target()?.focus();
  });
}
