import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemple } from '../hooks/useTranslatedData';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function proxyImageUrl(url) {
  if (!url) return null;
  if (!url.startsWith('http')) return `${API_BASE}${url}`;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return url;
  return `${API_BASE}/api/proxy/image?url=${encodeURIComponent(url)}`;
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
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

:root {
  --s:#D4570A; --s2:#E8720F; --sl:#FFF4EB;
  --g:#B8860B; --gl:#FDF3DC;
  --k:#1A0F06; --km:#4A3020; --kl:#8A6A50;
  --c:#FDFAF4; --p:#F5EDD8; --p2:#EDE0C4;
  --b:#E0CFA8; --b2:#EDD9B0;
  --ok:#1A6B3A; --okbg:#E8F5EE;
  --sh:0 2px 20px rgba(100,50,10,.08);
  --r:14px;
}
*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{font-family:'DM Sans',sans-serif;background:var(--c);color:var(--k);-webkit-font-smoothing:antialiased;}

@keyframes spin{to{transform:rotate(360deg)}}
@keyframes up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes diya{0%,100%{filter:drop-shadow(0 0 16px rgba(255,150,50,.5))}50%{filter:drop-shadow(0 0 32px rgba(255,200,80,.9))}}

/* HERO */
.hero{position:relative;height:88vh;min-height:500px;max-height:720px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;background:#0D0500;}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .8s;}
.hero-grad{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,5,0,.1) 0%,rgba(10,5,0,0) 30%,rgba(10,5,0,.65) 65%,rgba(10,5,0,.97) 100%);pointer-events:none;}
.hero-diya{position:absolute;top:22%;left:50%;transform:translateX(-50%);font-size:56px;animation:diya 3s ease-in-out infinite;z-index:2;}
.hero-body{position:relative;z-index:3;padding:0 52px 60px;max-width:900px;animation:up .7s ease .1s both;}
.hero-bc{display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;flex-wrap:wrap;}
.hero-bc a{color:inherit;text-decoration:none;}.hero-bc a:hover{color:rgba(255,255,255,.75);}
.hero-bc sep{color:rgba(255,255,255,.2);}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
.badge{padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;}
.badge.saffron{background:rgba(212,87,10,.85);color:rgba(255,230,170,.95);border:1px solid rgba(255,180,80,.25);}
.badge.green{background:rgba(26,107,58,.85);color:rgba(160,240,180,.95);}
.badge.blue{background:rgba(20,80,160,.85);color:rgba(180,210,255,.95);}
.hero-h1{font-family:'Playfair Display',serif;font-size:clamp(28px,5.5vw,66px);font-weight:900;color:#fff;line-height:1.06;margin-bottom:6px;}
.hero-hindi{font-family:'Noto Sans Devanagari',sans-serif;font-size:18px;color:rgba(255,195,110,.7);margin-bottom:18px;}
.hero-meta{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:24px;}
.hero-meta-item{font-size:13px;color:rgba(255,255,255,.62);display:flex;align-items:center;gap:5px;}
.hero-acts{display:flex;gap:10px;flex-wrap:wrap;}
.btn{padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:all .2s;border:none;}
.btn-fill{background:var(--s);color:#fff;box-shadow:0 4px 18px rgba(212,87,10,.4);}.btn-fill:hover{background:#B84D00;transform:translateY(-1px);}
.btn-ghost{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.3);}.btn-ghost:hover{background:rgba(255,255,255,.2);}
.btn-red{background:linear-gradient(135deg,#c0392b,#e74c3c);color:#fff;}

/* STICKY NAV */
.snav{position:sticky;top:0;z-index:50;background:rgba(253,250,244,.96);backdrop-filter:blur(20px);border-bottom:1px solid var(--b);display:flex;padding:0 48px;box-shadow:var(--sh);overflow-x:auto;scrollbar-width:none;}
.snav::-webkit-scrollbar{display:none;}
.snav-item{padding:14px 16px;font-size:13px;font-weight:500;color:var(--kl);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:.15s;flex-shrink:0;}
.snav-item:hover{color:var(--km);}
.snav-item.on{color:var(--s);border-bottom-color:var(--s);}

/* LAYOUT */
.wrap{max-width:1200px;margin:0 auto;padding:32px 48px 80px;display:grid;grid-template-columns:1fr 300px;gap:28px;align-items:start;}
.stick{position:sticky;top:56px;display:flex;flex-direction:column;gap:14px;}

/* SECTION */
.sec{background:#fff;border-radius:var(--r);padding:26px 28px;margin-bottom:22px;box-shadow:var(--sh);animation:up .5s ease both;}
.sec-h{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--k);margin-bottom:18px;display:flex;align-items:center;gap:10px;}
.sec-icon{width:36px;height:36px;border-radius:10px;background:var(--sl);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}

/* INFO GRID */
.ig{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ii{background:var(--p);border-radius:10px;padding:12px 14px;transition:.2s;}.ii:hover{background:var(--p2);}
.ii.full{grid-column:1/-1;}
.il{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--kl);margin-bottom:5px;font-weight:600;}
.iv{font-size:14px;font-weight:500;color:var(--k);line-height:1.4;}

/* TIMING STRIP */
.tstrip{display:flex;gap:12px;flex-wrap:wrap;padding:16px;background:linear-gradient(135deg,var(--p),var(--p2));border-radius:12px;margin-bottom:18px;}
.tblock{flex:1;min-width:90px;text-align:center;}
.tval{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--s);}
.tlbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--kl);margin-top:2px;}

