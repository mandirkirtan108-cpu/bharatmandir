/**
 * BlogPage.jsx — BharatMandir: User Blog Section
 * Lists all published blogs, opens a reading view on click.
 * GET /api/blogs           → list
 * GET /api/blogs/:id       → single
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar  from '../components/Navbar';
import Footer  from '../components/Footer';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

  :root {
    --s:#E8650A; --sl:#F5934A; --sd:#B84D00;
    --gold:#C8960C; --gold-l:#F0C040;
    --cream:#FDF8F0; --cream-d:#F0E6D0;
    --brown:#3D1F00;
    --text:#1A0A00; --text-m:#4A2800; --text-l:#8B6040;
    --fd:'Cinzel',serif; --fb:'Crimson Pro',serif; --fh:'Noto Sans Devanagari',sans-serif;
    --r:14px; --rl:22px; --tr:.3s cubic-bezier(.4,0,.2,1);
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:var(--fb);background:var(--cream);color:var(--text);}
  a{text-decoration:none;color:inherit;}

  /* ── Hero ── */
  .blog-hero{
    position:relative;
    background:linear-gradient(160deg,#1A0A00 0%,#3D1F00 40%,#6B3A10 70%,#B84D00 100%);
    padding:60px 24px 72px;text-align:center;overflow:hidden;
  }
  .blog-hero-bg{position:absolute;inset:0;pointer-events:none;}
  .bfl{position:absolute;font-size:clamp(20px,3vw,44px);opacity:.1;animation:bfloat 8s ease-in-out infinite;}
  .bfl:nth-child(1){top:10%;left:5%;animation-delay:0s;}
  .bfl:nth-child(2){top:60%;left:15%;animation-delay:1.6s;}
  .bfl:nth-child(3){top:15%;right:7%;animation-delay:.9s;}
  .bfl:nth-child(4){bottom:12%;right:4%;animation-delay:2.4s;}
  @keyframes bfloat{0%,100%{transform:translateY(0) rotate(-4deg);opacity:.1;}50%{transform:translateY(-16px) rotate(4deg);opacity:.22;}}
  .blog-hero-inner{position:relative;z-index:1;}
  .blog-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(200,150,12,.18);border:1px solid rgba(240,192,64,.35);backdrop-filter:blur(8px);color:var(--gold-l);padding:5px 20px;border-radius:50px;font-family:var(--fd);font-size:11px;letter-spacing:.15em;margin-bottom:16px;}
  .blog-hero-title{font-family:var(--fd);font-weight:900;font-size:clamp(28px,5vw,52px);color:#fff;line-height:1.1;margin-bottom:10px;text-shadow:0 2px 20px rgba(0,0,0,.4);}
  .blog-hero-title span{color:var(--gold-l);}
  .blog-hero-sub{font-family:var(--fh);font-size:14px;color:rgba(255,255,255,.65);max-width:500px;margin:0 auto;}

  /* ── Main layout ── */
  .blog-main{max-width:1100px;margin:0 auto;padding:40px 24px 80px;}

  /* ── Search bar ── */
  .blog-search-wrap{max-width:500px;margin:0 auto 36px;position:relative;}
  .blog-search-inp{width:100%;padding:12px 20px 12px 46px;border:2px solid var(--cream-d);border-radius:50px;font-family:var(--fb);font-size:15px;color:var(--text);background:#fff;outline:none;transition:var(--tr);}
  .blog-search-inp:focus{border-color:var(--s);box-shadow:0 0 0 3px rgba(232,101,10,.12);}
  .blog-search-icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--text-l);font-size:17px;pointer-events:none;}

  /* ── Grid ── */
  .blog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px;}

  /* ── Card ── */
  .blog-card{
    background:#fff;border:1.5px solid var(--cream-d);border-radius:var(--rl);
    overflow:hidden;cursor:pointer;transition:var(--tr);
    display:flex;flex-direction:column;
  }
  .blog-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(61,31,0,.14);border-color:rgba(232,101,10,.3);}
  .blog-card-accent{height:4px;background:linear-gradient(90deg,var(--s),var(--gold));}
  .blog-card-body{padding:22px 24px 20px;flex:1;display:flex;flex-direction:column;gap:12px;}
  .blog-card-tag{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;background:rgba(232,101,10,.09);border-radius:50px;font-family:var(--fd);font-size:10px;letter-spacing:.1em;color:var(--s);font-weight:700;width:fit-content;}
  .blog-card-title{font-family:var(--fd);font-size:17px;font-weight:700;color:var(--text);line-height:1.35;}
  .blog-card-excerpt{font-family:var(--fb);font-size:14px;color:var(--text-l);line-height:1.65;flex:1;}
  .blog-card-meta{display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid var(--cream-d);margin-top:auto;}
  .blog-card-author{display:flex;align-items:center;gap:8px;}
  .blog-card-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#E06B25,#9A3C05);display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-size:12px;font-weight:700;color:#fff;flex-shrink:0;}
  .blog-card-author-name{font-family:var(--fd);font-size:11px;color:var(--text-m);font-weight:600;}
  .blog-card-date{font-family:var(--fb);font-size:12px;color:var(--text-l);}
  .blog-card-read{font-family:var(--fd);font-size:11px;color:var(--s);font-weight:700;letter-spacing:.05em;}

  /* ── Detail / Reading view ── */
  .blog-detail-wrap{max-width:760px;margin:0 auto;padding:40px 24px 80px;}
  .blog-back-btn{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border:1.5px solid var(--cream-d);border-radius:50px;background:#fff;color:var(--text-m);font-family:var(--fd);font-size:11px;letter-spacing:.06em;cursor:pointer;transition:var(--tr);margin-bottom:28px;}
  .blog-back-btn:hover{border-color:var(--s);color:var(--s);}
  .blog-detail-card{background:#fff;border:1.5px solid var(--cream-d);border-radius:var(--rl);overflow:hidden;}
  .blog-detail-top{height:6px;background:linear-gradient(90deg,var(--s),var(--gold),var(--sd));}
  .blog-detail-body{padding:36px 40px 44px;}
  .blog-detail-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;background:rgba(232,101,10,.09);border-radius:50px;font-family:var(--fd);font-size:10px;letter-spacing:.12em;color:var(--s);font-weight:700;margin-bottom:18px;}
  .blog-detail-title{font-family:var(--fd);font-weight:900;font-size:clamp(22px,4vw,34px);color:var(--text);line-height:1.25;margin-bottom:20px;}
  .blog-detail-meta{display:flex;align-items:center;gap:14px;padding:16px 0;border-top:1px solid var(--cream-d);border-bottom:1px solid var(--cream-d);margin-bottom:28px;flex-wrap:wrap;}
  .blog-detail-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#E06B25,#9A3C05);display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-size:14px;font-weight:700;color:#fff;flex-shrink:0;}
  .blog-detail-author{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--text-m);}
  .blog-detail-date{font-family:var(--fb);font-size:13px;color:var(--text-l);}
  .blog-detail-dot{width:4px;height:4px;border-radius:50%;background:var(--text-l);opacity:.4;}
  .blog-detail-content{font-family:var(--fb);font-size:17px;line-height:1.85;color:var(--text-m);white-space:pre-wrap;}

  /* ── States ── */
  .blog-empty{text-align:center;padding:80px 24px;color:var(--text-l);}
  .blog-empty-icon{font-size:52px;margin-bottom:16px;}
  .blog-empty-title{font-family:var(--fd);font-size:18px;color:var(--text-m);margin-bottom:8px;}
  .blog-empty-sub{font-family:var(--fb);font-size:14px;}
  .blog-spinner{display:flex;justify-content:center;align-items:center;padding:80px 0;gap:12px;font-family:var(--fd);font-size:14px;color:var(--text-l);}
  @keyframes spin{to{transform:rotate(360deg);}}
  .spin{display:inline-block;width:22px;height:22px;border:3px solid var(--cream-d);border-top-color:var(--s);border-radius:50%;animation:spin .7s linear infinite;}

  @media(max-width:640px){
    .blog-grid{grid-template-columns:1fr;}
    .blog-detail-body{padding:22px 18px 30px;}
  }
