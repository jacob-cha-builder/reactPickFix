export const overlayMarkup = `
<button type="button" class="pf-toggle" data-pickfix-toggle aria-pressed="false" aria-label="Toggle Pickfix overlay. Drag to move."><span class="pf-toggle-mark" aria-hidden="true">P</span><span class="pf-toggle-text">PickFix</span></button>
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
    <button type="button" class="pf-comment-add" data-pickfix-add-comment>Add comment</button>
    <ol class="pf-comment-list" data-pickfix-comment-list hidden></ol>
    <button type="submit" class="pf-copy" data-pickfix-copy-prompt>Create prompt</button>
    <label class="pf-prompt-output-field" data-pickfix-prompt-output-field hidden>Prompt<textarea data-pickfix-prompt-output rows="4" readonly></textarea></label>
    <div class="pf-fallback" data-pickfix-clipboard-fallback-region hidden>
      <label>Manual copy<textarea data-pickfix-clipboard-fallback rows="5" readonly></textarea></label>
      <button type="button" data-pickfix-clipboard-dismiss>Dismiss manual copy</button>
    </div>
    <p data-pickfix-prompt-status></p>
  </form>
</section>`;
