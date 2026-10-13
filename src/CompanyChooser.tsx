import { Container, ListGroup, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { getCompanies } from './generated/dataHelpers';

interface CompanyChooserProps {
  unknownSlug?: string;
}

function CompanyChooser({ unknownSlug }: CompanyChooserProps) {
  const companies = getCompanies();

  return (
    <Container className="mt-4" style={{ maxWidth: 640 }}>
      <h1>Health Plan Comparison Tool</h1>
      {unknownSlug && <Alert variant="warning">No company found for "{unknownSlug}".</Alert>}
      <p className="text-muted">Choose your company to compare its health plans.</p>
      <ListGroup>
        {companies.map(company => (
          <ListGroup.Item key={company.slug} action href={`/${company.slug}`}>
            {company.name}
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Container>
  );
}

export default CompanyChooser;
