import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Compile the same TypeScript physics source used by the app, then import its CommonJS output.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const fs = await import('node:fs/promises');
const os = await import('node:os');
const path = await import('node:path');
const sourcePaths = [
  path.resolve('src/physics/kepler.ts'),
  path.resolve('src/physics/constants.ts'),
  path.resolve('src/content/planetOrbitData.ts'),
  path.resolve('src/content/planetEccentricities.ts'),
  path.resolve('src/ui/lessonOneSimulation.ts'),
  path.resolve('src/physics/transfers.ts'),
  path.resolve('src/physics/index.ts'),
  path.resolve('src/features/lesson-03/orbitAnimation.ts'),
  path.resolve('src/features/lesson-03/calculationValidation.ts'),
];
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'kepler-physics-'));
for (const file of sourcePaths) {
  let source = await fs.readFile(file, 'utf8');
  if (file.endsWith('orbitAnimation.ts')) source = source.replace("'../../physics'", "'./index.cjs'");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  await fs.writeFile(path.join(tempDirectory, path.basename(file, '.ts') + '.cjs'), output);
  // Preserve relative TypeScript imports in transpiled output (e.g. require('./constants')).
  await fs.writeFile(path.join(tempDirectory, path.basename(file, '.ts') + '.js'), output);
}
const { averageSpeedMS, ellipseGeometry, eccentricAnomalyFromMean, orbitalPeriodSeconds, stateAtTime, stateAtTrueAnomaly } = require(path.join(tempDirectory, 'kepler.cjs'));
const { ASTRONOMICAL_UNIT_M, SOLAR_MU_M3_S2, SECONDS_PER_JULIAN_YEAR } = require(path.join(tempDirectory, 'constants.cjs'));
const { distanceTraveledBetweenTimes, sweptAreaBetweenTimes, thirdLawRatio } = require(path.join(tempDirectory, 'kepler.cjs'));
const { PLANET_ORBIT_DATA } = require(path.join(tempDirectory, 'planetOrbitData.cjs'));
const { PLANET_ECCENTRICITIES } = require(path.join(tempDirectory, 'planetEccentricities.cjs'));
const { lessonOneSimulationState } = require(path.join(tempDirectory, 'lessonOneSimulation.cjs'));
const { ellipseFromApsisDistancesAU, hohmannTransfer } = require(path.join(tempDirectory, 'transfers.cjs'));
const { ellipseOrbitPath, transferFrameAtProgress, transferTrailPath } = require(path.join(tempDirectory, 'orbitAnimation.cjs'));
const { isRoundedNumericAnswer, isRoundedNumericAnswerAmong } = require(path.join(tempDirectory, 'calculationValidation.cjs'));
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
test('Cartesian state coordinates are consistent with the orbital radius', () => {
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: 0.4, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  const state = stateAtTime(orbit, orbitalPeriodSeconds(orbit) * 0.13);
  close(Math.hypot(state.positionXM, state.positionYM), state.radiusM);
});
test('equal elapsed times sweep equal areas near perihelion and aphelion', () => {
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: 0.65, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  const period = orbitalPeriodSeconds(orbit);
  const duration = period / 12;
  const nearArea = sweptAreaBetweenTimes(orbit, 0, duration);
  const farArea = sweptAreaBetweenTimes(orbit, 6 * duration, 7 * duration);
  close(nearArea, farArea, 1e-13);
});
test('equal elapsed intervals travel farther near perihelion than aphelion', () => {
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: 0.65, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  const period = orbitalPeriodSeconds(orbit);
  const duration = period / 12;
  const nearDistance = distanceTraveledBetweenTimes(orbit, 0, duration, 128);
  const farDistance = distanceTraveledBetweenTimes(orbit, 6 * duration, 7 * duration, 128);
  assert.ok(nearDistance > farDistance * 2);
});
test('average speed equals integrated path distance divided by the shared elapsed time', () => {
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: 0.62, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  const period = orbitalPeriodSeconds(orbit);
  const duration = period / 12;
  const nearDistance = distanceTraveledBetweenTimes(orbit, 0, duration, 128);
  const farStart = 6 * duration;
  const farDistance = distanceTraveledBetweenTimes(orbit, farStart, farStart + duration, 128);
  const nearAverage = averageSpeedMS(nearDistance, duration);
  const farAverage = averageSpeedMS(farDistance, duration);
  close(nearAverage * duration, nearDistance, 1e-12);
  close(farAverage * duration, farDistance, 1e-12);
  assert.ok(nearAverage > farAverage);
  assert.throws(() => averageSpeedMS(1, 0), RangeError);
});
test('twelve sequential equal-time sectors have equal swept areas for circular and elliptical orbits', () => {
  for (const eccentricity of [0, 0.62, 0.8]) {
    const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
    const duration = orbitalPeriodSeconds(orbit) / 12;
    const areas = Array.from({ length: 12 }, (_, index) => sweptAreaBetweenTimes(orbit, index * duration, (index + 1) * duration));
    for (const area of areas) close(area, areas[0], 1e-13);
    close(areas.reduce((sum, area) => sum + area, 0), sweptAreaBetweenTimes(orbit, 0, orbitalPeriodSeconds(orbit)), 1e-12);
  }
});
test('equal-time visual slices conserve each selected sector area at different eccentricities', () => {
  const sliceCount = 8;
  for (const eccentricity of [0.15, 0.62, 0.8]) {
    const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
    const sectorDuration = orbitalPeriodSeconds(orbit) / 12;
    for (const sectorIndex of [0, 2, 6, 9]) {
      const start = sectorIndex * sectorDuration;
      const pieceDuration = sectorDuration / sliceCount;
      const pieces = Array.from({ length: sliceCount }, (_, piece) => sweptAreaBetweenTimes(orbit, start + piece * pieceDuration, start + (piece + 1) * pieceDuration));
      const sectorArea = sweptAreaBetweenTimes(orbit, start, start + sectorDuration);
      for (const pieceArea of pieces) close(pieceArea, sectorArea / sliceCount, 1e-12);
      close(pieces.reduce((sum, area) => sum + area, 0), sectorArea, 1e-12);
    }
  }
});
test('third-law ratio from the two-body period matches 4π²/μ', () => {
  const orbit = { semiMajorAxisM: ASTRONOMICAL_UNIT_M, eccentricity: 0.3, gravitationalParameterM3S2: SOLAR_MU_M3_S2 };
  const ratio = thirdLawRatio(orbitalPeriodSeconds(orbit), orbit.semiMajorAxisM);
  close(ratio, (4 * Math.PI ** 2) / SOLAR_MU_M3_S2, 1e-12);
});
test('NASA planet data covers eight planets and shows P²/a³ near one in years and AU', () => {
  assert.equal(PLANET_ORBIT_DATA.length, 8);
  for (const planet of PLANET_ORBIT_DATA) {
    const aAu = (planet.meanSunDistanceMillionKm * 1e6 * 1000) / ASTRONOMICAL_UNIT_M;
    const periodYears = (planet.orbitalPeriodDays * 86_400) / SECONDS_PER_JULIAN_YEAR;
    const ratio = periodYears ** 2 / aAu ** 3;
    assert.ok(Math.abs(ratio - 1) < 0.04, `${planet.name}: P²/a³ = ${ratio}`);
  }
});
test('first-lesson planet eccentricity data remains valid and complete', () => {
  assert.equal(PLANET_ECCENTRICITIES.length, 8);
  for (const planet of PLANET_ECCENTRICITIES) assert.ok(planet.eccentricity >= 0 && planet.eccentricity < 1);
});

