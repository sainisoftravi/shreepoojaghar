'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api.js';
import { Users, Download, Sparkles, Phone, Award, Edit, Trash2, Plus, Search, X, Check } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [segment, setSegment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch('/customers');
      setCustomers(res.data?.customers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/exports/wsm?segment=${segment}&token=${token}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `spg_customers_${segment}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(err.message || 'Failed to download CSV');
    }
  };

  // Open modal to add a new customer
  const openAddModal = () => {
    setEditingCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setModalError('');
    setShowModal(true);
  };

  // Open modal to edit existing customer
  const openEditModal = (c) => {
    setEditingCustomer(c);
    setCustomerName(c.name || '');
    // Strip +91 for display in 10-digit input box
    const digitsOnly = String(c.phone || '').replace(/\D/g, '').replace(/^91/, '');
    setCustomerPhone(digitsOnly);
    setModalError('');
    setShowModal(true);
  };

  // Save (Create or Update) Customer
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setModalError('');

    const cleanName = customerName.trim();
    if (!cleanName) {
      setModalError('Customer name is required');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setModalError('Please enter a valid 10-digit mobile number');
      return;
    }

    setModalLoading(true);

    try {
      if (editingCustomer) {
        await apiFetch(`/customers/${editingCustomer.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: cleanName,
            phone: cleanPhone,
          }),
        });
        showToast('Customer details updated successfully!');
      } else {
        await apiFetch('/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: cleanName,
            phone: cleanPhone,
          }),
        });
        showToast('New customer added successfully!');
      }

      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      setModalError(err.message || 'Failed to save customer details');
    } finally {
      setModalLoading(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (c) => {
    const confirmMsg = `Are you sure you want to delete customer "${c.name}" (${c.phone})?\n\nThis will remove the customer profile. (Past sales invoices will be preserved).`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiFetch(`/customers/${c.id}`, {
        method: 'DELETE',
      });
      showToast(`Customer "${c.name}" deleted successfully.`);
      fetchCustomers();
    } catch (err) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Filter customers by search term
  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  return (
    <>
      <style>{`
        .cust-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .cust-export-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cust-export-controls {
          display: flex;
          gap: 0.8rem;
          align-items: center;
        }
        .cust-modal {
          width: 460px;
          max-width: 95vw;
          border-radius: 20px;
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.35);
          overflow: hidden;
          border: 1px solid rgba(226, 232, 240, 0.9);
        }
        @media (max-width: 768px) {
          .cust-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .cust-header button {
            width: 100%;
          }
          .cust-export-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .cust-export-controls {
            flex-direction: column;
            width: 100%;
          }
          .cust-export-controls select, .cust-export-controls button {
            width: 100% !important;
          }
        }
      `}</style>

      <div style={styles.container}>
        {/* Header */}
        <div className="cust-header">
          <div>
            <h1 style={styles.title}>Customers & Marketing</h1>
            <p style={styles.subtitle}>Customer profiles, lifetime spend, order history & marketing exports</p>
          </div>
          <button onClick={openAddModal} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={18} /> Add Customer
          </button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: 12, fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✅ {toastMessage}</span>
            <button onClick={() => setToastMessage('')} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
          </div>
        )}

        {/* WhatsApp Export Card */}
        <div style={styles.exportCard} className="cust-export-card glass-panel animate-fade-in">
          <div style={styles.exportHeader}>
            <div style={styles.iconBox}>
              <Sparkles size={24} color="#eab308" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>WhatsApp Marketing CSV Export</h3>
              <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '3px 0 0' }}>
                Download customer segments formatted for bulk WhatsApp campaign software.
              </p>
            </div>
          </div>

          <div className="cust-export-controls">
            <select
              className="input-control"
              style={{ width: '220px' }}
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
            >
              <option value="all">All Customers</option>
              <option value="high_value">High Value (LTV &gt; ₹1,000)</option>
              <option value="recent">Active Buyers (Last 30 Days)</option>
            </select>

            <button onClick={handleDownloadCSV} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={17} /> Export Segment CSV
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '0.75rem 1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="glass-panel">
          <Search size={18} color="#64748b" />
          <input
            type="text"
            placeholder="Search customers by name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', color: '#0f172a', width: '100%', fontSize: '0.95rem' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>
              ×
            </button>
          )}
        </div>

        {/* Customer Directory Table */}
        <div className="table-container table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Total Orders</th>
                <th>Lifetime Spend (LTV)</th>
                <th>Last Purchase</th>
                <th style={{ textAlign: 'center', width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                    {loading ? 'Loading customers...' : 'No customers found matching your search.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{c.name || '—'}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Phone size={14} color="#64748b" />
                        <span style={{ fontWeight: 500 }}>{c.phone}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{c.totalOrders || 0} orders</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '1.05rem', color: '#166534' }}>
                        ₹{Number(c.lifetimeSpend || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td style={{ color: '#475569' }}>
                      {c.lastPurchase
                        ? new Date(c.lastPurchase).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          onClick={() => openEditModal(c)}
                          className="btn btn-sm btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#0284c7', borderColor: '#bae6fd', padding: '0.35rem 0.65rem' }}
                          title="Edit Customer"
                        >
                          <Edit size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(c)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center' }}
                          title="Delete Customer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Add / Edit Customer Modal ─── */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="cust-modal animate-fade-in">
              <form onSubmit={handleSaveCustomer}>
                {/* Modal Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafaf9' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    {editingCustomer ? `Edit Customer Details` : 'Add New Customer'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  {modalError && (
                    <div style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '0.65rem 0.9rem', borderRadius: 8, fontSize: '0.85rem' }}>
                      ⚠️ {modalError}
                    </div>
                  )}

                  <div className="input-group">
                    <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>
                      Customer Full Name *
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Ramesh Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="input-group">
                    <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>
                      Mobile / WhatsApp Phone Number *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 10, overflow: 'hidden', background: '#ffffff' }}>
                      <span style={{ padding: '0.65rem 0.85rem', background: '#f8fafc', color: '#475569', fontSize: '0.9rem', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                        🇮🇳 +91
                      </span>
                      <input
                        type="tel"
                        className="input-control"
                        placeholder="9876543210"
                        value={customerPhone}
                        maxLength={10}
                        style={{ border: 'none', borderRadius: 0, padding: '0.65rem 0.85rem', flex: 1 }}
                        onKeyDown={(e) => {
                          // Numbers-only restriction
                          if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setCustomerPhone(digitsOnly);
                        }}
                        required
                      />
                    </div>
                    <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.3rem', display: 'block' }}>
                      Only numbers allowed. Used for sending WhatsApp PDF bills and marketing campaigns.
                    </small>
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#fafaf9' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={modalLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem' }}
                  >
                    <Check size={16} />
                    {modalLoading ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Save Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: '3px 0 0',
  },
  exportCard: {
    padding: '1.25rem 1.5rem',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(249, 115, 22, 0.05) 100%)',
    border: '1px solid rgba(234, 179, 8, 0.2)',
  },
  exportHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  iconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(234, 179, 8, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
