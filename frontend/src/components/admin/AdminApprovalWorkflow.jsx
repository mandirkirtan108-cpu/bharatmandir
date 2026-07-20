import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('bm_access_token') || ''}`,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(', ')
      : data.detail;
    throw new Error(detail || `Request failed with HTTP ${response.status}`);
  }
  return data;
}

export default function AdminApprovalWorkflow() {
  const [tab, setTab] = useState('volunteers');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = tab === 'volunteers'
        ? '/api/volunteer/auth/admin/volunteers?approval_status=pending'
        : '/api/admin/volunteer-submissions?status=pending_review';
      setItems(await request(path));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const performReview = async (id, action) => {
    if (action !== 'approved' && !reason.trim()) {
      setError('Enter admin remarks before rejecting or requesting changes.');
      return;
    }

    setProcessing(`${id}:${action}`);
    setError('');
    setSuccess('');

    try {
      if (tab === 'volunteers') {
        await request(`/api/volunteer/auth/admin/volunteers/${id}/approval`, {
          method: 'PATCH',
          body: JSON.stringify({
            action,
            rejection_reason: reason.trim() || null,
          }),
        });
      } else {
        await request(`/api/admin/volunteer-submissions/${id}/review`, {
          method: 'POST',
          body: JSON.stringify({
            action,
            admin_note: reason.trim() || null,
          }),
        });
      }

      const message = tab === 'volunteers'
        ? action === 'approved'
          ? 'Volunteer approved successfully.'
          : 'Volunteer rejected successfully.'
        : action === 'approved'
          ? 'Temple published successfully.'
          : action === 'changes_requested'
            ? 'Change request sent successfully.'
            : 'Temple submission rejected successfully.';

      setReason('');
      setSuccess(message);
      await load();
    } catch (err) {
      setError(err.message || 'The review could not be completed.');
    } finally {
      setProcessing('');
    }
  };

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setReason('');
    setError('');
    setSuccess('');
  };

  return (
    <section style={styles.wrap}>
      <div style={styles.head}>
        <div>
          <p style={styles.kicker}>APPROVAL WORKFLOW</p>
          <h2 style={styles.title}>Verification Center</h2>
        </div>
        <button disabled={loading || Boolean(processing)} onClick={load} style={styles.refresh}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => switchTab('volunteers')} style={{ ...styles.tab, ...(tab === 'volunteers' ? styles.active : {}) }}>
          Volunteer Verification
        </button>
        <button onClick={() => switchTab('temples')} style={{ ...styles.tab, ...(tab === 'temples' ? styles.active : {}) }}>
          Temple Verification
        </button>
      </div>

      <div style={styles.note}>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Admin remarks (required for reject/change request)"
          style={styles.input}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {loading ? (
        <p style={styles.empty}>Loading verification queue...</p>
      ) : items.length === 0 ? (
        <p style={styles.empty}>No pending items.</p>
      ) : (
        <div style={styles.list}>
          {items.map((item) => {
            const dateValue = item.registered_at || item.submitted_at || item.created_at;
            return (
              <article key={item.id} style={styles.card}>
                <div style={styles.icon}><ShieldCheck size={21} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={styles.name}>{tab === 'volunteers' ? item.name : item.temple_name}</h3>
                  <p style={styles.meta}>
                    {tab === 'volunteers'
                      ? `${item.email} · ${[item.city, item.state].filter(Boolean).join(', ') || 'Location not provided'}`
                      : `${item.volunteer_name} · ${[item.city, item.state].filter(Boolean).join(', ') || 'Location not provided'}`}
                  </p>
                  <p style={styles.meta}>
                    Registered/submitted: {dateValue ? new Date(dateValue).toLocaleDateString('en-IN') : 'Not available'}
                  </p>
                  {tab === 'temples' && item.description && <p style={styles.description}>{item.description}</p>}
                </div>

                <div style={styles.actions}>
                  <ActionButton
                    disabled={Boolean(processing)}
                    busy={processing === `${item.id}:approved`}
                    style={styles.approve}
                    onClick={() => performReview(item.id, 'approved')}
                    icon={<CheckCircle2 size={14} />}
                    label={tab === 'volunteers' ? 'Approve' : 'Publish'}
                  />
                  {tab === 'temples' && (
                    <ActionButton
                      disabled={Boolean(processing)}
                      busy={processing === `${item.id}:changes_requested`}
                      style={styles.change}
                      onClick={() => performReview(item.id, 'changes_requested')}
                      label="Request changes"
                    />
                  )}
                  <ActionButton
                    disabled={Boolean(processing)}
                    busy={processing === `${item.id}:rejected`}
                    style={styles.reject}
                    onClick={() => performReview(item.id, 'rejected')}
                    icon={<XCircle size={14} />}
                    label="Reject"
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ActionButton({ busy, disabled, icon, label, onClick, style }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...style, ...(disabled ? styles.disabled : {}) }}>
      {icon}{busy ? 'Processing...' : label}
    </button>
  );
}

const styles = {
  wrap: { background: '#fff', border: '1px solid #ead9c3', borderRadius: 18, padding: 24, boxShadow: '0 8px 28px rgba(70,30,5,.08)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  kicker: { margin: 0, color: '#c8520a', fontSize: 10, fontWeight: 800, letterSpacing: '.12em' },
  title: { margin: '4px 0 0', fontFamily: 'var(--font-display)', color: '#3d1f00' },
  refresh: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 13px', border: '1px solid #e7d4bc', borderRadius: 9, background: '#fff8ef', color: '#8b3d0a', cursor: 'pointer' },
  tabs: { display: 'flex', gap: 8, margin: '22px 0 14px', flexWrap: 'wrap' },
  tab: { padding: '10px 15px', border: '1px solid #e7d4bc', borderRadius: 9, background: '#fff', color: '#734522', fontWeight: 700, cursor: 'pointer' },
  active: { background: '#c8520a', color: '#fff', borderColor: '#c8520a' },
  note: { marginBottom: 14 },
  input: { width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #dfc9ac', borderRadius: 9 },
  error: { padding: 11, background: '#fdeaea', color: '#a22', borderRadius: 8, marginBottom: 12 },
  success: { padding: 11, background: '#e7f7ed', color: '#176b38', borderRadius: 8, marginBottom: 12 },
  empty: { padding: 40, textAlign: 'center', color: '#8b6b50' },
  list: { display: 'grid', gap: 11 },
  card: { display: 'flex', alignItems: 'flex-start', gap: 13, padding: 16, border: '1px solid #eee1d0', borderRadius: 12, flexWrap: 'wrap' },
  icon: { width: 43, height: 43, display: 'grid', placeItems: 'center', borderRadius: 11, background: '#fff0e5', color: '#c8520a' },
  name: { margin: 0, fontSize: 16, color: '#3d1f00' },
  meta: { margin: '4px 0 0', fontSize: 12, color: '#806047' },
  description: { margin: '8px 0 0', fontSize: 12, color: '#5f402a', lineHeight: 1.5 },
  actions: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  approve: { display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', border: 0, borderRadius: 8, background: '#e7f7ed', color: '#176b38', fontWeight: 700, cursor: 'pointer' },
  change: { padding: '9px 12px', border: 0, borderRadius: 8, background: '#fff0dc', color: '#9a4b00', fontWeight: 700, cursor: 'pointer' },
  reject: { display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', border: 0, borderRadius: 8, background: '#fdeaea', color: '#a22', fontWeight: 700, cursor: 'pointer' },
  disabled: { opacity: 0.55, cursor: 'not-allowed' },
};
