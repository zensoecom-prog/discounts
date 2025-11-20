import { calculateFinalPrice, lockPrice, determineBasePrice } from "./discountEngine.js";
import { authenticate } from "../../shopify.server.js";

/**
 * Applique les discounts d'une campagne à tous les produits affectés
 * Met à jour le price (prix discounté) et compareAtPrice (prix original)
 */
export async function applyCampaignDiscounts(shop, campaignId, admin) {
  const { getCampaign } = await import("../../models/campaign.js");
  const campaign = await getCampaign(campaignId);
  
  if (!campaign || !campaign.active) {
    return { success: false, message: "Campagne inactive ou introuvable" };
  }

  const now = new Date();
  // Vérifier les dates de la campagne
  if (campaign.startDate && new Date(campaign.startDate) > now) {
    return { success: false, message: "Campagne pas encore démarrée" };
  }
  if (campaign.endDate && new Date(campaign.endDate) < now) {
    return { success: false, message: "Campagne terminée" };
  }

  const productIdsToUpdate = new Set();
  
  // Ajouter les produits directement assignés
  campaign.products.forEach((cp) => {
    productIdsToUpdate.add(cp.productId);
  });

  // Récupérer tous les produits des collections assignées
  for (const collectionCampaign of campaign.collections) {
    const collectionId = collectionCampaign.collectionId;
    
    let hasNextPage = true;
    let cursor = null;
    
    while (hasNextPage) {
      const response = await admin.graphql(
        `#graphql
          query getCollectionProducts($id: ID!, $cursor: String) {
            collection(id: $id) {
              id
              products(first: 250, after: $cursor) {
                edges {
                  node {
                    id
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        `,
        {
          variables: {
            id: collectionId,
            cursor,
          },
        }
      );

      const data = await response.json();
      const collection = data.data?.collection;
      
      if (collection) {
        collection.products.edges.forEach((edge) => {
          productIdsToUpdate.add(edge.node.id);
        });
        
        hasNextPage = collection.products.pageInfo.hasNextPage;
        cursor = collection.products.pageInfo.endCursor;
      } else {
        hasNextPage = false;
      }
    }
  }

  // Mettre à jour les prix pour tous les produits
  let updatedCount = 0;
  let errorCount = 0;

  for (const productId of productIdsToUpdate) {
    try {
      // Récupérer le produit avec ses variantes et collections
      const productResponse = await admin.graphql(
        `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              collections(first: 10) {
                edges {
                  node {
                    id
                  }
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    price
                    compareAtPrice
                    inventoryQuantity
                  }
                }
              }
            }
          }
        `,
        {
          variables: {
            id: productId,
          },
        }
      );

      const productData = await productResponse.json();
      const product = productData.data?.product;

      if (!product) {
        errorCount++;
        continue;
      }

      const productCollections = product.collections.edges.map((e) => e.node.id);

      // Préparer les mises à jour pour toutes les variantes de ce produit
      const variantsToUpdate = [];

      // Traiter chaque variante
      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        
        // IMPORTANT: Toujours utiliser compareAtPrice comme prix de base s'il existe
        // car c'est le prix original avant toute campagne
        // Si compareAtPrice n'existe pas, alors price est le prix normal du produit
        // Cela garantit qu'on calcule toujours sur le prix original, pas sur un prix déjà discounté
        const basePrice = determineBasePrice(variant.compareAtPrice, variant.price);
        const currentPrice = parseFloat(variant.price);
        
        // Calculer le stock disponible
        // inventoryQuantity peut être null si le tracking n'est pas activé
        const inventoryAvailable = (variant.inventoryQuantity ?? 0) > 0;

        // Calculer le nouveau prix avec toutes les campagnes actives
        const { finalPrice, shouldLock, shouldRestoreOriginal } = await calculateFinalPrice(
          shop,
          productId,
          variant.id,
          basePrice,
          inventoryAvailable,
          productCollections
        );

        // Lock les prix pour les campagnes avec Tracking = false
        for (const lockInfo of shouldLock) {
          await lockPrice(
            shop,
            lockInfo.campaignId,
            productId,
            variant.id,
            basePrice,
            lockInfo.discountedPrice
          );
        }

        // Déterminer les valeurs à mettre à jour dans Shopify
        let newPrice = finalPrice;
        let newCompareAtPrice = variant.compareAtPrice;

        if (shouldRestoreOriginal) {
          // Aucune campagne applicable ou prix discounté >= prix de base
          // Restaurer le prix original
          newPrice = basePrice;
          newCompareAtPrice = null; // Effacer compareAtPrice si on retire le discount
        } else if (finalPrice < basePrice) {
          // Appliquer le discount : le prix discounté est inférieur au prix de base
          newPrice = finalPrice;
          // Toujours définir compareAtPrice avec le prix de base (prix original)
          // pour que Shopify affiche le prix barré et le nouveau prix
          newCompareAtPrice = basePrice.toString();
        } else {
          // Le prix final n'est pas inférieur au prix de base, restaurer
          newPrice = basePrice;
          newCompareAtPrice = null;
        }

        // Vérifier si une mise à jour est nécessaire
        const priceChanged = Math.abs(newPrice - currentPrice) > 0.01;
        const currentCompareAtPriceStr = variant.compareAtPrice ? variant.compareAtPrice.toString() : null;
        const newCompareAtPriceStr = newCompareAtPrice ? newCompareAtPrice.toString() : null;
        const compareAtPriceChanged = currentCompareAtPriceStr !== newCompareAtPriceStr;

        if (priceChanged || compareAtPriceChanged) {
          console.log(`Preparing update for variant ${variant.id}: price ${currentPrice} -> ${newPrice}, compareAtPrice ${currentCompareAtPriceStr} -> ${newCompareAtPriceStr}`);
          
          variantsToUpdate.push({
            id: variant.id,
            price: newPrice.toString(),
            compareAtPrice: newCompareAtPriceStr,
          });
        }
      }

      // Mettre à jour toutes les variantes de ce produit en une seule requête si nécessaire
      if (variantsToUpdate.length > 0) {
        const updateResponse = await admin.graphql(
          `#graphql
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  price
                  compareAtPrice
                }
                userErrors {
                  field
                  message
                  code
                }
              }
            }
          `,
          {
            variables: {
              productId: productId,
              variants: variantsToUpdate.map(v => ({
                id: v.id,
                price: v.price,
                compareAtPrice: v.compareAtPrice,
              })),
            },
          }
        );

        const updateData = await updateResponse.json();
        if (updateData.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
          console.error("Erreur lors de la mise à jour des prix:", updateData.data.productVariantsBulkUpdate.userErrors);
          errorCount += updateData.data.productVariantsBulkUpdate.userErrors.length;
        } else {
          updatedCount += variantsToUpdate.length;
        }
      }
    } catch (error) {
      console.error(`Erreur lors du traitement du produit ${productId}:`, error);
      errorCount++;
    }
  }

  return {
    success: true,
    updatedCount,
    errorCount,
    totalProducts: productIdsToUpdate.size,
  };
}

