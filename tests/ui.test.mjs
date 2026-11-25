import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fs = await import('node:fs/promises');
const os = await import('node:os');
const path = await import('node:path');
const ts = require('typescript');
const source = await fs.readFile(path.resolve('src/ui/regularProgress.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kepler-ui-'));
const modulePath = path.join(directory, 'regularProgress.cjs');
await fs.writeFile(modulePath, output);
const { regularLearningProgress } = require(modulePath);

test('regular learning progress reaches 100% after the three regular lessons, independent of optional activity', () => {
  assert.deepEqual(regularLearningProgress([false, false, false]), { completed: 0, total: 3, percent: 0 });
  assert.deepEqual(regularLearningProgress([true, true, false]), { completed: 2, total: 3, percent: 67 });
  assert.deepEqual(regularLearningProgress([true, true, true, false]), { completed: 3, total: 3, percent: 100 });
});

test('student-facing lesson screens no longer label the optional activity as a numbered fourth lesson', async () => {
  const files = ['src/ui/App.tsx', 'src/ui/StudentReports.tsx', 'src/features/lesson-03/KeplerMarsTransferLesson.tsx', 'src/features/lesson-04/MarsEncounterLesson.tsx'];
  for (const file of files) {
    const ui = await fs.readFile(path.resolve(file), 'utf8');
    assert.doesNotMatch(ui, /4차시|제4차시|총 4차시|4차시 학습 완료|다음 차시: 4차시|4차시 보고서/, file);
  }
});