test('first-lesson step navigation restores the matching simulation mode and independent settings', () => {
  const settings = { freeEccentricity: 0.27, focusEccentricity: 0.5, planetEccentricity: 0.0167 };
  assert.deepEqual(lessonOneSimulationState(0, settings), { mode: 'concept', eccentricity: 0.27 });
  assert.deepEqual(lessonOneSimulationState(1, settings), { mode: 'concept', eccentricity: 0.5 });
  assert.deepEqual(lessonOneSimulationState(2, settings), { mode: 'planet', eccentricity: 0.0167 });
  assert.deepEqual(lessonOneSimulationState(3, settings), { mode: 'planet', eccentricity: 0.0167 });
  assert.equal(settings.freeEccentricity, 0.27);
  assert.equal(settings.focusEccentricity, 0.5);
});

test('ideal Earth-to-Mars Hohmann transfer has the expected ellipse and half-period travel time', () => {
  const transfer = hohmannTransfer(1, 1.524);
  close(transfer.semiMajorAxisAU, 1.262, 1e-14);
  close(transfer.periapsisAU, 1, 1e-14);
  close(transfer.apoapsisAU, 1.524, 1e-14);
  close(transfer.eccentricity, (1.524 - 1) / (1.524 + 1), 1e-14);
  close(transfer.periodYears, 1.417720660132386, 1e-12);
  close(transfer.transferDays, 258.911235556677, 1e-12);
  assert.equal(transfer.transferSeconds * 2, transfer.periodSeconds);
});

