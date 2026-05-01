import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, ExternalLink, ChevronRight, Train, Plane, ChevronLeft, X, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemple } from '../hooks/useTranslatedData';
import { QRCodeSVG } from 'qrcode.react';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function fixImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Outfit:wght@300;400;500;600&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

  :root {
    --saffron: #E8650A;
    --saffron-light: #F5934A;
    --saffron-dark: #B84D00;
    --gold: #C8960C;
    --gold-light: #F0C040;
    --cream: #FDF8F0;
    --cream-dark: #EDE0C8;
    --brown: #3D1F00;
    --brown-mid: #6B3A10;
    --white: #FFFFFF;
    --text-dark: #1A0A00;
    --text-mid: #4A2800;
    --text-light: #8B6040;
    --shadow: rgba(61,31,0,0.08);
    --shadow-deep: rgba(61,31,0,0.22);
    --font-display: 'Cormorant Garamond', serif;
    --font-body: 'Outfit', sans-serif;
    --font-hindi: 'Noto Sans Devanagari', sans-serif;
    --radius: 16px;
    --radius-lg: 24px;
    --tr: 0.3s cubic-bezier(0.4,0,0.2,1);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font-body); background: var(--cream); color: var(--text-dark); -webkit-font-smoothing: antialiased; }

  /* ── Loading / Error ── */
  .tdp-loading { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
  .tdp-spinner { width: 44px; height: 44px; border: 3px solid var(--cream-dark); border-top-color: var(--saffron); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .tdp-error { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }

  /* ══════════════════════════════════════════
     HERO HEADER — Name & Info First
  ══════════════════════════════════════════ */
  .tdp-header {
    background: linear-gradient(160deg, #3D1F00 0%, #6B3A10 50%, #B84D00 100%);
    padding: 28px 20px 32px;
    position: relative;
    overflow: hidden;
  }
  .tdp-header::before {
    content: 'ॐ';
    position: absolute; right: -20px; top: 50%; transform: translateY(-50%);
    font-family: var(--font-hindi);
    font-size: 180px;
    color: rgba(255,255,255,0.05);
    line-height: 1;
    user-select: none;
  }
  .tdp-header-inner { max-width: 900px; margin: 0 auto; position: relative; z-index: 1; }

  .tdp-breadcrumb {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; color: rgba(255,255,255,0.5);
    margin-bottom: 18px; flex-wrap: wrap; font-family: var(--font-body);
  }
  .tdp-breadcrumb a { color: rgba(255,255,255,0.5); text-decoration: none; transition: var(--tr); }
  .tdp-breadcrumb a:hover { color: var(--gold-light); }

  .tdp-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
  .tdp-badge {
    background: rgba(200,150,12,0.2);
    border: 1px solid rgba(240,192,64,0.35);
    backdrop-filter: blur(6px);
    color: var(--gold-light);
    padding: 4px 14px; border-radius: 50px;
    font-size: 11px; font-family: var(--font-display);
    letter-spacing: .08em; font-weight: 600;
  }
  .tdp-badge.verified { background: rgba(34,120,60,0.35); border-color: rgba(80,200,100,0.4); color: #a0f0b0; }

  .tdp-hero-title {
    font-family: var(--font-display);
    font-size: clamp(32px, 8vw, 56px);
    font-weight: 700; color: white;
    line-height: 1.05; margin-bottom: 8px;
    letter-spacing: -0.01em;
  }
  .tdp-hero-hindi {
    font-family: var(--font-hindi);
    font-size: 17px; color: rgba(255,255,255,0.65);
    margin-bottom: 20px;
  }
  .tdp-hero-meta {
    display: flex; flex-wrap: wrap; gap: 12px;
    font-size: 13px; color: rgba(255,255,255,0.75);
    font-family: var(--font-body); font-weight: 400;
  }
  .tdp-hero-meta-item {
    display: flex; align-items: center; gap: 5px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 5px 12px; border-radius: 50px;
  }

  /* ══════════════════════════════════════════
     PHOTO GALLERY — High Quality
  ══════════════════════════════════════════ */
  .tdp-gallery-wrap {
    background: #ffffff;
    position: relative;
  }
  .tdp-gallery-inner {
    max-width: 820px;
    margin: 0 auto;
  }

  /* Main photo */
  .tdp-main-photo {
    position: relative;
    width: 100%;
    aspect-ratio: 4/3;
    overflow: hidden;
    cursor: zoom-in;
    background: #f5f0e8;
  }
  @media (min-width: 640px) {
    .tdp-main-photo { aspect-ratio: 16/10; max-height: 480px; }
  }
  .tdp-main-photo img {
    width: 100%; height: 100%;
    object-fit: contain;
    object-position: center;
    display: block;
    transition: transform 0.5s ease;
    image-rendering: high-quality;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    transform: translateZ(0);
  }
  .tdp-main-photo:hover img { transform: translateZ(0) scale(1.015); }

  /* Om fallback */
  .tdp-no-photo {
    width: 100%; aspect-ratio: 16/9;
    background: linear-gradient(160deg, #3D1F00, #1A0A00);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-hindi); font-size: 120px;
    color: rgba(255,255,255,0.07);
  }

  /* Gallery nav arrows */
  .tdp-photo-nav {
    position: absolute; top: 50%; transform: translateY(-50%);
    background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.15);
    backdrop-filter: blur(10px); color: white;
    border-radius: 50%; width: 42px; height: 42px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 10; transition: var(--tr);
    -webkit-tap-highlight-color: transparent;
  }
  .tdp-photo-nav:hover { background: rgba(0,0,0,0.7); }
  .tdp-photo-nav.prev { left: 12px; }
  .tdp-photo-nav.next { right: 12px; }

  /* Counter */
  .tdp-photo-counter {
    position: absolute; bottom: 14px; right: 14px;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(8px);
    color: rgba(255,255,255,0.85);
    font-size: 12px; padding: 4px 12px; border-radius: 50px;
    font-family: var(--font-body); letter-spacing: .04em;
  }

  /* Thumbnail strip */
  .tdp-thumb-strip {
    display: flex; gap: 6px; overflow-x: auto;
    padding: 10px 14px;
    background: #ffffff;
    border-bottom: 1px solid var(--cream-dark);
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .tdp-thumb-strip::-webkit-scrollbar { display: none; }
  .tdp-thumb {
    flex: 0 0 70px; height: 52px;
    border-radius: 8px; overflow: hidden;
    cursor: pointer; border: 2px solid transparent;
    transition: var(--tr); opacity: 0.55;
  }
  .tdp-thumb.active { border-color: var(--saffron); opacity: 1; }
  .tdp-thumb:hover { opacity: 0.85; }
  .tdp-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* ── Lightbox ── */
  .tdp-lightbox {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.97);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .tdp-lightbox-img-wrap {
    max-width: 96vw; max-height: 90vh;
    display: flex; align-items: center; justify-content: center;
  }
  .tdp-lightbox img {
    max-width: 96vw; max-height: 88vh;
    object-fit: contain; border-radius: 6px;
    image-rendering: -webkit-optimize-contrast;
  }
  .tdp-lightbox-close {
    position: absolute; top: 14px; right: 14px;
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
    color: white; border-radius: 50%;
    width: 44px; height: 44px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 10;
    transition: var(--tr);
  }
  .tdp-lightbox-close:hover { background: rgba(255,255,255,0.2); }
  .tdp-lb-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
    color: white; border-radius: 50%;
    width: 48px; height: 48px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: var(--tr);
  }
  .tdp-lb-arrow:hover { background: rgba(255,255,255,0.2); }
  .tdp-lb-arrow.prev { left: 14px; }
  .tdp-lb-arrow.next { right: 14px; }
  .tdp-lb-counter {
    position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.5); font-size: 13px; font-family: var(--font-body);
  }

  /* ══════════════════════════════════════════
     BODY / DETAIL SECTIONS
  ══════════════════════════════════════════ */
  .tdp-body { max-width: 900px; margin: 0 auto; padding: 0 16px 80px; }

  .tdp-section { padding: 28px 0; border-bottom: 1px solid var(--cream-dark); }
  .tdp-section:last-child { border-bottom: none; }
  .tdp-sec-head {
    display: flex; align-items: center; gap: 10px;
    font-family: var(--font-display); font-size: 22px; font-weight: 700;
    color: var(--brown); margin-bottom: 20px; letter-spacing: -0.01em;
  }
  .tdp-sec-icon {
    width: 38px; height: 38px; border-radius: 10px;
    background: linear-gradient(135deg, rgba(232,101,10,0.12), rgba(200,150,12,0.06));
    border: 1px solid rgba(232,101,10,0.18);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }

  /* Tags */
  .tdp-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 20px 0 4px; }
  .tdp-chip {
    background: white; border: 1px solid var(--cream-dark);
    border-radius: 50px; padding: 5px 14px;
    font-size: 13px; color: var(--text-mid);
    font-family: var(--font-body); font-weight: 400;
  }

  /* History */
  .tdp-history-text {
    font-size: 16px; line-height: 1.9;
    color: var(--text-mid); margin-bottom: 18px;
    font-family: var(--font-body); font-weight: 400;
  }
  .tdp-significance {
    background: linear-gradient(135deg, #FFFBF0, #FDF5E0);
    border: 1px solid #E8D098;
    border-left: 4px solid var(--saffron);
    border-radius: var(--radius); padding: 20px;
  }
  .tdp-significance-label {
    font-family: var(--font-display); font-size: 10px;
    letter-spacing: .14em; text-transform: uppercase;
    color: var(--saffron); margin-bottom: 10px; font-weight: 600;
  }
  .tdp-significance-text { font-size: 15px; line-height: 1.8; color: var(--text-mid); }

  /* Info Grid */
  .tdp-info-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  }
  .tdp-info-item {
    background: white; border-radius: var(--radius);
    border: 1px solid var(--cream-dark); padding: 14px 16px;
    transition: var(--tr);
  }
  .tdp-info-item:hover { box-shadow: 0 4px 16px var(--shadow); }
  .tdp-info-item.full { grid-column: 1/-1; }
  .tdp-info-label {
    font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--text-light); font-family: var(--font-display); font-weight: 600;
    margin-bottom: 5px;
  }
  .tdp-info-value {
    font-size: 15px; font-weight: 500; color: var(--text-dark);
    display: flex; align-items: center; gap: 6px; font-family: var(--font-body);
  }

  /* Mantras */
  .tdp-mantra {
    background: linear-gradient(135deg, rgba(45,18,0,0.97), rgba(90,45,10,0.95));
    border-radius: var(--radius-lg); padding: 24px 22px; margin-bottom: 14px;
    color: white; position: relative; overflow: hidden;
  }
  .tdp-mantra::before {
    content: 'ॐ'; position: absolute; right: -10px; bottom: -10px;
    font-family: var(--font-hindi); font-size: 100px;
    color: rgba(255,255,255,0.04); line-height: 1; user-select: none;
  }
  .tdp-mantra-title {
    font-family: var(--font-display); font-size: 15px;
    letter-spacing: .05em; color: var(--gold-light); margin-bottom: 14px; font-weight: 600;
  }
  .tdp-mantra-sanskrit {
    font-family: var(--font-hindi); font-size: 22px; line-height: 1.75;
    color: white; margin-bottom: 12px; letter-spacing: .02em;
  }
  .tdp-mantra-roman {
    font-size: 14px; color: rgba(255,255,255,0.6);
    font-style: italic; line-height: 1.75; margin-bottom: 10px;
    font-family: var(--font-body);
  }
  .tdp-mantra-meaning {
    font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.7;
    border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; margin-top: 6px;
    font-family: var(--font-body);
  }

  /* Festivals */
  .tdp-festival {
    display: flex; gap: 16px; padding: 18px 0;
    border-bottom: 1px solid var(--cream-dark); align-items: flex-start;
  }
  .tdp-festival:last-child { border-bottom: none; }
  .tdp-festival-month {
    flex-shrink: 0; width: 50px; height: 50px;
    background: linear-gradient(135deg, var(--saffron), var(--saffron-dark));
    border-radius: 14px; color: white;
    font-family: var(--font-display); font-size: 12px; font-weight: 700;
    letter-spacing: .06em; text-transform: uppercase;
    display: flex; align-items: center; justify-content: center;
  }
  .tdp-festival-name {
    font-family: var(--font-display); font-size: 18px; font-weight: 700;
    color: var(--brown); margin-bottom: 5px;
    display: flex; align-items: center; gap: 8px;
  }
  .tdp-major-badge {
    font-size: 9px; background: rgba(232,101,10,0.1);
    border: 1px solid rgba(232,101,10,0.3); color: var(--saffron);
    padding: 2px 8px; border-radius: 50px; font-family: var(--font-body);
    letter-spacing: .08em; text-transform: uppercase; font-weight: 600;
  }
  .tdp-festival-desc { font-size: 14px; color: var(--text-light); line-height: 1.65; margin-top: 5px; font-family: var(--font-body); }

  /* Sevas */
  .tdp-seva {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; background: white;
    border-radius: var(--radius); border: 1px solid var(--cream-dark);
    margin-bottom: 10px; gap: 12px; transition: var(--tr);
  }
  .tdp-seva:hover { box-shadow: 0 4px 16px var(--shadow); }
  .tdp-seva-name { font-weight: 500; font-size: 15px; color: var(--text-dark); font-family: var(--font-body); }
  .tdp-seva-timing { font-size: 12px; color: var(--text-light); margin-top: 4px; font-family: var(--font-body); }
  .tdp-seva-price {
    font-family: var(--font-display); font-size: 18px; font-weight: 700;
    color: var(--saffron); white-space: nowrap; flex-shrink: 0;
  }

  /* QR */
  .tdp-qr-card {
    background: linear-gradient(135deg, var(--brown), var(--brown-mid));
    border-radius: var(--radius-lg); padding: 28px 20px;
    display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center;
  }
  .tdp-qr-id { font-family: var(--font-display); font-size: 12px; letter-spacing: .16em; color: var(--gold-light); font-weight: 600; }
  .tdp-qr-hint { font-size: 12px; color: rgba(255,255,255,0.45); font-family: var(--font-body); }
  .tdp-qr-btn {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
    color: white; border-radius: 50px; padding: 10px 24px;
    font-size: 12px; cursor: pointer; width: 100%;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    text-decoration: none; font-family: var(--font-body);
    transition: var(--tr);
  }
  .tdp-qr-btn:hover { background: rgba(255,255,255,0.18); }

  /* Translating pill */
  .tdp-translating {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(232,101,10,0.15); border: 1px solid rgba(232,101,10,0.4);
    color: var(--gold-light); padding: 5px 14px; border-radius: 50px;
    font-size: 11px; font-family: var(--font-hindi); margin-bottom: 14px;
  }

  /* Sticky bar */
  .tdp-sticky-bar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
    background: white; border-top: 1px solid var(--cream-dark);
    padding: 12px 16px; display: flex; gap: 10px;
    box-shadow: 0 -4px 24px rgba(61,31,0,0.1);
  }
  .tdp-cta-primary {
    flex: 1; background: linear-gradient(135deg, var(--saffron), var(--saffron-dark));
    color: white; border: none; border-radius: 50px; padding: 13px 20px;
    font-family: var(--font-display); font-size: 14px; font-weight: 600; letter-spacing: .04em;
    cursor: pointer; text-decoration: none;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    box-shadow: 0 4px 14px rgba(232,101,10,0.3);
  }
  .tdp-cta-outline {
    background: white; color: var(--text-mid);
    border: 2px solid var(--cream-dark); border-radius: 50%; padding: 0;
    width: 48px; height: 48px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; text-decoration: none; transition: var(--tr);
  }
  .tdp-cta-outline:hover { border-color: var(--saffron); color: var(--saffron); }

  /* Responsive */
  @media (min-width: 640px) {
    .tdp-header { padding: 36px 32px 40px; }
    .tdp-body { padding: 0 24px 80px; }
    .tdp-thumb-strip { padding: 12px 20px; }
    .tdp-thumb { flex: 0 0 90px; height: 65px; }
  }
  @media (min-width: 768px) {
    .tdp-sticky-bar { display: none; }
  }
  @media (max-width: 767px) {
    .tdp-body { padding-bottom: 100px; }
    .tdp-info-grid { grid-template-columns: 1fr; }
    .tdp-info-item.full { grid-column: 1; }
  }
