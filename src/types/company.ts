export interface CompanyInfo {
  name: string;
  fullName?: string;
  shortName: string;
  website?: string;
  links?: {
    claimsPortal?: string;
    memberPortal?: string;
    customerService?: string;
    documentation?: string;
  };
  fsaProvider?: {
    name: string;
  };
  branding?: {
    primaryColor?: string;
  };
}

export interface CompanyTexts {
  appTitle: string;
  welcomeMessage: string;
  negotiatedRateText: string;
  fsaText: string;
  hsaRetainedBenefitText: string;
}

export interface CompanyData {
  company: CompanyInfo;
  text: CompanyTexts;
}