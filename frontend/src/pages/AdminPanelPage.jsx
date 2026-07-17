/**
 * AdminPanelPage.jsx — BharatMandir Admin Panel
 * Fixes:
 *   - fetchAdminBlogs: proper sequential fallback (was broken async try/catch)
 *   - Add Blog button: lighter brown so it's visually distinct
 *   - All other features intact
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Archive, Eye, RefreshCw,
  Search, Shield, ShieldCheck, ExternalLink, Clock,
  MapPin, User, Star, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle, LayoutDashboard, PlusCircle,
  CalendarPlus, LogOut, Pencil, Trash2, Save, X, FileText,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AdminApprovalWorkflow from '../components/admin/AdminApprovalWorkflow';

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

// ── API calls ─────────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...opts,
    headers: { ...getAuthHeaders(), ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let detail;
    if (Array.isArray(err.detail)) detail = err.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
    else if (typeof err.detail === 'string') detail = err.detail;
    else if (err.detail) detail = JSON.stringify(err.detail);
    else detail = `HTTP ${res.status}`;
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

async function patchTempleFields(id, fields) {
  return apiFetch(`/api/admin/temples/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

async function deleteTemple(id) {
  return apiFetch(`/api/admin/temples/${id}`, { method: 'DELETE' });
}

// ── Blog API calls ────────────────────────────────────────────────────────────
// FIX: proper sequential fallback — the old nested try/catch was broken because
// the outer catch would also catch the inner apiFetch throw before it resolved.
async function fetchAdminBlogs() {
  try {
    return await apiFetch('/api/admin/blogs');
  } catch {
    // fall back to public endpoint if admin endpoint 405s / 403s
    return await apiFetch('/api/blogs');
  }
}

async function patchBlog(id, fields) {
  return apiFetch(`/api/admin/blogs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

async function deleteBlog(id) {
  return apiFetch(`/api/admin/blogs/${id}`, { method: 'DELETE' });
}

// ── Flag section helper ───────────────────────────────────────────────────────
function FlagGrid({ items }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(([label, val]) => (
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
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ temple, onClose, onStatusChange, onVerify }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchTempleDetail(temple.id)
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
    } catch (e) { showToast(e.message, false); }
    finally { setActionLoading(null); }
  };

  const doVerify = async () => {
    setActionLoading('verify');
    try {
      await patchVerify(temple.id);
      showToast('Temple verified ✓');
      onVerify(temple.id);
    } catch (e) { showToast(e.message, false); }
    finally { setActionLoading(null); }
  };

  const t = detail || temple;
  const currentStatus = t.status || temple.status;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(29,15,0,.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--cream)', borderRadius: 20,
        width: '100%', maxWidth: 820, maxHeight: '92vh',
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
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>{t.name}</h2>
            {t.name_hindi && (
              <p style={{ fontFamily: 'var(--font-hindi)', color: 'rgba(255,255,255,.75)', margin: '2px 0 0', fontSize: 14 }}>{t.name_hindi}</p>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', color: 'white',
            borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
          }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,.3)'}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,.15)'}
          >×</button>
        </div>

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Identity */}
              <InfoSection title="🏛️ Identity">
                <Row label="MKT ID" value={t.mkt_id} mono />
                <Row label="Slug" value={t.slug} mono />
                <Row label="Deity" value={t.primary_deity} />
                <Row label="Sect" value={t.sect} />
                <Row label="Type" value={t.temple_type} />
                <Row label="Architecture" value={t.architecture_style} />
                <Row label="Est. Year" value={t.estimated_year_built} />
                <Row label="Founded By" value={t.founded_by} />
                <Row label="Last Renovation" value={t.last_renovation_year} />
                <Row label="Condition" value={t.building_condition} />
              </InfoSection>

              {/* Location */}
              <InfoSection title="📍 Location">
                <Row label="Address" value={t.address} />
                <Row label="City" value={t.city} />
                <Row label="District" value={t.district} />
                <Row label="State" value={t.state} />
                <Row label="Pincode" value={t.pincode} />
                <Row label="Setting" value={t.setting_environment} />
                <Row label="Lat/Lng" value={t.latitude ? `${t.latitude}, ${t.longitude}` : null} />
                <Row label="Landmark" value={t.local_landmark} />
                <Row label="Nearest Bus" value={t.nearest_bus_stand} />
                <Row label="Nearest Rail" value={t.nearest_railway} />
                <Row label="Nearest Airport" value={t.nearest_airport} />
                <Row label="Google Maps" value={t.google_maps_link} />
              </InfoSection>

              {/* Heritage Designations */}
              <InfoSection title="⭐ Heritage Designations" fullWidth>
                <FlagGrid items={[
                  ['Jyotirlinga', t.is_jyotirlinga], ['Shaktipeeth', t.is_shaktipeeth],
                  ['Divya Desam', t.is_divya_desam], ['Ashtavinayak', t.is_ashtavinayak],
                  ['Char Dham', t.is_char_dham], ['Heritage Site', t.is_heritage_site],
                  ['ASI Protected', t.is_asi_protected], ['Pancha Bhuta', t.is_pancha_bhuta],
                  ['51 Shakti Peeths', t.is_51_shakti_peeths], ['UNESCO', t.is_unesco_heritage],
                  ['State Heritage', t.is_state_heritage],
                ]} />
              </InfoSection>

              {/* History */}
              {t.history && (
                <InfoSection title="📖 History" fullWidth>
                  <p style={{ color: 'var(--text-mid)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    {t.history.slice(0, 600)}{t.history.length > 600 ? '…' : ''}
                  </p>
                </InfoSection>
              )}

              {/* Significance */}
              {t.significance && (
                <InfoSection title="✨ Significance" fullWidth>
                  <p style={{ color: 'var(--text-mid)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    {t.significance.slice(0, 400)}{t.significance.length > 400 ? '…' : ''}
                  </p>
                </InfoSection>
              )}

              {/* Timings */}
              <InfoSection title="🕐 Timings & Services">
                <Row label="Opens" value={t.opening_time} />
                <Row label="Closes" value={t.closing_time} />
                <Row label="Afternoon Break" value={t.afternoon_closure_start ? `${t.afternoon_closure_start} – ${t.afternoon_closure_end}` : null} />
                <Row label="Special Day" value={t.weekly_special_day} />
                <Row label="Online Puja" value={t.online_puja_available} />
                <Row label="Live Darshan" value={t.live_darshan_available} />
                <Row label="Live Stream URL" value={t.live_stream_url} />
                <Row label="Prasad Type" value={t.prasad_type} />
                <Row label="Entry Fee" value={t.entry_fee != null ? `₹${t.entry_fee}` : null} />
                <Row label="Dress Code" value={t.dress_code} />
                <Row label="Best Time" value={t.best_time_to_visit} />
              </InfoSection>

              {/* Submission Meta */}
              <InfoSection title="📋 Submission Meta">
                <Row label="Submitted" value={fmtDate(t.submitted_at)} />
                <Row label="Created" value={fmtDate(t.created_at)} />
                <Row label="Published" value={fmtDate(t.published_at)} />
                <Row label="Source" value={t.source} />
                <Row label="Avg Rating" value={t.average_rating ? `${t.average_rating} ★` : null} />
                <Row label="Total Ratings" value={t.total_ratings} />
                <Row label="Managing Auth." value={t.managing_authority} />
                <Row label="Trust Name" value={t.trust_name} />
                <Row label="Trust Reg No." value={t.trust_registration_no} />
              </InfoSection>

              {/* Puja Services */}
              <InfoSection title="🙏 Puja Services Available" fullWidth>
                <FlagGrid items={[
                  ['Rudrabhishek', t.puja_rudrabhishek], ['Satyanarayan Katha', t.puja_satyanarayan],
                  ['Havan / Homa', t.puja_havan_homa], ['Laghu Rudra', t.puja_laghu_rudra],
                  ['Mahamrityunjaya', t.puja_mahamrityunjaya], ['Griha Pravesh', t.puja_griha_pravesh],
                  ['Naamkaran', t.puja_naamkaran], ['Vivah', t.puja_vivah],
                  ['Annaprashan', t.puja_annaprashan], ['Mundan', t.puja_mundan],
                  ['Pitru Tarpan', t.puja_pitru_tarpan], ['Sahasranamarchana', t.puja_sahasranamarchana],
                ]} />
              </InfoSection>

              {/* Facilities */}
              <InfoSection title="🏗️ Facilities" fullWidth>
                <FlagGrid items={[
                  ['Electricity', t.facility_electricity], ['Water Supply', t.facility_water_supply],
                  ['Clean Toilets', t.facility_clean_toilets], ['Wheelchair Access', t.facility_wheelchair],
                  ['Dharamshala', t.facility_dharamshala], ['Prasad Dining', t.facility_prasad_dining],
                  ['Parking', t.facility_parking], ['Security', t.facility_security],
                  ['CCTV', t.facility_cctv], ['PA System', t.facility_pa_system],
                  ['WiFi', t.facility_internet_wifi], ['Library / Pathshala', t.facility_library_pathshala],
                  ['Gaushaala', t.facility_gaushaala], ['Medical Support', t.facility_medical_support],
                ]} />
              </InfoSection>

              {/* Community Programs */}
              <InfoSection title="🤝 Community Programs" fullWidth>
                <FlagGrid items={[
                  ['Free Food / Langar', t.prog_free_food], ['Medical Camps', t.prog_medical_camps],
                  ['Scholarship & Education', t.prog_scholarship_edu], ['Women Self-Help', t.prog_womens_selfhelp],
                  ['Bhajan / Kirtan', t.prog_bhajan_kirtan], ['Disaster Relief', t.prog_disaster_relief],
                ]} />
              </InfoSection>

              {/* Donations & Finance */}
              <InfoSection title="💳 Donations & Finance">
                <Row label="Online Donations" value={t.accept_online_donations ? 'Yes' : 'No'} />
                <Row label="UPI ID" value={t.upi_id} mono />
                <Row label="Bank Name/Branch" value={t.bank_name_branch} />
                <Row label="IFSC" value={t.bank_ifsc} mono />
                <Row label="80G Certificate" value={t.certificate_80g_no} />
              </InfoSection>

              {/* Donation Causes */}
              <InfoSection title="🎁 Donation Causes">
                <FlagGrid items={[
                  ['Temple Renovation', t.donation_temple_renovation], ['Annadanam', t.donation_annadanam],
                  ['Priest Salary', t.donation_priest_salary], ['Vedic Education', t.donation_vedic_education],
                  ['Festival', t.donation_festival], ['Medical Camps', t.donation_medical_camps],
                  ['General', t.donation_general],
                ]} />
              </InfoSection>

              {/* Contact */}
              <InfoSection title="📞 Contact & Social" fullWidth>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                  <Row label="Phone" value={t.phone} />
                  <Row label="WhatsApp" value={t.whatsapp_number} />
                  <Row label="Email" value={t.official_email} />
                  <Row label="Best Time to Call" value={t.best_time_to_call} />
                  <Row label="Website" value={t.website_url} />
                  <Row label="Facebook" value={t.facebook_page} />
                  <Row label="Instagram" value={t.instagram_handle} />
                  <Row label="YouTube" value={t.youtube_channel} />
                </div>
              </InfoSection>

              {/* Media */}
              {(t.video_aarti_url || t.video_intro_url || t.video_360_url) && (
                <InfoSection title="🎥 Media Links" fullWidth>
                  <Row label="Aarti Video" value={t.video_aarti_url} />
                  <Row label="Intro Video" value={t.video_intro_url} />
                  <Row label="360° Video" value={t.video_360_url} />
                </InfoSection>
              )}

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
                color="#92400e" bg="#f5f3ff" border="#c4b5fd"
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

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ temple, onClose, onSaved }) {

  const SECTIONS = [
    {
      title: '🏛️ Basic Info',
      fields: [
        { key: 'name',                  label: 'Temple Name',           type: 'text' },
        { key: 'name_hindi',            label: 'Name (Hindi)',           type: 'text' },
        { key: 'name_local',            label: 'Name (Local Language)',  type: 'text' },
        { key: 'primary_deity',         label: 'Primary Deity',          type: 'text' },
        { key: 'secondary_deities',     label: 'Secondary Deities',      type: 'text' },
        { key: 'sect',                  label: 'Sect',                   type: 'text' },
        { key: 'temple_type',           label: 'Temple Type',            type: 'text' },
        { key: 'architecture_style',    label: 'Architecture Style',     type: 'text' },
        { key: 'estimated_year_built',  label: 'Est. Year Built',        type: 'text' },
        { key: 'founded_by',            label: 'Founded By',             type: 'text' },
        { key: 'last_renovation_year',  label: 'Last Renovation Year',   type: 'text' },
        { key: 'building_condition',    label: 'Building Condition',     type: 'text' },
        { key: 'managing_authority',    label: 'Managing Authority',     type: 'text' },
        { key: 'trust_name',            label: 'Trust Name',             type: 'text' },
        { key: 'trust_registration_no', label: 'Trust Reg. No.',         type: 'text' },
      ],
    },
    {
      title: '📍 Location',
      fields: [
        { key: 'address',             label: 'Full Address',          type: 'text' },
        { key: 'city',                label: 'City',                  type: 'text' },
        { key: 'district',            label: 'District',              type: 'text' },
        { key: 'state',               label: 'State',                 type: 'text' },
        { key: 'pincode',             label: 'Pincode',               type: 'text' },
        { key: 'latitude',            label: 'Latitude',              type: 'text' },
        { key: 'longitude',           label: 'Longitude',             type: 'text' },
        { key: 'local_landmark',      label: 'Local Landmark',        type: 'text' },
        { key: 'setting_environment', label: 'Setting / Environment', type: 'text' },
        { key: 'nearest_bus_stand',   label: 'Nearest Bus Stand',     type: 'text' },
        { key: 'nearest_railway',     label: 'Nearest Railway',       type: 'text' },
        { key: 'nearest_airport',     label: 'Nearest Airport',       type: 'text' },
        { key: 'google_maps_link',    label: 'Google Maps Link',      type: 'text', full: true },
      ],
    },
    {
      title: '🕐 Timings & Visit Info',
      fields: [
        { key: 'opening_time',            label: 'Opening Time',          type: 'text' },
        { key: 'closing_time',            label: 'Closing Time',          type: 'text' },
        { key: 'afternoon_closure_start', label: 'Afternoon Break Start', type: 'text' },
        { key: 'afternoon_closure_end',   label: 'Afternoon Break End',   type: 'text' },
        { key: 'weekly_special_day',      label: 'Weekly Special Day',    type: 'text' },
        { key: 'best_time_to_visit',      label: 'Best Time to Visit',    type: 'text', full: true },
        { key: 'entry_fee',               label: 'Entry Fee (₹, 0=Free)', type: 'number' },
        { key: 'dress_code',              label: 'Dress Code',            type: 'text' },
        { key: 'prasad_type',             label: 'Prasad Type',           type: 'text' },
      ],
    },
    {
      title: '📞 Contact & Social',
      fields: [
        { key: 'phone',            label: 'Phone',                    type: 'text' },
        { key: 'whatsapp_number',  label: 'WhatsApp Number',          type: 'text' },
        { key: 'official_email',   label: 'Official Email',           type: 'text' },
        { key: 'best_time_to_call',label: 'Best Time to Call',        type: 'text' },
        { key: 'website_url',      label: 'Website URL',              type: 'text' },
        { key: 'payment_page_url', label: 'Payment / Donation URL',   type: 'text' },
        { key: 'facebook_page',    label: 'Facebook Page',            type: 'text' },
        { key: 'instagram_handle', label: 'Instagram Handle',         type: 'text' },
        { key: 'youtube_channel',  label: 'YouTube Channel',          type: 'text' },
        { key: 'live_stream_url',  label: 'Live Stream URL',          type: 'text' },
      ],
    },
    {
      title: '💰 Finance & Donations',
      fields: [
        { key: 'upi_id',           label: 'UPI ID',              type: 'text' },
        { key: 'certificate_80g_no',label: '80G Certificate No.',type: 'text' },
        { key: 'bank_account_name',label: 'Bank Account Name',   type: 'text' },
        { key: 'bank_name_branch', label: 'Bank Name / Branch',  type: 'text' },
        { key: 'bank_ifsc',        label: 'Bank IFSC Code',      type: 'text' },
      ],
    },
    {
      title: '📖 History & Content',
      fields: [
        { key: 'history',          label: 'History',              type: 'textarea', rows: 6 },
        { key: 'history_hindi',    label: 'History (Hindi)',      type: 'textarea', rows: 4 },
        { key: 'significance',     label: 'Significance',         type: 'textarea', rows: 4 },
        { key: 'sthala_purana',    label: 'Sthala Purana',        type: 'textarea', rows: 4 },
        { key: 'puranic_stories',  label: 'Puranic Stories',      type: 'textarea', rows: 4 },
      ],
    },
  ];

  const allFields = SECTIONS.flatMap(s => s.fields);

  const [fullTemple, setFullTemple] = useState(null);
  const [fetchingDetail, setFetchingDetail] = useState(true);

  useEffect(() => {
    fetchTempleDetail(temple.id)
      .then(d => { setFullTemple(d); setFetchingDetail(false); })
      .catch(() => { setFullTemple(temple); setFetchingDetail(false); });
  }, [temple.id]);

  const [form, setForm] = useState({});
  useEffect(() => {
    if (!fullTemple) return;
    const init = {};
    allFields.forEach(f => { init[f.key] = fullTemple[f.key] ?? ''; });
    setForm(init);
  }, [fullTemple]);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {};
      allFields.forEach(f => {
        const val = form[f.key];
        if (val !== '' && val !== null && val !== undefined) {
          payload[f.key] = f.type === 'number' ? Number(val) : val;
        }
      });
      await patchTempleFields(temple.id, payload);
      onSaved({ ...temple, ...payload });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    border: '2px solid var(--cream-dark)', borderRadius: 10,
    fontFamily: 'var(--font-body)', fontSize: 13,
    color: 'var(--text-dark)', background: 'white',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(29,15,0,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--cream)', borderRadius: 20,
        width: '100%', maxWidth: 760, maxHeight: '94vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(61,31,0,.35)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #92400e, #bf5310)',
          padding: '18px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Pencil size={18} color="white" />
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 18, fontWeight: 700, margin: 0 }}>
                Edit Temple
              </h2>
              <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 12, margin: '2px 0 0', fontFamily: 'var(--font-display)' }}>
                ID: {temple.id} · {temple.mkt_id || temple.slug}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', color: 'white',
            borderRadius: '50%', width: 34, height: 34, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>×</button>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', borderBottom: '1px solid #fca5a5',
            padding: '10px 20px', color: '#b91c1c', flexShrink: 0,
            fontFamily: 'var(--font-display)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {/* Form Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {fetchingDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 14 }}>
              <Loader2 size={32} color="#bf5310" style={{ animation: 'spin .8s linear infinite' }} />
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-light)', fontSize: 13 }}>
                Loading temple details…
              </span>
            </div>
          ) : (
            <div>
              {SECTIONS.map(section => (
                <div key={section.title} style={{ marginBottom: 28 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                    letterSpacing: '.08em', color: 'var(--saffron)',
                    textTransform: 'uppercase', marginBottom: 12,
                    paddingBottom: 8, borderBottom: '2px solid var(--cream-dark)',
                  }}>
                    {section.title}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                    {section.fields.map(f => (
                      <div key={f.key} style={{ gridColumn: (f.type === 'textarea' || f.full) ? '1 / -1' : undefined }}>
                        <label style={{
                          display: 'block', marginBottom: 5,
                          fontFamily: 'var(--font-display)', fontSize: 11,
                          letterSpacing: '.06em', color: 'var(--text-light)', textTransform: 'uppercase',
                        }}>{f.label}</label>

                        {f.type === 'textarea' ? (
                          <textarea
                            value={form[f.key]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            rows={f.rows || 4}
                            placeholder={fullTemple?.[f.key] ? String(fullTemple[f.key]) : `Enter ${f.label}…`}
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = '#bf5310'}
                            onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
                          />
                        ) : (
                          <input
                            type={f.type}
                            value={form[f.key]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={
                              fullTemple?.[f.key] !== null && fullTemple?.[f.key] !== undefined && fullTemple?.[f.key] !== ''
                                ? String(fullTemple[f.key])
                                : `Enter ${f.label}…`
                            }
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#bf5310'}
                            onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '2px solid var(--cream-dark)', flexShrink: 0,
          padding: '14px 24px', background: 'white',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-light)', margin: 0 }}>
            Only filled fields will be updated · Empty fields are ignored
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 50,
              border: '2px solid var(--cream-dark)', background: 'white',
              fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.04em',
              cursor: 'pointer', color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <X size={14} /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '9px 20px', borderRadius: 50,
              border: '2px solid #bf5310',
              background: '#bf5310',
              fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.04em',
              cursor: saving ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s',
            }}>
              {saving
                ? <><Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> Saving…</>
                : <><Save size={14} /> Save Changes</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ temple, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteTemple(temple.id);
      onDeleted(temple.id);
      onClose();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      background: 'rgba(29,15,0,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 20,
        width: '100%', maxWidth: 440,
        padding: '32px', boxShadow: '0 24px 80px rgba(61,31,0,.35)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#fef2f2', border: '2px solid #fca5a5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Trash2 size={24} color="#b91c1c" />
        </div>

        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
          color: 'var(--brown)', textAlign: 'center', margin: '0 0 10px',
        }}>Delete Temple?</h2>

        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-mid)',
          textAlign: 'center', lineHeight: 1.6, margin: '0 0 8px',
        }}>
          You are about to permanently delete:
        </p>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
          color: '#b91c1c', textAlign: 'center', margin: '0 0 6px',
        }}>{temple.name}</p>
        <p style={{
          fontFamily: 'monospace', fontSize: 12, color: 'var(--text-light)',
          textAlign: 'center', margin: '0 0 24px',
        }}>{temple.mkt_id || `#${temple.id}`} · {temple.city}, {temple.state}</p>

        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 10, padding: '10px 14px', marginBottom: 24,
          fontFamily: 'var(--font-display)', fontSize: 12, color: '#b91c1c',
          letterSpacing: '.03em',
        }}>
          This action cannot be undone. All temple data and associated records will be permanently removed.
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontFamily: 'var(--font-display)', fontSize: 12, color: '#b91c1c',
          }}>
            Error: {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 50,
            border: '2px solid var(--cream-dark)', background: 'white',
            fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.04em',
            cursor: 'pointer', color: 'var(--text-mid)', fontWeight: 600,
          }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{
            flex: 1, padding: '11px 0', borderRadius: 50,
            border: '2px solid #b91c1c',
            background: deleting ? '#fca5a5' : '#b91c1c',
            fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.04em',
            cursor: deleting ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'all .2s',
          }}>
            {deleting
              ? <><Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> Deleting…</>
              : <><Trash2 size={14} /> Delete Permanently</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Blog Edit Modal ───────────────────────────────────────────────────────────
function BlogEditModal({ blog, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: blog.title || '',
    submitted_by: blog.submitted_by || '',
    description: blog.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!form.title.trim() || !form.submitted_by.trim() || !form.description.trim()) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await patchBlog(blog.id, {
        title: form.title.trim(),
        submitted_by: form.submitted_by.trim(),
        description: form.description.trim(),
      });
      onSaved({ ...blog, ...form });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '2px solid var(--cream-dark)', borderRadius: 10,
    fontFamily: 'var(--font-body)', fontSize: 14,
    color: 'var(--text-dark)', background: '#fdf8f0',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s',
  };

  const labelStyle = {
    display: 'block', marginBottom: 6,
    fontFamily: 'var(--font-display)', fontSize: 11,
    letterSpacing: '.08em', color: 'var(--text-light)', textTransform: 'uppercase',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(29,15,0,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--cream)', borderRadius: 20,
        width: '100%', maxWidth: 620, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(61,31,0,.35)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #4b1d04, #7a3208)',
          padding: '18px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Pencil size={18} color="white" />
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 17, fontWeight: 700, margin: 0 }}>
                Edit Blog Post
              </h2>
              <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, margin: '2px 0 0', fontFamily: 'var(--font-display)' }}>
                ID #{blog.id}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', color: 'white',
            borderRadius: '50%', width: 34, height: 34, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>×</button>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', borderBottom: '1px solid #fca5a5',
            padding: '10px 20px', color: '#b91c1c', flexShrink: 0,
            fontFamily: 'var(--font-display)', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '22px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Blog Title <span style={{ color: '#E8650A' }}>*</span></label>
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Enter blog title…"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#7a3208'}
              onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Author Name <span style={{ color: '#E8650A' }}>*</span></label>
            <input
              value={form.submitted_by}
              onChange={e => setForm(p => ({ ...p, submitted_by: e.target.value }))}
              placeholder="Enter author name…"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#7a3208'}
              onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
            />
          </div>

          <div>
            <label style={labelStyle}>Blog Content <span style={{ color: '#E8650A' }}>*</span></label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Write blog content…"
              rows={10}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 200, lineHeight: 1.75 }}
              onFocus={e => e.target.style.borderColor = '#7a3208'}
              onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
            />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--text-light)', textAlign: 'right', marginTop: 4 }}>
              {form.description.length} characters
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '2px solid var(--cream-dark)', flexShrink: 0,
          padding: '14px 24px', background: 'white',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 50,
            border: '2px solid var(--cream-dark)', background: 'white',
            fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.04em',
            cursor: 'pointer', color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <X size={14} /> Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 20px', borderRadius: 50,
            border: '2px solid #7a3208', background: '#7a3208',
            fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.04em',
            cursor: saving ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {saving
              ? <><Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> Saving…</>
              : <><Save size={14} /> Save Changes</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Blog Delete Confirm Modal ─────────────────────────────────────────────────
function BlogDeleteModal({ blog, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBlog(blog.id);
      onDeleted(blog.id);
      onClose();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10002,
      background: 'rgba(29,15,0,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 20,
        width: '100%', maxWidth: 420, padding: '32px',
        boxShadow: '0 24px 80px rgba(61,31,0,.35)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#fef2f2', border: '2px solid #fca5a5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <Trash2 size={22} color="#b91c1c" />
        </div>

        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700,
          color: 'var(--brown)', textAlign: 'center', margin: '0 0 10px',
        }}>Delete Blog Post?</h2>

        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
          color: '#b91c1c', textAlign: 'center', margin: '0 0 20px',
          lineHeight: 1.4,
        }}>"{blog.title}"</p>

        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 10, padding: '10px 14px', marginBottom: 24,
          fontFamily: 'var(--font-display)', fontSize: 12, color: '#b91c1c',
        }}>
          This action cannot be undone.
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontFamily: 'var(--font-display)', fontSize: 12, color: '#b91c1c',
          }}>Error: {error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 50,
            border: '2px solid var(--cream-dark)', background: 'white',
            fontFamily: 'var(--font-display)', fontSize: 13, cursor: 'pointer',
            color: 'var(--text-mid)', fontWeight: 600,
          }}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting} style={{
            flex: 1, padding: '11px 0', borderRadius: 50,
            border: '2px solid #b91c1c', background: deleting ? '#fca5a5' : '#b91c1c',
            fontFamily: 'var(--font-display)', fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer',
            color: 'white', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {deleting
              ? <><Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} /> Deleting…</>
              : <><Trash2 size={13} /> Delete</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Blog Management Tab ───────────────────────────────────────────────────────
function BlogManagement() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingBlog, setEditingBlog] = useState(null);
  const [deletingBlog, setDeletingBlog] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminBlogs();
      setBlogs(Array.isArray(data) ? data : (data.blogs || data.items || []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = blogs.filter(b => {
    const q = search.toLowerCase();
    return (
      b.title?.toLowerCase().includes(q) ||
      b.submitted_by?.toLowerCase().includes(q)
    );
  });

  const handleBlogSaved = (updated) => {
    setBlogs(prev => prev.map(b => b.id === updated.id ? updated : b));
  };

  const handleBlogDeleted = (id) => {
    setBlogs(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{
            position: 'absolute', left: 13, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search blogs by title or author…"
            style={{
              width: '100%', padding: '9px 14px 9px 38px',
              border: '2px solid var(--cream-dark)', borderRadius: 50,
              fontFamily: 'var(--font-body)', fontSize: 13,
              background: 'white', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
            onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
          />
        </div>

        <Link to="/admin/add-blog" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '9px 18px',
          background: 'linear-gradient(135deg, #7a3208, #a14a0b)',
          border: 'none', borderRadius: 50,
          fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.06em', fontWeight: 700,
          color: 'white', textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          <FileText size={14} /> New Blog Post
        </Link>

        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', border: '2px solid var(--cream-dark)',
          borderRadius: 50, background: 'white',
          fontFamily: 'var(--font-display)', fontSize: 12, cursor: 'pointer',
          color: 'var(--text-mid)',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--saffron)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--cream-dark)'}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1.5px solid #fca5a5',
          borderRadius: 12, padding: '12px 18px', marginBottom: 16,
          display: 'flex', gap: 8, alignItems: 'center',
          color: '#b91c1c', fontFamily: 'var(--font-display)', fontSize: 13,
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Blog Table */}
      <div style={{
        background: 'white', borderRadius: 16,
        border: '1.5px solid var(--cream-dark)', overflow: 'hidden',
        boxShadow: '0 4px 20px var(--shadow)',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 130px',
          padding: '12px 20px',
          background: 'var(--cream)', borderBottom: '2px solid var(--cream-dark)',
          fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.08em',
          color: 'var(--text-light)',
        }}>
          <span>TITLE</span>
          <span>AUTHOR</span>
          <span>PUBLISHED</span>
          <span style={{ textAlign: 'right' }}>ACTIONS</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 size={28} color="#7a3208" style={{ animation: 'spin .8s linear infinite' }} />
            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-light)', fontSize: 13 }}>Loading blogs…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--brown)' }}>
              {search ? 'No blogs match your search' : 'No blog posts yet'}
            </p>
          </div>
        ) : (
          filtered.map((blog, i) => (
            <div
              key={blog.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 130px',
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--cream-dark)' : 'none',
                alignItems: 'center', background: 'white', transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fffbf5'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              {/* Title */}
              <div style={{ paddingRight: 12 }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--brown)',
                  fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{blog.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
                  #{blog.id} · {(blog.description || '').slice(0, 60)}…
                </div>
              </div>

              {/* Author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7a3208, #a14a0b)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'white',
                  flexShrink: 0,
                }}>
                  {(blog.submitted_by || 'A')[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {blog.submitted_by}
                </span>
              </div>

              {/* Date */}
              <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{fmtDate(blog.created_at)}</div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <QuickBtn
                  icon={<Pencil size={14} />}
                  color="#1d4ed8"
                  title="Edit Blog"
                  onClick={e => { e.stopPropagation(); setEditingBlog(blog); }}
                />
                <QuickBtn
                  icon={<Trash2 size={14} />}
                  color="#b91c1c"
                  title="Delete Blog"
                  hoverBg="#fef2f2"
                  onClick={e => { e.stopPropagation(); setDeletingBlog(blog); }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {editingBlog && (
        <BlogEditModal
          blog={editingBlog}
          onClose={() => setEditingBlog(null)}
          onSaved={handleBlogSaved}
        />
      )}
      {deletingBlog && (
        <BlogDeleteModal
          blog={deletingBlog}
          onClose={() => setDeletingBlog(null)}
          onDeleted={handleBlogDeleted}
        />
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
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
      <span style={{ color: 'var(--text-light)', fontSize: 12, minWidth: 110, flexShrink: 0, fontFamily: 'var(--font-display)', letterSpacing: '.03em' }}>
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
  const [mainView, setMainView]           = useState('temples');
  const [temples, setTemples]             = useState([]);
  const [counts, setCounts]               = useState({});
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [search, setSearch]               = useState('');
  const [reviewing, setReviewing]         = useState(null);
  const [editing, setEditing]             = useState(null);
  const [deleting, setDeleting]           = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const PER_PAGE = 15;

  useEffect(() => {
    const token = sessionStorage.getItem('bm_access_token');
    if (!token) navigate('/admin/login', { replace: true });
  }, []);

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

  const handleSaved = (updated) => {
    setTemples(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
  };

  const handleDeleted = (id) => {
    setTemples(prev => prev.filter(t => t.id !== id));
    loadCounts();
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
              Temple Onboarding &amp; Verification Dashboard
            </p>

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

          {/* Main View Switcher */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 24,
            background: 'white', border: '1.5px solid var(--cream-dark)',
            borderRadius: 50, padding: 4, width: 'fit-content',
          }}>
            {[
              { id: 'temples', label: 'Temples' },
              { id: 'approvals', label: 'Verification Center' },
              { id: 'blogs', label: 'Blog Posts' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setMainView(v.id)}
                style={{
                  padding: '8px 22px', borderRadius: 50, border: 'none',
                  background: mainView === v.id ? 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))' : 'transparent',
                  color: mainView === v.id ? 'white' : 'var(--text-light)',
                  fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.06em',
                  fontWeight: mainView === v.id ? 700 : 400,
                  cursor: 'pointer', transition: 'all .2s',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* ── TEMPLES VIEW ── */}
          {mainView === 'temples' && (
            <>
              {/* Controls */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
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
                      background: 'white', color: 'var(--text-dark)', outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                    onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
                  />
                </div>

                {/* Add Festival — brown */}
                <Link to="/admin/add-festival" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #92400e, #bf5310)',
                  border: '2px solid transparent', borderRadius: 50,
                  fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.04em', fontWeight: 700,
                  color: 'white', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <CalendarPlus size={15} />
                  <span className="btn-label-festival">Add Festival</span>
                </Link>

                {/* Add Blog — FIXED: lighter warm brown so it reads as a third distinct button */}
                <Link to="/admin/add-blog" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #a14a0b, #c76020)',
                  border: '2px solid transparent', borderRadius: 50,
                  fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.04em', fontWeight: 700,
                  color: 'white', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <FileText size={15} />
                  <span>Add Blog</span>
                </Link>

                <button onClick={() => { loadTemples(); loadCounts(); }} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px', border: '2px solid var(--cream-dark)',
                  borderRadius: 50, background: 'white',
                  fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.05em',
                  cursor: 'pointer', color: 'var(--text-mid)', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--saffron)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--cream-dark)'}
                >
                  <RefreshCw size={14} />
                  <span className="refresh-label">Refresh</span>
                </button>

                <button onClick={handleLogout} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px', border: '2px solid #fca5a5',
                  borderRadius: 50, background: '#fef2f2',
                  fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.05em',
                  cursor: 'pointer', color: '#b91c1c', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .2s', fontWeight: 600,
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
                display: 'flex', gap: 0, marginBottom: 20,
                borderBottom: '2px solid var(--cream-dark)', overflowX: 'auto',
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
                      marginBottom: -2, fontWeight: active ? 700 : 400, whiteSpace: 'nowrap', flexShrink: 0,
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

              {/* Table */}
              <div style={{
                background: 'white', borderRadius: 16,
                border: '1.5px solid var(--cream-dark)',
                overflow: 'hidden', boxShadow: '0 4px 20px var(--shadow)',
              }}>
                <div className="admin-table-header" style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1fr 120px 110px 160px',
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
                      onEdit={e => { e.stopPropagation(); setEditing(t); }}
                      onDelete={e => { e.stopPropagation(); setDeleting(t); }}
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
            </>
          )}

          {/* ── BLOGS VIEW ── */}
          {mainView === 'blogs' && <BlogManagement />}
          {mainView === 'approvals' && <AdminApprovalWorkflow />}

        </div>
      </div>

      {/* Temple Modals */}
      {reviewing && (
        <ReviewModal temple={reviewing} onClose={() => setReviewing(null)}
          onStatusChange={handleStatusChange} onVerify={handleVerify} />
      )}
      {editing && (
        <EditModal temple={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {deleting && (
        <DeleteConfirmModal temple={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
      )}

      <Footer />

      <style>{`
        @media (max-width: 640px) {
          .admin-table-header { display: none !important; }
          .refresh-label, .logout-label, .btn-label-temple, .btn-label-festival { display: none; }
        }
        @media (min-width: 641px) {
          .refresh-label, .logout-label, .btn-label-temple, .btn-label-festival { display: inline; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

// ── Temple Row ─────────────────────────────────────────────────────────────────
function TempleRow({ t, i, total, actionLoading, onReview, onEdit, onDelete, onQuickAction }) {
  return (
    <>
      {/* Desktop */}
      <div className="temple-row-desktop" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 1fr 120px 110px 160px',
        padding: '14px 20px', borderBottom: i < total - 1 ? '1px solid var(--cream-dark)' : 'none',
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
        <RowActions t={t} actionLoading={actionLoading} onReview={onReview} onEdit={onEdit} onDelete={onDelete} onQuickAction={onQuickAction} justify="flex-end" />
      </div>

      {/* Mobile card */}
      <div className="temple-row-mobile" style={{
        padding: '14px 16px', borderBottom: i < total - 1 ? '1px solid var(--cream-dark)' : 'none', cursor: 'pointer',
      }}
        onMouseEnter={e => e.currentTarget.style.background = '#fffbf5'}
        onMouseLeave={e => e.currentTarget.style.background = 'white'}
        onClick={onReview}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <TempleThumb t={t} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-light)', background: 'var(--cream-dark)', padding: '1px 6px', borderRadius: 4 }}>{t.mkt_id || `#${t.id}`}</span>
              {t.verified && <ShieldCheck size={12} color="#92400e" />}
              <StatusBadge status={t.status} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          {(t.city || t.state) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-mid)' }}>
              <MapPin size={11} color="var(--text-light)" />
              {[t.city, t.state].filter(Boolean).join(', ')}
            </span>
          )}
          {t.primary_deity && <span style={{ fontSize: 12, color: 'var(--text-mid)' }}>🙏 {t.primary_deity}</span>}
          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>📅 {fmtDate(t.submitted_at || t.created_at)}</span>
        </div>
        <RowActions t={t} actionLoading={actionLoading} onReview={onReview} onEdit={onEdit} onDelete={onDelete} onQuickAction={onQuickAction} justify="flex-start" />
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
  const src = t.hero_image_url?.startsWith('http') ? t.hero_image_url : `${API_BASE}${t.hero_image_url}`;
  return t.hero_image_url ? (
    <img src={src} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
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

function RowActions({ t, actionLoading, onReview, onEdit, onDelete, onQuickAction, justify }) {
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
      <QuickBtn icon={<Eye size={14} />} color="var(--saffron)" title="View Full Details"
        onClick={e => { e.stopPropagation(); onReview(); }} />
      <QuickBtn icon={<Pencil size={14} />} color="#1d4ed8" title="Edit Temple"
        onClick={onEdit} />
      <QuickBtn icon={<Trash2 size={14} />} color="#b91c1c" title="Delete Temple"
        onClick={onDelete} hoverBg="#fef2f2" />
    </div>
  );
}

function QuickBtn({ icon, color, title, loading, onClick, hoverBg }) {
  return (
    <button title={title} onClick={onClick} disabled={loading} style={{
      width: 32, height: 32, borderRadius: 8,
      border: '1.5px solid var(--cream-dark)',
      background: 'white', color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? .5 : 1, transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = hoverBg || color; e.currentTarget.style.color = hoverBg ? color : 'white'; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = color; e.currentTarget.style.borderColor = 'var(--cream-dark)'; }}
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
