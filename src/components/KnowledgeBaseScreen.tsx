import { useEffect, useRef, useState } from 'react';
import { SPHERE_WEIGHT } from '../engine/scoring.ts';
import { ATTRIBUTE_IDS } from '../engine/types.ts';
import type { Weights } from '../engine/types.ts';
import { attributeById, attributeRuleList, attributeRuleOf, directionById, quiz, ruleCount, steps } from '../data.ts';
import { plural } from '../plural.ts';

type Tab = 'objects' | 'attributes' | 'parameters' | 'rules';

const TABS: { id: Tab; title: string }[] = [
  { id: 'objects', title: `Объекты (${quiz.objects.length})` },
  { id: 'attributes', title: `Атрибуты (${quiz.attributes.length})` },
  { id: 'parameters', title: `Параметры (${steps.length})` },
  { id: 'rules', title: `Правила (${ruleCount})` },
];

/** Требование задания: пользователю задаётся не меньше 20 вопросов при любых срабатываниях правил. */
const MIN_ASKED = 20;

interface KnowledgeBaseScreenProps {
  onClose: () => void;
}

/** Просмотр содержимого базы знаний — одно из обязательных требований к прототипу. */
export function KnowledgeBaseScreen({ onClose }: KnowledgeBaseScreenProps) {
  const [tab, setTab] = useState<Tab>('objects');
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article className="kb">
      <h1 ref={titleRef} tabIndex={-1} className="page__title">
        База знаний
      </h1>
      <p className="page__lead">
        База знаний хранится отдельно от программы, в файле <code>content/quiz.json</code>: объекты ранжирования с
        атрибутами, вопросы-параметры и {plural(ruleCount, ['правило', 'правила', 'правил'])} двух видов — «параметр +
        атрибут» и «параметр + параметр». Система читает её при запуске, поэтому базу можно менять, не трогая код.
      </p>

      <div className="tabs" role="tablist" aria-label="Разделы базы знаний">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
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
        {tab === 'parameters' && <ParametersTab />}
        {tab === 'rules' && <RulesTab />}
      </div>

      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Вернуться
        </button>
      </div>
    </article>
  );
}

