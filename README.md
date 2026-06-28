# PickFix

PickFix is a dev-only Vite React plugin that helps you turn a rendered component into a focused prompt for Claude or Codex. It runs inside your local Vite dev server, lets you select a component in the browser, bundles nearby source context, and copies prompt text for the coding tool you choose.

The browser only copies text. Claude or Codex runs separately wherever you paste or pipe that prompt.

## Install From This GitHub Repo

PickFix is not published to the public npm registry yet. To use it from GitHub on another machine, clone this repository, build the Vite plugin package, pack it, then install that tarball into your React/Vite app.

```bash
git clone https://github.com/jacob-cha-builder/pickfix.git
cd pickfix
npm install
npm run build --workspace packages/vite-plugin
npm pack --workspace packages/vite-plugin
```

The pack command prints a tarball name such as `pickfix-vite-plugin-0.1.0.tgz`. Install that tarball from your target React/Vite app:

```bash
cd /path/to/your-vite-react-app
npm install -D /path/to/pickfix/pickfix-vite-plugin-0.1.0.tgz
```

Windows PowerShell example:

```powershell
cd C:\path\to\your-vite-react-app
npm install -D C:\path\to\pickfix\pickfix-vite-plugin-0.1.0.tgz
```

Then add `pickfix()` to your Vite config as shown below and run your app with `npm run dev`.

## Install From npm

Use this shorter command after `@pickfix/vite-plugin` is published to npm:

Install the Vite plugin in a React app:

```bash
npm install -D @pickfix/vite-plugin
```

Add it next to the React plugin in `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { pickfix } from "@pickfix/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), pickfix()],
});
```

Start your app as usual:

```bash
npm run dev
```

Open the local Vite URL from your terminal output, usually `http://127.0.0.1:5173` or `http://localhost:5173`.

## Use PickFix

1. Start the Vite dev server with `npm run dev`.
2. Open the local app in your browser.
3. Activate the PickFix inspector.
4. Hover the page to inspect React component candidates.
5. Select the component you want to change.
6. Add your comment or intent: copy text, size, position, layout, or free-form notes.
7. Use `Copy prompt`, `Copy Claude prompt`, or `Copy Codex command`.

The copied prompt includes the selected component, source excerpt, imports summary, nearby style context, DOM snapshot, package scripts, confidence score, requested change, and verification instructions. Component matching can be approximate, so review the selected file and confidence before handing the prompt to an agent.

## Claude Workflow

Click `Copy Claude prompt`, open Claude, paste the clipboard content, and ask Claude to apply the component-scoped change. PickFix does not send anything to Claude by itself; your browser copies text for you to paste.

Use `Copy prompt` when you want the generic prompt without a Claude-specific header.

## Codex CLI Workflow

Click `Copy prompt`, then run the command for your platform from the app root:

```bash
pbpaste | codex exec "Apply this component-scoped change. Follow the verification instructions in the prompt."
```

```bash
xclip -selection clipboard -o | codex exec "Apply this component-scoped change. Follow the verification instructions in the prompt."
```

```powershell
Get-Clipboard | codex exec "Apply this component-scoped change. Follow the verification instructions in the prompt."
```

`Copy Codex command` copies a command string only. The browser never executes Codex.

## Verification

For this repository, package readiness is checked with:

```bash
npm run build --workspace packages/vite-plugin
npm pack --workspace packages/vite-plugin --dry-run
npm run smoke:pack-install --workspace packages/vite-plugin
```

For a consumer app, use your normal Vite build to confirm PickFix remains dev-only:

```bash
npm run build
```

PickFix is configured for Vite serve mode and should not inject the overlay, `/__pickfix/*` endpoints, or inspector strings into production build output.

## Security And Privacy

- PickFix serves local dev endpoints only under `/__pickfix/*`.
- Requests must be same-origin and loopback by default.
- Request bodies are size-limited.
- Source reads are contained to the project root and reject unsafe paths.
- Common credentials and secret tokens are redacted from prompt context.
- The overlay does not collect provider credentials.
- There is no telemetry, account service, cloud sync, or prompt history service.
- User comments become prompt text and are copied for external tools, so do not type secrets into the prompt fields.

## limitations

- PickFix is dev-only.
- The MVP focuses on React apps running through Vite.
- Component matching can be approximate, especially around unusual render trees or missing source metadata.
- Portals use source metadata when available; otherwise PickFix falls back to lower-confidence owner information.
- Fallback matches are prompt context, not proof that a file is the right edit target.
- There is no direct browser editing, source mutation, or automatic CSS rewrite.
- The Edge extension is deferred. A later Edge extension may improve activation and browser integration, but it is not part of the current package.

## Troubleshooting

### No component match

Confirm the app is running through Vite dev mode, the plugin is present as `pickfix()` in `vite.config.ts`, and the selected UI comes from `.jsx` or `.tsx` source under the project root. Elements from generated files, `node_modules`, or plain DOM without usable React metadata may show low confidence or no match.

### Portal fallback

If a modal or tooltip renders through a portal, select the rendered element and check the confidence and fallback reason. Source metadata gives the best result; without it, PickFix may report a lower-confidence owner chain.

### Clipboard denied

If the browser denies clipboard access, use the visible fallback text area, select the prompt text manually, and paste it into Claude or pipe it into `codex exec`.

### Failed package install

Check Node and Vite compatibility first. PickFix expects Node 20+, Vite 5+, React 18+, and `@vitejs/plugin-react` in the host app.

### production string leak

Run `npm run build` and inspect built assets for `pickfix`, `__pickfix`, `overlay`, or `inspector`. If any appear in production output, remove `pickfix()` from build-only config paths and report the leak before shipping.
