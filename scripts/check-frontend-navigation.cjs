// Check source reachability and static internal navigation without starting a browser.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const frontendRequire = createRequire(path.resolve(__dirname, '../apps/frontend/package.json'));
const ts = frontendRequire('typescript');
const { matchRoutes } = frontendRequire('react-router-dom');
const root = path.resolve(__dirname, '../apps/frontend/src');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(tsx?|jsx?)$/.test(file)) files.push(file);
  }
}
walk(root);
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const source = file => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
function resolveImport(file, specifier) {
  const base = specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier)
    : specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : null;
  if (!base) return null;
  return [base, ...['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix)]
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}
const graph = new Map();
const unresolved = [];
for (const file of files) {
  const tree = source(file);
  const bindingsUsed = new Set();
  function visit(node) {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node)) bindingsUsed.add(node.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const edges = [];
  for (const node of tree.statements) {
    if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
    const specifier = node.moduleSpecifier.text;
    const target = resolveImport(file, specifier);
    if (!target) {
      if (specifier.startsWith('.') || specifier.startsWith('@/')) unresolved.push({ file: relative(file), specifier });
      continue;
    }
    const names = [];
    if (node.importClause?.name) names.push(node.importClause.name.text);
    const bindings = node.importClause?.namedBindings;
    if (bindings) names.push(...(ts.isNamedImports(bindings) ? bindings.elements.map(item => item.name.text) : [bindings.name.text]));
    if (!names.length || names.some(name => bindingsUsed.has(name))) edges.push(target);
  }
  graph.set(file, edges);
}
const reachable = new Set();
function mark(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const target of graph.get(file) || []) mark(target);
}
mark(path.join(root, 'main.tsx'));
const unused = files.filter(file => !file.endsWith('.d.ts') && !reachable.has(file)).map(relative);

const app = source(path.join(root, 'App.tsx'));
const routes = [];
function routePath(node) {
  const attribute = node.attributes.properties.find(item => item.name?.text === 'path');
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : undefined;
}
function inspectRoutes(node, parent = '') {
  let current = parent;
  const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
  if (opening?.tagName.getText(app) === 'Route') {
    const part = routePath(opening);
    if (part && part !== '*') {
      current = part.startsWith('/') ? part : `${parent}/${part}`;
      routes.push({ path: current });
    }
  }
  ts.forEachChild(node, child => inspectRoutes(child, current));
}
inspectRoutes(app);
const broken = [];
let checkedLinks = 0;
for (const file of reachable) {
  if (!graph.has(file)) continue;
  const tree = source(file);
  function inspectLinks(node) {
    let target;
    if (ts.isJsxAttribute(node) && ['to', 'href'].includes(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) target = node.initializer.text;
    if (ts.isPropertyAssignment(node) && node.name?.getText(tree) === 'path' && ts.isStringLiteral(node.initializer)) target = node.initializer.text;
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'navigate' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) target = node.arguments[0].text;
    if (target?.startsWith('/') && !target.startsWith('//')) {
      checkedLinks++;
      if (!matchRoutes(routes, target)) broken.push({ file: relative(file), target });
    }
    ts.forEachChild(node, inspectLinks);
  }
  inspectLinks(tree);
}
console.log(JSON.stringify({ sourceFiles: files.length, checkedLinks, unresolved, unused, broken }, null, 2));
if (unresolved.length || unused.length || broken.length) process.exitCode = 1;
