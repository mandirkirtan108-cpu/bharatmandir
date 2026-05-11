import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Star, Search, ChevronLeft, ChevronRight, Sparkles, MapPin, Filter } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Static data: All major Hindu festivals with month mapping ─────────────────
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

// Curated major festivals (static seed — augmented by API data)
const SEED_FESTIVALS = [
  { name:'Makar Sankranti', month:1, significance:'Sun enters Capricorn — harvest festival, kite flying', deity:'Surya', type:'Solar', is_major:true, emoji:'🪁', color:'#E8650A' },
  { name:'Vasant Panchami', month:2, significance:'Onset of spring, worship of Saraswati', deity:'Saraswati', type:'Seasonal', is_major:true, emoji:'🌸', color:'#C8960C' },
  { name:'Maha Shivaratri', month:2, significance:'Night of Lord Shiva, fasting and all-night vigil', deity:'Shiva', type:'Deity', is_major:true, emoji:'🔱', color:'#5B4FDB' },
  { name:'Holi', month:3, significance:'Festival of colours, triumph of Prahlada', deity:'Vishnu', type:'Cultural', is_major:true, emoji:'🎨', color:'#E85CA0' },
  { name:'Ugadi / Gudi Padwa', month:3, significance:'Hindu New Year (Telugu & Marathi)', deity:'Brahma', type:'New Year', is_major:true, emoji:'🪔', color:'#E8650A' },
  { name:'Ram Navami', month:4, significance:'Birth of Lord Rama', deity:'Rama', type:'Deity', is_major:true, emoji:'🏹', color:'#2E8B57' },
  { name:'Hanuman Jayanti', month:4, significance:'Birth of Lord Hanuman', deity:'Hanuman', type:'Deity', is_major:true, emoji:'🐒', color:'#E8650A' },
  { name:'Akshaya Tritiya', month:5, significance:'Most auspicious day for new beginnings', deity:'Lakshmi', type:'Auspicious', is_major:true, emoji:'✨', color:'#C8960C' },
  { name:'Rath Yatra', month:7, significance:'Chariot festival of Lord Jagannath, Puri', deity:'Jagannath', type:'Procession', is_major:true, emoji:'🛕', color:'#E85C2A' },
  { name:'Guru Purnima', month:7, significance:'Reverence to spiritual and academic teachers', deity:'Vyasa', type:'Guru', is_major:false, emoji:'📿', color:'#8B5CF6' },
  { name:'Naga Panchami', month:8, significance:'Worship of serpent gods', deity:'Naga Devata', type:'Nature', is_major:false, emoji:'🐍', color:'#065F46' },
  { name:'Raksha Bandhan', month:8, significance:'Bond of brother and sister', deity:'Yama', type:'Cultural', is_major:true, emoji:'🪢', color:'#E85CA0' },
  { name:'Janmashtami', month:8, significance:'Birth of Lord Krishna', deity:'Krishna', type:'Deity', is_major:true, emoji:'🪈', color:'#1D4ED8' },
  { name:'Ganesh Chaturthi', month:9, significance:'Birth of Lord Ganesha, 10-day celebration', deity:'Ganesha', type:'Deity', is_major:true, emoji:'🐘', color:'#D97706' },
  { name:'Navratri (Sharad)', month:10, significance:'Nine nights of Devi worship and Garba', deity:'Durga', type:'Devi', is_major:true, emoji:'🪆', color:'#BE185D' },
  { name:'Dussehra / Vijayadashami', month:10, significance:'Victory of Rama over Ravana', deity:'Rama & Durga', type:'Victory', is_major:true, emoji:'🏹', color:'#DC2626' },
  { name:'Diwali', month:11, significance:'Festival of lights, Lakshmi Puja, Rama\'s return', deity:'Lakshmi', type:'Deity', is_major:true, emoji:'🪔', color:'#F59E0B' },
  { name:'Govardhan Puja', month:11, significance:'Krishna lifted Govardhan hill', deity:'Krishna', type:'Deity', is_major:false, emoji:'⛰️', color:'#1D4ED8' },
  { name:'Bhai Dooj', month:11, significance:'Celebration of sibling love after Diwali', deity:'Yama', type:'Cultural', is_major:false, emoji:'🌺', color:'#E85CA0' },
  { name:'Kartik Purnima', month:11, significance:'Holy bath in rivers, Tripuri Purnima', deity:'Shiva', type:'Purnima', is_major:true, emoji:'🌕', color:'#0EA5E9' },
  { name:'Vivah Panchami', month:12, significance:'Marriage of Rama and Sita', deity:'Rama & Sita', type:'Deity', is_major:false, emoji:'💐', color:'#EC4899' },
  { name:'Gita Jayanti', month:12, significance:'Day Bhagavad Gita was revealed by Krishna', deity:'Krishna', type:'Scripture', is_major:true, emoji:'📖', color:'#1D4ED8' },
];

