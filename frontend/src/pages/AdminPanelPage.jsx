/**
 * AdminPanelPage.jsx — BharatMandir Admin Panel
 * Fixed: JWT Bearer token auth + proper error message parsing
 * Updated: Added "Add Festival" button + Logout button in controls bar
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Archive, Eye, RefreshCw,
  Search, Shield, ShieldCheck, ExternalLink, Clock,
  MapPin, User, Star, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle, LayoutDashboard, PlusCircle,
  CalendarPlus, LogOut
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── JWT auth helper — reads token from sessionStorage ────────────────────────
function getAuthHeaders() {
  const token = sessionStorage.getItem('bm_access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// ── Status metadata ───────────────────────────────────────────────────────────
const STATUS_META = {
  draft:     { label: 'Draft',     color: '#8B6040', bg: '#FDF8F0', dot: '#C8960C' },
  review:    { label: 'In Review', color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6' },
  published: { label: 'Published', color: '#15803d', bg: '#f0fdf4', dot: '#22c55e' },
  flagged:   { label: 'Flagged',   color: '#b91c1c', bg: '#fef2f2', dot: '#ef4444' },
  archived:  { label: 'Archived',  color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
};

const ALL_STATUSES = ['all', 'draft', 'review', 'published', 'flagged', 'archived'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 50,
      background: m.bg, color: m.color,
      fontSize: 12, fontFamily: 'var(--font-display)',
      letterSpacing: '.04em', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

// ── API calls — always fresh JWT headers ──────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...opts,
    headers: {
      ...getAuthHeaders(),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let detail;
    if (Array.isArray(err.detail)) {
      detail = err.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
    } else if (typeof err.detail === 'string') {
      detail = err.detail;
    } else if (err.detail) {
      detail = JSON.stringify(err.detail);
    } else {
      detail = `HTTP ${res.status}`;
    }
    throw new Error(detail);
  }
  return res.json();
}

async function fetchTemples(status, page, search) {
  const params = new URLSearchParams({ page, per_page: 15 });
  if (status && status !== 'all') params.append('status', status);
  return apiFetch(`/api/admin/temples?${params}`);
}

async function fetchTempleDetail(id) {
  return apiFetch(`/api/admin/temples/${id}`);
}

async function patchStatus(id, status) {
  return apiFetch(`/api/admin/temples/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

async function patchVerify(id) {
  return apiFetch(`/api/admin/temples/${id}/verify`, { method: 'PATCH' });
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ temple, onClose, onStatusChange, onVerify }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchTempleDetail(temple.slug || temple.id)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => { setDetail(temple); setLoading(false); });
  }, [temple.id]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const doStatus = async (status) => {
    setActionLoading(status);
    try {
      await patchStatus(temple.id, status);
      showToast(`Temple moved to "${status}"`);
      onStatusChange(temple.id, status);
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setActionLoading(null);
    }
  };

  const doVerify = async () => {
    setActionLoading('verify');
    try {
      await patchVerify(temple.id);
      showToast('Temple verified ✓');
      onVerify(temple.id);
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setActionLoading(null);
    }
  };

  const t = detail || temple;
  const currentStatus = t.status || temple.status;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(29,15,0,.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--cream)', borderRadius: 20,
        width: '100%', maxWidth: 760, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(61,31,0,.35)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--saffron-dark), var(--brown-mid))',
          padding: '20px 28px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <StatusBadge status={currentStatus} />
              {t.verified && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(255,255,255,.15)', color: 'white',
                  padding: '3px 10px', borderRadius: 50, fontSize: 11,
                  fontFamily: 'var(--font-display)', letterSpacing: '.04em',
                }}>
                  <ShieldCheck size={12} /> Verified
                </span>
              )}
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', color: 'white',
              fontSize: 22, fontWeight: 700, margin: 0,
            }}>{t.name}</h2>
            {t.name_hindi && (
              <p style={{ fontFamily: 'var(--font-hindi)', color: 'rgba(255,255,255,.75)', margin: '2px 0 0', fontSize: 14 }}>
                {t.name_hindi}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', color: 'white',
            borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,.3)'}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,.15)'}
          >×</button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            background: toast.ok ? '#f0fdf4' : '#fef2f2',
            color: toast.ok ? '#15803d' : '#b91c1c',
            padding: '10px 20px', textAlign: 'center',
            fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.04em',
          }}>
            {toast.ok ? '✓' : '⚠'} {toast.msg}
          </div>
        )}

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 28px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <Loader2 size={32} color="var(--saffron)" style={{ animation: 'spin .8s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              <InfoSection title="🏛️ Identity">
                <Row label="MKT ID" value={t.mkt_id} mono />
                <Row label="Slug" value={t.slug} mono />
                <Row label="Deity" value={t.primary_deity} />
                <Row label="Sect" value={t.sect} />
                <Row label="Type" value={t.temple_type} />
                <Row label="Architecture" value={t.architecture_style} />
                <Row label="Est. Year" value={t.estimated_year_built} />
              </InfoSection>

              <InfoSection title="📍 Location">
                <Row label="City" value={t.city} />
                <Row label="District" value={t.district} />
                <Row label="State" value={t.state} />
                <Row label="Pincode" value={t.pincode} />
                <Row label="Lat/Lng" value={t.latitude ? `${t.latitude}, ${t.longitude}` : null} />
                <Row label="Nearest Rail" value={t.nearest_railway} />
                <Row label="Nearest Airport" value={t.nearest_airport} />
              </InfoSection>

              <InfoSection title="⭐ Heritage Designations" fullWidth>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    ['Jyotirlinga', t.is_jyotirlinga], ['Shaktipeeth', t.is_shaktipeeth],
                    ['Divya Desam', t.is_divya_desam], ['Ashtavinayak', t.is_ashtavinayak],
                    ['Char Dham', t.is_char_dham], ['Heritage Site', t.is_heritage_site],
                    ['ASI Protected', t.is_asi_protected], ['Pancha Bhuta', t.is_pancha_bhuta],
                    ['51 Shakti Peeths', t.is_51_shakti_peeths], ['UNESCO', t.is_unesco_heritage],
                    ['State Heritage', t.is_state_heritage],
                  ].map(([label, val]) => (
                    <span key={label} style={{
                      padding: '3px 10px', borderRadius: 50, fontSize: 12,
                      fontFamily: 'var(--font-display)', letterSpacing: '.03em',
                      background: val ? '#fef3c7' : '#f3f4f6',
                      color: val ? '#92400e' : '#9ca3af',
                      fontWeight: val ? 700 : 400,
                    }}>
                      {val ? '✓' : '·'} {label}
                    </span>
                  ))}
                </div>
              </InfoSection>

              {t.history && (
                <InfoSection title="📖 History" fullWidth>
                  <p style={{ color: 'var(--text-mid)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    {t.history.slice(0, 400)}{t.history.length > 400 ? '…' : ''}
                  </p>
                </InfoSection>
              )}

              <InfoSection title="🕐 Timings">
                <Row label="Opens" value={t.opening_time} />
                <Row label="Closes" value={t.closing_time} />
                <Row label="Afternoon Break" value={t.afternoon_closure_start ? `${t.afternoon_closure_start} – ${t.afternoon_closure_end}` : null} />
                <Row label="Special Day" value={t.weekly_special_day} />
                <Row label="Online Puja" value={t.online_puja_available} />
                <Row label="Live Darshan" value={t.live_darshan_available} />
              </InfoSection>

              <InfoSection title="📋 Submission Meta">
                <Row label="Submitted" value={fmtDate(t.submitted_at)} />
                <Row label="Created" value={fmtDate(t.created_at)} />
                <Row label="Published" value={fmtDate(t.published_at)} />
                <Row label="Source" value={t.source} />
                <Row label="Managing Auth." value={t.managing_authority} />
                <Row label="Trust Name" value={t.trust_name} />
                <Row label="Trust Reg No." value={t.trust_registration_no} />
              </InfoSection>

              <InfoSection title="💳 Donations & Finance">
                <Row label="UPI ID" value={t.upi_id} mono />
                <Row label="Bank Name/Branch" value={t.bank_name_branch} />
                <Row label="IFSC" value={t.bank_ifsc} mono />
                <Row label="80G Certificate" value={t.certificate_80g_no} />
                <Row label="Online Donations" value={t.accept_online_donations ? 'Yes' : 'No'} />
              </InfoSection>

              <InfoSection title="📞 Contact">
                <Row label="Phone" value={t.phone} />
                <Row label="WhatsApp" value={t.whatsapp_number} />
                <Row label="Email" value={t.official_email} />
                <Row label="Website" value={t.website_url} />
                <Row label="Instagram" value={t.instagram_handle} />
                <Row label="YouTube" value={t.youtube_channel} />
              </InfoSection>

            </div>
          )}
        </div>

        {/* Action Footer */}
        <div style={{
          borderTop: '2px solid var(--cream-dark)',
          padding: '16px 28px', background: 'white',
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {currentStatus !== 'published' && (
              <ActionBtn icon={<CheckCircle2 size={15} />} label="Approve"
                color="#15803d" bg="#f0fdf4" border="#86efac"
                loading={actionLoading === 'published'} onClick={() => doStatus('published')} />
            )}
            {currentStatus === 'draft' && (
              <ActionBtn icon={<Clock size={15} />} label="Mark In Review"
                color="#1d4ed8" bg="#eff6ff" border="#93c5fd"
                loading={actionLoading === 'review'} onClick={() => doStatus('review')} />
            )}
            {currentStatus !== 'flagged' && (
              <ActionBtn icon={<XCircle size={15} />} label="Flag / Reject"
                color="#b91c1c" bg="#fef2f2" border="#fca5a5"
                loading={actionLoading === 'flagged'} onClick={() => doStatus('flagged')} />
            )}
            {currentStatus !== 'archived' && (
              <ActionBtn icon={<Archive size={15} />} label="Archive"
                color="#6b7280" bg="#f3f4f6" border="#d1d5db"
                loading={actionLoading === 'archived'} onClick={() => doStatus('archived')} />
            )}
            {!t.verified && (
              <ActionBtn icon={<ShieldCheck size={15} />} label="Mark Verified"
                color="#7c3aed" bg="#f5f3ff" border="#c4b5fd"
                loading={actionLoading === 'verify'} onClick={doVerify} />
            )}
          </div>
          {currentStatus === 'published' && t.slug && (
            <Link to={`/temple/${t.slug}`} target="_blank" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              color: 'var(--saffron)', fontSize: 13,
              fontFamily: 'var(--font-display)', letterSpacing: '.04em',
            }}>
              <ExternalLink size={14} /> View Live Page
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoSection({ title, children, fullWidth }) {
  return (
    <div style={{
      gridColumn: fullWidth ? '1 / -1' : undefined,
      background: 'white', borderRadius: 12, padding: '16px 18px',
      border: '1.5px solid var(--cream-dark)',
    }}>
      <h4 style={{
        fontFamily: 'var(--font-display)', fontSize: 12,
        letterSpacing: '.08em', color: 'var(--saffron)',
        margin: '0 0 10px', textTransform: 'uppercase',
      }}>{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  if (!value && value !== 0 && value !== false) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--text-light)', fontSize: 12, minWidth: 100, flexShrink: 0, fontFamily: 'var(--font-display)', letterSpacing: '.03em' }}>
        {label}
      </span>
      <span style={{ color: 'var(--text-dark)', fontSize: 13, lineHeight: 1.4, fontFamily: mono ? 'monospace' : 'var(--font-body)', wordBreak: 'break-all' }}>
        {String(value)}
      </span>
    </div>
  );
}

function ActionBtn({ icon, label, color, bg, border, loading, onClick }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 50,
      background: bg, color, border: `1.5px solid ${border}`,
      fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.04em',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? .6 : 1, transition: 'all .2s', fontWeight: 600,
    }}>
      {loading ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> : icon}
      {label}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPanelPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]         = useState('all');
  const [temples, setTemples]             = useState([]);
  const [counts, setCounts]               = useState({});
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [search, setSearch]               = useState('');
  const [reviewing, setReviewing]         = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const PER_PAGE = 15;

  useEffect(() => {
    const token = sessionStorage.getItem('bm_access_token');
    if (!token) navigate('/admin/login', { replace: true });
  }, []);

  // ── Logout handler ──────────────────────────────────────────────────────────
  const handleLogout = () => {
    sessionStorage.removeItem('bm_access_token');
    sessionStorage.removeItem('bm_refresh_token');
    sessionStorage.removeItem('bm_admin_user');
    navigate('/admin/login', { replace: true });
  };

  const loadTemples = useCallback(async (tab = activeTab, pg = page) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemples(tab, pg, search);
      setTemples(data.temples || []);
      setTotal(data.total || 0);
    } catch (e) {
      if (e.message.includes('401') || e.message.toLowerCase().includes('unauthorized')) {
        sessionStorage.removeItem('bm_access_token');
        sessionStorage.removeItem('bm_refresh_token');
        sessionStorage.removeItem('bm_admin_user');
        navigate('/admin/login', { replace: true });
        return;
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search]);

  const loadCounts = useCallback(async () => {
    const statuses = ['draft', 'review', 'published', 'flagged', 'archived'];
    const results = {};
    const all = await fetchTemples('all', 1).catch(() => ({ total: 0 }));
    results['all'] = all.total || 0;
    await Promise.all(statuses.map(async s => {
      const d = await fetchTemples(s, 1).catch(() => ({ total: 0 }));
      results[s] = d.total || 0;
    }));
    setCounts(results);
  }, []);

  useEffect(() => { loadTemples(activeTab, page); }, [activeTab, page]);
  useEffect(() => { loadCounts(); }, []);

  const switchTab = (tab) => { setActiveTab(tab); setPage(1); };

  const handleStatusChange = (id, newStatus) => {
    setTemples(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    loadCounts();
    if (reviewing?.id === id) setReviewing(prev => ({ ...prev, status: newStatus }));
  };

  const handleVerify = (id) => {
    setTemples(prev => prev.map(t => t.id === id ? { ...t, verified: true } : t));
    if (reviewing?.id === id) setReviewing(prev => ({ ...prev, verified: true }));
  };

  const quickAction = async (temple, status, e) => {
    e.stopPropagation();
    const key = `${temple.id}-${status}`;
    setActionLoading(key);
    try {
      await patchStatus(temple.id, status);
      handleStatusChange(temple.id, status);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);
  const displayed = search.trim()
    ? temples.filter(t =>
        [t.name, t.city, t.state, t.primary_deity, t.mkt_id]
          .some(v => v && v.toLowerCase().includes(search.toLowerCase()))
      )
    : temples;

  return (
    <>
      <Navbar />
      <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: 60 }}>

        {/* Page Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--saffron-dark) 0%, var(--brown-mid) 60%, var(--brown) 100%)',
          padding: '36px 24px 28px',
        }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
              <LayoutDashboard size={28} color="rgba(255,255,255,.85)" />
              <h1 style={{
                fontFamily: 'var(--font-display)', color: 'white',
                fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '.02em',
              }}>Admin Panel</h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,.65)', fontFamily: 'var(--font-hindi)', margin: 0, fontSize: 14 }}>
              Temple Onboarding & Verification Dashboard
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Total', value: counts.all || 0, color: '#F5934A' },
                { label: 'Pending Review', value: (counts.draft || 0) + (counts.review || 0), color: '#60a5fa' },
                { label: 'Published', value: counts.published || 0, color: '#4ade80' },
                { label: 'Flagged', value: counts.flagged || 0, color: '#f87171' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,.12)', borderRadius: 12,
                  padding: '10px 18px', backdropFilter: 'blur(8px)',
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: s.color, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'rgba(255,255,255,.7)', letterSpacing: '.06em' }}>
                    {s.label.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container" style={{ marginTop: 28 }}>

          {/* ── Controls: Search + Add Temple + Add Festival + Refresh + Logout ── */}
          <div style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
          }}>
            {/* Search — grows to fill space */}
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
              <Search size={16} style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none',
              }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by name, city, deity, MKT ID…"
                style={{
                  width: '100%', padding: '10px 14px 10px 40px',
                  border: '2px solid var(--cream-dark)', borderRadius: 50,
                  fontFamily: 'var(--font-body)', fontSize: 14,
                  background: 'white', color: 'var(--text-dark)', outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
              />
            </div>

            {/* Add Temple button */}
            <Link
              to="/admin/add"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px',
                background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
                border: '2px solid transparent',
                borderRadius: 50,
                fontFamily: 'var(--font-display)', fontSize: 13,
                letterSpacing: '.04em', fontWeight: 700,
                color: 'white', textDecoration: 'none',
                whiteSpace: 'nowrap', flexShrink: 0,
                boxShadow: '0 2px 12px rgba(200,100,0,.25)',
                transition: 'all .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(200,100,0,.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(200,100,0,.25)'; }}
            >
              <PlusCircle size={15} />
              <span className="btn-label-temple">Add Temple</span>
            </Link>

            {/* Add Festival button */}
            <Link
              to="/admin/add-festival"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                border: '2px solid transparent',
                borderRadius: 50,
                fontFamily: 'var(--font-display)', fontSize: 13,
                letterSpacing: '.04em', fontWeight: 700,
                color: 'white', textDecoration: 'none',
                whiteSpace: 'nowrap', flexShrink: 0,
                boxShadow: '0 2px 12px rgba(124,58,237,.25)',
                transition: 'all .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(124,58,237,.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(124,58,237,.25)'; }}
            >
              <CalendarPlus size={15} />
              <span className="btn-label-festival">Add Festival</span>
            </Link>

            {/* Refresh button */}
            <button
              onClick={() => { loadTemples(); loadCounts(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', border: '2px solid var(--cream-dark)',
                borderRadius: 50, background: 'white',
                fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.05em',
                cursor: 'pointer', color: 'var(--text-mid)', whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--saffron)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--cream-dark)'}
            >
              <RefreshCw size={14} />
              <span className="refresh-label">Refresh</span>
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', border: '2px solid #fca5a5',
                borderRadius: 50, background: '#fef2f2',
                fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.05em',
                cursor: 'pointer', color: '#b91c1c', whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all .2s', fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#b91c1c'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#b91c1c'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#b91c1c'; e.currentTarget.style.borderColor = '#fca5a5'; }}
            >
              <LogOut size={14} />
              <span className="logout-label">Logout</span>
            </button>
          </div>

          {/* Status Tabs */}
          <div style={{
            display: 'flex', gap: 0, marginBottom: 20, flexWrap: 'nowrap',
            borderBottom: '2px solid var(--cream-dark)', paddingBottom: 0,
            overflowX: 'auto',
          }}>
            {ALL_STATUSES.map(s => {
              const active = activeTab === s;
              const meta = s === 'all' ? { label: 'All', dot: 'var(--saffron)' } : STATUS_META[s];
              const count = counts[s] ?? 0;
              return (
                <button key={s} onClick={() => switchTab(s)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', border: 'none',
                  borderBottom: active ? '3px solid var(--saffron)' : '3px solid transparent',
                  background: 'transparent',
                  fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.05em',
                  cursor: 'pointer', color: active ? 'var(--saffron)' : 'var(--text-light)',
                  marginBottom: -2, fontWeight: active ? 700 : 400,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
                  {meta.label}
                  <span style={{
                    background: active ? 'var(--saffron)' : 'var(--cream-dark)',
                    color: active ? 'white' : 'var(--text-light)',
                    borderRadius: 50, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1.5px solid #fca5a5',
              borderRadius: 12, padding: '14px 20px', marginBottom: 20,
              display: 'flex', gap: 10, alignItems: 'center',
              color: '#b91c1c', fontFamily: 'var(--font-display)', fontSize: 13,
            }}>
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          {/* Table — desktop */}
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1.5px solid var(--cream-dark)',
            overflow: 'hidden', boxShadow: '0 4px 20px var(--shadow)',
          }}>
            {/* Desktop header — hidden on mobile via inline media workaround */}
            <div className="admin-table-header" style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1fr 120px 110px 130px',
              padding: '12px 20px',
              background: 'var(--cream)', borderBottom: '2px solid var(--cream-dark)',
              fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.08em',
              color: 'var(--text-light)',
            }}>
              <span>TEMPLE</span><span>LOCATION</span><span>DEITY</span>
              <span>STATUS</span><span>SUBMITTED</span>
              <span style={{ textAlign: 'right' }}>ACTIONS</span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Loader2 size={32} color="var(--saffron)" style={{ animation: 'spin .8s linear infinite' }} />
                <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-light)', fontSize: 13 }}>Loading temples…</span>
              </div>
            ) : displayed.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--brown)' }}>No temples found</p>
                <p style={{ fontSize: 14 }}>Try a different filter or tab</p>
              </div>
            ) : (
              displayed.map((t, i) => (
                <TempleRow
                  key={t.id}
                  t={t}
                  i={i}
                  total={displayed.length}
                  actionLoading={actionLoading}
                  onReview={() => setReviewing(t)}
                  onQuickAction={quickAction}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
              <PaginationBtn icon={<ChevronLeft size={16} />} disabled={page === 1} onClick={() => setPage(p => p - 1)} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-mid)' }}>Page {page} of {totalPages}</span>
              <PaginationBtn icon={<ChevronRight size={16} />} disabled={page === totalPages} onClick={() => setPage(p => p + 1)} />
            </div>
          )}
        </div>
      </div>

      {reviewing && (
        <ReviewModal temple={reviewing} onClose={() => setReviewing(null)}
          onStatusChange={handleStatusChange} onVerify={handleVerify} />
      )}
      <Footer />

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .admin-table-header { display: none !important; }
          .refresh-label { display: none; }
          .logout-label { display: none; }
          .btn-label-temple { display: none; }
          .btn-label-festival { display: none; }
        }
        @media (min-width: 641px) {
          .refresh-label { display: inline; }
          .logout-label { display: inline; }
          .btn-label-temple { display: inline; }
          .btn-label-festival { display: inline; }
        }
      `}</style>
    </>
  );
}

// ── Temple Row — auto switches desktop grid ↔ mobile card ────────────────────
function TempleRow({ t, i, total, actionLoading, onReview, onQuickAction }) {
  return (
    <>
      {/* Desktop row */}
      <div className="temple-row-desktop" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 1fr 120px 110px 130px',
        padding: '14px 20px',
        borderBottom: i < total - 1 ? '1px solid var(--cream-dark)' : 'none',
        alignItems: 'center', cursor: 'pointer',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#fffbf5'}
        onMouseLeave={e => e.currentTarget.style.background = 'white'}
        onClick={onReview}
      >
        <TempleNameCell t={t} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={13} color="var(--text-light)" />
          <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>{[t.city, t.state].filter(Boolean).join(', ') || '—'}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.primary_deity || '—'}</div>
        <StatusBadge status={t.status} />
        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{fmtDate(t.submitted_at || t.created_at)}</div>
        <RowActions t={t} actionLoading={actionLoading} onReview={onReview} onQuickAction={onQuickAction} justify="flex-end" />
      </div>

      {/* Mobile card */}
      <div className="temple-row-mobile" style={{
        padding: '14px 16px',
        borderBottom: i < total - 1 ? '1px solid var(--cream-dark)' : 'none',
        cursor: 'pointer',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#fffbf5'}
        onMouseLeave={e => e.currentTarget.style.background = 'white'}
        onClick={onReview}
      >
        {/* Top row: image + name + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <TempleThumb t={t} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 14,
              color: 'var(--brown)', fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{t.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 10, color: 'var(--text-light)',
                background: 'var(--cream-dark)', padding: '1px 6px', borderRadius: 4,
              }}>{t.mkt_id || `#${t.id}`}</span>
              {t.verified && <ShieldCheck size={12} color="#7c3aed" />}
              <StatusBadge status={t.status} />
            </div>
          </div>
        </div>

        {/* Meta row: location + deity + date */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          {(t.city || t.state) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-mid)' }}>
              <MapPin size={11} color="var(--text-light)" />
              {[t.city, t.state].filter(Boolean).join(', ')}
            </span>
          )}
          {t.primary_deity && (
            <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>🙏 {t.primary_deity}</span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>📅 {fmtDate(t.submitted_at || t.created_at)}</span>
        </div>

        {/* Actions row */}
        <RowActions t={t} actionLoading={actionLoading} onReview={onReview} onQuickAction={onQuickAction} justify="flex-start" />
      </div>

      <style>{`
        .temple-row-desktop { display: grid !important; }
        .temple-row-mobile  { display: none  !important; }
        @media (max-width: 640px) {
          .temple-row-desktop { display: none  !important; }
          .temple-row-mobile  { display: block !important; }
        }
      `}</style>
    </>
  );
}

