import type { Plugin, ViteDevServer } from "vite";

import { clientPath, getRequestPath, handlePickfixRequest, writeJsonError } from "./dev-server.js";
import { createSourceMetadataRegistry } from "./metadata-registry.js";
import type { SourceMetadataRegistry } from "./metadata-registry.js";
import { bindSourceMetadataRegistry } from "./server-registry.js";
import { transformSourceMetadata } from "./source-metadata.js";

export type PickfixOptions = {
  readonly enabled?: boolean | ((server: ViteDevServer) => boolean);
};

export function pickfix(options: PickfixOptions = {}): Plugin {
  let root = process.cwd();
  let registry: SourceMetadataRegistry = createSourceMetadataRegistry({ root });
  let devServer: ViteDevServer | undefined;
  let active = false;

  return {
    name: "pickfix",
    apply: "serve",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
      registry = createSourceMetadataRegistry({ root });
    },
    transformIndexHtml(_html, context) {
      if (context.server === undefined || !active) {
        return [];
      }

      return [
        {
          attrs: { src: clientPath, type: "module" },
          injectTo: "body",
          tag: "script",
        },
      ];
    },
    configureServer(server) {
      devServer = server;
      active = isEnabled(options, server);
      if (active) {
        bindSourceMetadataRegistry(server, registry);
      }

      server.middlewares.use((request, response, next) => {
        const requestPath = getRequestPath(request);
        if (!requestPath.startsWith("/__pickfix/")) {
          next();
          return;
        }

        if (!active) {
          writeJsonError(response, 404, "not_found", "Pickfix is disabled");
          return;
        }

        handlePickfixRequest(server, request, response).then(undefined, (error: unknown) => {
          if (response.headersSent) {
            return;
          }

          const message = error instanceof Error ? error.message : "Unexpected pickfix server error";
          writeJsonError(response, 400, "invalid_payload", message);
        });
      });
    },
    handleHotUpdate(context) {
      if (devServer === undefined || !active) {
        return;
      }

      registry.invalidateFile(context.file);
    },
    transform(code, id) {
      if (devServer === undefined || !active) {
        return null;
      }

      registry.invalidateFile(id);
      return transformSourceMetadata({ code, id, registry, root });
    },
  };
}

function isEnabled(options: PickfixOptions, server: ViteDevServer): boolean {
  const enabled = options.enabled;
  if (enabled === undefined) {
    return server.config.command === "serve";
  }

  if (typeof enabled === "boolean") {
    return enabled;
  }

  return enabled(server);
}
