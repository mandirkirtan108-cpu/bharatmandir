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

// Emoji / color mapping by keyword (for API festivals that don't have these columns)
const DEITY_EMOJI_MAP = {
  shiva: { emoji: '🔱', color: '#5B4FDB' },
  vishnu: { emoji: '🪔', color: '#1D4ED8' },
  krishna: { emoji: '🪈', color: '#1D4ED8' },
  rama: { emoji: '🏹', color: '#2E8B57' },
  hanuman: { emoji: '🐒', color: '#E8650A' },
  ganesha: { emoji: '🐘', color: '#D97706' },
  durga: { emoji: '🪆', color: '#BE185D' },
  lakshmi: { emoji: '✨', color: '#C8960C' },
  saraswati: { emoji: '🌸', color: '#C8960C' },
  surya: { emoji: '🪁', color: '#E8650A' },
  kali: { emoji: '🌺', color: '#7C3AED' },
  jagannath: { emoji: '🛕', color: '#E85C2A' },
  murugan: { emoji: '🌟', color: '#DC2626' },
};

const FESTIVAL_NAME_MAP = {
  'makar sankranti': { emoji: '🪁', color: '#E8650A' },
  'vasant panchami': { emoji: '🌸', color: '#C8960C' },
  'maha shivaratri': { emoji: '🔱', color: '#5B4FDB' },
  'holi': { emoji: '🎨', color: '#E85CA0' },
  'ugadi': { emoji: '🪔', color: '#E8650A' },
  'gudi padwa': { emoji: '🪔', color: '#E8650A' },
  'ram navami': { emoji: '🏹', color: '#2E8B57' },
  'hanuman jayanti': { emoji: '🐒', color: '#E8650A' },
  'akshaya tritiya': { emoji: '✨', color: '#C8960C' },
  'rath yatra': { emoji: '🛕', color: '#E85C2A' },
  'guru purnima': { emoji: '📿', color: '#8B5CF6' },
  'naga panchami': { emoji: '🐍', color: '#065F46' },
  'raksha bandhan': { emoji: '🪢', color: '#E85CA0' },
  'janmashtami': { emoji: '🪈', color: '#1D4ED8' },
  'ganesh chaturthi': { emoji: '🐘', color: '#D97706' },
  'navratri': { emoji: '🪆', color: '#BE185D' },
  'dussehra': { emoji: '🏹', color: '#DC2626' },
  'vijayadashami': { emoji: '🏹', color: '#DC2626' },
  'diwali': { emoji: '🪔', color: '#F59E0B' },
  'govardhan puja': { emoji: '⛰️', color: '#1D4ED8' },
  'bhai dooj': { emoji: '🌺', color: '#E85CA0' },
  'kartik purnima': { emoji: '🌕', color: '#0EA5E9' },
  'gita jayanti': { emoji: '📖', color: '#1D4ED8' },
  'vivah panchami': { emoji: '💐', color: '#EC4899' },
  'pongal': { emoji: '🌾', color: '#E8650A' },
  'onam': { emoji: '🌺', color: '#16a34a' },
  'bihu': { emoji: '🌾', color: '#D97706' },
};

function getEmojiColor(festival) {
  const nameLower = (festival.name || '').toLowerCase();
  // Check name map first
  for (const [key, val] of Object.entries(FESTIVAL_NAME_MAP)) {
    if (nameLower.includes(key)) return val;
  }
  // Check significance / description for deity keywords
  const text = `${festival.significance || ''} ${festival.description || ''}`.toLowerCase();
  for (const [deity, val] of Object.entries(DEITY_EMOJI_MAP)) {
    if (text.includes(deity) || nameLower.includes(deity)) return val;
  }
  return { emoji: '🛕', color: '#E8650A' };
}