`;

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function excerpt(text, len = 130) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len).trim() + '…' : text;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BlogCard({ blog, onClick }) {
  const initial = (blog.submitted_by || 'A')[0].toUpperCase();
  return (
    <div className="blog-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="blog-card-accent" />
      <div className="blog-card-body">
        <div className="blog-card-tag">✍️ &nbsp;BLOG</div>
        <div className="blog-card-title">{blog.title}</div>
        <div className="blog-card-excerpt">{excerpt(blog.description)}</div>
        <div className="blog-card-meta">
          <div className="blog-card-author">
            <div className="blog-card-avatar">{initial}</div>
            <div>
              <div className="blog-card-author-name">{blog.submitted_by}</div>
              <div className="blog-card-date">{fmtDate(blog.created_at)}</div>
            </div>
          </div>
          <span className="blog-card-read">Read →</span>
        </div>
      </div>
    </div>
  );
}

function BlogDetail({ blog, onBack }) {
  const initial = (blog.submitted_by || 'A')[0].toUpperCase();
  return (
    <div className="blog-detail-wrap">
      <button className="blog-back-btn" onClick={onBack}>← Back to Blogs</button>
      <div className="blog-detail-card">
        <div className="blog-detail-top" />
        <div className="blog-detail-body">
          <div className="blog-detail-tag">✍️ &nbsp;BLOG POST</div>
          <h1 className="blog-detail-title">{blog.title}</h1>
          <div className="blog-detail-meta">
            <div className="blog-detail-avatar">{initial}</div>
            <div>
              <div className="blog-detail-author">{blog.submitted_by}</div>
              {blog.created_at && (
                <div className="blog-detail-date">{fmtDate(blog.created_at)}</div>
              )}
            </div>
          </div>
          <div className="blog-detail-content">{blog.description}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BlogPage() {
  const [blogs, setBlogs]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null); // blog object for detail view
  const [search, setSearch]     = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Support deep-linking: /blog?id=123
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam && blogs.length) {
      const found = blogs.find(b => String(b.id) === idParam);
      if (found) setSelected(found);
    }
  }, [searchParams, blogs]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/blogs`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Support both { blogs: [...] } and [...]
        setBlogs(Array.isArray(data) ? data : (data.blogs || data.items || []));
      } catch {
        setBlogs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = blogs.filter(b => {
    const q = search.toLowerCase();
    return (
      b.title?.toLowerCase().includes(q) ||
      b.submitted_by?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q)
    );
  });

  function openBlog(blog) {
    setSelected(blog);
    setSearchParams({ id: blog.id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeBlog() {
    setSelected(null);
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {/* ── Hero ── */}
      <div className="blog-hero">
        <div className="blog-hero-bg">
          <span className="bfl">📖</span>
          <span className="bfl">✍️</span>
          <span className="bfl">🕉️</span>
          <span className="bfl">🔱</span>
        </div>
        <div className="blog-hero-inner">
          <div className="blog-badge">📖 &nbsp;SPIRITUAL BLOG</div>
          <h1 className="blog-hero-title">Divine <span>Wisdom</span> &amp; Stories</h1>
          <p className="blog-hero-sub">
            Explore spiritual insights, temple stories, and sacred knowledge curated by our team.
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      {selected ? (
        <BlogDetail blog={selected} onBack={closeBlog} />
      ) : (
        <div className="blog-main">
          {/* Search */}
          <div className="blog-search-wrap">
            <span className="blog-search-icon">🔍</span>
            <input
              className="blog-search-inp"
              placeholder="Search blogs by title, author…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Grid */}
          {loading ? (
            <div className="blog-spinner">
              <span className="spin" />
              Loading divine content…
            </div>
          ) : filtered.length === 0 ? (
            <div className="blog-empty">
              <div className="blog-empty-icon">📭</div>
              <div className="blog-empty-title">
                {search ? 'No blogs match your search' : 'No Blog Posts Yet'}
              </div>
              <div className="blog-empty-sub">
                {search
                  ? 'Try different keywords.'
                  : 'Divine wisdom is on its way — check back soon!'}
              </div>
            </div>
          ) : (
            <div className="blog-grid">
              {filtered.map(blog => (
                <BlogCard key={blog.id} blog={blog} onClick={() => openBlog(blog)} />
              ))}
            </div>
          )}
        </div>
      )}

      <Footer />
    </>
  );
}