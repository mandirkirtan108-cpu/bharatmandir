import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Landmark,
  ShieldCheck,
} from 'lucide-react';

import VolunteerNavbar from '../../components/volunteer/VolunteerNavbar';
import VolunteerTempleForm from '../../components/volunteer/VolunteerTempleForm';
import { volunteerApi } from '../../services/volunteerApi';

export default function VolunteerAddTemplePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (formData) => {
    setBusy(true);
    setError('');

    try {
      await volunteerApi.createSubmission(formData);

      navigate('/volunteer/submissions', {
        state: {
          message: 'Temple submitted successfully for admin review.',
        },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          requestError.message ||
        'Unable to submit the temple. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <VolunteerNavbar />

      <TempleHero />

      <main style={styles.main}>
        <div
          className="volunteer-form-layout"
          style={styles.layout}
        >
          <section style={styles.formPanel}>
            <div style={styles.formHeading}>
              <div style={styles.iconBox}>
                <Landmark size={22} />
              </div>

              <div>
                <p style={styles.eyebrow}>
                  TEMPLE REGISTRATION
                </p>

                <h2 style={styles.formTitle}>
                  Share Temple Information
                </h2>

                <p style={styles.formDescription}>
                  Complete the required fields carefully. After submitting,
                  you can track its status from the dashboard.
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                style={styles.errorBox}
              >
                {error}
              </div>
            )}

            <VolunteerTempleForm
              submitting={busy}
              onSubmit={handleSubmit}
            />
          </section>

          <aside style={styles.sidebar}>
            <InformationCard
              title="Before You Submit"
              icon={<ShieldCheck size={20} />}
              items={[
                    'Verify the temple name and address.',
                    'Keep the description original and accurate.',
                    'Provide a recent, clear image of the temple.',
                    'Verify the contact details before submitting.',
              ]}
            />

            <InformationCard
              title="What Happens Next?"
              icon={<CheckCircle2 size={20} />}
              items={[
                    'The submission will be sent for admin review.',
                    'The administrator may request changes.',
                    'The temple profile will be published after approval.',
                    'Its status will appear on the My Submissions page.',
              ]}
            />
          </aside>
        </div>
      </main>

      <style>
        {`
          @media (max-width: 820px) {
            .volunteer-form-layout {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 540px) {
            .volunteer-form-layout {
              gap: 16px !important;
            }
          }
        `}
      </style>
    </div>
  );
}

function TempleHero() {
  return (
    <section style={styles.hero}>
      <div style={styles.heroBadge}>
        🛕 VOLUNTEER TEMPLE SERVICE
      </div>

      <h1 style={styles.heroTitle}>
        Add a Sacred{' '}
        <span style={styles.heroHighlight}>
          Temple
        </span>
      </h1>

      <p style={styles.heroDescription}>
        Help add India&apos;s temples to the digital map.
      </p>
    </section>
  );
}

function InformationCard({ title, icon, items }) {
  return (
    <section style={styles.informationCard}>
      <div style={styles.informationHeading}>
        {icon}

        <h3 style={styles.informationTitle}>
          {title}
        </h3>
      </div>

      <div style={styles.informationList}>
        {items.map((item, index) => (
          <div
            key={item}
            style={styles.informationRow}
          >
            <span style={styles.number}>
              {index + 1}
            </span>

            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#FAF6EE',
    color: '#2C1500',
  },

  hero: {
    padding: '48px 20px',
    textAlign: 'center',
    background:
      'linear-gradient(135deg, #4B1D04 0%, #7A3208 55%, #A14A0B 100%)',
  },

  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 15px',
    border: '1px solid rgba(255, 213, 128, 0.3)',
    borderRadius: 50,
    background: 'rgba(255, 255, 255, 0.07)',
    color: '#FFD580',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.09em',
  },

  heroTitle: {
    margin: '16px 0 7px',
    color: '#FFFFFF',
    fontFamily: 'var(--font-display, Georgia, serif)',
    fontSize: 'clamp(32px, 5vw, 50px)',
  },

  heroHighlight: {
    color: '#FFD580',
  },

  heroDescription: {
    maxWidth: 600,
    margin: '0 auto',
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    lineHeight: 1.6,
  },

  main: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '32px 20px 70px',
  },

  layout: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1.65fr) minmax(270px, 0.7fr)',
    alignItems: 'start',
    gap: 22,
  },

  formPanel: {
    padding: 26,
    background: '#FFFFFF',
    border: '1px solid #EDE3CE',
    borderRadius: 17,
    boxShadow: '0 5px 22px rgba(44, 21, 0, 0.08)',
  },

  formHeading: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 24,
  },

  iconBox: {
    width: 48,
    height: 48,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    background: '#FFF0E5',
    color: '#C8520A',
    borderRadius: 13,
  },

  eyebrow: {
    margin: 0,
    color: '#C8520A',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.1em',
  },

  formTitle: {
    margin: '3px 0',
    color: '#2C1500',
    fontFamily: 'var(--font-display, Georgia, serif)',
    fontSize: 28,
  },

  formDescription: {
    margin: 0,
    color: '#7A5538',
    fontSize: 13,
    lineHeight: 1.6,
  },

  errorBox: {
    marginBottom: 18,
    padding: 12,
    background: '#FDEAEA',
    color: '#A52222',
    border: '1px solid #F1CACA',
    borderRadius: 9,
    fontSize: 13,
  },

  sidebar: {
    display: 'grid',
    alignContent: 'start',
    gap: 16,
  },

  informationCard: {
    padding: 20,
    background: '#FFFFFF',
    border: '1px solid #EDE3CE',
    borderRadius: 15,
    boxShadow: '0 3px 14px rgba(44, 21, 0, 0.05)',
  },

  informationHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    color: '#C8520A',
  },

  informationTitle: {
    margin: 0,
    color: '#3D1C07',
    fontFamily: 'var(--font-display, Georgia, serif)',
    fontSize: 21,
  },

  informationList: {
    display: 'grid',
    gap: 13,
    marginTop: 16,
  },

  informationRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
    color: '#5C3010',
    fontSize: 12,
    lineHeight: 1.5,
  },

  number: {
    width: 22,
    height: 22,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    background: '#FFF0E5',
    color: '#C8520A',
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 800,
  },
};
