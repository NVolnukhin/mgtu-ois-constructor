import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { resolveCondition, useBase } from '../base.ts';
import { allQuestions, attributeLabel, level, ruleTitle } from '../engine/scoring.ts';
import { minAskedQuestions } from '../engine/validate.ts';
import type { Weights } from '../engine/types.ts';
import { plural, pluralWord } from '../plural.ts';
import { basePath } from '../router.ts';

type Tab = 'objects' | 'attributes' | 'groups' | 'parameters' | 'rules';

interface KnowledgeBaseScreenProps {
  returnPath: string;
}

/** Просмотр содержимого базы знаний. */
export function KnowledgeBaseScreen({ returnPath }: KnowledgeBaseScreenProps) {
  const { id, base, steps, ruleCount, builtIn } = useBase();
  const [tab, setTab] = useState<Tab>('objects');
  const titleRef = useRef<HTMLHeadingElement>(null);

  const tabs: { id: Tab; title: string }[] = [
    { id: 'objects', title: `Объекты (${base.objects.length})` },
    { id: 'attributes', title: `Атрибуты (${base.attributes.length})` },
    ...(base.groups.length > 0 ? [{ id: 'groups' as const, title: `Группы (${base.groups.length})` }] : []),
    { id: 'parameters', title: `Параметры (${steps.length})` },
    { id: 'rules', title: `Правила (${ruleCount})` },
  ];

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  /** Вкладки переключаются стрелками, как и положено элементу с ролью tablist. */
  function switchByKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((item) => item.id === tab);
    const positions: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    const position = positions[event.key];
    if (position === undefined) return;
    event.preventDefault();
    const next = tabs[(position + tabs.length) % tabs.length];
    setTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <article className="kb">
      <h1 ref={titleRef} tabIndex={-1} className="page__title">
        База знаний
      </h1>
      <p className="page__lead">
        База знаний хранится отдельно от программы и передаётся файлом JSON: объекты ранжирования с атрибутами, вопросы-параметры
        и {plural(ruleCount, ['правило', 'правила', 'правил'])} двух видов — «параметр + атрибут» и «параметр + параметр».{' '}
        {builtIn ? 'Это встроенный пример: посмотреть можно всё, а менять — только копию.' : <a href={basePath(id, 'edit')}>Изменить в редакторе</a>}
      </p>

      <div className="tabs" role="tablist" aria-label="Разделы базы знаний" onKeyDown={switchByKey}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'tab tab--active' : 'tab'}
            onClick={() => setTab(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
        {tab === 'objects' && <ObjectsTab />}
        {tab === 'attributes' && <AttributesTab />}
        {tab === 'groups' && <GroupsTab />}
        {tab === 'parameters' && <ParametersTab />}
        {tab === 'rules' && <RulesTab />}
      </div>

      <div className="actions">
        <a className="btn btn--secondary" href={returnPath}>
          Вернуться
        </a>
      </div>
    </article>
  );
}

