import { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   THEME — matches the hero banner gradient (brown → saffron/gold)
═══════════════════════════════════════════════════════════════ */
export const THEME_COLOR = '#8b3a15';
export const THEME_COLOR_DARK = '#5c2208';
export const THEME_GOLD = '#FFD580';

/* ═══════════════════════════════════════════════════════════════
   AUDIO — Web Speech API
═══════════════════════════════════════════════════════════════ */
export function speakVerse(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-IN';
  utt.rate = 0.85;
  utt.pitch = 1;
  window.speechSynthesis.speak(utt);
}
export function stopSpeaking() { window.speechSynthesis?.cancel(); }

/* ═══════════════════════════════════════════════════════════════
   SOURCE ATTRIBUTION
═══════════════════════════════════════════════════════════════ */
const SOURCE_LABELS = {
  bhagavad_gita_api: 'vedicscriptures.github.io — 21 traditional commentators',
  valmiki_ramayana:  'Valmiki_Ramayan_Dataset (MIT) — M.N. Dutt translation, IIT Kanpur, Gyaandweep',
  mahabharata:       'DharmicData (MIT) — Sanskrit shlokas, English edition in progress',
  hanuman_chalisa:   'Tulsidas, public domain — glosses & commentary curated in-house',
  shiva_purana:      'Shiva Purana, public domain — Motilal Banarsidass edition',
  devi_mahatmya:     'Devi Mahatmya / Durga Saptashati, public domain — Ramakrishna Math edition',
  ramcharitmanas:    'Tulsidas, public domain — WirelessAlien/Ramcharitmanas dataset',
  upanishads:        'Principal Upanishads, public domain — Max Müller, Sacred Books of the East',
  rigveda:           'Rigveda, public domain — DharmicData (ODbL)',
  yajurveda:         'Shukla Yajurveda, public domain — DharmicData (ODbL)',
  atharvaveda:       'Atharvaveda, public domain — DharmicData (ODbL)',
  manusmriti:        'Manusmriti, public domain — Georg Bühler translation',
  vishnu_purana:     'Vishnu Purana, public domain — H.H. Wilson translation',
  yoga_sutras:       'Yoga Sutras of Patanjali, public domain — Charles Johnston translation',
  bhagavata_purana:  'GRETIL — Bhagavata-Puranam, Skandhas 1–12',
};

export function getSourceLabel(book) {
  return SOURCE_LABELS[book.api_source] || 'Traditional text';
}

/* ═══════════════════════════════════════════════════════════════
   BOOK ICON
═══════════════════════════════════════════════════════════════ */
export function BookIcon({ size = 48, color = THEME_COLOR, style = {} }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      <rect x="4" y="6" width="6" height="36" rx="2" fill={color} opacity="0.85" />
      <rect x="10" y="6" width="34" height="36" rx="2" fill={`${color}18`} stroke={color} strokeWidth="1.8" />
      <rect x="13" y="9" width="28" height="30" rx="1.5" fill="none" stroke={color} strokeWidth="0.9" opacity="0.5" />
      <text x="27" y="30" textAnchor="middle" fontSize="20" fontWeight="900" fill={color}
        fontFamily="Georgia, 'Noto Serif Devanagari', serif" opacity="0.9">ॐ</text>
      <line x1="15" y1="14" x2="39" y2="14" stroke={color} strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOLDER ICON — for category cards
═══════════════════════════════════════════════════════════════ */
export function FolderIcon({ size = 48, color = THEME_COLOR, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block', ...style }}>
      <path d="M6 14a2 2 0 0 1 2-2h10l4 5h18a2 2 0 0 1 2 2v19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V14z"
        fill={`${color}18`} stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 18h36" stroke={color} strokeWidth="1.2" opacity="0.35" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════════ */
export function Spinner({ color = 'var(--saffron)' }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: `3px solid ${color}33`, borderTopColor: color,
      animation: 'spin 0.8s linear infinite', margin: '40px auto',
    }} />
  );
}

export function ProgressBar({ percent, color }) {
  return (
    <div style={{ height: 4, borderRadius: 99, background: `${color}22`, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${percent}%`,
        background: `linear-gradient(90deg, ${color}, ${color}99)`,
        borderRadius: 99, transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

export function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(30,20,10,0.92)', color: '#FFD580',
      padding: '10px 22px', borderRadius: 99, fontSize: 13, fontWeight: 600,
      zIndex: 9999, backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)', animation: 'fadeDown 0.22s ease', whiteSpace: 'nowrap',
    }}>{message}</div>
  );
}

/* Shared keyframes + mobile rules — mount once per page that uses these components */
export function SacredBooksGlobalStyle() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
      @media (max-width: 768px) {
        .reader-grid { grid-template-columns: 1fr !important; }
        .chapter-sidebar { display: none !important; position: static !important; max-height: 280px !important; }
        .chapter-sidebar.sidebar-open { display: flex !important; margin-bottom: 16px; }
        .mobile-chapter-toggle { display: block !important; }
      }
    `}</style>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VERSE CARD — used only in the reader page
═══════════════════════════════════════════════════════════════ */
export function VerseCard({ verse, bookColor, bookmarks, onBookmarkToggle, speakingVerse, onSpeak }) {
  const [showSanskrit, setShowSanskrit] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const key = `${verse.chapter_number}-${verse.verse_number}`;
  const isBookmarked = bookmarks.some(
    b => b.chapter_number === verse.chapter_number && b.verse_number === verse.verse_number
  );
  const isSpeaking = speakingVerse === key;

  return (
    <div
      id={`verse-${verse.verse_number}`}
      style={{
        borderRadius: 'var(--radius-lg)',
        border: `1.5px solid ${isBookmarked ? bookColor + '88' : bookColor + '33'}`,
        background: isBookmarked ? `${bookColor}06` : 'white',
        marginBottom: 16, overflow: 'hidden', transition: 'border-color 0.2s',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: `${bookColor}0A`, borderBottom: `1px solid ${bookColor}18`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: bookColor, letterSpacing: '0.07em' }}>
          {verse.chapter_number}.{verse.verse_number}
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setShowSanskrit(s => !s)} title="Toggle Sanskrit" style={{
            padding: '4px 10px', borderRadius: 99, border: `1px solid ${bookColor}33`,
            background: showSanskrit ? bookColor : 'transparent', color: showSanskrit ? 'white' : bookColor,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}>ॐ Sanskrit</button>
          <button onClick={() => onSpeak(key, verse.translation)} title={isSpeaking ? 'Stop' : 'Listen'} style={{
            padding: '4px 10px', borderRadius: 99, border: `1px solid ${bookColor}33`,
            background: isSpeaking ? bookColor : 'transparent', color: isSpeaking ? 'white' : bookColor,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}>{isSpeaking ? '⏹ Stop' : '🔊 Listen'}</button>
          <button onClick={() => onBookmarkToggle(verse)} title={isBookmarked ? 'Remove bookmark' : 'Bookmark this verse'} style={{
            padding: '4px 8px', borderRadius: 99, border: `1px solid ${bookColor}33`,
            background: isBookmarked ? bookColor : 'transparent', color: isBookmarked ? 'white' : bookColor,
            fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
          }}>{isBookmarked ? '🔖' : '☆'}</button>
        </div>
      </div>
      <div style={{ padding: '14px 18px' }}>
        {showSanskrit && verse.sanskrit && (
          <div style={{
            fontFamily: 'var(--font-hindi)', fontSize: 17, color: bookColor,
            lineHeight: 2, marginBottom: 12, whiteSpace: 'pre-line', animation: 'fadeDown 0.2s ease',
          }}>{verse.sanskrit}</div>
        )}
        {showSanskrit && verse.transliteration && (
          <div style={{
            fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic',
            marginBottom: 12, lineHeight: 1.7, whiteSpace: 'pre-line',
          }}>{verse.transliteration}</div>
        )}
        {verse.translation && (
          <p style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.85, margin: 0 }}>
            {verse.translation}
          </p>
        )}
        {verse.commentary && (
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShowCommentary(c => !c)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
              color: 'var(--text-muted)', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ transform: showCommentary ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
              {showCommentary ? 'Hide' : 'Show'} Commentary
            </button>
            {showCommentary && (
              <p style={{
                marginTop: 8, fontSize: 13, color: 'var(--text-light)', lineHeight: 1.8, fontStyle: 'italic',
                borderLeft: `3px solid ${bookColor}44`, paddingLeft: 12, animation: 'fadeDown 0.2s ease',
              }}>{verse.commentary}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}