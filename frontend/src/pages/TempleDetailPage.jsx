import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemple } from '../hooks/useTranslatedData';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function proxyImageUrl(url) { return url || null; }
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
.hero-grad{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,5,0,.08) 0%,rgba(10,5,0,0) 25%,rgba(10,5,0,.55) 60%,rgba(10,5,0,.95) 100%);pointer-events:none;}
.hero-diya{position:absolute;top:24%;left:50%;transform:translateX(-50%);font-size:52px;animation:diya 3s ease-in-out infinite;z-index:2;}
.hero-body{position:relative;z-index:3;padding:0 52px 56px;width:100%;text-align:center;animation:up .6s ease .1s both;}

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
.snav{position:sticky;top:0;z-index:50;background:rgba(250,246,238,.97);backdrop-filter:blur(16px);border-bottom:1px solid #EDE3CE;display:flex;padding:0 52px;box-shadow:0 2px 10px rgba(44,21,0,.07);overflow-x:auto;scrollbar-width:none;}
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

/* ─── TIMING STRIP (fixed) ─── */
.tstrip{
  display:flex;gap:0;flex-wrap:wrap;
  background:#F7F0E2;border-radius:12px;
  margin-bottom:17px;overflow:hidden;
  border:1px solid #EDE3CE;
}
.tblock{
  flex:1;min-width:100px;
  text-align:center;padding:16px 12px;
  position:relative;
}
.tblock+.tblock::before{
  content:'';position:absolute;
  left:0;top:18%;height:64%;width:1px;
  background:#DDD0B8;
}
/* Single readable font for all time values */
.tval{
  font-family:'DM Sans',system-ui,sans-serif;
  font-size:16px;font-weight:700;
  color:#C8520A;letter-spacing:.01em;line-height:1.3;
}
.tlbl{
  font-size:10px;text-transform:uppercase;
  letter-spacing:.1em;color:#A07050;
  margin-top:5px;font-weight:600;
}

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
/* QR BOX */
.upi-qr-box{background:linear-gradient(135deg,#FFF8F0,#FFF4EB);border:2px solid #EDE3CE;border-radius:14px;padding:18px 16px;margin-bottom:13px;text-align:center;}
.upi-qr-label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#A07050;font-weight:700;margin-bottom:10px;}
.upi-qr-img{width:180px;height:180px;border-radius:10px;border:3px solid #fff;box-shadow:0 4px 20px rgba(200,82,10,.15);display:block;margin:0 auto 10px;}
.upi-qr-hint{font-size:11px;color:#A07050;line-height:1.5;}
.upi-qr-hint strong{color:#C8520A;}
.upi-qr-placeholder{width:180px;height:180px;border-radius:10px;background:#F7F0E2;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:13px;color:#A07050;border:2px dashed #EDE3CE;}
/* ID COPY */
.upi-id-copy{display:flex;align-items:center;justify-content:space-between;background:#F7F0E2;border-radius:9px;padding:9px 12px;margin-bottom:13px;border:1px solid #EDE3CE;}
.upi-id-text{font-size:12.5px;font-weight:600;color:#2C1500;}
.upi-copy-btn{font-size:11px;font-weight:700;color:#C8520A;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;padding:4px 8px;border-radius:5px;transition:.15s;}
.upi-copy-btn:hover{background:#FFF4EB;}
.upi-cancel{width:100%;padding:11px;border-radius:9px;border:1.5px solid #EDE3CE;background:#fff;font-size:13px;font-weight:600;color:#7A5538;cursor:pointer;font-family:'DM Sans',sans-serif;transition:.15s;}
.upi-cancel:hover{background:#F7F0E2;}

@media(max-width:1024px){.wrap{padding:20px 20px 60px;}.snav{padding:0 20px;}.hero-body{padding-left:20px;padding-right:20px;}}
@media(max-width:640px){.hero{height:auto;min-height:380px;}.hero-h1{font-size:clamp(22px,7vw,36px)}.hero-hindi{font-size:clamp(22px,7vw,36px)}.ig{grid-template-columns:1fr 1fr;}.ii.full{grid-column:1/-1;}.wrap{padding:14px 14px 60px;}.sec{padding:17px 15px;}.tstrip{flex-wrap:wrap;}.tblock{min-width:50%;}.tblock+.tblock::before{display:none;}}
`;

function HeroImage({ src, alt }) {
  if (!src) return null;
  return <img src={src} alt={alt} className="hero-img" onError={e => e.currentTarget.style.display='none'} />;
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

function ReadMore({ children, label = 'Read More' }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {open && <div style={{marginTop:14}}>{children}</div>}
      <button className="rm-btn" onClick={() => setOpen(o => !o)}>
        {open ? '▲ Show Less' : `▼ ${label}`}
      </button>
    </div>
  );
}

/* ── UPI DONATION MODAL (QR Code based — no browser security rejection) ── */
const PRESET_AMOUNTS = [51, 101, 251, 501, 1001, 5001];

function UpiModal({ upiId, payeeName, onClose }) {
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);

  // Build the UPI string that goes INTO the QR code
  // When user scans this QR with GPay/PhonePe/Paytm, it opens directly inside the app
  // — no browser security rejection because the app itself reads the QR
  const buildUpiString = () => {
    const amt = parseFloat(amount) || 0;
    const pn  = encodeURIComponent(payeeName || 'Temple Trust');
    const tn  = encodeURIComponent('Donation to ' + (payeeName || 'Temple'));
    if (amt > 0) {
      return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${pn}&am=${amt.toFixed(2)}&cu=INR&tn=${tn}`;
    }
    // No amount yet — QR just has UPI ID so user can enter amount in their app
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${pn}&cu=INR&tn=${tn}`;
  };

  // Free QR API — no key needed, works forever
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
        <div className="upi-modal-h">🙏 Donate via UPI</div>
        <div className="upi-modal-sub">Select amount → scan QR with any UPI app</div>

        {/* Step 1 — pick amount */}
        <div className="upi-amounts">
          {PRESET_AMOUNTS.map(a => (
            <button
              key={a}
              className={`upi-amt-btn${String(amount) === String(a) ? ' sel' : ''}`}
              onClick={() => setAmount(String(a))}
            >₹{a}</button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="upi-input-wrap">
          <span className="upi-input-pre">₹</span>
          <input
            className="upi-input"
            type="number"
            min="1"
            placeholder="Or enter custom amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        {/* Step 2 — QR code (updates live as amount changes) */}
        <div className="upi-qr-box">
          <div className="upi-qr-label">
            📱 Scan with GPay · PhonePe · Paytm · Any UPI App
          </div>
          <img
            key={qrUrl}
            src={qrUrl}
            alt="UPI Payment QR Code"
            className="upi-qr-img"
          />
          <div className="upi-qr-hint">
            {amount
              ? <>QR includes <strong>₹{amount}</strong> — amount is pre-filled in your UPI app</>
              : <>No amount selected — you can enter it in your UPI app after scanning</>
            }
          </div>
        </div>

        {/* Manual fallback — copy UPI ID */}
        <div className="upi-id-copy">
          <span className="upi-id-text">📋 UPI ID: {upiId}</span>
          <button className="upi-copy-btn" onClick={handleCopy}>
            {copied ? '✅ Copied!' : 'Copy'}
          </button>
        </div>

        <button className="upi-cancel" onClick={onClose}>Close</button>
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
  const [showUpiModal, setShowUpiModal] = useState(false);   // ← new

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

  if (loading) return (<><style>{CSS}</style><Navbar/><div className="loading"><div className="spinner"/><span style={{color:'#A07050',fontSize:14}}>Loading temple…</span></div></>);
  if (error)   return (<><style>{CSS}</style><Navbar/><div className="err"><div style={{fontSize:60}}>🛕</div><h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28}}>Temple Not Found</h2><p style={{color:'#A07050'}}>{error}</p><button style={{marginTop:16,padding:'10px 22px',background:'#C8520A',color:'#fff',border:'none',borderRadius:9,cursor:'pointer',fontSize:14}} onClick={()=>navigate('/')}>← All Temples</button></div></>);
  if (!T) return (<><style>{CSS}</style><Navbar/><div className="loading"><div className="spinner"/></div></>);

  const heroImg   = proxyImageUrl(T.hero_image_url);
  const openTime  = formatTime(T.opening_time);
  const closeTime = formatTime(T.closing_time);
  const acStart   = formatTime(T.afternoon_closure_start);
  const acEnd     = formatTime(T.afternoon_closure_end);
  const fee       = displayFee(T.entry_fee);
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

  const navItems = [
    { id:'overview',   label:'Overview',   show: true },
    { id:'history',    label:'History',    show: v(T.history)||v(T.significance)||v(T.puranic_stories) },
    { id:'puja',       label:'Puja',       show: pujaSchedule.length>0 || pujaServices.length>0 },
    { id:'mantras',    label:'Mantras',    show: mantras.length>0 },
    { id:'festivals',  label:'Festivals',  show: festivals.length>0 },
    { id:'sevas',      label:'Sevas',      show: sevas.length>0 },
    { id:'facilities', label:'Facilities', show: facilities.length>0||programs.length>0 },
    { id:'priests',    label:'Priests',    show: priests.length>0 },
    { id:'contact',    label:'Contact',    show: true },
  ].filter(n => n.show);

  const scrollTo = (id) => {
    setActiveNav(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  const addressLine = T.address || [T.city, T.state].filter(v).join(', ');

  const previewFacts = [
    { label:'Primary Deity', value: T.primary_deity, icon:'🙏' },
    { label:'Sect',          value: T.sect },
    { label:'Architecture',  value: T.architecture_style },
    { label:'Est. Built',    value: T.estimated_year_built },
    { label:'Setting',       value: T.setting_environment, icon:'🌿' },
    { label:'Dress Code',    value: T.dress_code, icon:'👗' },
  ].filter(i => v(i.value)).slice(0, 6);

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {/* UPI MODAL */}
      {showUpiModal && (
        <UpiModal
          upiId={T.upi_id}
          payeeName={T.name}
          onClose={() => setShowUpiModal(false)}
        />
      )}

      {/* ══ HERO ══ */}
      <div className="hero">
        {heroImg ? <HeroImage src={heroImg} alt={T.name} /> : <div className="hero-diya">🪔</div>}
        <div className="hero-grad"/>
        <div className="hero-body">
          <div className="hero-bc">
            <a href="/">Home</a><sep>/</sep>
            <span>{T.state}</span><sep>/</sep>
            <span>{T.city}</span><sep>/</sep>
            <span>{T.name}</span>
          </div>
          <div className="badges">
            {T.is_jyotirlinga      && <span className="badge saffron">⚡ Jyotirlinga</span>}
            {T.is_shaktipeeth      && <span className="badge saffron">🌸 Shaktipeeth</span>}
            {T.is_char_dham        && <span className="badge saffron">🔱 Char Dham</span>}
            {T.is_ashtavinayak     && <span className="badge saffron">🐘 Ashtavinayak</span>}
            {T.is_divya_desam      && <span className="badge saffron">🪷 Divya Desam</span>}
            {T.is_pancha_bhuta     && <span className="badge saffron">🌊 Pancha Bhuta</span>}
            {T.is_51_shakti_peeths && <span className="badge saffron">51 Shakti Peeths</span>}
            {T.is_heritage_site    && <span className="badge blue">🏛️ Heritage</span>}
            {T.is_unesco_heritage  && <span className="badge blue">🌍 UNESCO</span>}
            {T.is_state_heritage   && <span className="badge blue">⭐ State Heritage</span>}
            {T.is_asi_protected    && <span className="badge blue">🏺 ASI Protected</span>}
            {T.verified            && <span className="badge green">✓ Verified</span>}
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
          <div className="tags">{tags.map(t=><span key={t} className="tag">#{t}</span>)}</div>
        )}

        {/* ── OVERVIEW ── */}
        <div className="sec" id="overview">
          <div className="sec-h"><div className="sec-icon">🛕</div>Temple Information</div>

          {/* ── Timing strip — clean, readable ── */}
          {(openTime || fee || acStart) && (
            <div className="tstrip">
              {openTime  && (
                <div className="tblock">
                  <div className="tval">{openTime}</div>
                  <div className="tlbl">Opens</div>
                </div>
              )}
              {closeTime && (
                <div className="tblock">
                  <div className="tval">{closeTime}</div>
                  <div className="tlbl">Closes</div>
                </div>
              )}
              {acStart && acEnd && (
                <div className="tblock">
                  <div className="tval">{acStart} – {acEnd}</div>
                  <div className="tlbl">Afternoon Break</div>
                </div>
              )}
              {fee && (
                <div className="tblock">
                  <div className="tval">{fee}</div>
                  <div className="tlbl">Entry</div>
                </div>
              )}
              {v(T.prasad_type) && (
                <div className="tblock">
                  <div className="tval">{T.prasad_type}</div>
                  <div className="tlbl">Prasad</div>
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

          <ReadMore label="More Details">
            <div className="ig">
              <II label="Temple Type"        value={T.temple_type}/>
              <II label="Founded By"         value={T.founded_by}/>
              <II label="Last Renovation"    value={T.last_renovation_year}/>
              <II label="Building Condition" value={T.building_condition}/>
              <II label="Managing Authority" value={T.managing_authority}/>
              <II label="Trust Name"         value={T.trust_name}/>
              <II label="Local Landmark"     value={T.local_landmark} icon="🏛️"/>
              <II label="Weekly Special Day" value={T.weekly_special_day} icon="⭐"/>
              {v(T.online_puja_available) && T.online_puja_available!=='no' && (
                <II label="Online Puja" value={T.online_puja_available==='yes'?'Available ✅':'Coming Soon 🔜'}/>
              )}
              <II label="Local Name"         value={T.name_local}/>
              <II label="Best Time to Visit" value={T.best_time_to_visit} icon="📅" full/>
              <II label="Address"            value={T.address} icon="📌" full/>
            </div>
          </ReadMore>
        </div>

        {/* ── HISTORY & SIGNIFICANCE ── */}
        {(v(T.history)||v(T.significance)||v(T.sthala_purana)||v(T.puranic_stories)||v(T.history_hindi)) && (
          <div className="sec" id="history">
            <div className="sec-h"><div className="sec-icon">📜</div>History & Significance</div>
            {v(T.history) && (
              <p className="prose" style={{display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden',marginBottom:0}}>{T.history}</p>
            )}
            <ReadMore label="Read Full History">
              {v(T.history)         && <p className="prose">{T.history}</p>}
              {v(T.sthala_purana)   && <p className="prose prose-sm" style={{fontStyle:'italic',marginBottom:14}}>{T.sthala_purana}</p>}
              {v(T.puranic_stories) && (<div className="puranic"><div className="puranic-lbl">📖 Puranic Story</div><p className="prose-sm" style={{fontStyle:'italic'}}>{T.puranic_stories}</p></div>)}
              {v(T.significance)    && (<div className="significance"><div className="sig-lbl">✨ Why Visit</div><p style={{fontSize:14,lineHeight:1.8,color:'#7A5538'}}>{T.significance}</p></div>)}
              {v(T.history_hindi)   && (<div className="hindi-block"><div className="hindi-lbl">हिंदी में इतिहास</div><p style={{fontFamily:"'Noto Sans Devanagari',sans-serif",fontSize:14,lineHeight:1.9,color:'#7A5538'}}>{T.history_hindi}</p></div>)}
            </ReadMore>
          </div>
        )}

        {/* ── PUJA & SERVICES ── */}
        {(pujaSchedule.length>0 || pujaServices.length>0) && (
          <div className="sec" id="puja">
            <div className="sec-h"><div className="sec-icon">🕉️</div>Puja & Aarti</div>
            {pujaSchedule.slice(0,3).map((p,i)=>(
              <div key={i} className="prow">
                <div><span className="pname">{p.puja_name}</span>{p.puja_type&&<span style={{fontSize:11,color:'#A07050',marginLeft:8}}>{p.puja_type}</span>}</div>
                <span className="ptime">{formatTime(p.puja_time)}</span>
              </div>
            ))}
            {(pujaSchedule.length > 3 || pujaServices.length > 0) && (
              <ReadMore label="View Full Schedule">
                {pujaSchedule.slice(3).map((p,i)=>(
                  <div key={i} className="prow">
                    <span className="pname">{p.puja_name}</span>
                    <span className="ptime">{formatTime(p.puja_time)}</span>
                  </div>
                ))}
                {pujaServices.length > 0 && (<><div style={{height:14}}/><SLabel text="Available Puja Services"/><div className="chip-grid">{pujaServices.map(([,name])=>(<div key={name} className="chip chip-saffron"><div className="dot"/>{name}</div>))}</div></>)}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── MANTRAS ── */}
        {mantras.length > 0 && (
          <div className="sec" id="mantras">
            <div className="sec-h"><div className="sec-icon">🕉️</div>Mantras</div>
            <div className="mantra">
              <div className="m-title">{mantras[0].title}{mantras[0].mantra_type&&<span style={{opacity:.4,fontWeight:400,marginLeft:8,fontSize:11}}>· {mantras[0].mantra_type}</span>}</div>
              {mantras[0].sanskrit && <div className="m-sk" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{mantras[0].sanskrit}</div>}
            </div>
            {mantras.length > 1 && (
              <ReadMore label="View All Mantras">
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
            <div className="sec-h"><div className="sec-icon">🎉</div>Annual Festivals</div>
            {festivals.slice(0,2).map((f,i)=>(
              <div key={i} className="fest">
                <div className="fest-mo">{f.month?MONTHS[f.month]:'—'}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:'#2C1500'}}>{f.name}{f.is_major&&<span className="major">★ Major</span>}</div>
                  {f.description&&<p style={{fontSize:13,color:'#A07050',lineHeight:1.6,marginTop:4}}>{f.description}</p>}
                </div>
              </div>
            ))}
            {festivals.length > 2 && (
              <ReadMore label={`View All ${festivals.length} Festivals`}>
                {festivals.slice(2).map((f,i)=>(
                  <div key={i} className="fest">
                    <div className="fest-mo">{f.month?MONTHS[f.month]:'—'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,color:'#2C1500'}}>{f.name}{f.is_major&&<span className="major">★ Major</span>}</div>
                      {f.hindu_month&&<div style={{fontSize:11,color:'#C8520A',marginTop:2}}>{f.hindu_month} Month</div>}
                      {f.duration_days&&<div style={{fontSize:11,color:'#A07050',marginTop:2}}>{f.duration_days} day{f.duration_days>1?'s':''}</div>}
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
            <div className="sec-h"><div className="sec-icon">🙏</div>Sevas & Offerings</div>
            {sevas.slice(0,3).map(s=>(
              <div key={s.id} className="seva">
                <div>
                  <div style={{fontSize:14,fontWeight:500,color:'#2C1500'}}>{s.name}</div>
                  {s.description&&<div style={{fontSize:12,color:'#A07050',marginTop:2}}>{s.description}</div>}
                </div>
                <div className="seva-price">{s.is_free?'✅ Free':s.price?`₹${s.price}`:'—'}</div>
              </div>
            ))}
            {sevas.length > 3 && (
              <ReadMore label={`View All ${sevas.length} Sevas`}>
                {sevas.slice(3).map(s=>(
                  <div key={s.id} className="seva">
                    <div>
                      <div style={{fontSize:14,fontWeight:500,color:'#2C1500'}}>{s.name}</div>
                      {s.description&&<div style={{fontSize:12,color:'#A07050',marginTop:2}}>{s.description}</div>}
                      {s.timing&&<div style={{fontSize:11,color:'#A07050',marginTop:3}}>⏰ {s.timing}</div>}
                      {s.advance_booking&&<div style={{fontSize:11,color:'#C8520A',marginTop:3,fontWeight:600}}>📅 Advance booking required</div>}
                    </div>
                    <div className="seva-price">{s.is_free?'✅ Free':s.price?`₹${s.price}`:'—'}</div>
                  </div>
                ))}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── FACILITIES & PROGRAMS ── */}
        {(facilities.length>0 || programs.length>0) && (
          <div className="sec" id="facilities">
            <div className="sec-h"><div className="sec-icon">🏗️</div>Facilities & Programs</div>
            {facilities.length > 0 && (<><SLabel text="Available Facilities"/><div className="chip-grid">{facilities.slice(0,4).map(([,name])=><div key={name} className="chip chip-green"><span>✓</span>{name}</div>)}</div></>)}
            {(facilities.length > 4 || programs.length > 0) && (
              <ReadMore label="View All Facilities & Programs">
                {facilities.length > 4 && <div className="chip-grid" style={{marginBottom:8}}>{facilities.slice(4).map(([,name])=><div key={name} className="chip chip-green"><span>✓</span>{name}</div>)}</div>}
                {programs.length > 0 && (<><div style={{height:10}}/><SLabel text="Community Programs"/><div className="chip-grid">{programs.map(([,name])=><div key={name} className="chip chip-blue">{name}</div>)}</div></>)}
              </ReadMore>
            )}
          </div>
        )}

        {/* ── PRIESTS ── */}
        {priests.length > 0 && (
          <div className="sec" id="priests">
            <div className="sec-h"><div className="sec-icon">🧘</div>Head Priests & Staff</div>
            {priests.slice(0,2).map(p=>(
              <div key={p.id} className="priest">
                <div className="priest-name">{p.full_name}{p.is_head_priest&&<span className="priest-head">Head Priest</span>}</div>
                {p.title_designation&&<div className="priest-d">🪷 {p.title_designation}</div>}
                {p.years_of_service&&<div className="priest-d">⏳ Serving {p.years_of_service} years</div>}
              </div>
            ))}
            {priests.length > 2 && (
              <ReadMore label="View All Priests">
                {priests.slice(2).map(p=>(
                  <div key={p.id} className="priest">
                    <div className="priest-name">{p.full_name}{p.is_head_priest&&<span className="priest-head">Head Priest</span>}</div>
                    {p.title_designation&&<div className="priest-d">🪷 {p.title_designation}</div>}
                    {p.sampradaya      &&<div className="priest-d">📿 Sampradaya: {p.sampradaya}</div>}
                    {p.years_of_service&&<div className="priest-d">⏳ Serving {p.years_of_service} years</div>}
                    {p.languages_known &&<div className="priest-d">🗣️ Languages: {p.languages_known}</div>}
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
            <div className="card-h">💰 Support This Temple</div>
            <p style={{fontSize:12,color:'#A07050',marginBottom:10}}>Your donation maintains this sacred space</p>
            <div className="dc">
              {T.donation_temple_renovation&&<div className="cause"><div className="cause-i">🛕</div><div className="cause-n">Renovation</div></div>}
              {T.donation_annadanam        &&<div className="cause"><div className="cause-i">🍱</div><div className="cause-n">Annadanam</div></div>}
              {T.donation_priest_salary    &&<div className="cause"><div className="cause-i">🧘</div><div className="cause-n">Priest Salary</div></div>}
              {T.donation_vedic_education  &&<div className="cause"><div className="cause-i">📚</div><div className="cause-n">Vedic Edu</div></div>}
              {T.donation_festival         &&<div className="cause"><div className="cause-i">🎉</div><div className="cause-n">Festivals</div></div>}
              {T.donation_medical_camps    &&<div className="cause"><div className="cause-i">🏥</div><div className="cause-n">Medical</div></div>}
              {T.donation_general          &&<div className="cause"><div className="cause-i">🙏</div><div className="cause-n">General</div></div>}
            </div>
            {v(T.upi_id) && (
              <>
                <p style={{fontSize:11,textAlign:'center',color:'#A07050',margin:'8px 0 4px'}}>
                  UPI: <strong>{T.upi_id}</strong>
                </p>
                {/* ── FIXED: opens modal instead of bare upi:// link ── */}
                <button className="abtn" onClick={() => setShowUpiModal(true)}>
                  💳 Donate via UPI
                </button>
              </>
            )}
            {v(T.certificate_80g_no)&&<p style={{fontSize:11,color:'#1A6B3A',marginTop:8,textAlign:'center'}}>80G Exempt: {T.certificate_80g_no}</p>}
          </div>
        )}

        {/* ── HOW TO REACH ── */}
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

        {/* ── CONTACT ── */}
        <div className="sec" id="contact">
          <div className="sec-h"><div className="sec-icon">📞</div>Contact & Connect</div>
          {v(T.phone)            &&<div className="crow"><div className="clbl">Phone</div><a href={`tel:${T.phone}`} className="clink">📞 {T.phone}</a></div>}
          {v(T.whatsapp_number)  &&<div className="crow"><div className="clbl">WhatsApp</div><a href={`https://wa.me/${T.whatsapp_number.replace(/\D/g,'')}`} className="clink" target="_blank" rel="noopener noreferrer">💬 Chat on WhatsApp →</a></div>}
          {v(T.official_email)   &&<div className="crow"><div className="clbl">Email</div><a href={`mailto:${T.official_email}`} className="clink">✉️ {T.official_email}</a></div>}
          {v(T.website_url)      &&<div className="crow"><div className="clbl">Website</div><a href={T.website_url} target="_blank" rel="noopener noreferrer" className="clink">🌐 Visit Official Website →</a></div>}
          {v(T.best_time_to_call)&&<div className="crow"><div className="clbl">Best Time to Call</div><div className="cval">⏰ {T.best_time_to_call}</div></div>}
          {v(T.trust_registration_no)&&<div className="crow"><div className="clbl">Registration No.</div><div className="cval">{T.trust_registration_no}</div></div>}
        </div>

        {/* ── VERIFIED ── */}
        <div className="card">
          <div className="verified">
            <span style={{fontSize:24}}>✅</span>
            <div>
              <div className="vtext">Verified on BharatMandir</div>
              <div style={{fontSize:10,color:'#1A6B3A',opacity:.7,marginTop:2}}>
                {v(T.mkt_id)?`ID: ${T.mkt_id}`:'Details reviewed & approved'}
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