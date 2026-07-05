import styles from "./CssModuleFixture.module.css";

export function CssModuleFixture() {
  return (
    <section className={styles["card"]} data-testid="css-module-component">
      <p className={styles["kicker"]}>CSS module component</p>
      <h2 className={styles["title"]}>Theme package</h2>
      <p className={styles["copy"]}>This panel uses CSS Modules to verify class-name transforms.</p>
      <button className={styles["button"]} type="button">
        CSS module action
      </button>
    </section>
  );
}
