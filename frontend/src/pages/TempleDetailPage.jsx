import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemple } from '../hooks/useTranslatedData';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// No processing — use URL exactly as stored in DB, same as TempleCard on homepage
function proxyImageUrl(url) {
  return url || null;
}

function formatTime(t) {
  if (!t) return null;
  const p = String(t).split(':');
  return p.length >= 2 ? `${p[0]}:${p[1]}` : String(t);
}
function displayFee(fee) {
  if (fee == null || fee === '') return null;
  const n = Number(fee);
  return isNaN(n) ? null : n === 0 ? 'Free Entry' : `₹${n}`;
}
function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  const s = String(tags).trim();
  if (s.startsWith('[')) { try { return JSON.parse(s).filter(Boolean); } catch (_) {} }
  return s.split(',').map(t => t.trim()).filter(Boolean);
}
function v(x) { return x && String(x).trim() !== '' && String(x) !== 'null' && String(x) !== 'false'; }

// ─── Styles ────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap');

*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{font-family:'DM Sans',system-ui,sans-serif;background:#FAF6EE;color:#1A0D00;-webkit-font-smoothing:antialiased;}

@keyframes spin{to{transform:rotate(360deg)}}
@keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes diya{0%,100%{filter:drop-shadow(0 0 14px rgba(255,140,40,.45))}50%{filter:drop-shadow(0 0 28px rgba(255,190,70,.85))}}

/* HERO */
.hero{position:relative;height:72vh;min-height:460px;max-height:640px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;background:#0D0500;transform:translateZ(0);isolation:isolate;}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;transition:opacity .8s;}
.hero-grad{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,5,0,.08) 0%,rgba(10,5,0,0) 25%,rgba(10,5,0,.55) 60%,rgba(10,5,0,.95) 100%);pointer-events:none;}
.hero-diya{position:absolute;top:24%;left:50%;transform:translateX(-50%);font-size:52px;animation:diya 3s ease-in-out infinite;z-index:2;}
.hero-body{position:relative;z-index:3;padding:0 52px 56px;max-width:880px;animation:up .6s ease .1s both;}

/* Breadcrumb */
.hero-bc{display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.09em;margin-bottom:12px;flex-wrap:wrap;font-family:'DM Sans',sans-serif;font-weight:500;}
.hero-bc a{color:inherit;text-decoration:none;transition:color .2s;}.hero-bc a:hover{color:rgba(255,255,255,.75);}
.hero-bc sep{color:rgba(255,255,255,.2);}

/* Badges */
.badges{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:13px;}
.badge{padding:4px 13px;border-radius:50px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-family:'DM Sans',sans-serif;}
.badge.saffron{background:rgba(200,82,10,.82);color:rgba(255,225,160,.95);}
.badge.green{background:rgba(26,107,58,.82);color:rgba(150,240,170,.95);}
.badge.blue{background:rgba(20,80,160,.82);color:rgba(170,205,255,.95);}

