import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${sessionStorage.getItem('bm_access_token') || ''}`,
});

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers(), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
  return data;
}

export default function AdminApprovalWorkflow() {
  const [tab, setTab] = useState('volunteers');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const path = tab === 'volunteers'
        ? '/api/volunteer/auth/admin/volunteers?approval_status=pending'
        : '/api/admin/volunteer-submissions?status=pending_review';
      setItems(await request(path));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const reviewVolunteer = async (id, action) => {
    if (action === 'rejected' && !reason.trim()) return setError('Enter remarks before rejecting the volunteer.');
    await request(`/api/volunteer/auth/admin/volunteers/${id}/approval`, {
      method: 'PATCH', body: JSON.stringify({ action, rejection_reason: reason || null }),
    });
    setReason(''); load();
  };

  const reviewTemple = async (id, action) => {
    if (action !== 'approved' && !reason.trim()) return setError('Enter remarks before rejecting or requesting changes.');
    await request(`/api/admin/volunteer-submissions/${id}/review`, {
      method: 'POST', body: JSON.stringify({ action, admin_note: reason || null }),
    });
    setReason(''); load();
  };

  return (
    <section style={s.wrap}>
      <div style={s.head}>
        <div><p style={s.kicker}>APPROVAL WORKFLOW</p><h2 style={s.title}>Verification Center</h2></div>
        <button onClick={load} style={s.refresh}><RefreshCw size={15}/> Refresh</button>
      </div>
      <div style={s.tabs}>
        <button onClick={() => setTab('volunteers')} style={{...s.tab,...(tab==='volunteers'?s.active:{})}}>Volunteer Verification</button>
        <button onClick={() => setTab('temples')} style={{...s.tab,...(tab==='temples'?s.active:{})}}>Temple Verification</button>
      </div>
      <div style={s.note}>
        <input value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Admin remarks (required for reject/change request)" style={s.input}/>
      </div>
      {error && <div style={s.error}>{error}</div>}
      {loading ? <p style={s.empty}>Loading verification queue...</p> : items.length === 0 ? <p style={s.empty}>No pending items.</p> : (
        <div style={s.list}>{items.map((item) => (
          <article key={item.id} style={s.card}>
            <div style={s.icon}><ShieldCheck size={21}/></div>
            <div style={{flex:1,minWidth:0}}>
              <h3 style={s.name}>{tab==='volunteers' ? item.name : item.temple_name}</h3>
              <p style={s.meta}>{tab==='volunteers'
                ? `${item.email} · ${[item.city,item.state].filter(Boolean).join(', ') || 'Location not provided'}`
                : `${item.volunteer_name} · ${[item.city,item.state].filter(Boolean).join(', ')}`}</p>
              <p style={s.meta}>Registered/submitted: {new Date(item.registered_at || item.submitted_at || item.created_at).toLocaleDateString('en-IN')}</p>
              {tab==='temples' && item.description && <p style={s.description}>{item.description}</p>}
            </div>
            <div style={s.actions}>
              <button onClick={()=>tab==='volunteers'?reviewVolunteer(item.id,'approved'):reviewTemple(item.id,'approved')} style={s.approve}><CheckCircle2 size={14}/> {tab==='volunteers'?'Approve':'Publish'}</button>
              {tab==='temples' && <button onClick={()=>reviewTemple(item.id,'changes_requested')} style={s.change}>Request changes</button>}
              <button onClick={()=>tab==='volunteers'?reviewVolunteer(item.id,'rejected'):reviewTemple(item.id,'rejected')} style={s.reject}><XCircle size={14}/> Reject</button>
            </div>
          </article>
        ))}</div>
      )}
    </section>
  );
}

const s = {
  wrap:{background:'#fff',border:'1px solid #ead9c3',borderRadius:18,padding:24,boxShadow:'0 8px 28px rgba(70,30,5,.08)'},
  head:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}, kicker:{margin:0,color:'#c8520a',fontSize:10,fontWeight:800,letterSpacing:'.12em'}, title:{margin:'4px 0 0',fontFamily:'var(--font-display)',color:'#3d1f00'},
  refresh:{display:'flex',alignItems:'center',gap:6,padding:'9px 13px',border:'1px solid #e7d4bc',borderRadius:9,background:'#fff8ef',color:'#8b3d0a',cursor:'pointer'},
  tabs:{display:'flex',gap:8,margin:'22px 0 14px',flexWrap:'wrap'},tab:{padding:'10px 15px',border:'1px solid #e7d4bc',borderRadius:9,background:'#fff',color:'#734522',fontWeight:700,cursor:'pointer'},active:{background:'#c8520a',color:'#fff',borderColor:'#c8520a'},
  note:{marginBottom:14},input:{width:'100%',boxSizing:'border-box',padding:12,border:'1px solid #dfc9ac',borderRadius:9},error:{padding:11,background:'#fdeaea',color:'#a22',borderRadius:8,marginBottom:12},empty:{padding:40,textAlign:'center',color:'#8b6b50'},list:{display:'grid',gap:11},
  card:{display:'flex',alignItems:'flex-start',gap:13,padding:16,border:'1px solid #eee1d0',borderRadius:12,flexWrap:'wrap'},icon:{width:43,height:43,display:'grid',placeItems:'center',borderRadius:11,background:'#fff0e5',color:'#c8520a'},name:{margin:0,fontSize:16,color:'#3d1f00'},meta:{margin:'4px 0 0',fontSize:12,color:'#806047'},description:{margin:'8px 0 0',fontSize:12,color:'#5f402a',lineHeight:1.5},actions:{display:'flex',gap:7,flexWrap:'wrap'},
  approve:{display:'flex',alignItems:'center',gap:5,padding:'9px 12px',border:0,borderRadius:8,background:'#e7f7ed',color:'#176b38',fontWeight:700,cursor:'pointer'},change:{padding:'9px 12px',border:0,borderRadius:8,background:'#fff0dc',color:'#9a4b00',fontWeight:700,cursor:'pointer'},reject:{display:'flex',alignItems:'center',gap:5,padding:'9px 12px',border:0,borderRadius:8,background:'#fdeaea',color:'#a22',fontWeight:700,cursor:'pointer'},
};
