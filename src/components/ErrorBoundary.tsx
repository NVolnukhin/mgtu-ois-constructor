import { Component } from 'react';
import type { ReactNode } from 'react';
import { HOME_PATH } from '../router.ts';

interface ErrorBoundaryProps {
  /** Сменился экран — пробуем показать его снова. */
  resetKey: string;
  children: ReactNode;
}

/** База может прийти из чужого файла. Что бы ни случилось на экране, у человека остаётся выход на главную. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="main">
        <h1 className="page__title">Экран не открылся</h1>
        <p className="page__lead">Что-то пошло не так при показе этого экрана. Базы и ответы при этом не пострадали.</p>
        <div className="actions">
          <a className="btn btn--primary" href={HOME_PATH}>
            На главную
          </a>
        </div>
      </main>
    );
  }
}
