'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api.js';
import { useAuth } from '../../../context/AuthContext.js';
import { Package, Plus, AlertTriangle, Layers, Tag, DollarSign, Search, Trash2, X, Check, Edit, Sparkles, History } from 'lucide-react';
import { fetchHindiTranslation, fetchHindiWithSuggestions, debounceTranslateToHindi } from '../../../lib/translate.js';

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
  const [editingProduct, setEditingProduct] = useState(null);

  // Batch modal tabs & history
  const [batchModalTab, setBatchModalTab] = useState('list'); // 'list' | 'add'
  const [productBatches, setProductBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchActionError, setBatchActionError] = useState('');
  const [batchActionSuccess, setBatchActionSuccess] = useState('');

  // Editing batch state
  const [editingBatch, setEditingBatch] = useState(null);
  const [editPurchaseUnitId, setEditPurchaseUnitId] = useState('');
  const [editPurchaseQty, setEditPurchaseQty] = useState('');
  const [editPurchasePricePerUnit, setEditPurchasePricePerUnit] = useState('');
  const [editVendor, setEditVendor] = useState('');

  // New Product Form
  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [userEditedHi, setUserEditedHi] = useState(false);
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
  const [notifyWhatsAppBatch, setNotifyWhatsAppBatch] = useState(true);

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

  // Add or Edit Product
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setError('');

    const unitNames = units.map(u => (u.nameEn || '').trim().toLowerCase()).filter(Boolean);
    const duplicates = unitNames.filter((item, index) => unitNames.indexOf(item) !== index);
    if (duplicates.length > 0) {
      setError(`Each packaging unit must have a different name. Found duplicate: "${duplicates[0]}". (e.g. Unit 1: "piece", Unit 2: "pack").`);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        nameEn,
        nameHi: nameHi || null,
        categoryId,
        baseUnit,
        allowDecimalQty,
        lowStockThreshold: parseFloat(lowStockThreshold) || 0,
        barcode: barcode.trim() || undefined,
        units: units.map((u, i) => ({
          ...(u.id ? { id: u.id } : {}),
          nameEn: u.nameEn,
          nameHi: u.nameHi || '',
          factorToBase: parseFloat(u.factorToBase) || 1.0,
          marginPercent: parseFloat(u.marginPercent) || 0,
          priceOverride: u.priceOverride ? parseFloat(u.priceOverride) : null,
          minQty: parseFloat(u.minQty) || 1.0,
          qtyStep: parseFloat(u.qtyStep) || 1.0,
          isPurchaseUnit: Boolean(u.isPurchaseUnit),
          isSellUnit: Boolean(u.isSellUnit),
          sortOrder: i,
        })),
      };

      let product = null;

      if (editingProduct) {
        const res = await apiFetch(`/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        product = res.data;
      } else {
        const res = await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        product = res.data;
      }

      const pid = product?.id || editingProduct?.id;

      if (imageFile && pid) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await fetch(`/api/v1/products/${pid}/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });
      }

      if (!editingProduct && notifyWhatsAppBatch && product?.id) {
        try {
          await apiFetch('/whatsapp/broadcast', {
            method: 'POST',
            body: JSON.stringify({ productId: product.id, type: 'NEW_PRODUCT' }),
          });
        } catch (bErr) {
          console.warn('Failed to queue WhatsApp broadcast:', bErr);
        }
      }

      setShowProductModal(false);
      resetProductForm();
      fetchProducts();
    } catch (err) {
      setError(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setError('');
    setNameEn(p.nameEn || '');
    setNameHi(p.nameHi || '');
    setProductSuggestions([]);
    setUserEditedHi(true);
    setCategoryId(p.categoryId || (p.category ? p.category.id : ''));
    setBaseUnit(p.baseUnit || 'kg');
    setAllowDecimalQty(Boolean(p.allowDecimalQty));
    setBarcode(p.barcode || '');
    setLowStockThreshold(p.lowStockThreshold !== undefined && p.lowStockThreshold !== null ? p.lowStockThreshold : 10);
    setImageFile(null);
    setImagePreview(p.imageUrl || null);

    if (Array.isArray(p.units) && p.units.length > 0) {
      setUnits(p.units.map(u => ({
        id: u.id,
        nameEn: u.nameEn,
        nameHi: u.nameHi || '',
        factorToBase: Number(u.factorToBase) || 1.0,
        isPurchaseUnit: Boolean(u.isPurchaseUnit),
        isSellUnit: Boolean(u.isSellUnit),
        marginPercent: Number(u.marginPercent) || 20,
        priceOverride: u.priceOverride !== null && u.priceOverride !== undefined ? String(u.priceOverride) : '',
        minQty: Number(u.minQty) || 1,
        qtyStep: Number(u.qtyStep) || 1,
      })));
    } else {
      setUnits([
        { nameEn: p.baseUnit, nameHi: p.nameHi || p.baseUnit, factorToBase: 1.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 20, priceOverride: '' }
      ]);
    }
    setShowProductModal(true);
  };

  const formatBatchDate = (d) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return String(d);
    }
  };

  const fetchBatches = async (productId) => {
    if (!productId) return;
    setLoadingBatches(true);
    setBatchActionError('');
    try {
      const res = await apiFetch(`/batches/product/${productId}`);
      setProductBatches(res.data || []);
    } catch (err) {
      console.error(err);
      setBatchActionError(err.message || 'Failed to load batches');
    } finally {
      setLoadingBatches(false);
    }
  };

  const openBatchModal = (prod, initialTab = 'list') => {
    setSelectedProduct(prod);
    setBatchModalTab(initialTab);
    setEditingBatch(null);
    setBatchActionError('');
    setBatchActionSuccess('');
    setError('');
    const pUnits = getPurchaseUnits(prod);
    const purchaseUnit = pUnits[0];
    setPurchaseUnitId(purchaseUnit ? purchaseUnit.id : '');
    setPurchaseQty('');
    setPurchasePricePerUnit('');
    setVendor('');
    setShowBatchModal(true);
    fetchBatches(prod.id);
  };

  const handleStartEditBatch = (b) => {
    setEditingBatch(b);
    setEditPurchaseUnitId(b.purchaseUnitId || '');
    setEditPurchaseQty(String(b.purchaseQty ?? ''));
    setEditPurchasePricePerUnit(String(b.purchasePricePerUnit ?? ''));
    setEditVendor(b.vendor || '');
    setBatchActionError('');
    setBatchActionSuccess('');
  };

  const handleCancelEditBatch = () => {
    setEditingBatch(null);
    setBatchActionError('');
  };

  const handleSaveEditBatch = async (e) => {
    e.preventDefault();
    if (!editingBatch || !selectedProduct) return;
    setBatchActionError('');
    setLoading(true);

    try {
      await apiFetch(`/batches/${editingBatch.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          purchaseUnitId: editPurchaseUnitId || undefined,
          purchaseQty: parseFloat(editPurchaseQty),
          purchasePricePerUnit: parseFloat(editPurchasePricePerUnit),
          vendor: editVendor.trim() || undefined,
        }),
      });

      setBatchActionSuccess('Batch updated successfully!');
      setEditingBatch(null);
      await fetchBatches(selectedProduct.id);
      await fetchProducts();
    } catch (err) {
      setBatchActionError(err.message || 'Failed to update batch');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBatch = async (b) => {
    if (b.allocations && b.allocations.length > 0) {
      alert('Cannot delete this batch because items from it have already been sold in customer invoices.');
      return;
    }

    const unitName = b.purchaseUnit?.nameEn || selectedProduct?.baseUnit || 'unit';
    const confirmMsg = `Are you sure you want to delete this batch (${b.purchaseQty} ${unitName})? This will deduct ${b.qtyRemainingBase} ${selectedProduct.baseUnit} from product stock.`;
    if (!window.confirm(confirmMsg)) return;

    setBatchActionError('');
    setLoading(true);
    try {
      await apiFetch(`/batches/${b.id}`, {
        method: 'DELETE',
      });
      setBatchActionSuccess('Batch deleted successfully!');
      await fetchBatches(selectedProduct.id);
      await fetchProducts();
    } catch (err) {
      setBatchActionError(err.message || 'Failed to delete batch');
    } finally {
      setLoading(false);
    }
  };

  // Add Batch Stock
  const handleAddBatch = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setError('');
    setBatchActionError('');
    setBatchActionSuccess('');
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
          notifyWhatsApp: notifyWhatsAppBatch,
        }),
      });

      setBatchActionSuccess('Stock batch added successfully!');
      setPurchaseQty('');
      setPurchasePricePerUnit('');
      setVendor('');
      await fetchBatches(selectedProduct.id);
      await fetchProducts();
      setBatchModalTab('list');
    } catch (err) {
      setError(err.message || 'Failed to add batch stock');
    } finally {
      setLoading(false);
    }
  };

  const openBatchModalForProduct = (prod) => {
    openBatchModal(prod, 'add');
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setNameEn('');
    setNameHi('');
    setProductSuggestions([]);
    setUserEditedHi(false);
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

  // Live Editing Batch Calculation Details
  const editPurchaseUnit = selectedProduct?.units?.find((u) => u.id === editPurchaseUnitId) || selectedProduct?.units?.[0];
  const editFactor = editPurchaseUnit ? Number(editPurchaseUnit.factorToBase) : 1.0;
  const editQty = parseFloat(editPurchaseQty) || 0;
  const editPrice = parseFloat(editPurchasePricePerUnit) || 0;
  const editReceivedBase = editQty * editFactor;
  const consumedBase = editingBatch ? Math.max(0, Number(editingBatch.qtyReceivedBase || 0) - Number(editingBatch.qtyRemainingBase || 0)) : 0;
  const editRemainingBase = editReceivedBase - consumedBase;
  const editCostPerBase = editFactor > 0 ? editPrice / editFactor : 0;

  return (
    <>
      <style>{`
        .inventory-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .inv-modal { width: 560px; max-width: 95vw; max-height: 90vh; overflow-y: auto; border-radius: 20px; padding: 1.75rem; background: #fff; color: #0f172a; }
        .inv-product-modal, .inv-batch-modal {
          width: 880px;
          max-width: 96vw;
          max-height: 90vh;
          border-radius: 20px;
          background: #ffffff;
          color: #0f172a;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.35);
          overflow: hidden;
          border: 1px solid rgba(226, 232, 240, 0.9);
        }
        .inv-modal-header {
          padding: 1.25rem 1.75rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafaf9;
          flex-shrink: 0;
        }
        .inv-modal-body {
          padding: 1.5rem 1.75rem;
          overflow-y: auto;
          flex: 1;
        }
        .inv-modal-footer {
          padding: 1rem 1.75rem;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          background: #fafaf9;
          flex-shrink: 0;
        }
        .unit-table-container {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          margin-top: 0.6rem;
        }
        .unit-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          font-size: 0.83rem;
        }
        .unit-table th {
          background: #f8fafc;
          padding: 0.65rem 0.6rem;
          font-weight: 700;
          color: #475569;
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 1px solid #e2e8f0;
        }
        .unit-table td {
          padding: 0.55rem 0.5rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .unit-input {
          padding: 6px 8px;
          font-size: 0.82rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          outline: none;
          background: #ffffff;
          color: #0f172a;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .unit-input:focus {
          border-color: #ea580c;
          box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.15);
        }
        .preset-btn { background: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.78rem; cursor: pointer; font-weight: 600; }
        .preset-btn:hover { background: #ea580c; border-color: #ea580c; color: #fff; }
        .batch-preview-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1rem; margin: 1rem 0; }
        @media (max-width: 720px) {
          .inventory-header { flex-direction: column; align-items: flex-start; }
          .inventory-header .btn { width: 100%; }
          .inv-modal, .inv-product-modal, .inv-batch-modal { width: 100%; max-width: 100%; max-height: 100dvh; border-radius: 0; }
          .inv-modal { padding: 1rem; }
          .inv-modal-header, .inv-modal-body, .inv-modal-footer { padding: 1rem; }
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
                        <button onClick={() => openBatchModal(p, 'add')} className="btn btn-sm btn-secondary" title="Add Stock Batch">
                          <Plus size={14} /> Add Batch
                        </button>
                        <button
                          onClick={() => openBatchModal(p, 'list')}
                          className="btn btn-sm btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#059669', borderColor: '#a7f3d0' }}
                          title="View & Edit Batches"
                        >
                          <Layers size={14} /> Batches
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="btn btn-sm btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#0284c7', borderColor: '#bae6fd' }}
                          title="Edit Product"
                        >
                          <Edit size={14} /> Edit
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

        {/* ─── Add / Edit Product Modal ─── */}
        {showProductModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="inv-product-modal animate-fade-in">
              <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div className="inv-modal-header">
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {editingProduct ? (
                        <>
                          <span style={{ background: '#e0f2fe', color: '#0284c7', padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>EDIT</span>
                          <span>Edit Product: {editingProduct.nameEn}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ background: '#ffedd5', color: '#c2410c', padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>NEW</span>
                          <span>Add Multi-Unit Product</span>
                        </>
                      )}
                    </h2>
                    <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                      {editingProduct ? 'Update product details, multi-units, margins, or photo' : 'Create base product and define buying/selling units'}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setShowProductModal(false); resetProductForm(); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                    <X size={22} />
                  </button>
                </div>

                <div className="inv-modal-body">
                  {error && <div style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.88rem', marginBottom: '1.25rem' }}>⚠️ {error}</div>}

                  {/* Quick Presets (only for new products) */}
                  {!editingProduct && (
                    <div style={{ marginBottom: '1.25rem', background: '#fffaf5', border: '1px solid #ffedd5', padding: '0.85rem 1rem', borderRadius: 12 }}>
                      <label style={{ fontSize: '0.82rem', color: '#9a3412', display: 'block', marginBottom: '0.4rem', fontWeight: 700 }}>Quick Product Presets:</label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('kg_bori')}>🌾 kg + bori (50kg)</button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('gram_bori')}>⚖️ gram + bori (25kg)</button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('ml_tin')}>🛢️ ml + tin (15L)</button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('piece_dozen')}>🔔 piece + dozen</button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('bottle_carton')}>🍾 bottle + carton (24)</button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('single_unit')}>📦 Single Unit Only</button>
                      </div>
                    </div>
                  )}

                  {/* Product Basic Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-grid">
                      <div className="input-group">
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>English Name *</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Pure Desi Ghee or daal cheeni"
                          value={nameEn}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNameEn(val);
                            if (!userEditedHi || !nameHi) {
                              debounceTranslateToHindi(val, (translated, suggs) => {
                                setNameHi(translated);
                                if (suggs) setProductSuggestions(suggs);
                              });
                            }
                          }}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', margin: 0 }}>Hindi Name</label>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ea580c', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}
                            onClick={async () => {
                              if (!nameEn) return;
                              const res = await fetchHindiWithSuggestions(nameEn);
                              if (res.translated) setNameHi(res.translated);
                              if (res.suggestions) setProductSuggestions(res.suggestions);
                            }}
                          >
                            <Sparkles size={12} /> Auto-translate
                          </button>
                        </div>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. शुद्ध देसी घी या दालचीनी"
                          value={nameHi}
                          onChange={(e) => {
                            setNameHi(e.target.value);
                            setUserEditedHi(true);
                          }}
                        />
                        {productSuggestions.length > 1 && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Google Typing:</span>
                            {productSuggestions.map((s, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setNameHi(s);
                                  setUserEditedHi(true);
                                }}
                                style={{
                                  background: nameHi === s ? '#ffedd5' : '#f8fafc',
                                  border: nameHi === s ? '1px solid #ea580c' : '1px solid #cbd5e1',
                                  color: nameHi === s ? '#c2410c' : '#334155',
                                  fontSize: '0.78rem',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="input-group">
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>Category *</label>
                        <select className="input-control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                          {categories.map((c) => (<option key={c.id} value={c.id}>{c.nameEn} ({c.nameHi})</option>))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>Barcode (Optional)</label>
                        <input type="text" className="input-control" placeholder="e.g. 890100100101" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="input-group">
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>Base Unit (Smallest Unit) *</label>
                        <select
                          className="input-control"
                          value={baseUnit}
                          onChange={(e) => {
                            const newBase = e.target.value;
                            setBaseUnit(newBase);
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
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>Low Stock Warning Threshold</label>
                        <input type="number" step="0.1" className="input-control" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0' }}>
                      <input type="checkbox" id="decimalQty" checked={allowDecimalQty} onChange={(e) => setAllowDecimalQty(e.target.checked)} style={{ accentColor: '#ea580c', width: 16, height: 16 }} />
                      <label htmlFor="decimalQty" style={{ fontSize: '0.85rem', color: '#334155', cursor: 'pointer', fontWeight: 500 }}>
                        Allow decimal quantities at checkout (e.g. 0.5 kg / 500g)
                      </label>
                    </div>

                    {/* Multi-Unit Configuration Table */}
                    <div style={{ marginTop: '0.5rem', background: '#f8fafc', borderRadius: 14, padding: '1rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <div>
                          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c2410c', display: 'block' }}>
                            Product Units Configuration (Purchase & Sell Units)
                          </label>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Define multiple packing sizes (e.g. gram, 500g, kg, bori) with conversion factors and margins.
                          </span>
                        </div>
                        <button type="button" onClick={addUnitRow} className="btn btn-sm btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
                          <Plus size={14} /> Add Unit
                        </button>
                      </div>

                      <div className="unit-table-container">
                        <table className="unit-table">
                          <thead>
                            <tr>
                              <th style={{ width: '130px' }}>Unit Name</th>
                              <th style={{ width: '110px' }}>Hindi Name</th>
                              <th style={{ width: '100px' }}>Factor to Base</th>
                              <th style={{ width: '90px' }}>Margin %</th>
                              <th style={{ width: '110px' }}>Override (₹)</th>
                              <th style={{ width: '80px' }}>Min Qty</th>
                              <th style={{ width: '80px' }}>Step</th>
                              <th style={{ width: '80px', textAlign: 'center' }}>Purchase</th>
                              <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {units.map((u, i) => (
                              <tr key={i}>
                                <td>
                                  <input
                                    type="text"
                                    list="custom-unit-suggestions"
                                    className="unit-input"
                                    placeholder="e.g. kg"
                                    value={u.nameEn}
                                    onChange={(e) => updateUnitRow(i, 'nameEn', e.target.value)}
                                    required
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="unit-input"
                                    placeholder="e.g. किलो"
                                    value={u.nameHi || ''}
                                    onChange={(e) => updateUnitRow(i, 'nameHi', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    className="unit-input"
                                    value={u.factorToBase}
                                    onChange={(e) => updateUnitRow(i, 'factorToBase', e.target.value)}
                                    required
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.1"
                                    className="unit-input"
                                    value={u.marginPercent}
                                    onChange={(e) => updateUnitRow(i, 'marginPercent', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="1"
                                    className="unit-input"
                                    placeholder="Auto"
                                    value={u.priceOverride || ''}
                                    onChange={(e) => updateUnitRow(i, 'priceOverride', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="unit-input"
                                    value={u.minQty || 1}
                                    onChange={(e) => updateUnitRow(i, 'minQty', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="unit-input"
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
                                    style={{ accentColor: '#ea580c', cursor: 'pointer', width: 16, height: 16 }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {units.length > 1 && (
                                    <button type="button" onClick={() => removeUnitRow(i)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 4 }} title="Remove unit">
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Product Image Card */}
                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                      <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                        Product Image (Stored Permanently on Cloudinary)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                        {imagePreview ? (
                          <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid #cbd5e1', background: '#fff', flexShrink: 0 }}>
                            <img src={imagePreview} alt="Product preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: 72, height: 72, borderRadius: 10, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', fontSize: '1.8rem', flexShrink: 0 }}>
                            🪔
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <input
                            type="file"
                            accept="image/*"
                            className="input-control"
                            style={{ padding: '0.45rem', fontSize: '0.84rem' }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              setImageFile(f || null);
                              setImagePreview(f ? URL.createObjectURL(f) : (editingProduct?.imageUrl || null));
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.3rem' }}>
                            Upload a product photo. It will be stored permanently in Cloudinary and sent with WhatsApp broadcasts.
                          </span>
                        </div>
                      </div>
                    </div>

                    {!editingProduct && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: 10 }}>
                        <input
                          type="checkbox"
                          id="notifyWhatsAppBatch"
                          checked={notifyWhatsAppBatch}
                          onChange={(e) => setNotifyWhatsAppBatch(e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }}
                        />
                        <div>
                          <label htmlFor="notifyWhatsAppBatch" style={{ cursor: 'pointer', fontWeight: 600, color: '#166534', margin: 0, fontSize: '0.9rem', display: 'block' }}>
                            📢 WhatsApp Broadcast: सभी ग्राहकों को नए स्टॉक की सूचना भेजें
                          </label>
                          <span style={{ color: '#15803d', fontSize: '0.78rem' }}>
                            स्टॉक ऐड होते ही ग्राहकों के WhatsApp पर पर्सनलाइज्ड अपडेट जाएगा।
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="inv-modal-footer">
                  <button type="button" onClick={() => { setShowProductModal(false); resetProductForm(); }} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.4rem' }}>
                    <Check size={16} />
                    {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Batch Management Modal (View / Edit Older Batches & Add New Batch) ─── */}
        {showBatchModal && selectedProduct && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="inv-batch-modal animate-fade-in">
              {/* Modal Header */}
              <div className="inv-modal-header">
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span>📦 Batch Stock Management</span>
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                    Product: <strong style={{ color: '#0f172a' }}>{selectedProduct.nameEn}</strong> {selectedProduct.nameHi ? `(${selectedProduct.nameHi})` : ''} • Available Stock: <strong style={{ color: '#c2410c' }}>{selectedProduct.formattedStock || `${selectedProduct.totalStockBase} ${selectedProduct.baseUnit}`}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowBatchModal(false); setEditingBatch(null); }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                >
                  <X size={22} />
                </button>
              </div>

              {/* Top Navigation Tabs */}
              <div style={{ padding: '0.75rem 1.75rem 0', background: '#fafaf9', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => { setBatchModalTab('list'); setEditingBatch(null); setBatchActionError(''); }}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: batchModalTab === 'list' && !editingBatch ? '3px solid #ea580c' : '3px solid transparent',
                    background: batchModalTab === 'list' && !editingBatch ? '#ffffff' : 'transparent',
                    color: batchModalTab === 'list' && !editingBatch ? '#ea580c' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Layers size={16} /> Batch History ({productBatches.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setBatchModalTab('add'); setEditingBatch(null); setBatchActionError(''); }}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: batchModalTab === 'add' ? '3px solid #ea580c' : '3px solid transparent',
                    background: batchModalTab === 'add' ? '#ffffff' : 'transparent',
                    color: batchModalTab === 'add' ? '#ea580c' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Plus size={16} /> + Add New Batch
                </button>
              </div>

              {/* Modal Body */}
              <div className="inv-modal-body">
                {batchActionSuccess && (
                  <div style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '0.65rem 1rem', borderRadius: 10, fontSize: '0.88rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>✅ {batchActionSuccess}</span>
                    <button type="button" onClick={() => setBatchActionSuccess('')} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                  </div>
                )}

                {(batchActionError || error) && (
                  <div style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '0.65rem 1rem', borderRadius: 10, fontSize: '0.88rem', marginBottom: '1rem' }}>
                    ⚠️ {batchActionError || error}
                  </div>
                )}

                {/* TAB 1: EDIT SPECIFIC BATCH */}
                {editingBatch ? (
                  <form onSubmit={handleSaveEditBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.85rem 1.1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: '#0369a1', fontSize: '0.95rem' }}>✏️ Edit Older Stock Batch</strong>
                        <div style={{ fontSize: '0.82rem', color: '#0284c7', marginTop: '2px' }}>
                          Originally received: <strong>{formatBatchDate(editingBatch.receivedAt)}</strong>
                        </div>
                      </div>
                      <button type="button" onClick={handleCancelEditBatch} className="btn btn-sm btn-secondary">
                        Cancel Edit
                      </button>
                    </div>

                    {consumedBase > 0 && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                        ℹ️ <strong>{consumedBase.toFixed(2)} {selectedProduct.baseUnit}</strong> have already been sold from this batch in customer orders. The new received stock cannot be less than this amount.
                      </div>
                    )}

                    <div className="input-group">
                      <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>Purchase Unit (Packaging Type)</label>
                      <select className="input-control" value={editPurchaseUnitId} onChange={(e) => setEditPurchaseUnitId(e.target.value)}>
                        {purchaseUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.nameEn} ({u.nameHi}) — 1 {u.nameEn} = {u.factorToBase} {selectedProduct.baseUnit}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-grid">
                      <div className="input-group">
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>
                          Purchase Quantity ({editPurchaseUnit?.nameEn || selectedProduct.baseUnit})
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          className="input-control"
                          value={editPurchaseQty}
                          onChange={(e) => setEditPurchaseQty(e.target.value)}
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>
                          Price Per {editPurchaseUnit?.nameEn || selectedProduct.baseUnit} (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-control"
                          value={editPurchasePricePerUnit}
                          onChange={(e) => setEditPurchasePricePerUnit(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>Vendor / Supplier Name</label>
                      <input
                        type="text"
                        className="input-control"
                        placeholder="e.g. Laxmi Traders, Jaipur"
                        value={editVendor}
                        onChange={(e) => setEditVendor(e.target.value)}
                      />
                    </div>

                    {/* Live Preview for Edit */}
                    {editQty > 0 && (
                      <div className="batch-preview-box animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px solid rgba(16,185,129,0.2)', paddingBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.85rem', color: '#166534' }}>📦 Total Received Base Stock:</span>
                          <strong style={{ fontSize: '0.95rem', color: '#047857' }}>{editReceivedBase} {selectedProduct.baseUnit}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px solid rgba(16,185,129,0.2)', paddingBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.85rem', color: '#166534' }}>🔄 Remaining Stock in this Batch:</span>
                          <strong style={{ fontSize: '0.95rem', color: editRemainingBase < -0.0001 ? '#b91c1c' : '#047857' }}>
                            {editRemainingBase.toFixed(2)} {selectedProduct.baseUnit} {editRemainingBase < -0.0001 ? '(⚠️ Cannot be below already sold units!)' : ''}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.85rem', color: '#166534' }}>💰 Calculated Cost / {selectedProduct.baseUnit}:</span>
                          <strong style={{ fontSize: '0.95rem', color: '#854d0e' }}>₹{editCostPerBase.toFixed(2)} / {selectedProduct.baseUnit}</strong>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button type="button" onClick={handleCancelEditBatch} className="btn btn-secondary">
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || editRemainingBase < -0.0001}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.4rem' }}
                      >
                        <Check size={16} /> {loading ? 'Saving...' : 'Save Batch Changes'}
                      </button>
                    </div>
                  </form>
                ) : batchModalTab === 'list' ? (
                  /* TAB 2: BATCH HISTORY TABLE */
                  <div>
                    {loadingBatches ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                        Loading stock batches...
                      </div>
                    ) : productBatches.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                        <p style={{ color: '#475569', fontWeight: 600, margin: '0 0 0.5rem', fontSize: '1rem' }}>No stock batches recorded yet</p>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
                          Add your first stock purchase to track costs, batches, and FIFO stock movements.
                        </p>
                        <button
                          type="button"
                          onClick={() => setBatchModalTab('add')}
                          className="btn btn-primary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.25rem' }}
                        >
                          <Plus size={16} /> + Add First Stock Batch
                        </button>
                      </div>
                    ) : (
                      <div className="unit-table-container" style={{ marginTop: 0 }}>
                        <table className="unit-table">
                          <thead>
                            <tr>
                              <th style={{ width: '150px' }}>Date & Vendor</th>
                              <th style={{ width: '120px' }}>Purchased Qty</th>
                              <th style={{ width: '120px' }}>Purchase Rate</th>
                              <th style={{ width: '110px' }}>Cost / Base</th>
                              <th style={{ width: '130px' }}>Remaining Stock</th>
                              <th style={{ width: '90px', textAlign: 'center' }}>Status</th>
                              <th style={{ width: '110px', textAlign: 'center' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {productBatches.map((b) => {
                              const unit = b.purchaseUnit || selectedProduct?.units?.find(u => u.id === b.purchaseUnitId);
                              const unitName = unit ? unit.nameEn : selectedProduct.baseUnit;
                              const remaining = Number(b.qtyRemainingBase || 0);
                              const received = Number(b.qtyReceivedBase || 0);
                              const isExhausted = remaining <= 0;
                              const hasSales = b.allocations && b.allocations.length > 0;

                              return (
                                <tr key={b.id}>
                                  <td>
                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatBatchDate(b.receivedAt)}</div>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                      {b.vendor ? `Supplier: ${b.vendor}` : <span style={{ color: '#94a3b8' }}>No vendor noted</span>}
                                    </div>
                                  </td>
                                  <td>
                                    <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{b.purchaseQty ?? received}</strong>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}> {unitName}</span>
                                  </td>
                                  <td>
                                    <strong style={{ color: '#334155' }}>₹{Number(b.purchasePricePerUnit || b.purchaseCost || 0).toFixed(2)}</strong>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}> / {unitName}</span>
                                  </td>
                                  <td>
                                    <span style={{ color: '#854d0e', fontWeight: 700 }}>₹{Number(b.costPerBase || 0).toFixed(2)}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}> / {selectedProduct.baseUnit}</span>
                                  </td>
                                  <td>
                                    <strong style={{ color: isExhausted ? '#94a3b8' : '#047857' }}>
                                      {remaining}
                                    </strong>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}> / {received} {selectedProduct.baseUnit}</span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span
                                      className={`badge ${isExhausted ? 'badge-danger' : hasSales ? 'badge-warning' : 'badge-success'}`}
                                      style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                                    >
                                      {isExhausted ? 'Sold Out' : hasSales ? 'Partially Sold' : 'Untouched'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditBatch(b)}
                                        className="btn btn-sm btn-secondary"
                                        style={{ padding: '0.3rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#0284c7', borderColor: '#bae6fd' }}
                                        title="Edit this batch (quantity, rate, supplier)"
                                      >
                                        <Edit size={13} /> Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBatch(b)}
                                        className="btn btn-sm"
                                        disabled={hasSales}
                                        style={{
                                          padding: '0.3rem 0.55rem',
                                          background: hasSales ? '#f1f5f9' : 'rgba(244, 63, 94, 0.15)',
                                          color: hasSales ? '#94a3b8' : '#f43f5e',
                                          border: hasSales ? '1px solid #e2e8f0' : '1px solid rgba(244, 63, 94, 0.3)',
                                          cursor: hasSales ? 'not-allowed' : 'pointer',
                                        }}
                                        title={hasSales ? 'Cannot delete: items already sold from this batch' : 'Delete this batch'}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  /* TAB 3: ADD NEW BATCH */
                  <form onSubmit={handleAddBatch}>
                    <div className="input-group">
                      <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>Purchase Unit (Packing Type)</label>
                      <select className="input-control" value={purchaseUnitId} onChange={(e) => setPurchaseUnitId(e.target.value)}>
                        {purchaseUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.nameEn} ({u.nameHi}) — 1 {u.nameEn} = {u.factorToBase} {selectedProduct.baseUnit}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-grid">
                      <div className="input-group">
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>
                          Purchase Qty (Kitni {activePurchaseUnit?.nameEn || 'bori'})
                        </label>
                        <input type="number" step="0.001" className="input-control" placeholder="e.g. 9" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} required />
                      </div>
                      <div className="input-group">
                        <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>
                          Price Per {activePurchaseUnit?.nameEn || 'bori'} (Rate ₹)
                        </label>
                        <input type="number" step="0.01" className="input-control" placeholder="e.g. 2400" value={purchasePricePerUnit} onChange={(e) => setPurchasePricePerUnit(e.target.value)} required />
                      </div>
                    </div>

                    <div className="input-group">
                      <label style={{ fontWeight: 600, fontSize: '0.86rem', color: '#334155', marginBottom: 4 }}>Vendor / Supplier Name (Optional)</label>
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: '8px', marginTop: '1rem' }}>
                      <input
                        type="checkbox"
                        id="notifyWhatsAppBatch"
                        checked={notifyWhatsAppBatch}
                        onChange={(e) => setNotifyWhatsAppBatch(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }}
                      />
                      <div>
                        <label htmlFor="notifyWhatsAppBatch" style={{ cursor: 'pointer', fontWeight: 600, color: '#166534', margin: 0, fontSize: '0.9rem', display: 'block' }}>
                          📢 WhatsApp Broadcast: सभी ग्राहकों को नए स्टॉक की सूचना भेजें
                        </label>
                        <span style={{ color: '#15803d', fontSize: '0.78rem' }}>
                          स्टॉक ऐड होते ही ग्राहकों के WhatsApp पर पर्सनलाइज्ड अपडेट जाएगा।
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                      <button type="button" onClick={() => setShowBatchModal(false)} className="btn btn-secondary">Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.4rem' }}>
                        <Check size={16} /> {loading ? 'Saving...' : 'Save Stock Batch'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
