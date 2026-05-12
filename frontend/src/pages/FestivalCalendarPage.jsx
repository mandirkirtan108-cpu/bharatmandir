import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Star, Search, ChevronLeft, ChevronRight, MapPin, Filter, RefreshCw } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Static Data ────────────────────────────────────────────────────────────────
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

function festKey(f) {
  return `${(f.name || '').toLowerCase().trim()}::${f.month}`;
}

const DEITY_FILTERS = ['All','Shiva','Vishnu','Ganesha','Durga','Lakshmi','Krishna','Rama','Saraswati'];
const TYPE_FILTERS  = ['All','Major','With Temple'];

function makePrompt(months) {
  return `List ALL Hindu festivals for 2025 in months: ${months}.
Return ONLY a valid JSON array. No explanation, no markdown, no backticks, no extra text.
Each object must have EXACTLY these fields:
{"name":"string","month":1,"exact_date":"2025-01-14","display_date":"14 January 2025","hindu_tithi":"string","hindu_month":"string","significance":"one sentence","description":"2-3 sentences max","is_major":true,"duration_days":1,"deity":"Surya","emoji":"🪁","color":"#E8650A"}
Rules:
- Cover every festival, vrat, Ekadashi, Purnima, Chaturthi in those months
- Include regional festivals (Pongal, Onam, Bihu, Ugadi, Baisakhi etc.) where applicable
- is_major=true only for nationally celebrated festivals
- deity: Shiva/Vishnu/Krishna/Rama/Ganesha/Durga/Lakshmi/Saraswati/Surya/Hanuman/Other
- description max 2-3 sentences (keep short to avoid truncation)
- Sort by exact_date ascending
- Output ONLY the JSON array, nothing else`;
}

const PROMPT_H1 = makePrompt('January, February, March, April, May, June');
const PROMPT_H2 = makePrompt('July, August, September, October, November, December');

