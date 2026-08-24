import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronRight, Grid3X3, Headphones, List, Pause, Play, Search, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { fetchBooks, fetchLibraryAudio } from '../services/sacredBooksApi';

const FACETS = [
  { key: 'media', label: 'Type — Read / Listen', open: true },
  { key: 'category', label: 'Category', open: true },
];
const languageLabel = code => ({ en: 'English', hi: 'Hindi', sa: 'Sanskrit' }[code] || code);
const titleCase = value => String(value || 'Devotional').replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function SacredBooksPage() {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [books, setBooks] = useState([]);
  const [audio, setAudio] = useState([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ media: [], category: [] });
  const [view, setView] = useState('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchBooks(), fetchLibraryAudio()])
      .then(([bookResult, audioResult]) => { setBooks(bookResult.books || []); setAudio(audioResult.audio || []); })
      .catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const player = audioRef.current;
    if (!player) return undefined;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener('play', onPlay); player.addEventListener('pause', onPause); player.addEventListener('ended', onPause);
    return () => { player.removeEventListener('play', onPlay); player.removeEventListener('pause', onPause); player.removeEventListener('ended', onPause); };
  }, [currentAudio]);

  const items = useMemo(() => [
    ...books.map(book => ({ ...book, key: `book-${book.id}`, media: 'Text', category: 'Sacred Text', language: [book.source_language, ...(book.target_languages || []).map(languageLabel)].filter(Boolean).join(' + '), subtitle: book.description || 'A sacred scripture for prayer, reflection and daily reading.', creator: book.author || 'Traditional sacred text' })),
    ...audio.map(track => ({ ...track, key: `audio-${track.id}`, media: 'Audio', category: titleCase(track.category || 'Bhajan & Kirtan'), language: track.language || 'Devotional', subtitle: track.description || 'A devotional recording for prayer and contemplation.', creator: track.artist || 'Temple devotional recording' })),
  ], [books, audio]);

  const facetOptions = useMemo(() => Object.fromEntries(FACETS.map(facet => {
    const counts = {}; items.forEach(item => { counts[item[facet.key]] = (counts[item[facet.key]] || 0) + 1; });
    return [facet.key, Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))];
  })), [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => {
      if (FACETS.some(facet => filters[facet.key].length && !filters[facet.key].includes(item[facet.key]))) return false;
      return !needle || `${item.title} ${item.creator} ${item.subtitle} ${item.category} ${item.language}`.toLowerCase().includes(needle);
    });
  }, [items, filters, query]);

  const grouped = useMemo(() => visible.reduce((groups, item) => { (groups[item.category] ||= []).push(item); return groups; }, {}), [visible]);
  const toggleFilter = (key, value) => setFilters(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }));
  const playTrack = item => {
    if (!item.audio_url) return;
    if (currentAudio?.key === item.key) { if (audioRef.current?.paused) audioRef.current.play().catch(() => {}); else audioRef.current?.pause(); return; }
    setCurrentAudio(item); setPlaying(true);
  };
  const openItem = item => item.media === 'Text' ? navigate(`/sacred-books/library/${item.slug}`) : playTrack(item);

  return <>
    <Navbar />
    <main className="temple-library">
      <header className="catalog-hero">
        <div className="catalog-om">ॐ</div><h1>Temple Library</h1>
        <p>Sacred texts, stotras, kirtans, bhajans and discourses — search, filter, read and listen</p>
        <label className="catalog-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, author, singer, speaker, keyword…" /><Search size={19} /></label>
      </header>
      <div className="catalog-layout">
        <aside className={filtersOpen ? 'catalog-filters open' : 'catalog-filters'}>
          <button className="mobile-filter-toggle" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={16} /> Filters</button>
          <div className="filter-content">
            <div className="filter-heading"><b>Filter</b><button onClick={() => setFilters({ media: [], category: [] })}>Clear all</button></div>
            {FACETS.map(facet => <details className="catalog-facet" open={facet.open} key={facet.key}>
              <summary>{facet.label}<ChevronRight size={13} /></summary>
              <div className="facet-options">{(facetOptions[facet.key] || []).map(([value, count]) => <label key={value}><input type="checkbox" checked={filters[facet.key].includes(value)} onChange={() => toggleFilter(facet.key, value)} /><span>{value}</span><small>{count}</small></label>)}</div>
            </details>)}
          </div>
        </aside>
        <section className="catalog-results">
          <div className="catalog-toolbar"><p>Showing <b>{visible.length}</b> of {items.length} items</p><div className="view-toggle"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}><Grid3X3 size={13} /> Grid</button><button className={view === 'series' ? 'active' : ''} onClick={() => setView('series')}><List size={13} /> By series / album</button></div></div>
          {loading && <div className="catalog-state">Arranging the temple library…</div>}
          {error && <div className="catalog-state error">{error}</div>}
          {!loading && !error && visible.length === 0 && <div className="catalog-state">No matching books or recordings were found.</div>}
          {!loading && !error && view === 'grid' && <div className="catalog-grid">{visible.map(item => <CatalogCard key={item.key} item={item} active={currentAudio?.key === item.key && playing} onOpen={openItem} />)}</div>}
          {!loading && !error && view === 'series' && <div>{Object.entries(grouped).map(([name, group]) => <section className="catalog-series" key={name}><h2>{name}<small>{group.length} {group.length === 1 ? 'item' : 'items'}</small></h2>{group.map((item, index) => <button className={`series-row ${item.media === 'Audio' ? 'audio' : ''}`} key={item.key} onClick={() => openItem(item)}><span className="series-index">{String(index + 1).padStart(2, '0')}</span><span className="series-copy"><b>{item.title}</b><small>{item.creator} · {item.language}</small></span><span className="series-action">{item.media === 'Text' ? 'Read' : 'Listen'}</span></button>)}</section>)}</div>}
        </section>
      </div>
      <div className="catalog-blessing">Temple Library · ॥ ॐ नमः शिवाय ॥</div>
    </main>
    {currentAudio && <div className="now-playing"><button className="round-player" onClick={() => playTrack(currentAudio)}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><div><b>{currentAudio.title}</b><span>{currentAudio.creator}</span></div><audio ref={audioRef} src={currentAudio.audio_url} controls autoPlay /><button className="close-player" onClick={() => { audioRef.current?.pause(); setCurrentAudio(null); }}><X size={20} /></button></div>}
    <Footer /><style>{catalogStyles}</style>
  </>;
}