test('lesson 3 transfer calculations follow each selected apoapsis and accept rounded intermediate answers', () => {
  const apoapsisValuesAU = [1.520, 1.524, 1.531];
  const transfers = apoapsisValuesAU.map((apoapsisAU) => hohmannTransfer(1, apoapsisAU));

  transfers.forEach((transfer, index) => {
    const expectedSemiMajorAxisAU = (1 + apoapsisValuesAU[index]) / 2;
    close(transfer.semiMajorAxisAU, expectedSemiMajorAxisAU, 1e-14);
    close(transfer.periodYears, Math.sqrt(expectedSemiMajorAxisAU ** 3), 1e-5);
    close(transfer.transferDays, transfer.periodYears * 365.25 / 2, 1e-12);
    assert.equal(isRoundedNumericAnswer(expectedSemiMajorAxisAU.toFixed(3), transfer.semiMajorAxisAU, 3), true);

    const roundedSemiMajorAxisAU = Number(transfer.semiMajorAxisAU.toFixed(3));
    const periodFromRoundedAxis = Math.sqrt(roundedSemiMajorAxisAU ** 3);
    assert.equal(isRoundedNumericAnswerAmong(periodFromRoundedAxis.toFixed(2), [transfer.periodYears, periodFromRoundedAxis], 2), true);

    const travelFromRoundedPeriod = Number(transfer.periodYears.toFixed(2)) * 365.25 / 2;
    assert.equal(isRoundedNumericAnswerAmong(travelFromRoundedPeriod.toFixed(1), [transfer.transferDays, travelFromRoundedPeriod], 1), true);
    const roundedPeriodFromRoundedAxis = Number(periodFromRoundedAxis.toFixed(2));
    const travelFromBothRoundedSteps = roundedPeriodFromRoundedAxis * 365.25 / 2;
    assert.equal(isRoundedNumericAnswerAmong(travelFromBothRoundedSteps.toFixed(1), [transfer.transferDays, travelFromBothRoundedSteps], 1), true);
  });

  assert.equal(new Set(transfers.map((transfer) => transfer.semiMajorAxisAU)).size, 3);
  assert.equal(new Set(transfers.map((transfer) => transfer.transferDays)).size, 3);
});

test('Hohmann transfer follows Kepler motion from Earth orbit to Mars orbit with slower arrival', () => {
  const transfer = hohmannTransfer();
  const departure = stateAtTime(transfer.orbit, 0);
  const arrival = stateAtTime(transfer.orbit, transfer.transferSeconds);
  close(departure.radiusM / ASTRONOMICAL_UNIT_M, 1, 1e-12);
  close(arrival.radiusM / ASTRONOMICAL_UNIT_M, 1.524, 1e-12);
  assert.ok(departure.speedMS > arrival.speedMS);
  const equalInterval = transfer.transferSeconds * 0.05;
  const departureDistance = distanceTraveledBetweenTimes(transfer.orbit, 0, equalInterval, 128);
  const arrivalDistance = distanceTraveledBetweenTimes(transfer.orbit, transfer.transferSeconds - equalInterval, transfer.transferSeconds, 128);
  assert.ok(departureDistance > arrivalDistance);
});

test('animation progress maps to changing Kepler positions along the transfer half-ellipse', () => {
  const transfer = hohmannTransfer();
  const frames = [0, 0.25, 0.5, 0.75, 1].map((progress) => stateAtTime(transfer.orbit, progress * transfer.transferSeconds));
  for (let index = 1; index < frames.length; index += 1) {
    assert.ok(frames[index].radiusM > frames[index - 1].radiusM, 'heliocentric distance should increase toward Mars orbit');
    assert.ok(frames[index].positionXM !== frames[index - 1].positionXM || frames[index].positionYM !== frames[index - 1].positionYM, 'the rendered probe position should change between frames');
    assert.ok(frames[index].speedMS < frames[index - 1].speedMS, 'heliocentric speed should decrease toward Mars orbit');
  }
  close(frames[0].radiusM / ASTRONOMICAL_UNIT_M, 1, 1e-12);
  close(frames[4].radiusM / ASTRONOMICAL_UNIT_M, 1.524, 1e-12);
});

