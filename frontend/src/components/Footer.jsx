import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <div className="footer-name">🛕 BharatMandir</div>
      <hr className="footer-divider" />
      <p className="footer-text">
        {t('footer_tagline')}<br />
        {t('footer_sub')}
      </p>
    </footer>
  );
}