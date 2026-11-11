import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Create an isolated build project with shared dependencies and automatic cleanup. */
async function fixture(t, sources) {
  const directory = await mkdtemp(path.join(tmpdir(), 'quick-polls-build-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'src'));
  await copyFile(path.join(root, 'build.mjs'), path.join(directory, 'build.mjs'));
  await writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
  // Junctions do not require Windows symbolic-link privileges.
  await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const [name, content] of Object.entries(sources)) {
    await writeFile(path.join(directory, 'src', name), content);
  }
  return directory;
}

function build(directory) {
  return spawnSync(process.execPath, ['build.mjs'], { cwd: directory, encoding: 'utf8', timeout: 30_000 });
}

test('the installable bundle is reproducible from source and loads without host globals', async (t) => {
  const source = await readFile(path.join(root, 'src/plugin.tsx'), 'utf8');
  const directory = await fixture(t, { 'plugin.tsx': source });
  const result = build(directory);
  assert.equal(result.status, 0, result.stderr);
  const built = await readFile(path.join(directory, 'plugin.js'), 'utf8');
  const shipped = await readFile(path.join(root, 'plugin.js'), 'utf8');
  assert.equal(shipped, built, 'Rebuild and commit plugin.js when source changes');
  const plugin = await import(new URL('../plugin.js', import.meta.url));
  assert.equal(typeof plugin.apply, 'function');
  // All requested capabilities must exist in the supported host fixture.
  const supported = new Set(['react', 'panels', 'conversation', 'relay']);
  assert.ok(Array.isArray(plugin.inject));
  for (const capability of plugin.inject) assert.ok(supported.has(capability), `Unsupported injection: ${capability}`);
});

for (const [name, sources] of [
  ['missing entry point', {}],
  ['ambiguous entry points', { 'plugin.ts': 'export const apply = () => {}; export const inject = [];', 'plugin.tsx': 'export const apply = () => {}; export const inject = [];' }],
]) {
  test(`build rejects ${name} without replacing an existing bundle`, async (t) => {
    const directory = await fixture(t, sources);
    await writeFile(path.join(directory, 'plugin.js'), 'previous bundle');
    const result = build(directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected exactly one/);
    assert.equal(await readFile(path.join(directory, 'plugin.js'), 'utf8'), 'previous bundle');
  });
}

for (const symbol of ['apply', 'inject']) {
  test(`build rejects an entry missing the ${symbol} export`, async (t) => {
    const source = symbol === 'apply' ? 'export const inject = [];' : 'export const apply = () => {};';
    const directory = await fixture(t, { 'plugin.ts': source });
    const result = build(directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must export apply and inject/);
  });
}

test('build rejects external runtime imports that Buzz cannot load', async (t) => {
  const directory = await fixture(t, {
    'plugin.ts': 'export { apply } from "https://example.invalid/plugin.js"; export const inject = [];',
  });
  const result = build(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /one JavaScript module with no runtime imports/);
});
