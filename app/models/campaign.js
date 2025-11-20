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
  console.log("addProductsToCampaign called with:", { campaignId, products, productsCount: products.length });
  
  if (!products || products.length === 0) {
    console.log("No products to add, returning early");
    return { count: 0 };
  }
  
  // SQLite ne supporte pas skipDuplicates, donc on utilise create avec gestion d'erreur
  let createdCount = 0;
  for (const product of products) {
    try {
      await prisma.campaignProduct.create({
        data: {
          campaignId,
          productId: product.productId,
          variantId: product.variantId || null,
        },
      });
      createdCount++;
    } catch (error) {
      // Si c'est une erreur de contrainte unique (doublon), on l'ignore
      if (error.code === 'P2002') {
        console.log(`Product ${product.productId} already exists in campaign, skipping`);
        continue;
      }
      // Sinon, on propage l'erreur
      console.error(`Error creating campaign product for ${product.productId}:`, error);
      throw error;
    }
  }
  
  console.log(`addProductsToCampaign completed: ${createdCount} products created`);
  return { count: createdCount };
}

/**
 * Ajoute des collections à une campagne
 */
export async function addCollectionsToCampaign(campaignId, collections) {
  if (!collections || collections.length === 0) {
    return { count: 0 };
  }
  
  // SQLite ne supporte pas skipDuplicates, donc on utilise create avec gestion d'erreur
  let createdCount = 0;
  for (const collection of collections) {
    try {
      await prisma.campaignCollection.create({
        data: {
          campaignId,
          collectionId: collection.collectionId,
        },
      });
      createdCount++;
    } catch (error) {
      // Si c'est une erreur de contrainte unique (doublon), on l'ignore
      if (error.code === 'P2002') {
        console.log(`Collection ${collection.collectionId} already exists in campaign, skipping`);
        continue;
      }
      // Sinon, on propage l'erreur
      console.error(`Error creating campaign collection for ${collection.collectionId}:`, error);
      throw error;
    }
  }
  
  return { count: createdCount };
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

