'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api.js';
import { printThermalReceipt } from '../../../lib/printThermalReceipt.js';
import {
  ShoppingBag,
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Printer,
  QrCode,
  Banknote,
  CreditCard,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import QRCode from '../../../components/QRCode.js';

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export default function DedicatedCartPage() {
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [discountType, setDiscountType] = useState('PERCENT');
  const [discountValue, setDiscountValue] = useState('0');
  const [upiAccounts, setUpiAccounts] = useState([]);
  const [selectedUpiId, setSelectedUpiId] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [loading, setLoading] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);
  const [error, setError] = useState('');
  const [printError, setPrintError] = useState('');
  const [completedInvoice, setCompletedInvoice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let savedCartItems = [];
    // Load cart from localStorage shared state
    try {
      const savedCart = localStorage.getItem('pos_cart');
      if (savedCart) {
        savedCartItems = JSON.parse(savedCart);
        setCart(savedCartItems);
      }
    } catch (e) {
      console.error(e);
    }

    if (savedCartItems.length > 0) {
      apiFetch('/products')
        .then((response) => {
          const products = response.data || [];
          const repricedCart = savedCartItems.map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            if (!product) return item;

            const productUnits = product.units || [];
            const unit = productUnits.find((entry) => entry.id === item.unitId)
              || productUnits.find((entry) => entry.nameEn === item.unitName)
              || productUnits.find((entry) => entry.isSellUnit)
              || productUnits[0];
            const regularPrice = Number(
              unit?.sellingPrice
              ?? product.batches?.[0]?.sellingPrice
              ?? item.regularPrice
              ?? item.salePrice
              ?? 0
            );
            return { ...item, regularPrice, salePrice: regularPrice };
          });

          if (!cancelled) {
            setCart(repricedCart);
            localStorage.setItem('pos_cart', JSON.stringify(repricedCart));
          }
        })
        .catch((error) => console.error('Could not refresh cart prices:', error));
    }

    fetchUpiAccounts();

    return () => {
      cancelled = true;
    };
  }, []);

  const syncCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('pos_cart', JSON.stringify(newCart));
  };

  const fetchUpiAccounts = async () => {
    try {
      const res = await apiFetch('/upi?activeOnly=true');
      const accounts = res.data || [];
      setUpiAccounts(accounts);
      if (accounts.length > 0) {
        setSelectedUpiId(accounts[0].upiId);
      }
    } catch (err) {
      console.error('Failed to fetch UPI accounts:', err);
    }
  };

  const updateQty = (cartItemId, change, isDirectInput = false) => {
    const updated = cart
      .map((item) => {
        if (item.cartItemId === cartItemId) {
          let newQty = isDirectInput ? parseFloat(change) || 0 : item.qtyInUnit + change;
          if (newQty <= 0) return null;

          const factor = Number(item.factorToBase || 1);
          const totalStock = Number(item.productTotalStockBase || 99999);
          if (newQty * factor > totalStock) {
            alert(`Only enough stock for ${(totalStock / factor).toFixed(2)} ${item.unitName}!`);
            return item;
          }
          return { ...item, qtyInUnit: newQty };
        }
        return item;
      })
      .filter(Boolean);

    syncCart(updated);
  };

  const removeFromCart = (cartItemId) => {
    const updated = cart.filter((item) => item.cartItemId !== cartItemId);
    syncCart(updated);
  };

  const subtotal = roundMoney(cart.reduce((sum, item) => (
    sum + roundMoney(Number(item.regularPrice ?? item.salePrice ?? 0) * Number(item.qtyInUnit || 0))
  ), 0));
  const discountValueNumber = Number(discountValue || 0);
  const requestedDiscountAmount = Number.isFinite(discountValueNumber)
    ? discountType === 'PERCENT'
      ? subtotal * discountValueNumber / 100
      : discountValueNumber
    : 0;
  const discountAmount = roundMoney(Math.min(subtotal, Math.max(0, requestedDiscountAmount)));
  const discountIsValid = Number.isFinite(discountValueNumber)
    && discountValueNumber >= 0
    && (discountType === 'PERCENT' ? discountValueNumber <= 100 : requestedDiscountAmount <= subtotal);
  const grandTotal = roundMoney(Math.max(0, subtotal - discountAmount));

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Cart is empty!');
      return;
    }

    if (!discountIsValid) {
      setError(discountType === 'PERCENT'
        ? 'Discount percentage must be between 0% and 100%.'
        : `Discount cannot exceed subtotal (₹${subtotal.toFixed(2)}).`);
      return;
    }

    if (paymentMode === 'CASH' && cashGiven && parseFloat(cashGiven) < grandTotal) {
      setError(`Cash received (₹${cashGiven}) is less than total amount (₹${grandTotal.toFixed(2)})`);
      return;
    }

    if (paymentMode === 'UPI' && !selectedUpiId) {
      setError('Please select a UPI Account');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const itemsPayload = cart.map((item) => ({
        productId: item.productId,
        unitId: item.unitId,
        qtyInUnit: item.qtyInUnit,
        salePrice: Number(item.salePrice),
        regularPrice: Number(item.regularPrice ?? item.salePrice),
      }));

      const idempotencyKey = `cart-page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const res = await apiFetch('/pos/checkout', {
        method: 'POST',
        headers: {
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          items: itemsPayload,
          customerName: customerName.trim() || 'Guest Customer',
          phone: phone.trim() || undefined,
          paymentMode,
          discountType,
          discountValue: discountValueNumber,
          upiId: paymentMode === 'UPI' ? selectedUpiId : undefined,
          idempotencyKey,
        }),
      });

      // apiFetch returns the JSON body directly; also accept nested envelopes
      // so the completion dialog can use either checkout response shape.
      const responseData = res?.data ?? res ?? {};
      const invoice = responseData.invoice
        || responseData.data?.invoice
        || responseData.data
        || responseData;
      const invoiceNo = invoice.invoiceNo
        || responseData.invoiceNo
        || responseData.data?.invoiceNo
        || responseData.data?.invoice?.invoiceNo;
      setCompletedInvoice({
        ...invoice,
        invoiceNo,
        subtotal: Number(invoice.subtotal ?? responseData.subtotal ?? subtotal),
        discountAmount: Number(invoice.discountAmount ?? responseData.discountAmount ?? discountAmount),
        totalAmount: Number(invoice.totalAmount ?? responseData.totalAmount ?? responseData.total ?? grandTotal),
        paymentMode: invoice.paymentMode || paymentMode,
        customerName: invoice.customerName || customerName.trim() || 'Guest Customer',
        customerPhone: invoice.customerPhone || phone.trim(),
      });
      setPrintError(invoiceNo ? '' : 'Sale completed, but the invoice number was missing. Open Sales Invoices to print it.');

      // Clear Cart
      syncCart([]);
      setCustomerName('');
      setPhone('');
      setCashGiven('');
      setDiscountValue('0');
    } catch (err) {
      setError(err.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBill = async () => {
    if (!completedInvoice?.invoiceNo) {
      setPrintError('Invoice number is missing. Open Sales Invoices and print this sale there.');
      return;
    }

    setPrintingBill(true);
    setPrintError('');

    try {
      await printThermalReceipt(completedInvoice.invoiceNo);
    } catch (err) {
      setPrintError(err.message || 'Could not open the printer bill.');
    } finally {
      setPrintingBill(false);
    }
  };

  return (
    <>
      <style>{`
        .cart-page-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          color: #0f172a;
        }
        .cart-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .cart-page-heading {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          min-width: 0;
        }
        .cart-page-title {
          color: #0f172a;
          font-size: clamp(1.2rem, 2vw, 1.55rem);
          font-weight: 800;
          line-height: 1.25;
          margin: 0;
        }
        .cart-back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          flex-shrink: 0;
          color: #475569;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
          background: #fff;
          padding: 0.55rem 0.8rem;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
        }
        .cart-back-link:hover {
          color: #c2410c;
          border-color: #fdba74;
          background: #fff7ed;
        }
        .cart-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.9fr);
          gap: 1.25rem;
          align-items: start;
        }
        .cart-items-card {
          border-radius: 20px;
          padding: 1.5rem;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .cart-summary-card {
          border-radius: 20px;
          padding: 1.5rem;
          background: #fff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
        }
        .cart-summary-card .input-group label {
          color: #334155;
          font-size: 0.82rem;
        }
        .cart-summary-card .input-control::placeholder {
          color: #64748b;
          opacity: 1;
        }
        .cart-table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .cart-table {
          width: 100%;
          min-width: 620px;
          border-collapse: collapse;
        }
        .cart-table th {
          text-align: left;
          padding: 0.75rem 0.5rem;
          color: #475569;
          background: #f8fafc;
          font-size: 0.78rem;
          font-weight: 700;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }
        .cart-table td {
          padding: 0.85rem 0.5rem;
          color: #0f172a;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .pay-mode-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 44px;
        }
        .pay-mode-btn:hover {
          border-color: #fdba74 !important;
          background: #fff7ed !important;
          color: #c2410c !important;
        }
        .cart-qr-panel {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 14px;
          padding: 1rem;
          text-align: center;
        }
        .cart-total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 0.85rem 0;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }
        .cart-submit-btn {
          background: linear-gradient(135deg, #f97316, #ea580c);
          box-shadow: 0 6px 16px rgba(234, 88, 12, 0.2);
        }
        .cart-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #ea580c, #c2410c);
          box-shadow: 0 8px 20px rgba(194, 65, 12, 0.24);
        }
        @media (max-width: 1100px) {
          .cart-grid {
            grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.9fr);
            gap: 1rem;
          }
        }
        @media (max-width: 900px) {
          .cart-grid {
            grid-template-columns: 1fr;
          }
          .cart-summary-card {
            width: 100%;
          }
        }
        @media (max-width: 600px) {
          .cart-page-header,
          .cart-page-heading {
            align-items: flex-start;
          }
          .cart-page-header {
            flex-direction: column;
          }
          .cart-page-heading {
            flex-direction: column;
            gap: 0.75rem;
          }
          .cart-items-card,
          .cart-summary-card {
            padding: 1rem;
            border-radius: 16px;
          }
        }
      `}</style>

      <div className="cart-page-container animate-fade-in">
        {/* Navigation Bar */}
        <div className="cart-page-header">
          <div className="cart-page-heading">
            <Link
              href="/pos"
              className="cart-back-link"
            >
              <ArrowLeft size={16} /> Back to POS Billing
            </Link>
            <h1 className="cart-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShoppingBag color="#ea580c" size={26} /> Cart & Order Checkout
            </h1>
          </div>
          <span className="badge badge-info" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
            {cart.length} Items in Cart
          </span>
        </div>

        <div className="cart-grid">
          {/* Left Column: Cart Items Table */}
          <div className="cart-items-card glass-panel">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c2410c', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} /> Selected Products List
            </h2>

            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#475569' }}>
                <ShoppingBag size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.05rem', margin: 0 }}>Your cart is empty.</p>
                <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.4rem', lineHeight: 1.6 }}>
                  Go to POS page and click on items to add them here!
                </p>
                <Link href="/pos" className="btn btn-primary" style={{ marginTop: '1.25rem', display: 'inline-flex' }}>
                  Browse Products on POS
                </Link>
              </div>
            ) : (
              <div className="cart-table-wrap">
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Unit Price</th>
                      <th>Quantity</th>
                      <th>Total (₹)</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.cartItemId}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem', overflowWrap: 'anywhere' }}>{item.nameEn}</div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                            {item.nameHi} • <span style={{ color: '#c2410c', fontWeight: 600 }}>{item.unitName}</span>
                          </div>
                        </td>
                        <td style={{ color: '#334155', fontWeight: 600 }}>
                          <span>₹{Number(item.regularPrice ?? item.salePrice).toFixed(2)}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              onClick={() => updateQty(item.cartItemId, -1)}
                              style={{
                                background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155',
                                width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <Minus size={12} />
                            </button>
                            {item.allowDecimalQty ? (
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={item.qtyInUnit}
                                onChange={(e) => updateQty(item.cartItemId, e.target.value, true)}
                                style={{
                                  width: '64px', textAlign: 'center', background: '#fff',
                                  border: '1px solid #cbd5e1', color: '#0f172a',
                                  borderRadius: '8px', fontSize: '0.9rem', padding: '5px',
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{item.qtyInUnit}</span>
                            )}
                            <button
                              onClick={() => updateQty(item.cartItemId, 1)}
                              style={{
                                background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155',
                                width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td style={{ color: '#c2410c', fontWeight: 800, fontSize: '1rem' }}>
                          ₹{roundMoney(Number(item.regularPrice ?? item.salePrice) * item.qtyInUnit).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => removeFromCart(item.cartItemId)}
                            style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '0.4rem 0.55rem', borderRadius: 8, cursor: 'pointer' }}
                            title="Remove item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Order Checkout Form */}
          <div className="cart-summary-card">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem' }}>
              Order & Payment Details
            </h2>

            <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
              <div style={{ background: '#fff1f2', color: '#be123c', padding: '0.75rem', borderRadius: 10, fontSize: '0.88rem', border: '1px solid #fecdd3' }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="input-group">
                <label>Customer Name</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ramesh Sharma (or Guest)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Phone Number (WhatsApp PDF Invoice)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className="input-control"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <small style={{ display: 'block', marginTop: '0.35rem', color: '#64748b', lineHeight: 1.4 }}>
                  We’ll send the PDF invoice to this WhatsApp number after checkout.
                </small>
              </div>

              <div className="input-group" style={{ padding: '0.85rem', background: '#fffaf5', border: '1px solid #fed7aa', borderRadius: 12 }}>
                <label htmlFor="cart-discount-value">Cart discount</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 0.85fr) minmax(0, 1.15fr)', gap: '0.6rem' }}>
                  <select className="input-control" value={discountType} onChange={(e) => setDiscountType(e.target.value)} aria-label="Discount type">
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="AMOUNT">Fixed amount (₹)</option>
                  </select>
                  <input
                    id="cart-discount-value"
                    type="number"
                    min="0"
                    max={discountType === 'PERCENT' ? 100 : subtotal}
                    step="0.01"
                    className="input-control"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    aria-label={discountType === 'PERCENT' ? 'Discount percentage' : 'Discount amount in rupees'}
                  />
                </div>
                <small style={{ color: '#64748b', lineHeight: 1.4 }}>Applied once to the whole bill at checkout.</small>
                {!discountIsValid && <small role="alert" style={{ color: '#be123c' }}>
                  {discountType === 'PERCENT' ? 'Enter a discount between 0% and 100%.' : 'Discount cannot be more than the subtotal.'}
                </small>}
              </div>

              {/* Payment Method Selector */}
              <div className="input-group">
                <label>Payment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {[
                    { id: 'UPI', label: 'UPI QR', icon: QrCode },
                    { id: 'CASH', label: 'Cash', icon: Banknote },
                    { id: 'CARD', label: 'Card', icon: CreditCard },
                    { id: 'KHATA', label: 'Khata', icon: BookOpen },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = paymentMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        className="pay-mode-btn"
                        onClick={() => setPaymentMode(mode.id)}
                        style={{
                          border: isSelected ? '1px solid #ea580c' : '1px solid #dbe2ea',
                          background: isSelected ? '#fff7ed' : '#fff',
                          color: isSelected ? '#c2410c' : '#475569',
                        }}
                      >
                        <Icon size={16} />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Payment QR / Cash Inputs */}
              {paymentMode === 'UPI' && cart.length > 0 && grandTotal > 0 && (
                <div className="cart-qr-panel">
                  {upiAccounts.length > 0 && (
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '0.65rem', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                      <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Select UPI:</span>
                      <select 
                        value={selectedUpiId}
                        onChange={(e) => setSelectedUpiId(e.target.value)}
                        style={{
                          background: '#fff',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          padding: '0.3rem 0.5rem',
                          borderRadius: '6px',
                          outline: 'none',
                          fontSize: '0.8rem'
                        }}
                      >
                        {upiAccounts.map(acc => (
                          <option key={acc.id || acc.upiId} value={acc.upiId}>{acc.name || acc.upiId} ({acc.upiId})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ margin: '0.5rem 0', display: 'flex', justifyContent: 'center' }}>
                    {selectedUpiId ? (
                      <QRCode
                        value={`upi://pay?pa=${selectedUpiId}&pn=Shree%20Pooja%20Ghar&am=${grandTotal.toFixed(2)}&cu=INR&tn=Bill%20Shree%20Pooja%20Ghar`}
                        size={140}
                      />
                    ) : (
                      <div style={{ height: 140, display: 'flex', alignItems: 'center', color: '#475569' }}>
                        No Active UPI Account
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.4rem' }}>
                    Scan QR with Google Pay, PhonePe, Paytm or BHIM
                  </div>
                </div>
              )}

              {paymentMode === 'CASH' && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.75rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Cash Received (₹)</label>
                    <input
                      type="number"
                      className="input-control"
                      placeholder="e.g. 500"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                    />
                  </div>
                  {cashGiven && parseFloat(cashGiven) >= grandTotal && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', color: '#047857', fontWeight: 700 }}>
                      <span>Change to Return:</span>
                      <span style={{ fontSize: '1.1rem' }}>₹{(parseFloat(cashGiven) - grandTotal).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gap: '0.4rem', padding: '0.25rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Subtotal</span><strong>₹{subtotal.toFixed(2)}</strong>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857' }}>
                    <span>Bill discount</span><strong>−₹{discountAmount.toFixed(2)}</strong>
                  </div>
                )}
              </div>

              <div className="cart-total-row">
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Grand Total</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c2410c' }}>₹{grandTotal.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary cart-submit-btn"
                disabled={cart.length === 0 || loading || !discountIsValid}
                style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem', fontWeight: 800, borderRadius: 14 }}
              >
                {loading ? 'Processing Order...' : `Complete Order (₹${grandTotal.toFixed(2)})`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Completed Invoice Modal */}
      {completedInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: 380, maxWidth: '100%', borderRadius: 20, padding: '2rem 1.5rem', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}>
            <CheckCircle2 size={52} color="#10b981" style={{ margin: '0 auto' }} />
            <h2 style={{ marginTop: '0.75rem', marginBottom: '0.2rem', color: '#0f172a' }}>Order Completed!</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Invoice #: <strong style={{ color: '#c2410c' }}>{completedInvoice.invoiceNo || 'Not available'}</strong>
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', margin: '1.25rem 0', textAlign: 'left', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#475569' }}>Subtotal:</span>
                <strong style={{ color: '#0f172a' }}>₹{Number(completedInvoice.subtotal || 0).toFixed(2)}</strong>
              </div>
              {Number(completedInvoice.discountAmount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#475569' }}>Bill discount:</span>
                  <strong style={{ color: '#047857' }}>−₹{Number(completedInvoice.discountAmount).toFixed(2)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#475569' }}>Total Paid:</span>
                <strong style={{ color: '#047857', fontSize: '1rem' }}>₹{Number(completedInvoice.totalAmount || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Payment Method:</span>
                <strong style={{ color: '#0f172a' }}>{completedInvoice.paymentMode}</strong>
              </div>
            </div>

            {printError && (
              <div role="alert" style={{ margin: '-0.5rem 0 1rem', color: '#be123c', fontSize: '0.84rem' }}>
                {printError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handlePrintBill} className="btn btn-secondary" style={{ flex: 1 }} disabled={printingBill}>
                <Printer size={16} /> {printingBill ? 'Preparing…' : 'Print Bill'}
              </button>
              <button onClick={() => setCompletedInvoice(null)} className="btn btn-primary" style={{ flex: 1 }}>
                New Order
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
