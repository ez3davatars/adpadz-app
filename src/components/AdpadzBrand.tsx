import { Link } from 'react-router-dom';
import './AdpadzBrand.css';

type AdpadzBrandProps = {
  className?: string;
  compact?: boolean;
  onLight?: boolean;
};

export default function AdpadzBrand({
  className = '',
  compact = false,
  onLight = false,
}: AdpadzBrandProps) {
  const classes = [
    'adpadz-brand-link',
    compact ? 'adpadz-brand-link--compact' : '',
    onLight ? 'adpadz-brand-link--on-light' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Link to="/" className={classes} aria-label="Adpadz home">
      <img className="adpadz-brand-link__image" src="/brand/adpadz-logo.png" alt="" />
      <span className="adpadz-brand-link__wordmark">
        adpadz<span>.co</span>
      </span>
    </Link>
  );
}