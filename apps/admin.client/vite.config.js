"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types='vitest' />
var vite_1 = require("vite");
var plugin_react_1 = require("@vitejs/plugin-react");
var nx_tsconfig_paths_plugin_1 = require("@nx/vite/plugins/nx-tsconfig-paths.plugin");
var nx_copy_assets_plugin_1 = require("@nx/vite/plugins/nx-copy-assets.plugin");
exports.default = (0, vite_1.defineConfig)(function () { return ({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/admin.client',
    server: {
        port: 4200,
        host: 'localhost',
        proxy: {
            '/api': {
                target: 'http://localhost:4000',
                changeOrigin: true,
                secure: false,
            }
        }
    },
    preview: {
        port: 4200,
        host: 'localhost',
    },
    plugins: [(0, plugin_react_1.default)(), (0, nx_tsconfig_paths_plugin_1.nxViteTsPaths)(), (0, nx_copy_assets_plugin_1.nxCopyAssetsPlugin)(['*.md'])],
    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [ nxViteTsPaths() ],
    // },
    build: {
        outDir: '../../dist/admin.client',
        emptyOutDir: true,
        reportCompressedSize: true,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
}); });
