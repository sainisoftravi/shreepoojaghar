'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api.js';
import { useAuth } from '../../../context/AuthContext.js';
import { Package, Plus, AlertTriangle, Layers, Tag, DollarSign, Search, Trash2, X, Check } from 'lucide-react';

const getPurchaseUnits = (product) => {
  const units = product?.units || [];
  const purchaseUnits = units.filter((unit) => unit.isPurchaseUnit === true);
  return purchaseUnits.length ? purchaseUnits : units;
};

const getSellUnits = (product) => {
  const units = product?.units || [];
  const sellUnits = units.filter((unit) => unit.isSellUnit === true);
  return sellUnits.length || units.some((unit) => typeof unit.isSellUnit === 'boolean')
    ? sellUnits
    : units;
};

export default function InventoryPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // New Product Form
  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnit, setBaseUnit] = useState('kg');
  const [allowDecimalQty, setAllowDecimalQty] = useState(true);
  const [barcode, setBarcode] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Multi-unit definitions for New Product
  const [units, setUnits] = useState([
    { nameEn: 'kg', nameHi: 'किलोग्राम', factorToBase: 1.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 25, priceOverride: '' },
    { nameEn: 'bori', nameHi: 'बोरी', factorToBase: 50.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 10, priceOverride: '' },
    { nameEn: '500g', nameHi: '500 ग्राम', factorToBase: 0.5, isPurchaseUnit: false, isSellUnit: true, marginPercent: 30, priceOverride: '' },
  ]);

  // New Batch Form State
  const [purchaseUnitId, setPurchaseUnitId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState(''); // "Kitni Bori"
  const [purchasePricePerUnit, setPurchasePricePerUnit] = useState(''); // "Bori ka rate"
  const [vendor, setVendor] = useState('');
  const [batchMarginOverrides, setBatchMarginOverrides] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await apiFetch('/products');
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories');
      setCategories(res.data || []);
      if (res.data?.length > 0) setCategoryId(res.data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Preset Handlers
  const applyPreset = (type) => {
    if (type === 'kg_bori') {
      setBaseUnit('kg');
      setAllowDecimalQty(true);
      setUnits([
        { nameEn: 'kg', nameHi: 'किग्रा', factorToBase: 1.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 25, priceOverride: '', minQty: 0.001, qtyStep: 0.001 },
        { nameEn: 'bori', nameHi: 'बोरी (50kg)', factorToBase: 50.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 10, priceOverride: '', minQty: 1, qtyStep: 1 },
      ]);
    } else if (type === 'gram_bori') {
      setBaseUnit('gram');
      setAllowDecimalQty(true);
      setUnits([
        { nameEn: '1 kg', nameHi: '1 किग्रा', factorToBase: 1000.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 25, priceOverride: '', minQty: 1, qtyStep: 1 },
        { nameEn: '500 g', nameHi: '500 ग्राम', factorToBase: 500.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 25, priceOverride: '', minQty: 1, qtyStep: 1 },
        { nameEn: 'bori (25kg)', nameHi: 'बोरी (25kg)', factorToBase: 25000.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 10, priceOverride: '', minQty: 1, qtyStep: 1 },
      ]);
    } else if (type === 'ml_tin') {
      setBaseUnit('ml');
      setAllowDecimalQty(true);
      setUnits([
        { nameEn: '1 litre', nameHi: '1 लीटर', factorToBase: 1000.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 20, priceOverride: '', minQty: 1, qtyStep: 1 },
        { nameEn: 'tin (15L)', nameHi: 'टीन (15L)', factorToBase: 15000.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 10, priceOverride: '', minQty: 1, qtyStep: 1 },
      ]);
    } else if (type === 'piece_dozen') {
      setBaseUnit('piece');
      setAllowDecimalQty(false);
      setUnits([
        { nameEn: 'piece', nameHi: 'पीस', factorToBase: 1.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 25, priceOverride: '', minQty: 1, qtyStep: 1 },
        { nameEn: 'dozen', nameHi: 'दर्जन', factorToBase: 12.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 15, priceOverride: '', minQty: 1, qtyStep: 1 },
      ]);
    } else if (type === 'bottle_carton') {
      setBaseUnit('bottle');
      setAllowDecimalQty(false);
      setUnits([
        { nameEn: 'bottle', nameHi: 'बोतल', factorToBase: 1.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 20, priceOverride: '', minQty: 1, qtyStep: 1 },
        { nameEn: 'carton (24)', nameHi: 'कार्टन (24)', factorToBase: 24.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 12, priceOverride: '', minQty: 1, qtyStep: 1 },
      ]);
    } else if (type === 'single_unit') {
      setUnits([
        { nameEn: baseUnit, nameHi: baseUnit, factorToBase: 1.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 25, priceOverride: '', minQty: 1, qtyStep: 1 },
      ]);
    }
  };

  const addUnitRow = () => {
    setUnits([
      ...units,
      { nameEn: '', nameHi: '', factorToBase: 1.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 25, priceOverride: '', minQty: 1, qtyStep: 1 },
    ]);
  };

  const updateUnitRow = (index, field, value) => {
    const updated = [...units];
    updated[index][field] = value;
    setUnits(updated);
  };

  const removeUnitRow = (index) => {
    if (units.length <= 1) return;
    setUnits(units.filter((_, i) => i !== index));
  };

  const handleDeleteProduct = async (productId, nameEn) => {
    if (!confirm(`Are you sure you want to delete product "${nameEn}"?`)) return;
    try {
      await apiFetch(`/products/${productId}`, { method: 'DELETE' });
      fetchProducts();
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };

  // Add New Product
  const handleAddProduct = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          nameEn,
          nameHi,
          categoryId,
          baseUnit,
          allowDecimalQty,
          lowStockThreshold: parseFloat(lowStockThreshold) || 0,
          barcode: barcode.trim() || undefined,
          units: units.map((u, i) => ({
            ...u,
            factorToBase: parseFloat(u.factorToBase) || 1.0,
            marginPercent: parseFloat(u.marginPercent) || 0,
            priceOverride: u.priceOverride ? parseFloat(u.priceOverride) : null,
            minQty: parseFloat(u.minQty) || 1.0,
            qtyStep: parseFloat(u.qtyStep) || 1.0,
            sortOrder: i,
          })),
        }),
      });

      const product = res.data;

      if (imageFile && product?.id) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await fetch(`/api/v1/products/${product.id}/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });
      }

      setShowProductModal(false);
      resetProductForm();
      fetchProducts();
    } catch (err) {
      setError(err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  // Add Batch Stock
  const handleAddBatch = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setError('');
    setLoading(true);

    try {
      await apiFetch('/batches', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.id,
          purchaseUnitId: purchaseUnitId || undefined,
          purchaseQty: parseFloat(purchaseQty),
          purchasePricePerUnit: parseFloat(purchasePricePerUnit),
          vendor: vendor.trim() || undefined,
        }),
      });

      setShowBatchModal(false);
      resetBatchForm();
      fetchProducts();
    } catch (err) {
      setError(err.message || 'Failed to add batch stock');
    } finally {
      setLoading(false);
    }
  };

  const openBatchModalForProduct = (prod) => {
    setSelectedProduct(prod);
    const purchaseUnit = getPurchaseUnits(prod)[0];
    setPurchaseUnitId(purchaseUnit ? purchaseUnit.id : '');
    setPurchaseQty('');
    setPurchasePricePerUnit('');
    setVendor('');
    setError('');
    setShowBatchModal(true);
  };

  const resetProductForm = () => {
    setNameEn('');
    setNameHi('');
    setBarcode('');
    setBaseUnit('kg');
    setAllowDecimalQty(true);
    setLowStockThreshold(10);
    setImageFile(null);
    setImagePreview(null);
    applyPreset('kg_bori');
  };

  const resetBatchForm = () => {
    setPurchaseQty('');
    setPurchasePricePerUnit('');
    setVendor('');
    setSelectedProduct(null);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      p.nameHi?.includes(search) ||
      p.barcode?.includes(search)
  );

  // Live Batch Calculation Details
  const purchaseUnits = getPurchaseUnits(selectedProduct);
  const sellUnits = getSellUnits(selectedProduct);
  const activePurchaseUnit = purchaseUnits.find((u) => u.id === purchaseUnitId) || purchaseUnits[0];
  const pFactor = activePurchaseUnit ? Number(activePurchaseUnit.factorToBase) : 1.0;
  const pQty = parseFloat(purchaseQty) || 0;
  const pPrice = parseFloat(purchasePricePerUnit) || 0;
  const totalBaseQty = pQty * pFactor;
  const costPerBase = pFactor > 0 ? pPrice / pFactor : 0;

  return (
    <>
      <style>{`
        .inventory-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .inv-modal { width: 560px; max-width: 95vw; max-height: 90vh; overflow-y: auto; border-radius: 20px; padding: 1.75rem; background: #fff; color: #0f172a; }
        .preset-btn { background: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.78rem; cursor: pointer; font-weight: 600; }
        .preset-btn:hover { background: #ea580c; border-color: #ea580c; color: #fff; }
        .unit-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.82rem; }
        .unit-table th, .unit-table td { padding: 0.55rem 0.4rem; border-bottom: 1px solid #e2e8f0; text-align: left; color: #334155; }
        .unit-table th { color: #475569; background: #f8fafc; }
        .batch-preview-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1rem; margin: 1rem 0; }
        @media (max-width: 720px) {
          .inventory-header { flex-direction: column; align-items: flex-start; }
          .inventory-header .btn { width: 100%; }
          .inv-modal { width: 100%; max-width: 100%; max-height: 100dvh; border-radius: 0; padding: 1rem; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header */}
        <div className="inventory-header">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Inventory & Multi-Unit Batches</h1>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
              Track base stock, purchase units (bori/tin/box), sell units (kg/500g), and margin pricing
            </p>
          </div>
          {user?.role === 'ADMIN' && (
            <Link href="/inventory/add" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={18} /> Add New Product
            </Link>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: '0.75rem 1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="glass-panel">
          <Search size={18} color="#64748b" />
          <input
            type="text"
            placeholder="Search by product name (English/Hindi), barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', color: '#0f172a', width: '100%', fontSize: '0.95rem' }}
          />
        </div>

        {/* Product Table */}
        <div className="table-container table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: 56 }}>Image</th>
                <th>Product & Hindi Name</th>
                <th>Category</th>
                <th>Base Unit</th>
                <th>Available Stock</th>
                <th>Sell Units & Prices</th>
                <th>Status</th>
                {user?.role === 'ADMIN' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const threshold = Number(p.lowStockThreshold) > 0 ? Number(p.lowStockThreshold) : Number(p.minAlertQty || 0);
                const isOutOfStock = Number(p.totalStockBase) <= 0;
                const isLowStock = Number(p.totalStockBase) <= threshold;

                return (
                  <tr key={p.id}>
                    <td>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.nameEn} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>🪔</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere' }}>{p.nameEn}</div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', overflowWrap: 'anywhere' }}>{p.nameHi}</div>
                      {p.barcode && <code style={{ fontSize: '0.75rem', color: '#64748b' }}>Barcode: {p.barcode}</code>}
                    </td>
                    <td><span className="badge badge-info">{p.category?.nameEn}</span></td>
                    <td><strong style={{ color: '#c2410c' }}>{p.baseUnit}</strong></td>
                    <td>
                      <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{p.formattedStock || `${p.totalStockBase} ${p.baseUnit}`}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {p.units?.map((u) => (
                          <span key={u.id} style={{ background: '#f8fafc', color: '#334155', padding: '3px 7px', borderRadius: 6, fontSize: '0.78rem', border: '1px solid #e2e8f0' }}>
                            <strong>{u.nameEn}</strong>:{' '}
                            {' '}₹{Number(u.sellingPrice).toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${isOutOfStock ? 'badge-danger' : isLowStock ? 'badge-warning' : 'badge-success'}`}>
                        {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock Warning' : 'In Stock'}
                      </span>
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button onClick={() => openBatchModalForProduct(p)} className="btn btn-sm btn-secondary" title="Add Stock Batch">
                          <Plus size={14} /> Add Batch
                        </button>
                        <button onClick={() => handleDeleteProduct(p.id, p.nameEn)} className="btn btn-sm" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '0.4rem 0.6rem' }} title="Delete product">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Add Product Modal ─── */}
        {showProductModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="inv-modal glass-panel animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Add Multi-Unit Product</h2>
                <button onClick={() => setShowProductModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              {error && <div style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '0.6rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1rem' }}>⚠️ {error}</div>}

              {/* Quick Presets */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Quick Product Presets:</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="preset-btn" onClick={() => applyPreset('kg_bori')}>🌾 kg + bori (50kg)</button>
                  <button type="button" className="preset-btn" onClick={() => applyPreset('gram_bori')}>⚖️ gram + bori (25kg)</button>
                  <button type="button" className="preset-btn" onClick={() => applyPreset('ml_tin')}>🛢️ ml + tin (15L)</button>
                  <button type="button" className="preset-btn" onClick={() => applyPreset('piece_dozen')}>🔔 piece + dozen</button>
                  <button type="button" className="preset-btn" onClick={() => applyPreset('bottle_carton')}>🍾 bottle + carton (24)</button>
                  <button type="button" className="preset-btn" onClick={() => applyPreset('single_unit')}>📦 Single Unit Only</button>
                </div>
              </div>

              <form onSubmit={handleAddProduct}>
                <div className="form-grid">
                  <div className="input-group">
                    <label>English Name</label>
                    <input type="text" className="input-control" placeholder="e.g. Sugar (Chini)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label>Hindi Name</label>
                    <input type="text" className="input-control" placeholder="e.g. चीनी / शक्कर" value={nameHi} onChange={(e) => setNameHi(e.target.value)} required />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="input-group">
                    <label>Category</label>
                    <select className="input-control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                      {categories.map((c) => (<option key={c.id} value={c.id}>{c.nameEn} ({c.nameHi})</option>))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Barcode (Optional)</label>
                    <input type="text" className="input-control" placeholder="e.g. 890100100101" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="input-group">
                    <label>Base Unit (Smallest Unit)</label>
                    <select
                      className="input-control"
                      value={baseUnit}
                      onChange={(e) => {
                        const newBase = e.target.value;
                        setBaseUnit(newBase);
                        // If single unit configured, sync unit name
                        if (units.length === 1 && units[0].factorToBase === 1) {
                          setUnits([{ ...units[0], nameEn: newBase, nameHi: newBase }]);
                        }
                      }}
                    >
                      <option value="piece">piece (पीस)</option>
                      <option value="pack">pack (पैकेट)</option>
                      <option value="gram">gram (ग्राम)</option>
                      <option value="kg">kg (किलोग्राम)</option>
                      <option value="ml">ml (मिलीलीटर)</option>
                      <option value="litre">litre (लीटर)</option>
                      <option value="bottle">bottle (बोतल)</option>
                      <option value="set">set (सेट)</option>
                      <option value="roll">roll (रोल)</option>
                      <option value="pair">pair (जोड़ी)</option>
                      <option value="meter">meter (मीटर)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Low Stock Warning Threshold</label>
                    <input type="number" step="0.1" className="input-control" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" id="decimalQty" checked={allowDecimalQty} onChange={(e) => setAllowDecimalQty(e.target.checked)} />
                  <label htmlFor="decimalQty" style={{ fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>Allow decimal quantities at checkout (e.g. 0.5 kg / 500g)</label>
                </div>

                {/* Sell & Purchase Units Table */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.75rem', marginBottom: '1rem', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c2410c' }}>Product Units Configuration (Purchase & Sell Units)</label>
                    <button type="button" onClick={addUnitRow} className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>+ Add Unit</button>
                  </div>

                  <datalist id="custom-unit-suggestions">
                    <option value="carton" />
                    <option value="box" />
                    <option value="tin" />
                    <option value="dozen" />
                    <option value="bori" />
                    <option value="dabba" />
                    <option value="bundle" />
                    <option value="kg" />
                    <option value="gram" />
                    <option value="piece" />
                    <option value="pack" />
                    <option value="litre" />
                  </datalist>

                  <table className="unit-table">
                    <thead>
                      <tr>
                        <th>Unit Name</th>
                        <th>Hindi Name</th>
                        <th>Factor to Base</th>
                        <th>Margin %</th>
                        <th>Override (₹)</th>
                        <th>Min Qty</th>
                        <th>Step</th>
                        <th>Purchase</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((u, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              type="text"
                              list="custom-unit-suggestions"
                              className="input-control"
                              style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                              value={u.nameEn}
                              onChange={(e) => updateUnitRow(i, 'nameEn', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="input-control"
                              style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                              value={u.nameHi || ''}
                              onChange={(e) => updateUnitRow(i, 'nameHi', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.0001"
                              className="input-control"
                              style={{ padding: '4px 6px', fontSize: '0.8rem', width: 65 }}
                              value={u.factorToBase}
                              onChange={(e) => updateUnitRow(i, 'factorToBase', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              className="input-control"
                              style={{ padding: '4px 6px', fontSize: '0.8rem', width: 55 }}
                              value={u.marginPercent}
                              onChange={(e) => updateUnitRow(i, 'marginPercent', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="1"
                              className="input-control"
                              style={{ padding: '4px 6px', fontSize: '0.8rem', width: 60 }}
                              placeholder="Auto"
                              value={u.priceOverride || ''}
                              onChange={(e) => updateUnitRow(i, 'priceOverride', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.001"
                              className="input-control"
                              style={{ padding: '4px 6px', fontSize: '0.8rem', width: 55 }}
                              value={u.minQty || 1}
                              onChange={(e) => updateUnitRow(i, 'minQty', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.001"
                              className="input-control"
                              style={{ padding: '4px 6px', fontSize: '0.8rem', width: 55 }}
                              value={u.qtyStep || 1}
                              onChange={(e) => updateUnitRow(i, 'qtyStep', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name="purchaseUnitRadio"
                              checked={u.isPurchaseUnit}
                              onChange={() => {
                                const updated = units.map((row, idx) => ({ ...row, isPurchaseUnit: idx === i }));
                                setUnits(updated);
                              }}
                            />
                          </td>
                          <td>
                            {units.length > 1 && (
                              <button type="button" onClick={() => removeUnitRow(i)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}>✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Product Image */}
                <div className="input-group">
                  <label>Product Image</label>
                  <input type="file" accept="image/*" className="input-control" onChange={(e) => {
                    const f = e.target.files?.[0];
                    setImageFile(f || null);
                    setImagePreview(f ? URL.createObjectURL(f) : null);
                  }} />
                  {imagePreview && <img src={imagePreview} alt="preview" style={{ marginTop: '0.5rem', width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowProductModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Create Product'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Add Batch Stock Modal (Kitni Bori / Bori Ka Rate) ─── */}
        {showBatchModal && selectedProduct && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="inv-modal glass-panel animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Add Stock Batch</h2>
                <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '1rem' }}>
                Product: <strong style={{ color: '#0f172a' }}>{selectedProduct.nameEn}</strong> (Current Stock: <strong style={{ color: '#c2410c' }}>{selectedProduct.formattedStock || `${selectedProduct.totalStockBase} ${selectedProduct.baseUnit}`}</strong>)
              </p>

              {error && <div style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '0.6rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1rem' }}>⚠️ {error}</div>}

              <form onSubmit={handleAddBatch}>
                <div className="input-group">
                  <label>Purchase Unit (Packing Type)</label>
                  <select className="input-control" value={purchaseUnitId} onChange={(e) => setPurchaseUnitId(e.target.value)}>
                    {purchaseUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.nameEn} ({u.nameHi}) — 1 {u.nameEn} = {u.factorToBase} {selectedProduct.baseUnit}</option>
                    ))}
                  </select>
                </div>

                <div className="form-grid">
                  <div className="input-group">
                    <label>Purchase Qty (Kitni {activePurchaseUnit?.nameEn || 'bori'})</label>
                    <input type="number" step="0.001" className="input-control" placeholder="e.g. 9" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label>Price Per {activePurchaseUnit?.nameEn || 'bori'} (Rate ₹)</label>
                    <input type="number" step="0.01" className="input-control" placeholder="e.g. 2400" value={purchasePricePerUnit} onChange={(e) => setPurchasePricePerUnit(e.target.value)} required />
                  </div>
                </div>

                <div className="input-group">
                  <label>Vendor / Supplier Name (Optional)</label>
                  <input type="text" className="input-control" placeholder="e.g. Laxmi Traders, Jaipur" value={vendor} onChange={(e) => setVendor(e.target.value)} />
                </div>

                {/* Live Preview Box */}
                {pQty > 0 && pPrice > 0 && (
                  <div className="batch-preview-box animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid rgba(16,185,129,0.2)', paddingBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#166534' }}>📦 Total Base Stock Received:</span>
                      <strong style={{ fontSize: '1rem', color: '#047857' }}>{totalBaseQty} {selectedProduct.baseUnit}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#166534' }}>💰 Calculated Cost / {selectedProduct.baseUnit}:</span>
                      <strong style={{ fontSize: '1rem', color: '#854d0e' }}>₹{costPerBase.toFixed(2)} / {selectedProduct.baseUnit}</strong>
                    </div>

                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Computed Selling Prices & Profit Per Unit:</label>
                    <table className="unit-table" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <thead>
                        <tr>
                          <th>Unit</th>
                          <th>Factor</th>
                          <th>Margin %</th>
                          <th>Unit Cost</th>
                          <th>Selling Price</th>
                          <th>Profit / Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sellUnits.map((u) => {
                          const factor = Number(u.factorToBase);
                          const margin = Number(u.marginPercent);
                          const unitCost = costPerBase * factor;
                          const sp = u.priceOverride ? Number(u.priceOverride) : Math.round(unitCost * (1 + margin / 100));
                          const profit = sp - unitCost;

                          return (
                            <tr key={u.id}>
                              <td><strong>{u.nameEn}</strong></td>
                              <td>{factor} {selectedProduct.baseUnit}</td>
                              <td>{margin}%</td>
                              <td>₹{unitCost.toFixed(2)}</td>
                              <td><strong style={{ color: '#047857' }}>₹{sp.toFixed(2)}</strong></td>
                              <td><strong style={{ color: '#854d0e' }}>₹{profit.toFixed(2)}</strong></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowBatchModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Stock Batch'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
