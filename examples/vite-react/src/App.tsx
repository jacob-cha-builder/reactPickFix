import { useState } from "react";
import { createPortal } from "react-dom";
import { CssModuleFixture } from "./CssModuleFixture";
import { ImportedFixture } from "./ImportedFixture";
import "./styles.css";

const repeatedItems = ["Alpha", "Beta", "Gamma"] as const;

function FunctionFixture() {
  return (
    <section className="fixture-card" data-testid="function-component">
      <h2>Function component</h2>
      <button type="button">Function component action</button>
    </section>
  );
}

function UtilityClassFixture() {
  return (
    <section className="fixture-card u-inline-stack" data-testid="utility-class-component">
      <h2>Utility-class component</h2>
      <button className="u-accent-button" type="button">
        Utility action
      </button>
    </section>
  );
}

function RepeatedListFixture() {
  return (
    <section className="fixture-card" aria-labelledby="repeated-list-heading">
      <h2 id="repeated-list-heading">Repeated list item component</h2>
      <ul className="fixture-list">
        {repeatedItems.map((item) => (
          <li className="fixture-list-item" data-testid="repeated-list-item" key={item}>
            <span>Repeated item {item}</span>
            <button type="button">Select {item}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PortalModalFixture() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="fixture-card" data-testid="portal-host-component">
      <h2>Portal host component</h2>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open portal modal
      </button>
      {isOpen
        ? createPortal(
            <div
              aria-labelledby="portal-modal-title"
              className="portal-backdrop"
              data-testid="portal-modal-component"
              role="dialog"
            >
              <div className="portal-panel">
                <h2 id="portal-modal-title">Portal modal component</h2>
                <p>This dialog renders through a React portal.</p>
                <button type="button" onClick={() => setIsOpen(false)}>
                  Close portal modal
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

export function App() {
  function NestedFixture() {
    return (
      <section className="fixture-card" data-testid="nested-component">
        <h2>Nested component</h2>
        <button type="button">Nested component action</button>
      </section>
    );
  }

  return (
    <main className="fixture-shell">
      <header className="fixture-header">
        <p className="eyebrow">Pickfix QA surface</p>
        <h1>Pickfix Vite React fixture</h1>
      </header>
      <div className="fixture-grid">
        <FunctionFixture />
        <NestedFixture />
        <ImportedFixture />
        <CssModuleFixture />
        <UtilityClassFixture />
        <PortalModalFixture />
        <RepeatedListFixture />
      </div>
    </main>
  );
}
