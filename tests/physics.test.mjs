import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Compile the same TypeScript physics source used by the app, then import its CommonJS output.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const fs = await import('node:fs/promises');
const os = await import('node:os');
const path = await import('node:path');
const sourcePath = path.resolve('src/physics/kepler.ts');
const constantsPath = path.resolve('src/physics/constants.ts');
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'kepler-physics-'));
for (const file of [sourcePath, constantsPath]) {
  const source = await fs.readFile(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  await fs.writeFile(path.join(tempDirectory, path.basename(file, '.ts') + '.cjs'), output);
}
const { ellipseGeometry, eccentricAnomalyFromMean, orbitalPeriodSeconds, stateAtTime, stateAtTrueAnomaly } = require(path.join(tempDirectory, 'kepler.cjs'));
const { ASTRONOMICAL_UNIT_M, SOLAR_MU_M3_S2, SECONDS_PER_JULIAN_YEAR } = require(path.join(tempDirectory, 'constants.cjs'));
const close = (actual, expected, relativeTolerance = 1e-10) => assert.ok(Math.abs(actual - expected) / Math.abs(expected) < relativeTolerance, `${actual} is not within tolerance of ${expected}`);

test('circle has equal radii and coincident foci', () => {
  assert.deepEqual(ellipseGeometry(10, 0), { semiMajorAxis: 10, semiMinorAxis: 10, focusDistance: 0, periapsisDistance: 10, apoapsisDistance: 10 });
});
test('ellipse geometry satisfies focal relation and apsis distances', () => {
  const { semiMajorAxis: a, semiMinorAxis: b, focusDistance: c, periapsisDistance, apoapsisDistance } = ellipseGeometry(8, 0.6);
  close(b * b + c * c, a * a);
  assert.equal(periapsisDistance, 3.2);
  assert.equal(apoapsisDistance, 12.8);
});
test('ellipse geometry rejects invalid inputs', () => {
  assert.throws(() => ellipseGeometry(1, 1), RangeError);
  assert.throws(() => ellipseGeometry(0, 0.5), RangeError);
});
test('a circular 1 AU solar orbit has a Julian year period', () => {
  const period = orbitalPeriodSeconds({ semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: 0, gravitationalParameterM3S2: SOLAR_MU_M3_S2 });
  close(period / SECONDS_PER_JULIAN_YEAR, 1, 1e-3);
});
test('true-anomaly states reach expected periapsis and apoapsis', () => {
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: 0.2, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  close(stateAtTrueAnomaly(orbit, 0).radiusM, 0.8 * ASTRONOMICAL_UNIT_M);
  close(stateAtTrueAnomaly(orbit, Math.PI).radiusM, 1.2 * ASTRONOMICAL_UNIT_M);
});
test('eccentric anomaly solver has low Kepler-equation residual and wraps revolutions', () => {
  for (const mean of [0, 0.2, 1.7, Math.PI, 5.9, 2 * Math.PI + 0.4]) {
    const eccentric = eccentricAnomalyFromMean(mean, 0.75);
    const normalizedMean = ((mean % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    assert.ok(Math.abs(eccentric - 0.75 * Math.sin(eccentric) - normalizedMean) < 1e-11);
  }
});
test('state returns to periapsis after one orbital period', () => {
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: 0.2, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  const period = orbitalPeriodSeconds(orbit);
  close(stateAtTime(orbit, period).radiusM, stateAtTime(orbit, 0).radiusM);
});
