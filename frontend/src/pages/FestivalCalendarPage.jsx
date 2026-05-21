import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Calendar, Star, Search, ChevronLeft, ChevronRight, MapPin, RefreshCw } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const HINDU_MONTHS = [
  'Chaitra','Vaishakha','Jyeshtha','Ashadha',
  'Shravana','Bhadrapada','Ashwin','Kartika',
  'Margashirsha','Pausha','Magha','Phalguna',
];

const GREGORIAN_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DEITY_EMOJI_MAP = {
  shiva:     { emoji: '🔱', color: '#5B4FDB' },
  vishnu:    { emoji: '🪔', color: '#1D4ED8' },
  krishna:   { emoji: '🪈', color: '#1D4ED8' },
  rama:      { emoji: '🏹', color: '#2E8B57' },
  hanuman:   { emoji: '🐒', color: '#E8650A' },
  ganesha:   { emoji: '🐘', color: '#D97706' },
  durga:     { emoji: '🪆', color: '#BE185D' },
  lakshmi:   { emoji: '✨', color: '#C8960C' },
  saraswati: { emoji: '🌸', color: '#C8960C' },
  surya:     { emoji: '☀️', color: '#E8650A' },
  kali:      { emoji: '🌺', color: '#7C3AED' },
  jagannath: { emoji: '🛕', color: '#E85C2A' },
  murugan:   { emoji: '🌟', color: '#DC2626' },
};

const FESTIVAL_NAME_MAP = {
  'makar sankranti':   { emoji: '🪁', color: '#E8650A' },
  'vasant panchami':   { emoji: '🌸', color: '#C8960C' },
  'maha shivaratri':   { emoji: '🔱', color: '#5B4FDB' },
  'mahashivratri':     { emoji: '🔱', color: '#5B4FDB' },
  'holika dahan':      { emoji: '🔥', color: '#DC2626' },
  'holi':              { emoji: '🎨', color: '#E85CA0' },
  'ugadi':             { emoji: '🪔', color: '#E8650A' },
  'gudi padwa':        { emoji: '🪔', color: '#E8650A' },
  'ram navami':        { emoji: '🏹', color: '#2E8B57' },
  'hanuman jayanti':   { emoji: '🐒', color: '#E8650A' },
  'akshaya tritiya':   { emoji: '✨', color: '#C8960C' },
  'buddha purnima':    { emoji: '☸️',  color: '#D97706' },
  'nirjala ekadashi':  { emoji: '💧', color: '#1D4ED8' },
  'rath yatra':        { emoji: '🛕', color: '#E85C2A' },
  'guru purnima':      { emoji: '📿', color: '#8B5CF6' },
  'naga panchami':     { emoji: '🐍', color: '#065F46' },
  'nag panchami':      { emoji: '🐍', color: '#065F46' },
  'raksha bandhan':    { emoji: '🪢', color: '#E85CA0' },
  'janmashtami':       { emoji: '🪈', color: '#1D4ED8' },
  'ganesh chaturthi':  { emoji: '🐘', color: '#D97706' },
  'navratri':          { emoji: '🪆', color: '#BE185D' },
  'dussehra':          { emoji: '🏹', color: '#DC2626' },
  'vijayadashami':     { emoji: '🏹', color: '#DC2626' },
  'karwa chauth':      { emoji: '🌕', color: '#C8960C' },
  'dhanteras':         { emoji: '🪙', color: '#C8960C' },
  'diwali':            { emoji: '🪔', color: '#F59E0B' },
  'govardhan puja':    { emoji: '⛰️', color: '#1D4ED8' },
  'bhai dooj':         { emoji: '🌺', color: '#E85CA0' },
  'kartik purnima':    { emoji: '🌕', color: '#0EA5E9' },
  'vivah panchami':    { emoji: '💐', color: '#EC4899' },
  'gita jayanti':      { emoji: '📖', color: '#1D4ED8' },
  'pongal':            { emoji: '🌾', color: '#E8650A' },
  'onam':              { emoji: '🌺', color: '#16a34a' },
  'bihu':              { emoji: '🌾', color: '#D97706' },
  'sakat chauth':      { emoji: '🌙', color: '#5B4FDB' },
  'shattila ekadashi': { emoji: '📿', color: '#8B5CF6' },
  'bhishma ashtami':   { emoji: '⚔️', color: '#DC2626' },
};

function getEmojiColor(festival) {
  const nameLower = (festival.name || '').toLowerCase();
  for (const [key, val] of Object.entries(FESTIVAL_NAME_MAP)) {
    if (nameLower.includes(key)) return val;
  }
  const text = `${festival.significance || ''} ${festival.description || ''}`.toLowerCase();
  for (const [deity, val] of Object.entries(DEITY_EMOJI_MAP)) {
    if (text.includes(deity) || nameLower.includes(deity)) return val;
  }
  return { emoji: '🛕', color: '#E8650A' };
}

// Format display_date to a clean readable format: "4 May 2026"
function formatDisplayDate(raw) {
  if (!raw) return null;
  // If already in "D Month YYYY" format, return as-is
  // Try to parse ISO or various formats
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  } catch {}
  return raw;
}

