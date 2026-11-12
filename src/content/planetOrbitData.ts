/** Approximate planet data for a classroom comparison of orbital period and mean Sun distance. */
export interface PlanetOrbitData {
  id: string;
  name: string;
  /** NASA Goddard Fact Sheet: mean Sun distance / semi-major axis, in millions of km. */
  meanSunDistanceMillionKm: number;
  /** NASA Goddard Fact Sheet orbital period, in days. */
  orbitalPeriodDays: number;
}

export const PLANET_ORBIT_DATA_SOURCE = {
  label: 'NASA Goddard Space Flight Center · Planetary Fact Sheet (Metric)',
  url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/index.html',
  notesUrl: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/planetfact_notes.html',
  lastUpdated: '2025-03-18',
  note: '태양 거리 값은 평균 거리(긴반지름의 근삿값)이며, 공전주기는 일 단위입니다. 교육용 반올림 자료입니다.',
} as const;

/** Eight planets. Values retain the source units and precision; conversions happen in the UI/model boundary. */
export const PLANET_ORBIT_DATA: PlanetOrbitData[] = [
  { id: 'mercury', name: '수성', meanSunDistanceMillionKm: 57.9, orbitalPeriodDays: 88.0 },
  { id: 'venus', name: '금성', meanSunDistanceMillionKm: 108.2, orbitalPeriodDays: 224.7 },
  { id: 'earth', name: '지구', meanSunDistanceMillionKm: 149.6, orbitalPeriodDays: 365.2 },
  { id: 'mars', name: '화성', meanSunDistanceMillionKm: 228.0, orbitalPeriodDays: 687.0 },
  { id: 'jupiter', name: '목성', meanSunDistanceMillionKm: 778.5, orbitalPeriodDays: 4331 },
  { id: 'saturn', name: '토성', meanSunDistanceMillionKm: 1432.0, orbitalPeriodDays: 10747 },
  { id: 'uranus', name: '천왕성', meanSunDistanceMillionKm: 2867.0, orbitalPeriodDays: 30589 },
  { id: 'neptune', name: '해왕성', meanSunDistanceMillionKm: 4515.0, orbitalPeriodDays: 59800 },
];
