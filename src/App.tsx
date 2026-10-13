import CompanyApp from './CompanyApp';
import CompanyChooser from './CompanyChooser';
import { getCompany } from './generated/dataHelpers';
import { readCompanySlugFromPath } from './utils/urlParams';

function App() {
  const slug = readCompanySlugFromPath();
  const company = getCompany(slug);

  if (!company) {
    return <CompanyChooser unknownSlug={slug || undefined} />;
  }
  return <CompanyApp key={company.slug} company={company} />;
}

export default App;
