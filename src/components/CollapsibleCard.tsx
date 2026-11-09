import React, { useState } from 'react';
import { Button, Card, Collapse } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';

interface CollapsibleCardProps {
  title: string;
  /** One line shown in the header while collapsed, e.g. "Family · 26.5% tax" */
  summary?: React.ReactNode;
  /** Extra header content on the right, like a help icon */
  help?: React.ReactNode;
  defaultOpen?: boolean;
  /** Set with onOpenChange to open or close it from outside, like a link elsewhere on the page */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Heading size of the title; form sections use the default */
  titleClassName?: string;
  /** Shown before the title, saying at a glance what kind of section it is */
  icon?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

/** A form section whose header opens and closes it. */
const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  summary,
  help,
  defaultOpen = true,
  open: openFromOutside,
  onOpenChange,
  titleClassName = 'h3 mb-0',
  icon,
  id,
  className = 'mb-4',
  children,
}) => {
  const [openHere, setOpenHere] = useState(defaultOpen);
  const open = openFromOutside ?? openHere;
  const setOpen = (next: boolean) => {
    setOpenHere(next);
    onOpenChange?.(next);
  };
  return (
    <Card id={id} className={className}>
      <Card.Header className="d-flex align-items-center gap-2">
        <Button
          variant="link"
          className="p-0 text-body text-decoration-none text-start d-flex align-items-center gap-2 flex-grow-1"
          style={{ minWidth: 0 }}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <FontAwesomeIcon
            icon={open ? faChevronDown : faChevronRight}
            className="text-muted"
            fixedWidth
          />
          {icon}
          <span className={titleClassName}>{title}</span>
          {!open && summary && (
            <span className="small text-muted ms-2 d-none d-sm-inline text-truncate">
              {summary}
            </span>
          )}
        </Button>
        {help}
      </Card.Header>
      <Collapse in={open}>
        <div>
          <Card.Body>{children}</Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};

export default CollapsibleCard;
