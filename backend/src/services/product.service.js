import { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/AppError.js';
import { calcSellingPrice, formatStock, roundMoney } from '../utils/unit.utils.js';
import { deleteImageFromCloudinary } from './cloudinary.service.js';
import {
  encryptPii,
  decryptProduct,
  getBarcodeLookup,
} from '../utils/customer-privacy.js';

const prisma = new PrismaClient();

const formatProductForResponse = (product) => {
  const activeBatches = product.batches || [];
  // Calculate total stock in base unit from active batches or totalStockBase
  const totalStockBase = activeBatches.reduce((sum, b) => {
    const rem = Number(b.qtyRemainingBase) > 0 ? Number(b.qtyRemainingBase) : Number(b.currentStock || 0);
    return sum + rem;
  }, 0);

  // Latest batch cost per base unit (FIFO oldest active batch or latest batch)
  const latestBatch = activeBatches[activeBatches.length - 1] || activeBatches[0];
  const costPerBase = latestBatch
    ? Number(latestBatch.costPerBase) > 0
      ? Number(latestBatch.costPerBase)
      : Number(latestBatch.purchaseCost || 0)
    : 0;
  // Compute calculated selling prices for all units
  const unitsWithPrices = (product.units || []).map((u) => {
    const factorToBase = Number(u.factorToBase || 1);
    const marginPercent = Number(u.marginPercent || 0);
    const priceOverride = u.priceOverride !== null ? Number(u.priceOverride) : null;

    const sellingPrice = calcSellingPrice({
      costPerBase,
      factorToBase,
      marginPercent,
      priceOverride,
    });
    const unitCost = roundMoney(costPerBase * factorToBase);
    const profitPerUnit = roundMoney(sellingPrice - unitCost);

    return {
      id: u.id,
      productId: u.productId,
      nameEn: u.nameEn,
      nameHi: u.nameHi,
      factorToBase,
      isPurchaseUnit: u.isPurchaseUnit,
      isSellUnit: u.isSellUnit,
      marginPercent,
      priceOverride,
      minQty: Number(u.minQty || 1),
      qtyStep: Number(u.qtyStep || 1),
      barcode: u.barcode,
      sortOrder: u.sortOrder,
      sellingPrice,
      unitCost,
      profitPerUnit,
    };
  });

  return {
    ...product,
    totalStockBase,
    totalAvailableStock: Math.floor(totalStockBase),
    formattedStock: formatStock(totalStockBase, { baseUnit: product.baseUnit, units: product.units }),
    latestCostPerBase: costPerBase,
    units: unitsWithPrices,
  };
};

let productCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL fallback

export const invalidateProductCache = () => {
  productCache = null;
  cacheTimestamp = 0;
};

export const getAllProducts = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && productCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return productCache;
  }

  // Fetch products, category, units, and active batches in a single DB query
  const products = await prisma.product.findMany({
    include: {
      category: true,
      units: { orderBy: { sortOrder: 'asc' } },
      batches: {
        where: {
          OR: [
            { qtyRemainingBase: { gt: 0 } },
            { currentStock: { gt: 0 } },
          ],
        },
        orderBy: { receivedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formatted = products.map((p) => formatProductForResponse(decryptProduct(p)));
  productCache = formatted;
  cacheTimestamp = now;

  return formatted;
};

export const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      units: { orderBy: { sortOrder: 'asc' } },
      batches: {
        where: {
          OR: [
            { qtyRemainingBase: { gt: 0 } },
            { currentStock: { gt: 0 } },
          ],
        },
        orderBy: { receivedAt: 'asc' },
      },
    },
  });
  if (!product) throw new NotFoundError('Product not found');

  return formatProductForResponse(decryptProduct(product));
};

export const getProductByBarcode = async (barcode) => {
  const barcodeLookup = getBarcodeLookup(barcode);

  // First search by Product barcode or barcodeLookup
  let product = await prisma.product.findFirst({
    where: {
      OR: [
        ...(barcodeLookup ? [{ barcodeLookup }] : []),
        { barcode },
      ],
    },
    include: {
      category: true,
      units: { orderBy: { sortOrder: 'asc' } },
      batches: {
        where: {
          OR: [
            { qtyRemainingBase: { gt: 0 } },
            { currentStock: { gt: 0 } },
          ],
        },
        orderBy: { receivedAt: 'asc' },
      },
    },
  });

  // If not found on Product, search by ProductUnit barcode
  if (!product) {
    const unitMatch = await prisma.productUnit.findFirst({
      where: {
        OR: [
          ...(barcodeLookup ? [{ barcodeLookup }] : []),
          { barcode },
        ],
      },
      select: { productId: true },
    });

    if (unitMatch) {
      product = await prisma.product.findUnique({
        where: { id: unitMatch.productId },
        include: {
          category: true,
          units: { orderBy: { sortOrder: 'asc' } },
          batches: {
            where: {
              OR: [
                { qtyRemainingBase: { gt: 0 } },
                { currentStock: { gt: 0 } },
              ],
            },
            orderBy: { receivedAt: 'asc' },
          },
        },
      });
    }
  }

  if (!product) throw new NotFoundError('Product not found');

  return formatProductForResponse(decryptProduct(product));
};

