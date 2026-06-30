import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <div className="footer-name">🛕 BharatMandir</div>
      <hr className="footer-divider" />
      <p className="footer-text">
        {t('footer.tagline', { defaultValue: 'Temple Discovery Platform of India' })}<br />
        {t('footer.sub', { defaultValue: 'Connecting devotees with the sacred temples of Bharat' })}
      </p>
    </footer>
  );
}
