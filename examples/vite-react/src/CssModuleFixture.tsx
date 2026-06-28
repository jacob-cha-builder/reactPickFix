import styles from "./CssModuleFixture.module.css";

export function CssModuleFixture() {
  return (
    <section className={styles["card"]} data-testid="css-module-component">
      <h2 className={styles["title"]}>CSS module component</h2>
      <button className={styles["button"]} type="button">
        CSS module action
      </button>
    </section>
  );
}
