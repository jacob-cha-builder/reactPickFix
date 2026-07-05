export function ImportedFixture() {
  return (
    <section className="fixture-card imported-card" data-testid="imported-component">
      <div className="fixture-card-header">
        <p className="fixture-kicker">Imported component</p>
        <span className="fixture-badge fixture-badge-muted">Remote file</span>
      </div>
      <h2>Account health</h2>
      <p className="fixture-copy">Imported from a sibling file so PickFix can show cross-file context.</p>
      <dl className="fixture-definition-list">
        <div>
          <dt>Seats</dt>
          <dd>18 active</dd>
        </div>
        <div>
          <dt>Renewal</dt>
          <dd>34 days</dd>
        </div>
      </dl>
      <button type="button">Imported component action</button>
    </section>
  );
}
