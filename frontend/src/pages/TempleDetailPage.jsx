import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemple } from '../hooks/useTranslatedData';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function proxyImageUrl(url) { return url || null; }
function imageUrlFromMedia(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.file_url || item.url || item.image_url || item.secure_url || null;
}
function buildGallery(temple) {
  const rows = Array.isArray(temple?.gallery) ? temple.gallery : [];
  const images = [];
  const seen = new Set();

  const pushImage = (item, fallbackId) => {
    const url = imageUrlFromMedia(item);
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({
      id: item?.id ?? fallbackId,
      file_url: url,
      caption: item?.caption || temple?.name || 'Temple image',
      is_hero: Boolean(item?.is_hero),
    });
  };

  if (temple?.hero_image_url) {
    pushImage({
      id: 'hero',
      file_url: temple.hero_image_url,
      caption: temple.name,
      is_hero: true,
    }, 'hero');
  }

  rows.forEach((item, index) => pushImage(item, `gallery-${index}`));
  return images;
}
function formatTime(t) {
  if (!t) return null;
  const p = String(t).split(':');
  if (p.length < 2) return String(t);
  let h = parseInt(p[0], 10);
  const m = p[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
function displayFee(fee, freeLabel) {
  if (fee == null || fee === '') return null;
  const n = Number(fee);
  return isNaN(n) ? null : n === 0 ? freeLabel : `₹${n}`;
}
function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  const s = String(tags).trim();
  if (s.startsWith('[')) { try { return JSON.parse(s).filter(Boolean); } catch (_) {} }
  return s.split(',').map(t => t.trim()).filter(Boolean);
}
function v(x) { return x && String(x).trim() !== '' && String(x) !== 'null' && String(x) !== 'false'; }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap');

*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{font-family:'DM Sans',system-ui,sans-serif;background:#FAF6EE;color:#1A0D00;-webkit-font-smoothing:antialiased;}

@keyframes spin{to{transform:rotate(360deg)}}
@keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes diya{0%,100%{filter:drop-shadow(0 0 14px rgba(255,140,40,.45))}50%{filter:drop-shadow(0 0 28px rgba(255,190,70,.85))}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

/* HERO */
.hero{position:relative;height:72vh;min-height:460px;max-height:640px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;background:#0D0500;transform:translateZ(0);isolation:isolate;}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;transition:opacity .8s;}
.hero-slide{opacity:0;transform:scale(1.02);transition:opacity .7s ease,transform 3.8s ease;}
.hero-slide.on{opacity:1;transform:scale(1);}
.hero-grad{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,5,0,.08) 0%,rgba(10,5,0,0) 25%,rgba(10,5,0,.55) 60%,rgba(10,5,0,.95) 100%);pointer-events:none;}
.hero-diya{position:absolute;top:24%;left:50%;transform:translateX(-50%);font-size:52px;animation:diya 3s ease-in-out infinite;z-index:2;}
.hero-body{position:relative;z-index:3;padding:0 52px 56px;width:100%;text-align:center;animation:up .6s ease .1s both;}
.hero-gallery-nav{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:4;display:flex;gap:8px;align-items:center;justify-content:center;max-width:min(720px,calc(100% - 32px));overflow-x:auto;padding:3px;scrollbar-width:none;}
.hero-gallery-nav::-webkit-scrollbar{display:none;}
.hero-dot{width:38px;height:26px;border:1.5px solid rgba(255,255,255,.38);border-radius:7px;padding:0;background:rgba(255,255,255,.12);overflow:hidden;cursor:pointer;opacity:.68;transition:opacity .18s,border-color .18s,transform .18s;flex:0 0 auto;}
.hero-dot img{width:100%;height:100%;object-fit:cover;display:block;}
.hero-dot:hover,.hero-dot.on{opacity:1;border-color:#FFD580;transform:translateY(-1px);}

.hero-bc{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.09em;margin-bottom:12px;flex-wrap:wrap;font-family:'DM Sans',sans-serif;font-weight:500;}
.hero-bc a{color:inherit;text-decoration:none;transition:color .2s;}.hero-bc a:hover{color:rgba(255,255,255,.75);}
.hero-bc sep{color:rgba(255,255,255,.2);}

.badges{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px;justify-content:center;}
.badge{padding:4px 13px;border-radius:50px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-family:'DM Sans',sans-serif;}
.badge.saffron{background:rgba(200,82,10,.82);color:rgba(255,225,160,.95);}
.badge.green{background:rgba(26,107,58,.82);color:rgba(150,240,170,.95);}
.badge.blue{background:rgba(20,80,160,.82);color:rgba(170,205,255,.95);}

.hero-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(28px,5.2vw,62px);font-weight:700;color:#fff;line-height:1.1;margin-bottom:10px;letter-spacing:-.01em;}
.hero-hindi{font-family:'Noto Sans Devanagari',sans-serif;font-size:clamp(28px,5.2vw,62px);font-weight:600;color:rgba(255,190,100,.85);line-height:1.2;margin-bottom:18px;}
.hero-address{font-size:14px;color:rgba(255,255,255,.65);display:flex;align-items:center;justify-content:center;gap:6px;font-family:'DM Sans',sans-serif;flex-wrap:wrap;}

/* STICKY NAV */
.snav{position:sticky;top:0;z-index:50;background:rgba(250,246,238,.97);backdrop-filter:blur(16px);border-bottom:1px solid #EDE3CE;display:flex;justify-content:center;padding:0 52px;box-shadow:0 2px 10px rgba(44,21,0,.07);overflow-x:auto;scrollbar-width:none;}
.snav::-webkit-scrollbar{display:none;}
.snav-item{padding:14px 16px;font-size:13px;font-weight:500;color:#7A5538;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:.15s;flex-shrink:0;font-family:'DM Sans',sans-serif;}
.snav-item:hover{color:#4A2C10;}
.snav-item.on{color:#C8520A;border-bottom-color:#C8520A;font-weight:600;}

/* SINGLE COLUMN LAYOUT */
.wrap{max-width:860px;margin:0 auto;padding:32px 44px 80px;}

/* SECTION CARDS */
.sec{background:#fff;border-radius:16px;padding:26px 28px;margin-bottom:20px;box-shadow:0 2px 12px rgba(44,21,0,.07);border:1px solid #EDE3CE;animation:up .5s ease both;}
.sec-h{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#2C1500;margin-bottom:17px;display:flex;align-items:center;gap:10px;letter-spacing:.01em;}
.sec-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#E06B25,#9A3C05);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}

/* INFO GRID */
.ig{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
.ii{background:#F7F0E2;border-radius:9px;padding:12px 14px;border:1px solid #EDE3CE;transition:.18s;}.ii:hover{background:#EDE3CE;}
.ii.full{grid-column:1/-1;}
.il{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#A07050;margin-bottom:4px;font-weight:600;}
.iv{font-size:14px;font-weight:500;color:#2C1500;line-height:1.4;}

/* TIMING STRIP */
.tstrip{display:flex;gap:0;flex-wrap:wrap;background:#F7F0E2;border-radius:12px;margin-bottom:17px;overflow:hidden;border:1px solid #EDE3CE;}
.tblock{flex:1;min-width:100px;text-align:center;padding:16px 12px;position:relative;}
.tblock+.tblock::before{content:'';position:absolute;left:0;top:18%;height:64%;width:1px;background:#DDD0B8;}
.tval{font-family:'DM Sans',system-ui,sans-serif;font-size:16px;font-weight:700;color:#C8520A;letter-spacing:.01em;line-height:1.3;}
.tlbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#A07050;margin-top:5px;font-weight:600;}

/* READ MORE */
.rm-btn{display:inline-flex;align-items:center;gap:5px;margin-top:14px;padding:7px 20px;border-radius:50px;border:1.5px solid #C8520A;background:transparent;color:#C8520A;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;font-family:'DM Sans',sans-serif;}
.rm-btn:hover{background:#C8520A;color:#fff;}

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
.ptime{font-size:14px;font-weight:700;color:#C8520A;font-family:'DM Sans',sans-serif;}

/* FESTIVALS */
.fest{display:flex;gap:13px;padding:15px 0;border-bottom:1px solid #EDE3CE;}.fest:last-child{border-bottom:none;}
.fest-mo{flex-shrink:0;width:48px;height:48px;background:#C8520A;border-radius:11px;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;letter-spacing:.05em;}
.major{font-size:10px;background:rgba(200,82,10,.12);color:#C8520A;padding:2px 8px;border-radius:50px;margin-left:7px;font-weight:600;}

/* SEVAS */
.seva{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#F7F0E2;border-radius:9px;margin-bottom:8px;border:1px solid #EDE3CE;transition:.18s;}.seva:hover{background:#EDE3CE;border-color:#C8520A;}
.seva-price{font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;color:#C8520A;white-space:nowrap;margin-left:11px;}

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

/* TAGS */
.tags{display:flex;flex-wrap:wrap;gap:7px;padding:4px 0 18px;}
.tag{background:#fff;border:1px solid #EDE3CE;border-radius:50px;padding:4px 12px;font-size:12px;color:#7A5538;font-weight:500;}

/* SIMPLE CARD */
.card{background:#fff;border-radius:16px;padding:22px 24px;box-shadow:0 2px 12px rgba(44,21,0,.07);border:1px solid #EDE3CE;margin-bottom:20px;}
.card-h{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:700;color:#2C1500;margin-bottom:13px;letter-spacing:.01em;}
.dc{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:7px;margin:9px 0;}
.cause{text-align:center;padding:9px 6px;background:#F7F0E2;border-radius:7px;border:1px solid #EDE3CE;}
.cause-i{font-size:19px;margin-bottom:2px;}
.cause-n{font-size:11px;font-weight:500;color:#4A2C10;}
.abtn{width:100%;padding:10px 13px;background:#C8520A;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;transition:.18s;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;margin-top:7px;font-family:'DM Sans',sans-serif;}
.abtn:hover{background:#9A3C05;}
.abtn.red{background:linear-gradient(135deg,#b83024,#e0402e);}
.map-ph{width:100%;height:100px;background:#F7F0E2;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:34px;margin-bottom:11px;}
.map-row{font-size:12.5px;color:#7A5538;padding:5px 0;display:flex;align-items:flex-start;gap:6px;line-height:1.45;}
.verified{display:flex;align-items:center;gap:10px;padding:11px;background:#EBF7F0;border-radius:9px;}
.vtext{font-size:12px;font-weight:600;color:#1A6B3A;}

/* SECTION LABEL */
.slbl{font-size:11px;color:#A07050;margin-bottom:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}

/* LOADING / ERROR */
.loading{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
.spinner{width:42px;height:42px;border:3px solid #EDE3CE;border-top-color:#C8520A;border-radius:50%;animation:spin .75s linear infinite;}
.err{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;}

/* UPI MODAL */
.upi-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:20px;animation:fadeIn .2s ease;overflow-y:auto;}
.upi-modal{background:#fff;border-radius:20px;padding:24px 22px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.3);}
.upi-modal-h{font-family:'Cormorant Garamond',Georgia,serif;font-size:21px;font-weight:700;color:#2C1500;margin-bottom:4px;}
.upi-modal-sub{font-size:12px;color:#A07050;margin-bottom:16px;}
.upi-amounts{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:13px;}
.upi-amt-btn{padding:9px 4px;border-radius:9px;border:1.5px solid #EDE3CE;background:#F7F0E2;font-size:13px;font-weight:600;color:#4A2C10;cursor:pointer;transition:.15s;font-family:'DM Sans',sans-serif;}
.upi-amt-btn:hover,.upi-amt-btn.sel{border-color:#C8520A;background:#FFF4EB;color:#C8520A;}
.upi-input-wrap{position:relative;margin-bottom:13px;}
.upi-input-pre{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:16px;font-weight:700;color:#C8520A;}
.upi-input{width:100%;padding:11px 14px 11px 28px;border:1.5px solid #EDE3CE;border-radius:9px;font-size:16px;font-weight:600;color:#2C1500;font-family:'DM Sans',sans-serif;outline:none;transition:.15s;-moz-appearance:textfield;}
.upi-input:focus{border-color:#C8520A;}
.upi-input::-webkit-outer-spin-button,.upi-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.upi-qr-box{background:linear-gradient(135deg,#FFF8F0,#FFF4EB);border:2px solid #EDE3CE;border-radius:14px;padding:18px 16px;margin-bottom:13px;text-align:center;}
.upi-qr-label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#A07050;font-weight:700;margin-bottom:10px;}
.upi-qr-img{width:180px;height:180px;border-radius:10px;border:3px solid #fff;box-shadow:0 4px 20px rgba(200,82,10,.15);display:block;margin:0 auto 10px;}
.upi-qr-hint{font-size:11px;color:#A07050;line-height:1.5;}
.upi-qr-hint strong{color:#C8520A;}
.upi-id-copy{display:flex;align-items:center;justify-content:space-between;background:#F7F0E2;border-radius:9px;padding:9px 12px;margin-bottom:13px;border:1px solid #EDE3CE;}
.upi-id-text{font-size:12.5px;font-weight:600;color:#2C1500;}
.upi-copy-btn{font-size:11px;font-weight:700;color:#C8520A;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;padding:4px 8px;border-radius:5px;transition:.15s;}
.upi-copy-btn:hover{background:#FFF4EB;}
.upi-cancel{width:100%;padding:11px;border-radius:9px;border:1.5px solid #EDE3CE;background:#fff;font-size:13px;font-weight:600;color:#7A5538;cursor:pointer;font-family:'DM Sans',sans-serif;transition:.15s;}
.upi-cancel:hover{background:#F7F0E2;}

.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:14px;}
.gallery-item{aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#F7F0E2;border:0;padding:0;cursor:pointer;}
.gallery-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s;}
.gallery-item:hover img{transform:scale(1.05);}

.lightbox{position:fixed;inset:0;background:rgba(10,5,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:22px;animation:fadeIn .18s ease;}
.lightbox-stage{position:relative;width:min(1080px,100%);height:min(760px,calc(100vh - 44px));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
.lightbox-img-wrap{position:relative;flex:1;width:100%;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:14px;background:rgba(255,255,255,.05);}
.lightbox-img{max-width:100%;max-height:100%;object-fit:contain;display:block;}
.lightbox-close{position:absolute;top:0;right:0;width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;font-size:24px;line-height:1;cursor:pointer;z-index:2;}
.lightbox-arrow{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:54px;border-radius:999px;border:1px solid rgba(255,255,255,.26);background:rgba(0,0,0,.35);color:#fff;font-size:30px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;}
.lightbox-arrow.left{left:12px;}
.lightbox-arrow.right{right:12px;}
.lightbox-caption{color:rgba(255,255,255,.82);font-size:13px;text-align:center;}
.lightbox-strip{width:100%;display:flex;gap:9px;overflow-x:auto;padding:2px 4px 6px;scrollbar-width:thin;}
.lightbox-thumb{width:66px;height:50px;border-radius:8px;border:2px solid rgba(255,255,255,.22);padding:0;overflow:hidden;background:rgba(255,255,255,.08);cursor:pointer;flex:0 0 auto;opacity:.7;}
.lightbox-thumb.on{border-color:#FFD580;opacity:1;}
.lightbox-thumb img{width:100%;height:100%;object-fit:cover;display:block;}

@media(max-width:1024px){.wrap{padding:20px 20px 60px;}.snav{padding:0 20px;justify-content:flex-start;}.hero-body{padding-left:20px;padding-right:20px;}}
@media(max-width:640px){.hero{height:auto;min-height:380px;}.hero-h1{font-size:clamp(22px,7vw,36px)}.hero-hindi{font-size:clamp(22px,7vw,36px)}.ig{grid-template-columns:1fr 1fr;}.ii.full{grid-column:1/-1;}.wrap{padding:14px 14px 60px;}.sec{padding:17px 15px;}.tstrip{flex-wrap:wrap;}.tblock{min-width:50%;}.tblock+.tblock::before{display:none;}.lightbox{padding:12px;}.lightbox-stage{height:calc(100vh - 24px);}.lightbox-arrow{width:38px;height:48px;font-size:26px;}.lightbox-arrow.left{left:6px;}.lightbox-arrow.right{right:6px;}.lightbox-close{top:4px;right:4px;}}
`;

function HeroImage({ src, alt }) {
  if (!src) return null;
  return <img src={src} alt={alt} className="hero-img" onError={e => e.currentTarget.style.display='none'} />;
}

function HeroCarousel({ images, activeIndex, onSelect, alt }) {
  if (!images.length) return <div className="hero-diya">🪔</div>;
  return (
    <>
      {images.map((img, index) => (
        <img
          key={img.id || img.file_url || index}
          src={img.file_url}
          alt={img.caption || alt}
          className={`hero-img hero-slide${index === activeIndex ? ' on' : ''}`}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      ))}
      {images.length > 1 && (
        <div className="hero-gallery-nav" aria-label="Temple hero photos">
          {images.map((img, index) => (
            <button
              key={img.id || img.file_url || index}
              type="button"
              className={`hero-dot${index === activeIndex ? ' on' : ''}`}
              onClick={() => onSelect(index)}
              aria-label={`Show temple photo ${index + 1}`}
            >
              <img src={img.file_url} alt="" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function GalleryLightbox({ images, activeIndex, onSelect, onClose, title }) {
  const safeIndex = images.length ? Math.min(activeIndex, images.length - 1) : 0;
  const active = images[safeIndex];
  const prev = () => onSelect((safeIndex - 1 + images.length) % images.length);
  const next = () => onSelect((safeIndex + 1) % images.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!active) return null;
  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-stage" onClick={e => e.stopPropagation()}>
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close gallery">×</button>
        {images.length > 1 && (
          <button type="button" className="lightbox-arrow left" onClick={prev} aria-label="Previous photo">‹</button>
        )}
        <div className="lightbox-img-wrap">
          <img className="lightbox-img" src={active.file_url} alt={active.caption || title} />
        </div>
        {images.length > 1 && (
          <button type="button" className="lightbox-arrow right" onClick={next} aria-label="Next photo">›</button>
        )}
        <div className="lightbox-caption">{safeIndex + 1} / {images.length}</div>
        {images.length > 1 && (
          <div className="lightbox-strip">
            {images.map((img, index) => (
              <button
                key={img.id || img.file_url || index}
                type="button"
                className={`lightbox-thumb${index === safeIndex ? ' on' : ''}`}
                onClick={() => onSelect(index)}
                aria-label={`Open photo ${index + 1}`}
              >
                <img src={img.file_url} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function II({ label, value, full, icon }) {
  if (!v(value)) return null;
  return (
    <div className={`ii${full ? ' full' : ''}`}>
      <div className="il">{label}</div>
      <div className="iv">{icon && <span style={{marginRight:4}}>{icon}</span>}{value}</div>
    </div>
  );
}

function SLabel({ text }) {
  return <p className="slbl">{text}</p>;
}

function ReadMore({ children, label, showLessLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {open && <div style={{marginTop:14}}>{children}</div>}
      <button className="rm-btn" onClick={() => setOpen(o => !o)}>
        {open ? `▲ ${showLessLabel}` : `▼ ${label}`}
      </button>
    </div>
  );
}

const PRESET_AMOUNTS = [51, 101, 251, 501, 1001, 5001];

function UpiModal({ upiId, payeeName, onClose, tFn }) {
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);

  const buildUpiString = () => {
    const amt = parseFloat(amount) || 0;
    const pn  = encodeURIComponent(payeeName || 'Temple Trust');
    const tn  = encodeURIComponent('Donation to ' + (payeeName || 'Temple'));
    if (amt > 0) {
      return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${pn}&am=${amt.toFixed(2)}&cu=INR&tn=${tn}`;
    }
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${pn}&cu=INR&tn=${tn}`;
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(buildUpiString())}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(upiId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="upi-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="upi-modal">
        <div className="upi-modal-h">{tFn('upi.title')}</div>
        <div className="upi-modal-sub">{tFn('upi.subtitle')}</div>
        <div className="upi-amounts">
          {PRESET_AMOUNTS.map(a => (
            <button
              key={a}
              className={`upi-amt-btn${String(amount) === String(a) ? ' sel' : ''}`}
              onClick={() => setAmount(String(a))}
            >₹{a}</button>
          ))}
        </div>
        <div className="upi-input-wrap">
          <span className="upi-input-pre">₹</span>
          <input
            className="upi-input"
            type="number"
            min="1"
            placeholder={tFn('upi.custom_placeholder')}
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>
        <div className="upi-qr-box">
          <div className="upi-qr-label">{tFn('upi.scan_label')}</div>
          <img key={qrUrl} src={qrUrl} alt="UPI Payment QR Code" className="upi-qr-img" />
          <div className="upi-qr-hint">
            {amount
              ? <>{tFn('upi.amount_prefilled', { amount })}</>
              : <>{tFn('upi.no_amount')}</>
            }
          </div>
        </div>
        <div className="upi-id-copy">
          <span className="upi-id-text">{tFn('upi.upi_id_label')}: {upiId}</span>
          <button className="upi-copy-btn" onClick={handleCopy}>
            {copied ? tFn('upi.copied') : tFn('upi.copy')}
          </button>
        </div>
        <button className="upi-cancel" onClick={onClose}>{tFn('upi.close')}</button>
      </div>
    </div>
  );
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
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [lightboxIndex,setLightboxIndex]= useState(null);

  const { translated: T } = useTranslatedTemple(temple);
  const { t } = useTranslation();
  const gallery = buildGallery(T);

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
        setError(err?.response?.status === 404 ? t('detail.not_found') : t('detail.load_error'));
      } finally { setLoading(false); }
    };
    load();
    window.scrollTo(0, 0);
  }, [slug, navigate]);

  if (loading) return (<><style>{CSS}</style><Navbar/><div className="loading"><div className="spinner"/><span style={{color:'#A07050',fontSize:14}}>{t('detail.loading_temple')}</span></div></>);
  if (error)   return (<><style>{CSS}</style><Navbar/><div className="err"><div style={{fontSize:60}}>🛕</div><h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28}}>{t('detail.temple_not_found')}</h2><p style={{color:'#A07050'}}>{error}</p><button style={{marginTop:16,padding:'10px 22px',background:'#C8520A',color:'#fff',border:'none',borderRadius:9,cursor:'pointer',fontSize:14}} onClick={()=>navigate('/')}>{t('detail.back_home')}</button></div></>);
  if (!T) return (<><style>{CSS}</style><Navbar/><div className="loading"><div className="spinner"/></div></>);

  const heroImg = proxyImageUrl(T.hero_image_url);
  const openTime  = formatTime(T.opening_time);
  const closeTime = formatTime(T.closing_time);
  const acStart   = formatTime(T.afternoon_closure_start);
  const acEnd     = formatTime(T.afternoon_closure_end);
  const fee       = displayFee(T.entry_fee, t('detail.free_entry'));
  const tags      = parseTags(T.category_tags);
  const mapsUrl   = T.latitude ? `https://www.google.com/maps/search/?api=1&query=${T.latitude},${T.longitude}` : T.google_maps_link || null;

  const pujaServices = [
    ['puja_rudrabhishek','Rudrabhishek'],['puja_satyanarayan','Satyanarayan Katha'],
    ['puja_havan_homa','Havan / Homa'],['puja_laghu_rudra','Laghu Rudra'],
    ['puja_mahamrityunjaya','Mahamrityunjaya'],['puja_griha_pravesh','Griha Pravesh'],
    ['puja_naamkaran','Naamkaran'],['puja_vivah','Vivah Puja'],
    ['puja_annaprashan','Annaprashan'],['puja_mundan','Mundan'],
    ['puja_pitru_tarpan','Pitru Tarpan'],['puja_sahasranamarchana','Sahasranamarchana'],
  ].filter(([k]) => T[k]);

  const facilities = [
    ['facility_electricity',    `⚡ ${t('detail.fac_electricity', { defaultValue: 'Electricity' })}`],
    ['facility_water_supply',   `💧 ${t('detail.fac_water',       { defaultValue: 'Water' })}`],
    ['facility_clean_toilets',  `🚻 ${t('detail.fac_toilets',     { defaultValue: 'Toilets' })}`],
    ['facility_wheelchair',     `♿ ${t('detail.fac_wheelchair',  { defaultValue: 'Wheelchair Access' })}`],
    ['facility_dharamshala',    `🏠 ${t('detail.fac_dharamshala',{ defaultValue: 'Dharamshala' })}`],
    ['facility_prasad_dining',  `🍱 ${t('detail.fac_prasad',     { defaultValue: 'Prasad Dining' })}`],
    ['facility_parking',        `🅿️ ${t('detail.fac_parking',    { defaultValue: 'Parking' })}`],
    ['facility_security',       `🔒 ${t('detail.fac_security',   { defaultValue: 'Security' })}`],
    ['facility_cctv',           `📹 ${t('detail.fac_cctv',       { defaultValue: 'CCTV' })}`],
    ['facility_pa_system',      `🔊 ${t('detail.fac_pa',         { defaultValue: 'PA System' })}`],
    ['facility_internet_wifi',  `📶 ${t('detail.fac_wifi',       { defaultValue: 'WiFi' })}`],
    ['facility_library_pathshala',`📚 ${t('detail.fac_library',  { defaultValue: 'Library' })}`],
    ['facility_gaushaala',      `🐄 ${t('detail.fac_gaushaala',  { defaultValue: 'Gaushaala' })}`],
    ['facility_medical_support',`🏥 ${t('detail.fac_medical',    { defaultValue: 'Medical Support' })}`],
  ].filter(([k]) => T[k]);

  const programs = [
    ['prog_free_food',       `🍱 ${t('detail.prog_annadanam',   { defaultValue: 'Free Food (Annadanam)' })}`],
    ['prog_medical_camps',   `🏥 ${t('detail.prog_medical',     { defaultValue: 'Medical Camps' })}`],
    ['prog_scholarship_edu', `📚 ${t('detail.prog_scholarship', { defaultValue: 'Scholarship & Education' })}`],
    ['prog_womens_selfhelp', `👩 ${t('detail.prog_womens',      { defaultValue: "Women Self-Help" })}`],
    ['prog_bhajan_kirtan',   `🎵 ${t('detail.prog_bhajan',      { defaultValue: 'Bhajan & Kirtan' })}`],
    ['prog_disaster_relief', `🆘 ${t('detail.prog_disaster',    { defaultValue: 'Disaster Relief' })}`],
  ].filter(([k]) => T[k]);

  const navItems = [
    { id:'overview',   label: t('detail.info_title'),         show: true },
    { id:'gallery',    label: t('detail.gallery_title', { defaultValue: 'Gallery' }), show: gallery.length>0 },
    { id:'history',    label: t('detail.history_title'),      show: v(T.history)||v(T.significance)||v(T.puranic_stories) },
    { id:'puja',       label: t('detail.puja_nav'),           show: pujaSchedule.length>0 || pujaServices.length>0 },
    { id:'mantras',    label: t('detail.mantras_title'),      show: mantras.length>0 },
    { id:'festivals',  label: t('detail.festivals_title'),    show: festivals.length>0 },
    { id:'sevas',      label: t('detail.sevas_title'),        show: sevas.length>0 },
    { id:'facilities', label: t('detail.facilities_nav'),     show: facilities.length>0||programs.length>0 },
    { id:'priests',    label: t('detail.priests_nav'),        show: priests.length>0 },
    { id:'contact',    label: t('detail.contact_nav'),        show: true },
  ].filter(n => n.show);

  const scrollTo = (id) => {
    setActiveNav(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  const addressLine = T.address || [T.city, T.state].filter(v).join(', ');

  const previewFacts = [
    { label: t('detail.primary_deity'), value: T.primary_deity, icon:'🙏' },
    { label: t('detail.sect'),          value: T.sect },
    { label: t('detail.architecture'),  value: T.architecture_style },
    { label: t('detail.established'),   value: T.estimated_year_built },
    { label: t('detail.best_time'),     value: T.setting_environment, icon:'🌿' },
    { label: t('detail.dress_code'),    value: T.dress_code, icon:'👗' },
  ].filter(i => v(i.value)).slice(0, 6);

  const showLess = t('detail.show_less');

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {showUpiModal && (
        <UpiModal
          upiId={T.upi_id}
          payeeName={T.name}
          onClose={() => setShowUpiModal(false)}
          tFn={t}
        />
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          images={gallery}
          activeIndex={lightboxIndex}
          onSelect={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          title={T.name}
        />
      )}

      {/* ══ HERO ══ */}
      <div className="hero">
        {heroImg ? <HeroImage src={heroImg} alt={T.name} /> : <div className="hero-diya">🪔</div>}
        <div className="hero-grad"/>
        <div className="hero-body">
          <div className="hero-bc">
            <a href="/">{t('breadcrumb.home')}</a><sep>/</sep>
            <span>{T.state}</span><sep>/</sep>
            <span>{T.city}</span><sep>/</sep>
            <span>{T.name}</span>
          </div>
          <div className="badges">
            {T.is_jyotirlinga      && <span className="badge saffron">⚡ {t('badge.jyotirlinga')}</span>}
            {T.is_shaktipeeth      && <span className="badge saffron">🌸 {t('badge.shaktipeeth')}</span>}
            {T.is_char_dham        && <span className="badge saffron">🔱 Char Dham</span>}
            {T.is_ashtavinayak     && <span className="badge saffron">🐘 Ashtavinayak</span>}
            {T.is_divya_desam      && <span className="badge saffron">🪷 Divya Desam</span>}
            {T.is_pancha_bhuta     && <span className="badge saffron">🌊 Pancha Bhuta</span>}
            {T.is_51_shakti_peeths && <span className="badge saffron">51 Shakti Peeths</span>}
            {T.is_heritage_site    && <span className="badge blue">🏛️ {t('badge.heritage')}</span>}
            {T.is_unesco_heritage  && <span className="badge blue">🌍 UNESCO</span>}
            {T.is_state_heritage   && <span className="badge blue">⭐ State Heritage</span>}
            {T.is_asi_protected    && <span className="badge blue">🏺 ASI Protected</span>}
            {T.verified            && <span className="badge green">✓ {t('badge.verified')}</span>}
            {v(T.sect)             && <span className="badge saffron">{T.sect}</span>}
          </div>
          <h1 className="hero-h1">{T.name}</h1>
          {v(T.name_hindi) && <div className="hero-hindi">{T.name_hindi}</div>}
          <div className="hero-address"><span>📍</span><span>{addressLine}</span></div>
        </div>
      </div>

      {/* ══ STICKY NAV ══ */}
      <div className="snav">
        {navItems.map(n => (
          <div key={n.id} className={`snav-item${activeNav===n.id?' on':''}`} onClick={()=>scrollTo(n.id)}>{n.label}</div>
        ))}
      </div>

      <div className="wrap">
        {tags.length > 0 && (
          <div className="tags">{tags.map(tg=><span key={tg} className="tag">#{tg}</span>)}</div>
        )}

        {/* ── OVERVIEW ── */}
        <div className="sec" id="overview">
          <div className="sec-h"><div className="sec-icon">🛕</div>{t('detail.info_title')}</div>

          {(openTime || fee || acStart) && (
            <div className="tstrip">
              {openTime  && (
                <div className="tblock">
                  <div className="tval">{openTime}</div>
                  <div className="tlbl">{t('detail.opens')}</div>
                </div>
              )}
              {closeTime && (
                <div className="tblock">
                  <div className="tval">{closeTime}</div>
                  <div className="tlbl">{t('detail.closes')}</div>
                </div>
              )}
              {acStart && acEnd && (
                <div className="tblock">
                  <div className="tval">{acStart} – {acEnd}</div>
                  <div className="tlbl">{t('detail.best_time')}</div>
                </div>
              )}
              {fee && (
                <div className="tblock">
                  <div className="tval">{fee}</div>
                  <div className="tlbl">{t('detail.entry')}</div>
                </div>
              )}
              {v(T.prasad_type) && (
                <div className="tblock">
                  <div className="tval">{T.prasad_type}</div>
                  <div className="tlbl">{t('detail.prasad')}</div>
                </div>
              )}
            </div>
          )}

          <div className="ig">
            {previewFacts.map(i => (
              <div key={i.label} className="ii">
                <div className="il">{i.label}</div>
                <div className="iv">{i.icon && <span style={{marginRight:4}}>{i.icon}</span>}{i.value}</div>
              </div>
            ))}
          </div>

          <ReadMore label={t('detail.more_details')} showLessLabel={showLess}>
            <div className="ig">
              <II label={t('detail.temple_type')}        value={T.temple_type}/>
              <II label={t('detail.founded_by')}         value={T.founded_by}/>
              <II label={t('detail.last_renovation')}    value={T.last_renovation_year}/>
              <II label={t('detail.building_condition')} value={T.building_condition}/>
              <II label={t('detail.managing_authority')} value={T.managing_authority}/>
              <II label={t('detail.trust_name')}         value={T.trust_name}/>
              <II label={t('detail.local_landmark')}     value={T.local_landmark} icon="🏛️"/>
              <II label={t('detail.weekly_special_day')} value={T.weekly_special_day} icon="⭐"/>
              {v(T.online_puja_available) && T.online_puja_available!=='no' && (
                <II label={t('detail.online_puja')} value={T.online_puja_available==='yes'? t('detail.available') : t('detail.coming_soon')}/>
              )}
              <II label={t('detail.local_name')}         value={T.name_local}/>
              <II label={t('detail.best_time_to_visit')} value={T.best_time_to_visit} icon="📅" full/>
              <II label={t('detail.address')}            value={T.address} icon="📌" full/>
            </div>
          </ReadMore>
        </div>

        {/* ── GALLERY ── */}
        {gallery.length > 0 && (
          <div className="sec" id="gallery">
            <div className="sec-h"><div className="sec-icon">📷</div>{t('detail.gallery_title', { defaultValue: 'Photo Gallery' })}</div>
            <div className="gallery-grid">
              {gallery.map((img, index) => (
                <button
                  key={img.id}
                  type="button"
                  className="gallery-item"
                  onClick={() => setLightboxIndex(index)}
                  aria-label={`Open ${img.caption || T.name} photo ${index + 1}`}
                >
                  <img
                    src={img.file_url}
                    alt={img.caption || T.name}
                    loading="lazy"
                    onError={e => { e.currentTarget.closest('.gallery-item').style.display = 'none'; }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORY & SIGNIFICANCE ── */}
        {(v(T.history)||v(T.significance)||v(T.sthala_purana)||v(T.puranic_stories)||v(T.history_hindi)) && (
          <div className="sec" id="history">
            <div className="sec-h"><div className="sec-icon">📜</div>{t('detail.history_title')}</div>
            {v(T.history) && (
              <p className="prose" style={{display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden',marginBottom:0}}>{T.history}</p>
            )}
            <ReadMore label={t('detail.read_full_history')} showLessLabel={showLess}>
              {v(T.history)         && <p className="prose">{T.history}</p>}
              {v(T.sthala_purana)   && <p className="prose prose-sm" style={{fontStyle:'italic',marginBottom:14}}>{T.sthala_purana}</p>}
              {v(T.puranic_stories) && (<div className="puranic"><div className="puranic-lbl">{t('detail.puranic_story')}</div><p className="prose-sm" style={{fontStyle:'italic'}}>{T.puranic_stories}</p></div>)}
              {v(T.significance)    && (<div className="significance"><div className="sig-lbl">✨ {t('detail.why_visit')}</div><p style={{fontSize:14,lineHeight:1.8,color:'#7A5538'}}>{T.significance}</p></div>)}
              {v(T.history_hindi)   && (<div className="hindi-block"><div className="hindi-lbl">{t('detail.hindi_history_label')}</div><p style={{fontFamily:"'Noto Sans Devanagari',sans-serif",fontSize:14,lineHeight:1.9,color:'#7A5538'}}>{T.history_hindi}</p></div>)}
            </ReadMore>
          </div>
        )}

        {/* ── PUJA & SERVICES ── */}
        {(pujaSchedule.length>0 || pujaServices.length>0) && (
          <div className="sec" id="puja">
            <div className="sec-h"><div className="sec-icon">🕉️</div>{t('detail.sevas_title')}</div>
            {pujaSchedule.slice(0,3).map((p,i)=>(
              <div key={i} className="prow">
                <div><span className="pname">{p.puja_name}</span>{p.puja_type&&<span style={{fontSize:11,color:'#A07050',marginLeft:8}}>{p.puja_type}</span>}</div>
                <span className="ptime">{formatTime(p.puja_time)}</span>
              </div>
            ))}
            {(pujaSchedule.length > 3 || pujaServices.length > 0) && (
              <ReadMore label={t('detail.view_full_schedule')} showLessLabel={showLess}>
                {pujaSchedule.slice(3).map((p,i)=>(
                  <div key={i} className="prow">
                    <span className="pname">{p.puja_name}</span>
                    <span className="ptime">{formatTime(p.puja_time)}</span>
                  </div>
                ))}
                {pujaServices.length > 0 && (
                  <><div style={{height:14}}/><SLabel text={t('detail.available_puja_services')}/><div className="chip-grid">{pujaServices.map(([,name])=>(<div key={name} className="chip chip-saffron"><div className="dot"/>{name}</div>))}</div></>
                )}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── MANTRAS ── */}
        {mantras.length > 0 && (
          <div className="sec" id="mantras">
            <div className="sec-h"><div className="sec-icon">🕉️</div>{t('detail.mantras_title')}</div>
            <div className="mantra">
              <div className="m-title">{mantras[0].title}{mantras[0].mantra_type&&<span style={{opacity:.4,fontWeight:400,marginLeft:8,fontSize:11}}>· {mantras[0].mantra_type}</span>}</div>
              {mantras[0].sanskrit && <div className="m-sk" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{mantras[0].sanskrit}</div>}
            </div>
            {mantras.length > 1 && (
              <ReadMore label={t('detail.view_all_mantras')} showLessLabel={showLess}>
                {mantras.slice(0).map(m=>(
                  <div key={m.id} className="mantra">
                    <div className="m-title">{m.title}{m.mantra_type&&<span style={{opacity:.4,fontWeight:400,marginLeft:8,fontSize:11}}>· {m.mantra_type}</span>}</div>
                    {m.sanskrit        && <div className="m-sk">{m.sanskrit}</div>}
                    {m.transliteration && <div className="m-ro">{m.transliteration}</div>}
                    {m.meaning         && <div className="m-mn">{m.meaning}</div>}
                  </div>
                ))}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── FESTIVALS ── */}
        {festivals.length > 0 && (
          <div className="sec" id="festivals">
            <div className="sec-h"><div className="sec-icon">🎉</div>{t('detail.annual_festivals')}</div>
            {festivals.slice(0,2).map((f,i)=>(
              <div key={i} className="fest">
                <div className="fest-mo">{f.month?MONTHS[f.month]:'—'}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:'#2C1500'}}>{f.name}{f.is_major&&<span className="major">{t('detail.major_star')}</span>}</div>
                  {f.description&&<p style={{fontSize:13,color:'#A07050',lineHeight:1.6,marginTop:4}}>{f.description}</p>}
                </div>
              </div>
            ))}
            {festivals.length > 2 && (
              <ReadMore label={t('detail.view_all_festivals', { count: festivals.length })} showLessLabel={showLess}>
                {festivals.slice(2).map((f,i)=>(
                  <div key={i} className="fest">
                    <div className="fest-mo">{f.month?MONTHS[f.month]:'—'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,color:'#2C1500'}}>{f.name}{f.is_major&&<span className="major">{t('detail.major_star')}</span>}</div>
                      {f.hindu_month&&<div style={{fontSize:11,color:'#C8520A',marginTop:2}}>{f.hindu_month} {t('detail.month_label')}</div>}
                      {f.duration_days&&<div style={{fontSize:11,color:'#A07050',marginTop:2}}>{f.duration_days} {f.duration_days>1? t('festival.days') : t('festival.day')}</div>}
                      {f.description&&<p style={{fontSize:13,color:'#A07050',lineHeight:1.6,marginTop:6}}>{f.description}</p>}
                      {f.significance&&<p style={{fontSize:12,color:'#A07050',lineHeight:1.5,marginTop:4,fontStyle:'italic'}}>{f.significance}</p>}
                    </div>
                  </div>
                ))}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── SEVAS ── */}
        {sevas.length > 0 && (
          <div className="sec" id="sevas">
            <div className="sec-h"><div className="sec-icon">🙏</div>{t('detail.sevas_offerings')}</div>
            {sevas.slice(0,3).map(s=>(
              <div key={s.id} className="seva">
                <div>
                  <div style={{fontSize:14,fontWeight:500,color:'#2C1500'}}>{s.name}</div>
                  {s.description&&<div style={{fontSize:12,color:'#A07050',marginTop:2}}>{s.description}</div>}
                </div>
                <div className="seva-price">{s.is_free? t('detail.free_label') :s.price?`₹${s.price}`:'—'}</div>
              </div>
            ))}
            {sevas.length > 3 && (
              <ReadMore label={t('detail.view_all_sevas', { count: sevas.length })} showLessLabel={showLess}>
                {sevas.slice(3).map(s=>(
                  <div key={s.id} className="seva">
                    <div>
                      <div style={{fontSize:14,fontWeight:500,color:'#2C1500'}}>{s.name}</div>
                      {s.description&&<div style={{fontSize:12,color:'#A07050',marginTop:2}}>{s.description}</div>}
                      {s.timing&&<div style={{fontSize:11,color:'#A07050',marginTop:3}}>⏰ {s.timing}</div>}
                      {s.advance_booking&&<div style={{fontSize:11,color:'#C8520A',marginTop:3,fontWeight:600}}>📅 {t('detail.advance_booking')}</div>}
                    </div>
                    <div className="seva-price">{s.is_free? t('detail.free_label') :s.price?`₹${s.price}`:'—'}</div>
                  </div>
                ))}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── FACILITIES & PROGRAMS ── */}
        {(facilities.length>0 || programs.length>0) && (
          <div className="sec" id="facilities">
            <div className="sec-h"><div className="sec-icon">🏗️</div>{t('detail.facilities_programs')}</div>
            {facilities.length > 0 && (
              <><SLabel text={t('detail.available_facilities')}/><div className="chip-grid">{facilities.slice(0,4).map(([,name])=><div key={name} className="chip chip-green"><span>✓</span>{name}</div>)}</div></>
            )}
            {(facilities.length > 4 || programs.length > 0) && (
              <ReadMore label={t('detail.view_all_facilities_btn')} showLessLabel={showLess}>
                {facilities.length > 4 && <div className="chip-grid" style={{marginBottom:8}}>{facilities.slice(4).map(([,name])=><div key={name} className="chip chip-green"><span>✓</span>{name}</div>)}</div>}
                {programs.length > 0 && (
                  <><div style={{height:10}}/><SLabel text={t('detail.community_programs')}/><div className="chip-grid">{programs.map(([,name])=><div key={name} className="chip chip-blue">{name}</div>)}</div></>
                )}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── PRIESTS ── */}
        {priests.length > 0 && (
          <div className="sec" id="priests">
            <div className="sec-h"><div className="sec-icon">🧘</div>{t('detail.head_priests')}</div>
            {priests.slice(0,2).map(p=>(
              <div key={p.id} className="priest">
                <div className="priest-name">{p.full_name}{p.is_head_priest&&<span className="priest-head">{t('detail.head_priest_badge')}</span>}</div>
                {p.title_designation&&<div className="priest-d">🪷 {p.title_designation}</div>}
                {p.years_of_service&&<div className="priest-d">⏳ {t('detail.serving_years', { years: p.years_of_service })}</div>}
              </div>
            ))}
            {priests.length > 2 && (
              <ReadMore label={t('detail.view_all_priests')} showLessLabel={showLess}>
                {priests.slice(2).map(p=>(
                  <div key={p.id} className="priest">
                    <div className="priest-name">{p.full_name}{p.is_head_priest&&<span className="priest-head">{t('detail.head_priest_badge')}</span>}</div>
                    {p.title_designation&&<div className="priest-d">🪷 {p.title_designation}</div>}
                    {p.sampradaya      &&<div className="priest-d">📿 {t('detail.sampradaya')}: {p.sampradaya}</div>}
                    {p.years_of_service&&<div className="priest-d">⏳ {t('detail.serving_years', { years: p.years_of_service })}</div>}
                    {p.languages_known &&<div className="priest-d">🗣️ {t('detail.languages')}: {p.languages_known}</div>}
                    {p.qualification   &&<div className="priest-d">🎓 {p.qualification}</div>}
                  </div>
                ))}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── DONATIONS ── */}
        {T.accept_online_donations && (
          <div className="card">
            <div className="card-h">{t('detail.support_temple')}</div>
            <p style={{fontSize:12,color:'#A07050',marginBottom:10}}>{t('detail.donation_subtitle')}</p>
            <div className="dc">
              {T.donation_temple_renovation&&<div className="cause"><div className="cause-i">🛕</div><div className="cause-n">{t('detail.cause_renovation')}</div></div>}
              {T.donation_annadanam        &&<div className="cause"><div className="cause-i">🍱</div><div className="cause-n">{t('detail.cause_annadanam')}</div></div>}
              {T.donation_priest_salary    &&<div className="cause"><div className="cause-i">🧘</div><div className="cause-n">{t('detail.cause_priest')}</div></div>}
              {T.donation_vedic_education  &&<div className="cause"><div className="cause-i">📚</div><div className="cause-n">{t('detail.cause_vedic')}</div></div>}
              {T.donation_festival         &&<div className="cause"><div className="cause-i">🎉</div><div className="cause-n">{t('detail.cause_festival')}</div></div>}
              {T.donation_medical_camps    &&<div className="cause"><div className="cause-i">🏥</div><div className="cause-n">{t('detail.cause_medical')}</div></div>}
              {T.donation_general          &&<div className="cause"><div className="cause-i">🙏</div><div className="cause-n">{t('detail.cause_general')}</div></div>}
            </div>
            {(v(T.upi_id) || v(T.payment_page_url)) && (
              <>
                {v(T.upi_id) && (
                  <p style={{fontSize:11,textAlign:'center',color:'#A07050',margin:'8px 0 4px'}}>
                    {t('detail.upi_id_label')}: <strong>{T.upi_id}</strong>
                  </p>
                )}
                <div style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 4,
                  flexDirection: (v(T.upi_id) && v(T.payment_page_url)) ? 'row' : 'column',
                }}>
                  {v(T.upi_id) && (
                    <button
                      className="abtn"
                      onClick={() => setShowUpiModal(true)}
                      style={{ flex: 1, margin: 0 }}
                    >
                      🙏 {t('detail.donate_upi')}
                    </button>
                  )}
                  {v(T.payment_page_url) && (
                    <a
                      href={T.payment_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="abtn"
                      style={{
                        flex: 1, margin: 0,
                        textAlign: 'center', textDecoration: 'none',
                        background: 'linear-gradient(135deg,#1A6B3A,#2E9E58)',
                        color: '#fff', border: 'none',
                      }}
                    >
                      💳 {t('detail.donate_online', { defaultValue: 'Donate Online' })} →
                    </a>
                  )}
                </div>
              </>
            )}
            {v(T.certificate_80g_no)&&<p style={{fontSize:11,color:'#1A6B3A',marginTop:8,textAlign:'center'}}>{t('detail.exempt_80g')}: {T.certificate_80g_no}</p>}
          </div>
        )}

        {/* ── HOW TO REACH ── */}
        <div className="card">
          <div className="card-h">{t('detail.how_to_reach')}</div>
          <div className="map-ph">🛕</div>
          {v(T.nearest_railway)  &&<div className="map-row"><span>🚂</span>{T.nearest_railway}</div>}
          {v(T.nearest_airport)  &&<div className="map-row"><span>✈️</span>{T.nearest_airport}</div>}
          {v(T.nearest_bus_stand)&&<div className="map-row"><span>🚌</span>{T.nearest_bus_stand}</div>}
          {v(T.local_landmark)   &&<div className="map-row"><span>🏛️</span>{t('detail.near')}: {T.local_landmark}</div>}
          {v(T.address)          &&<div className="map-row"><span>📌</span>{T.address}</div>}
          {v(T.pincode)          &&<div className="map-row"><span>📮</span>{t('detail.pin')}: {T.pincode}</div>}
          {mapsUrl&&<a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="abtn">{t('detail.open_maps')}</a>}
        </div>

        {/* ── CONTACT ── */}
        <div className="sec" id="contact">
          <div className="sec-h"><div className="sec-icon">📞</div>{t('detail.contact_connect')}</div>
          {v(T.phone)            &&<div className="crow"><div className="clbl">{t('detail.phone')}</div><a href={`tel:${T.phone}`} className="clink">📞 {T.phone}</a></div>}
          {v(T.whatsapp_number)  &&<div className="crow"><div className="clbl">{t('detail.whatsapp')}</div><a href={`https://wa.me/${T.whatsapp_number.replace(/\D/g,'')}`} className="clink" target="_blank" rel="noopener noreferrer">{t('detail.whatsapp_chat')}</a></div>}
          {v(T.official_email)   &&<div className="crow"><div className="clbl">{t('detail.email')}</div><a href={`mailto:${T.official_email}`} className="clink">✉️ {T.official_email}</a></div>}
          {v(T.website_url)      &&<div className="crow"><div className="clbl">{t('detail.website')}</div><a href={T.website_url} target="_blank" rel="noopener noreferrer" className="clink">{t('detail.visit_website')}</a></div>}
          {v(T.best_time_to_call)&&<div className="crow"><div className="clbl">{t('detail.best_time_to_call')}</div><div className="cval">⏰ {T.best_time_to_call}</div></div>}
          {v(T.trust_registration_no)&&<div className="crow"><div className="clbl">{t('detail.registration_no')}</div><div className="cval">{T.trust_registration_no}</div></div>}
        </div>

        {/* ── VERIFIED ── */}
        <div className="card">
          <div className="verified">
            <span style={{fontSize:24}}>✅</span>
            <div>
              <div className="vtext">{t('detail.verified_on')}</div>
              <div style={{fontSize:10,color:'#1A6B3A',opacity:.7,marginTop:2}}>
                {v(T.mkt_id)?`ID: ${T.mkt_id}`: t('detail.details_reviewed')}
              </div>
            </div>
          </div>
          {v(T.managing_authority)&&<div style={{fontSize:12,color:'#A07050',marginTop:10,padding:'8px 10px',background:'#F7F0E2',borderRadius:8}}>🏛️ {T.managing_authority}</div>}
        </div>
      </div>

      <Footer />
    </>
  );
}
