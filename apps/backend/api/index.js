const path = require('node:path');
const fs = require('node:fs');

let serverPromise = null;

async function getServer() {
  if (!serverPromise) {
    serverPromise = (async () => {
      const mainCandidates = [
        path.join(__dirname, '..', 'dist', 'main.js'),
        path.join(__dirname, '..', 'dist', 'src', 'main.js'),
      ];
      const mainPath = mainCandidates.find((p) => fs.existsSync(p));
      if (!mainPath) {
        throw new Error(`Compiled NestJS main.js not found in ${mainCandidates.join(', ')}`);
      }
      const { createConfiguredNestApp } = require(mainPath);
      const app = await createConfiguredNestApp();
      await app.init();
      return app.getHttpAdapter().getInstance();
    })();
  }
  return serverPromise;
}

module.exports = async (req, res) => {
  const server = await getServer();
  return server(req, res);
};
