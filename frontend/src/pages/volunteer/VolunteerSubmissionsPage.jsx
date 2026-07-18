import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
  useLocation,
} from 'react-router-dom';

import {
  FileText,
  Landmark,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import VolunteerNavbar from '../../components/volunteer/VolunteerNavbar';
import SubmissionStatusBadge from '../../components/volunteer/SubmissionStatusBadge';
import { volunteerApi } from '../../services/volunteerApi';

const statusOptions = [
  {
    value: 'all',
    label: 'All Statuses',
  },
  {
    value: 'pending_review',
    label: 'Pending Review',
  },
  {
    value: 'changes_requested',
    label: 'Changes Requested',
  },
  {
    value: 'published',
    label: 'Published',
  },
  {
    value: 'rejected',
    label: 'Rejected',
  },
];

export default function VolunteerSubmissionsPage() {
  const location = useLocation();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] =
    useState('all');
  const [error, setError] = useState('');

  const loadSubmissions = async () => {
    setLoading(true);
    setError('');

    try {
      const response =
        await volunteerApi.listSubmissions();

      setSubmissions(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
        'Unable to load submissions.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const filteredSubmissions = useMemo(() => {
    const normalizedQuery =
      query.trim().toLowerCase();

    return submissions.filter((submission) => {
      const matchesStatus =
        statusFilter === 'all' ||
        submission.status === statusFilter;

      const searchableText = [
        submission.temple_name,
        submission.city,
        submission.district,
        submission.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        normalizedQuery === '' ||
        searchableText.includes(normalizedQuery);

      return matchesStatus && matchesSearch;
    });
  }, [
    submissions,
    query,
    statusFilter,
  ]);

  const handleDelete = async (submission) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the "${submission.temple_name}" submission?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(submission.id);
    setError('');

    try {
      await volunteerApi.deleteSubmission(
        submission.id
      );

      setSubmissions((currentSubmissions) =>
        currentSubmissions.filter(
          (item) => item.id !== submission.id
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
        'Unable to delete the submission.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={styles.page}>
      <VolunteerNavbar />

      <section style={styles.hero}>
        <div style={styles.heroBadge}>
          <FileText size={14} />
          MY CONTRIBUTIONS
        </div>

        <h1 style={styles.heroTitle}>
          Temple{' '}
          <span style={styles.heroHighlight}>
            Submissions
          </span>
        </h1>

        <p style={styles.heroText}>
          Track the review status of your submitted temples
          and monitor administrator feedback.
        </p>
      </section>

      <main style={styles.main}>
        {location.state?.message && (
          <div
            role="status"
            style={styles.successBox}
          >
            {location.state.message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={styles.errorBox}
          >
            {error}
          </div>
        )}

        <section style={styles.toolbar}>
          <div style={styles.searchWrapper}>
            <Search
              size={17}
              color="#9A684A"
            />

            <input
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search temple, city or state..."
              aria-label="Search submissions"
              style={styles.searchInput}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            aria-label="Filter submissions by status"
            style={styles.select}
          >
            {statusOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <Link
            to="/volunteer/add-temple"
            style={styles.addButton}
          >
            <Plus size={17} />
            Add Temple
          </Link>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.eyebrow}>
                TEMPLE RECORDS
              </p>

              <h2 style={styles.panelTitle}>
                My Submissions
              </h2>
            </div>

            <span style={styles.resultCount}>
              {filteredSubmissions.length}{' '}
              {filteredSubmissions.length === 1
                ? 'submission'
                : 'submissions'}
            </span>
          </div>

          {loading ? (
            <LoadingRows />
          ) : filteredSubmissions.length === 0 ? (
            <EmptyState
              hasFilters={
                query.trim() !== '' ||
                statusFilter !== 'all'
              }
              onClear={() => {
                setQuery('');
                setStatusFilter('all');
              }}
            />
          ) : (
            <div>
              {filteredSubmissions.map(
                (submission, index) => (
                  <SubmissionRow
                    key={submission.id}
                    submission={submission}
                    isLast={
                      index ===
                      filteredSubmissions.length - 1
                    }
                    deleting={
                      deletingId === submission.id
                    }
                    onDelete={() =>
                      handleDelete(submission)
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </main>

      <style>
        {`
          @media (max-width: 650px) {
            .volunteer-submission-row {
              align-items: flex-start !important;
              flex-wrap: wrap !important;
            }

            .volunteer-submission-actions {
              width: 100% !important;
              display: flex !important;
              align-items: center !important;
              justify-content: space-between !important;
              padding-left: 58px !important;
            }
          }

          @media (max-width: 480px) {
            .volunteer-submission-actions {
              padding-left: 0 !important;
            }
          }
        `}
      </style>
    </div>
  );
}

function SubmissionRow({
  submission,
  isLast,
  deleting,
  onDelete,
}) {
  const canDelete = [
    'draft',
    'changes_requested',
  ].includes(submission.status);

  const location = [
    submission.city,
    submission.district,
    submission.state,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      className="volunteer-submission-row"
      style={{
        ...styles.submissionRow,
        borderBottom: isLast
          ? 'none'
          : '1px solid #EDE3CE',
      }}
    >
      <div style={styles.templeIcon}>
        <Landmark size={22} />
      </div>

      <div style={styles.submissionContent}>
        <h3 style={styles.templeName}>
          {submission.temple_name ||
            'Unnamed Temple'}
        </h3>

        <p style={styles.location}>
          {location || 'Location not provided'}
        </p>

        <p style={styles.submittedDate}>
          Submitted:{' '}
          {formatDate(submission.created_at)}
        </p>

        {submission.admin_note && (
          <div style={styles.adminNote}>
            <strong>Admin note:</strong>{' '}
            {submission.admin_note}
          </div>
        )}
      </div>

      <div
        className="volunteer-submission-actions"
        style={styles.actions}
      >
        <SubmissionStatusBadge
          status={submission.status}
        />

        {['draft', 'changes_requested'].includes(submission.status) && (
          <Link to={`/volunteer/submissions/${submission.id}/edit`} style={{ color: '#C8520A', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
            Continue Editing
          </Link>
        )}

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            style={{
              ...styles.deleteButton,
              ...(deleting
                ? styles.disabledDeleteButton
                : {}),
            }}
          >
            <Trash2 size={14} />

            {deleting
              ? 'Deleting...'
              : 'Delete'}
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>
        <Landmark size={32} />
      </div>

      <h3 style={styles.emptyTitle}>
        {hasFilters
          ? 'No matching submissions found'
              : 'You have not submitted a temple yet'}
      </h3>

      <p style={styles.emptyText}>
        {hasFilters
                ? 'Change the search or status filter and try again.'
                : 'Add your first temple entry to begin contributing.'}
      </p>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          style={styles.clearButton}
        >
          Clear Filters
        </button>
      ) : (
        <Link
          to="/volunteer/add-temple"
          style={styles.addButton}
        >
          <Plus size={17} />
          Add First Temple
        </Link>
      )}
    </div>
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
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
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
    padding: '46px 20px',
    background:
      'linear-gradient(135deg, #4B1D04 0%, #7A3208 55%, #A14A0B 100%)',
    textAlign: 'center',
  },

  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    color: '#FFD580',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.1em',
  },

  heroTitle: {
    margin: '14px 0 6px',
    color: '#FFFFFF',
    fontFamily:
      'var(--font-display, Georgia, serif)',
    fontSize: 'clamp(32px, 5vw, 48px)',
  },

  heroHighlight: {
    color: '#FFD580',
  },

  heroText: {
    maxWidth: 600,
    margin: '0 auto',
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 14,
    lineHeight: 1.6,
  },

  main: {
    maxWidth: 1050,
    margin: '0 auto',
    padding: '30px 20px 70px',
  },

  successBox: {
    marginBottom: 14,
    padding: 13,
    background: '#EBF7F0',
    border: '1px solid #CBE8D5',
    borderRadius: 9,
    color: '#1A6B3A',
    fontSize: 13,
  },

  errorBox: {
    marginBottom: 14,
    padding: 13,
    background: '#FDEAEA',
    border: '1px solid #F0CACA',
    borderRadius: 9,
    color: '#A52222',
    fontSize: 13,
  },

  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },

  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    flex: '1 1 270px',
    gap: 8,
    padding: '0 13px',
    background: '#FFFFFF',
    border: '1px solid #E2D4BC',
    borderRadius: 10,
  },

  searchInput: {
    width: '100%',
    padding: '12px 0',
    background: 'transparent',
    border: 0,
    color: '#2C1500',
    fontSize: 14,
    outline: 0,
  },

  select: {
    padding: '11px 13px',
    background: '#FFFFFF',
    border: '1px solid #E2D4BC',
    borderRadius: 10,
    color: '#4D2A12',
    cursor: 'pointer',
    outlineColor: '#C8520A',
  },

  addButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '11px 16px',
    background:
      'linear-gradient(135deg, #D45B08, #B94305)',
    border: 0,
    borderRadius: 10,
    color: '#FFFFFF',
    boxShadow:
      '0 5px 14px rgba(200, 82, 10, 0.2)',
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  },

  panel: {
    padding: '8px 22px',
    background: '#FFFFFF',
    border: '1px solid #EDE3CE',
    borderRadius: 16,
    boxShadow:
      '0 4px 18px rgba(44, 21, 0, 0.07)',
  },

  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
    padding: '17px 2px',
    borderBottom: '1px solid #EDE3CE',
  },

  eyebrow: {
    margin: 0,
    color: '#C8520A',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.1em',
  },

  panelTitle: {
    margin: '3px 0 0',
    fontFamily:
      'var(--font-display, Georgia, serif)',
    fontSize: 24,
  },

  resultCount: {
    padding: '7px 11px',
    background: '#FFF5E8',
    borderRadius: 50,
    color: '#8F3B08',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  submissionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '19px 2px',
  },

  templeIcon: {
    width: 46,
    height: 46,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    background: '#FFF0E5',
    borderRadius: 12,
    color: '#C8520A',
  },

  submissionContent: {
    flex: 1,
    minWidth: 0,
  },

  templeName: {
    margin: 0,
    overflow: 'hidden',
    color: '#351805',
    fontSize: 16,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  location: {
    margin: '5px 0 0',
    color: '#7A5538',
    fontSize: 12,
  },

  submittedDate: {
    margin: '4px 0 0',
    color: '#9A7559',
    fontSize: 11,
  },

  adminNote: {
    display: 'inline-block',
    marginTop: 9,
    padding: '7px 10px',
    background: '#FFF0E5',
    borderRadius: 7,
    color: '#8F3505',
    fontSize: 11,
    lineHeight: 1.5,
  },

  actions: {
    display: 'grid',
    justifyItems: 'end',
    flexShrink: 0,
    gap: 10,
  },

  deleteButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: 0,
    background: 'transparent',
    border: 0,
    color: '#B42318',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },

  disabledDeleteButton: {
    color: '#A88A82',
    cursor: 'not-allowed',
  },

  emptyState: {
    padding: '65px 20px',
    textAlign: 'center',
  },

  emptyIcon: {
    width: 65,
    height: 65,
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto',
    background: '#FFF0E5',
    borderRadius: '50%',
    color: '#C8520A',
  },

  emptyTitle: {
    margin: '14px 0 5px',
    color: '#351805',
  },

  emptyText: {
    maxWidth: 430,
    margin: '0 auto 17px',
    color: '#7A5538',
    fontSize: 13,
    lineHeight: 1.6,
  },

  clearButton: {
    padding: '10px 16px',
    background: '#FFF0E5',
    border: '1px solid #E8C8AD',
    borderRadius: 9,
    color: '#A74308',
    fontWeight: 700,
    cursor: 'pointer',
  },

  loadingRow: {
    height: 86,
    margin: '10px 0',
    background:
      'linear-gradient(90deg, #F4EBDD, #FFFFFF, #F4EBDD)',
    borderRadius: 10,
  },
};