export default function FestivalCalendarPage() {
  const [selectedMonth, setSelectedMonth]       = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode]                 = useState('calendar');
  const [deityFilter, setDeityFilter]           = useState('All');
  const [typeFilter, setTypeFilter]             = useState('All');
  const [searchQuery, setSearchQuery]           = useState('');
  const [apiFestivals, setApiFestivals]         = useState([]);
  const [claudeFestivals, setClaudeFestivals]   = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [claudeLoading, setClaudeLoading]       = useState(true);
  const [claudeError, setClaudeError]           = useState(false);
  const [claudeErrorMsg, setClaudeErrorMsg]     = useState('');
  const [selectedFestival, setSelectedFestival] = useState(null);

  const currentYear = new Date().getFullYear();

  const fetchFestivals = useCallback(() => {
    setLoading(true);
    axios.get(`${API_BASE}/api/festivals?limit=500`)
      .then(r => setApiFestivals(Array.isArray(r.data) ? r.data : []))
      .catch(() => setApiFestivals([]))
      .finally(() => setLoading(false));
  }, []);

  const callClaudeAPI = useCallback(async (prompt, apiKey) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
    if (data.error) throw new Error(data.error.message || 'Unknown API error');

    const rawText = data.content?.[0]?.text || '[]';
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseErr) {
      try {
        const lastComma = cleaned.lastIndexOf('},');
        if (lastComma !== -1) {
          const partial = cleaned.substring(0, lastComma + 1) + ']';
          const recovered = JSON.parse(partial);
          return Array.isArray(recovered) ? recovered : [];
        }
      } catch (_) {}
      return [];
    }
  }, []);

  const fetchFestivalsFromClaude = useCallback(async () => {
    setClaudeLoading(true);
    setClaudeError(false);
    setClaudeErrorMsg('');

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      setClaudeError(true);
      setClaudeErrorMsg('API key missing. Add VITE_ANTHROPIC_API_KEY to your .env file.');
      setClaudeLoading(false);
      return;
    }

    try {
      const [h1, h2] = await Promise.all([
        callClaudeAPI(PROMPT_H1, apiKey),
        callClaudeAPI(PROMPT_H2, apiKey),
      ]);
      setClaudeFestivals([...h1, ...h2]);
    } catch (err) {
      setClaudeError(true);
      setClaudeErrorMsg(err.message || 'Unknown error');
      setClaudeFestivals([]);
    } finally {
      setClaudeLoading(false);
    }
  }, [callClaudeAPI]);

  useEffect(() => {
    fetchFestivals();
    fetchFestivalsFromClaude();
  }, [fetchFestivals, fetchFestivalsFromClaude]);

  useEffect(() => {
    const handler = () => fetchFestivals();
    window.addEventListener('festival:added', handler);
    return () => window.removeEventListener('festival:added', handler);
  }, [fetchFestivals]);

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
        const inName   = (f.name || '').toLowerCase().includes(q);
        const inSig    = (f.significance || '').toLowerCase().includes(q);
        const inDesc   = (f.description || '').toLowerCase().includes(q);
        const inTemple = (f.temple_name || '').toLowerCase().includes(q);
        const inDeity  = (f.deity || '').toLowerCase().includes(q);
        if (!inName && !inSig && !inDesc && !inTemple && !inDeity) return false;
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
        if (a.exact_date && b.exact_date) return a.exact_date.localeCompare(b.exact_date);
        return (b.is_major ? 1 : 0) - (a.is_major ? 1 : 0) || (a.name || '').localeCompare(b.name || '');
      })
    );
    return map;
  }, [filtered]);

  const currentMonthFestivals = byMonth[selectedMonth] || [];
  const totalCount   = filtered.length;
  const apiCount     = apiFestivals.length;
  const claudeCount  = claudeFestivals.length;
  const isAnyLoading = loading || claudeLoading;

  const goMonth = dir => setSelectedMonth(m => {
    let next = m + dir;
    if (next < 1) next = 12;
    if (next > 12) next = 1;
    return next;
  });

  const handleRefresh = () => {
    fetchFestivals();
    fetchFestivalsFromClaude();
  };

  return (
    <>
      <Navbar />

      {/* ══════════════ HERO — matches RoutePlanner exactly ══════════════ */}
      <section style={{
        position: 'relative', overflow: 'hidden', color: '#FFD580',
        background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
        padding: '88px 24px 120px', textAlign: 'center',
      }}>
        {/* Om watermark */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 360, color: 'rgba(255,255,255,0.028)', fontFamily: 'var(--font-hindi)',
          pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
        }}>ॐ</div>
        {/* radial glow */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse, rgba(232,101,10,0.28) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* floating diyas */}
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
          {/* badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
            borderRadius: 50, padding: '6px 20px', marginBottom: 20,
            color: '#FFD580', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
            fontWeight: 500, backdropFilter: 'blur(8px)',
          }}>
            🛕 BharatMandir Presents
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(38px,6vw,72px)', lineHeight: 1.05, marginBottom: 18,
            textShadow: '0 4px 40px rgba(0,0,0,0.3)', color: '#FFD580',
          }}>
            Festival Calendar
          </h1>

          <p style={{
            color: '#FFD580', opacity: 0.82, fontSize: 18,
            maxWidth: 540, margin: '0 auto', fontWeight: 300, lineHeight: 1.7,
            fontFamily: 'var(--font-hindi)',
          }}>
            पर्व और उत्सव — Celebrating the Sacred Rhythm of Bharat
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
            {[
              `${totalCount} Festivals`,
              '12 Months',
              String(currentYear),
              ...(claudeCount > 0 ? [`✨ ${claudeCount} AI Curated`] : []),
              ...(apiCount > 0 ? [`🛕 ${apiCount} Temple Festivals`] : []),
            ].map((s, i) => (
              <span key={i} style={{
                fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.08em',
                color: '#FFD580', background: 'rgba(255,255,255,0.08)',
                padding: '5px 14px', borderRadius: 50, border: '1px solid rgba(200,150,12,.3)',
              }}>{s}</span>
            ))}
          </div>

          {/* Claude loading/error */}
          {claudeLoading && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
              fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,213,128,0.7)',
              background: 'rgba(255,255,255,0.07)', padding: '6px 16px', borderRadius: 50,
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              <span style={{ animation: 'floatDiya 1.5s ease-in-out infinite', display: 'inline-block' }}>✨</span>
              Claude AI se festivals fetch ho rahe hain…
            </div>
          )}
          {claudeError && !claudeLoading && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
              fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,180,120,.85)',
              background: 'rgba(255,255,255,0.07)', padding: '6px 16px', borderRadius: 50,
              border: '1px solid rgba(255,150,50,.2)',
            }}>
              ⚠️ {claudeErrorMsg || 'Claude API se fetch nahi hua.'}{' '}
              <button onClick={fetchFestivalsFromClaude}
                style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', textDecoration:'underline' }}>
                Retry karo
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════ CONTROLS BAR ══════════════ */}
      <div style={{
        background: 'white', borderBottom: '2px solid #EDE0CC', padding: '14px 24px',
        position: 'sticky', top: 70, zIndex: 100, boxShadow: '0 2px 12px rgba(61,31,0,0.06)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#FDF6EC', border: '2px solid #EDE0CC', borderRadius: 50,
            padding: '7px 16px', flex: '0 0 240px', transition: 'all .2s',
          }}>
            <Search size={16} color="#9A7150" />
            <input
              style={{ border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 14, color: '#1A0A00', outline: 'none', width: '100%' }}
              placeholder="Search festivals, deity, temples…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#9A7150', fontSize:16, lineHeight:1, padding:'0 2px' }}>✕</button>
            )}
          </div>

          {/* Deity chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <Filter size={14} color="#9A7150" />
            {DEITY_FILTERS.map(d => (
              <button key={d} onClick={() => setDeityFilter(d)} style={{
                padding: '5px 13px', border: `1.5px solid ${deityFilter === d ? '#E8650A' : '#EDE0CC'}`,
                borderRadius: 50, fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.04em',
                cursor: 'pointer', background: deityFilter === d ? '#E8650A' : 'white',
                color: deityFilter === d ? 'white' : '#5C3D1E', transition: 'all .2s', whiteSpace: 'nowrap',
              }}>{d}</button>
            ))}
            <div style={{ width: 1, height: 20, background: '#EDE0CC', margin: '0 2px' }} />
            {TYPE_FILTERS.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                padding: '5px 13px', border: `1.5px solid ${typeFilter === t ? '#E8650A' : '#EDE0CC'}`,
                borderRadius: 50, fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.04em',
                cursor: 'pointer', background: typeFilter === t ? '#E8650A' : 'white',
                color: typeFilter === t ? 'white' : '#5C3D1E', transition: 'all .2s', whiteSpace: 'nowrap',
              }}>{t}</button>
            ))}
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <button onClick={handleRefresh} disabled={isAnyLoading} style={{
              width: 34, height: 34, borderRadius: '50%', border: '2px solid #EDE0CC',
              background: 'white', cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9A7150', transition: 'all .2s', opacity: isAnyLoading ? 0.5 : 1,
            }}>
              <RefreshCw size={14} style={{ animation: isAnyLoading ? 'spin .8s linear infinite' : 'none' }} />
            </button>
            <div style={{
              display: 'flex', background: '#FDF6EC', border: '2px solid #EDE0CC',
              borderRadius: 50, overflow: 'hidden',
            }}>
              {[
                { mode: 'calendar', icon: <Calendar size={14} />, label: 'Calendar' },
                { mode: 'list',     icon: <Star size={14} />,     label: 'All' },
              ].map(v => (
                <button key={v.mode} onClick={() => setViewMode(v.mode)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                  border: 'none', background: viewMode === v.mode ? '#E8650A' : 'transparent',
                  fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.04em',
                  color: viewMode === v.mode ? 'white' : '#9A7150', cursor: 'pointer',
                  borderRadius: 50, transition: 'all .2s',
                }}>{v.icon} {v.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ BODY ══════════════ */}
      <section style={{ background: '#f8f4ef', paddingBottom: 80, paddingTop: 56 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

          {isAnyLoading && allFestivals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 48, animation: 'floatDiya 2s ease-in-out infinite' }}>🪔</div>
              <p style={{ fontFamily: 'var(--font-hindi)', color: '#9A7150', fontSize: 16 }}>Claude AI se festivals load ho rahe hain…</p>
            </div>
          ) : viewMode === 'calendar' ? (
            <>
              {/* ══ PREMIUM MONTH NAVIGATOR ══ */}
              <div style={{
                background: 'white', borderRadius: 24, boxShadow: '0 4px 24px rgba(61,31,0,0.09)',
                border: '1px solid rgba(232,101,10,0.12)', padding: '20px 24px', marginBottom: 28,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => goMonth(-1)} style={{
                    width: 38, height: 38, borderRadius: '50%', border: '2px solid #EDE0CC',
                    background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#7a3208', flexShrink: 0, transition: 'all .2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#E8650A'; e.currentTarget.style.color='#E8650A'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#EDE0CC'; e.currentTarget.style.color='#7a3208'; }}
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }} className="scrollbar-hide">
                    {GREGORIAN_MONTHS.map((m, i) => {
                      const mNum  = i + 1;
                      const count = (byMonth[mNum] || []).length;
                      const hasAPI = (byMonth[mNum] || []).some(f => f.temple_id);
                      const isActive = selectedMonth === mNum;
                      return (
                        <button key={m} onClick={() => setSelectedMonth(mNum)} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: '10px 14px', borderRadius: 14, flexShrink: 0,
                          border: `2px solid ${isActive ? '#E8650A' : '#EDE0CC'}`,
                          background: isActive ? 'linear-gradient(135deg, #E8650A, #FF8C2A)' : 'white',
                          cursor: 'pointer', transition: 'all .22s', gap: 3,
                          boxShadow: isActive ? '0 6px 20px rgba(232,101,10,0.28)' : '0 2px 6px rgba(61,31,0,0.04)',
                        }}>
                          <span style={{
                            fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.04em',
                            fontWeight: 700, color: isActive ? 'white' : '#5C3D1E',
                          }}>{MONTH_SHORT[i]}</span>
                          {count > 0 && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: 'center',
                              background: isActive ? 'rgba(255,255,255,0.25)' : hasAPI ? 'rgba(16,163,74,0.15)' : 'rgba(232,101,10,0.12)',
                              color: isActive ? 'white' : hasAPI ? '#16a34a' : '#E8650A',
                              borderRadius: 50, padding: '1px 6px',
                            }}>{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={() => goMonth(1)} style={{
                    width: 38, height: 38, borderRadius: '50%', border: '2px solid #EDE0CC',
                    background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#7a3208', flexShrink: 0, transition: 'all .2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#E8650A'; e.currentTarget.style.color='#E8650A'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#EDE0CC'; e.currentTarget.style.color='#7a3208'; }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* ══ MONTH HEADER ══ */}
              <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                marginBottom: 24, paddingBottom: 16,
                borderBottom: '2px solid #EDE0CC', flexWrap: 'wrap', gap: 10,
              }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: '#7a3208' }}>
                    {GREGORIAN_MONTHS[selectedMonth - 1]} {currentYear}
                  </h2>
                  <p style={{ fontFamily: 'var(--font-hindi)', fontSize: 14, color: '#9A7150', marginTop: 2 }}>
                    {HINDU_MONTHS[(selectedMonth + 1) % 12]} / {HINDU_MONTHS[selectedMonth % 12]}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {currentMonthFestivals.some(f => f.temple_id) && (
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.04em', color: '#16a34a', background: 'rgba(16,163,74,0.08)', padding: '4px 12px', borderRadius: 50, border: '1px solid rgba(16,163,74,.2)' }}>
                      🛕 Temple Festivals
                    </span>
                  )}
                  {currentMonthFestivals.some(f => f._claude) && (
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.04em', color: '#7C3AED', background: 'rgba(124,58,237,0.08)', padding: '4px 12px', borderRadius: 50, border: '1px solid rgba(124,58,237,.2)' }}>
                      ✨ AI Curated
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.06em', color: '#E8650A', background: 'rgba(232,101,10,0.08)', padding: '4px 14px', borderRadius: 50, border: '1px solid rgba(232,101,10,.2)' }}>
                    {currentMonthFestivals.length} festival{currentMonthFestivals.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Partial load notice */}
              {claudeLoading && allFestivals.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--font-display)', fontSize: 12, color: '#9A7150',
                  background: 'rgba(232,101,10,0.06)', border: '1px solid rgba(232,101,10,0.15)',
                  borderRadius: 50, padding: '6px 16px', marginBottom: 20, width: 'fit-content',
                }}>
                  <span style={{ animation: 'floatDiya 1.5s ease-in-out infinite', display: 'inline-block' }}>✨</span>
                  More festivals load ho rahe hain Claude AI se…
                </div>
              )}

              {currentMonthFestivals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '72px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 52 }}>🙏</span>
                  <p style={{ color: '#9A7150', fontFamily: 'var(--font-body)', fontSize: 16 }}>
                    No festivals found for {GREGORIAN_MONTHS[selectedMonth - 1]} with current filters.
                  </p>
                  <button
                    onClick={() => { setDeityFilter('All'); setTypeFilter('All'); setSearchQuery(''); }}
                    style={{ padding: '8px 20px', border: '2px solid #EDE0CC', borderRadius: 50, background: 'white', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.05em', cursor: 'pointer', color: '#5C3D1E' }}
                  >Clear Filters</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {currentMonthFestivals.map((f, i) => (
                    <FestivalCard key={`${f.id || f.name}-${i}`} festival={f} onClick={() => setSelectedFestival(f)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* ══ ALL FESTIVALS LIST VIEW ══ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
              {GREGORIAN_MONTHS.map((mName, mi) => {
                const mNum  = mi + 1;
                const fests = byMonth[mNum] || [];
                if (fests.length === 0) return null;
                return (
                  <div key={mName}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#7a3208' }}>{mName}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'white', background: '#E8650A', padding: '2px 9px', borderRadius: 50 }}>{fests.length}</span>
                      <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: '#9A7150', marginLeft: 4 }}>{HINDU_MONTHS[(mNum + 1) % 12]}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                      {fests.map((f, i) => (
                        <FestivalCard key={`${f.id || f.name}-${i}`} festival={f} compact onClick={() => setSelectedFestival(f)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedFestival && (
        <FestivalModal festival={selectedFestival} onClose={() => setSelectedFestival(null)} />
      )}

      <Footer />

      <style>{`
        @keyframes floatDiya {
          0%,100%{ transform:translateY(0) rotate(-5deg); opacity:.18; }
          50%{ transform:translateY(-18px) rotate(5deg); opacity:.32; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes slideUp { from{transform:translateY(24px);opacity:0;}to{transform:translateY(0);opacity:1;} }
        @keyframes fadeIn { from{opacity:0;}to{opacity:1;} }
        .scrollbar-hide::-webkit-scrollbar { display:none; }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
        .fest-card { background:white; border-radius:20px; border:1.5px solid #EDE0CC; overflow:hidden; transition:all .22s; cursor:pointer; position:relative; }
        .fest-card:hover { transform:translateY(-4px); box-shadow:0 12px 32px rgba(61,31,0,0.13); border-color:transparent; }
        @media(max-width:640px){
          .fest-modal-meta { grid-template-columns:1fr !important; }
        }
      `}</style>
    </>
  );
}

// ── FestivalCard ───────────────────────────────────────────────────────────────
function FestivalCard({ festival, compact, onClick }) {
  const emoji = festival.emoji || '🛕';
  const color = festival.color || '#E8650A';
  const pad   = compact ? '14px 16px' : '20px 20px 14px';
  const emojiSz = compact ? { width: 42, height: 42, fontSize: 22 } : { width: 54, height: 54, fontSize: 28 };

  return (
    <div className="fest-card" onClick={onClick}>
      <div style={{ padding: pad, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          ...emojiSz, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 14, background: `${color}14`, flexShrink: 0,
        }}>{emoji}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: compact ? 13 : 15, fontWeight: 700,
            color: '#3D1F00', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }} title={festival.name}>{festival.name}</div>

          {festival.display_date && (
            <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 2 }}>📅 {festival.display_date}</div>
          )}
          {festival.hindu_tithi && (
            <div style={{ fontFamily: 'var(--font-hindi)', fontSize: compact ? 11 : 12, color: '#9A7150', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {festival.hindu_tithi}
            </div>
          )}
          {!festival.hindu_tithi && festival.significance && (
            <div style={{ fontFamily: 'var(--font-hindi)', fontSize: compact ? 11 : 12, color: '#9A7150', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {festival.significance}
            </div>
          )}

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {festival.is_major && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, fontFamily: 'var(--font-display)', letterSpacing: '.04em', border: '1px solid rgba(232,101,10,.25)', color: '#B84D00', background: 'rgba(232,101,10,.08)' }}>⭐ Major</span>
            )}
            {festival.duration_days > 1 && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, fontFamily: 'var(--font-display)', letterSpacing: '.04em', border: '1px solid #EDE0CC', color: '#5C3D1E', background: '#FDF6EC' }}>{festival.duration_days} days</span>
            )}
            {festival.deity && festival.deity !== 'Other' && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, fontFamily: 'var(--font-display)', letterSpacing: '.04em', border: '1px solid rgba(29,78,216,.2)', color: '#1D4ED8', background: 'rgba(29,78,216,.06)' }}>{festival.deity}</span>
            )}
            {festival.temple_id && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, fontFamily: 'var(--font-display)', letterSpacing: '.04em', border: '1px solid rgba(16,163,74,.25)', color: '#16a34a', background: 'rgba(16,163,74,.06)' }}>🛕 Temple</span>
            )}
            {festival._claude && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, fontFamily: 'var(--font-display)', letterSpacing: '.04em', border: '1px solid rgba(124,58,237,.25)', color: '#7C3AED', background: 'rgba(124,58,237,.06)' }}>✨ AI</span>
            )}
          </div>

          {festival.temple_name && (
            <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 11, color: '#16a34a', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              📍 {festival.temple_name}{festival.temple_city ? `, ${festival.temple_city}` : ''}
            </div>
          )}
        </div>
      </div>
      <div style={{ height: compact ? 3 : 4, background: `linear-gradient(90deg,${color},${color}55)` }} />
    </div>
  );
}

