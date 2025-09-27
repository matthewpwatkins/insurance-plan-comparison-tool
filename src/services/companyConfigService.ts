import { CompanyData } from '../types/company';

// This will be populated by the build script from company.yml
let companyConfig: CompanyData | null = null;

/**
 * Load company configuration (set by build script)
 */
export const setCompanyConfig = (config: CompanyData): void => {
  companyConfig = config;
};

/**
 * Get company configuration
 */
export const getCompanyConfig = (): CompanyData => {
  if (!companyConfig) {
    // Fallback to default configuration if not loaded
    return {
      company: {
        name: 'Insurance Company',
        shortName: 'IC',
        website: ''
      },
      text: {
        appTitle: 'Health Plan Comparison Tool',
        welcomeMessage: 'Welcome to open enrollment! This tool makes it easy to compare all your health plan options.',
        negotiatedRateText: 'negotiated rate',
        fsaText: 'FSA',
        hsaRetainedBenefitText: 'even when you change plans'
      }
    };
  }
  return companyConfig;
};

/**
 * Get company name
 */
export const getCompanyName = (): string => {
  return getCompanyConfig().company.name;
};

/**
 * Get company short name
 */
export const getCompanyShortName = (): string => {
  return getCompanyConfig().company.shortName;
};

/**
 * Get company website URL
 */
export const getCompanyWebsite = (): string | undefined => {
  return getCompanyConfig().company.website;
};

/**
 * Get claims portal URL
 */
export const getClaimsPortalUrl = (): string | undefined => {
  return getCompanyConfig().company.links?.claimsPortal;
};

/**
 * Get member portal URL
 */
export const getMemberPortalUrl = (): string | undefined => {
  return getCompanyConfig().company.links?.memberPortal;
};

/**
 * Get FSA provider name
 */
export const getFSAProviderName = (): string => {
  return getCompanyConfig().company.fsaProvider?.name || getCompanyName();
};

/**
 * Replace template variables in text with company values
 */
export const interpolateCompanyText = (template: string): string => {
  const config = getCompanyConfig();

  return template
    .replace(/\{company\.name\}/g, config.company.name)
    .replace(/\{company\.shortName\}/g, config.company.shortName)
    .replace(/\{company\.fullName\}/g, config.company.fullName || config.company.name);
};