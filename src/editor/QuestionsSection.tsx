import { useState } from 'react';
import { useBase } from '../base.ts';
import { useConfirm } from '../components/ConfirmDialog.tsx';
import { MAX_TEXT_LENGTH } from '../engine/parse.ts';
import { allQuestions, attributeLabel, ruleTitle, weight } from '../engine/scoring.ts';
import type { Block, Group, Option, Question, Rule } from '../engine/types.ts';
import { WEIGHT_RANGE } from '../engine/validate.ts';
import { plural } from '../plural.ts';
import type { UpdateBase } from './EditorScreen.tsx';
import { CheckboxField, ImageField, IssueList, RowActions, ScaleSelect, SectionHead, SelectField, TextField } from './fields.tsx';
import { addBlock, addQuestion, moveItem, moveQuestion, newOption, profilesAnswering, profilesPhrase, removeBlock, removeOption, removeQuestion, rulesUsing, setPhrase, setQuestionType, setWeight, singleAnswerWarning } from './ops.ts';

/** Что пропадёт вместе с вопросом или вариантом: правила, которые на него ссылаются. */
function rulesLost(rules: Rule[]): string {
  if (rules.length === 0) return '';
  const titles = rules.map(ruleTitle).join(', ');
  return rules.length === 1 ? `Вместе с ним пропадёт правило ${titles}.` : `Вместе с ним пропадут правила ${titles}.`;
}

export function QuestionsSection({ update }: { update: UpdateBase }) {
  const confirm = useConfirm();
  const { base, issues, steps } = useBase();
  // Какие вопросы раскрыты. Форма вопроса большая, поэтому по умолчанию видно только оглавление.
  const [open, setOpen] = useState<Set<string>>(new Set());

  const reveal = (id: string) => setOpen((current) => new Set(current).add(id));
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const editBlock = (id: string, change: (block: Block) => void) =>
    update((draft) => {
      const block = draft.blocks.find((item) => item.id === id);
      if (block) change(block);
    });

  async function removeWholeBlock(block: Block, index: number) {
    const lost = plural(block.questions.length, ['вопрос', 'вопроса', 'вопросов']);
    const profiles = base.testProfiles.filter((profile) => block.questions.some((question) => profile.answers[question.id] !== undefined));
    const yes = await confirm({
      title: `Удалить блок ${index + 1}${block.title ? ` «${block.title}»` : ''}?`,
      message:
        [
          block.questions.length > 0 && `Вместе с ним пропадут ${lost} и правила, которые на них ссылаются.`,
          profiles.length > 0 && `Ответы на эти вопросы пропадут из ${profilesPhrase(profiles)}.`,
        ]
          .filter(Boolean)
          .join(' ') || undefined,
      action: 'Удалить',
    });
    if (yes) update((draft) => removeBlock(draft, block.id));
  }

  function createQuestion(blockId: string) {
    update((draft) => reveal(addQuestion(draft, blockId).id));
  }

  return (
    <section>
      <SectionHead title="Вопросы">
        Каждый вопрос — параметр рабочей базы данных. Вариант ответа и его веса — это правило «параметр + атрибут» (А1, А2, …): ответ даёт атрибутам
        «преимущество». Номера правил считаются сами.
      </SectionHead>

      {base.attributes.length === 0 && <p className="editor-empty">Веса можно будет задать, когда появятся атрибуты.</p>}

      <ol className="editor-blocks">
        {base.blocks.map((block, blockIndex) => (
          <li key={block.id} id={`entity-${block.id}`} className="editor-block">
            <div className="editor-card__head">
              <span className="editor-block__title">Блок {blockIndex + 1}</span>
              <RowActions
                label={`блок ${blockIndex + 1}`}
                onUp={blockIndex > 0 ? () => update((draft) => moveItem(draft.blocks, blockIndex, -1)) : undefined}
                onDown={blockIndex < base.blocks.length - 1 ? () => update((draft) => moveItem(draft.blocks, blockIndex, 1)) : undefined}
                onRemove={() => removeWholeBlock(block, blockIndex)}
              />
            </div>
            <div className="form-grid">
              <TextField label="Название блока" value={block.title} onChange={(value) => editBlock(block.id, (item) => void (item.title = value))} />
              {base.groups.length > 0 && (
                <SelectField
                  label="Группа блока"
                  hint="Блоки без группы общие: при равенстве процентов побеждает группа, набравшая больше в них."
                  value={block.group ?? ''}
                  options={[{ value: '', label: 'Общий блок' }, ...base.groups.map((group) => ({ value: group.id, label: group.title || 'Без названия' }))]}
                  onChange={(value) =>
                    editBlock(block.id, (item) => {
                      if (value) item.group = value;
                      else delete item.group;
                    })
                  }
                />
              )}
              <TextField
                label="Описание блока"
                className="form-grid__wide"
                value={block.description}
                onChange={(value) => editBlock(block.id, (item) => void (item.description = value))}
              />
            </div>

            <ol className="editor-questions">
              {block.questions.map((question) => {
                const index = steps.findIndex((step) => step.question.id === question.id);
                return (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    canUp={index > 0 || blockIndex > 0}
                    canDown={index < steps.length - 1 || blockIndex < base.blocks.length - 1}
                    open={open.has(question.id)}
                    onToggle={() => toggle(question.id)}
                    update={update}
                  />
                );
              })}
            </ol>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => createQuestion(block.id)}>
              Добавить вопрос
            </button>
          </li>
        ))}
      </ol>

      <div className="actions">
        <button type="button" className="btn btn--secondary btn--small" onClick={() => update((draft) => void addBlock(draft))}>
          Добавить блок
        </button>
      </div>
      <IssueList issues={issues.filter((issue) => issue.section === 'questions')} onSelect={reveal} />
    </section>
  );
}

