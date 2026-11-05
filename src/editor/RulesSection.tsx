import { useBase } from '../base.ts';
import { allQuestions } from '../engine/scoring.ts';
import type { Condition, Question, Rule } from '../engine/types.ts';
import { minAskedQuestions } from '../engine/validate.ts';
import { plural } from '../plural.ts';
import type { UpdateBase } from './EditorScreen.tsx';
import { IssueList, RowActions, SectionHead, TextField } from './fields.tsx';
import { addRule, moveItem } from './ops.ts';

export function RulesSection({ update }: { update: UpdateBase }) {
  const { base, issues, steps, attributeRules } = useBase();
  const sectionIssues = issues.filter((issue) => issue.section === 'rules');
  const canAdd = allQuestions(base).filter((question) => question.options.length > 0).length >= 2;

  const edit = (id: string, change: (rule: Rule) => void) =>
    update((draft) => {
      const rule = draft.rules.find((item) => item.id === id);
      if (rule) change(rule);
    });

  return (
    <section>
      <SectionHead title="Правила «параметр + параметр»">
        ЕСЛИ выполнены все условия, ТО система сама присваивает значение другому параметру, и этот вопрос пользователю уже не задаётся. Условия
        работают через И. ИЛИ — это два правила. Выведенное значение может быть условием другого правила: цепочки работают. Условия должны стоять раньше
        выводимого вопроса.
      </SectionHead>
      <p className="editor-note">
        При {plural(steps.length, ['вопросе', 'вопросах', 'вопросах'])} задаётся не меньше {minAskedQuestions(base)}. Правила «параметр + атрибут» (их{' '}
        {attributeRules.length}) — это варианты ответа и их веса, они задаются в разделе «Вопросы».
      </p>
      <IssueList issues={sectionIssues} />

      <ol className="editor-list">
        {base.rules.map((rule, index) => (
          <li key={rule.id} id={`entity-${rule.id}`} className="editor-card">
            <div className="editor-card__head">
              <input
                className="cell-input cell-input--rule-title"
                type="text"
                value={rule.title}
                aria-label={`Обозначение правила ${index + 1}`}
                onChange={(event) => edit(rule.id, (item) => void (item.title = event.target.value))}
              />
              <span className="editor-card__title" />
              <RowActions
                label={`правило ${rule.title}`}
                onUp={index > 0 ? () => update((draft) => moveItem(draft.rules, index, -1)) : undefined}
                onDown={index < base.rules.length - 1 ? () => update((draft) => moveItem(draft.rules, index, 1)) : undefined}
                onRemove={() => {
                  if (window.confirm(`Удалить правило ${rule.title}?`)) {
                    update((draft) => void (draft.rules = draft.rules.filter((item) => item.id !== rule.id)));
                  }
                }}
              />
            </div>

            <div className="rule-form">
              {rule.if.map((condition, conditionIndex) => (
                <div key={conditionIndex} className="rule-form__line">
                  <span className="rule__keyword">{conditionIndex === 0 ? 'ЕСЛИ' : 'И'}</span>
                  <ConditionEditor
                    condition={condition}
                    label={`Условие ${conditionIndex + 1} правила ${rule.title}`}
                    onChange={(next) => edit(rule.id, (item) => void (item.if[conditionIndex] = next))}
                  />
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    aria-label={`Убрать условие ${conditionIndex + 1}`}
                    title={rule.if.length > 1 ? 'Убрать условие' : 'У правила должно быть хотя бы одно условие'}
                    disabled={rule.if.length === 1}
                    onClick={() => edit(rule.id, (item) => void item.if.splice(conditionIndex, 1))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <p className="rule-form__add">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => edit(rule.id, (item) => void item.if.push({ ...item.if[item.if.length - 1] }))}
                >
                  Добавить условие через И
                </button>
              </p>
              <div className="rule-form__line">
                <span className="rule__keyword">ТО</span>
                <ConditionEditor
                  condition={rule.then}
                  label={`Заключение правила ${rule.title}`}
                  onChange={(next) => edit(rule.id, (item) => void (item.then = next))}
                />
              </div>
            </div>

            <TextField
              label="Обоснование"
              hint="Почему вывод однозначен: правило отвечает за пользователя."
              value={rule.note}
              onChange={(value) => edit(rule.id, (item) => void (item.note = value))}
            />
          </li>
        ))}
      </ol>

      {!canAdd && <p className="editor-empty">Для правила нужно хотя бы два вопроса с вариантами ответа.</p>}
      <div className="actions">
        <button type="button" className="btn btn--secondary btn--small" disabled={!canAdd} onClick={() => update((draft) => void addRule(draft))}>
          Добавить правило
        </button>
      </div>
    </section>
  );
}

interface ConditionEditorProps {
  condition: Condition;
  label: string;
  onChange: (condition: Condition) => void;
}

/** Выбор параметра и его значения. При смене вопроса значение сбрасывается на первый вариант. */
function ConditionEditor({ condition, label, onChange }: ConditionEditorProps) {
  const { steps, questionById } = useBase();
  const question: Question | undefined = questionById[condition.question];
  // Вопрос без вариантов выбрать нельзя: у условия не было бы значения.
  const choices = steps.filter(({ question: item }) => item.options.length > 0);
  return (
    <span className="rule-form__selects">
      <select
        className="cell-input"
        aria-label={`${label}: параметр`}
        value={condition.question}
        onChange={(event) => onChange({ question: event.target.value, option: questionById[event.target.value].options[0].id })}
      >
        {choices.map(({ question: item, index }) => (
          <option key={item.id} value={item.id}>
            {index + 1}. {item.parameter || item.text || 'Без названия'}
          </option>
        ))}
      </select>
      <span className="rule-form__equals">=</span>
      <select
        className="cell-input"
        aria-label={`${label}: значение`}
        value={condition.option}
        onChange={(event) => onChange({ question: condition.question, option: event.target.value })}
      >
        {question?.options.map((option, index) => (
          <option key={option.id} value={option.id}>
            {option.text || `Вариант ${index + 1}`}
          </option>
        ))}
      </select>
    </span>
  );
}
