import { authenticate } from "../shopify.server.js";
import { calculateFinalPrice, lockPrice, determineBasePrice } from "../lib/discount/discountEngine.js";

/**
 * Webhook handler pour products/update
 * Recalcule les prix lorsque les produits sont modifiés
 */
export async function action({ request }) {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (topic !== "products/update") {
    throw new Response("Unhandled webhook topic", { status: 404 });
  }

  try {
    const productId = payload.id;

    // Récupérer le produit avec ses variantes et collections
    const response = await admin.graphql(
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

    const data = await response.json();
    const product = data.data?.product;

    if (!product) {
      return new Response("Product not found", { status: 404 });
    }

    const productCollections = product.collections.edges.map((e) => e.node.id);

    // Traiter chaque variante
    for (const variantEdge of product.variants.edges) {
      const variant = variantEdge.node;
      
      // Déterminer le prix de base (prix normal avant toute campagne)
      // Si Tracking = true, on utilise le nouveau price comme base (mise à jour automatique)
      // Si Tracking = false, on utilise le compareAtPrice (prix original locké)
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
                id: variant.id,
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
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing product webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
}