interface QuestionCardProps {
  question: Question;
  index: number;
  canUp: boolean;
  canDown: boolean;
  open: boolean;
  onToggle: () => void;
  update: UpdateBase;
}

function QuestionCard({ question, index, canUp, canDown, open, onToggle, update }: QuestionCardProps) {
  const confirm = useConfirm();
  const { base, issues } = useBase();
  const inferredBy = base.rules.filter((rule) => rule.then.question === question.id);
  const failed = issues.some((issue) => issue.target === question.id && issue.severity === 'error');
  const title = question.parameter || question.text || 'Новый вопрос';

  const edit = (change: (item: Question) => void) =>
    update((draft) => {
      const item = allQuestions(draft).find((candidate) => candidate.id === question.id);
      if (item) change(item);
    });

  async function remove() {
    const rules = rulesUsing(base, question.id);
    const lost = rulesLost(rules);
    const profiles = profilesAnswering(base, question.id);
    const answers = profiles.length > 0 ? `Ответ на него пропадёт из ${profilesPhrase(profiles)}.` : '';
    const yes = await confirm({ title: `Удалить вопрос ${index + 1}?`, message: [`«${title}».`, lost, answers].filter(Boolean).join(' '), action: 'Удалить' });
    if (yes) update((draft) => removeQuestion(draft, question.id));
  }

  /** «Ничего из этого» и общие объяснения работают только при нескольких ответах: если они заданы, спрашиваем. */
  async function changeType(type: Question['type']) {
    const warning = type === 'single' ? singleAnswerWarning(base, question) : '';
    if (warning && !(await confirm({ title: 'Оставить только один ответ?', message: warning, action: 'Оставить один' }))) return;
    edit((item) => setQuestionType(item, type));
  }

  return (
    <li id={`entity-${question.id}`} className={open ? 'editor-question editor-question--open' : 'editor-question'}>
      <div className="editor-question__head">
        <button type="button" className="editor-question__toggle" aria-expanded={open} onClick={onToggle}>
          <span className="params__number">{index + 1}</span>
          <span className="editor-question__name">{title}</span>
          {failed && <span className="editor__failed" title="В вопросе есть ошибки" aria-label="В вопросе есть ошибки" />}
          <span className="badge">{question.type === 'single' ? 'Один ответ' : 'Несколько ответов'}</span>
          {inferredBy.length > 0 && <span className="badge badge--outline">Выводится правилом {inferredBy.map(ruleTitle).join(', ')}</span>}
        </button>
        <RowActions
          label={`вопрос ${index + 1}`}
          onUp={canUp ? () => update((draft) => moveQuestion(draft, question.id, -1)) : undefined}
          onDown={canDown ? () => update((draft) => moveQuestion(draft, question.id, 1)) : undefined}
          onRemove={remove}
        />
      </div>
      {open && (
        <div className="editor-question__body">
          <div className="form-grid">
            <TextField label="Текст вопроса" className="form-grid__wide" multiline rows={2} value={question.text} onChange={(value) => edit((item) => void (item.text = value))} />
            <TextField
              label="Название параметра"
              hint="Коротко: под этим именем ответ хранится в рабочей базе данных."
              value={question.parameter}
              onChange={(value) => edit((item) => void (item.parameter = value))}
            />
            <SelectField
              label="Сколько ответов"
              value={question.type}
              options={[
                { value: 'single', label: 'Один ответ' },
                { value: 'multiple', label: 'Несколько ответов' },
              ]}
              onChange={(value) => changeType(value === 'multiple' ? 'multiple' : 'single')}
            />
            <CheckboxField
              label="Ситуационная задача"
              className="form-grid__wide"
              checked={question.situational ?? false}
              onChange={(checked) =>
                edit((item) => {
                  if (checked) item.situational = true;
                  else delete item.situational;
                })
              }
            />
          </div>

          <OptionsTable question={question} edit={edit} update={update} />

          <details className="editor-details">
            <summary>Картинка и обоснование весов</summary>
            <div className="form-stack">
              <ImageField
                label="Картинка вопроса"
                image={question.image}
                onChange={(image) =>
                  edit((item) => {
                    if (image) item.image = image;
                    else delete item.image;
                  })
                }
              />
              <TextField
                label="Обоснование весов"
                hint="Для автора и тех, кто будет читать базу знаний. Тест этот текст не показывает."
                multiline
                value={question.note}
                onChange={(value) => edit((item) => void (item.note = value))}
              />
            </div>
          </details>

          <details className="editor-details">
            <summary>Картинки вариантов ответа</summary>
            <div className="form-stack">
              {question.options.map((option, optionIndex) => (
                <ImageField
                  key={option.id}
                  label={`Вариант ${optionIndex + 1}${option.text ? `: ${option.text}` : ''}`}
                  image={option.image}
                  onChange={(image) =>
                    edit((item) => {
                      const target = item.options.find((candidate) => candidate.id === option.id);
                      if (!target) return;
                      if (image) target.image = image;
                      else delete target.image;
                    })
                  }
                />
              ))}
            </div>
          </details>

          {base.groups.length > 0 && <ReasonsEditor question={question} edit={edit} />}
        </div>
      )}
    </li>
  );
}

