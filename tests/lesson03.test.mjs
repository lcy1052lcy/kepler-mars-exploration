import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fs = await import('node:fs/promises');
const os = await import('node:os');
const path = await import('node:path');
const ts = require('typescript');
const source = await fs.readFile(path.resolve('src/features/lesson-03/constructionReadiness.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kepler-lesson3-'));
const modulePath = path.join(directory, 'constructionReadiness.cjs');
await fs.writeFile(modulePath, output);
const { isConstructionReady } = require(modulePath);

test('observation entered before checking the correct transfer ellipse can advance', () => {
  const observedFirst = isConstructionReady(false, true, '근일점과 원일점이 각각 두 궤도에 닿는다.');
  assert.equal(observedFirst, false);
  assert.equal(isConstructionReady(true, true, '근일점과 원일점이 각각 두 궤도에 닿는다.'), true);
});

test('correct ellipse checked before observation can advance after a note is entered', () => {
  assert.equal(isConstructionReady(true, true, ''), false);
  assert.equal(isConstructionReady(true, true, '  중심과 초점이 다른 위치에 있다.  '), true);
});

test('incorrect or changed ellipse remains blocked until checked correctly again', () => {
  const note = '타원의 끝점이 두 원 궤도에 닿도록 조절했다.';
  assert.equal(isConstructionReady(true, false, note), false);
  // Moving either slider invalidates the previous check; a fresh correct check restores readiness.
  assert.equal(isConstructionReady(false, true, note), false);
  assert.equal(isConstructionReady(true, true, note), true);
});
