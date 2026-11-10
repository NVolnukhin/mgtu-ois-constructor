import { useEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { EDITOR_SECTIONS } from '../editor/sections.ts';
import { IMPORTANCE_MAX, VALUE_RANGE, WEIGHT_RANGE } from '../engine/validate.ts';
import type { IssueSection } from '../engine/validate.ts';
import { helpPath } from '../router.ts';
import type { HelpTopic } from '../router.ts';

const TOPICS: { id: HelpTopic; title: string }[] = [
  { id: 'parts', title: 'Из чего состоит база' },
  { id: 'rules', title: 'Правила' },
  { id: 'result', title: 'Как получается результат' },
  { id: 'create', title: 'Как собрать свою базу' },
  { id: 'profiles', title: 'Тестовые профили' },
  { id: 'json', title: 'Скачать и загрузить JSON' },
  { id: 'storage', title: 'Где хранятся базы' },
];

/** Что заполнить в каждом разделе редактора. Названия разделов берутся из самого редактора. */
const EDITOR_STEPS: Record<IssueSection, string> = {
  general: 'название, описание, автор и, если нужно, картинка по ссылке.',
  attributes: 'признаки, по которым объекты сравниваются с ответами, и важность каждого.',
  groups: 'группы и атрибут каждой из них, если группы нужны.',
  objects: `что система ранжирует и свойства каждого объекта от ${VALUE_RANGE.min} до ${VALUE_RANGE.max}.`,
  questions: 'блоки, вопросы и варианты ответа. Вариант с весами — это правило «параметр + атрибут».',
  rules: 'правила «параметр + параметр», если они нужны.',
  settings: 'сколько лучших объектов показывать после ответа, пороги итога, как называть группы и результат.',
};

/** Пример для таблицы объектов: небольшая база о выборе питомца. */
const EXAMPLE_ATTRIBUTES = ['Активность', 'Общение', 'Компактность'];
const EXAMPLE_OBJECTS: { title: string; values: number[] }[] = [
  { title: 'Собака', values: [3, 3, 0] },
  { title: 'Кошка', values: [1, 2, 2] },
  { title: 'Рыбки', values: [0, 0, 3] },
];
const EXAMPLE_RULES: { id: string; option: string; weights: [string, number][] }[] = [
  { id: 'А1', option: 'Час и больше', weights: [['Активность', 3], ['Общение', 1]] },
  { id: 'А2', option: 'Минут двадцать', weights: [['Активность', 1], ['Компактность', 1]] },
  { id: 'А3', option: 'Гулять не готов', weights: [['Общение', -1], ['Компактность', 3]] },
];

/** Отрицательное число с настоящим минусом, а не дефисом. */
function signed(value: number): string {
  return value < 0 ? `−${-value}` : String(value);
}

function scrollToTopic(topic: string): boolean {
  const heading = document.getElementById(`help-${topic}`);
  if (!heading) return false;
  heading.scrollIntoView({ block: 'start' });
  heading.focus({ preventScroll: true });
  return true;
}

/** Инструкция: как устроена база, как её собрать, проверить и передать. */
export function HelpScreen({ topic }: { topic?: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Пришли по ссылке на раздел — показываем его. Иначе, и если такого раздела нет, — начало страницы.
  useEffect(() => {
    if (topic && scrollToTopic(topic)) return;
    if (topic) window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, [topic]);

  /** Повторный щелчок по разделу, открытому сейчас, адрес не меняет: прокручиваем сами. */
  function again(event: MouseEvent<HTMLAnchorElement>, id: HelpTopic) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || location.hash !== helpPath(id)) return;
    event.preventDefault();
    scrollToTopic(id);
  }

  return (
    <article className="help">
      <h1 ref={titleRef} tabIndex={-1} className="page__title">
        Инструкция
      </h1>
      <p className="page__lead">
        Экспертная система задаёт вопросы, после каждого ответа ранжирует объекты, а в конце показывает весь рейтинг, объясняет его и, если заданы
        группы, называет итог. Механизм вывода один на все базы, а атрибуты, объекты, вопросы и правила задаёт автор базы. Примеры ниже — из небольшой
        базы о выборе питомца.
      </p>

      <nav className="help-toc" aria-label="Разделы инструкции">
        <ol>
          {TOPICS.map((item) => (
            <li key={item.id}>
              <a href={helpPath(item.id)} onClick={(event) => again(event, item.id)}>
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Topic id="parts">
        <dl className="help-terms">
          <div>
            <dt>Атрибуты</dt>
            <dd>
              Признаки, по которым система сравнивает ответы человека с объектами: «Активность», «Общение», «Компактность». У атрибута есть важность
              от 0 до {IMPORTANCE_MAX}: чем она больше, тем сильнее атрибут влияет на сравнение.
            </dd>
          </div>
          <div>
            <dt>Объекты</dt>
            <dd>
              То, что система ранжирует: собака, кошка, рыбки. Свойства объекта — насколько у него выражен каждый атрибут, от {VALUE_RANGE.min} (нет)
              до {VALUE_RANGE.max} (сильно).
            </dd>
          </div>
          <div>
            <dt>Группы</dt>
            <dd>
              Необязательны. Группа связана с одним атрибутом: «Активные питомцы» — с «Активностью». Без групп итогом становится лидер рейтинга.
            </dd>
          </div>
          <div>
            <dt>Вопросы</dt>
            <dd>
              Параметры, которые сообщает человек. Вопрос допускает один ответ или несколько, и тогда у него может быть вариант «Ничего из этого».
              Вопросы разложены по блокам.
            </dd>
          </div>
          <div>
            <dt>Правила</dt>
            <dd>Связывают ответы с атрибутами и с другими ответами. Их два вида, о них — в следующем разделе.</dd>
          </div>
          <div>
            <dt>Тестовые профили</dt>
            <dd>Выдуманные люди с готовыми ответами и ожидаемым результатом: проверяют, что база работает так, как задумано.</dd>
          </div>
        </dl>

        <p>Так свойства объектов выглядят на экране «База знаний», во вкладке «Объекты»:</p>
        <div className="table-scroll help-table">
          <table className="kb-table">
            <colgroup span={1} />
            <colgroup span={EXAMPLE_ATTRIBUTES.length} />
            <thead>
              <tr>
                <th scope="col" rowSpan={2} className="kb-table__name">
                  Объект
                </th>
                <th scope="colgroup" colSpan={EXAMPLE_ATTRIBUTES.length} className="kb-table__group">
                  Атрибуты
                </th>
              </tr>
              <tr>
                {EXAMPLE_ATTRIBUTES.map((title) => (
                  <th key={title} scope="col" className="kb-table__attr">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_OBJECTS.map((object) => (
                <tr key={object.title}>
                  <th scope="row" className="kb-table__name">
                    {object.title}
                  </th>
                  {object.values.map((value, index) => (
                    <td key={EXAMPLE_ATTRIBUTES[index]} className={`lvl lvl--${value}`}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Topic>

      <Topic id="rules">
        <h3 className="help__subtitle">«Параметр + атрибут» (А1, А2, …)</h3>
        <p>
          ЕСЛИ человек выбрал вариант ответа, ТО атрибуты получают его веса — целые числа от {signed(WEIGHT_RANGE.min)} до {WEIGHT_RANGE.max}. Плюс — ответ
          говорит в пользу атрибута, минус — против. Каждый вариант с весами — одно правило, номера А1, А2, … система ставит сама. Задаются эти правила
          в редакторе, в разделе «Вопросы», прямо у вариантов ответа.
        </p>
        <div className="rule-group help-example">
          <p className="params__head">
            <span className="params__name">Вопрос «Прогулки»</span>
          </p>
          <ul className="rule-group__list">
            {EXAMPLE_RULES.map((rule) => (
              <li key={rule.id} className="arule">
                <span className="rule-id">{rule.id}</span>
                <span className="arule__line">
                  <span className="rule__keyword">ЕСЛИ</span> ответ «{rule.option}»
                </span>
                <span className="arule__line">
                  <span className="rule__keyword">ТО</span>
                  <span className="params__weights">
                    {rule.weights.map(([attribute, value]) => (
                      <span key={attribute} className={value > 0 ? 'point point--plus' : 'point point--minus'}>
                        {attribute} {value > 0 ? '+' : '−'}
                        {Math.abs(value)}
                      </span>
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <h3 className="help__subtitle">«Параметр + параметр» (П1, П2, …)</h3>
        <p>
          ЕСЛИ выполнены все условия, ТО система сама ставит ответ на другой вопрос, и этот вопрос человеку уже не задаётся. Задаются эти правила в
          редакторе, в разделе «Правила».
        </p>
        <div className="rule help-example">
          <span className="rule__title">П1</span>
          <p className="rule__line">
            <span className="rule__keyword">ЕСЛИ</span> «Жильё» = «Маленькая комната»
          </p>
          <p className="rule__line">
            <span className="rule__keyword">ТО</span> «Размер» = «Небольшого»
          </p>
          <p className="rule__note">Крупному питомцу в маленькой комнате тесно.</p>
        </div>
        <ul className="list help__list">
          <li>Условий может быть несколько, они работают через И. ИЛИ — это два отдельных правила.</li>
          <li>Условия стоят раньше выводимого вопроса, поэтому циклов не бывает.</li>
          <li>
            Выведенный ответ работает как обычный: срабатывают его правила «параметр + атрибут», и он может быть условием следующего правила. Так
            получаются цепочки.
          </li>
          <li>
            Каждое такое правило отвечает за человека и снимает вопрос. Задавайте его только там, где вывод однозначен, а мягкие связи между ответами
            выражайте правилами «параметр + атрибут».
          </li>
        </ul>
      </Topic>

      <Topic id="result">
        <ol className="steps help__steps">
          <li>Человек отвечает на вопрос. Правила «параметр + параметр» дописывают ответы, которые следуют из уже данных.</li>
          <li>Правила «параметр + атрибут» всех выбранных и выведенных вариантов складывают веса по каждому атрибуту.</li>
          <li>
            Сумма по атрибуту переводится в предпочтение: 0&nbsp;%, если все ответы были против атрибута, 100&nbsp;% — если все за. Вместе они
            составляют профиль предпочтений человека.
          </li>
          <li>
            Профиль сравнивается со свойствами каждого объекта сразу по всем атрибутам с учётом их важности (косинусная мера сходства). Так получается
            совпадение в процентах, и по нему объекты выстраиваются в рейтинг. Рейтинг обновляется после каждого ответа.
          </li>
          <li>
            Если в базе есть группы, в конце система называет итог: группу, чей атрибут набрал наибольшую долю от возможного максимума. Если второе
            место близко, показываются обе группы, а если даже лучшая набрала мало, итог помечается как слабо выраженный. Пороги задаются в
            «Настройках».
          </li>
        </ol>
        <p>
          Например, кто готов гулять час и больше и хочет крупного питомца, набирает «Активность» и почти не набирает «Компактность», поэтому первой
          у него окажется собака. А тому, кто живёт в маленькой комнате, вопрос о размере питомца не зададут. Правило П1 само ответит «Небольшого»,
          и сработает правило «параметр + атрибут» этого ответа — «Компактность» +3.
        </p>
        <p className="note">
          Расчёт по своим ответам виден на экране результата в разделе «Как считается результат», а ответы, сработавшие правила и профиль
          предпочтений — на экране «Рабочая БД».
        </p>
      </Topic>

      <Topic id="create">
        <ol className="steps help__steps">
          <li>
            На главной нажмите «Создать базу» — откроется редактор. Можно начать и с копии примера: кнопка «Сделать копию для редактирования».
          </li>
          {EDITOR_SECTIONS.map((section) => (
            <li key={section.id}>
              <b>«{section.title}»</b>: {EDITOR_STEPS[section.id]}
            </li>
          ))}
          <li>Откройте «Проверку». Пока в базе есть ошибки, тест не запускается. Там же видно, выполнены ли требования ДЗ.</li>
          <li>Пройдите тест сами и сохраните удачные результаты как тестовые профили.</li>
        </ol>
        <p className="note">
          Изменения сохраняются сразу, отдельной кнопки «Сохранить» нет. Отменить правку нельзя, поэтому перед большими изменениями скачайте JSON.
        </p>
      </Topic>

      <Topic id="profiles">
        <p>
          Тестовый профиль — автотест для базы: выдуманный человек с готовыми ответами и тем, что система должна ему показать. Ожидать можно, что:
        </p>
        <ul className="list help__list">
          <li>итог окажется одной из выбранных групп;</li>
          <li>хотя бы один из выбранных объектов попадёт в тройку лидеров;</li>
          <li>второе место будет почти равно первому или заметно отстанет;</li>
          <li>итог будет слабо выраженным или выраженным.</li>
        </ul>
        <p>
          На экране «Проверка» система сама прогоняет все профили и показывает, сколько из них проходят. Если после правки базы профиль перестал
          проходить, значит, правила разошлись с задуманным: поправьте их или ожидание.
        </p>
        <p>
          Профили — часть базы: они хранятся в браузере вместе с ней и попадают в файл JSON при скачивании. Создать профиль можно двумя способами:
        </p>
        <ul className="list help__list">
          <li>
            на экране «Проверка» кнопкой «Добавить профиль»: имя, ответы и ожидания задаются вручную, а вопросы, которые выводит правило, отвечать не
            нужно;
          </li>
          <li>пройти тест и на экране результата нажать «Сохранить как тестовый профиль»: сегодняшний результат станет ожиданием на будущее.</li>
        </ul>
        <p className="note">У встроенного примера профили только для просмотра. Чтобы их менять, сделайте копию примера.</p>
      </Topic>

      <Topic id="json">
        <dl className="help-terms">
          <div>
            <dt>Скачать</dt>
            <dd>
              Кнопка «Скачать JSON» есть на карточке базы на главной и в редакторе. В файле вся база: атрибуты, объекты, вопросы, правила, настройки и
              тестовые профили. Картинки в файл не встраиваются, в нём только ссылки на них.
            </dd>
          </div>
          <div>
            <dt>Загрузить</dt>
            <dd>
              На главной нажмите «Импорт JSON» и выберите файл. Импорт всегда создаёт новую базу и ничего не перезаписывает. Она сразу открывается
              как тест, а редактор — по кнопке.
            </dd>
          </div>
          <div>
            <dt>Если файл не подходит</dt>
            <dd>
              Импорт откажет, если файл повреждён или в нём есть ссылки на несуществующее, и покажет, что не так. Остальные ошибки файл не
              останавливают: база откроется, и их можно поправить в редакторе.
            </dd>
          </div>
        </dl>
      </Topic>

      <Topic id="storage">
        <ul className="list help__list">
          <li>
            Сервера нет: базы хранятся в браузере, и всё считается прямо в нём. Поэтому сайтом могут одновременно пользоваться сколько угодно
            человек.
          </li>
          <li>
            База есть только в том браузере, где её создали. Чтобы продолжить на другом компьютере или передать базу, скачайте JSON и импортируйте его
            там.
          </li>
          <li>После очистки данных браузера или закрытия окна инкогнито базы пропадут. Храните JSON как резервную копию.</li>
          <li>На общем компьютере базы видит каждый, кто откроет сайт в том же браузере. Закончив работу, скачайте базу и удалите её.</li>
          <li>
            Место в браузере ограничено: около 5&nbsp;МБ, и на github.io оно общее для всех сайтов аккаунта. Сколько занято, видно на главной под
            списком баз.
          </li>
        </ul>
      </Topic>
    </article>
  );
}

/** Раздел инструкции: заголовок с якорем, к которому ведут ссылки с других экранов. */
function Topic({ id, children }: { id: HelpTopic; children: ReactNode }) {
  const title = TOPICS.find((item) => item.id === id)?.title;
  return (
    <section className="section help__section" aria-labelledby={`help-${id}`}>
      <h2 id={`help-${id}`} tabIndex={-1} className="section__title help__title">
        {title}
      </h2>
      {children}
    </section>
  );
}
