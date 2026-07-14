import { Link } from 'react-router-dom';
import './AdpadzBrand.css';

type AdpadzBrandProps = {
  className?: string;
  compact?: boolean;
  onLight?: boolean;
  to?: string;
  ariaLabel?: string;
};

export default function AdpadzBrand({
  className = '',
  compact = false,
  onLight = false,
  to = '/',
  ariaLabel = 'Adpadz home',
}: AdpadzBrandProps) {
  const classes = [
    'adpadz-brand-link',
    compact ? 'adpadz-brand-link--compact' : '',
    onLight ? 'adpadz-brand-link--on-light' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Link to={to} className={classes} aria-label={ariaLabel}>
      <img className="adpadz-brand-link__image" src="/brand/adpadz-logo.png" alt="" />
      <span className="adpadz-brand-link__wordmark">
        adpadz<span>.co</span>
      </span>
    </Link>
  );
}