const DEITY_FILTERS = ['All','Shiva','Vishnu','Ganesha','Durga','Lakshmi','Krishna','Rama','Saraswati','Other'];
const TYPE_FILTERS  = ['All','Deity','Cultural','Seasonal','Devi','Solar','Procession','Auspicious'];

export default function FestivalCalendarPage() {
  const [selectedMonth, setSelectedMonth]   = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode]             = useState('calendar'); // 'calendar' | 'list'
  const [deityFilter, setDeityFilter]       = useState('All');
  const [typeFilter, setTypeFilter]         = useState('All');
  const [searchQuery, setSearchQuery]       = useState('');
  const [apiFestivals, setApiFestivals]     = useState([]);
  const [loadingAPI, setLoadingAPI]         = useState(true);
  const [selectedFestival, setSelectedFestival] = useState(null);
  const currentYear = new Date().getFullYear();

  // Fetch from API (all-festivals endpoint)
  useEffect(() => {
    axios.get(`${API_BASE}/api/festivals`)
      .then(r => setApiFestivals(r.data || []))
      .catch(() => setApiFestivals([]))
      .finally(() => setLoadingAPI(false));
  }, []);

  // Merge seed + API festivals
  const allFestivals = useMemo(() => {
    const apiNames = new Set(apiFestivals.map(f => f.name?.toLowerCase()));
    const seeds = SEED_FESTIVALS.filter(f => !apiNames.has(f.name.toLowerCase()));
    return [...seeds, ...apiFestivals.map(f => ({
      ...f,
      emoji: f.emoji || '🛕',
      color: f.color || '#E8650A',
    }))];
  }, [apiFestivals]);

  // Apply filters
  const filtered = useMemo(() => {
    return allFestivals.filter(f => {
      if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(f.deity || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (deityFilter !== 'All') {
        const deity = (f.deity || '').toLowerCase();
        if (deityFilter === 'Other') {
          const known = DEITY_FILTERS.slice(1, -1).map(d => d.toLowerCase());
          if (known.some(d => deity.includes(d))) return false;
        } else if (!deity.includes(deityFilter.toLowerCase())) return false;
      }
      if (typeFilter !== 'All' && (f.type || '') !== typeFilter) return false;
      return true;
    });
  }, [allFestivals, searchQuery, deityFilter, typeFilter]);

  const byMonth = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    filtered.forEach(f => {
      const m = f.month;
      if (m >= 1 && m <= 12) map[m].push(f);
    });
    return map;
  }, [filtered]);

  const currentMonthFestivals = byMonth[selectedMonth] || [];
  const totalCount = filtered.length;

  const goMonth = (dir) => {
    setSelectedMonth(m => {
      let next = m + dir;
      if (next < 1) next = 12;
      if (next > 12) next = 1;
      return next;
    });
  };

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section className="fest-hero">
        <div className="fest-hero-bg">
          <div className="fest-diya fest-diya-1">🪔</div>
          <div className="fest-diya fest-diya-2">✨</div>
          <div className="fest-diya fest-diya-3">🌸</div>
          <div className="fest-diya fest-diya-4">🔱</div>
          <div className="fest-diya fest-diya-5">🪁</div>
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
          </div>
        </div>
      </section>

      {/* ── Controls ── */}
      <div className="fest-controls-bar">
        <div className="container fest-controls-inner">
          {/* Search */}
          <div className="fest-search-wrap">
            <Search size={16} />
            <input
              className="fest-search"
              placeholder="Search festivals or deities…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Deity filter */}
          <div className="fest-filter-group">
            <Filter size={14} />
            {DEITY_FILTERS.map(d => (
              <button
                key={d}
                className={`fest-chip ${deityFilter === d ? 'active' : ''}`}
                onClick={() => setDeityFilter(d)}
              >{d}</button>
            ))}
          </div>

          {/* View toggle */}
          <div className="fest-view-toggle">
            <button className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>
              <Calendar size={15}/> Calendar
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
              <Star size={15}/> All Festivals
            </button>
          </div>
        </div>
      </div>

      <div className="container fest-body">

        {viewMode === 'calendar' ? (
          <>
            {/* ── Month strip ── */}
            <div className="month-strip">
              <button className="month-nav-btn" onClick={() => goMonth(-1)}><ChevronLeft size={18}/></button>
              <div className="month-pills">
                {GREGORIAN_MONTHS.map((m, i) => {
                  const mNum = i + 1;
                  const count = (byMonth[mNum] || []).length;
                  return (
                    <button
                      key={m}
                      className={`month-pill ${selectedMonth === mNum ? 'active' : ''}`}
                      onClick={() => setSelectedMonth(mNum)}
                    >
                      <span className="month-pill-name">{MONTH_SHORT[i]}</span>
                      {count > 0 && <span className="month-pill-count">{count}</span>}
                    </button>
                  );
                })}
              </div>
              <button className="month-nav-btn" onClick={() => goMonth(1)}><ChevronRight size={18}/></button>
            </div>

            {/* ── Month header ── */}
            <div className="month-heading">
              <div>
                <h2 className="month-heading-name">{GREGORIAN_MONTHS[selectedMonth - 1]} {currentYear}</h2>
                <p className="month-heading-hindi">{HINDU_MONTHS[(selectedMonth + 1) % 12]} / {HINDU_MONTHS[selectedMonth % 12]}</p>
              </div>
              <span className="month-fest-count">{currentMonthFestivals.length} festival{currentMonthFestivals.length !== 1 ? 's' : ''}</span>
            </div>

            {/* ── Festival cards for month ── */}
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
                  <FestivalCard key={i} festival={f} onClick={() => setSelectedFestival(f)} />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── List / All festivals view ── */
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
                  </div>
                  <div className="fest-list-grid">
                    {fests.map((f, i) => (
                      <FestivalCard key={i} festival={f} compact onClick={() => setSelectedFestival(f)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selectedFestival && (
        <FestivalModal festival={selectedFestival} onClose={() => setSelectedFestival(null)} />
      )}

      <Footer />

      <style>{`
        /* ── Hero ─────────────────────────────────────────── */
        .fest-hero {
          position: relative;
          background: linear-gradient(135deg, #1A0A00 0%, #3D1F00 40%, #6B3A10 70%, #B84D00 100%);
          padding: 72px 0 60px;
          overflow: hidden;
          text-align: center;
        }
        .fest-hero-bg { position: absolute; inset: 0; pointer-events: none; }
        .fest-diya {
          position: absolute;
          font-size: clamp(24px, 4vw, 48px);
          animation: floatDiya 6s ease-in-out infinite;
          opacity: 0.18;
        }
        .fest-diya-1 { top:15%; left:7%;  animation-delay:0s; }
        .fest-diya-2 { top:60%; left:15%; animation-delay:1.2s; }
        .fest-diya-3 { top:20%; right:10%; animation-delay:0.6s; }
        .fest-diya-4 { bottom:20%; right:6%; animation-delay:2s; }
        .fest-diya-5 { top:45%; left:3%;  animation-delay:1.8s; }
        @keyframes floatDiya {
          0%,100% { transform: translateY(0) rotate(-5deg); opacity:.18; }
          50%      { transform: translateY(-18px) rotate(5deg); opacity:.32; }
        }
        .fest-hero-inner { position:relative; z-index:1; }
        .fest-hero-super {
          font-family: var(--font-hindi);
          font-size: 13px;
          letter-spacing: .18em;
          color: var(--gold-light);
          margin-bottom: 16px;
          opacity: .85;
        }
        .fest-hero-title {
          font-family: var(--font-display);
          font-size: clamp(36px, 6vw, 68px);
          font-weight: 900;
          color: white;
          letter-spacing: .02em;
          line-height: 1.05;
          margin-bottom: 14px;
          text-shadow: 0 4px 24px rgba(0,0,0,.4);
        }
        .fest-hero-sub {
          font-family: var(--font-hindi);
          font-size: 16px;
          color: rgba(255,255,255,.7);
          margin-bottom: 28px;
        }
        .fest-hero-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .fest-stat {
          font-family: var(--font-display);
          font-size: 13px;
          letter-spacing: .08em;
          color: var(--gold-light);
          background: rgba(255,255,255,.08);
          padding: 5px 14px;
          border-radius: 50px;
          border: 1px solid rgba(200,150,12,.3);
        }
        .fest-stat-dot { color: rgba(255,255,255,.3); }

        /* ── Controls bar ─────────────────────────────────── */
        .fest-controls-bar {
          background: white;
          border-bottom: 2px solid var(--cream-dark);
          padding: 14px 0;
          position: sticky;
          top: 70px;
          z-index: 100;
          box-shadow: 0 2px 12px var(--shadow);
        }
        .fest-controls-inner {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .fest-search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--cream);
          border: 2px solid var(--cream-dark);
          border-radius: 50px;
          padding: 7px 16px;
          flex: 0 0 220px;
          transition: var(--transition);
        }
        .fest-search-wrap:focus-within { border-color: var(--saffron); background: white; }
        .fest-search-wrap svg { color: var(--text-light); flex-shrink: 0; }
        .fest-search {
          border: none; background: transparent;
          font-family: var(--font-body); font-size: 14px;
          color: var(--text-dark); outline: none; width: 100%;
        }
        .fest-filter-group {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1;
        }
        .fest-filter-group svg { color: var(--text-light); flex-shrink: 0; }
        .fest-chip {
          padding: 5px 13px;
          border: 1.5px solid var(--cream-dark);
          border-radius: 50px;
          font-family: var(--font-display);
          font-size: 11px;
          letter-spacing: .04em;
          cursor: pointer;
          background: white;
          color: var(--text-mid);
          transition: var(--transition);
          white-space: nowrap;
        }
        .fest-chip:hover { border-color: var(--saffron-light); color: var(--saffron); }
        .fest-chip.active { background: var(--saffron); color: white; border-color: var(--saffron); }
        .fest-view-toggle {
          display: flex;
          background: var(--cream);
          border: 2px solid var(--cream-dark);
          border-radius: 50px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .fest-view-toggle button {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 14px;
          border: none; background: transparent;
          font-family: var(--font-display); font-size: 12px; letter-spacing: .04em;
          color: var(--text-light); cursor: pointer; transition: var(--transition);
        }
        .fest-view-toggle button.active { background: var(--saffron); color: white; border-radius: 50px; }

        /* ── Body ─────────────────────────────────────────── */
        .fest-body { padding: 32px 0 64px; }

        /* ── Month strip ──────────────────────────────────── */
        .month-strip {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 28px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .month-nav-btn {
          width: 36px; height: 36px; border-radius: 50%;
          border: 2px solid var(--cream-dark);
          background: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-mid); flex-shrink: 0;
          transition: var(--transition);
        }
        .month-nav-btn:hover { border-color: var(--saffron); color: var(--saffron); }
        .month-pills {
          display: flex; gap: 6px; overflow-x: auto; flex: 1;
          scrollbar-width: none;
        }
        .month-pills::-webkit-scrollbar { display: none; }
        .month-pill {
          display: flex; flex-direction: column; align-items: center;
          padding: 8px 12px; border-radius: 12px;
          border: 2px solid var(--cream-dark);
          background: white; cursor: pointer; flex-shrink: 0;
          transition: var(--transition); gap: 2px;
        }
        .month-pill:hover { border-color: var(--saffron-light); }
        .month-pill.active { background: var(--saffron); border-color: var(--saffron); color: white; }
        .month-pill-name { font-family: var(--font-display); font-size: 12px; letter-spacing:.04em; }
        .month-pill-count {
          font-size: 10px; font-weight: 700;
          background: rgba(0,0,0,.12);
          border-radius: 50px; padding: 0 6px; min-width: 18px;
          text-align: center;
        }
        .month-pill.active .month-pill-count { background: rgba(255,255,255,.25); }

        /* ── Month heading ────────────────────────────────── */
        .month-heading {
          display: flex; align-items: flex-end; justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid var(--cream-dark);
        }
        .month-heading-name {
          font-family: var(--font-display);
          font-size: 28px; font-weight: 700;
          color: var(--brown);
        }
        .month-heading-hindi {
          font-family: var(--font-hindi);
          font-size: 14px; color: var(--text-light);
          margin-top: 2px;
        }
        .month-fest-count {
          font-family: var(--font-display);
          font-size: 13px; letter-spacing: .06em;
          color: var(--saffron);
          background: rgba(232,101,10,.08);
          padding: 4px 14px; border-radius: 50px;
          border: 1px solid rgba(232,101,10,.2);
        }

        /* ── Festival grid / cards ────────────────────────── */
        .fest-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        .fest-card {
          background: white;
          border-radius: var(--radius-lg);
          border: 1.5px solid var(--cream-dark);
          overflow: hidden;
          transition: var(--transition);
          cursor: pointer;
        }
        .fest-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px var(--shadow-deep);
          border-color: transparent;
        }
        .fest-card-top {
          padding: 20px 20px 14px;
          display: flex; align-items: flex-start; gap: 14px;
        }
        .fest-card-emoji {
          font-size: 32px; flex-shrink: 0;
          width: 56px; height: 56px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius);
          background: var(--cream);
        }
        .fest-card-info { flex: 1; min-width: 0; }
        .fest-card-name {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 700;
          color: var(--brown); margin-bottom: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .fest-card-deity {
          font-family: var(--font-hindi);
          font-size: 13px; color: var(--text-light);
        }
        .fest-card-badges {
          display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;
        }
        .fest-badge {
          font-size: 10px; padding: 2px 8px; border-radius: 50px;
          font-family: var(--font-display); letter-spacing: .04em;
          border: 1px solid;
        }
        .fest-badge-major {
          color: var(--saffron-dark); background: rgba(232,101,10,.08);
          border-color: rgba(232,101,10,.25);
        }
        .fest-badge-type {
          color: var(--brown-mid); background: var(--cream);
          border-color: var(--cream-dark);
        }
        .fest-card-accent {
          height: 4px;
          margin-top: 14px;
        }
        /* Compact card */
        .fest-card-compact .fest-card-top { padding: 14px 16px; }
        .fest-card-compact .fest-card-emoji { width: 42px; height: 42px; font-size: 22px; }
        .fest-card-compact .fest-card-name { font-size: 13px; }
        .fest-card-compact .fest-card-deity { font-size: 12px; }
        .fest-card-compact .fest-card-accent { margin-top: 10px; height: 3px; }

        /* ── Empty state ──────────────────────────────────── */
        .fest-empty {
          text-align: center; padding: 72px 24px;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
        }
        .fest-empty-icon { font-size: 52px; }
        .fest-empty p { color: var(--text-light); font-family: var(--font-body); font-size: 16px; }

        /* ── List view ────────────────────────────────────── */
        .fest-list-view { display: flex; flex-direction: column; gap: 36px; }
        .fest-list-section {}
        .fest-list-month-header {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 14px;
        }
        .fest-list-month-name {
          font-family: var(--font-display);
          font-size: 20px; font-weight: 700; color: var(--brown);
        }
        .fest-list-month-count {
          font-family: var(--font-display);
          font-size: 11px; color: white;
          background: var(--saffron);
          padding: 2px 9px; border-radius: 50px;
        }
        .fest-list-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }

        /* ── Modal ────────────────────────────────────────── */
        .fest-modal-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(26,10,0,.65);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: fadeIn .2s ease;
        }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .fest-modal {
          background: var(--cream);
          border-radius: var(--radius-lg);
          max-width: 520px; width: 100%;
          overflow: hidden;
          animation: slideUp .25s ease;
          box-shadow: 0 32px 80px rgba(26,10,0,.4);
        }
        @keyframes slideUp { from { transform: translateY(24px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        .fest-modal-header {
          padding: 28px 28px 20px;
          display: flex; align-items: flex-start; gap: 16px;
        }
        .fest-modal-emoji {
          font-size: 44px; flex-shrink: 0;
          width: 72px; height: 72px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius);
          background: white;
          box-shadow: 0 4px 16px var(--shadow);
        }
        .fest-modal-title {
          font-family: var(--font-display);
          font-size: 22px; font-weight: 700;
          color: var(--brown); margin-bottom: 6px;
        }
        .fest-modal-deity {
          font-family: var(--font-hindi);
          font-size: 14px; color: var(--saffron);
        }
        .fest-modal-body { padding: 0 28px 28px; }
        .fest-modal-divider { height: 1px; background: var(--cream-dark); margin-bottom: 20px; }
        .fest-modal-sig {
          font-family: var(--font-body);
          font-size: 16px; line-height: 1.7;
          color: var(--text-mid); margin-bottom: 20px;
        }
        .fest-modal-meta {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
          margin-bottom: 24px;
        }
        .fest-meta-item {
          background: white;
          border: 1px solid var(--cream-dark);
          border-radius: var(--radius);
          padding: 12px 14px;
        }
        .fest-meta-label {
          font-family: var(--font-display);
          font-size: 10px; letter-spacing: .08em;
          color: var(--text-light); margin-bottom: 4px;
        }
        .fest-meta-value {
          font-family: var(--font-body);
          font-size: 15px; color: var(--text-dark);
          font-weight: 600;
        }
        .fest-modal-actions {
          display: flex; gap: 10px;
        }
        .fest-modal-close {
          flex: 1; padding: 11px;
          border: 2px solid var(--cream-dark);
          border-radius: 50px; background: white;
          font-family: var(--font-display); font-size: 13px;
          letter-spacing: .05em; color: var(--text-mid);
          cursor: pointer; transition: var(--transition);
        }
        .fest-modal-close:hover { border-color: var(--saffron); color: var(--saffron); }
        .fest-modal-search-btn {
          flex: 1;
        }

        /* ── Responsive ───────────────────────────────────── */
        @media (max-width: 640px) {
          .fest-controls-inner { gap: 10px; }
          .fest-search-wrap { flex: 0 0 100%; }
          .fest-grid { grid-template-columns: 1fr; }
          .fest-modal-meta { grid-template-columns: 1fr; }
          .month-heading-name { font-size: 20px; }
        }
      `}</style>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function FestivalCard({ festival, compact, onClick }) {
  return (
    <div
      className={`fest-card ${compact ? 'fest-card-compact' : ''}`}
      onClick={onClick}
      style={{ '--card-color': festival.color || '#E8650A' }}
    >
      <div className="fest-card-top">
        <div className="fest-card-emoji" style={{ background: `${festival.color}14` }}>
          {festival.emoji || '🛕'}
        </div>
        <div className="fest-card-info">
          <div className="fest-card-name">{festival.name}</div>
          <div className="fest-card-deity">{festival.deity || 'Various Deities'}</div>
          <div className="fest-card-badges">
            {festival.is_major && <span className="fest-badge fest-badge-major">⭐ Major</span>}
            {festival.type && <span className="fest-badge fest-badge-type">{festival.type}</span>}
            {festival.duration_days > 1 && (
              <span className="fest-badge fest-badge-type">{festival.duration_days} days</span>
            )}
          </div>
        </div>
      </div>
      <div className="fest-card-accent" style={{ background: `linear-gradient(90deg, ${festival.color}, ${festival.color}88)` }} />
    </div>
  );
}

function FestivalModal({ festival, onClose }) {
  const monthName = GREGORIAN_MONTHS[festival.month - 1] || '';
  const hinduMonth = HINDU_MONTHS[(festival.month - 1) % 12] || '';

  return (
    <div className="fest-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fest-modal">
        <div className="fest-modal-header" style={{ background: `linear-gradient(135deg, ${festival.color}18, transparent)` }}>
          <div className="fest-modal-emoji" style={{ border: `2px solid ${festival.color}30` }}>
            {festival.emoji || '🛕'}
          </div>
          <div>
            <div className="fest-modal-title">{festival.name}</div>
            <div className="fest-modal-deity">🙏 {festival.deity || 'Various Deities'}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              {festival.is_major && <span className="fest-badge fest-badge-major">⭐ Major Festival</span>}
              {festival.type && <span className="fest-badge fest-badge-type">{festival.type}</span>}
            </div>
          </div>
        </div>
        <div className="fest-modal-body">
          <div className="fest-modal-divider" />
          {festival.significance && (
            <p className="fest-modal-sig">{festival.significance}</p>
          )}
          {festival.description && (
            <p className="fest-modal-sig">{festival.description}</p>
          )}
          <div className="fest-modal-meta">
            <div className="fest-meta-item">
              <div className="fest-meta-label">GREGORIAN MONTH</div>
              <div className="fest-meta-value">{monthName}</div>
            </div>
            <div className="fest-meta-item">
              <div className="fest-meta-label">HINDU MONTH</div>
              <div className="fest-meta-value" style={{ fontFamily: 'var(--font-hindi)' }}>{hinduMonth}</div>
            </div>
            {festival.duration_days && (
              <div className="fest-meta-item">
                <div className="fest-meta-label">DURATION</div>
                <div className="fest-meta-value">{festival.duration_days} {festival.duration_days === 1 ? 'day' : 'days'}</div>
              </div>
            )}
            {festival.type && (
              <div className="fest-meta-item">
                <div className="fest-meta-label">CATEGORY</div>
                <div className="fest-meta-value">{festival.type}</div>
              </div>
            )}
          </div>
          <div className="fest-modal-actions">
            <button className="fest-modal-close" onClick={onClose}>Close</button>
            <Link
              to={`/search?q=${encodeURIComponent(festival.deity || festival.name)}`}
              className="btn-primary fest-modal-search-btn"
              style={{ justifyContent: 'center', textDecoration: 'none' }}
              onClick={onClose}
            >
              <MapPin size={14} /> Find Temples
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}