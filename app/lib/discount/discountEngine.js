import prisma from "../../db.server.js";
import { calculateDiscountedPrice } from "./utils.js";

/**
 * Récupère toutes les campagnes actives qui s'appliquent à un produit
 */
export async function getActiveCampaignsForProduct(shop, productId, variantId = null, productCollections = []) {
  const now = new Date();
  
  // Campagnes actives avec dates valides
  const activeCampaigns = await prisma.campaign.findMany({
    where: {
      shop,
      active: true,
      OR: [
        { startDate: null },
        { startDate: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
    },
    include: {
      products: true,
      collections: true,
    },
  });

  // Filtrer les campagnes qui s'appliquent à ce produit
  const applicableCampaigns = activeCampaigns.filter((campaign) => {
    // Vérifier si le produit est directement assigné
    const hasProduct = campaign.products.some(
      (p) => p.productId === productId && (!variantId || !p.variantId || p.variantId === variantId)
    );

    // Vérifier si le produit appartient à une collection assignée
    const hasCollection = campaign.collections.some((c) =>
      productCollections.includes(c.collectionId)
    );

    return hasProduct || hasCollection;
  });

  return applicableCampaigns;
}

/**
 * Calcule le prix final pour un produit en tenant compte de toutes les campagnes applicables
 * Retourne le prix le plus bas parmi toutes les campagnes
 */
export async function calculateFinalPrice(shop, productId, variantId, basePrice, inventoryAvailable, productCollections = []) {
  const campaigns = await getActiveCampaignsForProduct(shop, productId, variantId, productCollections);

  if (campaigns.length === 0) {
    return basePrice;
  }

  const prices = [];

  for (const campaign of campaigns) {
    // Vérifier le flag Instock
    if (campaign.instock && !inventoryAvailable) {
      continue; // Skip cette campagne si Instock est activé et le produit n'est pas en stock
    }

    // Vérifier le flag Tracking
    if (!campaign.tracking) {
      // Si Tracking est désactivé, vérifier s'il y a un prix locké
      const lockedPrice = await prisma.lockedPrice.findUnique({
        where: {
          campaignId_productId_variantId: {
            campaignId: campaign.id,
            productId,
            variantId: variantId || "",
          },
        },
      });

      if (lockedPrice) {
        prices.push(lockedPrice.lockedPrice);
        continue;
      }
    }

    // Calculer le prix discounté
    const discountedPrice = calculateDiscountedPrice(
      basePrice,
      campaign.discountType,
      campaign.discountValue
    );

    prices.push(discountedPrice);
  }

  // Retourner le prix le plus bas (ou le prix de base si aucune campagne applicable)
  return prices.length > 0 ? Math.min(...prices, basePrice) : basePrice;
}

/**
 * Lock un prix pour une campagne avec Tracking = false
 */
export async function lockPrice(shop, campaignId, productId, variantId, basePrice, discountedPrice) {
  return await prisma.lockedPrice.upsert({
    where: {
      campaignId_productId_variantId: {
        campaignId,
        productId,
        variantId: variantId || "",
      },
    },
    update: {
      basePrice,
      lockedPrice: discountedPrice,
      updatedAt: new Date(),
    },
    create: {
      shop,
      campaignId,
      productId,
      variantId: variantId || null,
      basePrice,
      lockedPrice: discountedPrice,
    },
  });
}

/**
 * Recalcule les prix pour tous les produits affectés par une campagne
 */
export async function recalculateCampaignProducts(campaignId) {
  // Cette fonction sera appelée après une mise à jour de campagne
  // Elle déclenchera le recalcul des prix pour tous les produits affectés
  // Pour l'instant, on retourne simplement un succès
  // L'implémentation complète nécessiterait de récupérer tous les produits affectés
  // et de mettre à jour leurs prix via l'API Shopify
  return { success: true };
}

