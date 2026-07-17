import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Link } from 'react-router-dom';

import {
  CheckCircle2,
  Clock3,
  FileWarning,
  Landmark,
  Plus,
  Send,
  XCircle,
} from 'lucide-react';

import VolunteerNavbar from '../../components/volunteer/VolunteerNavbar';
import SubmissionStatusBadge from '../../components/volunteer/SubmissionStatusBadge';
import { volunteerApi } from '../../services/volunteerApi';
import { useVolunteerAuth } from '../../hooks/useVolunteerAuth';

export default function VolunteerDashboardPage() {
  const { volunteer } = useVolunteerAuth();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadSubmissions = async () => {
      setLoading(true);
      setError('');

      try {
        const response =
          await volunteerApi.listSubmissions();

        if (active) {
          setSubmissions(
            Array.isArray(response.data)
              ? response.data
              : []
          );
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.detail ||
              'Submissions load nahi ho paayi.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadSubmissions();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    return {
      drafts: submissions.filter((submission) => ['draft', 'changes_requested'].includes(submission.status)).length,

      pending: submissions.filter((submission) =>
        ['pending_review'].includes(
          submission.status
        )
      ).length,

      approved: submissions.filter(
        (submission) =>
          submission.status === 'published'
      ).length,

      changes: submissions.filter(
        (submission) =>
          submission.status === 'changes_requested'
      ).length,

      rejected: submissions.filter(
        (submission) =>
          submission.status === 'rejected'
      ).length,
    };
  }, [submissions]);

  const recentSubmissions = submissions.slice(0, 5);

  const volunteerName =
    volunteer?.name?.trim()?.split(' ')[0] ||
    'Volunteer';

  return (
    <div style={styles.page}>
      <VolunteerNavbar />

      <section style={styles.hero}>
        <div style={styles.heroGlow} />

        <div style={styles.heroInner}>
          <div style={styles.heroBadge}>
            <Landmark size={13} />
            VOLUNTEER SEVA PORTAL
          </div>

          <h1 style={styles.heroTitle}>
            Namaste,{' '}
            <span style={styles.heroHighlight}>
              {volunteerName}
            </span>
          </h1>

          <p style={styles.heroText}>
            Aapke dwara submit ki gayi temple information
            Bharat ki sacred heritage ko preserve karne mein
            madad karti hai.
          </p>

          <div style={styles.heroActions}>
            <Link
              to="/AdminAddTemplePage"
              style={styles.primaryButton}
            >
              <Plus size={17} />
              Add New Temple
            </Link>

            <Link
              to="/volunteer/submissions"
              style={styles.secondaryButton}
            >
              View My Submissions
            </Link>
          </div>
        </div>
      </section>

      <main style={styles.main}>
        <div
          className="volunteer-dashboard-stats"
          style={styles.statsGrid}
        >
          <StatCard
            icon={<FileWarning size={20} />}
            label="My Drafts"
            value={stats.drafts}
            color="#C8520A"
            background="#FFF0E5"
          />

          <StatCard
            icon={<Clock3 size={20} />}
            label="Pending Reviews"
            value={stats.pending}
            color="#A66B00"
            background="#FFF8D9"
          />

          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="Published Temples"
            value={stats.approved}
            color="#1A6B3A"
            background="#EBF7F0"
          />

          <StatCard
            icon={<XCircle size={20} />}
            label="Rejected Temples"
            value={stats.rejected}
            color="#9A3C05"
            background="#FDEDDD"
          />
        </div>

        <div
          className="volunteer-dashboard-content"
          style={styles.contentGrid}
        >
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.eyebrow}>
                  RECENT ACTIVITY
                </p>

                <h2 style={styles.panelTitle}>
                  Your Temple Submissions
                </h2>
              </div>

              <Link
                to="/volunteer/submissions"
                style={styles.smallLink}
              >
                View all &rarr;
              </Link>
            </div>

            {loading ? (
              <LoadingRows />
            ) : error ? (
              <div
                role="alert"
                style={styles.errorBox}
              >
                {error}
              </div>
            ) : recentSubmissions.length === 0 ? (
              <EmptySubmissions />
            ) : (
              recentSubmissions.map(
                (submission, index) => (
                  <SubmissionRow
                    key={submission.id}
                    submission={submission}
                    isLast={
                      index ===
                      recentSubmissions.length - 1
                    }
                  />
                )
              )
            )}
          </section>

          <aside style={styles.sidebar}>
            <section style={styles.sevaCard}>
              <div style={styles.sevaIcon}>
                <Landmark size={27} />
              </div>

              <p
                style={{
                  ...styles.eyebrow,
                  color: '#FFD580',
                }}
              >
                YOUR SEVA
              </p>

              <h2 style={styles.sevaTitle}>
                Help temples get discovered
              </h2>

              <p style={styles.sevaText}>
                Temple ka naam, address, deity aur clear
                description submit karein. Admin team
                verification ke baad profile live karegi.
              </p>

              <Link
                to="/AdminAddTemplePage"
                style={styles.goldButton}
              >
                Add Temple Information
              </Link>
            </section>

            <SubmissionGuide />

            {stats.rejected > 0 && (
              <section style={styles.rejectedCard}>
                <XCircle
                  size={24}
                  color="#B42318"
                />

                <div>
                  <strong>
                    {stats.rejected}{' '}
                    {stats.rejected === 1
                      ? 'rejected submission'
                      : 'rejected submissions'}
                  </strong>

                  <p style={styles.rejectedText}>
                    Admin feedback check karein.
                  </p>
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>

      <style>
        {`
          @media (max-width: 780px) {
            .volunteer-dashboard-content {
              grid-template-columns: 1fr !important;
            }

            .volunteer-dashboard-stats {
              margin-top: -28px !important;
            }
          }

          @media (max-width: 520px) {
            .volunteer-dashboard-stats {
              grid-template-columns: 1fr 1fr !important;
            }
          }

          @media (max-width: 390px) {
            .volunteer-dashboard-stats {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  background,
}) {
  return (
    <article style={styles.statCard}>
      <div
        style={{
          ...styles.statIcon,
          color,
          background,
        }}
      >
        {icon}
      </div>

      <div>
        <strong style={styles.statValue}>
          {value}
        </strong>

        <span style={styles.statLabel}>
          {label}
        </span>
      </div>
    </article>
  );
}

function SubmissionRow({
  submission,
  isLast,
}) {
  const location = [
    submission.city,
    submission.state,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      style={{
        ...styles.submissionRow,
        borderBottom: isLast
          ? 'none'
          : '1px solid #EDE3CE',
      }}
    >
      <div style={styles.templeIcon}>
        <Landmark size={21} />
      </div>

      <div style={styles.submissionDetails}>
        <h3 style={styles.templeName}>
          {submission.temple_name ||
            'Unnamed Temple'}
        </h3>

        <p style={styles.locationText}>
          {location || 'Location not provided'}
        </p>

        {submission.admin_note && (
          <p style={styles.adminNote}>
            Admin note: {submission.admin_note}
          </p>
        )}
      </div>

      <div style={styles.statusArea}>
        <SubmissionStatusBadge
          status={submission.status}
        />

        <p style={styles.dateText}>
          {formatDate(submission.created_at)}
        </p>
      </div>
    </article>
  );
}

function EmptySubmissions() {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}>
        <Landmark size={30} />
      </div>

      <h3 style={styles.emptyTitle}>
        Aapne abhi koi temple submit nahi kiya
      </h3>

      <p style={styles.emptyText}>
        Apni first temple entry add karke seva shuru
        karein.
      </p>

      <Link
        to="/AdminAddTemplePage"
        style={styles.primaryButton}
      >
        <Plus size={16} />
        Add First Temple
      </Link>
    </div>
  );
}

function SubmissionGuide() {
  const guideItems = [
    'Temple name aur location verify karein.',
    'Clear aur recent image URL use karein.',
    'Copied ya misleading information avoid karein.',
    'Admin note aaye to details update karein.',
  ];

  return (
    <section style={styles.panel}>
      <p style={styles.eyebrow}>
        SUBMISSION GUIDE
      </p>

      <h3 style={styles.guideTitle}>
        Before You Submit
      </h3>

      {guideItems.map((item, index) => (
        <div
          key={item}
          style={styles.guideRow}
        >
          <span style={styles.guideNumber}>
            {index + 1}
          </span>

          <span>{item}</span>
        </div>
      ))}
    </section>
  );
}

function LoadingRows() {
  return (
    <div>
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          style={styles.loadingRow}
        />
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#FAF6EE',
    color: '#2C1500',
  },

  hero: {
    position: 'relative',
    overflow: 'hidden',
    padding: '58px 20px',
    background:
      'linear-gradient(135deg, #4B1D04 0%, #7A3208 55%, #A14A0B 100%)',
    textAlign: 'center',
  },

  heroGlow: {
    width: 520,
    height: 260,
    position: 'absolute',
    top: -100,
    left: '50%',
    transform: 'translateX(-50%)',
    background:
      'radial-gradient(circle, rgba(255, 191, 73, 0.18), transparent 70%)',
  },

  heroInner: {
    maxWidth: 720,
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },

  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '6px 15px',
    background: 'rgba(255, 255, 255, 0.07)',
    border:
      '1px solid rgba(255, 213, 128, 0.3)',
    borderRadius: 50,
    color: '#FFD580',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.09em',
  },

  heroTitle: {
    margin: '18px 0 8px',
    color: '#FFFFFF',
    fontFamily:
      'var(--font-display, Georgia, serif)',
    fontSize: 'clamp(32px, 5vw, 52px)',
    lineHeight: 1.05,
  },

  heroHighlight: {
    color: '#FFD580',
  },

  heroText: {
    maxWidth: 590,
    margin: '0 auto',
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 14,
    lineHeight: 1.7,
  },

  heroActions: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 22,
  },

  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '12px 18px',
    background:
      'linear-gradient(135deg, #FF9900, #E56B08)',
    borderRadius: 10,
    color: '#2C1500',
    boxShadow:
      '0 5px 18px rgba(0, 0, 0, 0.2)',
    fontSize: 13,
    fontWeight: 800,
    textDecoration: 'none',
  },

  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '11px 18px',
    background: 'rgba(255, 255, 255, 0.07)',
    border:
      '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  },

  main: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '34px 20px 70px',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 14,
    marginTop: -58,
    position: 'relative',
    zIndex: 2,
  },

  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    background: '#FFFFFF',
    border: '1px solid #EDE3CE',
    borderRadius: 15,
    boxShadow:
      '0 8px 28px rgba(44, 21, 0, 0.10)',
  },

  statIcon: {
    width: 44,
    height: 44,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    borderRadius: 12,
  },

  statValue: {
    display: 'block',
    fontFamily:
      'var(--font-display, Georgia, serif)',
    fontSize: 28,
    lineHeight: 1,
  },

  statLabel: {
    color: '#7A5538',
    fontSize: 12,
  },

  contentGrid: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1.7fr) minmax(280px, 0.8fr)',
    gap: 22,
    marginTop: 26,
  },

  panel: {
    padding: 22,
    background: '#FFFFFF',
    border: '1px solid #EDE3CE',
    borderRadius: 16,
    boxShadow:
      '0 3px 14px rgba(44, 21, 0, 0.06)',
  },

  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },

  eyebrow: {
    margin: 0,
    color: '#C8520A',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.11em',
  },

  panelTitle: {
    margin: '4px 0 0',
    fontFamily:
      'var(--font-display, Georgia, serif)',
    fontSize: 25,
  },

  smallLink: {
    color: '#C8520A',
    fontSize: 12,
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },

  submissionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    padding: '15px 2px',
  },

  templeIcon: {
    width: 42,
    height: 42,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    background: '#FFF0E5',
    color: '#C8520A',
    borderRadius: 11,
  },

  submissionDetails: {
    flex: 1,
    minWidth: 0,
  },

  templeName: {
    margin: 0,
    overflow: 'hidden',
    fontSize: 15,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  locationText: {
    margin: '4px 0 0',
    color: '#7A5538',
    fontSize: 12,
  },

  adminNote: {
    margin: '5px 0 0',
    color: '#9A3C05',
    fontSize: 11,
  },

  statusArea: {
    textAlign: 'right',
  },

  dateText: {
    margin: '6px 0 0',
    color: '#A07050',
    fontSize: 10,
  },

  sidebar: {
    display: 'grid',
    alignContent: 'start',
    gap: 18,
  },

  sevaCard: {
    padding: 24,
    background:
      'linear-gradient(145deg, #3D1F00, #7A3208)',
    borderRadius: 16,
    boxShadow:
      '0 12px 32px rgba(44, 21, 0, 0.18)',
  },

  sevaIcon: {
    width: 48,
    height: 48,
    display: 'grid',
    placeItems: 'center',
    marginBottom: 14,
    background: 'rgba(255, 213, 128, 0.12)',
    border: '1px solid rgba(255, 213, 128, 0.3)',
    borderRadius: 13,
    color: '#FFD580',
  },

  sevaTitle: {
    margin: '6px 0 0',
    color: '#FFFFFF',
    fontFamily:
      'var(--font-display, Georgia, serif)',
    fontSize: 25,
  },

  sevaText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    lineHeight: 1.7,
  },

  goldButton: {
    display: 'block',
    marginTop: 16,
    padding: 11,
    background: '#FFD580',
    borderRadius: 9,
    color: '#3D1F00',
    fontSize: 13,
    fontWeight: 800,
    textAlign: 'center',
    textDecoration: 'none',
  },

  guideTitle: {
    margin: '4px 0 14px',
    fontFamily:
      'var(--font-display, Georgia, serif)',
    fontSize: 21,
  },

  guideRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '9px 0',
    color: '#5C3010',
    fontSize: 12,
    lineHeight: 1.45,
  },

  guideNumber: {
    width: 23,
    height: 23,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    background: '#FFF0E5',
    borderRadius: '50%',
    color: '#C8520A',
    fontWeight: 800,
  },

  rejectedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 18,
    background: '#FFFFFF',
    border: '1px solid #EDE3CE',
    borderRadius: 16,
  },

  rejectedText: {
    margin: '3px 0 0',
    color: '#7A5538',
    fontSize: 12,
  },

  empty: {
    padding: '52px 20px',
    textAlign: 'center',
  },

  emptyIcon: {
    width: 62,
    height: 62,
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto',
    background: '#FFF0E5',
    borderRadius: '50%',
    color: '#C8520A',
  },

  emptyTitle: {
    margin: '13px 0 5px',
  },

  emptyText: {
    margin: '0 0 15px',
    color: '#7A5538',
    fontSize: 14,
  },

  errorBox: {
    padding: 14,
    background: '#FDEAEA',
    borderRadius: 10,
    color: '#A52222',
  },

  loadingRow: {
    height: 72,
    marginBottom: 8,
    background:
      'linear-gradient(90deg, #F4EBDD, #FFFFFF, #F4EBDD)',
    borderRadius: 10,
  }, 
};