function festKey(f) {
  return `${(f.name || '').toLowerCase().trim()}::${f.month}`;
}

const DEITY_FILTERS = ['All','Shiva','Vishnu','Ganesha','Durga','Lakshmi','Krishna','Rama','Saraswati'];
const TYPE_FILTERS  = ['All','Major','With Temple'];

const MONTH_SEASON = {
  1: { season: 'Winter', icon: '❄️' }, 2: { season: 'Winter', icon: '❄️' },
  3: { season: 'Spring', icon: '🌸' }, 4: { season: 'Spring', icon: '🌸' },
  5: { season: 'Summer', icon: '☀️' }, 6: { season: 'Summer', icon: '☀️' },
  7: { season: 'Monsoon', icon: '🌧️' }, 8: { season: 'Monsoon', icon: '🌧️' },
  9: { season: 'Monsoon', icon: '🌧️' }, 10: { season: 'Autumn', icon: '🍂' },
  11: { season: 'Autumn', icon: '🍂' }, 12: { season: 'Winter', icon: '❄️' },
};

const CURRENT_YEAR = new Date().getFullYear();

export default function FestivalCalendarPage() {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth]     = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode]               = useState('calendar');
  const [deityFilter, setDeityFilter]         = useState('All');
  const [typeFilter, setTypeFilter]           = useState('All');
  const [searchQuery, setSearchQuery]         = useState('');
  const [apiFestivals, setApiFestivals]       = useState([]);
  const [claudeFestivals, setClaudeFestivals] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [claudeLoading, setClaudeLoading]     = useState(true);
  const [selectedFestival, setSelectedFestival] = useState(null);

  const aiFetchDone = useRef(false);

  const fetchFestivals = useCallback(() => {
    setLoading(true);
    axios.get(`${API_BASE}/api/festivals?limit=500`)
      .then(r => setApiFestivals(Array.isArray(r.data) ? r.data : []))
      .catch(() => setApiFestivals([]))
      .finally(() => setLoading(false));
  }, []);

  const fetchFestivalsFromBackend = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && aiFetchDone.current) return;
    setClaudeLoading(true);
    try {
      const url = `${API_BASE}/api/festivals/ai-cache${forceRefresh ? '?refresh=true' : ''}`;
      const res = await axios.get(url);
      const festivals = Array.isArray(res.data?.festivals)
        ? res.data.festivals
        : Array.isArray(res.data) ? res.data : [];
      setClaudeFestivals(festivals.map(f => ({ ...f, _claude: true })));
      aiFetchDone.current = true;
    } catch {
      setClaudeFestivals([]);
      aiFetchDone.current = true;
    } finally {
      setClaudeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFestivals();
    fetchFestivalsFromBackend(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => fetchFestivals();
    window.addEventListener('festival:added', handler);
    return () => window.removeEventListener('festival:added', handler);
  }, [fetchFestivals]);

  const handleRefresh = useCallback(() => {
    aiFetchDone.current = false;
    fetchFestivals();
    fetchFestivalsFromBackend(true);
  }, [fetchFestivals, fetchFestivalsFromBackend]);

  const allFestivals = useMemo(() => {
    const apiKeys = new Set(apiFestivals.map(festKey));
    const claudeFiltered = claudeFestivals.filter(f => !apiKeys.has(festKey(f)));
    const enrichedAPI = apiFestivals.map(f => {
      const { emoji, color } = getEmojiColor(f);
      return { ...f, emoji: f.emoji || emoji, color: f.color || color };
    });
    const enrichedClaude = claudeFiltered.map(f => {
      const { emoji, color } = getEmojiColor(f);
      return { ...f, _claude: true, emoji: f.emoji || emoji, color: f.color || color };
    });
    return [...enrichedClaude, ...enrichedAPI];
  }, [apiFestivals, claudeFestivals]);

  const filtered = useMemo(() => {
    return allFestivals.filter(f => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!['name','significance','description','temple_name','deity']
          .some(k => (f[k] || '').toLowerCase().includes(q))) return false;
      }
      if (deityFilter !== 'All') {
        const text = `${f.name} ${f.significance || ''} ${f.description || ''} ${f.deity || ''}`.toLowerCase();
        if (!text.includes(deityFilter.toLowerCase())) return false;
      }
      if (typeFilter === 'Major' && !f.is_major) return false;
      if (typeFilter === 'With Temple' && !f.temple_id) return false;
      return true;
    });
  }, [allFestivals, searchQuery, deityFilter, typeFilter]);

  const byMonth = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    filtered.forEach(f => {
      const m = Number(f.month);
      if (m >= 1 && m <= 12) map[m].push(f);
    });
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => {
        const da = a.exact_date || a.typical_date;
        const db = b.exact_date || b.typical_date;
        if (da && db) return da.localeCompare(db);
        return (b.is_major ? 1 : 0) - (a.is_major ? 1 : 0) || (a.name || '').localeCompare(b.name || '');
      })
    );
    return map;
  }, [filtered]);

  const currentMonthFestivals = byMonth[selectedMonth] || [];
  const totalCount   = filtered.length;
  const apiCount     = apiFestivals.length;
  const isAnyLoading = loading || claudeLoading;

  const goMonth = dir => setSelectedMonth(m => {
    let next = m + dir;
    if (next < 1) next = 12;
    if (next > 12) next = 1;
    return next;
  });

  return (
    <>
      <Navbar />

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section style={{
        position: 'relative', overflow: 'hidden', color: '#FFD580',
        background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
        padding: '88px 24px 92px', textAlign: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 360, color: 'rgba(255,255,255,0.028)', fontFamily: 'var(--font-hindi)',
          pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
        }}>ॐ</div>
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse, rgba(232,101,10,0.28) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {['🪔','✨','🌸','🔱','🪁'].map((e, i) => (
          <div key={i} style={{
            position: 'absolute', fontSize: 'clamp(20px,3vw,40px)', opacity: 0.18, pointerEvents: 'none',
            animation: `floatDiya 6s ease-in-out ${[0,1.2,0.6,2,1.8][i]}s infinite`,
            ...[
              { top:'15%', left:'7%' }, { top:'60%', left:'15%' },
              { top:'20%', right:'10%' }, { bottom:'20%', right:'6%' },
              { top:'45%', left:'3%' },
            ][i],
          }}>{e}</div>
        ))}

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
            borderRadius: 50, padding: '6px 20px', marginBottom: 20,
            color: '#FFD580', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
            fontWeight: 500, backdropFilter: 'blur(8px)',
          }}>{t('festival.presents')}</div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(38px,6vw,72px)', lineHeight: 1.05, marginBottom: 18,
            textShadow: '0 4px 40px rgba(0,0,0,0.3)', color: '#FFD580',
          }}>{t('festival.title')}</h1>

          <p style={{
            color: '#FFD580', opacity: 0.82, fontSize: 18,
            maxWidth: 540, margin: '0 auto', fontWeight: 300, lineHeight: 1.7,
            fontFamily: 'var(--font-hindi)',
          }}>{t('festival.subtitle')}</p>

          {/* Hero stat pills — no AI Curated */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
            {[
              `${totalCount} ${t('festival.festivals')}`,
              t('festival.months'),
              String(CURRENT_YEAR),
              ...(apiCount > 0 ? [`🛕 ${apiCount} ${t('festival.temple_festivals')}`] : []),
            ].map((s, i) => (
              <span key={i} style={{
                fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.08em',
                color: '#FFD580', background: 'rgba(255,255,255,0.08)',
                padding: '5px 14px', borderRadius: 50, border: '1px solid rgba(200,150,12,.3)',
              }}>{s}</span>
            ))}
          </div>

          {claudeLoading && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
              fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,213,128,0.7)',
              background: 'rgba(255,255,255,0.07)', padding: '6px 16px', borderRadius: 50,
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              <span style={{ animation: 'floatDiya 1.5s ease-in-out infinite', display: 'inline-block' }}>✨</span>
              {t('festival.loading')}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════ CONTROLS BAR ═══════════════════ */}
      <div style={{
        background: 'rgba(255,252,248,0.98)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(237,224,204,0.8)', padding: '0 28px',
        position: 'sticky', top: 70, zIndex: 100,
        boxShadow: '0 2px 16px rgba(61,31,0,0.07)',
      }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 9px', borderBottom: '1px solid rgba(237,224,204,0.5)' }}>

            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'white',
              border: '1.5px solid #E8D5B8', borderRadius: 10, padding: '7px 14px',
              flex: '0 0 280px', boxShadow: '0 1px 4px rgba(61,31,0,0.05)', transition: 'border-color .18s, box-shadow .18s',
            }}>
              <Search size={14} color="#B8906A" strokeWidth={2} />
              <input
                style={{ border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13, color: '#2D1200', outline: 'none', width: '100%', letterSpacing: '.01em', lineHeight: 1 }}
                placeholder={t('festival.search_placeholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={e => { e.currentTarget.parentElement.style.borderColor='#E8650A'; e.currentTarget.parentElement.style.boxShadow='0 0 0 3px rgba(232,101,10,0.1)'; }}
                onBlur={e => { e.currentTarget.parentElement.style.borderColor='#E8D5B8'; e.currentTarget.parentElement.style.boxShadow='0 1px 4px rgba(61,31,0,0.05)'; }}
              />
              {searchQuery ? (
                <button onClick={() => setSearchQuery('')} style={{ background: '#F0E6D6', border: 'none', cursor: 'pointer', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A7150', fontSize: 10, flexShrink: 0 }}>✕</button>
              ) : (
                <kbd style={{ fontSize: 10, color: '#B8906A', background: '#F5EDE0', border: '1px solid #E8D5B8', borderRadius: 4, padding: '1px 5px', fontFamily: 'var(--font-body)', letterSpacing: 0, lineHeight: 1.6 }}>⌘K</kbd>
              )}
            </div>

            {/* Active filter badge */}
            {(deityFilter !== 'All' || typeFilter !== 'All' || searchQuery) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(232,101,10,0.07)', border: '1px solid rgba(232,101,10,0.18)', borderRadius: 8, padding: '4px 10px', fontFamily: 'var(--font-body)', fontSize: 12, color: '#A04000' }}>
                {[deityFilter !== 'All' && deityFilter, typeFilter !== 'All' && typeFilter, searchQuery && `"${searchQuery}"`].filter(Boolean).join(' · ')}
                <button onClick={() => { setDeityFilter('All'); setTypeFilter('All'); setSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A04000', fontSize: 13, lineHeight: 1, padding: '0 0 0 2px', opacity: 0.7 }}>×</button>
              </div>
            )}

            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#9A7150', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#C8500A', fontWeight: 600 }}>{totalCount}</span> {t('festival.festivals')}
            </span>

            <div style={{ flex: 1 }} />

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isAnyLoading}
              title="Refresh festivals"
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E8D5B8', background: 'white',
                cursor: isAnyLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#B8906A', transition: 'all .18s', opacity: isAnyLoading ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (!isAnyLoading) { e.currentTarget.style.borderColor='#E8650A'; e.currentTarget.style.color='#E8650A'; e.currentTarget.style.background='#FFF8F2'; }}}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#E8D5B8'; e.currentTarget.style.color='#B8906A'; e.currentTarget.style.background='white'; }}
            >
              <RefreshCw size={13} style={{ animation: isAnyLoading ? 'spin .8s linear infinite' : 'none' }} />
            </button>

            {/* View toggle */}
            <div style={{ display: 'flex', background: '#F5EDE0', border: '1.5px solid #E8D5B8', borderRadius: 10, padding: 3, gap: 2 }}>
              {[
                { mode: 'calendar', icon: <Calendar size={12} />, labelKey: 'festival.view_calendar' },
                { mode: 'list',     icon: <Star size={12} />,     labelKey: 'festival.view_all' },
              ].map(v => (
                <button key={v.mode} onClick={() => setViewMode(v.mode)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  border: 'none', cursor: 'pointer', borderRadius: 7, fontFamily: 'var(--font-body)', fontSize: 12,
                  fontWeight: viewMode === v.mode ? 600 : 400, letterSpacing: '.01em',
                  background: viewMode === v.mode ? 'white' : 'transparent',
                  color: viewMode === v.mode ? '#C8500A' : '#9A7150',
                  boxShadow: viewMode === v.mode ? '0 1px 4px rgba(61,31,0,0.1)' : 'none', transition: 'all .18s',
                }}>{v.icon} {t(v.labelKey)}</button>
              ))}
            </div>
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 9px', overflowX: 'auto', scrollbarWidth: 'none' }} className="scrollbar-hide">
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#B8906A', fontWeight: 500, whiteSpace: 'nowrap', marginRight: 2, flexShrink: 0 }}>{t('festival.deity')}</span>
            {DEITY_FILTERS.map(d => {
              const active = deityFilter === d;
              return (
                <button key={d} onClick={() => setDeityFilter(d)} style={{
                  padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0,
                  border: `1px solid ${active ? '#E8650A' : '#E8D5B8'}`, borderRadius: 7,
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
                  background: active ? '#E8650A' : 'white', color: active ? 'white' : '#4A2800',
                  boxShadow: active ? '0 2px 8px rgba(232,101,10,0.22)' : 'none', transition: 'all .15s',
                }}>{d}</button>
              );
            })}
            <div style={{ width: 1, height: 18, background: '#E8D5B8', flexShrink: 0, margin: '0 2px' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#B8906A', fontWeight: 500, whiteSpace: 'nowrap', marginRight: 2, flexShrink: 0 }}>{t('festival.type')}</span>
            {TYPE_FILTERS.map(tp => {
              const active = typeFilter === tp;
              return (
                <button key={tp} onClick={() => setTypeFilter(tp)} style={{
                  padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0,
                  border: `1px solid ${active ? '#C8960C' : '#E8D5B8'}`, borderRadius: 7,
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
                  background: active ? '#C8960C' : 'white', color: active ? 'white' : '#4A2800',
                  boxShadow: active ? '0 2px 8px rgba(200,150,12,0.22)' : 'none', transition: 'all .15s',
                }}>{tp}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════ BODY ═══════════════════ */}
      <section style={{ background: '#f4ede3', paddingBottom: 80, paddingTop: 48 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 24px' }}>
          {viewMode === 'calendar' ? (
            <>
              <PremiumMonthNavigator
                selectedMonth={selectedMonth}
                byMonth={byMonth}
                onSelect={setSelectedMonth}
                onPrev={() => goMonth(-1)}
                onNext={() => goMonth(1)}
              />

              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 28 }}>{MONTH_SEASON[selectedMonth]?.icon}</span>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 900, color: '#4b1d04', letterSpacing: '-0.5px' }}>
                        {GREGORIAN_MONTHS[selectedMonth - 1]}
                        <span style={{ fontWeight: 400, color: '#9A7150', fontSize: 22, marginLeft: 10 }}>{CURRENT_YEAR}</span>
                      </h2>
                    </div>
                    <p style={{ fontFamily: 'var(--font-hindi)', fontSize: 15, color: '#9A7150', marginTop: 0 }}>
                      {HINDU_MONTHS[(selectedMonth + 1) % 12]} · {HINDU_MONTHS[selectedMonth % 12]}
                    </p>
                  </div>
                  {/* Month section pills — only temple label + count, no AI Curated */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {currentMonthFestivals.some(f => f.temple_id) && (
                      <PillBadge color="#16a34a" bg="rgba(16,163,74,0.08)" border="rgba(16,163,74,.2)">{t('festival.temple_label')}</PillBadge>
                    )}
                    <PillBadge color="#E8650A" bg="rgba(232,101,10,0.1)" border="rgba(232,101,10,.25)" bold>
                      {currentMonthFestivals.length} {currentMonthFestivals.length !== 1 ? t('festival.festivals') : t('festival.day')}
                    </PillBadge>
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #E8650A55, transparent)' }} />
                  <span style={{ fontSize: 14, opacity: 0.4 }}>🔱</span>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #E8650A55)' }} />
                </div>
              </div>

              {claudeLoading && allFestivals.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 12, color: '#9A7150', background: 'rgba(232,101,10,0.06)', border: '1px solid rgba(232,101,10,0.15)', borderRadius: 50, padding: '6px 16px', marginBottom: 24, width: 'fit-content' }}>
                  <span style={{ animation: 'floatDiya 1.5s ease-in-out infinite', display: 'inline-block' }}>✨</span>
                  {t('festival.loading')}
                </div>
              )}

              {currentMonthFestivals.length === 0 ? (
                isAnyLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                    {[...Array(6)].map((_, i) => (
                      <div key={i} style={{ background: 'white', borderRadius: 20, border: '1.5px solid rgba(237,224,204,0.8)', overflow: 'hidden', animation: `cardIn .4s ease both`, animationDelay: `${i * 0.07}s` }}>
                        <div style={{ height: 5, background: 'linear-gradient(90deg, #EDE0CC, #F5EDE0)' }} />
                        <div style={{ padding: '22px 22px 18px', display: 'flex', gap: 16 }}>
                          <div style={{ width: 60, height: 60, borderRadius: 18, background: '#F5EDE0', flexShrink: 0, animation: 'shimmer 1.5s ease-in-out infinite' }} />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ height: 10, borderRadius: 50, background: '#F5EDE0', width: '40%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                            <div style={{ height: 18, borderRadius: 6, background: '#F5EDE0', width: '75%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                            <div style={{ height: 12, borderRadius: 6, background: '#F5EDE0', width: '55%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                          </div>
                        </div>
                        <div style={{ height: 42, background: '#FDFAF6', borderTop: '1px solid #F5EDE0' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '72px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 52 }}>🙏</span>
                    <p style={{ color: '#9A7150', fontFamily: 'var(--font-body)', fontSize: 16 }}>
                      {t('festival.no_festivals')} — {GREGORIAN_MONTHS[selectedMonth - 1]}
                    </p>
                    <button onClick={() => { setDeityFilter('All'); setTypeFilter('All'); setSearchQuery(''); }}
                      style={{ padding: '8px 20px', border: '2px solid #EDE0CC', borderRadius: 50, background: 'white', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.05em', cursor: 'pointer', color: '#5C3D1E' }}>
                      {t('festival.clear_filters')}
                    </button>
                  </div>
                )
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                  {currentMonthFestivals.map((f, i) => (
                    <PremiumFestivalCard key={`${f.id || f.name}-${i}`} festival={f} index={i} onClick={() => setSelectedFestival(f)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
              {GREGORIAN_MONTHS.map((mName, mi) => {
                const mNum  = mi + 1;
                const fests = byMonth[mNum] || [];
                if (fests.length === 0) return null;
                return (
                  <div key={mName}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <span style={{ fontSize: 20 }}>{MONTH_SEASON[mNum]?.icon}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#4b1d04' }}>{mName}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'white', background: '#E8650A', padding: '2px 9px', borderRadius: 50 }}>{fests.length}</span>
                      <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: '#9A7150', marginLeft: 4 }}>{HINDU_MONTHS[(mNum + 1) % 12]}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                      {fests.map((f, i) => (
                        <PremiumFestivalCard key={`${f.id || f.name}-${i}`} festival={f} index={i} compact onClick={() => setSelectedFestival(f)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedFestival && <FestivalModal festival={selectedFestival} onClose={() => setSelectedFestival(null)} />}
      <Footer />

      <style>{`
        @keyframes floatDiya { 0%,100%{ transform:translateY(0) rotate(-5deg); opacity:.18; } 50%{ transform:translateY(-18px) rotate(5deg); opacity:.32; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes slideUp { from{transform:translateY(28px);opacity:0;}to{transform:translateY(0);opacity:1;} }
        @keyframes fadeIn { from{opacity:0;}to{opacity:1;} }
        @keyframes cardIn { from { transform: translateY(20px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        .scrollbar-hide::-webkit-scrollbar { display:none; }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
        .month-pill { display:flex; flex-direction:column; align-items:center; padding:10px 10px 8px; border-radius:18px; flex-shrink:0; cursor:pointer; transition:all .25s cubic-bezier(.34,1.56,.64,1); border:1.5px solid transparent; position:relative; overflow:hidden; min-width:56px; }
        .month-pill:hover:not(.active) { background:rgba(232,101,10,0.08); border-color:rgba(232,101,10,0.25); transform:translateY(-2px); }
        .month-pill.active { background:linear-gradient(145deg,#E8650A 0%,#B84D00 100%); border-color:#E8650A; transform:translateY(-3px); box-shadow:0 10px 30px rgba(232,101,10,0.38),0 4px 12px rgba(232,101,10,0.22); }
        .month-pill .pill-name { font-family:var(--font-display); font-size:12px; font-weight:700; letter-spacing:.06em; color:#5C3D1E; transition:color .2s; }
        .month-pill.active .pill-name { color:white; }
        .month-pill .pill-count { font-size:10px; font-weight:800; margin-top:4px; min-width:20px; text-align:center; padding:2px 6px; border-radius:50px; transition:all .2s; }
        .month-pill:not(.active) .pill-count { background:rgba(232,101,10,0.12); color:#B84D00; }
        .month-pill.active .pill-count { background:rgba(255,255,255,0.22); color:white; }
        .month-pill .pill-dot { position:absolute; bottom:4px; left:50%; transform:translateX(-50%); width:4px; height:4px; border-radius:50%; background:rgba(232,101,10,0.5); opacity:0; transition:opacity .2s; }
        .month-pill.has-temple .pill-dot { opacity:1; background:#16a34a; }
        .fest-card-premium { background:white; border-radius:20px; border:1.5px solid rgba(237,224,204,0.9); overflow:hidden; transition:all .28s cubic-bezier(.34,1.2,.64,1); cursor:pointer; position:relative; }
        .fest-card-premium:hover { transform:translateY(-5px); box-shadow:0 16px 40px rgba(61,31,0,0.13),0 4px 12px rgba(61,31,0,0.07); border-color:rgba(232,101,10,0.2); }
        .fest-card-premium .card-glow { position:absolute; top:0; left:0; right:0; height:180px; opacity:0; transition:opacity .3s; pointer-events:none; }
        .fest-card-premium:hover .card-glow { opacity:1; }
        @media(max-width:640px){ .fest-modal-meta { grid-template-columns:1fr !important; } }
      `}</style>
    </>
  );
}

function PillBadge({ children, color, bg, border, bold }) {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.04em', color, background: bg, padding: '5px 14px', borderRadius: 50, border: `1px solid ${border}`, fontWeight: bold ? 700 : 500 }}>{children}</span>
  );
}

function PremiumMonthNavigator({ selectedMonth, byMonth, onSelect, onPrev, onNext }) {
  return (
    <div style={{ background: 'white', borderRadius: 28, boxShadow: '0 8px 40px rgba(61,31,0,0.10), 0 2px 8px rgba(61,31,0,0.05)', border: '1.5px solid rgba(232,101,10,0.12)', padding: '18px 20px', marginBottom: 36, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,101,10,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: -20, bottom: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,150,12,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.14em', color: '#C8960C', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center', marginBottom: 14, opacity: 0.8 }}>
        ✦ Hindu Festival Calendar {CURRENT_YEAR} ✦
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onPrev}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid #EDE0CC', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a3208', flexShrink: 0, transition: 'all .22s', boxShadow: '0 2px 8px rgba(61,31,0,0.06)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#E8650A'; e.currentTarget.style.background='#FFF5EC'; e.currentTarget.style.color='#E8650A'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='#EDE0CC'; e.currentTarget.style.background='white'; e.currentTarget.style.color='#7a3208'; }}
        ><ChevronLeft size={18} /></button>

        <div style={{ display: 'flex', gap: 5, flex: 1, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 2px' }} className="scrollbar-hide">
          {GREGORIAN_MONTHS.map((m, i) => {
            const mNum      = i + 1;
            const count     = (byMonth[mNum] || []).length;
            const hasTemple = (byMonth[mNum] || []).some(f => f.temple_id);
            const isActive  = selectedMonth === mNum;
            return (
              <button key={m} onClick={() => onSelect(mNum)} className={`month-pill${isActive ? ' active' : ''}${hasTemple ? ' has-temple' : ''}`}>
                <span style={{ fontSize: 11, marginBottom: 2, opacity: isActive ? 0.9 : 0.45, lineHeight: 1 }}>{MONTH_SEASON[mNum]?.icon}</span>
                <span className="pill-name">{MONTH_SHORT[i]}</span>
                {count > 0 && <span className="pill-count">{count}</span>}
                {hasTemple && <span className="pill-dot" />}
              </button>
            );
          })}
        </div>

        <button onClick={onNext}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid #EDE0CC', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a3208', flexShrink: 0, transition: 'all .22s', boxShadow: '0 2px 8px rgba(61,31,0,0.06)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#E8650A'; e.currentTarget.style.background='#FFF5EC'; e.currentTarget.style.color='#E8650A'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='#EDE0CC'; e.currentTarget.style.background='white'; e.currentTarget.style.color='#7a3208'; }}
        ><ChevronRight size={18} /></button>
      </div>

      <div style={{ marginTop: 14, height: 3, background: '#F5EDE0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #E8650A, #FFB347)', width: `${(selectedMonth / 12) * 100}%`, transition: 'width .4s cubic-bezier(.34,1.2,.64,1)', boxShadow: '0 0 8px rgba(232,101,10,0.4)' }} />
      </div>
    </div>
  );
}

function PremiumFestivalCard({ festival, compact, index, onClick }) {
  const { t } = useTranslation();
  const emoji       = festival.emoji || '🛕';
  const color       = festival.color || '#E8650A';
  const [hovered, setHovered] = useState(false);
  const tint        = `${color}15`;
  const tintMid     = `${color}28`;
  const displayDate = formatDisplayDate(festival.display_date);

  return (
    <div
      className="fest-card-premium"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animation: `cardIn .4s ease both`, animationDelay: `${Math.min(index * 0.06, 0.5)}s` }}
    >
      <div className="card-glow" style={{ background: `radial-gradient(ellipse at 30% 0%, ${tintMid} 0%, transparent 70%)` }} />

      {/* Top color bar */}
      <div style={{
        height: compact ? 4 : 5,
        background: `linear-gradient(90deg, ${color}, ${color}66, transparent)`,
        transition: 'height .25s',
        ...(hovered ? { height: compact ? 5 : 7 } : {}),
      }} />

      {/* Card body */}
      <div style={{ padding: compact ? '14px 16px 12px' : '20px 20px 14px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>

          {/* Emoji icon */}
          <div style={{
            width: compact ? 46 : 58,
            height: compact ? 46 : 58,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: compact ? 14 : 16,
            background: tint,
            border: `1.5px solid ${tintMid}`,
            fontSize: compact ? 22 : 26,
            flexShrink: 0,
            transition: 'all .28s cubic-bezier(.34,1.5,.64,1)',
            ...(hovered ? { transform: 'scale(1.1) rotate(-5deg)', boxShadow: `0 8px 20px ${color}25` } : {}),
          }}>{emoji}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Date badge — crisp, readable */}
            {displayDate && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                color: color,
                background: tint,
                border: `1px solid ${tintMid}`,
                padding: '3px 9px',
                borderRadius: 6,
                marginBottom: 7,
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.01em',
                lineHeight: 1.4,
              }}>
                <span style={{ fontSize: 10 }}>📅</span>
                {displayDate}
              </div>
            )}

            {/* Festival name */}
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: compact ? 14 : 16,
              fontWeight: 800,
              color: '#1A0A00',
              marginBottom: 3,
              lineHeight: 1.25,
              letterSpacing: '-0.2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }} title={festival.name}>
              {festival.name}
            </div>

            {/* Tithi / significance subtitle */}
            {(festival.hindu_tithi || festival.significance) && (
              <div style={{
                fontFamily: 'var(--font-hindi)',
                fontSize: compact ? 11 : 12,
                color: '#9A7150',
                marginBottom: festival.deity || festival.duration_days > 1 || festival.temple_id ? 8 : 0,
                lineHeight: 1.45,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {festival.hindu_tithi || festival.significance}
              </div>
            )}

            {/* Tag row */}
            {(festival.duration_days > 1 || (festival.deity && festival.deity !== 'Other') || festival.temple_id) && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {festival.duration_days > 1 && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-display)', letterSpacing: '.03em', border: '1px solid #EDE0CC', color: '#5C3D1E', background: '#FDF6EC', fontWeight: 500 }}>
                    {festival.duration_days} {t('festival.days')}
                  </span>
                )}
                {festival.deity && festival.deity !== 'Other' && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-display)', letterSpacing: '.03em', border: '1px solid rgba(29,78,216,.18)', color: '#1D4ED8', background: 'rgba(29,78,216,.05)', fontWeight: 500 }}>
                    {festival.deity}
                  </span>
                )}
                {festival.temple_id && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-display)', letterSpacing: '.03em', border: '1px solid rgba(16,163,74,.22)', color: '#16a34a', background: 'rgba(16,163,74,.05)', fontWeight: 500 }}>
                    {t('festival.temple_label')}
                  </span>
                )}
              </div>
            )}

            {/* Temple name */}
            {festival.temple_name && (
              <div style={{
                fontFamily: 'var(--font-hindi)',
                fontSize: 11,
                color: '#16a34a',
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                <MapPin size={10} strokeWidth={2.5} />
                {festival.temple_name}{festival.temple_city ? `, ${festival.temple_city}` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom description strip */}
      {!compact && festival.significance && (
        <div style={{
          borderTop: `1px solid ${tint}`,
          padding: '10px 20px 14px',
          overflow: 'hidden',
        }}>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: '#7A5035',
            lineHeight: 1.65,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {festival.significance}
          </div>
        </div>
      )}
    </div>
  );
}

function FestivalModal({ festival, onClose }) {
  const { t } = useTranslation();
  const monthName   = GREGORIAN_MONTHS[(festival.month || 1) - 1] || '';
  const hinduMonth  = festival.hindu_month || HINDU_MONTHS[((festival.month || 1) - 1) % 12] || '';
  const emoji       = festival.emoji || '🛕';
  const color       = festival.color || '#E8650A';
  const displayDate = formatDisplayDate(festival.display_date);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(26,10,0,.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fadeIn .2s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#FDF6EC', borderRadius: 28, maxWidth: 580, width: '100%', overflow: 'hidden', animation: 'slideUp .28s cubic-bezier(.34,1.2,.64,1)', boxShadow: '0 40px 100px rgba(26,10,0,.5), 0 8px 24px rgba(26,10,0,.2)', maxHeight: '90vh', overflowY: 'auto', border: '1.5px solid rgba(255,200,100,0.15)' }}>
        {/* Modal header */}
        <div style={{ padding: '28px 28px 20px', background: `linear-gradient(135deg, ${color}15 0%, ${color}06 100%)`, borderBottom: `1px solid ${color}20`, display: 'flex', alignItems: 'flex-start', gap: 18 }}>
          <div style={{ fontSize: 40, width: 70, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20, background: 'white', border: `2px solid ${color}28`, boxShadow: `0 8px 24px ${color}18`, flexShrink: 0 }}>{emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, color: '#1A0A00', marginBottom: 5, letterSpacing: '-0.3px', lineHeight: 1.2 }}>{festival.name}</div>
            {displayDate && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color, fontWeight: 600, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>📅</span> {displayDate}
              </div>
            )}
            {festival.hindu_tithi && <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: '#9A7150', marginBottom: 8 }}>{festival.hindu_tithi}</div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {festival.temple_id && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(16,163,74,.25)', color: '#16a34a', background: 'rgba(16,163,74,.06)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{t('festival.temple_label')}</span>}
              {festival.deity && festival.deity !== 'Other' && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(29,78,216,.2)', color: '#1D4ED8', background: 'rgba(29,78,216,.06)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{festival.deity}</span>}
            </div>
          </div>
        </div>

        {/* Modal body */}
        <div style={{ padding: '22px 28px 28px' }}>
          {festival.temple_name && (
            <div style={{ background: 'rgba(16,163,74,0.06)', border: '1px solid rgba(16,163,74,.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.1em', color: '#16a34a', marginBottom: 5, fontWeight: 700 }}>🛕 CELEBRATED AT</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: '#1A0A00' }}>{festival.temple_name}</div>
              {festival.temple_city && <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, color: '#16a34a', marginTop: 3 }}>📍 {festival.temple_city}</div>}
            </div>
          )}
          {festival.significance && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.8, color: '#4A2A00', marginBottom: 14 }}>
              <strong style={{ color: '#1A0A00' }}>{t('festival.significance')}:</strong> {festival.significance}
            </p>
          )}
          {festival.description && festival.description !== festival.significance && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.8, color: '#6B4423', marginBottom: 22 }}>{festival.description}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', opacity: 0.35 }}>
            <div style={{ flex: 1, height: 1, background: '#EDE0CC' }} /><span style={{ fontSize: 12 }}>🔱</span><div style={{ flex: 1, height: 1, background: '#EDE0CC' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }} className="fest-modal-meta">
            {displayDate && (
              <div style={{ background: 'white', border: '1px solid #EDE0CC', borderRadius: 14, padding: '12px 16px', gridColumn: '1 / -1' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.1em', color: '#9A7150', marginBottom: 4, fontWeight: 700 }}>{t('festival.date')}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color }}>{displayDate}</div>
              </div>
            )}
            {[
              { label: 'GREGORIAN MONTH', value: monthName },
              { label: 'HINDU MONTH', value: hinduMonth, hindi: true },
              ...(festival.hindu_tithi ? [{ label: 'TITHI', value: festival.hindu_tithi, small: true }] : []),
              { label: t('festival.duration').toUpperCase(), value: `${festival.duration_days || 1} ${(festival.duration_days || 1) === 1 ? t('festival.day') : t('festival.days')}` },
            ].map((item, idx) => (
              <div key={idx} style={{ background: 'white', border: '1px solid #EDE0CC', borderRadius: 14, padding: '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.1em', color: '#9A7150', marginBottom: 4, fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontFamily: item.hindi ? 'var(--font-hindi)' : 'var(--font-body)', fontSize: item.small ? 13 : 15, fontWeight: 600, color: '#1A0A00' }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px', border: '2px solid #EDE0CC', borderRadius: 50, background: 'white', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.05em', color: '#5C3D1E', cursor: 'pointer', fontWeight: 600 }}>{t('festival.close')}</button>
            {festival.temple_slug ? (
              <Link to={`/temple/${festival.temple_slug}`} onClick={onClose} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 20px', background: `linear-gradient(135deg, ${color}, #B84D00)`, color: 'white', border: 'none', borderRadius: 50, fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.05em', textDecoration: 'none', fontWeight: 600, boxShadow: `0 6px 20px ${color}38` }}>
                <MapPin size={14} /> Visit Temple
              </Link>
            ) : (
              <Link to={`/search?q=${encodeURIComponent(festival.name)}`} onClick={onClose} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px 20px', background: 'linear-gradient(135deg, #E8650A, #B84D00)', color: 'white', border: 'none', borderRadius: 50, fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.05em', textDecoration: 'none', fontWeight: 600, boxShadow: '0 6px 20px rgba(232,101,10,0.38)' }}>
                <MapPin size={14} /> Find Temples
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}