test('the SVG animation trail changes coordinates and extends as the probe advances', () => {
  const transfer = hohmannTransfer();
  const startPath = transferTrailPath(transfer, 0);
  const middlePath = transferTrailPath(transfer, 0.5);
  const arrivalPath = transferTrailPath(transfer, 1);
  assert.notEqual(startPath, middlePath);
  assert.notEqual(middlePath, arrivalPath);
  assert.ok((middlePath.match(/ L /g) ?? []).length > (startPath.match(/ L /g) ?? []).length);
  assert.ok((arrivalPath.match(/ L /g) ?? []).length > (middlePath.match(/ L /g) ?? []).length);
  const startFrame = transferFrameAtProgress(transfer, 0);
  const middleFrame = transferFrameAtProgress(transfer, 0.5);
  const arrivalFrame = transferFrameAtProgress(transfer, 1);
  assert.ok(startFrame.state.positionXM > 0);
  assert.ok(middleFrame.state.positionXM > arrivalFrame.state.positionXM);
  close(arrivalFrame.state.radiusM / ASTRONOMICAL_UNIT_M, 1.524, 1e-12);
});

test('transfer ellipse, trail, and probe coordinates stay visible inside the lesson SVG viewBox', () => {
  const transfer = hohmannTransfer();
  const inViewBox = (x, y) => x >= 0 && x <= 720 && y >= 0 && y <= 500;
  const pathPoints = (pathData) => [...pathData.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)]
    .map((match) => Number(match[0]));

  const fullEllipsePath = ellipseOrbitPath(transfer);
  assert.equal(typeof fullEllipsePath, 'string');
  const fullEllipseCoordinates = pathPoints(fullEllipsePath);
  assert.ok(fullEllipseCoordinates.length > 10, fullEllipsePath.slice(0, 120));
  for (let index = 0; index < fullEllipseCoordinates.length; index += 2) {
    assert.ok(inViewBox(fullEllipseCoordinates[index], fullEllipseCoordinates[index + 1]), 'full transfer ellipse should remain inside the SVG viewBox');
  }

  const renderedFrames = [0, 0.25, 0.5, 0.75, 1].map((progress) => {
    const frame = transferFrameAtProgress(transfer, progress);
    assert.ok(inViewBox(frame.x, frame.y), `probe marker at ${progress * 100}% should remain inside the SVG viewBox`);
    return frame;
  });
  for (let index = 1; index < renderedFrames.length; index += 1) {
    assert.notDeepEqual([renderedFrames[index].x, renderedFrames[index].y], [renderedFrames[index - 1].x, renderedFrames[index - 1].y]);
  }
  close(renderedFrames[0].x, 478, 1e-12);
  close(renderedFrames[4].x, 360 - 1.524 * 118, 1e-12);

  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const trailCoordinates = pathPoints(transferTrailPath(transfer, progress));
    assert.ok(trailCoordinates.length >= 4);
    for (let index = 0; index < trailCoordinates.length; index += 2) {
      assert.ok(inViewBox(trailCoordinates[index], trailCoordinates[index + 1]), `trail at ${progress * 100}% should remain inside the SVG viewBox`);
    }
  }
});

test('ellipse from arbitrary apsides rejects invalid transfer distances', () => {
  assert.throws(() => ellipseFromApsisDistancesAU(1.2, 1), RangeError);
  assert.throws(() => ellipseFromApsisDistancesAU(0, 1.5), RangeError);
});

test('lesson 3 calculation answers accept rounded and nearby numeric values at the requested precision', () => {
  assert.equal(isRoundedNumericAnswer('1.262', 1.262, 3), true);
  assert.equal(isRoundedNumericAnswer('1.2624', 1.262, 3), true);
  assert.equal(isRoundedNumericAnswer('1.42', 1.417720660132386, 2), true);
  assert.equal(isRoundedNumericAnswer('1.418', 1.417720660132386, 2), true);
  assert.equal(isRoundedNumericAnswer('258.9', 258.911235556677, 1), true);
  assert.equal(isRoundedNumericAnswer('1.40', 1.417720660132386, 2), false);
  assert.equal(isRoundedNumericAnswer('', 1.262, 3), false);
  assert.equal(isRoundedNumericAnswer('not a number', 1.262, 3), false);
});
