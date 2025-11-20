import { authenticate } from "../shopify.server.js";
import { calculateFinalPrice, lockPrice, determineBasePrice } from "../lib/discount/discountEngine.js";

/**
 * Webhook handler pour inventory_levels/update
 * Recalcule les prix lorsque le stock change
 */
export async function action({ request }) {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (topic !== "inventory_levels/update") {
    throw new Response("Unhandled webhook topic", { status: 404 });
  }

  try {
    const inventoryItemId = payload.inventory_item_id || payload.inventoryItemId;
    const available = payload.available || 0;

    if (!inventoryItemId) {
      return new Response("Missing inventory_item_id", { status: 400 });
    }

    // Récupérer les variantes associées à cet inventory_item
    const response = await admin.graphql(
      `#graphql
        query getVariantsByInventoryItem($inventoryItemId: ID!) {
          inventoryItem(id: $inventoryItemId) {
            id
            variant {
              id
              product {
                id
                collections(first: 10) {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
              price
              compareAtPrice
            }
          }
        }
      `,
      {
        variables: {
          inventoryItemId: `gid://shopify/InventoryItem/${inventoryItemId}`,
        },
      }
    );

    const data = await response.json();
    const variant = data.data?.inventoryItem?.variant;

    if (!variant) {
      return new Response("Variant not found", { status: 404 });
    }

    const productId = variant.product.id;
    const variantId = variant.id;
    
    // Déterminer le prix de base (prix normal avant toute campagne)
    const basePrice = determineBasePrice(variant.compareAtPrice, variant.price);
    const currentPrice = parseFloat(variant.price);
    const inventoryAvailable = available > 0;
    const productCollections = variant.product.collections.edges.map((e) => e.node.id);

    // Calculer le nouveau prix avec toutes les campagnes actives
    const { finalPrice, shouldLock, shouldRestoreOriginal } = await calculateFinalPrice(
      shop,
      productId,
      variantId,
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
        variantId,
        basePrice,
        lockInfo.discountedPrice
      );
    }

    // Déterminer les valeurs à mettre à jour dans Shopify
    let newPrice = finalPrice;
    let newCompareAtPrice = variant.compareAtPrice;

    if (shouldRestoreOriginal) {
      // Aucune campagne applicable ou prix discounté >= prix de base
      // Restaurer le prix original (important pour Instock: si out of stock et Instock=true, restaurer)
      newPrice = basePrice;
      newCompareAtPrice = null; // Effacer compareAtPrice si on retire le discount
    } else {
      // Appliquer le discount
      newPrice = finalPrice;
      // Si compareAtPrice n'existe pas encore, le définir avec le prix de base
      if (!variant.compareAtPrice) {
        newCompareAtPrice = basePrice.toString();
      }
      // Sinon, garder le compareAtPrice existant (c'est le prix original)
    }

    // Mettre à jour le prix dans Shopify si nécessaire
    const priceChanged = Math.abs(newPrice - currentPrice) > 0.01;
    const compareAtPriceChanged = newCompareAtPrice !== variant.compareAtPrice;

    if (priceChanged || compareAtPriceChanged) {
      const updateResponse = await admin.graphql(
        `#graphql
          mutation updateVariantPrice($input: ProductVariantInput!) {
            productVariantUpdate(input: $input) {
              productVariant {
                id
                price
                compareAtPrice
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          variables: {
            input: {
              id: variantId,
              price: newPrice.toString(),
              compareAtPrice: newCompareAtPrice,
            },
          },
        }
      );
      
      const updateData = await updateResponse.json();
      if (updateData.data?.productVariantUpdate?.userErrors?.length > 0) {
        console.error("Erreur lors de la mise à jour du prix:", updateData.data.productVariantUpdate.userErrors);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing inventory webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
}