// ── FestivalModal ──────────────────────────────────────────────────────────────
function FestivalModal({ festival, onClose }) {
  const monthName  = GREGORIAN_MONTHS[(festival.month || 1) - 1] || '';
  const hinduMonth = festival.hindu_month || HINDU_MONTHS[((festival.month || 1) - 1) % 12] || '';
  const emoji = festival.emoji || '🛕';
  const color = festival.color || '#E8650A';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(26,10,0,.65)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24, animation: 'fadeIn .2s ease',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#FDF6EC', borderRadius: 28, maxWidth: 560, width: '100%',
        overflow: 'hidden', animation: 'slideUp .25s ease',
        boxShadow: '0 32px 80px rgba(26,10,0,.4)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '28px 28px 20px', display: 'flex', alignItems: 'flex-start', gap: 16, background: `${color}12` }}>
          <div style={{
            fontSize: 40, width: 70, height: 70, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 18, background: 'white',
            border: `2px solid ${color}30`, boxShadow: '0 4px 16px rgba(61,31,0,0.1)', flexShrink: 0,
          }}>{emoji}</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#3D1F00', marginBottom: 4 }}>{festival.name}</div>
            {festival.display_date && <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color, fontWeight: 600, marginBottom: 4 }}>📅 {festival.display_date}</div>}
            {festival.hindu_tithi && <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color }}>{festival.hindu_tithi}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {festival.is_major && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, border: '1px solid rgba(232,101,10,.25)', color: '#B84D00', background: 'rgba(232,101,10,.08)', fontFamily: 'var(--font-display)' }}>⭐ Major</span>}
              {festival.temple_id && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, border: '1px solid rgba(16,163,74,.25)', color: '#16a34a', background: 'rgba(16,163,74,.06)', fontFamily: 'var(--font-display)' }}>🛕 Temple Festival</span>}
              {festival._claude && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, border: '1px solid rgba(124,58,237,.25)', color: '#7C3AED', background: 'rgba(124,58,237,.06)', fontFamily: 'var(--font-display)' }}>✨ AI Curated</span>}
              {festival.deity && festival.deity !== 'Other' && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 50, border: '1px solid rgba(29,78,216,.2)', color: '#1D4ED8', background: 'rgba(29,78,216,.06)', fontFamily: 'var(--font-display)' }}>{festival.deity}</span>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ height: 1, background: '#EDE0CC', margin: '0 0 20px' }} />

          {festival.temple_name && (
            <div style={{ background: 'rgba(16,163,74,0.06)', border: '1px solid rgba(16,163,74,.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.08em', color: '#16a34a', marginBottom: 4 }}>🛕 CELEBRATED AT</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: '#3D1F00' }}>{festival.temple_name}</div>
              {festival.temple_city && <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 12, color: '#16a34a' }}>📍 {festival.temple_city}</div>}
            </div>
          )}

          {festival.significance && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.7, color: '#5C3D1E', marginBottom: 16 }}>
              <strong>Significance:</strong> {festival.significance}
            </p>
          )}
          {festival.description && festival.description !== festival.significance && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.7, color: '#5C3D1E', marginBottom: 20 }}>{festival.description}</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }} className="fest-modal-meta">
            {festival.display_date && (
              <div style={{ background: 'white', border: '1px solid #EDE0CC', borderRadius: 14, padding: '12px 14px', gridColumn: '1 / -1' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.08em', color: '#9A7150', marginBottom: 4 }}>DATE</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color }}>{festival.display_date}</div>
              </div>
            )}
            {[
              { label: 'GREGORIAN MONTH', value: monthName },
              { label: 'HINDU MONTH', value: hinduMonth, hindi: true },
              ...(festival.hindu_tithi ? [{ label: 'TITHI', value: festival.hindu_tithi, small: true }] : []),
              { label: 'DURATION', value: `${festival.duration_days || 1} ${(festival.duration_days || 1) === 1 ? 'Day' : 'Days'}` },
              { label: 'SOURCE', value: festival._claude ? '✨ Claude AI' : festival.source || '🛕 Temple Record', small: true },
            ].map((item, idx) => (
              <div key={idx} style={{ background: 'white', border: '1px solid #EDE0CC', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.08em', color: '#9A7150', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontFamily: item.hindi ? 'var(--font-hindi)' : 'var(--font-body)', fontSize: item.small ? 13 : 15, fontWeight: 600, color: '#1A0A00' }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '11px', border: '2px solid #EDE0CC', borderRadius: 50,
              background: 'white', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.05em',
              color: '#5C3D1E', cursor: 'pointer',
            }}>Close</button>
            {festival.temple_slug ? (
              <Link to={`/temple/${festival.temple_slug}`} onClick={onClose} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 20px', background: 'linear-gradient(135deg, #E8650A, #B84D00)',
                color: 'white', border: 'none', borderRadius: 50,
                fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.05em',
                textDecoration: 'none',
              }}>
                <MapPin size={14} /> Visit Temple
              </Link>
            ) : (
              <Link to={`/search?q=${encodeURIComponent(festival.name)}`} onClick={onClose} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '11px 20px', background: 'linear-gradient(135deg, #E8650A, #B84D00)',
                color: 'white', border: 'none', borderRadius: 50,
                fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.05em',
                textDecoration: 'none',
              }}>
                <MapPin size={14} /> Find Temples
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}