function TempleThumb({ t }) {
  return t.hero_image_url ? (
    <img src={`${API_BASE}${t.hero_image_url}`} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
      onError={e => { e.target.style.display = 'none'; }} />
  ) : (
    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--cream-dark)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏛️</div>
  );
}

function TempleNameCell({ t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <TempleThumb t={t} />
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{t.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-light)', background: 'var(--cream-dark)', padding: '1px 6px', borderRadius: 4 }}>{t.mkt_id || `#${t.id}`}</span>
          {t.verified && <ShieldCheck size={12} color="#7c3aed" />}
        </div>
      </div>
    </div>
  );
}

function RowActions({ t, actionLoading, onReview, onQuickAction, justify }) {
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: justify }}>
      {t.status !== 'published' && (
        <QuickBtn icon={<CheckCircle2 size={14} />} color="#15803d" title="Approve → Published"
          loading={actionLoading === `${t.id}-published`} onClick={e => onQuickAction(t, 'published', e)} />
      )}
      {t.status !== 'flagged' && (
        <QuickBtn icon={<XCircle size={14} />} color="#b91c1c" title="Flag / Reject"
          loading={actionLoading === `${t.id}-flagged`} onClick={e => onQuickAction(t, 'flagged', e)} />
      )}
      <QuickBtn icon={<Eye size={14} />} color="var(--saffron)" title="Review Details"
        onClick={e => { e.stopPropagation(); onReview(); }} />
    </div>
  );
}

function QuickBtn({ icon, color, title, loading, onClick }) {
  return (
    <button title={title} onClick={onClick} disabled={loading} style={{
      width: 32, height: 32, borderRadius: 8,
      border: '1.5px solid var(--cream-dark)',
      background: 'white', color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? .5 : 1, transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = 'white'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = color; }}
    >
      {loading ? <Loader2 size={12} style={{ animation: 'spin .8s linear infinite' }} /> : icon}
    </button>
  );
}

function PaginationBtn({ icon, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick} style={{
      width: 38, height: 38, borderRadius: '50%',
      border: '2px solid var(--cream-dark)', background: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .4 : 1, color: 'var(--text-mid)',
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = 'var(--saffron)'; e.currentTarget.style.color = 'var(--saffron)'; }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--cream-dark)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
    >
      {icon}
    </button>
  );
}