function ObjectsTab() {
  return (
    <>
      <p className="tabpanel__lead">
        {plural(quiz.objects.length, ['вид', 'вида', 'видов'])} волонтёрской деятельности. Число в ячейке — насколько
        выражен атрибут: 0 — нет, 3 — сильно.
      </p>
      <div className="table-scroll">
        <table className="kb-table">
          <thead>
            <tr>
              <th scope="col">№</th>
              <th scope="col" className="kb-table__name">
                Вид деятельности
              </th>
              {ATTRIBUTE_IDS.map((id) => (
                <th key={id} scope="col" className="kb-table__attr" title={attributeById[id].title}>
                  {attributeById[id].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quiz.objects.map((object, i) => (
              <tr key={object.id}>
                <td>{i + 1}</td>
                <th scope="row" className="kb-table__name">
                  {object.title}
                  <span className="kb-table__sub">{directionById[object.direction].title}</span>
                </th>
                {ATTRIBUTE_IDS.map((id) => (
                  <td key={id} className={`lvl lvl--${object.attributes[id]}`}>
                    {object.attributes[id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="kb-list">
        {quiz.objects.map((object) => (
          <li key={object.id}>
            <strong>{object.title}.</strong> {object.description}
          </li>
        ))}
      </ol>
    </>
  );
}

function AttributesTab() {
  return (
    <div className="table-scroll">
      <table className="kb-table kb-table--wide">
        <thead>
          <tr>
            <th scope="col">Атрибут</th>
            <th scope="col">Группа</th>
            <th scope="col">Что означает шкала 0–3</th>
          </tr>
        </thead>
        <tbody>
          {quiz.attributes.map((attribute) => (
            <tr key={attribute.id}>
              <th scope="row" className="kb-table__name">
                {attribute.title}
                <span className="kb-table__sub">
                  <code>{attribute.id}</code>
                </span>
              </th>
              <td>{attribute.group === 'sphere' ? `Сфера, вес ${SPHERE_WEIGHT}` : 'Стиль, вес 1'}</td>
              <td>{attribute.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParametersTab() {
  return (
    <>
      <p className="tabpanel__lead">
        Каждый вопрос — параметр рабочей базы данных. Вариант ответа с весами — правило «параметр + атрибут» (его номер
        стоит перед весами): ответ даёт атрибутам «преимущество», для сфер от 0 до 3, для стиля от −2 до 3.
      </p>
      <ol className="params">
        {steps.map(({ question, index }) => {
          const rules = quiz.rules.filter((rule) => rule.then.question === question.id);
          return (
            <li key={question.id} className="params__item">
              <p className="params__head">
                <span className="params__number">{index + 1}</span>
                <span className="params__name">{question.parameter}</span>
                <span className="badge">{question.type === 'single' ? 'Один ответ' : 'Несколько ответов'}</span>
                {question.situational && <span className="badge badge--outline">Ситуационная задача</span>}
                {rules.length > 0 && (
                  <span className="badge badge--outline">Выводится правилом {rules.map((r) => r.title).join(', ')}</span>
                )}
              </p>
              <p className="params__text">{question.text}</p>
              <ul className="params__options">
                {question.options.map((option) => {
                  const rule = attributeRuleOf(question.id, option.id);
                  return (
                    <li key={option.id}>
                      <span className="params__option">
                        {option.id}) {option.text}
                      </span>
                      <span className="params__weights">
                        {rule && <span className="rule-id">{rule.title}</span>}
                        <WeightChips weights={option.weights} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function WeightChips({ weights }: { weights: Weights }) {
  const ids = ATTRIBUTE_IDS.filter((id) => weights[id]);
  if (ids.length === 0) return <span className="params__none">правила нет — баллов не даёт</span>;
  return (
    <span className="params__weights">
      {ids.map((id) => (
        <span key={id} className={weights[id]! > 0 ? 'point point--plus' : 'point point--minus'}>
          {attributeById[id].short} {weights[id]! > 0 ? '+' : '−'}
          {Math.abs(weights[id]!)}
        </span>
      ))}
    </span>
  );
}

function RulesTab() {
  const find = (questionId: string, optionId: string) => {
    const question = steps.find((s) => s.question.id === questionId)!.question;
    return { question, option: question.options.find((o) => o.id === optionId)! };
  };
  const groups = steps
    .map(({ question, index }) => ({ question, index, rules: attributeRuleList.filter((rule) => rule.question === question) }))
    .filter((group) => group.rules.length > 0);
  const silent = steps.reduce((n, { question }) => n + question.options.filter((o) => !attributeRuleOf(question.id, o.id)).length, 0);
  const inferredCount = new Set(quiz.rules.map((rule) => rule.then.question)).size;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <p className="tabpanel__lead">
        В базе знаний {plural(ruleCount, ['правило', 'правила', 'правил'])}:{' '}
        <button type="button" className="text-button text-button--inline" onClick={() => jump('rules-attribute')}>
          {attributeRuleList.length} «параметр + атрибут»
        </button>{' '}
        и{' '}
        <button type="button" className="text-button text-button--inline" onClick={() => jump('rules-parameter')}>
          {quiz.rules.length} «параметр + параметр»
        </button>
        .
      </p>

      <section className="section rules-section" id="rules-attribute">
        <h2 className="section__title">Правила «параметр + атрибут» ({attributeRuleList.length})</h2>
        <p className="section__lead">
          ЕСЛИ параметр получил значение, ТО атрибутам даётся «преимущество» — вес от −2 до 3. Каждый вариант ответа с
          весами — одно правило. Заключения сработавших правил складываются в профиль предпочтений, по которому ранжируются
          объекты. Ещё {plural(silent, ['вариант', 'варианта', 'вариантов'])} — отказы, «пока не знаю» и ошибочные решения
          ситуационных задач — правил не дают.
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
        <h2 className="section__title">Правила «параметр + параметр» ({quiz.rules.length})</h2>
        <p className="section__lead">
          ЕСЛИ параметр получил значение, ТО система сама присваивает значение другому параметру, и этот вопрос пользователю
          уже не задаётся. Выведенное значение, как и ответ, срабатывает в правилах «параметр + атрибут».
        </p>
        <ol className="rules">
          {quiz.rules.map((rule) => {
            const source = find(rule.if.question, rule.if.option);
            const target = find(rule.then.question, rule.then.option);
            return (
              <li key={rule.id} className="rule">
                <span className="rule__title">{rule.title}</span>
                <p className="rule__line">
                  <span className="rule__keyword">ЕСЛИ</span> «{source.question.parameter}» = «{source.option.text}»
                </p>
                <p className="rule__line">
                  <span className="rule__keyword">ТО</span> «{target.question.parameter}» = «{target.option.text}»
                </p>
                <p className="rule__note">{rule.note}</p>
              </li>
            );
          })}
        </ol>
        <p className="rules-why">
          <strong>Почему их {quiz.rules.length}.</strong> Каждое такое правило снимает вопрос, а задаваться должно не меньше{' '}
          {MIN_ASKED} вопросов. При {steps.length} вопросах правила могут выводить не больше{' '}
          {plural(steps.length - MIN_ASKED, ['параметра', 'параметров', 'параметров'])}, и сейчас выводятся{' '}
          {inferredCount}. Кроме того, правило отвечает за пользователя, поэтому оно задано только там, где вывод однозначен.
          Вероятностные связи между ответами учтены правилами «параметр + атрибут».
        </p>
      </section>
    </>
  );
}