function CatalogCard({ item, active, onOpen }) {
  const isAudio = item.media === 'Audio';
  return <article className={`catalog-card ${isAudio ? 'audio' : ''} ${active ? 'playing' : ''}`} onClick={() => onOpen(item)}><div className="card-top"><span>{item.category}</span><em>{isAudio ? <><Play size={9} /> Listen</> : 'Read'}</em></div><div className="card-symbol">{isAudio ? <Headphones size={22} /> : <BookOpen size={22} />}</div><h2>{item.title}</h2><small className="creator">{item.creator}</small><div className="card-foot">{!isAudio && <span>{item.page_count || 0} pages</span>}{isAudio && <button disabled={!item.audio_url}><Play size={10} /> Play</button>}</div></article>;
}

const catalogStyles = `
.temple-library{--ink:#2b2118;--muted:#7a6a55;--gold:#c8873f;--deep:#7a3e12;--teal:#3f8a86;--cream:#fffdf9;--card:#fffefb;--line:#ecdcc0;--chip:#f4e8d5;min-height:100vh;background:var(--cream);color:var(--ink);font-family:"Noto Serif",Georgia,serif;padding-bottom:40px}.catalog-hero{text-align:center;padding:62px 20px 48px;background:linear-gradient(108deg,#4b1903 0%,#6f2704 42%,#a33f05 100%);border-bottom:4px solid #e9d8b8;box-shadow:inset 0 1px rgba(255,255,255,.08);color:#fff}.catalog-om{width:86px;margin:0 auto 13px;padding:5px 16px;border:1px solid rgba(255,205,120,.36);border-radius:99px;background:rgba(255,255,255,.07);font-family:"Noto Serif Devanagari",serif;font-size:23px;line-height:1.2;color:#f3b75e}.catalog-hero h1{margin:5px 0 9px;font-family:var(--font-display);font-size:clamp(38px,5vw,58px);color:#fff;text-shadow:0 2px 12px rgba(37,10,0,.22)}.catalog-hero p{margin:0;color:rgba(255,244,230,.78);font-style:normal;font-family:var(--font-body);font-size:15px}.catalog-search{max-width:640px;margin:22px auto 0;display:flex;align-items:center;border:1px solid rgba(255,220,170,.48);border-radius:99px;background:rgba(255,255,255,.96);box-shadow:0 6px 20px rgba(44,12,0,.2);padding:0 17px;color:#b85b17}.catalog-search:focus-within{border-color:#f0b765;box-shadow:0 7px 24px rgba(44,12,0,.28)}.catalog-search input{width:100%;border:0;outline:0;background:transparent;padding:13px 0;color:var(--ink);font:14px inherit}
.catalog-layout{max-width:1200px;margin:0 auto;padding:24px 20px 48px;display:grid;grid-template-columns:245px minmax(0,1fr);gap:28px}.catalog-filters{align-self:start;position:sticky;top:18px}.filter-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.filter-heading b{text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:#b5651d}.filter-heading button{border:0;background:none;color:var(--muted);text-decoration:underline;cursor:pointer;font:11px inherit}.catalog-facet{border:1px solid var(--line);border-radius:10px;background:var(--card);margin-bottom:11px;overflow:hidden}.catalog-facet summary{cursor:pointer;list-style:none;padding:11px 13px;display:flex;align-items:center;justify-content:space-between;color:var(--deep);font-size:13px;font-weight:700}.catalog-facet summary::-webkit-details-marker{display:none}.catalog-facet summary svg{color:var(--gold);transition:.2s}.catalog-facet[open] summary svg{transform:rotate(90deg)}.facet-options{padding:0 13px 11px}.facet-options label{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;cursor:pointer}.facet-options input{accent-color:var(--gold)}.facet-options small{margin-left:auto;background:var(--chip);color:var(--muted);padding:1px 7px;border-radius:20px}.mobile-filter-toggle{display:none}
.catalog-toolbar{min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.catalog-toolbar p{margin:0;color:var(--muted);font-size:13px}.catalog-toolbar b{color:var(--deep)}.view-toggle{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.view-toggle button{display:flex;align-items:center;gap:5px;border:0;background:#fff;padding:7px 12px;color:var(--muted);font:11px inherit;cursor:pointer}.view-toggle button.active{background:var(--gold);color:#fff;font-weight:700}.catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));grid-auto-rows:190px;gap:16px}.catalog-card{position:relative;height:190px;min-height:0;overflow:hidden;border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:11px;background:var(--card);padding:15px;display:flex;flex-direction:column;cursor:pointer;transition:.2s}.catalog-card.audio{border-left-color:var(--teal)}.catalog-card:hover{transform:translateY(-3px);box-shadow:0 9px 22px rgba(115,65,18,.14)}.catalog-card.playing{box-shadow:0 0 0 2px var(--teal),0 8px 20px rgba(63,138,134,.18)}.card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:13px}.card-top>span{color:#b5651d;font-size:9px;letter-spacing:.08em;text-transform:uppercase;font-weight:800}.audio .card-top>span{color:var(--teal)}.card-top em{display:flex;align-items:center;gap:3px;background:#f6ece2;color:#9a6b2f;border-radius:20px;padding:2px 8px;font-size:9px;text-transform:uppercase;font-style:normal;font-weight:700}.audio .card-top em{background:#e2f0ef;color:var(--teal)}.card-symbol{position:absolute;right:15px;top:48px;color:#dbc5a2;opacity:.5}.audio .card-symbol{color:#9ccbc8}.catalog-card h2{margin:0 34px 6px 0;font-family:"Noto Serif Devanagari",var(--font-display),serif;color:#5c2d0c;font-size:19px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.creator{margin-top:auto;color:#8c765e;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card-foot{display:flex;align-items:center;flex-wrap:nowrap;gap:5px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}.card-foot>span{max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--chip);color:#6a4a22;padding:2px 8px;border-radius:20px;font-size:9.5px}.card-foot button{margin-left:auto;display:flex;align-items:center;gap:4px;border:1px solid var(--teal);border-radius:20px;background:#fff;color:#2f6a66;padding:3px 9px;font:700 10px inherit;cursor:pointer}
.catalog-series{margin-bottom:23px}.catalog-series h2{display:flex;align-items:baseline;gap:8px;margin:0 0 8px;padding-bottom:7px;border-bottom:2px solid #ead9b8;color:var(--deep);font-size:15px}.catalog-series h2 small{font-size:10px;color:var(--muted);font-style:italic;font-weight:400}.series-row{width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:6px;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:8px;background:var(--card);text-align:left;cursor:pointer;font-family:inherit}.series-row.audio{border-left-color:var(--teal)}.series-row:hover{background:#fff9ef}.series-index{color:#a99884;font-size:10px}.series-copy{flex:1;display:flex;flex-direction:column}.series-copy b{font-family:"Noto Serif Devanagari",serif;color:#5c2d0c}.series-copy small{color:var(--muted);font-size:10px}.series-action{text-transform:uppercase;font-size:9px;color:var(--deep);background:var(--chip);padding:3px 8px;border-radius:20px}.audio .series-action{color:var(--teal);background:#e2f0ef}.catalog-state{text-align:center;padding:65px 20px;color:var(--muted)}.catalog-state.error{color:#a11}.catalog-blessing{text-align:center;color:#90765c;font-size:11px;font-style:italic;padding:0 20px 25px}
.now-playing{position:fixed;left:0;right:0;bottom:0;z-index:1000;display:flex;align-items:center;gap:13px;padding:10px max(18px,calc((100vw - 1160px)/2));background:linear-gradient(135deg,#103c39,#082c2a);color:#effaf8;box-shadow:0 -5px 22px rgba(0,0,0,.25)}.round-player,.close-player{border:0;border-radius:50%;width:38px;height:38px;display:grid;place-items:center;background:#effaf8;color:#174b47;cursor:pointer;flex-shrink:0}.now-playing>div{width:210px;min-width:0}.now-playing b,.now-playing span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.now-playing b{font-family:"Noto Serif Devanagari",serif;font-size:14px}.now-playing span{color:#a9d8d4;font-size:10px}.now-playing audio{flex:1;height:38px;min-width:160px}.close-player{background:transparent;color:#fff}
@media(max-width:820px){.catalog-layout{grid-template-columns:1fr;padding-top:16px}.catalog-filters{position:static}.mobile-filter-toggle{display:flex;width:100%;align-items:center;justify-content:center;gap:7px;padding:10px;border:1px solid var(--gold);border-radius:9px;background:#fff;color:var(--deep);font-weight:700}.filter-content{display:none;margin-top:12px}.catalog-filters.open .filter-content{display:block}.catalog-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.now-playing>div{width:125px}.now-playing audio{min-width:100px}}@media(max-width:520px){.catalog-toolbar{align-items:flex-start;flex-direction:column}.catalog-grid{grid-template-columns:1fr}.now-playing{flex-wrap:wrap}.now-playing>div{flex:1}.now-playing audio{order:4;width:100%;flex-basis:100%}}
`;