/* Temple name */
.hero-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(28px,5.2vw,62px);font-weight:700;color:#fff;line-height:1.06;margin-bottom:6px;letter-spacing:-.01em;}
.hero-hindi{font-family:'Noto Sans Devanagari',sans-serif;font-size:17px;color:rgba(255,190,100,.7);margin-bottom:17px;}
.hero-meta{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:22px;}
.hero-meta-item{font-size:13px;color:rgba(255,255,255,.62);display:flex;align-items:center;gap:5px;font-family:'DM Sans',sans-serif;}
.hero-acts{display:flex;gap:9px;flex-wrap:wrap;}
.btn{padding:11px 22px;border-radius:9px;font-size:13.5px;font-weight:500;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:all .2s;border:none;font-family:'DM Sans',sans-serif;}
.btn-fill{background:#C8520A;color:#fff;box-shadow:0 3px 14px rgba(200,82,10,.38);}.btn-fill:hover{background:#9A3C05;transform:translateY(-1px);}
.btn-ghost{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.28);}.btn-ghost:hover{background:rgba(255,255,255,.2);}
.btn-red{background:linear-gradient(135deg,#b83024,#e0402e);color:#fff;}

/* STICKY NAV */
.snav{position:sticky;top:0;z-index:50;background:rgba(250,246,238,.97);backdrop-filter:blur(16px);border-bottom:1px solid #EDE3CE;display:flex;padding:0 52px;box-shadow:0 2px 10px rgba(44,21,0,.07);overflow-x:auto;scrollbar-width:none;}
.snav::-webkit-scrollbar{display:none;}
.snav-item{padding:14px 16px;font-size:13px;font-weight:500;color:#7A5538;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:.15s;flex-shrink:0;font-family:'DM Sans',sans-serif;}
.snav-item:hover{color:#4A2C10;}
.snav-item.on{color:#C8520A;border-bottom-color:#C8520A;font-weight:600;}

/* MAIN LAYOUT */
.wrap{max-width:1180px;margin:0 auto;padding:32px 44px 80px;display:grid;grid-template-columns:1fr 298px;gap:26px;align-items:start;}
.stick{position:sticky;top:55px;display:flex;flex-direction:column;gap:13px;}

/* SECTION CARDS */
.sec{background:#fff;border-radius:16px;padding:26px 28px;margin-bottom:20px;box-shadow:0 2px 12px rgba(44,21,0,.07);border:1px solid #EDE3CE;animation:up .5s ease both;}
.sec-h{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#2C1500;margin-bottom:17px;display:flex;align-items:center;gap:10px;letter-spacing:.01em;}
.sec-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#E06B25,#9A3C05);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}

/* INFO GRID */
.ig{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ii{background:#F7F0E2;border-radius:9px;padding:12px 14px;border:1px solid #EDE3CE;transition:.18s;}.ii:hover{background:#EDE3CE;}
.ii.full{grid-column:1/-1;}
.il{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#A07050;margin-bottom:4px;font-weight:600;}
.iv{font-size:14px;font-weight:500;color:#2C1500;line-height:1.4;}

/* TIMING STRIP */
.tstrip{display:flex;gap:10px;flex-wrap:wrap;padding:15px;background:linear-gradient(135deg,#F7F0E2,#EDE3CE);border-radius:11px;margin-bottom:17px;}
.tblock{flex:1;min-width:88px;text-align:center;}
.tval{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:700;color:#C8520A;}
.tlbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#A07050;margin-top:2px;font-weight:600;}

/* PROSE */
.prose{font-size:15px;line-height:1.85;color:#4A2C10;margin-bottom:14px;}
.prose-sm{font-size:13.5px;line-height:1.8;color:#7A5538;}
.significance{background:#FFF4EB;border-left:4px solid #C8520A;border-radius:0 10px 10px 0;padding:15px 18px;margin-top:13px;}
.sig-lbl{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#C8520A;font-weight:700;margin-bottom:7px;}
.puranic{background:#FDF8EC;border:1px solid rgba(176,125,18,.2);border-radius:10px;padding:15px 18px;margin-top:13px;}
.puranic-lbl{font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:#B07D12;font-weight:700;margin-bottom:7px;}
.hindi-block{margin-top:13px;padding:14px 15px;background:#F7F0E2;border-radius:10px;border:1px solid #EDE3CE;}
.hindi-lbl{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#A07050;margin-bottom:7px;font-weight:600;}

/* CHIPS */
.chip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:7px;margin-top:6px;}
.chip{padding:8px 11px;border-radius:7px;font-size:12.5px;font-weight:500;display:flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;}
.chip-saffron{background:#F7F0E2;color:#4A2C10;}.chip-saffron .dot{width:7px;height:7px;border-radius:50%;background:#C8520A;flex-shrink:0;}
.chip-green{background:#EBF7F0;color:#1A6B3A;}
.chip-blue{background:#EBF5FB;color:#1A5276;}

/* PUJA SCHEDULE */
.prow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #EDE3CE;}
.prow:last-child{border-bottom:none;}
.pname{font-size:13.5px;font-weight:500;color:#4A2C10;}
.ptime{font-size:13.5px;font-weight:700;color:#C8520A;font-family:'Cormorant Garamond',Georgia,serif;}

/* FESTIVALS */
.fest{display:flex;gap:13px;padding:15px 0;border-bottom:1px solid #EDE3CE;}.fest:last-child{border-bottom:none;}
.fest-mo{flex-shrink:0;width:48px;height:48px;background:#C8520A;border-radius:11px;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;letter-spacing:.05em;}
.major{font-size:10px;background:rgba(200,82,10,.12);color:#C8520A;padding:2px 8px;border-radius:50px;margin-left:7px;font-weight:600;}

/* SEVAS */
.seva{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#F7F0E2;border-radius:9px;margin-bottom:8px;border:1px solid #EDE3CE;transition:.18s;}.seva:hover{background:#EDE3CE;border-color:#C8520A;}
.seva-price{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:700;color:#C8520A;white-space:nowrap;margin-left:11px;}

/* MANTRAS */
.mantra{background:linear-gradient(145deg,rgba(44,21,0,.97),rgba(90,40,8,.95));border-radius:14px;padding:22px;margin-bottom:12px;color:#fff;position:relative;overflow:hidden;}
.mantra::before{content:'ॐ';position:absolute;right:-8px;bottom:-8px;font-family:'Noto Sans Devanagari',sans-serif;font-size:96px;color:rgba(255,255,255,.04);user-select:none;}
.m-title{font-size:12.5px;color:rgba(255,200,80,.82);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;}
.m-sk{font-family:'Noto Sans Devanagari',sans-serif;font-size:19px;line-height:1.85;margin-bottom:8px;}
.m-ro{font-size:13px;color:rgba(255,255,255,.52);font-style:italic;line-height:1.7;margin-bottom:8px;}
.m-mn{font-size:12px;color:rgba(255,255,255,.4);border-top:1px solid rgba(255,255,255,.1);padding-top:8px;line-height:1.65;}

/* PRIESTS */
.priest{padding:14px 0;border-bottom:1px solid #EDE3CE;}.priest:last-child{border-bottom:none;}
.priest-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:600;color:#2C1500;}
.priest-head{font-size:10px;background:#FFF4EB;color:#C8520A;padding:2px 8px;border-radius:50px;margin-left:8px;font-weight:600;}
.priest-d{font-size:12.5px;color:#7A5538;margin-top:3px;}

/* CONTACT */
.crow{padding:8px 0;border-bottom:1px solid #EDE3CE;display:flex;flex-direction:column;gap:3px;}.crow:last-child{border-bottom:none;}
.clbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#A07050;font-weight:600;}
.cval{font-size:13.5px;font-weight:500;color:#2C1500;}
.clink{font-size:13.5px;color:#C8520A;text-decoration:none;font-weight:500;}.clink:hover{text-decoration:underline;}
.social-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px;}
.soc-btn{flex:1;min-width:78px;padding:8px;border-radius:7px;text-align:center;font-size:12px;font-weight:500;text-decoration:none;border:1.5px solid #EDE3CE;color:#4A2C10;background:#fff;transition:.18s;display:flex;align-items:center;justify-content:center;gap:4px;}
.soc-btn:hover{border-color:#C8520A;color:#C8520A;}

/* TAGS */
.tags{display:flex;flex-wrap:wrap;gap:7px;padding:4px 0 18px;}
.tag{background:#fff;border:1px solid #EDE3CE;border-radius:50px;padding:4px 12px;font-size:12px;color:#7A5538;font-weight:500;}

/* SIDEBAR CARD */
.card{background:#fff;border-radius:16px;padding:19px;box-shadow:0 2px 12px rgba(44,21,0,.07);border:1px solid #EDE3CE;}
.card-h{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:700;color:#2C1500;margin-bottom:13px;letter-spacing:.01em;}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.stat{text-align:center;padding:9px 7px;background:#F7F0E2;border-radius:7px;border:1px solid #EDE3CE;}
.sv{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;font-weight:700;color:#C8520A;word-break:break-word;line-height:1.2;}
.sl2{display:block;font-size:10px;color:#A07050;margin-top:2px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;}
.map-ph{width:100%;height:100px;background:#F7F0E2;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:34px;margin-bottom:11px;}
.map-row{font-size:12.5px;color:#7A5538;padding:5px 0;display:flex;align-items:flex-start;gap:6px;line-height:1.45;}
.dc{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:9px 0;}
.cause{text-align:center;padding:9px 6px;background:#F7F0E2;border-radius:7px;border:1px solid #EDE3CE;}
.cause-i{font-size:19px;margin-bottom:2px;}
.cause-n{font-size:11px;font-weight:500;color:#4A2C10;}
.abtn{width:100%;padding:10px 13px;background:#C8520A;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;transition:.18s;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;margin-top:7px;font-family:'DM Sans',sans-serif;}
.abtn:hover{background:#9A3C05;}
.abtn.out{background:#fff;color:#C8520A;border:1.5px solid #EDE3CE;}.abtn.out:hover{background:#F7F0E2;}
.abtn.red{background:linear-gradient(135deg,#b83024,#e0402e);}
.verified{display:flex;align-items:center;gap:10px;padding:11px;background:#EBF7F0;border-radius:9px;}
.vtext{font-size:12px;font-weight:600;color:#1A6B3A;}

/* LOADING / ERROR */
.loading{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
.spinner{width:42px;height:42px;border:3px solid #EDE3CE;border-top-color:#C8520A;border-radius:50%;animation:spin .75s linear infinite;}
.err{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;}

/* RESPONSIVE */
@media(max-width:1024px){.wrap{grid-template-columns:1fr;padding:20px 20px 60px;}.stick{position:static;}.snav,.hero-body{padding-left:20px;padding-right:20px;}}
@media(max-width:640px){.hero{height:auto;min-height:380px;}.hero-h1{font-size:clamp(22px,7vw,36px)}.ig,.sg,.chip-grid,.dc{grid-template-columns:1fr 1fr;}.ii.full{grid-column:1/-1;}.wrap{padding:14px 14px 60px;}.sec{padding:17px 15px;}}
`;

// Hero image — same logic as TempleCard on homepage, no processing
function HeroImage({ src, alt }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="hero-img"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

// InfoItem — only renders if value exists
function II({ label, value, full, icon }) {
  if (!v(value)) return null;
  return (
    <div className={`ii${full ? ' full' : ''}`}>
      <div className="il">{label}</div>
      <div className="iv">{icon && <span style={{marginRight:4}}>{icon}</span>}{value}</div>
    </div>
  );
}

// Section label
function SLabel({ text }) {
  return <p style={{ fontSize:11, color:'var(--kl)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700 }}>{text}</p>;
}

export default function TempleDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [temple,       setTemple]       = useState(null);
  const [mantras,      setMantras]      = useState([]);
  const [festivals,    setFestivals]    = useState([]);
  const [sevas,        setSevas]        = useState([]);
  const [pujaSchedule, setPujaSchedule] = useState([]);
  const [priests,      setPriests]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [activeNav,    setActiveNav]    = useState('overview');

  const { translated: T } = useTranslatedTemple(temple);

  useEffect(() => {
    if (!slug || slug === 'undefined') { navigate('/'); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const res = await templeAPI.getBySlug(slug);
        setTemple(res.data);
        const id = res.data.id;
        const [m, f, s, ps, pr] = await Promise.allSettled([
          templeAPI.getMantras(id),
          templeAPI.getFestivals(id),
          templeAPI.getSevas(id),
          templeAPI.getPujaSchedule ? templeAPI.getPujaSchedule(id) : Promise.reject(),
          templeAPI.getPriests      ? templeAPI.getPriests(id)      : Promise.reject(),
        ]);
        if (m.status  === 'fulfilled') setMantras(m.value.data       || []);
        if (f.status  === 'fulfilled') setFestivals(f.value.data     || []);
        if (s.status  === 'fulfilled') setSevas(s.value.data         || []);
        if (ps.status === 'fulfilled') setPujaSchedule(ps.value.data || []);
        if (pr.status === 'fulfilled') setPriests(pr.value.data      || []);
      } catch (err) {
        setError(err?.response?.status === 404 ? 'Temple not found.' : 'Failed to load temple.');
      } finally { setLoading(false); }
    };
    load();
    window.scrollTo(0, 0);
  }, [slug, navigate]);

  if (loading) return (<><style>{CSS}</style><Navbar/><div className="loading"><div className="spinner"/><span style={{color:'var(--kl)',fontSize:14}}>Loading temple…</span></div></>);
  if (error)   return (<><style>{CSS}</style><Navbar/><div className="err"><div style={{fontSize:60}}>🛕</div><h2 style={{fontFamily:"'Playfair Display',serif",fontSize:28}}>Temple Not Found</h2><p style={{color:'var(--kl)'}}>{error}</p><button className="btn btn-fill" style={{marginTop:16}} onClick={()=>navigate('/')}>← All Temples</button></div></>);
  if (!T) return (<><style>{CSS}</style><Navbar/><div className="loading"><div className="spinner"/></div></>);

  const heroImg  = proxyImageUrl(T.hero_image_url);
  const openTime = formatTime(T.opening_time);
  const closeTime= formatTime(T.closing_time);
  const acStart  = formatTime(T.afternoon_closure_start);
  const acEnd    = formatTime(T.afternoon_closure_end);
  const fee      = displayFee(T.entry_fee);
  const tags     = parseTags(T.category_tags);
  const mapsUrl  = T.latitude ? `https://www.google.com/maps/search/?api=1&query=${T.latitude},${T.longitude}` : T.google_maps_link || null;

  const pujaServices = [
    ['puja_rudrabhishek','Rudrabhishek'],['puja_satyanarayan','Satyanarayan Katha'],
    ['puja_havan_homa','Havan / Homa'],['puja_laghu_rudra','Laghu Rudra'],
    ['puja_mahamrityunjaya','Mahamrityunjaya'],['puja_griha_pravesh','Griha Pravesh'],
    ['puja_naamkaran','Naamkaran'],['puja_vivah','Vivah Puja'],
    ['puja_annaprashan','Annaprashan'],['puja_mundan','Mundan'],
    ['puja_pitru_tarpan','Pitru Tarpan'],['puja_sahasranamarchana','Sahasranamarchana'],
  ].filter(([k]) => T[k]);

  const facilities = [
    ['facility_electricity','⚡ Electricity'],['facility_water_supply','💧 Water'],
    ['facility_clean_toilets','🚻 Toilets'],['facility_wheelchair','♿ Wheelchair Access'],
    ['facility_dharamshala','🏠 Dharamshala'],['facility_prasad_dining','🍱 Prasad Dining'],
    ['facility_parking','🅿️ Parking'],['facility_security','🔒 Security'],
    ['facility_cctv','📹 CCTV'],['facility_pa_system','🔊 PA System'],
    ['facility_internet_wifi','📶 WiFi'],['facility_library_pathshala','📚 Library'],
    ['facility_gaushaala','🐄 Gaushaala'],['facility_medical_support','🏥 Medical Support'],
  ].filter(([k]) => T[k]);

  const programs = [
    ['prog_free_food','🍱 Free Food (Annadanam)'],['prog_medical_camps','🏥 Medical Camps'],
    ['prog_scholarship_edu','📚 Scholarship & Education'],['prog_womens_selfhelp','👩 Women Self-Help'],
    ['prog_bhajan_kirtan','🎵 Bhajan & Kirtan'],['prog_disaster_relief','🆘 Disaster Relief'],
  ].filter(([k]) => T[k]);

  // Build nav dynamically based on what data exists
  const navItems = [
    { id:'overview',   label:'Overview',  show: true },
    { id:'history',    label:'History',   show: v(T.history)||v(T.significance)||v(T.puranic_stories) },
    { id:'puja',       label:'Puja',      show: pujaSchedule.length>0 || pujaServices.length>0 },
    { id:'mantras',    label:'Mantras',   show: mantras.length>0 },
    { id:'festivals',  label:'Festivals', show: festivals.length>0 },
    { id:'sevas',      label:'Sevas',     show: sevas.length>0 },
    { id:'facilities', label:'Facilities',show: facilities.length>0||programs.length>0 },
    { id:'priests',    label:'Priests',   show: priests.length>0 },
    { id:'contact',    label:'Contact',   show: true },
  ].filter(n => n.show);

  const scrollTo = (id) => {
    setActiveNav(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {/* ══ HERO ══ */}
      <div className="hero">
       {heroImg ? (
        <HeroImage src={heroImg} alt={T.name} />
        ) : <div className="hero-diya"></div>}
        <div className="hero-grad"/>
        <div className="hero-body">
          {/* Breadcrumb */}
          <div className="hero-bc">
            <a href="/">Home</a><sep>/</sep>
            <span>{T.state}</span><sep>/</sep>
            <span>{T.city}</span><sep>/</sep>
            <span>{T.name}</span>
          </div>

          {/* Classification badges */}
          <div className="badges">
            {T.is_jyotirlinga    && <span className="badge saffron">⚡ Jyotirlinga</span>}
            {T.is_shaktipeeth    && <span className="badge saffron">🌸 Shaktipeeth</span>}
            {T.is_char_dham      && <span className="badge saffron">🔱 Char Dham</span>}
            {T.is_ashtavinayak   && <span className="badge saffron">🐘 Ashtavinayak</span>}
            {T.is_divya_desam    && <span className="badge saffron">🪷 Divya Desam</span>}
            {T.is_pancha_bhuta   && <span className="badge saffron">🌊 Pancha Bhuta</span>}
            {T.is_51_shakti_peeths && <span className="badge saffron">51 Shakti Peeths</span>}
            {T.is_heritage_site  && <span className="badge blue">🏛️ Heritage</span>}
            {T.is_unesco_heritage&& <span className="badge blue">🌍 UNESCO</span>}
            {T.is_state_heritage && <span className="badge blue">⭐ State Heritage</span>}
            {T.is_asi_protected  && <span className="badge blue">🏺 ASI Protected</span>}
            {T.verified          && <span className="badge green">✓ Verified</span>}
            {v(T.sect)           && <span className="badge saffron">{T.sect}</span>}
          </div>

          <h1 className="hero-h1">{T.name}</h1>
          {v(T.name_hindi) && <div className="hero-hindi">{T.name_hindi}</div>}

          <div className="hero-meta">
            <span className="hero-meta-item">📍 {T.city}, {T.state}</span>
            {v(T.primary_deity) && <span className="hero-meta-item">🙏 {T.primary_deity}</span>}
            {openTime && <span className="hero-meta-item">🕐 {openTime} – {closeTime}</span>}
            {fee && <span className="hero-meta-item">{fee==='Free Entry'?'✅ Free Entry':fee}</span>}
            {v(T.setting_environment) && <span className="hero-meta-item">🌿 {T.setting_environment}</span>}
          </div>

        </div>
      </div>

      {/* ══ STICKY NAV ══ */}
      <div className="snav">
        {navItems.map(n => (
          <div key={n.id} className={`snav-item${activeNav===n.id?' on':''}`} onClick={()=>scrollTo(n.id)}>{n.label}</div>
        ))}
      </div>

      <div className="wrap">
        {/* ══════════ MAIN COLUMN ══════════ */}
        <div>
          {tags.length > 0 && (
            <div className="tags">{tags.map(t=><span key={t} className="tag">#{t}</span>)}</div>
          )}

          {/* ── OVERVIEW ── */}
          <div className="sec" id="overview">
            <div className="sec-h"><div className="sec-icon">🛕</div>Temple Information</div>

            {/* Timing strip */}
            {(openTime || fee || acStart) && (
              <div className="tstrip">
                {openTime  && <div className="tblock"><div className="tval">{openTime}</div><div className="tlbl">Opens</div></div>}
                {closeTime && <div className="tblock"><div className="tval">{closeTime}</div><div className="tlbl">Closes</div></div>}
                {acStart && acEnd && <div className="tblock"><div className="tval" style={{fontSize:15}}>{acStart}–{acEnd}</div><div className="tlbl">Afternoon Break</div></div>}
                {fee       && <div className="tblock"><div className="tval" style={{fontSize:18}}>{fee}</div><div className="tlbl">Entry</div></div>}
                {v(T.prasad_type) && <div className="tblock"><div className="tval" style={{fontFamily:"'DM Sans'",fontSize:13,fontWeight:600}}>{T.prasad_type}</div><div className="tlbl">Prasad</div></div>}
              </div>
            )}

            <div className="ig">
              <II label="Primary Deity"      value={T.primary_deity}         icon="🙏"/>
              <II label="Sect"               value={T.sect}/>
              <II label="Temple Type"        value={T.temple_type}/>
              <II label="Architecture"       value={T.architecture_style}/>
              <II label="Est. Year Built"    value={T.estimated_year_built}/>
              <II label="Founded By"         value={T.founded_by}/>
              <II label="Last Renovation"    value={T.last_renovation_year}/>
              <II label="Building Condition" value={T.building_condition}/>
              <II label="Managing Authority" value={T.managing_authority}/>
              <II label="Trust Name"         value={T.trust_name}/>
              <II label="Setting"            value={T.setting_environment}    icon="🌿"/>
              <II label="Local Landmark"     value={T.local_landmark}         icon="🏛️"/>
              <II label="Weekly Special Day" value={T.weekly_special_day}     icon="⭐"/>
              <II label="Dress Code"         value={T.dress_code}             icon="👗"/>
              {v(T.online_puja_available) && T.online_puja_available!=='no' && (
                <II label="Online Puja" value={T.online_puja_available==='yes'?'Available ✅':'Coming Soon 🔜'}/>
              )}
              <II label="Local Name"         value={T.name_local}/>
              <II label="Best Time to Visit" value={T.best_time_to_visit}     icon="📅" full/>
              <II label="Address"            value={T.address}                icon="📌" full/>
            </div>
          </div>

          {/* ── HISTORY & SIGNIFICANCE ── */}
          {(v(T.history)||v(T.significance)||v(T.sthala_purana)||v(T.puranic_stories)||v(T.history_hindi)) && (
            <div className="sec" id="history">
              <div className="sec-h"><div className="sec-icon">📜</div>History & Significance</div>

              {v(T.history) && <p className="prose">{T.history}</p>}

              {v(T.sthala_purana) && (
                <p className="prose prose-sm" style={{fontStyle:'italic',marginBottom:14}}>{T.sthala_purana}</p>
              )}

              {v(T.puranic_stories) && (
                <div className="puranic">
                  <div className="puranic-lbl">📖 Puranic Story</div>
                  <p className="prose-sm" style={{fontStyle:'italic'}}>{T.puranic_stories}</p>
                </div>
              )}

              {v(T.significance) && (
                <div className="significance">
                  <div className="sig-lbl">✨ Why Visit</div>
                  <p style={{fontSize:14,lineHeight:1.8,color:'var(--km)'}}>{T.significance}</p>
                </div>
              )}

              {v(T.history_hindi) && (
                <div className="hindi-block">
                  <div className="hindi-lbl">हिंदी में इतिहास</div>
                  <p style={{fontFamily:"'Noto Sans Devanagari',sans-serif",fontSize:14,lineHeight:1.9,color:'var(--km)'}}>{T.history_hindi}</p>
                </div>
              )}
            </div>
          )}

          {/* ── PUJA & SERVICES ── */}
          {(pujaSchedule.length>0 || pujaServices.length>0) && (
            <div className="sec" id="puja">
              <div className="sec-h"><div className="sec-icon">🕉️</div>Puja & Aarti</div>

              {pujaSchedule.length > 0 && (
                <>
                  <SLabel text="Daily Schedule"/>
                  {pujaSchedule.map((p,i)=>(
                    <div key={i} className="prow">
                      <div><span className="pname">{p.puja_name}</span>{p.puja_type&&<span style={{fontSize:11,color:'var(--kl)',marginLeft:8}}>{p.puja_type}</span>}</div>
                      <span className="ptime">{formatTime(p.puja_time)}</span>
                    </div>
                  ))}
                  {pujaServices.length>0 && <div style={{height:16}}/>}
                </>
              )}

              {pujaServices.length > 0 && (
                <>
                  <SLabel text="Available Puja Services"/>
                  <div className="chip-grid">
                    {pujaServices.map(([,name])=>(
                      <div key={name} className="chip chip-saffron"><div className="dot"/>{name}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── MANTRAS ── */}
          {mantras.length > 0 && (
            <div className="sec" id="mantras">
              <div className="sec-h"><div className="sec-icon">🕉️</div>Mantras</div>
              {mantras.map(m=>(
                <div key={m.id} className="mantra">
                  <div className="m-title">{m.title}{m.mantra_type&&<span style={{opacity:.4,fontWeight:400,marginLeft:8,fontSize:11}}>· {m.mantra_type}</span>}</div>
                  {m.sanskrit        && <div className="m-sk">{m.sanskrit}</div>}
                  {m.transliteration && <div className="m-ro">{m.transliteration}</div>}
                  {m.meaning         && <div className="m-mn">{m.meaning}</div>}
                </div>
              ))}
            </div>
          )}

          {/* ── FESTIVALS ── */}
          {festivals.length > 0 && (
            <div className="sec" id="festivals">
              <div className="sec-h"><div className="sec-icon">🎉</div>Annual Festivals</div>
              {festivals.map((f,i)=>(
                <div key={i} className="fest">
                  <div className="fest-mo">{f.month?MONTHS[f.month]:'—'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,color:'var(--k)'}}>
                      {f.name}{f.is_major&&<span className="major">★ Major</span>}
                    </div>
                    {f.hindu_month&&<div style={{fontSize:11,color:'var(--s)',marginTop:2}}>{f.hindu_month} Month</div>}
                    {f.duration_days&&<div style={{fontSize:11,color:'var(--kl)',marginTop:2}}>{f.duration_days} day{f.duration_days>1?'s':''}</div>}
                    {f.description&&<p style={{fontSize:13,color:'var(--kl)',lineHeight:1.6,marginTop:6}}>{f.description}</p>}
                    {f.significance&&<p style={{fontSize:12,color:'var(--kl)',lineHeight:1.5,marginTop:4,fontStyle:'italic'}}>{f.significance}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SEVAS ── */}
          {sevas.length > 0 && (
            <div className="sec" id="sevas">
              <div className="sec-h"><div className="sec-icon">🙏</div>Sevas & Offerings</div>
              {sevas.map(s=>(
                <div key={s.id} className="seva">
                  <div>
                    <div style={{fontSize:14,fontWeight:500,color:'var(--k)'}}>{s.name}</div>
                    {s.description&&<div style={{fontSize:12,color:'var(--kl)',marginTop:2}}>{s.description}</div>}
                    {s.timing&&<div style={{fontSize:11,color:'var(--kl)',marginTop:3}}>⏰ {s.timing}</div>}
                    {s.advance_booking&&<div style={{fontSize:11,color:'var(--s)',marginTop:3,fontWeight:600}}>📅 Advance booking required</div>}
                  </div>
                  <div className="seva-price">{s.is_free?'✅ Free':s.price?`₹${s.price}`:'—'}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── FACILITIES & PROGRAMS ── */}
          {(facilities.length>0 || programs.length>0) && (
            <div className="sec" id="facilities">
              <div className="sec-h"><div className="sec-icon">🏗️</div>Facilities & Programs</div>
              {facilities.length>0&&(
                <>
                  <SLabel text="Available Facilities"/>
                  <div className="chip-grid">
                    {facilities.map(([,name])=><div key={name} className="chip chip-green"><span>✓</span>{name}</div>)}
                  </div>
                </>
              )}
              {programs.length>0&&(
                <>
                  <div style={{height:14}}/>
                  <SLabel text="Community Programs"/>
                  <div className="chip-grid">
                    {programs.map(([,name])=><div key={name} className="chip chip-blue">{name}</div>)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PRIESTS ── */}
          {priests.length > 0 && (
            <div className="sec" id="priests">
              <div className="sec-h"><div className="sec-icon">🧘</div>Head Priests & Staff</div>
              {priests.map(p=>(
                <div key={p.id} className="priest">
                  <div className="priest-name">{p.full_name}{p.is_head_priest&&<span className="priest-head">Head Priest</span>}</div>
                  {p.title_designation&&<div className="priest-d">🪷 {p.title_designation}</div>}
                  {p.sampradaya      &&<div className="priest-d">📿 Sampradaya: {p.sampradaya}</div>}
                  {p.years_of_service&&<div className="priest-d">⏳ Serving {p.years_of_service} years</div>}
                  {p.languages_known &&<div className="priest-d">🗣️ Languages: {p.languages_known}</div>}
                  {p.qualification   &&<div className="priest-d">🎓 {p.qualification}</div>}
                  {p.appointment_type&&<div className="priest-d">📋 {p.appointment_type}</div>}
                </div>
              ))}
            </div>
          )}

          {/* ── CONTACT ── */}
          <div className="sec" id="contact">
            <div className="sec-h"><div className="sec-icon">📞</div>Contact & Connect</div>
            {v(T.phone)           &&<div className="crow"><div className="clbl">Phone</div><a href={`tel:${T.phone}`} className="clink">📞 {T.phone}</a></div>}
            {v(T.whatsapp_number) &&<div className="crow"><div className="clbl">WhatsApp</div><a href={`https://wa.me/${T.whatsapp_number.replace(/\D/g,'')}`} className="clink" target="_blank" rel="noopener noreferrer">💬 Chat on WhatsApp →</a></div>}
            {v(T.official_email)  &&<div className="crow"><div className="clbl">Email</div><a href={`mailto:${T.official_email}`} className="clink">✉️ {T.official_email}</a></div>}
            {v(T.website_url)     &&<div className="crow"><div className="clbl">Website</div><a href={T.website_url} target="_blank" rel="noopener noreferrer" className="clink">🌐 Visit Official Website →</a></div>}
            {v(T.best_time_to_call)&&<div className="crow"><div className="clbl">Best Time to Call</div><div className="cval">⏰ {T.best_time_to_call}</div></div>}
            {v(T.trust_registration_no)&&<div className="crow"><div className="clbl">Registration No.</div><div className="cval">{T.trust_registration_no}</div></div>}


            
          </div>
        </div>

        {/* ══════════ SIDEBAR ══════════ */}
        <div className="stick">

          {/* Today's schedule */}
          {pujaSchedule.length > 0 && (
            <div className="card">
              <div className="card-h">⏰ Today's Schedule</div>
              {pujaSchedule.slice(0,7).map((p,i)=>(
                <div key={i} className="prow">
                  <span className="pname">{p.puja_name}</span>
                  <span className="ptime">{formatTime(p.puja_time)}</span>
                </div>
              ))}
              {T.live_darshan_available==='yes' && v(T.live_stream_url) && (
                <a href={T.live_stream_url} target="_blank" rel="noopener noreferrer" className="abtn red">🔴 Watch Live Aarti</a>
              )}
            </div>
          )}

          {/* Quick facts */}
          <div className="card">
            <div className="card-h">📊 Quick Facts</div>
            <div className="sg">
              <div className="stat"><span className="sv">{T.city}</span><span className="sl2">City</span></div>
              <div className="stat"><span className="sv">{T.state}</span><span className="sl2">State</span></div>
              {v(T.primary_deity)&&<div className="stat" style={{gridColumn:'1/-1'}}><span className="sv" style={{fontSize:13}}>{T.primary_deity}</span><span className="sl2">Deity</span></div>}
              {openTime&&<div className="stat"><span className="sv">{openTime}</span><span className="sl2">Opens</span></div>}
              {closeTime&&<div className="stat"><span className="sv">{closeTime}</span><span className="sl2">Closes</span></div>}
              {fee&&<div className="stat" style={{gridColumn:'1/-1'}}><span className="sv" style={{fontSize:16}}>{fee}</span><span className="sl2">Entry Fee</span></div>}
              {v(T.estimated_year_built)&&<div className="stat" style={{gridColumn:'1/-1'}}><span className="sv" style={{fontSize:12}}>{T.estimated_year_built}</span><span className="sl2">Established</span></div>}
              {v(T.architecture_style)&&<div className="stat" style={{gridColumn:'1/-1'}}><span className="sv" style={{fontSize:12}}>{T.architecture_style}</span><span className="sl2">Architecture</span></div>}
            </div>
          </div>

          {/* Donations */}
          {T.accept_online_donations && (
            <div className="card">
              <div className="card-h">💰 Support This Temple</div>
              <p style={{fontSize:12,color:'var(--kl)',marginBottom:10}}>Your donation maintains this sacred space</p>
              <div className="dc">
                {T.donation_temple_renovation&&<div className="cause"><div className="cause-i">🛕</div><div className="cause-n">Renovation</div></div>}
                {T.donation_annadanam        &&<div className="cause"><div className="cause-i">🍱</div><div className="cause-n">Annadanam</div></div>}
                {T.donation_priest_salary    &&<div className="cause"><div className="cause-i">🧘</div><div className="cause-n">Priest Salary</div></div>}
                {T.donation_vedic_education  &&<div className="cause"><div className="cause-i">📚</div><div className="cause-n">Vedic Edu</div></div>}
                {T.donation_festival         &&<div className="cause"><div className="cause-i">🎉</div><div className="cause-n">Festivals</div></div>}
                {T.donation_medical_camps    &&<div className="cause"><div className="cause-i">🏥</div><div className="cause-n">Medical</div></div>}
                {T.donation_general          &&<div className="cause"><div className="cause-i">🙏</div><div className="cause-n">General</div></div>}
              </div>
              {v(T.upi_id)&&(
                <>
                  <p style={{fontSize:11,textAlign:'center',color:'var(--kl)',margin:'8px 0 4px'}}>UPI: <strong>{T.upi_id}</strong></p>
                  <button className="abtn" onClick={()=>window.open(`upi://pay?pa=${T.upi_id}`)}>💳 Donate via UPI</button>
                </>
              )}
              {v(T.certificate_80g_no)&&<p style={{fontSize:11,color:'var(--ok)',marginTop:8,textAlign:'center'}}>80G Exempt: {T.certificate_80g_no}</p>}
            </div>
          )}

          {/* Location */}
          <div className="card">
            <div className="card-h">📍 How to Reach</div>
            <div className="map-ph">🛕</div>
            {v(T.nearest_railway)  &&<div className="map-row"><span>🚂</span>{T.nearest_railway}</div>}
            {v(T.nearest_airport)  &&<div className="map-row"><span>✈️</span>{T.nearest_airport}</div>}
            {v(T.nearest_bus_stand)&&<div className="map-row"><span>🚌</span>{T.nearest_bus_stand}</div>}
            {v(T.local_landmark)   &&<div className="map-row"><span>🏛️</span>Near: {T.local_landmark}</div>}
            {v(T.address)          &&<div className="map-row"><span>📌</span>{T.address}</div>}
            {v(T.pincode)          &&<div className="map-row"><span>📮</span>PIN: {T.pincode}</div>}
            {mapsUrl&&<a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="abtn">🗺️ Open in Google Maps</a>}
          </div>

          {/* Verified */}
          <div className="card">
            <div className="verified">
              <span style={{fontSize:24}}>✅</span>
              <div>
                <div className="vtext">Verified on BharatMandir</div>
                <div style={{fontSize:10,color:'var(--ok)',opacity:.7,marginTop:2}}>
                  {v(T.mkt_id)?`ID: ${T.mkt_id}`:'Details reviewed & approved'}
                </div>
              </div>
            </div>
            {v(T.managing_authority)&&<div style={{fontSize:12,color:'var(--kl)',marginTop:10,padding:'8px 10px',background:'var(--p)',borderRadius:8}}>🏛️ {T.managing_authority}</div>}
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}