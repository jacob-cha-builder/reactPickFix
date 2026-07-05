export const overlayMarkup = `
<button type="button" class="pf-toggle" data-pickfix-toggle aria-pressed="false" aria-label="Toggle Pickfix overlay">Pickfix</button>
<div class="pf-outline pf-hover" data-pickfix-hover-outline hidden></div>
<div class="pf-outline pf-pinned" data-pickfix-pinned-outline hidden></div>
<div class="pf-comment-markers" data-pickfix-comment-markers hidden></div>
<section class="pf-panel" data-pickfix-panel aria-label="Pickfix selection" hidden>
  <header class="pf-header">
    <h2>PickFix</h2>
    <div class="pf-actions">
      <button type="button" data-pickfix-reset>Reset</button>
      <button type="button" data-pickfix-close aria-label="Close Pickfix panel">Close</button>
    </div>
  </header>
  <div class="pf-summary">
    <strong data-pickfix-component-name></strong>
    <code data-pickfix-source-location></code>
    <b data-pickfix-confidence></b>
    <p data-pickfix-reason></p>
  </div>
  <form class="pf-composer" data-pickfix-composer>
    <label class="pf-text-edit-field" data-pickfix-text-edit hidden>Text 수정<textarea data-pickfix-intent-text-replacement rows="2" placeholder="Edit selected text"></textarea></label>
    <label class="pf-comment-field" data-pickfix-comment-field>Comment<textarea data-pickfix-intent-text rows="2" placeholder="Change spacing, layout, or visual details"></textarea></label>
    <div class="pf-slider-field" data-pickfix-font-size-field hidden>
      <div class="pf-slider-head">
        <label for="pickfix-size-slider">Font size</label>
        <span data-pickfix-size-value>No change</span>
      </div>
      <input id="pickfix-size-slider" data-pickfix-intent-size type="range" min="-4" max="4" step="1" value="0">
    </div>
    <div class="pf-slider-field">
      <div class="pf-slider-head">
        <label for="pickfix-position-x-slider">Left / right</label>
        <span data-pickfix-position-x-value>No change</span>
      </div>
      <input id="pickfix-position-x-slider" data-pickfix-intent-position-x type="range" min="-80" max="80" step="4" value="0">
    </div>
    <div class="pf-slider-field">
      <div class="pf-slider-head">
        <label for="pickfix-position-y-slider">Up / down</label>
        <span data-pickfix-position-y-value>No change</span>
      </div>
      <input id="pickfix-position-y-slider" data-pickfix-intent-position-y type="range" min="-80" max="80" step="4" value="0">
    </div>
    <button type="button" class="pf-comment-add" data-pickfix-add-comment>Comment</button>
    <ol class="pf-comment-list" data-pickfix-comment-list hidden></ol>
    <button type="submit" class="pf-copy" data-pickfix-copy-prompt>Copy prompt</button>
    <label class="pf-prompt-output-field" data-pickfix-prompt-output-field hidden>Prompt<textarea data-pickfix-prompt-output rows="4" readonly></textarea></label>
    <div class="pf-fallback" data-pickfix-clipboard-fallback-region hidden>
      <label>Manual copy<textarea data-pickfix-clipboard-fallback rows="5" readonly></textarea></label>
      <button type="button" data-pickfix-clipboard-dismiss>Dismiss manual copy</button>
    </div>
    <p data-pickfix-prompt-status></p>
  </form>
</section>`;
