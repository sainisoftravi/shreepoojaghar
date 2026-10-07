'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api.js';
import { ArrowLeft, Plus, Layers, Package, Trash2, Upload, CheckCircle2 } from 'lucide-react';

export default function AddProductPage() {
  const router = useRouter();

  const [categories, setCategories] = useState([]);
  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnit, setBaseUnit] = useState('piece');
  const [allowDecimalQty, setAllowDecimalQty] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Multi-unit definitions
  const [units, setUnits] = useState([
    { nameEn: 'piece', nameHi: 'पीस', factorToBase: 1.0, isPurchaseUnit: true, isSellUnit: true, marginPercent: 25, priceOverride: '', minQty: 1, qtyStep: 1 },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories');
      const cats = res.data || [];
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const addUnitRow = () => {
    setUnits([
      ...units,
      { nameEn: '', nameHi: '', factorToBase: 1.0, isPurchaseUnit: false, isSellUnit: true, marginPercent: 25, priceOverride: '', minQty: 1, qtyStep: 1 },
    ]);
  };

  const updateUnitRow = (index, field, value) => {
    setUnits(units.map((unit, unitIndex) => (
      unitIndex === index ? { ...unit, [field]: value } : unit
    )));
  };

  const removeUnitRow = (index) => {
    if (units.length <= 1) return;
    const removedPurchaseUnit = units[index]?.isPurchaseUnit;
    const remainingUnits = units
      .filter((_, i) => i !== index)
      .map((unit, unitIndex) => ({
        ...unit,
        isPurchaseUnit: removedPurchaseUnit ? unitIndex === 0 : unit.isPurchaseUnit,
      }));
    setUnits(remainingUnits);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!units.some((unit) => unit.isPurchaseUnit)) {
      setError('Select one unit that you use to purchase this product.');
      return;
    }

    if (!units.some((unit) => unit.isSellUnit)) {
      setError('Select at least one unit that customers can buy at the POS.');
      return;
    }

    const invalidUnit = units.find((unit) => !unit.nameEn.trim() || Number(unit.factorToBase) <= 0);
    if (invalidUnit) {
      setError('Every unit needs a name and a conversion greater than zero.');
      return;
    }

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

      router.push('/inventory');
    } catch (err) {
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .add-product-container {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding-bottom: 3rem;
        }
        .add-product-topbar {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .section-card {
          border-radius: 20px;
          padding: 1.75rem;
          background: rgba(255,255,255,0.96);
          border: 1px solid #e5e7e2;
          box-shadow: 0 8px 24px rgba(31,42,46,0.05);
        }
        .form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }
        .form-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1.25rem;
        }
        .unit-config-list { display: flex; flex-direction: column; gap: 0.85rem; }
        .unit-config-card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 1rem; background: #fff; }
        .unit-config-fields { display: grid; grid-template-columns: minmax(150px, 1.1fr) minmax(140px, 1fr) minmax(210px, 1.2fr); gap: 0.85rem; align-items: end; }
        .unit-conversion-input { display: flex; align-items: center; gap: 0.45rem; }
        .unit-conversion-input .input-control { min-width: 0; }
        .unit-role-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-top: 0.85rem; }
        .unit-role-option { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer; }
        .unit-role-option input { margin-top: 0.2rem; accent-color: #c2410c; }
        .unit-role-option strong { display: block; color: #1e293b; font-size: 0.88rem; }
        .unit-role-option small { display: block; margin-top: 0.2rem; color: #64748b; line-height: 1.4; }
        .unit-advanced-grid { display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)); gap: 0.75rem; margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid #edf0f3; }
        @media (max-width: 768px) {
          .add-product-topbar > div:last-child {
            align-items: flex-start !important;
          }
          .section-card {
            padding: 1.1rem;
          }
          .form-grid-2, .form-grid-3 {
            grid-template-columns: 1fr;
          }
          .unit-config-fields, .unit-role-options { grid-template-columns: 1fr; }
          .unit-advanced-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

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

      <div className="add-product-container animate-fade-in">
        {/* Navigation Top Bar */}
        <div className="add-product-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/inventory"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 12,
                background: '#fff',
                border: '1px solid #e5e7e2',
                color: '#536168',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.6rem)', fontWeight: 800, color: '#1f2a2e', margin: 0 }}>
                Add Product (नया प्रोडक्ट जोड़ें)
              </h1>
              <p style={{ fontSize: '0.88rem', color: '#536168', margin: 0 }}>
                Track stock in one unit, buy in packs, and sell in the sizes your customers need.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#fff0f0',
              border: '1px solid #f3c9ce',
              color: '#a72e3e',
              padding: '1rem',
              borderRadius: 14,
              fontWeight: 600,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1: Basic Information */}
          <div className="section-card glass-panel">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#a84918', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} /> 1. Basic Details & Category
            </h2>

            <div className="form-grid-2" style={{ marginBottom: '1.25rem' }}>
              <div className="input-group">
                <label>English Product Name *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Sugar (Chini)"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>Hindi Product Name *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. चीनी / शक्कर"
                  value={nameHi}
                  onChange={(e) => setNameHi(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="input-group">
                <label>Category *</label>
                <select className="input-control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn} ({c.nameHi})
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Barcode / EAN (Optional)</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. 890100100101"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Product Image (Optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="file"
                    accept="image/*"
                    className="input-control"
                    style={{ padding: '0.4rem' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setImageFile(f || null);
                      setImagePreview(f ? URL.createObjectURL(f) : null);
                    }}
                  />
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="preview"
                      style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', border: '1px solid #f97316' }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Stock unit and alerts */}
          <div className="section-card glass-panel">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#a84918', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={20} /> 2. Stock unit and alerts
            </h2>

            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.55, marginTop: '-0.65rem', marginBottom: '1.1rem' }}>
              Stock is always stored in one smallest unit. For example, if you buy cartons and sell bottles, choose <strong>bottle</strong> here.
            </p>

            <div className="form-grid-2">
              <div className="input-group">
                <label>Stock unit (smallest unit) *</label>
                <select
                  className="input-control"
                  value={baseUnit}
                  onChange={(e) => {
                    const newBase = e.target.value;
                    const oldBase = baseUnit;
                    setBaseUnit(newBase);
                    const fractionalBaseUnit = ['kg', 'litre', 'meter'].includes(newBase);
                    setAllowDecimalQty(fractionalBaseUnit);

                    // Smart auto-conversion of unit factors when user changes Base Unit
                    if (units.length > 0) {
                      const updatedUnits = units.map((u) => {
                        let newFactor = u.factorToBase;
                        let newMinQty = u.minQty;
                        let newQtyStep = u.qtyStep;

                        // Conversion 1: kg -> gram (1 kg = 1000 gram)
                        if (oldBase === 'kg' && newBase === 'gram') {
                          newFactor = Number((u.factorToBase * 1000).toFixed(4));
                          if (u.nameEn.toLowerCase() === 'kg' || u.nameEn.toLowerCase() === 'किग्रा') {
                            return { ...u, nameEn: '1 kg', nameHi: '1 किग्रा', factorToBase: 1000, minQty: 1, qtyStep: 1 };
                          }
                        }
                        // Conversion 2: gram -> kg (1000 gram = 1 kg)
                        else if (oldBase === 'gram' && newBase === 'kg') {
                          newFactor = Number((u.factorToBase / 1000).toFixed(4));
                          if (u.nameEn.toLowerCase() === '1 kg' || u.nameEn.toLowerCase() === 'kg') {
                            return { ...u, nameEn: 'kg', nameHi: 'किग्रा', factorToBase: 1, minQty: 0.001, qtyStep: 0.001 };
                          }
                        }
                        // Conversion 3: litre -> ml (1 L = 1000 ml)
                        else if (oldBase === 'litre' && newBase === 'ml') {
                          newFactor = Number((u.factorToBase * 1000).toFixed(4));
                          if (u.nameEn.toLowerCase() === 'litre' || u.nameEn.toLowerCase() === 'liter') {
                            return { ...u, nameEn: '1 litre', nameHi: '1 लीटर', factorToBase: 1000, minQty: 1, qtyStep: 1 };
                          }
                        }
                        // Conversion 4: ml -> litre (1000 ml = 1 L)
                        else if (oldBase === 'ml' && newBase === 'litre') {
                          newFactor = Number((u.factorToBase / 1000).toFixed(4));
                          if (u.nameEn.toLowerCase() === '1 litre' || u.nameEn.toLowerCase() === 'litre') {
                            return { ...u, nameEn: 'litre', nameHi: 'लीटर', factorToBase: 1, minQty: 0.001, qtyStep: 0.001 };
                          }
                        }
                        // If single unit matching old base, sync name to new base
                        else if (units.length === 1 && (u.nameEn === oldBase || u.factorToBase === 1)) {
                          return {
                            ...u,
                            nameEn: newBase,
                            nameHi: newBase,
                            factorToBase: 1,
                            minQty: fractionalBaseUnit ? 0.001 : 1,
                            qtyStep: fractionalBaseUnit ? 0.001 : 1,
                          };
                        }

                        return { ...u, factorToBase: newFactor, minQty: newMinQty, qtyStep: newQtyStep };
                      });
                      setUnits(updatedUnits);
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
                  <option value="pair">pair (जोड़ी)</option>
                  <option value="meter">meter (मीटर)</option>
                </select>
              </div>

              <div className="input-group">
                <label>Low stock alert threshold ({baseUnit})</label>
                <input
                  type="number"
                  step="0.1"
                  className="input-control"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input
                type="checkbox"
                id="decimalQtyCheck"
                checked={allowDecimalQty}
                onChange={(e) => {
                  const allowFractions = e.target.checked;
                  setAllowDecimalQty(allowFractions);
                  setUnits((currentUnits) => currentUnits.map((unit) => {
                    const isBaseUnitRow = unit.nameEn === baseUnit && Number(unit.factorToBase) === 1;
                    const hasDefaultStep = Number(unit.qtyStep) === 1 || Number(unit.qtyStep) === 0.001;
                    return isBaseUnitRow && hasDefaultStep
                      ? { ...unit, minQty: allowFractions ? 0.001 : 1, qtyStep: allowFractions ? 0.001 : 1 }
                      : unit;
                  }));
                }}
                style={{ width: 18, height: 18, accentColor: '#f97316' }}
              />
              <label htmlFor="decimalQtyCheck" style={{ fontSize: '0.9rem', color: '#334155', cursor: 'pointer' }}>
                Allow fractional quantities when selling (for example, 0.5 kg)
              </label>
            </div>
          </div>

          {/* Section 3: Purchase and selling units */}
          <div className="section-card glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#a84918', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={20} /> 3. Set purchase and selling units
                </h2>
                <p style={{ fontSize: '0.88rem', color: '#536168', margin: 0, lineHeight: 1.5 }}>
                  Choose one unit you buy in, then separately choose the unit sizes customers can buy. Conversion always means “1 of this unit = how many {baseUnit}”.
                </p>
              </div>

              <button type="button" onClick={addUnitRow} className="btn btn-sm btn-secondary">
                <Plus size={16} /> Add unit
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem', margin: '1rem 0' }}>
              {units.filter((unit) => unit.isPurchaseUnit).map((unit) => (
                <div key={`buy-${unit.nameEn}`} style={{ padding: '0.75rem 0.85rem', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.88rem' }}>
                  <strong>Buying:</strong> 1 {unit.nameEn || 'unit'} = {unit.factorToBase || '…'} {baseUnit}
                </div>
              ))}
              {units.some((unit) => unit.isSellUnit) && (
                <div style={{ padding: '0.75rem 0.85rem', borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.88rem' }}>
                  <strong>Selling:</strong> {units.filter((unit) => unit.isSellUnit).map((unit) => unit.nameEn || 'unnamed unit').join(', ')}
                </div>
              )}
            </div>

            <div className="unit-config-list">
              {units.map((u, i) => (
                <article key={i} className="unit-config-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.8rem' }}>
                    <strong style={{ color: '#1e293b' }}>Unit {i + 1}</strong>
                    {units.length > 1 && (
                      <button type="button" onClick={() => removeUnitRow(i)} aria-label={`Remove unit ${i + 1}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '0.4rem 0.65rem', borderRadius: 9, cursor: 'pointer' }}>
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="unit-config-fields">
                    <div className="input-group">
                      <label>Unit name *</label>
                      <input type="text" list="custom-unit-suggestions" className="input-control" placeholder="e.g. bottle, carton" value={u.nameEn} onChange={(e) => updateUnitRow(i, 'nameEn', e.target.value)} required />
                    </div>
                    <div className="input-group">
                      <label>Hindi name</label>
                      <input type="text" className="input-control" placeholder="e.g. बोतल" value={u.nameHi || ''} onChange={(e) => updateUnitRow(i, 'nameHi', e.target.value)} />
                    </div>
                    <div className="input-group">
                      <label>1 {u.nameEn || 'unit'} contains</label>
                      <div className="unit-conversion-input">
                        <input type="number" min="0.0001" step="0.0001" className="input-control" value={u.factorToBase} onChange={(e) => updateUnitRow(i, 'factorToBase', e.target.value)} required />
                        <span style={{ color: '#475569', whiteSpace: 'nowrap', fontWeight: 600 }}>{baseUnit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="unit-role-options">
                    <label className="unit-role-option" style={{ borderColor: u.isPurchaseUnit ? '#86efac' : '#e2e8f0', background: u.isPurchaseUnit ? '#f0fdf4' : '#fff' }}>
                      <input type="radio" name="purchaseUnitRadioGroup" checked={u.isPurchaseUnit} onChange={() => setUnits(units.map((row, idx) => ({ ...row, isPurchaseUnit: idx === i })))} />
                      <span><strong>We purchase in this unit</strong><small>Used when adding stock from a supplier. Only one unit can be selected.</small></span>
                    </label>
                    <label className="unit-role-option" style={{ borderColor: u.isSellUnit ? '#93c5fd' : '#e2e8f0', background: u.isSellUnit ? '#eff6ff' : '#fff' }}>
                      <input type="checkbox" checked={Boolean(u.isSellUnit)} onChange={(e) => updateUnitRow(i, 'isSellUnit', e.target.checked)} />
                      <span><strong>Customers can buy this unit</strong><small>Shown as a size option on the POS screen.</small></span>
                    </label>
                  </div>

                  {u.isSellUnit ? (
                    <details style={{ marginTop: '0.85rem' }}>
                      <summary style={{ color: '#475569', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>Optional selling price and quantity settings</summary>
                      <p style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.45, margin: '0.65rem 0 0' }}>
                        After you add stock, the app suggests a price from its purchase cost and this margin. A fixed selling price overrides that suggestion.
                      </p>
                      <div className="unit-advanced-grid">
                        <div className="input-group">
                          <label>Profit margin %</label>
                          <input type="number" step="0.1" className="input-control" value={u.marginPercent} onChange={(e) => updateUnitRow(i, 'marginPercent', e.target.value)} />
                        </div>
                        <div className="input-group">
                          <label>Fixed selling price ₹</label>
                          <input type="number" min="0" step="0.01" className="input-control" placeholder="Auto from margin" value={u.priceOverride || ''} onChange={(e) => updateUnitRow(i, 'priceOverride', e.target.value)} />
                        </div>
                        <div className="input-group">
                          <label>Minimum quantity</label>
                          <input type="number" min="0.001" step="0.001" className="input-control" value={u.minQty || 1} onChange={(e) => updateUnitRow(i, 'minQty', e.target.value)} />
                        </div>
                        <div className="input-group">
                          <label>Quantity step</label>
                          <input type="number" min="0.001" step="0.001" className="input-control" value={u.qtyStep || 1} onChange={(e) => updateUnitRow(i, 'qtyStep', e.target.value)} />
                        </div>
                      </div>
                    </details>
                  ) : (
                    <p style={{ margin: '0.8rem 0 0', color: '#64748b', fontSize: '0.84rem' }}>
                      {u.isPurchaseUnit ? 'Purchase-only unit. Customers will not see it at checkout.' : 'This unit is currently unused. Select purchase or sale to use it.'}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <Link href="/inventory" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }} disabled={loading}>
              {loading ? 'Creating Product...' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
