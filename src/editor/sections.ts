// Разделы редактора: их показывает навигация редактора и экран «Проверка» в ссылках на ошибки.

import type { IssueSection } from '../engine/validate.ts';

export const EDITOR_SECTIONS: { id: IssueSection; title: string }[] = [
  { id: 'general', title: 'Основное' },
  { id: 'attributes', title: 'Атрибуты' },
  { id: 'groups', title: 'Группы' },
  { id: 'objects', title: 'Объекты' },
  { id: 'questions', title: 'Вопросы' },
  { id: 'rules', title: 'Правила' },
  { id: 'settings', title: 'Настройки' },
];
