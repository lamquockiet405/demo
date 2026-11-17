// Package the already-built frontend only: no backend source, .env, or database.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'apps/frontend');
const dist = path.join(frontend, 'dist');
const projectFile = path.join(frontend, '.vercel/project.json');
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Build apps/frontend first');
if (!fs.existsSync(projectFile)) throw new Error('Link apps/frontend to its Vercel project first');
const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
const artifact = path.join(root, '.tmp/vercel', `kidmeal-${Date.now()}`);
const output = path.join(artifact, '.vercel/output');
fs.mkdirSync(output, { recursive: true });
fs.cpSync(dist, path.join(output, 'static'), { recursive: true });
fs.writeFileSync(path.join(artifact, '.vercel/project.json'), JSON.stringify({
  projectId: project.projectId, orgId: project.orgId, projectName: project.projectName,
}, null, 2));
fs.writeFileSync(path.join(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '/(?!api(?:/|$)|socket\\.io(?:/|$)).*', dest: '/index.html' },
  ],
}, null, 2));
console.log(artifact);
