'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api.js';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  ShoppingBag,
  Sparkles,
  CreditCard,
  QrCode,
  Banknote,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import QRCode from '../../../components/QRCode.js';

const getSellUnits = (product) => {
  const units = product?.units || [];
  const sellUnits = units.filter((unit) => unit.isSellUnit === true);
  // Keep support for older API responses that do not include unit-role flags.
  return sellUnits.length || units.some((unit) => typeof unit.isSellUnit === 'boolean')
    ? sellUnits
    : units;
};

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [activePopoverProductId, setActivePopoverProductId] = useState(null);
  
  // Checkout moved to /cart page.
  const [selectedUnitMap, setSelectedUnitMap] = useState({});

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await apiFetch('/products');
      const fetchedProducts = res.data || [];
      setProducts(fetchedProducts);

      // Pre-select the base unit or first configured selling unit.
      const defaultUnits = {};
      fetchedProducts.forEach((p) => {
        const sellUnits = getSellUnits(p);
        if (sellUnits.length > 0) {
          const baseSellUnit = sellUnits.find((u) => Number(u.factorToBase) === 1) || sellUnits[0];
          defaultUnits[p.id] = baseSellUnit.id;
        }
      });
      setSelectedUnitMap((prev) => ({ ...defaultUnits, ...prev }));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Load cart on mount to keep in sync with /cart page
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('pos_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Save cart to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);



  // Add item to cart with selected unit
  const addToCart = (product, unitOverride = null) => {
    const totalStock = Number(product.totalStockBase ?? product.totalAvailableStock ?? 0);
    if (totalStock <= 0) {
      alert('This product is out of stock!');
      return;
    }

    const availableUnits = getSellUnits(product);
    if (product.units?.length > 0 && availableUnits.length === 0) {
      alert('No selling unit is configured for this product. Update it from Inventory first.');
      return;
    }
    let targetUnit = unitOverride;

    if (!targetUnit) {
      const selectedUnitId = selectedUnitMap[product.id];
      if (availableUnits.length > 0) {
        targetUnit = availableUnits.find((u) => u.id === selectedUnitId) || availableUnits[0];
      }
    }

    if (!targetUnit) {
      targetUnit = {
        id: 'legacy-unit',
        unitName: product.unit || 'Pcs',
        factorToBase: 1,
        salePrice: Number(product.batches?.[0]?.sellingPrice || 100),
      };
    }

    const factor = Number(targetUnit.factorToBase || 1);
    if (totalStock < factor) {
      alert(`Insufficient stock to add 1 ${targetUnit.unitName}! Available stock: ${product.formattedStock || totalStock}`);
      return;
    }

    const cartItemId = `${product.id}-${targetUnit.id}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.cartItemId === cartItemId);
      if (existingIndex > -1) {
        // Item already in cart. Quantity will be adjusted on the Cart page.
        // Alert user that it's already added to avoid double adding silently.
        alert(`Product added! Go to Cart & Order page to update quantity.`);
        return prev;
      }

      alert(`${product.nameEn} added to cart!`);
      return [
        ...prev,
        {
          cartItemId,
          productId: product.id,
          unitId: targetUnit.id !== 'legacy-unit' ? targetUnit.id : null,
          unitName: targetUnit.unitName,
          factorToBase: factor,
          nameEn: product.nameEn,
          nameHi: product.nameHi,
          salePrice: Number(targetUnit.salePrice),
          regularPrice: Number(targetUnit.regularPrice ?? targetUnit.sellingPrice ?? targetUnit.salePrice),
          qtyInUnit: 1,
          allowDecimalQty: Boolean(product.allowDecimalQty),
          totalStockBase: totalStock,
        },
      ];
    });
  };

  // Adjust cart qty
  const updateQty = (cartItemId, deltaOrValue, isDirectInput = false) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            let newQty = isDirectInput ? parseFloat(deltaOrValue) || 0 : item.qtyInUnit + deltaOrValue;
            if (newQty <= 0) return null;

            if (!item.allowDecimalQty) {
              newQty = Math.floor(newQty);
            }

            const requiredBase = newQty * item.factorToBase;
            if (requiredBase > item.totalStockBase) {
              const maxInUnit = item.allowDecimalQty
                ? (item.totalStockBase / item.factorToBase).toFixed(2)
                : Math.floor(item.totalStockBase / item.factorToBase);
              alert(`Max available for this unit is ${maxInUnit} ${item.unitName}`);
              return item;
            }
            return { ...item, qtyInUnit: newQty };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (cartItemId) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.salePrice * item.qtyInUnit, 0);

  // Handle POS Checkout with Idempotency Key
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert('Cart is empty!');

    setError('');
    setLoading(true);

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const payload = {
        idempotencyKey,
        customerName: customerName.trim() || 'Guest Customer',
        phone: phone.trim() || undefined,
        paymentMode,
        items: cart.map((item) => ({
          productId: item.productId,
          unitId: item.unitId,
          qtyInUnit: item.qtyInUnit,
          qty: item.qtyInUnit,
          salePrice: item.salePrice,
          regularPrice: item.regularPrice,
        })),
      };

      console.log('[POS] Sending checkout payload:', payload);

      const res = await apiFetch('/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('[POS] Checkout response:', res);

      if (!res.invoiceNo) {
        throw new Error('Invalid response from server — no invoice number received');
      }

      const invoiceData = {
        invoiceNo: res.invoiceNo,
        total: res.total ?? subtotal,
        profit: res.profit ?? 0,
        waStatus: res.waStatus ?? 'N/A',
        items: [...cart],
        customerName: payload.customerName,
        phone: payload.phone,
        paymentMode,
      };

      // Clear cart FIRST, then show success modal
      setCart([]);
      setCustomerName('');
      setPhone('');
      setCashGiven('');
      fetchProducts(); // Refresh stock

      setCompletedInvoice(invoiceData);
    } catch (err) {
      console.error('[POS] Checkout error:', err);
      setError(err.message || 'Checkout failed. Check browser console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      p.nameHi?.includes(search) ||
      p.barcode?.includes(search);
    const matchesCategory =
      selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <style>{`
        .pos-layout {
          display: flex;
          gap: 1.25rem;
          height: calc(100vh - 3.5rem);
        }
        .pos-left-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 0;
          overflow: hidden;
        }
        .pos-product-card {
          overflow: hidden;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }
        .pos-product-card:hover {
          transform: translateY(-3px);
          border-color: #d7b79e !important;
          box-shadow: 0 14px 30px rgba(31, 42, 46, 0.1) !important;
        }
        .pos-right-panel {
          width: 410px;
          min-width: 410px;
          border-radius: 20px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          background: rgba(23, 26, 35, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          overflow-y: auto;
        }
        .pos-cart-list {
          min-height: 140px;
          max-height: 240px;
          overflow-y: auto;
          margin: 0.75rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          background: rgba(0, 0, 0, 0.25);
          border-radius: 14px;
          padding: 0.65rem;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .pos-checkout-section {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 0.85rem;
          flex-shrink: 0;
        }
        .receipt-modal {
          width: 360px;
          border-radius: 20px;
          padding: 2rem 1.5rem;
          text-align: center;
        }
        @media (max-width: 768px) {
          .pos-layout {
            flex-direction: column;
            height: auto;
            gap: 1rem;
          }
          .pos-right-panel {
            width: 100%;
            border-radius: 12px;
            margin-bottom: 2rem;
          }
          .receipt-modal {
            width: 100%;
            height: 100%;
            border-radius: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
        }
      `}</style>
      <div className="pos-layout">
      {/* Left: Product Selector */}
      <div className="pos-left-panel" style={styles.leftPanel}>
        {/* Search Header */}
        <div style={styles.searchBox} className="glass-panel">
          <div style={styles.searchInputWrapper}>
            <Search size={20} color="#758188" />
            <input
              type="text"
              placeholder="Search product name or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
              autoFocus
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={styles.categoryPills}>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`btn btn-sm ${selectedCategory === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All Items
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`btn btn-sm ${selectedCategory === c.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {c.nameEn} ({c.nameHi})
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div style={styles.productGrid}>
          {filteredProducts.map((product) => {
            const stockBase = Number(product.totalStockBase ?? product.totalAvailableStock ?? 0);
            const isOutOfStock = stockBase <= 0;
            const isLowStock = stockBase <= (product.minAlertQty ?? 5);

            const sellUnits = getSellUnits(product);
            const hasUnits = sellUnits.length > 0;
            const selectedUnitId = selectedUnitMap[product.id] || (hasUnits ? sellUnits[0].id : null);
            const activeUnitObj = hasUnits
              ? sellUnits.find((u) => u.id === selectedUnitId) || sellUnits[0]
              : null;

            const activeUnit = activeUnitObj
              ? {
                  ...activeUnitObj,
                  unitName: activeUnitObj.unitName || activeUnitObj.nameEn || product.baseUnit,
                  regularPrice: Number(activeUnitObj.sellingPrice ?? activeUnitObj.salePrice ?? 0),
                  salePrice: Number(activeUnitObj.sellingPrice ?? activeUnitObj.salePrice ?? 0),
                }
              : {
                  unitName: product.unit || product.baseUnit || 'Pcs',
                  regularPrice: Number(product.batches?.[0]?.sellingPrice || 0),
                  salePrice: Number(product.batches?.[0]?.sellingPrice || 0),
                  factorToBase: 1,
                };

            const unitPrice = Number(activeUnit.salePrice || 0);

            return (
              <div
                key={product.id}
                style={isOutOfStock ? { ...styles.productCard, ...styles.outOfStockCard } : styles.productCard}
                className="pos-product-card animate-fade-in"
              >
                {/* Product Image Box */}
                <div style={styles.cardImageBox}>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.nameEn}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ fontSize: '3.5rem' }}>🪔</div>
                  )}
                  {isOutOfStock && (
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                      <span className="badge badge-danger">Out of Stock</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, padding: '0 0.2rem' }}>
                  {/* Title & Names */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <h3 style={styles.cardTitle}>{product.nameEn}</h3>
                    <div style={styles.cardSubtitle}>{product.nameHi}</div>
                  </div>

                  {/* Unit Selector Row */}
                  {hasUnits && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={styles.selectSizeHeader}>Select Size</div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {sellUnits.map((u) => {
                          const uName = u.unitName || u.nameEn || 'Unit';
                          const isSelected = selectedUnitId === u.id;
                          const factor = Number(u.factorToBase || 1);
                          const isStockDeficit = stockBase < factor;

                          return (
                            <button
                              key={u.id}
                              type="button"
                              disabled={isStockDeficit}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUnitMap((prev) => ({ ...prev, [product.id]: u.id }));
                              }}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                border: isSelected ? '1.5px solid #d96823' : '1px solid #d9ddd7',
                                background: isSelected ? '#fdf0e7' : '#ffffff',
                                color: isStockDeficit ? '#758188' : '#1f2a2e',
                                cursor: isStockDeficit ? 'not-allowed' : 'pointer',
                                opacity: isStockDeficit ? 0.5 : 1,
                                minWidth: '42px',
                                maxWidth: '100%',
                                textAlign: 'center',
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {uName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ flex: 1 }}></div>

                  {/* Card Footer: Price & Add Button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: 'auto' }}>
                    <button
                      disabled={isOutOfStock || (product.units?.length > 0 && !hasUnits)}
                      onClick={() => !isOutOfStock && (hasUnits || !product.units?.length) && addToCart(product, activeUnit)}
                      style={{
                        background: '#124336',
                        color: '#ffffff',
                        borderRadius: '24px',
                        padding: '0.65rem 1.25rem',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: 'none',
                        cursor: isOutOfStock || !hasUnits ? 'not-allowed' : 'pointer',
                        opacity: isOutOfStock || !hasUnits ? 0.6 : 1,
                        transition: 'transform 0.1s ease',
                      }}
                    >
                      <ShoppingBag size={16} /> {hasUnits || !product.units?.length ? 'Add to cart' : 'No selling unit'}
                    </button>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1f2a2e' }}>
                        ₹{unitPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
    </>
  );
}

const styles = {
  leftPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    overflowY: 'auto',
  },
  searchBox: {
    padding: '0.75rem 1rem',
    borderRadius: '16px',
  },
  searchInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
  },
  categoryPills: {
    display: 'flex',
    gap: '0.5rem',
    overflowX: 'auto',
    paddingBottom: '0.5rem',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))',
    gap: '1rem',
    overflowY: 'auto',
    flex: 1,
    minWidth: 0,
    paddingRight: '0.2rem',
    alignContent: 'start',
  },
  productCard: {
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minWidth: 0,
    minHeight: '360px',
    padding: '1.35rem',
    background: '#ffffff',
    borderRadius: '24px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0',
    transition: 'all 0.2s ease',
  },
  outOfStockCard: {
    opacity: 0.5,
    cursor: 'not-allowed',
    filter: 'grayscale(100%)',
  },
  cardImageBox: {
    position: 'relative',
    background: '#f5f3ed',
    borderRadius: '16px',
    height: '160px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
    padding: '1rem',
    position: 'relative',
  },
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: '800',
    color: '#0f172a',
    margin: 0,
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
  },
  cardSubtitle: {
    fontSize: '0.92rem',
    color: '#647179',
    marginTop: '0.35rem',
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
  },
  selectSizeHeader: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '0.6rem',
  },
  cartHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  cartTitle: {
    fontSize: '1.1rem',
    flex: 1,
  },
  cartList: {
    flex: 1,
    overflowY: 'auto',
    margin: '1rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  emptyCart: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: '#64748b',
    fontSize: '0.85rem',
  },
  cartItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.03)',
    padding: '0.75rem',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  cartItemName: {
    fontSize: '0.88rem',
    fontWeight: '700',
  },
  cartItemHindi: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  cartItemPrice: {
    fontSize: '0.8rem',
    color: '#f97316',
    fontWeight: '600',
  },
  qtyControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  qtyBtn: {
    background: '#334155',
    border: 'none',
    color: 'var(--text-primary)',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: '0.9rem',
    fontWeight: '700',
    width: '20px',
    textAlign: 'center',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    marginLeft: '0.3rem',
  },
  checkoutSection: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '1rem',
  },
  paymentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
  },
  paymentBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.5rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'var(--bg-card)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  paymentBtnActive: {
    background: 'rgba(249, 115, 22, 0.15)',
    border: '1px solid #f97316',
    color: '#f97316',
    fontWeight: '700',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '1rem 0',
    fontSize: '1.05rem',
    fontWeight: '700',
  },
  totalAmount: {
    fontSize: '1.4rem',
    color: '#f97316',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  receiptHeader: {
    marginBottom: '1.5rem',
  },
  receiptBody: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    padding: '1rem',
    margin: '1rem 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    fontSize: '0.9rem',
  },
  receiptRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  modalActions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.5rem',
  },
  errorBox: {
    background: 'rgba(244, 63, 94, 0.2)',
    color: '#f43f5e',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    marginBottom: '0.75rem',
    border: '1px solid rgba(244, 63, 94, 0.4)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: '600',
  },
  upiBox: {
    background: 'rgba(249, 115, 22, 0.08)',
    border: '1px solid rgba(249, 115, 22, 0.25)',
    borderRadius: '12px',
    padding: '0.75rem',
    margin: '0.6rem 0',
  },
  upiMetaHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upiAppsHint: {
    textAlign: 'center',
    fontSize: '0.72rem',
    color: '#94a3b8',
    marginTop: '0.4rem',
  },
  cashBox: {
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    borderRadius: '12px',
    padding: '0.75rem',
    margin: '0.6rem 0',
  },
  changeReturnRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.88rem',
    marginTop: '0.4rem',
  },
  khataNotice: {
    background: 'rgba(99, 102, 241, 0.12)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    borderRadius: '10px',
    padding: '0.6rem',
    margin: '0.6rem 0',
    fontSize: '0.78rem',
    color: '#a5b4fc',
    textAlign: 'center',
  },
  upiAmountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.3rem 0',
    marginBottom: '0.2rem',
  },
  upiDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0.7rem 0 0.5rem',
    textAlign: 'center',
  },
  upiDividerText: {
    flex: 1,
    textAlign: 'center',
    fontSize: '0.75rem',
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: '0.02em',
  },
  upiConfirmBtn: {
    width: '100%',
    padding: '0.9rem 1rem',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: '800',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    boxShadow: '0 0 20px rgba(16, 185, 129, 0.4), 0 4px 15px rgba(16, 185, 129, 0.3)',
    animation: 'upiPulse 2s ease-in-out infinite',
    transition: 'all 0.2s ease',
  },
  upiConfirmBtnLoading: {
    background: 'linear-gradient(135deg, #374151, #1f2937)',
    boxShadow: 'none',
    animation: 'none',
    cursor: 'not-allowed',
  },
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#f97316',
    animation: 'spin 0.7s linear infinite',
  },
};