function ObjectsTab() {
  const { base, groupById } = useBase();
  const hasAttributes = base.attributes.length > 0;
  const headRows = hasAttributes ? 2 : 1;
  return (
    <>
      <p className="tabpanel__lead">
        {plural(base.objects.length, ['объект', 'объекта', 'объектов'])} ранжирования. Число в ячейке — насколько выражен атрибут: 0 —
        нет, 3 — сильно.
      </p>
      <div className="table-scroll">
        <table className="kb-table">
          {/* Над столбцами атрибутов общая подпись «Атрибуты»: сразу видно, что числа — их выраженность у объекта. */}
          <colgroup span={2} />
          {hasAttributes && <colgroup span={base.attributes.length} />}
          <thead>
            <tr>
              <th scope="col" rowSpan={headRows}>
                №
              </th>
              <th scope="col" rowSpan={headRows} className="kb-table__name">
                Объект
              </th>
              {hasAttributes && (
                <th scope="colgroup" colSpan={base.attributes.length} className="kb-table__group">
                  Атрибуты
                </th>
              )}
            </tr>
            {hasAttributes && (
              <tr>
                {base.attributes.map((attribute) => (
                  <th key={attribute.id} scope="col" className="kb-table__attr" title={attribute.title}>
                    {attributeLabel(attribute)}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {base.objects.map((object, i) => (
              <tr key={object.id}>
                <td>{i + 1}</td>
                <th scope="row" className="kb-table__name">
                  {object.title}
                  {object.group && groupById[object.group] && <span className="kb-table__sub">{groupById[object.group].title}</span>}
                </th>
                {base.attributes.map(({ id }) => (
                  <td key={id} className={`lvl lvl--${level(object, id)}`}>
                    {level(object, id)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="kb-list">
        {base.objects
          .filter((object) => object.description)
          .map((object) => (
            <li key={object.id}>
              <strong>{object.title}.</strong> {object.description}
            </li>
          ))}
      </ol>
    </>
  );
}

function AttributesTab() {
  const { base } = useBase();
  return (
    <>
      <p className="tabpanel__lead">Важность — вес атрибута при сравнении профиля предпочтений с объектами.</p>
      <div className="table-scroll">
        <table className="kb-table kb-table--wide">
          <thead>
            <tr>
              <th scope="col">Атрибут</th>
              <th scope="col">Важность</th>
              {base.groups.length > 0 && <th scope="col">Группа</th>}
              <th scope="col">Что означает шкала 0–3</th>
            </tr>
          </thead>
          <tbody>
            {base.attributes.map((attribute) => (
              <tr key={attribute.id}>
                <th scope="row" className="kb-table__name">
                  {attribute.title}
                </th>
                <td>{attribute.importance}</td>
                {base.groups.length > 0 && <td>{base.groups.find((group) => group.attribute === attribute.id)?.title ?? '—'}</td>}
                <td>{attribute.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function GroupsTab() {
  const { base, attributeById } = useBase();
  return (
    <>
      <p className="tabpanel__lead">Группа связана с атрибутом: её итог — доля баллов этого атрибута от возможного максимума.</p>
      <div className="table-scroll">
        <table className="kb-table kb-table--wide">
          <thead>
            <tr>
              <th scope="col">Группа</th>
              <th scope="col">Атрибут</th>
              <th scope="col">Объектов</th>
              <th scope="col">Описание</th>
            </tr>
          </thead>
          <tbody>
            {base.groups.map((group) => (
              <tr key={group.id}>
                <th scope="row" className="kb-table__name">
                  {group.title}
                </th>
                <td>{attributeById[group.attribute]?.title ?? group.attribute}</td>
                <td>{base.objects.filter((object) => object.group === group.id).length}</td>
                <td>{group.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ParametersTab() {
  const { base, steps, attributeRuleOf } = useBase();
  const weights = allQuestions(base).flatMap((q) => q.options.flatMap((o) => Object.values(o.weights)));
  const lowest = weights.reduce((min, value) => Math.min(min, value), Infinity);
  const highest = weights.reduce((max, value) => Math.max(max, value), -Infinity);
  return (
    <>
      <p className="tabpanel__lead">
        Каждый вопрос — параметр рабочей базы данных. Вариант ответа с весами — правило «параметр + атрибут» (его номер стоит перед
        весами): ответ даёт атрибутам «преимущество»
        {weights.length > 0 && `, в этой базе от ${formatWeight(lowest)} до ${formatWeight(highest)}`}.
      </p>
      <ol className="params">
        {steps.map(({ question, index }) => {
          const rules = base.rules.filter((rule) => rule.then.question === question.id);
          return (
            <li key={question.id} className="params__item">
              <p className="params__head">
                <span className="params__number">{index + 1}</span>
                <span className="params__name">{question.parameter}</span>
                <span className="badge">{question.type === 'single' ? 'Один ответ' : 'Несколько ответов'}</span>
                {question.situational && <span className="badge badge--outline">Ситуационная задача</span>}
                {rules.length > 0 && (
                  <span className="badge badge--outline">Выводится правилом {rules.map(ruleTitle).join(', ')}</span>
                )}
              </p>
              <p className="params__text">{question.text}</p>
              <ul className="params__options">
                {question.options.map((option, optionIndex) => {
                  const rule = attributeRuleOf(question.id, option.id);
                  return (
                    <li key={option.id}>
                      <span className="params__option">
                        {optionLetter(optionIndex)}) {option.text}
                      </span>
                      <span className="params__weights">
                        {rule && <span className="rule-id">{rule.title}</span>}
                        <WeightChips weights={option.weights} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              {question.note && (
                <p className="rule__note">
                  <strong>Обоснование весов.</strong> {question.note}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function optionLetter(index: number): string {
  return index < 26 ? String.fromCharCode(97 + index) : String(index + 1);
}

function formatWeight(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : String(value);
}

function WeightChips({ weights }: { weights: Weights }) {
  const { base } = useBase();
  const shown = base.attributes.filter(({ id }) => weights[id]);
  if (shown.length === 0) return <span className="params__none">правила нет — баллов не даёт</span>;
  return (
    <span className="params__weights">
      {shown.map((attribute) => (
        <span key={attribute.id} className={weights[attribute.id] > 0 ? 'point point--plus' : 'point point--minus'}>
          {attributeLabel(attribute)} {weights[attribute.id] > 0 ? '+' : '−'}
          {Math.abs(weights[attribute.id])}
        </span>
      ))}
    </span>
  );
}

function RulesTab() {
  const compiled = useBase();
  const { base, steps, ruleCount, attributeRules, attributeRuleOf } = compiled;
  const groups = steps
    .map(({ question, index }) => ({ question, index, rules: attributeRules.filter((rule) => rule.question === question) }))
    .filter((group) => group.rules.length > 0);
  const silent = steps.reduce((n, { question }) => n + question.options.filter((o) => !attributeRuleOf(question.id, o.id)).length, 0);
  const inferredCount = new Set(base.rules.map((rule) => rule.then.question)).size;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <p className="tabpanel__lead">
        В базе знаний {plural(ruleCount, ['правило', 'правила', 'правил'])}:{' '}
        <button type="button" className="text-button text-button--inline" onClick={() => jump('rules-attribute')}>
          {attributeRules.length} «параметр + атрибут»
        </button>{' '}
        и{' '}
        <button type="button" className="text-button text-button--inline" onClick={() => jump('rules-parameter')}>
          {base.rules.length} «параметр + параметр»
        </button>
        .
      </p>

      <section className="section rules-section" id="rules-attribute">
        <h2 className="section__title">Правила «параметр + атрибут» ({attributeRules.length})</h2>
        <p className="section__lead">
          ЕСЛИ параметр получил значение, ТО атрибутам даётся «преимущество». Каждый вариант ответа с весами — одно правило. Заключения
          сработавших правил складываются в профиль предпочтений, по которому ранжируются объекты.
          {silent > 0 &&
            ` Ещё ${plural(silent, ['вариант', 'варианта', 'вариантов'])} без весов ${pluralWord(silent, ['правила не даёт', 'правил не дают', 'правил не дают'])}.`}
        </p>
        <ol className="rule-groups">
          {groups.map(({ question, index, rules }) => (
            <li key={question.id} className="rule-group">
              <p className="params__head">
                <span className="params__number">{index + 1}</span>
                <span className="params__name">{question.parameter}</span>
              </p>
              <ul className="rule-group__list">
                {rules.map((rule) => (
                  <li key={rule.title} className="arule">
                    <span className="rule-id">{rule.title}</span>
                    <span className="arule__line">
                      <span className="rule__keyword">ЕСЛИ</span> ответ «{rule.option.text}»
                    </span>
                    <span className="arule__line">
                      <span className="rule__keyword">ТО</span>
                      <WeightChips weights={rule.option.weights} />
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="section rules-section" id="rules-parameter">
        <h2 className="section__title">Правила «параметр + параметр» ({base.rules.length})</h2>
        <p className="section__lead">
          ЕСЛИ выполнены все условия, ТО система сама присваивает значение другому параметру, и этот вопрос пользователю уже не
          задаётся. Выведенное значение, как и ответ, срабатывает в правилах «параметр + атрибут» и может быть условием другого правила.
        </p>
        <ol className="rules">
          {base.rules.map((rule) => {
            const target = resolveCondition(compiled, rule.then);
            return (
              <li key={rule.id} className="rule">
                <span className="rule__title">{ruleTitle(rule)}</span>
                {rule.if.map((condition, index) => {
                  const source = resolveCondition(compiled, condition);
                  return (
                    <p key={index} className="rule__line">
                      <span className="rule__keyword">{index === 0 ? 'ЕСЛИ' : 'И'}</span> «{source.parameter}» = «{source.optionText}»
                    </p>
                  );
                })}
                <p className="rule__line">
                  <span className="rule__keyword">ТО</span> «{target.parameter}» = «{target.optionText}»
                </p>
                {rule.note && <p className="rule__note">{rule.note}</p>}
              </li>
            );
          })}
        </ol>
        {base.rules.length > 0 && (
          <p className="rules-why">
            Каждое такое правило снимает вопрос. Правила выводят {plural(inferredCount, ['параметр', 'параметра', 'параметров'])}, поэтому
            при {plural(steps.length, ['вопросе', 'вопросах', 'вопросах'])} задаётся не меньше {minAskedQuestions(base)}. Правило отвечает
            за пользователя, поэтому его стоит задавать только там, где вывод однозначен: вероятностные связи между ответами лучше
            учитывать правилами «параметр + атрибут».
          </p>
        )}
      </section>
    </>
  );
}
