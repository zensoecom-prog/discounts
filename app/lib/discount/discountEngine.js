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
 * 
 * @param {string} shop - Shop domain
 * @param {string} productId - Shopify product ID
 * @param {string} variantId - Shopify variant ID (peut être null)
 * @param {number} basePrice - Prix de base (prix normal avant toute campagne)
 * @param {boolean} inventoryAvailable - Si le produit est en stock
 * @param {string[]} productCollections - IDs des collections du produit
 * @returns {Promise<{finalPrice: number, shouldLock: Array<{campaignId: string, discountedPrice: number}>}>}
 */
export async function calculateFinalPrice(shop, productId, variantId, basePrice, inventoryAvailable, productCollections = []) {
  const campaigns = await getActiveCampaignsForProduct(shop, productId, variantId, productCollections);

  if (campaigns.length === 0) {
    return {
      finalPrice: basePrice,
      shouldLock: [],
      shouldRestoreOriginal: true,
    };
  }

  const prices = [];
  const shouldLock = []; // Campagnes avec Tracking=false qui doivent être lockées

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
        // Utiliser le prix locké existant
        prices.push(lockedPrice.lockedPrice);
        continue;
      }
      // Sinon, on va calculer et lock le prix après
    }

    // Calculer le prix discounté
    const discountedPrice = calculateDiscountedPrice(
      basePrice,
      campaign.discountType,
      campaign.discountValue
    );

    prices.push(discountedPrice);

    // Si Tracking = false et qu'on n'a pas encore de lockedPrice, on doit le créer
    if (!campaign.tracking) {
      shouldLock.push({
        campaignId: campaign.id,
        discountedPrice,
      });
    }
  }

  // Retourner le prix le plus bas parmi toutes les campagnes actives
  // Si aucune campagne applicable, retourner le prix de base
  const finalPrice = prices.length > 0 ? Math.min(...prices) : basePrice;
  // Restaurer le prix original seulement si le prix final n'est pas inférieur au prix de base
  const shouldRestoreOriginal = finalPrice >= basePrice || prices.length === 0;

  return {
    finalPrice,
    shouldLock,
    shouldRestoreOriginal,
  };
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
 * Détermine le prix de base (prix normal avant toute campagne)
 * Le prix de base est le compareAtPrice s'il existe (prix original),
 * sinon c'est le price actuel (prix normal du produit)
 */
export function determineBasePrice(compareAtPrice, currentPrice) {
  // Si compareAtPrice existe, c'est le prix original (avant discount)
  // Sinon, le price actuel est le prix normal du produit
  return compareAtPrice ? parseFloat(compareAtPrice) : parseFloat(currentPrice);
}
