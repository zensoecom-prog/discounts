import prisma from "../db.server.js";

/**
 * Récupère toutes les campagnes d'un shop
 */
export async function getCampaigns(shop) {
  return await prisma.campaign.findMany({
    where: { shop },
    include: {
      products: true,
      collections: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Récupère une campagne par ID
 */
export async function getCampaign(campaignId) {
  return await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      products: true,
      collections: true,
      lockedPrices: true,
    },
  });
}

/**
 * Crée une nouvelle campagne
 */
export async function createCampaign(data) {
  const { shop, name, description, discountType, discountValue, instock, tracking, active, startDate, endDate } = data;
  
  return await prisma.campaign.create({
    data: {
      shop,
      name,
      description,
      discountType,
      discountValue,
      instock,
      tracking,
      active: active !== undefined ? active : true,
      startDate,
      endDate,
    },
  });
}

/**
 * Met à jour une campagne
 */
export async function updateCampaign(campaignId, data) {
  return await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Supprime une campagne
 */
export async function deleteCampaign(campaignId) {
  return await prisma.campaign.delete({
    where: { id: campaignId },
  });
}

/**
 * Ajoute des produits à une campagne
 */
export async function addProductsToCampaign(campaignId, products) {
  const data = products.map((p) => ({
    campaignId,
    productId: p.productId,
    variantId: p.variantId || null,
  }));

  return await prisma.campaignProduct.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * Ajoute des collections à une campagne
 */
export async function addCollectionsToCampaign(campaignId, collections) {
  const data = collections.map((c) => ({
    campaignId,
    collectionId: c.collectionId,
  }));

  return await prisma.campaignCollection.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * Supprime des produits d'une campagne
 */
export async function removeProductsFromCampaign(campaignId, productIds) {
  return await prisma.campaignProduct.deleteMany({
    where: {
      campaignId,
      productId: { in: productIds },
    },
  });
}

/**
 * Supprime des collections d'une campagne
 */
export async function removeCollectionsFromCampaign(campaignId, collectionIds) {
  return await prisma.campaignCollection.deleteMany({
    where: {
      campaignId,
      collectionId: { in: collectionIds },
    },
  });
}