/* PROSE */
.prose{font-size:15px;line-height:1.9;color:var(--km);margin-bottom:14px;}
.prose-sm{font-size:13px;line-height:1.8;color:var(--kl);}
.significance{background:var(--sl);border-left:4px solid var(--s);border-radius:0 10px 10px 0;padding:16px 18px;margin-top:14px;}
.sig-lbl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--s);font-weight:700;margin-bottom:8px;}
.puranic{background:var(--gl);border:1px solid rgba(184,134,11,.2);border-radius:10px;padding:16px 18px;margin-top:14px;}
.puranic-lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--g);font-weight:700;margin-bottom:8px;}
.hindi-block{margin-top:14px;padding:14px 16px;background:var(--p);border-radius:10px;}
.hindi-lbl{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--kl);margin-bottom:8px;font-weight:600;}

/* CHIPS */
.chip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:6px;}
.chip{padding:8px 12px;border-radius:8px;font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px;}
.chip-saffron{background:var(--p);color:var(--km);}.chip-saffron .dot{width:7px;height:7px;border-radius:50%;background:var(--s);flex-shrink:0;}
.chip-green{background:var(--okbg);color:var(--ok);}
.chip-blue{background:#EBF5FB;color:#1A5276;}

/* PUJA SCHEDULE */
.prow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b2);}
.prow:last-child{border-bottom:none;}
.pname{font-size:13px;font-weight:500;color:var(--km);}
.ptime{font-size:13px;font-weight:700;color:var(--s);}

/* FESTIVALS */
.fest{display:flex;gap:14px;padding:16px 0;border-bottom:1px solid var(--b2);}
.fest:last-child{border-bottom:none;}
.fest-mo{flex-shrink:0;width:50px;height:50px;background:var(--s);border-radius:12px;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.major{font-size:10px;background:rgba(212,87,10,.1);color:var(--s);padding:2px 8px;border-radius:50px;margin-left:8px;font-weight:600;}

/* SEVAS */
.seva{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--p);border-radius:10px;margin-bottom:8px;border:1px solid var(--b);transition:.2s;}
.seva:hover{background:var(--p2);}
.seva-price{font-size:16px;font-weight:700;color:var(--s);white-space:nowrap;margin-left:12px;}

