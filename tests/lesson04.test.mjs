import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await fs.readFile(path.resolve('src/features/lesson-04/progression.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'kepler-lesson4-'));
const modulePath = path.join(folder, 'progression.cjs');
await fs.writeFile(modulePath, output);
const { canAdvanceEncounter, encounterRequirements } = require(modulePath);

test('encounter step requires first run, changed-position rerun, comparison response, and result confirmation', () => {
  assert.equal(canAdvanceEncounter({ firstRunComplete: false, changedPositionRunComplete: false, resultConfirmed: false, predictionCompared: '' }), false);
  assert.equal(canAdvanceEncounter({ firstRunComplete: true, changedPositionRunComplete: false, resultConfirmed: false, predictionCompared: 'yes' }), false);
  assert.equal(canAdvanceEncounter({ firstRunComplete: true, changedPositionRunComplete: true, resultConfirmed: false, predictionCompared: 'yes' }), false);
  assert.equal(canAdvanceEncounter({ firstRunComplete: true, changedPositionRunComplete: true, resultConfirmed: true, predictionCompared: '' }), false);
});

test('any observed encounter outcome advances after the learning steps; success is not required', () => {
  const completedObservation = { firstRunComplete: true, changedPositionRunComplete: true, resultConfirmed: true };
  assert.equal(canAdvanceEncounter({ ...completedObservation, predictionCompared: 'yes' }), true);
  assert.equal(canAdvanceEncounter({ ...completedObservation, predictionCompared: 'no' }), true);
});

test('missing requirements tell the student what remains to observe', () => {
  assert.deepEqual(encounterRequirements({ firstRunComplete: false, changedPositionRunComplete: false, resultConfirmed: false, predictionCompared: '' }), ['시뮬레이션을 한 번 실행해 보세요.']);
  assert.ok(encounterRequirements({ firstRunComplete: true, changedPositionRunComplete: false, resultConfirmed: false, predictionCompared: 'yes' }).includes('화성의 출발 위치를 변경하고 다시 관찰해 보세요.'));
  assert.deepEqual(encounterRequirements({ firstRunComplete: true, changedPositionRunComplete: true, resultConfirmed: true, predictionCompared: 'no' }), []);
});
