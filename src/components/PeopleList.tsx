import React from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { UserInputs } from '../types';
import { addPerson, peopleCount, peopleNames, removePerson, renamePerson } from '../utils/people';

/**
 * Everyone covered, as "Person 1", "Person 2"... with an optional name each. Adding or removing
 * someone also sets the coverage level.
 */
const PeopleList: React.FC<{
  inputs: UserInputs;
  onChange: (updates: Partial<UserInputs>) => void;
  size?: 'sm' | 'lg';
}> = ({ inputs, onChange, size }) => {
  const count = peopleCount(inputs);
  return (
    <div className="d-flex flex-column gap-2">
      {Array.from({ length: count }, (_, i) => i + 1).map(person => (
        <InputGroup key={person} size={size}>
          <Form.Control
            aria-label={`Name for person ${person}`}
            placeholder={`Person ${person}`}
            value={peopleNames(inputs)[person - 1] ?? ''}
            maxLength={30}
            onChange={e => onChange(renamePerson(inputs, person, e.target.value))}
          />
          {count > 1 && (
            <Button
              variant="outline-danger"
              title={`Remove person ${person}`}
              aria-label={`Remove person ${person}`}
              onClick={() => onChange(removePerson(inputs, person))}
            >
              <FontAwesomeIcon icon={faTrash} />
            </Button>
          )}
        </InputGroup>
      ))}
      <Button
        variant="outline-primary"
        size={size}
        className="align-self-end"
        onClick={() => onChange(addPerson(inputs))}
      >
        <FontAwesomeIcon icon={faPlus} className="me-1" />
        Add person
      </Button>
    </div>
  );
};

export default PeopleList;