/* MANTRAS */
.mantra{background:linear-gradient(135deg,rgba(45,18,0,.97),rgba(90,45,10,.95));border-radius:14px;padding:22px;margin-bottom:12px;color:#fff;position:relative;overflow:hidden;}
.mantra::before{content:'ॐ';position:absolute;right:-8px;bottom:-8px;font-family:'Noto Sans Devanagari',sans-serif;font-size:100px;color:rgba(255,255,255,.04);user-select:none;}
.m-title{font-size:13px;color:rgba(255,210,80,.8);margin-bottom:10px;font-weight:600;}
.m-sk{font-family:'Noto Sans Devanagari',sans-serif;font-size:20px;line-height:1.8;margin-bottom:8px;}
.m-ro{font-size:13px;color:rgba(255,255,255,.55);font-style:italic;line-height:1.7;margin-bottom:8px;}
.m-mn{font-size:12px;color:rgba(255,255,255,.42);border-top:1px solid rgba(255,255,255,.1);padding-top:8px;line-height:1.6;}

/* PRIESTS */
.priest{padding:14px 0;border-bottom:1px solid var(--b2);}.priest:last-child{border-bottom:none;}
.priest-name{font-size:15px;font-weight:600;color:var(--k);}
.priest-head{font-size:10px;background:var(--sl);color:var(--s);padding:2px 8px;border-radius:50px;margin-left:8px;font-weight:600;}
.priest-d{font-size:12px;color:var(--kl);margin-top:3px;}

/* CONTACT */
.crow{padding:8px 0;border-bottom:1px solid var(--b2);display:flex;flex-direction:column;gap:3px;}.crow:last-child{border-bottom:none;}
.clbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--kl);font-weight:600;}
.cval{font-size:13px;font-weight:500;color:var(--k);}
.clink{font-size:13px;color:var(--s);text-decoration:none;}.clink:hover{text-decoration:underline;}
.social-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
.soc-btn{flex:1;min-width:80px;padding:8px;border-radius:8px;text-align:center;font-size:12px;font-weight:500;text-decoration:none;border:1.5px solid var(--b);color:var(--km);background:#fff;transition:.2s;display:flex;align-items:center;justify-content:center;gap:4px;}
.soc-btn:hover{border-color:var(--s);color:var(--s);}

/* TAGS */
.tags{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0 20px;}
.tag{background:#fff;border:1px solid var(--b);border-radius:50px;padding:4px 12px;font-size:12px;color:var(--kl);}

/* CARD (sidebar) */
.card{background:#fff;border-radius:var(--r);padding:20px;box-shadow:var(--sh);}
.card-h{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--k);margin-bottom:14px;}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.stat{text-align:center;padding:10px 8px;background:var(--p2);border-radius:8px;}
.sv{display:block;font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:var(--s);word-break:break-word;line-height:1.2;}
.sl2{display:block;font-size:10px;color:var(--kl);margin-top:3px;text-transform:uppercase;letter-spacing:.06em;}
.map-ph{width:100%;height:110px;background:var(--p2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:12px;}
.map-row{font-size:12px;color:var(--kl);padding:5px 0;display:flex;align-items:flex-start;gap:6px;line-height:1.4;}
.dc{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;}
.cause{text-align:center;padding:10px 6px;background:var(--p2);border-radius:8px;}
.cause-i{font-size:20px;margin-bottom:3px;}
.cause-n{font-size:11px;font-weight:500;color:var(--km);}
.abtn{width:100%;padding:10px 14px;background:var(--s);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;margin-top:8px;}
.abtn:hover{background:#B84D00;}
.abtn.out{background:#fff;color:var(--s);border:1.5px solid var(--b2);}.abtn.out:hover{background:var(--p);}
.abtn.red{background:linear-gradient(135deg,#c0392b,#e74c3c);}
.verified{display:flex;align-items:center;gap:10px;padding:12px;background:var(--okbg);border-radius:10px;}
.vtext{font-size:12px;font-weight:600;color:var(--ok);}

/* LOADING */
.loading{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
.spinner{width:44px;height:44px;border:3px solid var(--p2);border-top-color:var(--s);border-radius:50%;animation:spin .8s linear infinite;}
.err{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;}

@media(max-width:1024px){.wrap{grid-template-columns:1fr;padding:20px 20px 60px;}.stick{position:static;}.snav,.hero-body{padding-left:20px;padding-right:20px;}}
@media(max-width:640px){.hero{height:auto;min-height:400px;}.heimport { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemple } from '../hooks/useTranslatedData';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function proxyImageUrl(url) {
  if (!url) return null;
  if (!url.startsWith('http')) return `${API_BASE}${url}`;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return url;
  return `${API_BASE}/api/proxy/image?url=${encodeURIComponent(url)}`;
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
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

:root {
  --s:#D4570A; --s2:#E8720F; --sl:#FFF4EB;
  --g:#B8860B; --gl:#FDF3DC;
  --k:#1A0F06; --km:#4A3020; --kl:#8A6A50;
  --c:#FDFAF4; --p:#F5EDD8; --p2:#EDE0C4;
  --b:#E0CFA8; --b2:#EDD9B0;
  --ok:#1A6B3A; --okbg:#E8F5EE;
  --sh:0 2px 20px rgba(100,50,10,.08);
  --r:14px;
}
*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{font-family:'DM Sans',sans-serif;background:var(--c);color:var(--k);-webkit-font-smoothing:antialiased;}

@keyframes spin{to{transform:rotate(360deg)}}
@keyframes up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes diya{0%,100%{filter:drop-shadow(0 0 16px rgba(255,150,50,.5))}50%{filter:drop-shadow(0 0 32px rgba(255,200,80,.9))}}

/* HERO */
.hero{position:relative;height:88vh;min-height:500px;max-height:720px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;background:#0D0500;}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .8s;}
.hero-grad{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,5,0,.1) 0%,rgba(10,5,0,0) 30%,rgba(10,5,0,.65) 65%,rgba(10,5,0,.97) 100%);pointer-events:none;}
.hero-diya{position:absolute;top:22%;left:50%;transform:translateX(-50%);font-size:56px;animation:diya 3s ease-in-out infinite;z-index:2;}
.hero-body{position:relative;z-index:3;padding:0 52px 60px;max-width:900px;animation:up .7s ease .1s both;}
.hero-bc{display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;flex-wrap:wrap;}
.hero-bc a{color:inherit;text-decoration:none;}.hero-bc a:hover{color:rgba(255,255,255,.75);}
.hero-bc sep{color:rgba(255,255,255,.2);}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
.badge{padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;}
.badge.saffron{background:rgba(212,87,10,.85);color:rgba(255,230,170,.95);border:1px solid rgba(255,180,80,.25);}
.badge.green{background:rgba(26,107,58,.85);color:rgba(160,240,180,.95);}
.badge.blue{background:rgba(20,80,160,.85);color:rgba(180,210,255,.95);}
.hero-h1{font-family:'Playfair Display',serif;font-size:clamp(28px,5.5vw,66px);font-weight:900;color:#fff;line-height:1.06;margin-bottom:6px;}
.hero-hindi{font-family:'Noto Sans Devanagari',sans-serif;font-size:18px;color:rgba(255,195,110,.7);margin-bottom:18px;}
.hero-meta{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:24px;}
.hero-meta-item{font-size:13px;color:rgba(255,255,255,.62);display:flex;align-items:center;gap:5px;}
.hero-acts{display:flex;gap:10px;flex-wrap:wrap;}
.btn{padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:all .2s;border:none;}
.btn-fill{background:var(--s);color:#fff;box-shadow:0 4px 18px rgba(212,87,10,.4);}.btn-fill:hover{background:#B84D00;transform:translateY(-1px);}
.btn-ghost{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.3);}.btn-ghost:hover{background:rgba(255,255,255,.2);}
.btn-red{background:linear-gradient(135deg,#c0392b,#e74c3c);color:#fff;}

/* STICKY NAV */
.snav{position:sticky;top:0;z-index:50;background:rgba(253,250,244,.96);backdrop-filter:blur(20px);border-bottom:1px solid var(--b);display:flex;padding:0 48px;box-shadow:var(--sh);overflow-x:auto;scrollbar-width:none;}
.snav::-webkit-scrollbar{display:none;}
.snav-item{padding:14px 16px;font-size:13px;font-weight:500;color:var(--kl);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:.15s;flex-shrink:0;}
.snav-item:hover{color:var(--km);}
.snav-item.on{color:var(--s);border-bottom-color:var(--s);}

/* LAYOUT */
.wrap{max-width:1200px;margin:0 auto;padding:32px 48px 80px;display:grid;grid-template-columns:1fr 300px;gap:28px;align-items:start;}
.stick{position:sticky;top:56px;display:flex;flex-direction:column;gap:14px;}

/* SECTION */
.sec{background:#fff;border-radius:var(--r);padding:26px 28px;margin-bottom:22px;box-shadow:var(--sh);animation:up .5s ease both;}
.sec-h{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--k);margin-bottom:18px;display:flex;align-items:center;gap:10px;}
.sec-icon{width:36px;height:36px;border-radius:10px;background:var(--sl);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}

/* INFO GRID */
.ig{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ii{background:var(--p);border-radius:10px;padding:12px 14px;transition:.2s;}.ii:hover{background:var(--p2);}
.ii.full{grid-column:1/-1;}
.il{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--kl);margin-bottom:5px;font-weight:600;}
.iv{font-size:14px;font-weight:500;color:var(--k);line-height:1.4;}

/* TIMING STRIP */
.tstrip{display:flex;gap:12px;flex-wrap:wrap;padding:16px;background:linear-gradient(135deg,var(--p),var(--p2));border-radius:12px;margin-bottom:18px;}
.tblock{flex:1;min-width:90px;text-align:center;}
.tval{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--s);}
.tlbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--kl);margin-top:2px;}

/* PROSE */
.prose{font-size:15px;line-height:1.9;color:var(--km);margin-bottom:14px;}
.prose-sm{font-size:13px;line-height:1.8;color:var(--kl);}
.significance{background:var(--sl);border-left:4px solid var(--s);border-radius:0 10px 10px 0;padding:16px 18px;margin-top:14px;}
.sig-lbl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--s);font-weight:700;margin-bottom:8px;}
.puranic{background:var(--gl);border:1px solid rgba(184,134,11,.2);border-radius:10px;padding:16px 18px;margin-top:14px;}
.puranic-lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--g);font-weight:700;margin-bottom:8px;}
.hindi-block{margin-top:14px;padding:14px 16px;background:var(--p);border-radius:10px;}
.hindi-lbl{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--kl);margin-bottom:8px;font-weight:600;}

/* CHIPS */
.chip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:6px;}
.chip{padding:8px 12px;border-radius:8px;font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px;}
.chip-saffron{background:var(--p);color:var(--km);}.chip-saffron .dot{width:7px;height:7px;border-radius:50%;background:var(--s);flex-shrink:0;}
.chip-green{background:var(--okbg);color:var(--ok);}
.chip-blue{background:#EBF5FB;color:#1A5276;}

/* PUJA SCHEDULE */
.prow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b2);}
.prow:last-child{border-bottom:none;}
.pname{font-size:13px;font-weight:500;color:var(--km);}
.ptime{font-size:13px;font-weight:700;color:var(--s);}

/* FESTIVALS */
.fest{display:flex;gap:14px;padding:16px 0;border-bottom:1px solid var(--b2);}
.fest:last-child{border-bottom:none;}
.fest-mo{flex-shrink:0;width:50px;height:50px;background:var(--s);border-radius:12px;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.major{font-size:10px;background:rgba(212,87,10,.1);color:var(--s);padding:2px 8px;border-radius:50px;margin-left:8px;font-weight:600;}

/* SEVAS */
.seva{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--p);border-radius:10px;margin-bottom:8px;border:1px solid var(--b);transition:.2s;}
.seva:hover{background:var(--p2);}
.seva-price{font-size:16px;font-weight:700;color:var(--s);white-space:nowrap;margin-left:12px;}

/* MANTRAS */
.mantra{background:linear-gradient(135deg,rgba(45,18,0,.97),rgba(90,45,10,.95));border-radius:14px;padding:22px;margin-bottom:12px;color:#fff;position:relative;overflow:hidden;}
.mantra::before{content:'ॐ';position:absolute;right:-8px;bottom:-8px;font-family:'Noto Sans Devanagari',sans-serif;font-size:100px;color:rgba(255,255,255,.04);user-select:none;}
.m-title{font-size:13px;color:rgba(255,210,80,.8);margin-bottom:10px;font-weight:600;}
.m-sk{font-family:'Noto Sans Devanagari',sans-serif;font-size:20px;line-height:1.8;margin-bottom:8px;}
.m-ro{font-size:13px;color:rgba(255,255,255,.55);font-style:italic;line-height:1.7;margin-bottom:8px;}
.m-mn{font-size:12px;color:rgba(255,255,255,.42);border-top:1px solid rgba(255,255,255,.1);padding-top:8px;line-height:1.6;}

/* PRIESTS */
.priest{padding:14px 0;border-bottom:1px solid var(--b2);}.priest:last-child{border-bottom:none;}
.priest-name{font-size:15px;font-weight:600;color:var(--k);}
.priest-head{font-size:10px;background:var(--sl);color:var(--s);padding:2px 8px;border-radius:50px;margin-left:8px;font-weight:600;}
.priest-d{font-size:12px;color:var(--kl);margin-top:3px;}

/* CONTACT */
.crow{padding:8px 0;border-bottom:1px solid var(--b2);display:flex;flex-direction:column;gap:3px;}.crow:last-child{border-bottom:none;}
.clbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--kl);font-weight:600;}
.cval{font-size:13px;font-weight:500;color:var(--k);}
.clink{font-size:13px;color:var(--s);text-decoration:none;}.clink:hover{text-decoration:underline;}
.social-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
.soc-btn{flex:1;min-width:80px;padding:8px;border-radius:8px;text-align:center;font-size:12px;font-weight:500;text-decoration:none;border:1.5px solid var(--b);color:var(--km);background:#fff;transition:.2s;display:flex;align-items:center;justify-content:center;gap:4px;}
.soc-btn:hover{border-color:var(--s);color:var(--s);}

/* TAGS */
.tags{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0 20px;}
.tag{background:#fff;border:1px solid var(--b);border-radius:50px;padding:4px 12px;font-size:12px;color:var(--kl);}

/* CARD (sidebar) */
.card{background:#fff;border-radius:var(--r);padding:20px;box-shadow:var(--sh);}
.card-h{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--k);margin-bottom:14px;}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.stat{text-align:center;padding:10px 8px;background:var(--p2);border-radius:8px;}
.sv{display:block;font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:var(--s);word-break:break-word;line-height:1.2;}
.sl2{display:block;font-size:10px;color:var(--kl);margin-top:3px;text-transform:uppercase;letter-spacing:.06em;}
.map-ph{width:100%;height:110px;background:var(--p2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:12px;}
.map-row{font-size:12px;color:var(--kl);padding:5px 0;display:flex;align-items:flex-start;gap:6px;line-height:1.4;}
.dc{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;}
.cause{text-align:center;padding:10px 6px;background:var(--p2);border-radius:8px;}
.cause-i{font-size:20px;margin-bottom:3px;}
.cause-n{font-size:11px;font-weight:500;color:var(--km);}
.abtn{width:100%;padding:10px 14px;background:var(--s);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;margin-top:8px;}
.abtn:hover{background:#B84D00;}
.abtn.out{background:#fff;color:var(--s);border:1.5px solid var(--b2);}.abtn.out:hover{background:var(--p);}
.abtn.red{background:linear-gradient(135deg,#c0392b,#e74c3c);}
.verified{display:flex;align-items:center;gap:10px;padding:12px;background:var(--okbg);border-radius:10px;}
.vtext{font-size:12px;font-weight:600;color:var(--ok);}

/* LOADING */
.loading{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
.spinner{width:44px;height:44px;border:3px solid var(--p2);border-top-color:var(--s);border-radius:50%;animation:spin .8s linear infinite;}
.err{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;}

@media(max-width:1024px){.wrap{grid-template-columns:1fr;padding:20px 20px 60px;}.stick{position:static;}.snav,.hero-body{padding-left:20px;padding-right:20px;}}
@media(max-width:640px){.hero{height:auto;min-height:400px;}.hero-h1{font-size:28px;}.ig,.sg,.chip-grid,.dc{grid-template-columns:1fr 1fr;}.ii.full{grid-column:1/-1;}.wrap{padding:14px 14px 60px;}.sec{padding:18px 16px;}}
`;

// SmartImage with loading placeholder — shows diya on any error
function SmartImage({ src, alt }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  useEffect(() => { setStatus('loading'); }, [src]);
  if (status === 'error') return null; // fall through to diya in parent
  return (
    <div style={{ position:'absolute', inset:0 }}>
      {status === 'loading' && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Noto Sans Devanagari',sans-serif", fontSize:72, color:'rgba(255,255,255,.06)', background:'#0D0500' }}>ॐ</div>
      )}
      <img src={src} alt={alt} className="hero-img"
        style={{ opacity: status === 'ok' ? 1 : 0 }}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        referrerPolicy="no-referrer" />
    </div>
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
          <>
            <SmartImage src={heroImg} alt={T.name}/>
            {/* diya shows behind image; SmartImage returns null on error, revealing it */}
            <div className="hero-diya">🪔</div>
          </>
        ) : <div className="hero-diya">🪔</div>}
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

          <div className="hero-acts">
            {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-fill">🗺️ Get Directions</a>}
            {v(T.website_url) && <a href={T.website_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">🌐 Website</a>}
            {T.live_darshan_available==='yes' && v(T.live_stream_url) && (
              <a href={T.live_stream_url} target="_blank" rel="noopener noreferrer" className="btn btn-red">🔴 Live Darshan</a>
            )}
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

            {(v(T.facebook_page)||v(T.youtube_channel)||v(T.instagram_handle))&&(
              <>
                <div style={{fontSize:11,color:'var(--kl)',margin:'14px 0 8px',textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700}}>Social Media</div>
                <div className="social-row">
                  {v(T.facebook_page)   &&<a href={T.facebook_page} target="_blank" rel="noopener noreferrer" className="soc-btn">📘 Facebook</a>}
                  {v(T.youtube_channel) &&<a href={T.youtube_channel} target="_blank" rel="noopener noreferrer" className="soc-btn">📺 YouTube</a>}
                  {v(T.instagram_handle)&&<a href={`https://instagram.com/${T.instagram_handle.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="soc-btn">📸 Instagram</a>}
                </div>
              </>
            )}

            {(v(T.video_aarti_url)||v(T.video_intro_url)||v(T.video_360_url))&&(
              <>
                <div style={{fontSize:11,color:'var(--kl)',margin:'14px 0 8px',textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700}}>Videos</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {v(T.video_aarti_url)&&<a href={T.video_aarti_url} target="_blank" rel="noopener noreferrer" className="abtn red" style={{flex:1,minWidth:110,margin:0}}>🔴 Aarti Video</a>}
                  {v(T.video_intro_url)&&<a href={T.video_intro_url} target="_blank" rel="noopener noreferrer" className="abtn" style={{flex:1,minWidth:110,margin:0}}>▶️ Temple Tour</a>}
                  {v(T.video_360_url)  &&<a href={T.video_360_url}   target="_blank" rel="noopener noreferrer" className="abtn out" style={{flex:1,minWidth:110,margin:0}}>360° View</a>}
                </div>
              </>
            )}
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
}ro-h1{font-size:28px;}.ig,.sg,.chip-grid,.dc{grid-template-columns:1fr 1fr;}.ii.full{grid-column:1/-1;}.wrap{padding:14px 14px 60px;}.sec{padding:18px 16px;}}
`;

// SmartImage with loading placeholder — shows diya on any error
function SmartImage({ src, alt }) {
<<<<<<< HEAD
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(false), [src]);
=======
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  useEffect(() => { setStatus('loading'); }, [src]);
  if (status === 'error') return null; // fall through to diya in parent
>>>>>>> f3fdf22c5450d7c7030a5a8214ef4f8b86510ca9
  return (
    <div style={{ position:'absolute', inset:0 }}>
      {status === 'loading' && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Noto Sans Devanagari',sans-serif", fontSize:72, color:'rgba(255,255,255,.06)', background:'#0D0500' }}>ॐ</div>
      )}
      <img src={src} alt={alt} className="hero-img"
<<<<<<< HEAD
        style={{ opacity: ok ? 1 : 0 }}
        onLoad={() => setOk(true)} onError={() => setOk(false)} />
=======
        style={{ opacity: status === 'ok' ? 1 : 0 }}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        referrerPolicy="no-referrer" />
>>>>>>> f3fdf22c5450d7c7030a5a8214ef4f8b86510ca9
    </div>
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
          <>
            <SmartImage src={heroImg} alt={T.name}/>
            {/* diya shows behind image; SmartImage returns null on error, revealing it */}
            <div className="hero-diya">🪔</div>
          </>
        ) : <div className="hero-diya">🪔</div>}
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

          <div className="hero-acts">
            {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-fill">🗺️ Get Directions</a>}
            {v(T.website_url) && <a href={T.website_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">🌐 Website</a>}
            {T.live_darshan_available==='yes' && v(T.live_stream_url) && (
              <a href={T.live_stream_url} target="_blank" rel="noopener noreferrer" className="btn btn-red">🔴 Live Darshan</a>
            )}
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

            {(v(T.facebook_page)||v(T.youtube_channel)||v(T.instagram_handle))&&(
              <>
                <div style={{fontSize:11,color:'var(--kl)',margin:'14px 0 8px',textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700}}>Social Media</div>
                <div className="social-row">
                  {v(T.facebook_page)   &&<a href={T.facebook_page} target="_blank" rel="noopener noreferrer" className="soc-btn">📘 Facebook</a>}
                  {v(T.youtube_channel) &&<a href={T.youtube_channel} target="_blank" rel="noopener noreferrer" className="soc-btn">📺 YouTube</a>}
                  {v(T.instagram_handle)&&<a href={`https://instagram.com/${T.instagram_handle.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="soc-btn">📸 Instagram</a>}
                </div>
              </>
            )}

            {(v(T.video_aarti_url)||v(T.video_intro_url)||v(T.video_360_url))&&(
              <>
                <div style={{fontSize:11,color:'var(--kl)',margin:'14px 0 8px',textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700}}>Videos</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {v(T.video_aarti_url)&&<a href={T.video_aarti_url} target="_blank" rel="noopener noreferrer" className="abtn red" style={{flex:1,minWidth:110,margin:0}}>🔴 Aarti Video</a>}
                  {v(T.video_intro_url)&&<a href={T.video_intro_url} target="_blank" rel="noopener noreferrer" className="abtn" style={{flex:1,minWidth:110,margin:0}}>▶️ Temple Tour</a>}
                  {v(T.video_360_url)  &&<a href={T.video_360_url}   target="_blank" rel="noopener noreferrer" className="abtn out" style={{flex:1,minWidth:110,margin:0}}>360° View</a>}
                </div>
              </>
            )}
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