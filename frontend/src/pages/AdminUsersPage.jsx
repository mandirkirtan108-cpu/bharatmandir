// pages/AdminUsersPage.jsx
// Super Admin only — manage admin accounts: create, view, deactivate, change role

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ROLE_COLORS = {
  super_admin: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
  editor:      { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  moderator:   { bg: 'rgba(107,114,128,0.15)', text: '#d1d5db', border: 'rgba(107,114,128,0.3)' },
};

const ROLE_LABELS = { super_admin: '👑 Super Admin', editor: '✏️ Editor', moderator: '🛡️ Moderator' };

export default function AdminUsersPage() {
  const { admin, isSuperAdmin, authFetch, logout } = useAdminAuth();
  const navigate = useNavigate();

  const [admins,  setAdmins]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'moderator' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) { navigate('/admin/panel'); return; }
    fetchAdmins();
  }, [isSuperAdmin]);

  async function fetchAdmins() {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/auth/admins`);
      const data = await res.json();
      setAdmins(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchLog() {
    const res = await authFetch(`${API_BASE}/api/admin/auth/activity-log?limit=100`);
    const data = await res.json();
    setActivityLog(data);
    setShowLog(true);
  }

  async function createAdmin() {
    setFormError(''); setFormLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/admin/auth/admins`, {
        method: 'POST', body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setShowCreate(false);
      setForm({ email: '', full_name: '', password: '', role: 'moderator' });
      fetchAdmins();
    } catch (e) { setFormError(e.message); }
    finally { setFormLoading(false); }
  }

  async function deactivate(id) {
    if (!confirm('Deactivate this admin?')) return;
    await authFetch(`${API_BASE}/api/admin/auth/admins/${id}/deactivate`, { method: 'PATCH' });
    fetchAdmins();
  }

  async function changeRole(id, role) {
    await authFetch(`${API_BASE}/api/admin/auth/admins/${id}/role`, {
      method: 'PATCH', body: JSON.stringify({ role }),
    });
    fetchAdmins();
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,153,0,0.15)',
    borderRadius: 12, padding: 20,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fdf6ec', fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Top bar */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a00, #3d1f00)',
        padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={() => navigate('/admin/panel')} style={{
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
        }}>← Back</button>
        <h1 style={{ color: '#ff9900', margin: 0, fontFamily: "'Cinzel', serif", fontSize: 20 }}>
          Admin User Management
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button onClick={fetchLog} style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
          }}>📋 Activity Log</button>
          <button onClick={() => setShowCreate(true)} style={{
            background: 'linear-gradient(135deg, #ff9900, #e67e00)',
            border: 'none', color: '#fff', borderRadius: 8,
            padding: '6px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          }}>+ Add Admin</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '32px auto', padding: '0 24px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total Admins', val: admins.length, icon: '👥' },
            { label: 'Active', val: admins.filter(a => a.is_active).length, icon: '✅' },
            { label: 'Super Admins', val: admins.filter(a => a.role === 'super_admin').length, icon: '👑' },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#8B4513' }}>{s.val}</div>
              <div style={{ color: '#888', fontSize: 13 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Admin list */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 20px', color: '#3d1f00', fontSize: 18 }}>All Admins</h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,153,0,0.2)' }}>
                  {['Name / Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px',
                      color: '#8B4513', fontSize: 13, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id} style={{
                    borderBottom: '1px solid rgba(255,153,0,0.08)',
                    opacity: a.is_active ? 1 : 0.5,
                  }}>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#3d1f00', fontSize: 15 }}>
                        {a.full_name}
                        {a.id === admin?.id && (
                          <span style={{ fontSize: 11, marginLeft: 8, color: '#ff9900' }}>(you)</span>
                        )}
                      </div>
                      <div style={{ color: '#888', fontSize: 13 }}>{a.email}</div>
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{
                        ...ROLE_COLORS[a.role],
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        border: `1px solid ${ROLE_COLORS[a.role].border}`,
                      }}>
                        {ROLE_LABELS[a.role]}
                      </span>
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{
                        background: a.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: a.is_active ? '#4ade80' : '#f87171',
                        padding: '3px 10px', borderRadius: 20, fontSize: 12,
                      }}>
                        {a.is_active ? '● Active' : '● Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 12px', color: '#888', fontSize: 13 }}>
                      {a.last_login_at
                        ? new Date(a.last_login_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                        : 'Never'}
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      {a.id !== admin?.id && a.is_active && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select
                            value={a.role}
                            onChange={e => changeRole(a.id, e.target.value)}
                            style={{
                              background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)',
                              borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#3d1f00', cursor: 'pointer',
                            }}
                          >
                            <option value="super_admin">super_admin</option>
                            <option value="editor">editor</option>
                            <option value="moderator">moderator</option>
                          </select>
                          <button onClick={() => deactivate(a.id)} style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171', borderRadius: 6, padding: '4px 10px',
                            fontSize: 12, cursor: 'pointer',
                          }}>Deactivate</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Admin Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32,
            width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ margin: '0 0 24px', color: '#3d1f00' }}>➕ Add New Admin</h2>

            {[
              { label: 'Full Name', key: 'full_name', type: 'text', ph: 'Ramesh Kumar' },
              { label: 'Email', key: 'email', type: 'email', ph: 'editor@bharatmandir.in' },
              { label: 'Password', key: 'password', type: 'password', ph: 'Min 8 characters' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600,
                  color: '#555', marginBottom: 6 }}>{f.label}</label>
                <input type={f.type} placeholder={f.ph} value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600,
                color: '#555', marginBottom: 6 }}>Role</label>
              <select value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px',
                  border: '1px solid #d1d5db', borderRadius: 8,
                  fontSize: 14, boxSizing: 'border-box',
                }}>
                <option value="moderator">🛡️ Moderator — Can flag/review</option>
                <option value="editor">✏️ Editor — Can approve/reject/publish</option>
                <option value="super_admin">👑 Super Admin — Full access</option>
              </select>
            </div>

            {formError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5',
                borderRadius: 8, padding: '10px 14px', color: '#dc2626',
                fontSize: 13, marginBottom: 16 }}>
                ⚠️ {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '11px', border: '1px solid #d1d5db',
                borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14,
              }}>Cancel</button>
              <button onClick={createAdmin} disabled={formLoading} style={{
                flex: 2, padding: '11px',
                background: 'linear-gradient(135deg, #ff9900, #e67e00)',
                border: 'none', borderRadius: 8, color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
                {formLoading ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Modal */}
      {showLog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32,
            width: '100%', maxWidth: 700, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: '#3d1f00' }}>📋 Activity Log</h2>
              <button onClick={() => setShowLog(false)} style={{
                background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888',
              }}>×</button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {activityLog.map(log => (
                <div key={log.id} style={{
                  padding: '12px 0', borderBottom: '1px solid #f3f4f6',
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                }}>
                  <div style={{ color: '#888', fontSize: 12, minWidth: 140 }}>
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: '#3d1f00', fontSize: 14 }}>
                      {log.admin_name}
                    </span>
                    <span style={{ color: '#888', fontSize: 13, margin: '0 8px' }}>—</span>
                    <span style={{ color: '#ff9900', fontSize: 13 }}>{log.action}</span>
                    {log.target_type && (
                      <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
                        [{log.target_type} #{log.target_id}]
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}