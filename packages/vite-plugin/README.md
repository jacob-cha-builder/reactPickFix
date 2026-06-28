# @pickfix/vite-plugin

PickFix is a Vite dev-server plugin for React projects. It injects a local-only component inspector during `vite serve`, maps selected DOM elements to source metadata, and prepares scoped prompts for Claude, Codex, or another coding agent.

The package is dev-only. It helps copy prompt text from your browser; it does not run Claude or Codex in the browser.

## Install From This GitHub Repo

Until this package is published to the public npm registry, build and pack it from the repository:

```bash
git clone https://github.com/jacob-cha-builder/pickfix.git
cd pickfix
npm install
npm run build --workspace packages/vite-plugin
npm pack --workspace packages/vite-plugin
```

Then install the generated tarball in your React/Vite app:

```bash
cd /path/to/your-vite-react-app
npm install -D /path/to/pickfix/pickfix-vite-plugin-0.1.0.tgz
```

Windows PowerShell:

```powershell
cd C:\path\to\your-vite-react-app
npm install -D C:\path\to\pickfix\pickfix-vite-plugin-0.1.0.tgz
```

## Install From npm

Use this command after `@pickfix/vite-plugin` is published to npm:

```bash
npm install -D @pickfix/vite-plugin
```

## Vite Config

```ts
import react from "@vitejs/plugin-react";
import { pickfix } from "@pickfix/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), pickfix()],
});
```

## Usage

Run your Vite dev server:

```bash
npm run dev
```

Open the local app URL printed by Vite, activate the PickFix inspector, hover to inspect a React component, click to select it, add your comment or intent, then choose one of the copy actions:

- `Copy prompt` copies a generic component-scoped prompt.
- `Copy Claude prompt` copies the same context with a Claude-oriented header.
- `Copy Codex command` copies a shell command string for Codex CLI use.

Paste the Claude prompt into Claude manually. For Codex CLI, click `Copy prompt`, then pipe the clipboard into Codex from the app root:

```bash
pbpaste | codex exec "Apply this component-scoped change. Follow the verification instructions in the prompt."
```

```bash
xclip -selection clipboard -o | codex exec "Apply this component-scoped change. Follow the verification instructions in the prompt."
```

```powershell
Get-Clipboard | codex exec "Apply this component-scoped change. Follow the verification instructions in the prompt."
```

The prompt includes selected source context, nearby styles, DOM snapshot, package scripts, confidence, your requested change, and verification instructions.

## Security And Privacy

PickFix endpoints are served under `/__pickfix/*` in Vite serve mode. They accept loopback same-origin requests by default, cap request bodies, reject unsafe paths, keep reads inside the project root, and redact common credentials and secret tokens from prompt context.

PickFix does not collect provider credentials. It has no telemetry, cloud sync, account service, or prompt history service. Comments you type become prompt text and are copied for external tools, so do not include secrets in change notes.

Production builds should not include PickFix overlay code, `/__pickfix/*` endpoints, or inspector strings.

## Package Verification

Before relying on a packed package, run:

```bash
npm run build --workspace packages/vite-plugin
npm pack --workspace packages/vite-plugin --dry-run
npm run smoke:pack-install --workspace packages/vite-plugin
```

These commands build the package, inspect the tarball contents, and smoke-test installing the packed package into the Vite React fixture.

## limitations

- Dev-only: `pickfix()` applies during Vite serve mode.
- React/Vite focus: the current package targets React apps using Vite and `@vitejs/plugin-react`.
- Component matching can be approximate when source metadata is missing or render ownership is ambiguous.
- Portal selections use source metadata when present and otherwise fall back to lower-confidence owner information.
- Fallback context may be enough for a prompt, but you should verify the selected file before applying changes.
- There is no direct browser editing or automatic source rewrite.
- The Edge extension is deferred. It may be explored later, but it is not included in this package.

## Troubleshooting

### No component match

Check that `pickfix()` is in `vite.config.ts`, the dev server was restarted after editing config, and the selected UI comes from `.jsx` or `.tsx` under the project root. Generated files, `node_modules`, and unmapped DOM can produce no match or low confidence.

### Portal fallback

For modals, menus, and tooltips rendered through portals, inspect the confidence and fallback reason. If source metadata is unavailable, treat the owner chain as a hint and verify the file before asking an agent to edit.

### Clipboard denied

Use the fallback text area shown by the overlay, select the prompt manually, and paste it into Claude or pipe it into `codex exec`.

### Failed package install

Confirm the host app uses Node 20+, Vite 5+, React 18+, and `@vitejs/plugin-react`. Reinstall dependencies after adding `@pickfix/vite-plugin`.

### production string leak

Run your production build and search built assets for `pickfix`, `__pickfix`, `overlay`, or `inspector`. A leak means the plugin is being included outside Vite serve mode and should be fixed before shipping.