// ── Curated SEED festivals (national-level, no temple_id) ─────────────────────
// These fill the calendar before API data loads, and show universal Hindu festivals
const SEED_FESTIVALS = [
  { _seed: true, name:'Makar Sankranti', month:1, significance:'Sun enters Capricorn — harvest festival, kite flying', hindu_month:'Pausha', is_major:true, duration_days:1 },
  { _seed: true, name:'Vasant Panchami', month:2, significance:'Onset of spring, worship of Saraswati Devi', hindu_month:'Magha', is_major:true, duration_days:1 },
  { _seed: true, name:'Maha Shivaratri', month:2, significance:'Night of Lord Shiva, fasting and all-night vigil', hindu_month:'Phalguna', is_major:true, duration_days:1 },
  { _seed: true, name:'Holi', month:3, significance:'Festival of colours, triumph of devotee Prahlada', hindu_month:'Phalguna', is_major:true, duration_days:2 },
  { _seed: true, name:'Ugadi / Gudi Padwa', month:3, significance:'Hindu New Year — Telugu and Marathi traditions', hindu_month:'Chaitra', is_major:true, duration_days:1 },
  { _seed: true, name:'Ram Navami', month:4, significance:'Celebration of the birth of Lord Rama', hindu_month:'Chaitra', is_major:true, duration_days:1 },
  { _seed: true, name:'Hanuman Jayanti', month:4, significance:'Birth anniversary of Lord Hanuman', hindu_month:'Chaitra', is_major:true, duration_days:1 },
  { _seed: true, name:'Akshaya Tritiya', month:5, significance:'Most auspicious day for new beginnings and wealth', hindu_month:'Vaishakha', is_major:true, duration_days:1 },
  { _seed: true, name:'Rath Yatra', month:7, significance:'Grand chariot festival of Lord Jagannath in Puri', hindu_month:'Ashadha', is_major:true, duration_days:9 },
  { _seed: true, name:'Guru Purnima', month:7, significance:'Day of reverence to spiritual and academic teachers', hindu_month:'Ashadha', is_major:false, duration_days:1 },
  { _seed: true, name:'Naga Panchami', month:8, significance:'Worship of serpent deities across India', hindu_month:'Shravana', is_major:false, duration_days:1 },
  { _seed: true, name:'Raksha Bandhan', month:8, significance:'Sacred bond of love between brother and sister', hindu_month:'Shravana', is_major:true, duration_days:1 },
  { _seed: true, name:'Janmashtami', month:8, significance:'Birth of Lord Krishna, midnight celebrations', hindu_month:'Bhadrapada', is_major:true, duration_days:2 },
  { _seed: true, name:'Ganesh Chaturthi', month:9, significance:'Birth of Lord Ganesha, 10-day celebration', hindu_month:'Bhadrapada', is_major:true, duration_days:10 },
  { _seed: true, name:'Navratri (Sharad)', month:10, significance:'Nine nights of Devi worship, Garba and Dandiya', hindu_month:'Ashwin', is_major:true, duration_days:9 },
  { _seed: true, name:'Dussehra / Vijayadashami', month:10, significance:'Victory of Rama over Ravana, triumph of good over evil', hindu_month:'Ashwin', is_major:true, duration_days:1 },
  { _seed: true, name:'Diwali', month:11, significance:'Festival of lights, Lakshmi Puja, return of Lord Rama', hindu_month:'Kartika', is_major:true, duration_days:5 },
  { _seed: true, name:'Govardhan Puja', month:11, significance:'Celebration of Krishna lifting Govardhan Hill', hindu_month:'Kartika', is_major:false, duration_days:1 },
  { _seed: true, name:'Bhai Dooj', month:11, significance:'Celebration of sibling love on the day after Diwali', hindu_month:'Kartika', is_major:false, duration_days:1 },
  { _seed: true, name:'Kartik Purnima', month:11, significance:'Holy bath in sacred rivers — Tripuri Purnima', hindu_month:'Kartika', is_major:true, duration_days:1 },
  { _seed: true, name:'Vivah Panchami', month:12, significance:'Divine marriage ceremony of Rama and Sita', hindu_month:'Margashirsha', is_major:false, duration_days:1 },
  { _seed: true, name:'Gita Jayanti', month:12, significance:'Day the Bhagavad Gita was revealed by Lord Krishna', hindu_month:'Margashirsha', is_major:true, duration_days:1 },
];

const DEITY_FILTERS = ['All','Shiva','Vishnu','Ganesha','Durga','Lakshmi','Krishna','Rama','Saraswati'];
const TYPE_FILTERS  = ['All','Major','With Temple'];

// ── Unique key for dedup ───────────────────────────────────────────────────────
function festKey(f) {
  return `${(f.name || '').toLowerCase().trim()}::${f.month}`;
}

