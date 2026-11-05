import { HomeScreen } from './components/HomeScreen.tsx';
import { HOME_PATH, useRoute } from './router.ts';
import { EXAMPLE_ID, useStore } from './storage.ts';
import type { StorageProblem } from './storage.ts';
import { TestApp } from './TestApp.tsx';

const PROBLEM_TEXT: Record<StorageProblem, string> = {
  quota:
    'Не удалось сохранить: в хранилище браузера закончилось место. Изменения пока есть только в этой вкладке. Скачайте базу в JSON или удалите ненужные базы, и сохранение повторится.',
  unavailable:
    'Браузер не даёт сохранять данные (так бывает в приватном режиме). Изменения есть только в этой вкладке и пропадут при её закрытии: скачайте базу в JSON.',
};

export function App() {
  const route = useRoute();
  const { problem } = useStore();

  return (
    <>
      {problem && (
        <p className="banner" role="alert">
          {PROBLEM_TEXT[problem]}
        </p>
      )}
      {route.name === 'home' ? (
        <div className="app">
          <header className="topbar">
            <a className="brand" href={HOME_PATH}>
              <img className="brand__icon" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
              <span className="brand__name">Конструктор экспертных систем</span>
            </a>
          </header>
          <main className="main main--wide">
            <HomeScreen />
          </main>
        </div>
      ) : route.id === EXAMPLE_ID ? (
        <TestApp />
      ) : (
        <div className="app">
          <main className="main main--wide">
            <p>Прохождение теста этой базы появится на следующем шаге.</p>
            <a href={HOME_PATH}>На главную</a>
          </main>
        </div>
      )}
    </>
  );
}