interface OptionsTableProps {
  question: Question;
  edit: (change: (item: Question) => void) => void;
  update: UpdateBase;
}

/** Варианты ответа и их веса: правила «параметр + атрибут». */
function OptionsTable({ question, edit, update }: OptionsTableProps) {
  const confirm = useConfirm();
  const { base, attributeRuleOf } = useBase();

  const editOption = (id: string, change: (option: Option) => void) =>
    edit((item) => {
      const option = item.options.find((candidate) => candidate.id === id);
      if (option) change(option);
    });

  async function remove(option: Option, index: number) {
    const rules = rulesUsing(base, question.id, option.id);
    const lost = rulesLost(rules);
    const name = option.text ? `«${option.text}».` : '';
    const profiles = profilesAnswering(base, question.id, option.id);
    const answers = profiles.length > 0 ? `Этот ответ пропадёт из ${profilesPhrase(profiles)}.` : '';
    const yes = await confirm({ title: `Удалить вариант ${index + 1}?`, message: [name, lost, answers].filter(Boolean).join(' ') || undefined, action: 'Удалить' });
    if (yes) update((draft) => removeOption(draft, question.id, option.id));
  }

  return (
    <div className="editor-options">
      <p className="field__label">Варианты ответа и их веса</p>
      <div className="table-scroll">
        <table className="kb-table matrix">
          <thead>
            <tr>
              <th scope="col" className="matrix__sticky">
                Вариант
              </th>
              <th scope="col">Правило</th>
              {base.attributes.map((attribute) => (
                <th key={attribute.id} scope="col" className="kb-table__attr" title={attribute.title}>
                  {attributeLabel(attribute) || '—'}
                </th>
              ))}
              <th scope="col">
                <span className="visually-hidden">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {question.options.map((option, index) => (
              <tr key={option.id}>
                <th scope="row" className="matrix__sticky matrix__name">
                  <textarea
                    className="cell-input"
                    rows={2}
                    value={option.text}
                    maxLength={MAX_TEXT_LENGTH}
                    placeholder="Текст варианта"
                    aria-label={`Текст варианта ${index + 1}`}
                    onChange={(event) => editOption(option.id, (item) => void (item.text = event.target.value))}
                  />
                  {question.type === 'multiple' && (
                    <CheckboxField
                      label="Ничего из этого: снимает остальные отметки"
                      className="checkbox--small"
                      checked={option.exclusive ?? false}
                      onChange={(checked) =>
                        editOption(option.id, (item) => {
                          if (checked) item.exclusive = true;
                          else delete item.exclusive;
                        })
                      }
                    />
                  )}
                </th>
                <td>{attributeRuleOf(question.id, option.id)?.title ?? '—'}</td>
                {base.attributes.map((attribute) => {
                  const value = weight(option, attribute.id);
                  return (
                    <td key={attribute.id} className="matrix__cell">
                      <ScaleSelect
                        value={value}
                        min={WEIGHT_RANGE.min}
                        max={WEIGHT_RANGE.max}
                        tone={value > 0 ? 'weight--plus' : value < 0 ? 'weight--minus' : 'weight--zero'}
                        label={`Вариант ${index + 1}: вес атрибута ${attribute.title}`}
                        onChange={(next) => editOption(option.id, (item) => setWeight(item, attribute.id, next))}
                      />
                    </td>
                  );
                })}
                <td>
                  <RowActions
                    label={`вариант ${index + 1}`}
                    onUp={index > 0 ? () => edit((item) => moveItem(item.options, index, -1)) : undefined}
                    onDown={index < question.options.length - 1 ? () => edit((item) => moveItem(item.options, index, 1)) : undefined}
                    onRemove={() => remove(option, index)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="text-button editor-options__add" onClick={() => edit((item) => void item.options.push(newOption(item)))}>
        Добавить вариант
      </button>
    </div>
  );
}

/**
 * Фразы для объяснения итога. Показываются только для вариантов, дающих группе баллы: остальные
 * в объяснение не попадут. В вопросе с несколькими ответами можно задать общий шаблон на всю группу.
 */
function ReasonsEditor({ question, edit }: { question: Question; edit: (change: (item: Question) => void) => void }) {
  const { base } = useBase();
  const relevant = base.groups
    .map((group) => ({ group, options: question.options.filter((option) => weight(option, group.attribute) > 0) }))
    .filter(({ options }) => options.length > 0);

  const editOption = (id: string, change: (option: Option) => void) =>
    edit((item) => {
      const option = item.options.find((candidate) => candidate.id === id);
      if (option) change(option);
    });

  return (
    <details className="editor-details">
      <summary>Объяснения итога</summary>
      {relevant.length === 0 && <p className="field__hint">Ни один вариант не даёт баллов атрибутам групп, объяснять нечего.</p>}
      <div className="form-stack">
        {relevant.map(({ group, options }) => (
          <GroupReasons key={group.id} group={group} options={options} question={question} edit={edit} editOption={editOption} />
        ))}
      </div>
    </details>
  );
}

interface GroupReasonsProps {
  group: Group;
  options: Option[];
  question: Question;
  edit: (change: (item: Question) => void) => void;
  editOption: (id: string, change: (option: Option) => void) => void;
}

function GroupReasons({ group, options, question, edit, editOption }: GroupReasonsProps) {
  const template = question.reasonTemplate?.[group.id];
  return (
    <fieldset className="image-field">
      <legend className="field__label">Группа «{group.title}»</legend>
      <div className="form-stack">
        {question.type === 'multiple' && (
          <TextField
            label="Общее объяснение"
            hint="{options} заменится списком выбранных вариантов. Если задано, фразы вариантов не нужны."
            value={template ?? ''}
            onChange={(value) => edit((item) => setPhrase(item, 'reasonTemplate', group.id, value))}
          />
        )}
        {options.map((option) =>
          template ? (
            <TextField
              key={option.id}
              label={`Коротко о варианте «${option.text}»`}
              value={option.short ?? ''}
              onChange={(value) =>
                editOption(option.id, (item) => {
                  if (value) item.short = value;
                  else delete item.short;
                })
              }
            />
          ) : (
            <TextField
              key={option.id}
              label={`Почему вариант «${option.text}» говорит в пользу группы`}
              value={option.reasons?.[group.id] ?? ''}
              onChange={(value) => editOption(option.id, (item) => setPhrase(item, 'reasons', group.id, value))}
            />
          ),
        )}
      </div>
    </fieldset>
  );
}