export default function FestivalCalendarPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode]           = useState('calendar');
  const [deityFilter, setDeityFilter]     = useState('All');
  const [typeFilter, setTypeFilter]       = useState('All');
  const [searchQuery, setSearchQuery]     = useState('');
  const [apiFestivals, setApiFestivals]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedFestival, setSelectedFestival] = useState(null);
  const [lastFetch, setLastFetch]         = useState(Date.now());

  const currentYear = new Date().getFullYear();

  // ── Fetch from API ──────────────────────────────────────────────────────────
  const fetchFestivals = useCallback(() => {
    setLoading(true);
    axios.get(`${API_BASE}/api/festivals?limit=500`)
      .then(r => setApiFestivals(Array.isArray(r.data) ? r.data : []))
      .catch(() => setApiFestivals([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchFestivals(); }, [fetchFestivals]);

  // Listen for custom event dispatched by AdminAddFestivalPage after successful submit
  useEffect(() => {
    const handler = () => { fetchFestivals(); setLastFetch(Date.now()); };
    window.addEventListener('festival:added', handler);
    return () => window.removeEventListener('festival:added', handler);
  }, [fetchFestivals]);

  // ── Merge seed + API (dedup by name+month) ──────────────────────────────────
  const allFestivals = useMemo(() => {
    const apiKeys = new Set(apiFestivals.map(festKey));
    const seeds = SEED_FESTIVALS.filter(f => !apiKeys.has(festKey(f)));
    const enrichedAPI = apiFestivals.map(f => {
      const { emoji, color } = getEmojiColor(f);
      return { ...f, emoji: f.emoji || emoji, color: f.color || color };
    });
    const enrichedSeeds = seeds.map(f => {
      const { emoji, color } = getEmojiColor(f);
      return { ...f, emoji, color };
    });
    return [...enrichedSeeds, ...enrichedAPI];
  }, [apiFestivals]);

  // ── Apply filters ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allFestivals.filter(f => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inName = (f.name || '').toLowerCase().includes(q);
        const inSig  = (f.significance || '').toLowerCase().includes(q);
        const inDesc = (f.description || '').toLowerCase().includes(q);
        const inTemple = (f.temple_name || '').toLowerCase().includes(q);
        if (!inName && !inSig && !inDesc && !inTemple) return false;
      }
      if (deityFilter !== 'All') {
        const text = `${f.name} ${f.significance || ''} ${f.description || ''}`.toLowerCase();
        if (!text.includes(deityFilter.toLowerCase())) return false;
      }
      if (typeFilter === 'Major' && !f.is_major) return false;
      if (typeFilter === 'With Temple' && !f.temple_id) return false;
      return true;
    });
  }, [allFestivals, searchQuery, deityFilter, typeFilter]);

  // ── Group by month ──────────────────────────────────────────────────────────
  const byMonth = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    filtered.forEach(f => {
      const m = Number(f.month);
      if (m >= 1 && m <= 12) map[m].push(f);
    });
    // Sort: major first, then by name
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => (b.is_major ? 1 : 0) - (a.is_major ? 1 : 0) || (a.name || '').localeCompare(b.name || ''))
    );
    return map;
  }, [filtered]);

  const currentMonthFestivals = byMonth[selectedMonth] || [];
  const totalCount = filtered.length;
  const apiCount = apiFestivals.length;

  const goMonth = (dir) => setSelectedMonth(m => {
    let next = m + dir;
    if (next < 1) next = 12;
    if (next > 12) next = 1;
    return next;
  });

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section className="fest-hero">
        <div className="fest-hero-bg">
          {['🪔','✨','🌸','🔱','🪁'].map((e, i) => (
            <div key={i} className={`fest-diya fest-diya-${i + 1}`}>{e}</div>
          ))}
        </div>
        <div className="container fest-hero-inner">
          <p className="fest-hero-super">🛕 BharatMandir Presents</p>
          <h1 className="fest-hero-title">Festival Calendar</h1>
          <p className="fest-hero-sub">पर्व और उत्सव — Celebrating the Sacred Rhythm of Bharat</p>
          <div className="fest-hero-stats">
            <span className="fest-stat">{totalCount} Festivals</span>
            <span className="fest-stat-dot">·</span>
            <span className="fest-stat">12 Months</span>
            <span className="fest-stat-dot">·</span>
            <span className="fest-stat">{currentYear}</span>
            {apiCount > 0 && (
              <>
                <span className="fest-stat-dot">·</span>
                <span className="fest-stat" style={{ color: '#86efac' }}>{apiCount} Temple Festivals</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Controls ── */}
      <div className="fest-controls-bar">
        <div className="container fest-controls-inner">
          <div className="fest-search-wrap">
            <Search size={16} />
            <input
              className="fest-search"
              placeholder="Search festivals, temples…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-light)',fontSize:16,lineHeight:1,padding:'0 2px' }}>✕</button>
            )}
          </div>

          <div className="fest-filter-group">
            <Filter size={14} />
            {DEITY_FILTERS.map(d => (
              <button key={d} className={`fest-chip ${deityFilter === d ? 'active' : ''}`} onClick={() => setDeityFilter(d)}>{d}</button>
            ))}
            <div className="fest-chip-divider" />
            {TYPE_FILTERS.map(t => (
              <button key={t} className={`fest-chip ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>{t}</button>
            ))}
          </div>

          <div className="fest-controls-right">
            <button
              className="fest-refresh-btn"
              onClick={fetchFestivals}
              title="Refresh festivals"
            >
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            </button>
            <div className="fest-view-toggle">
              <button className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>
                <Calendar size={15} /> Calendar
              </button>
              <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
                <Star size={15} /> All
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container fest-body">

        {loading && apiFestivals.length === 0 ? (
          <div className="fest-loading">
            <div className="fest-loading-spinner">🪔</div>
            <p>Loading sacred festivals…</p>
          </div>
        ) : viewMode === 'calendar' ? (
          <>
            {/* ── Month strip ── */}
            <div className="month-strip">
              <button className="month-nav-btn" onClick={() => goMonth(-1)}><ChevronLeft size={18} /></button>
              <div className="month-pills">
                {GREGORIAN_MONTHS.map((m, i) => {
                  const mNum = i + 1;
                  const count = (byMonth[mNum] || []).length;
                  const hasAPI = (byMonth[mNum] || []).some(f => f.temple_id);
                  return (
                    <button
                      key={m}
                      className={`month-pill ${selectedMonth === mNum ? 'active' : ''}`}
                      onClick={() => setSelectedMonth(mNum)}
                    >
                      <span className="month-pill-name">{MONTH_SHORT[i]}</span>
                      {count > 0 && (
                        <span className={`month-pill-count ${hasAPI ? 'has-api' : ''}`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button className="month-nav-btn" onClick={() => goMonth(1)}><ChevronRight size={18} /></button>
            </div>

            {/* ── Month header ── */}
            <div className="month-heading">
              <div>
                <h2 className="month-heading-name">{GREGORIAN_MONTHS[selectedMonth - 1]} {currentYear}</h2>
                <p className="month-heading-hindi">
                  {HINDU_MONTHS[(selectedMonth + 1) % 12]} / {HINDU_MONTHS[selectedMonth % 12]}
                </p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {currentMonthFestivals.some(f => f.temple_id) && (
                  <span className="month-api-badge">🛕 Includes Temple Festivals</span>
                )}
                <span className="month-fest-count">
                  {currentMonthFestivals.length} festival{currentMonthFestivals.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {currentMonthFestivals.length === 0 ? (
              <div className="fest-empty">
                <span className="fest-empty-icon">🙏</span>
                <p>No festivals found for {GREGORIAN_MONTHS[selectedMonth - 1]} with current filters.</p>
                <button className="btn-outline" onClick={() => { setDeityFilter('All'); setTypeFilter('All'); setSearchQuery(''); }}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="fest-grid">
                {currentMonthFestivals.map((f, i) => (
                  <FestivalCard key={`${f.id || f.name}-${i}`} festival={f} onClick={() => setSelectedFestival(f)} />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── All festivals list view ── */
          <div className="fest-list-view">
            {GREGORIAN_MONTHS.map((mName, mi) => {
              const mNum = mi + 1;
              const fests = byMonth[mNum] || [];
              if (fests.length === 0) return null;
              return (
                <div key={mName} className="fest-list-section">
                  <div className="fest-list-month-header">
                    <span className="fest-list-month-name">{mName}</span>
                    <span className="fest-list-month-count">{fests.length}</span>
                    <span className="fest-list-hindu-month" style={{ fontFamily:'var(--font-hindi)', fontSize:13, color:'var(--text-light)', marginLeft:8 }}>
                      {HINDU_MONTHS[(mNum + 1) % 12]}
                    </span>
                  </div>
                  <div className="fest-list-grid">
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

      {selectedFestival && (
        <FestivalModal festival={selectedFestival} onClose={() => setSelectedFestival(null)} />
      )}

      <Footer />

      <style>{`
        /* ── Hero ── */
        .fest-hero {
          position:relative;
          background:linear-gradient(135deg,#1A0A00 0%,#3D1F00 40%,#6B3A10 70%,#B84D00 100%);
          padding:72px 0 60px; overflow:hidden; text-align:center;
        }
        .fest-hero-bg { position:absolute; inset:0; pointer-events:none; }
        .fest-diya { position:absolute; animation:floatDiya 6s ease-in-out infinite; opacity:.18; font-size:clamp(24px,4vw,48px); }
        .fest-diya-1{top:15%;left:7%;animation-delay:0s;}
        .fest-diya-2{top:60%;left:15%;animation-delay:1.2s;}
        .fest-diya-3{top:20%;right:10%;animation-delay:.6s;}
        .fest-diya-4{bottom:20%;right:6%;animation-delay:2s;}
        .fest-diya-5{top:45%;left:3%;animation-delay:1.8s;}
        @keyframes floatDiya {
          0%,100%{transform:translateY(0) rotate(-5deg);opacity:.18;}
          50%{transform:translateY(-18px) rotate(5deg);opacity:.32;}
        }
        .fest-hero-inner{position:relative;z-index:1;}
        .fest-hero-super{font-family:var(--font-hindi);font-size:13px;letter-spacing:.18em;color:var(--gold-light);margin-bottom:16px;opacity:.85;}
        .fest-hero-title{font-family:var(--font-display);font-size:clamp(36px,6vw,68px);font-weight:900;color:white;line-height:1.05;margin-bottom:14px;text-shadow:0 4px 24px rgba(0,0,0,.4);}
        .fest-hero-sub{font-family:var(--font-hindi);font-size:16px;color:rgba(255,255,255,.7);margin-bottom:28px;}
        .fest-hero-stats{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;}
        .fest-stat{font-family:var(--font-display);font-size:13px;letter-spacing:.08em;color:var(--gold-light);background:rgba(255,255,255,.08);padding:5px 14px;border-radius:50px;border:1px solid rgba(200,150,12,.3);}
        .fest-stat-dot{color:rgba(255,255,255,.3);}

        /* ── Controls ── */
        .fest-controls-bar{background:white;border-bottom:2px solid var(--cream-dark);padding:14px 0;position:sticky;top:70px;z-index:100;box-shadow:0 2px 12px var(--shadow);}
        .fest-controls-inner{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
        .fest-controls-right{display:flex;align-items:center;gap:8px;margin-left:auto;}
        .fest-search-wrap{display:flex;align-items:center;gap:8px;background:var(--cream);border:2px solid var(--cream-dark);border-radius:50px;padding:7px 16px;flex:0 0 230px;transition:var(--transition);}
        .fest-search-wrap:focus-within{border-color:var(--saffron);background:white;}
        .fest-search-wrap svg{color:var(--text-light);flex-shrink:0;}
        .fest-search{border:none;background:transparent;font-family:var(--font-body);font-size:14px;color:var(--text-dark);outline:none;width:100%;}
        .fest-filter-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;}
        .fest-filter-group svg{color:var(--text-light);flex-shrink:0;}
        .fest-chip-divider{width:1px;height:20px;background:var(--cream-dark);margin:0 2px;flex-shrink:0;}
        .fest-chip{padding:5px 13px;border:1.5px solid var(--cream-dark);border-radius:50px;font-family:var(--font-display);font-size:11px;letter-spacing:.04em;cursor:pointer;background:white;color:var(--text-mid);transition:var(--transition);white-space:nowrap;}
        .fest-chip:hover{border-color:var(--saffron-light);color:var(--saffron);}
        .fest-chip.active{background:var(--saffron);color:white;border-color:var(--saffron);}
        .fest-refresh-btn{width:34px;height:34px;border-radius:50%;border:2px solid var(--cream-dark);background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-light);transition:var(--transition);}
        .fest-refresh-btn:hover{border-color:var(--saffron);color:var(--saffron);}
        .fest-refresh-btn .spinning{animation:spin .8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .fest-view-toggle{display:flex;background:var(--cream);border:2px solid var(--cream-dark);border-radius:50px;overflow:hidden;}
        .fest-view-toggle button{display:flex;align-items:center;gap:5px;padding:6px 14px;border:none;background:transparent;font-family:var(--font-display);font-size:12px;letter-spacing:.04em;color:var(--text-light);cursor:pointer;transition:var(--transition);}
        .fest-view-toggle button.active{background:var(--saffron);color:white;border-radius:50px;}

        /* ── Body ── */
        .fest-body{padding:32px 0 64px;}

        /* ── Loading ── */
        .fest-loading{text-align:center;padding:80px 24px;display:flex;flex-direction:column;align-items:center;gap:16px;}
        .fest-loading-spinner{font-size:48px;animation:floatDiya 2s ease-in-out infinite;}
        .fest-loading p{font-family:var(--font-hindi);color:var(--text-light);font-size:16px;}

        /* ── Month strip ── */
        .month-strip{display:flex;align-items:center;gap:8px;margin-bottom:28px;overflow-x:auto;padding-bottom:4px;}
        .month-nav-btn{width:36px;height:36px;border-radius:50%;border:2px solid var(--cream-dark);background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-mid);flex-shrink:0;transition:var(--transition);}
        .month-nav-btn:hover{border-color:var(--saffron);color:var(--saffron);}
        .month-pills{display:flex;gap:6px;overflow-x:auto;flex:1;scrollbar-width:none;}
        .month-pills::-webkit-scrollbar{display:none;}
        .month-pill{display:flex;flex-direction:column;align-items:center;padding:8px 12px;border-radius:12px;border:2px solid var(--cream-dark);background:white;cursor:pointer;flex-shrink:0;transition:var(--transition);gap:2px;}
        .month-pill:hover{border-color:var(--saffron-light);}
        .month-pill.active{background:var(--saffron);border-color:var(--saffron);color:white;}
        .month-pill-name{font-family:var(--font-display);font-size:12px;letter-spacing:.04em;}
        .month-pill-count{font-size:10px;font-weight:700;background:rgba(0,0,0,.12);border-radius:50px;padding:0 6px;min-width:18px;text-align:center;}
        .month-pill.active .month-pill-count{background:rgba(255,255,255,.25);}
        .month-pill-count.has-api{background:rgba(16,163,74,.25);color:#065F46;}
        .month-pill.active .month-pill-count.has-api{background:rgba(255,255,255,.4);color:inherit;}

        /* ── Month heading ── */
        .month-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid var(--cream-dark);flex-wrap:wrap;gap:10px;}
        .month-heading-name{font-family:var(--font-display);font-size:28px;font-weight:700;color:var(--brown);}
        .month-heading-hindi{font-family:var(--font-hindi);font-size:14px;color:var(--text-light);margin-top:2px;}
        .month-fest-count{font-family:var(--font-display);font-size:13px;letter-spacing:.06em;color:var(--saffron);background:rgba(232,101,10,.08);padding:4px 14px;border-radius:50px;border:1px solid rgba(232,101,10,.2);}
        .month-api-badge{font-family:var(--font-display);font-size:11px;letter-spacing:.04em;color:#16a34a;background:rgba(16,163,74,.08);padding:4px 12px;border-radius:50px;border:1px solid rgba(16,163,74,.2);}

        /* ── Festival grid / cards ── */
        .fest-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;}
        .fest-card{background:white;border-radius:var(--radius-lg);border:1.5px solid var(--cream-dark);overflow:hidden;transition:var(--transition);cursor:pointer;position:relative;}
        .fest-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px var(--shadow-deep);border-color:transparent;}
        .fest-card-top{padding:20px 20px 14px;display:flex;align-items:flex-start;gap:14px;}
        .fest-card-emoji{font-size:28px;flex-shrink:0;width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius);background:var(--cream);}
        .fest-card-info{flex:1;min-width:0;}
        .fest-card-name{font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--brown);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fest-card-sub{font-family:var(--font-hindi);font-size:12px;color:var(--text-light);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fest-card-badges{display:flex;gap:5px;flex-wrap:wrap;}
        .fest-badge{font-size:10px;padding:2px 8px;border-radius:50px;font-family:var(--font-display);letter-spacing:.04em;border:1px solid;}
        .fest-badge-major{color:var(--saffron-dark);background:rgba(232,101,10,.08);border-color:rgba(232,101,10,.25);}
        .fest-badge-days{color:var(--brown-mid);background:var(--cream);border-color:var(--cream-dark);}
        .fest-badge-temple{color:#16a34a;background:rgba(16,163,74,.06);border-color:rgba(16,163,74,.25);}
        .fest-card-temple{font-family:var(--font-hindi);font-size:11px;color:#16a34a;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fest-card-accent{height:4px;}
        /* Compact */
        .fest-card-compact .fest-card-top{padding:14px 16px;}
        .fest-card-compact .fest-card-emoji{width:42px;height:42px;font-size:22px;}
        .fest-card-compact .fest-card-name{font-size:13px;}
        .fest-card-compact .fest-card-sub{font-size:11px;}
        .fest-card-compact .fest-card-accent{height:3px;}

        /* ── Empty ── */
        .fest-empty{text-align:center;padding:72px 24px;display:flex;flex-direction:column;align-items:center;gap:14px;}
        .fest-empty-icon{font-size:52px;}
        .fest-empty p{color:var(--text-light);font-family:var(--font-body);font-size:16px;}
        .btn-outline{padding:8px 20px;border:2px solid var(--cream-dark);border-radius:50px;background:white;font-family:var(--font-display);font-size:12px;letter-spacing:.05em;cursor:pointer;color:var(--text-mid);transition:var(--transition);}
        .btn-outline:hover{border-color:var(--saffron);color:var(--saffron);}

        /* ── List view ── */
        .fest-list-view{display:flex;flex-direction:column;gap:36px;}
        .fest-list-month-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
        .fest-list-month-name{font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--brown);}
        .fest-list-month-count{font-family:var(--font-display);font-size:11px;color:white;background:var(--saffron);padding:2px 9px;border-radius:50px;}
        .fest-list-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}

        /* ── Modal ── */
        .fest-modal-overlay{position:fixed;inset:0;z-index:500;background:rgba(26,10,0,.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .2s ease;}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        .fest-modal{background:var(--cream);border-radius:var(--radius-lg);max-width:540px;width:100%;overflow:hidden;animation:slideUp .25s ease;box-shadow:0 32px 80px rgba(26,10,0,.4);max-height:90vh;overflow-y:auto;}
        @keyframes slideUp{from{transform:translateY(24px);opacity:0;}to{transform:translateY(0);opacity:1;}}
        .fest-modal-header{padding:28px 28px 20px;display:flex;align-items:flex-start;gap:16px;}
        .fest-modal-emoji{font-size:40px;flex-shrink:0;width:70px;height:70px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius);background:white;box-shadow:0 4px 16px var(--shadow);}
        .fest-modal-title{font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--brown);margin-bottom:6px;}
        .fest-modal-hint{font-family:var(--font-hindi);font-size:13px;color:var(--saffron);}
        .fest-modal-body{padding:0 28px 28px;}
        .fest-modal-divider{height:1px;background:var(--cream-dark);margin-bottom:20px;}
        .fest-modal-text{font-family:var(--font-body);font-size:16px;line-height:1.7;color:var(--text-mid);margin-bottom:16px;}
        .fest-modal-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;}
        .fest-meta-item{background:white;border:1px solid var(--cream-dark);border-radius:var(--radius);padding:12px 14px;}
        .fest-meta-label{font-family:var(--font-display);font-size:10px;letter-spacing:.08em;color:var(--text-light);margin-bottom:4px;}
        .fest-meta-value{font-family:var(--font-body);font-size:15px;color:var(--text-dark);font-weight:600;}
        .fest-modal-temple-box{background:rgba(16,163,74,.06);border:1px solid rgba(16,163,74,.2);border-radius:var(--radius);padding:12px 16px;margin-bottom:20px;}
        .fest-modal-temple-label{font-family:var(--font-display);font-size:10px;letter-spacing:.08em;color:#16a34a;margin-bottom:4px;}
        .fest-modal-temple-name{font-family:var(--font-body);font-size:15px;font-weight:600;color:var(--text-dark);}
        .fest-modal-temple-city{font-family:var(--font-hindi);font-size:12px;color:#16a34a;}
        .fest-modal-actions{display:flex;gap:10px;}
        .fest-modal-close{flex:1;padding:11px;border:2px solid var(--cream-dark);border-radius:50px;background:white;font-family:var(--font-display);font-size:13px;letter-spacing:.05em;color:var(--text-mid);cursor:pointer;transition:var(--transition);}
        .fest-modal-close:hover{border-color:var(--saffron);color:var(--saffron);}
        .fest-modal-cta{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 20px;background:linear-gradient(135deg,var(--saffron),var(--saffron-dark));color:white;border:none;border-radius:50px;font-family:var(--font-display);font-size:13px;letter-spacing:.05em;cursor:pointer;text-decoration:none;transition:var(--transition);}
        .fest-modal-cta:hover{opacity:.9;transform:translateY(-1px);}

        /* ── Responsive ── */
        @media(max-width:640px){
          .fest-controls-inner{gap:10px;}
          .fest-search-wrap{flex:0 0 100%;}
          .fest-grid{grid-template-columns:1fr;}
          .fest-modal-meta{grid-template-columns:1fr;}
          .month-heading-name{font-size:20px;}
          .fest-controls-right{margin-left:0;}
        }
      `}</style>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FestivalCard({ festival, compact, onClick }) {
  const { emoji, color } = { emoji: festival.emoji || '🛕', color: festival.color || '#E8650A' };
  return (
    <div
      className={`fest-card${compact ? ' fest-card-compact' : ''}`}
      onClick={onClick}
    >
      <div className="fest-card-top">
        <div className="fest-card-emoji" style={{ background: `${color}14` }}>
          {emoji}
        </div>
        <div className="fest-card-info">
          <div className="fest-card-name" title={festival.name}>{festival.name}</div>
          {festival.significance && (
            <div className="fest-card-sub" title={festival.significance}>{festival.significance}</div>
          )}
          <div className="fest-card-badges">
            {festival.is_major && <span className="fest-badge fest-badge-major">⭐ Major</span>}
            {festival.duration_days > 1 && (
              <span className="fest-badge fest-badge-days">{festival.duration_days} days</span>
            )}
            {festival.temple_id && (
              <span className="fest-badge fest-badge-temple">🛕 Temple</span>
            )}
          </div>
          {festival.temple_name && (
            <div className="fest-card-temple" title={`${festival.temple_name}, ${festival.temple_city || ''}`}>
              📍 {festival.temple_name}{festival.temple_city ? `, ${festival.temple_city}` : ''}
            </div>
          )}
        </div>
      </div>
      <div className="fest-card-accent" style={{ background: `linear-gradient(90deg,${color},${color}55)` }} />
    </div>
  );
}

function FestivalModal({ festival, onClose }) {
  const monthName  = GREGORIAN_MONTHS[(festival.month || 1) - 1] || '';
  const hinduMonth = festival.hindu_month || HINDU_MONTHS[((festival.month || 1) - 1) % 12] || '';
  const { emoji, color } = { emoji: festival.emoji || '🛕', color: festival.color || '#E8650A' };

  return (
    <div className="fest-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fest-modal">
        <div className="fest-modal-header" style={{ background: `linear-gradient(135deg,${color}18,transparent)` }}>
          <div className="fest-modal-emoji" style={{ border: `2px solid ${color}30` }}>{emoji}</div>
          <div>
            <div className="fest-modal-title">{festival.name}</div>
            <div className="fest-modal-hint">
              {festival.is_major && '⭐ Major Festival  ·  '}
              {festival.duration_days > 1 ? `${festival.duration_days} Days` : ''}
            </div>
            <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
              {festival.is_major && <span className="fest-badge fest-badge-major">⭐ Major</span>}
              {festival.temple_id && <span className="fest-badge fest-badge-temple">🛕 Temple Festival</span>}
              {festival._seed && <span className="fest-badge" style={{ color:'var(--text-light)', borderColor:'var(--cream-dark)', background:'var(--cream)' }}>National</span>}
            </div>
          </div>
        </div>

        <div className="fest-modal-body">
          <div className="fest-modal-divider" />

          {/* Temple info if from DB */}
          {festival.temple_name && (
            <div className="fest-modal-temple-box">
              <div className="fest-modal-temple-label">🛕 CELEBRATED AT</div>
              <div className="fest-modal-temple-name">{festival.temple_name}</div>
              {festival.temple_city && (
                <div className="fest-modal-temple-city">📍 {festival.temple_city}</div>
              )}
            </div>
          )}

          {festival.significance && (
            <p className="fest-modal-text">{festival.significance}</p>
          )}
          {festival.description && festival.description !== festival.significance && (
            <p className="fest-modal-text">{festival.description}</p>
          )}

          <div className="fest-modal-meta">
            <div className="fest-meta-item">
              <div className="fest-meta-label">GREGORIAN MONTH</div>
              <div className="fest-meta-value">{monthName}</div>
            </div>
            <div className="fest-meta-item">
              <div className="fest-meta-label">HINDU MONTH</div>
              <div className="fest-meta-value" style={{ fontFamily:'var(--font-hindi)' }}>{hinduMonth}</div>
            </div>
            <div className="fest-meta-item">
              <div className="fest-meta-label">DURATION</div>
              <div className="fest-meta-value">{festival.duration_days || 1} {(festival.duration_days || 1) === 1 ? 'Day' : 'Days'}</div>
            </div>
            <div className="fest-meta-item">
              <div className="fest-meta-label">SOURCE</div>
              <div className="fest-meta-value" style={{ fontSize:13 }}>
                {festival._seed ? 'National Calendar' : festival.source || 'Temple Record'}
              </div>
            </div>
          </div>

          <div className="fest-modal-actions">
            <button className="fest-modal-close" onClick={onClose}>Close</button>
            {festival.temple_slug ? (
              <Link
                to={`/temple/${festival.temple_slug}`}
                className="fest-modal-cta"
                onClick={onClose}
              >
                <MapPin size={14} /> Visit Temple
              </Link>
            ) : (
              <Link
                to={`/search?q=${encodeURIComponent(festival.name)}`}
                className="fest-modal-cta"
                onClick={onClose}
              >
                <MapPin size={14} /> Find Temples
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}