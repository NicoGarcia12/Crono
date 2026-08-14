// Config de Metro (el bundler de React Native, equivalente a Webpack/Vite).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Soporte de expo-sqlite en WEB: la BD corre compilada a WebAssembly (wa-sqlite).
// 1) Metro tiene que tratar los .wasm como assets servibles.
config.resolver.assetExts.push('wasm');

// 2) El navegador solo habilita SharedArrayBuffer (que wa-sqlite necesita) si la
//    página llega con estos headers de aislamiento cross-origin.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