export const getLowStockProducts = async () => {
  const products = await getAllProducts();
  return products.filter((p) => {
    const threshold = Number(p.lowStockThreshold) > 0 ? Number(p.lowStockThreshold) : Number(p.minAlertQty || 0);
    return Number(p.totalStockBase) <= threshold;
  });
};

export const createProduct = async (data) => {
  const {
    barcode,
    nameEn,
    nameHi,
    categoryId,
    baseUnit = 'piece',
    allowDecimalQty = false,
    lowStockThreshold = 0,
    minAlertQty = 0,
    units = [],
  } = data;

  if (!nameEn) {
    throw new ValidationError('English product name is required');
  }

  if (barcode) {
    const barcodeLookup = getBarcodeLookup(barcode);
    const existing = await prisma.product.findFirst({
      where: {
        OR: [
          ...(barcodeLookup ? [{ barcodeLookup }] : []),
          { barcode },
        ],
      },
    });
    if (existing) throw new ConflictError('Product with this barcode already exists');
  }

  return await prisma.$transaction(async (tx) => {
    const barcodeLookup = barcode ? getBarcodeLookup(barcode) : null;
    const product = await tx.product.create({
      data: {
        nameEn: encryptPii(nameEn),
        nameHi: nameHi ? encryptPii(nameHi) : null,
        categoryId,
        barcode: barcode ? encryptPii(barcode) : null,
        barcodeLookup,
        baseUnit: baseUnit || 'piece',
        allowDecimalQty: Boolean(allowDecimalQty),
        lowStockThreshold: Number(lowStockThreshold || minAlertQty || 0),
        minAlertQty: parseInt(minAlertQty || lowStockThreshold || 0),
      },
    });

    // Create default base unit if units array is empty
    const unitsToCreate = units.length > 0
      ? units
      : [
          {
            nameEn: baseUnit || 'piece',
            nameHi: nameHi || baseUnit,
            factorToBase: 1.0,
            isPurchaseUnit: true,
            isSellUnit: true,
            marginPercent: 25.0,
            qtyStep: allowDecimalQty ? 0.001 : 1.0,
            minQty: allowDecimalQty ? 0.001 : 1.0,
            sortOrder: 0,
          },
        ];

    const seenUnitNames = new Set();
    for (const u of unitsToCreate) {
      const cleanName = String(u.nameEn || '').trim().toLowerCase();
      if (!cleanName) {
        throw new ValidationError('Each unit must have an English name (e.g. piece, pack, box)');
      }
      if (seenUnitNames.has(cleanName)) {
        throw new ValidationError(`Duplicate unit name "${u.nameEn}". Each unit for this product must have a distinct name (e.g. Unit 1: "piece", Unit 2: "pack" or "box"). If you only sell in single units, remove Unit 2.`);
      }
      seenUnitNames.add(cleanName);

      const factor = Number(u.factorToBase || 1);
      if (factor <= 0) {
        throw new ValidationError(`Unit factor for ${u.nameEn} must be greater than 0`);
      }

      const unitBarcode = u.barcode || null;
      const unitBarcodeLookup = unitBarcode ? getBarcodeLookup(unitBarcode) : null;

      await tx.productUnit.create({
        data: {
          productId: product.id,
          nameEn: u.nameEn,
          nameHi: u.nameHi ? encryptPii(u.nameHi) : null,
          factorToBase: factor,
          isPurchaseUnit: Boolean(u.isPurchaseUnit),
          isSellUnit: u.isSellUnit !== undefined ? Boolean(u.isSellUnit) : true,
          marginPercent: Number(u.marginPercent || 0),
          priceOverride: u.priceOverride ? Number(u.priceOverride) : null,
          minQty: Number(u.minQty || (allowDecimalQty ? 0.001 : 1.0)),
          qtyStep: Number(u.qtyStep || (allowDecimalQty ? 0.001 : 1.0)),
          barcode: unitBarcode ? encryptPii(unitBarcode) : null,
          barcodeLookup: unitBarcodeLookup,
          sortOrder: parseInt(u.sortOrder || 0),
        },
      });
    }

    const createdProduct = await tx.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        units: { orderBy: { sortOrder: 'asc' } },
        batches: true,
      },
    });

    invalidateProductCache();
    return formatProductForResponse(decryptProduct(createdProduct));
  });
};

