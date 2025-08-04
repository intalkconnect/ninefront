// public/prettier.worker.js

self.importScripts('https://unpkg.com/prettier@3.6.2/standalone.js');
self.importScripts('https://unpkg.com/prettier@3.6.2/plugins/babel.js');

self.onmessage = function (e) {
  const { code, options } = e.data;
  try {
    const formatted = self.prettier.format(code, {
      parser: "babel",
      plugins: [self.prettierPlugins.babel],
      ...options,
    });
    self.postMessage({ formatted });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
