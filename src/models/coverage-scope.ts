export enum CoverageScope {
  SINGLE = 'Single',
  TWO_PARTY = 'Two Party',
  FAMILY = 'Family'
}

const coverageScopesByName: Record<string, CoverageScope> = Object.values(CoverageScope).reduce((acc, scope) => {
  acc[scope.toString()] = scope;
  return acc;
}, {} as Record<string, CoverageScope>);

export function parseCoverageScope(scope: string): CoverageScope {
  console.log(`Parsing coverage scope: ${scope}`, coverageScopesByName);
  return coverageScopesByName[scope];
}