export const updateProduct = async (id, data) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { units: true },
  });
  if (!product) throw new NotFoundError('Product not found');

  if (data.barcode) {
    const barcodeLookup = getBarcodeLookup(data.barcode);
    const existing = await prisma.product.findFirst({
      where: {
        OR: [
          ...(barcodeLookup ? [{ barcodeLookup }] : []),
          { barcode: data.barcode },
        ],
        NOT: { id },
      },
    });
    if (existing) throw new ConflictError('Product with this barcode already exists');
  }

  return await prisma.$transaction(async (tx) => {
    const updateData = {};
    if (data.nameEn !== undefined) updateData.nameEn = encryptPii(data.nameEn);
    if (data.nameHi !== undefined) updateData.nameHi = data.nameHi ? encryptPii(data.nameHi) : null;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.barcode !== undefined) {
      updateData.barcode = data.barcode ? encryptPii(data.barcode) : null;
      updateData.barcodeLookup = data.barcode ? getBarcodeLookup(data.barcode) : null;
    }
    if (data.baseUnit !== undefined) updateData.baseUnit = data.baseUnit;
    if (data.allowDecimalQty !== undefined) updateData.allowDecimalQty = Boolean(data.allowDecimalQty);
    if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = Number(data.lowStockThreshold);
    if (data.minAlertQty !== undefined) updateData.minAlertQty = parseInt(data.minAlertQty);
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl;
      if (product.imageUrl && product.imageUrl !== data.imageUrl) {
        deleteImageFromCloudinary(product.imageUrl).catch((err) => {
          console.warn('Failed to delete old image on product update:', err.message);
        });
      }
    }

    await tx.product.update({
      where: { id },
      data: updateData,
    });

    // If units provided, upsert units
    if (Array.isArray(data.units)) {
      const seenUnitNames = new Set();
      for (const u of data.units) {
        const cleanName = String(u.nameEn || '').trim().toLowerCase();
        if (cleanName) {
          if (seenUnitNames.has(cleanName)) {
            throw new ValidationError(`Duplicate packaging unit "${u.nameEn}". Each unit for this product must have a distinct name (e.g. "piece", "pack").`);
          }
          seenUnitNames.add(cleanName);
        }
      }

      for (const u of data.units) {
        const factor = Number(u.factorToBase || 1);
        if (factor <= 0) {
          throw new ValidationError(`Unit factor for ${u.nameEn} must be > 0`);
        }

        const unitBarcode = u.barcode || null;
        const unitBarcodeLookup = unitBarcode ? getBarcodeLookup(unitBarcode) : null;

        if (u.id) {
          await tx.productUnit.update({
            where: { id: u.id },
            data: {
              nameEn: u.nameEn,
              nameHi: u.nameHi ? encryptPii(u.nameHi) : null,
              factorToBase: factor,
              isPurchaseUnit: Boolean(u.isPurchaseUnit),
              isSellUnit: Boolean(u.isSellUnit),
              marginPercent: Number(u.marginPercent || 0),
              priceOverride: u.priceOverride ? Number(u.priceOverride) : null,
              minQty: Number(u.minQty || 1),
              qtyStep: Number(u.qtyStep || 1),
              barcode: unitBarcode ? encryptPii(unitBarcode) : null,
              barcodeLookup: unitBarcodeLookup,
              sortOrder: parseInt(u.sortOrder || 0),
            },
          });
        } else {
          await tx.productUnit.create({
            data: {
              productId: id,
              nameEn: u.nameEn,
              nameHi: u.nameHi ? encryptPii(u.nameHi) : null,
              factorToBase: factor,
              isPurchaseUnit: Boolean(u.isPurchaseUnit),
              isSellUnit: Boolean(u.isSellUnit),
              marginPercent: Number(u.marginPercent || 0),
              priceOverride: u.priceOverride ? Number(u.priceOverride) : null,
              minQty: Number(u.minQty || 1),
              qtyStep: Number(u.qtyStep || 1),
              barcode: unitBarcode ? encryptPii(unitBarcode) : null,
              barcodeLookup: unitBarcodeLookup,
              sortOrder: parseInt(u.sortOrder || 0),
            },
          });
        }
      }
    }

    const updatedProduct = await tx.product.findUnique({
      where: { id },
      include: {
        category: true,
        units: { orderBy: { sortOrder: 'asc' } },
        batches: {
          where: {
            OR: [
              { qtyRemainingBase: { gt: 0 } },
              { currentStock: { gt: 0 } },
            ],
          },
          orderBy: { receivedAt: 'asc' },
        },
      },
    });

    invalidateProductCache();
    return formatProductForResponse(decryptProduct(updatedProduct));
  });
};

export const deleteProduct = async (id) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError('Product not found');

  // If product has an image, delete it from Cloudinary / disk
  if (product.imageUrl) {
    deleteImageFromCloudinary(product.imageUrl).catch((delErr) => {
      console.warn('Failed to delete image on product deletion:', delErr.message);
    });
  }

  await prisma.productBatch.deleteMany({ where: { productId: id } });
  await prisma.productUnit.deleteMany({ where: { productId: id } });
  const deleted = await prisma.product.delete({ where: { id } });
  invalidateProductCache();
  return deleted;
};
