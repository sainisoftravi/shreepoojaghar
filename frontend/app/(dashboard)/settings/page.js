'use client';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [upiAccounts, setUpiAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [newUpiId, setNewUpiId] = useState('');
  const [newName, setNewName] = useState('');

  const [waStatus, setWaStatus] = useState('INITIALIZING');
  const [waPhone, setWaPhone] = useState('');
  const [waConnectedPhone, setWaConnectedPhone] = useState(null);
  const [waCode, setWaCode] = useState('');
  const [waLoading, setWaLoading] = useState(false);

  // --- DB Sync state ---
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [dbSyncLoading, setDbSyncLoading] = useState(false);
  const [dbSyncStatus, setDbSyncStatus] = useState(null); // { type: 'success'|'error'|'info', message, report }
  const [dbSyncCredsSaved, setDbSyncCredsSaved] = useState(false);

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/upi', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setUpiAccounts(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/whatsapp/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setWaStatus(json.status);
        setWaConnectedPhone(json.connectedPhone);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchAccounts();
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 3000);

    // Load saved Supabase credentials
    const token = localStorage.getItem('token');
    fetch('http://localhost:3001/api/v1/dbsync/credentials', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.supabaseDirectUrl) {
          setSupabaseUrl(json.data.supabaseDirectUrl);
          setDbSyncCredsSaved(true);
        }
      })
      .catch(() => {});

    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/upi', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ upiId: newUpiId, name: newName })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      
      setNewUpiId('');
      setNewName('');
      fetchAccounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/v1/upi/${id}/toggle`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      
      fetchAccounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this UPI Account?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/v1/upi/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      
      fetchAccounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleWaPair = async (e) => {
    e.preventDefault();
    if (!waPhone) return;
    setWaLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/whatsapp/pair', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: waPhone })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setWaCode(json.code);
    } catch (err) {
      alert(err.message);
    } finally {
      setWaLoading(false);
    }
  };

  const handleWaLogout = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp?')) return;
    setWaLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/whatsapp/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setWaCode('');
      fetchWaStatus();
    } catch (err) {
      alert(err.message);
    } finally {
      setWaLoading(false);
    }
  };

  // --- DB Sync handlers ---
  const handleSaveDbCredentials = async () => {
    if (!supabaseUrl) return alert('Please enter Supabase Direct DB URL');
    setDbSyncLoading(true);
    setDbSyncStatus(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/dbsync/credentials', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseDirectUrl: supabaseUrl })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setDbSyncCredsSaved(true);
      setDbSyncStatus({ type: 'success', message: '✅ Credentials saved!' });
    } catch (err) {
      setDbSyncStatus({ type: 'error', message: `❌ ${err.message}` });
    } finally {
      setDbSyncLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!supabaseUrl) return alert('Please enter Supabase Direct DB URL first');
    setDbSyncLoading(true);
    setDbSyncStatus({ type: 'info', message: '🔄 Testing connection...' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/dbsync/test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseDirectUrl: supabaseUrl })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setDbSyncStatus({ type: 'success', message: `✅ Connected! DB: ${json.data.database}, User: ${json.data.user}` });
    } catch (err) {
      setDbSyncStatus({ type: 'error', message: `❌ Connection failed: ${err.message}` });
    } finally {
      setDbSyncLoading(false);
    }
  };

  const handlePushToSupabase = async () => {
    if (!supabaseUrl) return alert('Please enter and save Supabase Direct DB URL first');
    if (!window.confirm('⬆️ Push local data to Supabase?\n\nYeh local ka saara data Supabase par upload karega. Existing Supabase data upsert hoga (replace). Confirm?')) return;
    setDbSyncLoading(true);
    setDbSyncStatus({ type: 'info', message: '🔄 Pushing data to Supabase... (this may take a minute)' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/dbsync/push', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseDirectUrl: supabaseUrl })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setDbSyncStatus({ type: 'success', message: '✅ Push complete!', report: json.data.report, errors: json.data.errors });
    } catch (err) {
      setDbSyncStatus({ type: 'error', message: `❌ Push failed: ${err.message}` });
    } finally {
      setDbSyncLoading(false);
    }
  };

  const handlePullFromSupabase = async () => {
    if (!supabaseUrl) return alert('Please enter and save Supabase Direct DB URL first');
    if (!window.confirm('⬇️ Pull Supabase data to Local?\n\n⚠️ WARNING: Yeh local database ko REPLACE kar dega. Local ka koi bhi naya data jo Supabase mein nahi hai, DELETE ho jayega.\n\nAre you absolutely sure?')) return;
    if (!window.confirm('🚨 Final Confirmation: Local database replace ho jayegi. Continue?')) return;
    setDbSyncLoading(true);
    setDbSyncStatus({ type: 'info', message: '🔄 Pulling data from Supabase... (this may take a minute)' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/v1/dbsync/pull', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseDirectUrl: supabaseUrl })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setDbSyncStatus({ type: 'success', message: '✅ Pull complete! Please refresh the app.', report: json.data.report, errors: json.data.errors });
    } catch (err) {
      setDbSyncStatus({ type: 'error', message: `❌ Pull failed: ${err.message}` });
    } finally {
      setDbSyncLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading settings...</div>;

  return (
    <>
      <style>{`
        .settings-form {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          align-items: flex-end;
        }
        @media (max-width: 768px) {
          .settings-form {
            flex-direction: column;
            align-items: stretch;
          }
          .settings-form button {
            width: 100%;
          }
        }
      `}</style>
    <div style={{ maxWidth: 1100, margin: '0 auto' }} className="animate-fade-in">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Store Settings</h2>
      
      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>Payment Methods - UPI</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Add multiple UPI accounts for your store. The active ones will appear on the cashier's checkout screen.
        </p>

        <form onSubmit={handleAdd} className="settings-form">
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>UPI ID</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="e.g. store@okhdfc" 
              value={newUpiId}
              onChange={e => setNewUpiId(e.target.value)}
              required 
            />
          </div>
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Bank Name</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="e.g. HDFC Current Account" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
            Add UPI ID
          </button>
        </form>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Bank Name</th>
                <th>UPI ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {upiAccounts.map(account => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{account.upiId}</td>
                  <td>
                    <span className={`badge ${account.isActive ? 'badge-success' : 'badge-warning'}`}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleToggle(account.id, account.isActive)}
                      className={`btn btn-sm ${account.isActive ? 'btn-secondary' : 'btn-success'}`}
                    >
                      {account.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button 
                      onClick={() => handleDelete(account.id)}
                      className="btn btn-sm btn-danger"
                      style={{ background: '#fff0f0', color: '#a72e3e', border: '1px solid #f3c9ce' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {upiAccounts.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>No UPI accounts found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp Integration */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>WhatsApp Integration</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Connect your store's WhatsApp number to automatically send PDF invoices to customers.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <strong>Status:</strong>
          <span className={`badge ${waStatus === 'CONNECTED' ? 'badge-success' : 'badge-warning'}`}>
            {waStatus}
          </span>
        </div>

        {waStatus === 'CONNECTED' ? (
          <div>
            <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Connected to: <strong>+{waConnectedPhone?.replace('@c.us', '')}</strong>
            </p>
            <button onClick={handleWaLogout} className="btn btn-danger" style={{ background: '#fff0f0', color: '#a72e3e', border: '1px solid #f3c9ce' }} disabled={waLoading}>
              {waLoading ? 'Disconnecting...' : 'Disconnect WhatsApp'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleWaPair} className="settings-form" style={{ maxWidth: '600px' }}>
            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>WhatsApp Number (with country code)</label>
              <input 
                type="text" 
                className="input-control" 
                placeholder="e.g. 919876543210" 
                value={waPhone}
                onChange={e => setWaPhone(e.target.value)}
                disabled={waLoading || !!waCode}
                required 
              />
            </div>
            {!waCode && (
              <button type="submit" className="btn btn-primary" style={{ height: '42px' }} disabled={waLoading}>
                {waLoading ? 'Generating...' : 'Generate Pairing Code'}
              </button>
            )}
          </form>
        )}

        {waCode && waStatus !== 'CONNECTED' && (
          <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Link with Phone Number</h4>
            <ol style={{ paddingLeft: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <li>Open WhatsApp on your phone.</li>
              <li>Tap <strong>Menu</strong> (3 dots) or <strong>Settings</strong> and select <strong>Linked Devices</strong>.</li>
              <li>Tap <strong>Link a Device</strong>.</li>
              <li>Tap <strong>Link with phone number instead</strong>.</li>
              <li>Enter the 8-character code shown below.</li>
            </ol>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '1rem 2rem', borderRadius: '8px', fontSize: '2rem', fontWeight: '800', letterSpacing: '0.2em', color: 'var(--text-primary)', border: '2px dashed var(--border-color)' }}>
                {waCode.match(/.{1,4}/g)?.join('-')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Database Sync */}
      <div className="card" style={{ marginBottom: '2rem', border: '1px solid #fed7aa', background: 'linear-gradient(to bottom, #fffaf5, #ffffff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ background: '#f97316', color: 'white', padding: '0.5rem', borderRadius: '8px', display: 'flex' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Database Sync (Supabase)</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.6' }}>
          Keep your local POS data safely backed up and synced with Supabase. 
          Enter your Supabase Direct DB URL below to get started. <br/>
          <small style={{ color: '#94a3b8' }}>Supabase Project → Settings → Database → Connection String → URI (Direct)</small>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label style={{ fontWeight: 600, color: '#334155' }}>Supabase Direct DB URL</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="password"
                className="input-control"
                placeholder="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '0.9rem', padding: '0.75rem', flex: 1, letterSpacing: supabaseUrl ? '2px' : 'normal' }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleSaveDbCredentials}
                disabled={dbSyncLoading || !supabaseUrl}
                style={{ height: '45px', minWidth: '120px', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Save URL
              </button>
            </div>
            <small style={{ color: '#64748b', marginTop: '0.5rem', display: 'block' }}>
              We hide this for security. It should be the Session mode URL (port 5432).
            </small>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px dashed #fdba74' }}>
            <div style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Sync Actions</div>
            <button
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={dbSyncLoading || !supabaseUrl}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"></path></svg>
              Test Connection
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePushToSupabase}
              disabled={dbSyncLoading || !supabaseUrl}
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px 0 rgba(234,88,12,0.39)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Local → Supabase (Push)
            </button>
            <button
              className="btn btn-danger"
              onClick={handlePullFromSupabase}
              disabled={dbSyncLoading || !supabaseUrl}
              style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Supabase → Local (Pull)
            </button>
          </div>

          {dbSyncLoading && (
            <div style={{ padding: '0.75rem 1rem', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', color: '#0369a1', fontSize: '0.9rem' }}>
              ⏳ Operation in progress... please wait.
            </div>
          )}

          {dbSyncStatus && (
            <div style={{
              padding: '1rem',
              borderRadius: 10,
              background: dbSyncStatus.type === 'success' ? '#f0fdf4' : dbSyncStatus.type === 'error' ? '#fff1f2' : '#f0f9ff',
              border: `1px solid ${dbSyncStatus.type === 'success' ? '#bbf7d0' : dbSyncStatus.type === 'error' ? '#fecdd3' : '#bae6fd'}`,
              color: dbSyncStatus.type === 'success' ? '#166534' : dbSyncStatus.type === 'error' ? '#be123c' : '#0369a1',
              fontSize: '0.9rem'
            }}>
              <div style={{ fontWeight: 700, marginBottom: dbSyncStatus.report ? '0.75rem' : 0 }}>{dbSyncStatus.message}</div>
              {dbSyncStatus.report && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '0.5rem' }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.05)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>Table</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px' }}>Rows</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbSyncStatus.report.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                          <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{r.table}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.rows}</td>
                          <td style={{ padding: '4px 8px', color: r.status.startsWith('error') ? '#be123c' : 'inherit' }}>{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {dbSyncStatus.errors?.length > 0 && (
                <div style={{ marginTop: '0.5rem', color: '#be123c' }}>
                  <strong>Errors:</strong> {dbSyncStatus.errors.map(e => `${e.table}: ${e.error}`).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
