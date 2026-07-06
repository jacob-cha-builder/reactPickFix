export const overlayStyles = `
:root{--pf-surface-inspector:#fff;--pf-surface-raised:#f8fafc;--pf-text-primary:#111827;--pf-text-secondary:#475569;--pf-text-muted:#64748b;--pf-border-default:#cbd5e1;--pf-border-subtle:#e2e8f0;--pf-selection-outline:#2563eb;--pf-selection-pinned:#0f766e;--pf-focus-ring:#7c3aed;--pf-confidence-high:#15803d;--pf-confidence-medium:#b45309;--pf-confidence-low:#b91c1c;--pf-accent-action:#2563eb;--pf-accent-action-hover:#1d4ed8;--pf-depth-border:1px solid rgba(15,23,42,.14);--pf-depth-shadow:0 18px 50px rgba(15,23,42,.18);--pf-space-1:4px;--pf-space-2:8px;--pf-space-3:12px;--pf-space-4:16px}
#pickfix-overlay-root{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--pf-text-primary);position:relative;z-index:2147483647}
[data-pickfix-cursor-target],[data-pickfix-cursor-target] *{cursor:pointer!important}
.pf-toggle{align-items:center;display:inline-flex;justify-content:center;position:fixed;right:var(--pf-space-4);top:var(--pf-space-4);z-index:2147483647;box-sizing:border-box;height:44px;min-width:44px;border:var(--pf-depth-border);border-radius:999px;background:var(--pf-surface-inspector);box-shadow:var(--pf-depth-shadow);color:var(--pf-text-primary);cursor:grab;font-size:13px;font-weight:750;padding:0;touch-action:none;user-select:none;transition:background .1s ease-out,border-color .1s ease-out,color .1s ease-out,transform .1s ease-out}
.pf-toggle-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:var(--pf-accent-action);color:#fff;font-size:15px;font-weight:800;line-height:1}
.pf-toggle-text{clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;overflow:hidden;position:absolute;white-space:nowrap;width:1px}
.pf-toggle[aria-pressed='true']{background:var(--pf-accent-action);border-color:var(--pf-accent-action);color:#fff}
.pf-toggle[aria-pressed='true'] .pf-toggle-mark{background:#fff;color:var(--pf-accent-action)}
.pf-toggle:hover{border-color:var(--pf-accent-action);color:var(--pf-accent-action-hover)}
.pf-toggle[aria-pressed='true']:hover{color:#fff}
.pf-toggle:active,.pf-toggle[data-dragging='true']{cursor:grabbing;transform:translateY(1px)}
.pf-toggle[data-dragging='true']{transition:none}
.pf-toggle:focus-visible,.pf-panel button:focus-visible,.pf-composer textarea:focus-visible,.pf-composer input:focus-visible{outline:2px solid var(--pf-focus-ring);outline-offset:2px}
.pf-outline{position:fixed;box-sizing:border-box;pointer-events:none;border-radius:6px;transition:opacity .1s ease-out,transform .1s ease-out;z-index:2147483646}
.pf-hover{outline:2px solid var(--pf-selection-outline);box-shadow:0 0 0 3px rgba(37,99,235,.18)}
.pf-pinned{outline:3px solid var(--pf-selection-pinned);box-shadow:0 0 0 4px rgba(15,118,110,.22),0 0 0 1px rgba(255,255,255,.9)}
.pf-comment-markers{position:fixed;inset:0;z-index:2147483647;pointer-events:none}
.pf-comment-marker{position:fixed;display:grid;place-items:center;width:20px;height:20px;border:2px solid #fff;border-radius:999px;background:var(--pf-accent-action);box-shadow:0 6px 18px rgba(15,23,42,.24);color:#fff;font-size:11px;font-weight:750;line-height:1}
.pf-panel{position:fixed;z-index:2147483647;width:min(360px,calc(100vw - 16px));max-height:min(400px,calc(100dvh - 16px));overflow:auto;box-sizing:border-box;border:var(--pf-depth-border);border-radius:8px;background:var(--pf-surface-inspector);box-shadow:var(--pf-depth-shadow);padding:var(--pf-space-2);font-size:13px;line-height:1.4;pointer-events:none;animation:pf-enter .15s ease-out}
.pf-header{align-items:center;display:flex;gap:var(--pf-space-2);justify-content:space-between;margin:0 0 var(--pf-space-1)}
.pf-header h2{font-size:15px;font-weight:650;line-height:1.35;margin:0}
.pf-actions{display:flex;gap:var(--pf-space-1)}
.pf-panel button{min-height:28px;border:1px solid var(--pf-border-default);border-radius:6px;background:var(--pf-surface-raised);color:var(--pf-text-primary);cursor:pointer;font:inherit;font-size:12px;font-weight:600;padding:0 var(--pf-space-2)}
.pf-panel button,.pf-panel input,.pf-panel textarea{pointer-events:auto}
.pf-panel button:hover{border-color:var(--pf-accent-action);color:var(--pf-accent-action-hover)}
.pf-summary{display:grid;gap:1px;border-block:1px solid var(--pf-border-subtle);padding:6px 0;min-width:0}
.pf-summary strong{font-size:13px;font-weight:650;overflow-wrap:anywhere}
.pf-summary code{color:var(--pf-text-secondary);font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:11px;line-height:1.35;overflow-wrap:anywhere}
.pf-summary p{color:var(--pf-text-muted);font-size:11px;margin:0;overflow-wrap:anywhere}
.pf-summary b,.pf-summary p{clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;overflow:hidden;position:absolute;white-space:nowrap;width:1px}
.pf-summary b{border-radius:999px;color:#fff;font-size:10px;font-weight:700;justify-self:start;line-height:1.2;padding:2px var(--pf-space-1);text-transform:uppercase}
.pf-summary b[data-confidence='high']{background:var(--pf-confidence-high)}
.pf-summary b[data-confidence='medium']{background:var(--pf-confidence-medium)}
.pf-summary b[data-confidence='low']{background:var(--pf-confidence-low)}
.pf-fallback{display:grid;gap:var(--pf-space-1);border-radius:6px;background:var(--pf-surface-raised);box-sizing:border-box;padding:var(--pf-space-2);min-width:0}
.pf-fallback[hidden]{display:none}
.pf-composer{display:grid;align-items:end;grid-template-columns:1fr;gap:6px;margin-top:var(--pf-space-2)}
.pf-composer label,.pf-slider-head label{color:var(--pf-text-secondary);display:grid;font-size:12px;font-weight:650;gap:var(--pf-space-1)}
.pf-composer label,.pf-slider-head label{pointer-events:none}
.pf-text-edit-field{grid-column:1/-1}
.pf-text-edit-field[hidden]{display:none}
.pf-comment-field{grid-column:1/-1}
.pf-composer textarea{box-sizing:border-box;width:100%;border:1px solid var(--pf-border-default);border-radius:6px;background:var(--pf-surface-raised);color:var(--pf-text-primary);font:inherit;font-size:12px;line-height:1.4;padding:var(--pf-space-2);resize:vertical}
.pf-composer textarea::placeholder{color:var(--pf-text-muted)}
.pf-comment-add{grid-column:1/-1;width:100%;min-height:34px!important;border-color:var(--pf-accent-action)!important;background:var(--pf-surface-inspector)!important;color:var(--pf-accent-action)!important;font-weight:750!important}
.pf-comment-list{display:grid;grid-column:1/-1;gap:var(--pf-space-1);margin:0;padding:0;list-style:none;max-height:84px;overflow:auto;overscroll-behavior:contain}
.pf-comment-list[hidden]{display:none}
.pf-comment-list li{align-items:start;display:grid;grid-template-columns:minmax(0,1fr) 20px;gap:var(--pf-space-1);border-radius:6px;background:var(--pf-surface-raised);color:var(--pf-text-primary);font-size:12px;line-height:1.35;padding:6px var(--pf-space-2);overflow-wrap:anywhere}
.pf-comment-list span{min-width:0;overflow-wrap:anywhere}
.pf-comment-delete{align-self:start;min-height:18px!important;width:18px;border-radius:999px!important;font-size:11px!important;line-height:1!important;padding:0!important}
.pf-copy{grid-column:1/-1;width:100%;min-height:36px!important;background:var(--pf-accent-action)!important;border-color:var(--pf-accent-action)!important;color:#fff!important;font-size:13px!important;font-weight:800!important}
.pf-copy:hover{background:var(--pf-accent-action-hover)!important;border-color:var(--pf-accent-action-hover)!important;color:#fff!important}
.pf-prompt-output-field{grid-column:1/-1}
.pf-prompt-output-field[hidden]{display:none}
.pf-prompt-output-field textarea{font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;min-height:72px;resize:vertical}
.pf-fallback{grid-column:1/-1;margin-top:var(--pf-space-1)}
.pf-composer p{grid-column:1/-1;color:var(--pf-text-muted);font-size:12px;margin:0;min-height:17px;overflow-wrap:anywhere}
@media (max-width:480px){.pf-toggle{height:40px;min-width:40px;right:var(--pf-space-3);top:var(--pf-space-3)}.pf-toggle-mark{height:28px;width:28px}}
@media (prefers-reduced-motion:reduce){.pf-panel,.pf-outline{animation:none;transition:none}}
@keyframes pf-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
`;
