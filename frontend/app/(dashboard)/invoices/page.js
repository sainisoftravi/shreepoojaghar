'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api.js';
import { printThermalReceipt } from '../../../lib/printThermalReceipt.js';
import { useAuth } from '../../../context/AuthContext.js';
import { Eye, Printer, MessageSquare } from 'lucide-react';

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resendingInvoice, setResendingInvoice] = useState('');
  const [printingInvoice, setPrintingInvoice] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await apiFetch('/invoices');
      setInvoices(res.data?.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (invoiceNo) => {
    try {
      const res = await apiFetch(`/invoices/${invoiceNo}`);
      setSelectedInvoice(res.data);
    } catch (err) {
      alert(err.message || 'Failed to fetch invoice details');
    }
  };

  const resendWhatsAppInvoice = async (invoiceNo) => {
    setResendingInvoice(invoiceNo);
    try {
      await apiFetch(`/invoices/${encodeURIComponent(invoiceNo)}/resend-whatsapp`, { method: 'POST' });
      setInvoices((current) => current.map((invoice) => (
        invoice.invoiceNo === invoiceNo ? { ...invoice, waStatus: 'QUEUED' } : invoice
      )));
    } catch (err) {
      alert(err.message || 'Could not queue the WhatsApp invoice');
    } finally {
      setResendingInvoice('');
    }
  };

  const printSelectedInvoice = async () => {
    if (!selectedInvoice?.invoiceNo) return;
    setPrintingInvoice(true);
    try {
      await printThermalReceipt(selectedInvoice.invoiceNo);
    } catch (err) {
      alert(err.message || 'Could not open the printer bill');
    } finally {
      setPrintingInvoice(false);
    }
  };

  return (
    <>
      <style>{`
        .inv-modal-detail {
          width: 460px;
          border-radius: 20px;
          padding: 2rem;
          max-height: 100vh;
          overflow-y: auto;
        }
        @media (max-width: 768px) {
          .inv-modal-detail {
            width: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Sales Invoices</h1>
          <p style={styles.subtitle}>{user?.role === 'ADMIN' ? 'Historical transactions, locked profits & WhatsApp status' : 'Historical transactions & WhatsApp status'}</p>
        </div>
      </div>

      {/* Table */}
      <div className="table-container table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Customer</th>
              <th>Date & Time</th>
              <th>Payment Mode</th>
              <th>Total Amount</th>
              {user?.role === 'ADMIN' && <th>Profit Locked</th>}
              <th>WhatsApp Status</th>
              {user?.role === 'ADMIN' && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <code style={styles.code}>{inv.invoiceNo}</code>
                </td>
                <td>
                  <div style={{ fontWeight: '700' }}>{inv.customerName || 'Guest'}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{inv.customerPhone}</div>
                </td>
                <td>
                  {new Date(inv.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </td>
                <td>
                  <span className="badge badge-info">{inv.paymentMode}</span>
                </td>
                <td>
                  <strong style={{ fontSize: '1.05rem', color: '#b95117' }}>
                    ₹{Number(inv.totalAmount).toFixed(2)}
                  </strong>
                </td>
                {user?.role === 'ADMIN' && (
                  <td>
                    <strong style={{ color: '#187653' }}>
                      ₹{Number(inv.totalProfit).toFixed(2)}
                    </strong>
                  </td>
                )}
                <td>
                  <span
                    className={`badge ${
                      inv.waStatus === 'SENT'
                        ? 'badge-success'
                        : inv.waStatus === 'QUEUED'
                        ? 'badge-warning'
                        : 'badge-danger'
                    }`}
                  >
                    {inv.waStatus}
                  </span>
                </td>
                {user?.role === 'ADMIN' && (
                  <td>
                    {inv.waStatus === 'FAILED' && inv.customerPhone && (
                      <button
                        onClick={() => resendWhatsAppInvoice(inv.invoiceNo)}
                        className="btn btn-sm btn-secondary"
                        style={{ marginRight: '0.4rem' }}
                        disabled={resendingInvoice === inv.invoiceNo}
                        title="Queue this invoice for WhatsApp again"
                      >
                        <MessageSquare size={14} /> {resendingInvoice === inv.invoiceNo ? 'Queueing…' : 'Retry WhatsApp'}
                      </button>
                    )}
                    <button
                      onClick={() => viewDetails(inv.invoiceNo)}
                      className="btn btn-sm btn-secondary"
                    >
                      <Eye size={14} /> View
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div style={styles.modalOverlay}>
          <div className="inv-modal-detail glass-panel animate-fade-in">
            <div style={styles.modalHeader}>
              <h2>Invoice {selectedInvoice.invoiceNo}</h2>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div style={styles.metaBox}>
              <div>Customer: <strong>{selectedInvoice.customerName}</strong></div>
              <div>Phone: <strong>{selectedInvoice.customerPhone}</strong></div>
              <div>Payment: <strong>{selectedInvoice.paymentMode}</strong></div>
            </div>

            <h4>Items Purchased</h4>
            <div style={styles.itemList}>
              {selectedInvoice.items?.map((item) => (
                <div key={item.id} style={styles.itemRow}>
                  <div>
                    <div style={{ fontWeight: '700' }}>{item.productName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {user?.role === 'ADMIN' && `Unit Cost: ₹${Number(item.unitCost).toFixed(2)} | `}
                      Sale: ₹{Number(item.unitSalePrice).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    x{Number(item.qtyInUnit ?? item.quantity)} {item.unitName || ''} = <strong>₹{Number(item.grossLineTotal ?? item.unitSalePrice * item.quantity).toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.summaryBox}>
              <div style={styles.sumRow}>
                <span>Subtotal:</span>
                <strong>₹{Number(selectedInvoice.subtotal ?? selectedInvoice.totalAmount).toFixed(2)}</strong>
              </div>
              {Number(selectedInvoice.discountAmount || 0) > 0 && (
                <div style={styles.sumRow}>
                  <span>Bill discount:</span>
                  <strong style={{ color: '#047857' }}>−₹{Number(selectedInvoice.discountAmount).toFixed(2)}</strong>
                </div>
              )}
              <div style={styles.sumRow}>
                <span>Total Amount:</span>
                <span style={{ fontSize: '1.2rem', color: '#b95117', fontWeight: '800' }}>
                  ₹{Number(selectedInvoice.totalAmount).toFixed(2)}
                </span>
              </div>
              {user?.role === 'ADMIN' && (
                <div style={styles.sumRow}>
                  <span>Profit Earned:</span>
                  <span style={{ color: '#187653', fontWeight: '800' }}>
                    ₹{Number(selectedInvoice.totalProfit).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button onClick={printSelectedInvoice} className="btn btn-secondary" disabled={printingInvoice}>
                <Printer size={16} /> {printingInvoice ? 'Preparing…' : 'Print Bill'}
              </button>
              <button onClick={() => setSelectedInvoice(null)} className="btn btn-primary">
                Close
              </button>
            </div>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: '800',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#536168',
  },
  tableContainer: {
    borderRadius: '18px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.9rem',
  },
  code: {
    background: 'rgba(249, 115, 22, 0.15)',
    color: '#a84918',
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    width: '460px',
    borderRadius: '20px',
    padding: '2rem',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#647179',
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
  metaBox: {
    background: '#f6f6f2',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    fontSize: '0.85rem',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  itemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    margin: '0.8rem 0',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#f8f8f5',
    padding: '0.6rem 0.8rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
  },
  summaryBox: {
    borderTop: '1px solid #e5e7e2',
    paddingTop: '0.8rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  sumRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.25rem',
  },
};
