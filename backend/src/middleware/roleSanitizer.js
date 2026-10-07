/**
 * Explicit Cashier Whitelist DTO Sanitizer.
 * Constructs cashier responses strictly using allowed field Whitelist DTOs.
 */

const FORBIDDEN_REGEX = /cost|profit|margin|vendor|purchase|cogs/i;

const PRODUCT_WHITELIST = [
  'id', 'barcode', 'nameEn', 'nameHi', 'imageUrl', 'categoryId', 'category',
  'baseUnit', 'allowDecimalQty', 'lowStockThreshold', 'totalStockBase',
  'totalAvailableStock', 'formattedStock', 'units', 'createdAt', 'updatedAt',
];

const UNIT_WHITELIST = [
  'id', 'productId', 'nameEn', 'nameHi', 'factorToBase', 'isSellUnit',
  'sellingPrice', 'priceOverride', 'minQty', 'qtyStep', 'barcode', 'sortOrder',
];

const INVOICE_WHITELIST = [
  'id', 'invoiceNo', 'idempotencyKey', 'requestHash', 'customerId', 'customer',
  'customerPhone', 'customerName', 'subtotal', 'discountAmount', 'totalAmount', 'paymentMode', 'waStatus',
  'items', 'refunds', 'createdAt', 'updatedAt',
];

const ITEM_WHITELIST = [
  'id', 'invoiceId', 'productId', 'productName', 'unitName', 'factorToBase',
  'qtyInUnit', 'qtyBase', 'refundedQtyBase', 'unitPrice', 'grossLineTotal', 'discountAmount', 'lineTotal',
  'quantity', 'unitSalePrice', 'createdAt',
];

const CUSTOMER_WHITELIST = [
  'id', 'phone', 'name', 'firstName', 'totalOrders', 'lifetimeSpend',
  'lastPurchase', 'tags', 'lastCategory', 'createdAt', 'updatedAt',
];

function sanitizeObject(obj, allowedKeys) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item, allowedKeys));

  const result = {};
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_REGEX.test(key)) continue;
    if (allowedKeys && !allowedKeys.includes(key)) continue;

    if (key === 'units') {
      result.units = obj.units ? obj.units.map((u) => sanitizeObject(u, UNIT_WHITELIST)) : [];
    } else if (key === 'items') {
      result.items = obj.items ? obj.items.map((i) => sanitizeObject(i, ITEM_WHITELIST)) : [];
    } else if (key === 'customer') {
      result.customer = obj.customer ? sanitizeObject(obj.customer, CUSTOMER_WHITELIST) : null;
    } else if (Array.isArray(obj[key])) {
      result[key] = obj[key].map((item) => sanitizeFinancials(item, 'CASHIER'));
    } else if (typeof obj[key] === 'object' && obj[key] !== null && !(obj[key] instanceof Date)) {
      result[key] = sanitizeFinancials(obj[key], 'CASHIER');
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

export function sanitizeFinancials(data, userRole) {
  if (userRole === 'ADMIN') return data;
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFinancials(item, userRole));
  }

  if (typeof data === 'object') {
    // Check type of object for whitelist matching
    if (data.baseUnit || data.totalStockBase) {
      return sanitizeObject(data, PRODUCT_WHITELIST);
    }
    if (data.factorToBase && data.sellingPrice !== undefined && !data.invoiceId) {
      return sanitizeObject(data, UNIT_WHITELIST);
    }
    if (data.invoiceNo || data.totalAmount) {
      return sanitizeObject(data, INVOICE_WHITELIST);
    }
    if (data.invoiceId && data.qtyBase) {
      return sanitizeObject(data, ITEM_WHITELIST);
    }
    return sanitizeObject(data, null);
  }

  return data;
}

export function roleSanitizerMiddleware(req, res, next) {
  const originalJson = res.json;

  res.json = function (body) {
    const userRole = req.user?.role || 'CASHIER';
    if (userRole === 'CASHIER' && body) {
      if (body.data) {
        body.data = sanitizeFinancials(body.data, userRole);
      } else {
        body = sanitizeFinancials(body, userRole);
      }
    }
    return originalJson.call(this, body);
  };

  next();
}
