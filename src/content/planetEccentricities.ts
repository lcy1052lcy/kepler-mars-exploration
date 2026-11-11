/** Representative dimensionless eccentricities from NASA Goddard's Planetary Fact Sheet. */
export interface PlanetEccentricity {
  id: string;
  name: string;
  /** Eccentricity in the source table is given relative to Earth (Earth = 1). */
  eccentricity: number;
}

export const PLANET_ECCENTRICITY_SOURCE = {
  label: 'NASA Goddard Space Flight Center · Planetary Fact Sheet (18 Mar 2025)',
  url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/planet_table_ratio.html',
  note: '표의 이심률은 지구를 1로 둔 상대값이므로, 지구 이심률 0.0167을 곱해 대표값으로 환산했습니다.',
} as const;

// NASA table gives each value as a ratio to Earth's eccentricity. The values below
// multiply those ratios by Earth's representative eccentricity (0.0167), rounded to 4 decimals.
export const PLANET_ECCENTRICITIES: PlanetEccentricity[] = [
  { id: 'mercury', name: '수성', eccentricity: 0.2054 },
  { id: 'venus', name: '금성', eccentricity: 0.0067 },
  { id: 'earth', name: '지구', eccentricity: 0.0167 },
  { id: 'mars', name: '화성', eccentricity: 0.0935 },
  { id: 'jupiter', name: '목성', eccentricity: 0.0490 },
  { id: 'saturn', name: '토성', eccentricity: 0.0565 },
  { id: 'uranus', name: '천왕성', eccentricity: 0.0458 },
  { id: 'neptune', name: '해왕성', eccentricity: 0.0113 },
];