`;

export default function TempleDetailPage() {
  const { slug }    = useParams();
  const navigate    = useNavigate();
  const { t }       = useTranslation();

  const [temple,    setTemple]    = useState(null);
  const [mantras,   setMantras]   = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [sevas,     setSevas]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const [allImages,   setAllImages]   = useState([]);
  const [slideIdx,    setSlideIdx]    = useState(0);
  const [lightbox,    setLightbox]    = useState(null);
  const slideTimer = useRef(null);

  const { translated: displayTemple, translating } = useTranslatedTemple(temple);

  useEffect(() => {
    if (!slug || slug === 'undefined') { navigate('/'); return; }

    const load = async () => {
      setLoading(true); setError(null);
      try {
        const res = await templeAPI.getBySlug(slug);
        const td  = res.data;
        setTemple(td);

        const imgs = [];
        if (td.hero_image_url) imgs.push(fixImageUrl(td.hero_image_url));

        try {
          const mediaRes = await templeAPI.getMedia?.(td.id);
          const mediaList = mediaRes?.data?.media || [];
          mediaList
            .filter(m => m.media_type === 'image')
            .forEach(m => {
              const url = fixImageUrl(m.file_url);
              if (!imgs.includes(url)) imgs.push(url);
            });
        } catch (_) {}

        setAllImages(imgs);

        const [m, f, s] = await Promise.allSettled([
          templeAPI.getMantras(td.id),
          templeAPI.getFestivals(td.id),
          templeAPI.getSevas(td.id),
        ]);
        if (m.status === 'fulfilled') setMantras(m.value.data || []);
        if (f.status === 'fulfilled') setFestivals(f.value.data || []);
        if (s.status === 'fulfilled') setSevas(s.value.data || []);
      } catch (err) {
        setError(err.response?.status === 404 ? 'Temple not found.' : 'Failed to load temple.');
      } finally {
        setLoading(false);
      }
    };

    load();
    window.scrollTo(0, 0);
  }, [slug, navigate]);

  // Auto-advance slides
  useEffect(() => {
    if (allImages.length < 2) return;
    slideTimer.current = setInterval(() => {
      setSlideIdx(i => (i + 1) % allImages.length);
    }, 5000);
    return () => clearInterval(slideTimer.current);
  }, [allImages]);

  const goSlide = (idx) => {
    clearInterval(slideTimer.current);
    setSlideIdx((idx + allImages.length) % allImages.length);
  };

  // Lightbox keyboard
  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e) => {
      if (e.key === 'ArrowRight') setLightbox(i => (i + 1) % allImages.length);
      if (e.key === 'ArrowLeft')  setLightbox(i => (i - 1 + allImages.length) % allImages.length);
      if (e.key === 'Escape')     setLightbox(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, allImages.length]);

  if (loading) return (
    <>
      <style>{styles}</style>
      <Navbar />
      <div className="tdp-loading">
        <div className="tdp-spinner" />
        <span style={{ color: 'var(--text-light)', fontSize: 14, fontFamily: 'var(--font-body)' }}>Loading temple…</span>
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{styles}</style>
      <Navbar />
      <div className="tdp-error">
        <div style={{ fontSize: 60 }}>🛕</div>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 28 }}>Temple Not Found</h2>
        <p style={{ color: 'var(--text-light)', fontFamily: 'var(--font-body)' }}>{error}</p>
        <button style={{ marginTop: 16, background: 'var(--saffron)', color: 'white', border: 'none', borderRadius: 50, padding: '12px 28px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 14 }} onClick={() => navigate('/')}>← All Temples</button>
      </div>
    </>
  );

  if (!displayTemple) return null;

  const qrUrl    = `${window.location.origin}/temple/${slug}`;
  const templeId = `BM-${(displayTemple.state || 'IN').substring(0,2).toUpperCase()}-${String(displayTemple.id).padStart(4,'0')}`;
  const mapsUrl  = displayTemple.latitude
    ? `https://www.google.com/maps/search/?api=1&query=${displayTemple.latitude},${displayTemple.longitude}`
    : null;

  return (
    <>
      <style>{styles}</style>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="tdp-lightbox" onClick={() => setLightbox(null)}>
          <div className="tdp-lightbox-img-wrap" onClick={e => e.stopPropagation()}>
            <img
              src={allImages[lightbox]}
              alt={`${displayTemple.name} — photo ${lightbox + 1}`}
              loading="eager"
            />
          </div>
          <button className="tdp-lightbox-close" onClick={() => setLightbox(null)}><X size={20} /></button>
          {allImages.length > 1 && (
            <>
              <button className="tdp-lb-arrow prev" onClick={e => { e.stopPropagation(); setLightbox(i => (i - 1 + allImages.length) % allImages.length); }}><ChevronLeft size={22} /></button>
              <button className="tdp-lb-arrow next" onClick={e => { e.stopPropagation(); setLightbox(i => (i + 1) % allImages.length); }}><ChevronLeft size={22} style={{ transform: 'rotate(180deg)' }} /></button>
              <div className="tdp-lb-counter">{lightbox + 1} / {allImages.length}</div>
            </>
          )}
        </div>
      )}

      <Navbar />

      {/* ══ 1. NAME & INFO HEADER ══ */}
      <div className="tdp-header">
        <div className="tdp-header-inner">
          {translating && <div className="tdp-translating">⏳ अनुवाद हो रहा है...</div>}

          <div className="tdp-breadcrumb">
            <Link to="/">Home</Link>
            <ChevronRight size={10} />
            <Link to="/">Temples</Link>
            <ChevronRight size={10} />
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{displayTemple.name}</span>
          </div>

          <div className="tdp-badges">
            {displayTemple.is_jyotirlinga   && <span className="tdp-badge">⚡ Jyotirlinga</span>}
            {displayTemple.is_shaktipeeth   && <span className="tdp-badge">🌸 Shaktipeeth</span>}
            {displayTemple.is_heritage_site && <span className="tdp-badge">🏛️ Heritage</span>}
            {displayTemple.sect             && <span className="tdp-badge">{displayTemple.sect}</span>}
            {displayTemple.verified         && <span className="tdp-badge verified">✓ Verified</span>}
          </div>

          <h1 className="tdp-hero-title">{displayTemple.name}</h1>
          {displayTemple.name_hindi && <div className="tdp-hero-hindi">{displayTemple.name_hindi}</div>}

          <div className="tdp-hero-meta">
            <span className="tdp-hero-meta-item"><MapPin size={13} />{displayTemple.city}, {displayTemple.state}</span>
            {displayTemple.primary_deity && <span className="tdp-hero-meta-item">🙏 {displayTemple.primary_deity}</span>}
            {displayTemple.opening_time  && <span className="tdp-hero-meta-item"><Clock size={13} />{displayTemple.opening_time} – {displayTemple.closing_time}</span>}
            {displayTemple.entry_fee === 0 && <span className="tdp-hero-meta-item">✅ Free Entry</span>}
            {displayTemple.entry_fee > 0  && <span className="tdp-hero-meta-item">₹{displayTemple.entry_fee} entry</span>}
          </div>
        </div>
      </div>

      {/* ══ 2. PHOTO GALLERY ══ */}
      <div className="tdp-gallery-wrap">
        <div className="tdp-gallery-inner">
        {allImages.length > 0 ? (
          <>
            <div className="tdp-main-photo" onClick={() => setLightbox(slideIdx)}>
              <img
                src={allImages[slideIdx]}
                alt={`${displayTemple.name} — photo ${slideIdx + 1}`}
                loading="eager"
                decoding="async"
              />
              {allImages.length > 1 && (
                <>
                  <button className="tdp-photo-nav prev" onClick={e => { e.stopPropagation(); goSlide(slideIdx - 1); }}>
                    <ChevronLeft size={20} />
                  </button>
                  <button className="tdp-photo-nav next" onClick={e => { e.stopPropagation(); goSlide(slideIdx + 1); }}>
                    <ChevronLeft size={20} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <div className="tdp-photo-counter">{slideIdx + 1} / {allImages.length}</div>
                </>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="tdp-thumb-strip">
                {allImages.map((src, i) => (
                  <div
                    key={src}
                    className={`tdp-thumb${i === slideIdx ? ' active' : ''}`}
                    onClick={() => goSlide(i)}
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="tdp-no-photo">ॐ</div>
        )}
        </div>
      </div>

      {/* ══ 3. DETAIL SECTIONS ══ */}
      <div className="tdp-body">

        {/* Tags */}
        {displayTemple.category_tags?.length > 0 && (
          <div className="tdp-chips">
            {displayTemple.category_tags.map(tag => (
              <span key={tag} className="tdp-chip">#{tag}</span>
            ))}
          </div>
        )}

        {/* History & Significance */}
        {(displayTemple.history || displayTemple.significance) && (
          <div className="tdp-section">
            <div className="tdp-sec-head">
              <div className="tdp-sec-icon">📜</div>
              History & Significance
            </div>
            {displayTemple.history && <p className="tdp-history-text">{displayTemple.history}</p>}
            {displayTemple.significance && (
              <div className="tdp-significance">
                <div className="tdp-significance-label">Why Visit</div>
                <p className="tdp-significance-text">{displayTemple.significance}</p>
              </div>
            )}
          </div>
        )}

        {/* Temple Info */}
        <div className="tdp-section">
          <div className="tdp-sec-head">
            <div className="tdp-sec-icon">ℹ️</div>
            Temple Information
          </div>
          <div className="tdp-info-grid">
            {displayTemple.primary_deity        && <InfoItem label="Primary Deity"   value={displayTemple.primary_deity} />}
            {displayTemple.sect                 && <InfoItem label="Sect"             value={displayTemple.sect} />}
            {displayTemple.temple_type          && <InfoItem label="Type"             value={displayTemple.temple_type} />}
            {displayTemple.architecture_style   && <InfoItem label="Architecture"     value={displayTemple.architecture_style} />}
            {displayTemple.estimated_year_built && <InfoItem label="Est. Year Built"  value={displayTemple.estimated_year_built} />}
            {displayTemple.dress_code           && <InfoItem label="Dress Code"       value={displayTemple.dress_code} />}
            {displayTemple.opening_time         && <InfoItem label="Opens"            value={displayTemple.opening_time} />}
            {displayTemple.closing_time         && <InfoItem label="Closes"           value={displayTemple.closing_time} />}
            {displayTemple.entry_fee !== null   && (
              <InfoItem label="Entry Fee" value={displayTemple.entry_fee === 0 ? 'Free' : `₹${displayTemple.entry_fee}`} />
            )}
            {displayTemple.best_time_to_visit   && <InfoItem label="Best Time" value={displayTemple.best_time_to_visit} full />}
            {displayTemple.address              && <InfoItem label="Address"    value={displayTemple.address} full />}
            {displayTemple.nearest_railway && (
              <InfoItem label="Nearest Railway" value={
                <><Train size={13} style={{ color: 'var(--saffron)' }} />{displayTemple.nearest_railway}</>
              } />
            )}
            {displayTemple.nearest_airport && (
              <InfoItem label="Nearest Airport" value={
                <><Plane size={13} style={{ color: 'var(--saffron)' }} />{displayTemple.nearest_airport}</>
              } />
            )}
          </div>
        </div>

        {/* Mantras */}
        {mantras.length > 0 && (
          <div className="tdp-section">
            <div className="tdp-sec-head"><div className="tdp-sec-icon">🕉️</div>Mantras</div>
            {mantras.map((m) => (
              <div key={m.id} className="tdp-mantra">
                <div className="tdp-mantra-title">
                  {m.title}
                  {m.mantra_type && <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400, fontSize: 11, marginLeft: 8 }}>· {m.mantra_type}</span>}
                </div>
                {m.sanskrit        && <div className="tdp-mantra-sanskrit">{m.sanskrit}</div>}
                {m.transliteration && <div className="tdp-mantra-roman">{m.transliteration}</div>}
                {m.meaning         && <div className="tdp-mantra-meaning">{m.meaning}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Festivals */}
        {festivals.length > 0 && (
          <div className="tdp-section">
            <div className="tdp-sec-head"><div className="tdp-sec-icon">🎉</div>Festivals</div>
            {festivals.map((f, i) => (
              <div key={i} className="tdp-festival">
                <div className="tdp-festival-month">{f.month ? MONTHS[f.month] : '—'}</div>
                <div>
                  <div className="tdp-festival-name">
                    {f.name}
                    {f.is_major && <span className="tdp-major-badge">Major</span>}
                  </div>
                  {f.hindu_month && <div style={{ fontSize: 12, color: 'var(--saffron)', margin: '3px 0', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.05em' }}>{f.hindu_month} Month</div>}
                  {f.description && <div className="tdp-festival-desc">{f.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sevas */}
        {sevas.length > 0 && (
          <div className="tdp-section">
            <div className="tdp-sec-head"><div className="tdp-sec-icon">🙏</div>Sevas & Offerings</div>
            {sevas.map((s) => (
              <div key={s.id} className="tdp-seva">
                <div>
                  <div className="tdp-seva-name">{s.name}</div>
                  {s.timing && <div className="tdp-seva-timing">⏰ {s.timing}</div>}
                  {s.advance_booking && <div style={{ fontSize: 11, color: 'var(--saffron)', marginTop: 3, fontFamily: 'var(--font-display)', fontWeight: 600 }}>Advance Booking Required</div>}
                </div>
                <div className="tdp-seva-price">
                  {s.is_free ? 'Free' : s.price ? `₹${s.price}` : '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* QR Code */}
        <div className="tdp-section">
          <div className="tdp-sec-head"><div className="tdp-sec-icon">🔳</div>Temple QR Code</div>
          <div className="tdp-qr-card">
            <div className="tdp-qr-id">{templeId}</div>
            <div style={{ background: 'white', padding: 14, borderRadius: 14 }}>
              <QRCodeSVG value={qrUrl} size={150} fgColor="#3D1F00" bgColor="#FFFFFF" level="H" />
            </div>
            <div className="tdp-qr-hint">Scan to share this temple</div>
            <button className="tdp-qr-btn" onClick={() => navigate(`/qr/${slug}`)}>
              <QrCode size={13} /> Full QR Page
            </button>
          </div>
        </div>

        {/* Desktop action links */}
        <div className="tdp-section" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, minWidth: 160, background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))', color: 'white', border: 'none', borderRadius: 50, padding: '13px 20px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, letterSpacing: '.04em', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              🗺️ Get Directions
            </a>
          )}
          {displayTemple.website_url && (
            <a href={displayTemple.website_url} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, minWidth: 160, background: 'white', color: 'var(--text-mid)', border: '2px solid var(--cream-dark)', borderRadius: 50, padding: '11px 20px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, letterSpacing: '.04em', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ExternalLink size={14} /> Official Website
            </a>
          )}
          <Link to="/"
            style={{ flex: 1, minWidth: 160, background: 'white', color: 'var(--text-mid)', border: '2px solid var(--cream-dark)', borderRadius: 50, padding: '11px 20px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, letterSpacing: '.04em', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            ← All Temples
          </Link>
        </div>

      </div>

      {/* Sticky CTA bar (mobile) */}
      <div className="tdp-sticky-bar">
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="tdp-cta-primary">
            🗺️ Get Directions
          </a>
        ) : (
          <Link to="/" className="tdp-cta-primary">← All Temples</Link>
        )}
        {displayTemple.website_url && (
          <a href={displayTemple.website_url} target="_blank" rel="noopener noreferrer" className="tdp-cta-outline">
            <ExternalLink size={18} />
          </a>
        )}
        <button className="tdp-cta-outline" onClick={() => navigate(`/qr/${slug}`)}>
          <QrCode size={18} />
        </button>
      </div>

      <Footer />
    </>
  );
}

function InfoItem({ label, value, full }) {
  return (
    <div className={`tdp-info-item${full ? ' full' : ''}`}>
      <div className="tdp-info-label">{label}</div>
      <div className="tdp-info-value">{value}</div>
    </div>
  );
}