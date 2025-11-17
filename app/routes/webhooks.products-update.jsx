import { authenticate } from "../shopify.server.js";
import { calculateFinalPrice } from "../lib/discount/discountEngine.js";

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
                  inventoryItem {
                    id
                    inventoryLevels(first: 10) {
                      edges {
                        node {
                          available
                        }
                      }
                    }
                  }
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
      const basePrice = parseFloat(variant.compareAtPrice || variant.price);
      
      // Calculer le stock disponible
      const inventoryLevels = variant.inventoryItem?.inventoryLevels?.edges || [];
      const inventoryAvailable = inventoryLevels.some(
        (level) => level.node.available > 0
      );

      // Calculer le nouveau prix
      const finalPrice = await calculateFinalPrice(
        shop,
        productId,
        variant.id,
        basePrice,
        inventoryAvailable,
        productCollections
      );

      // Mettre à jour le prix dans Shopify si nécessaire
      if (finalPrice !== basePrice) {
        await admin.graphql(
          `#graphql
            mutation updateVariantPrice($id: ID!, $price: Decimal!) {
              productVariantUpdate(input: { id: $id, price: $price }) {
                productVariant {
                  id
                  price
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
              id: variant.id,
              price: finalPrice.toString(),
            },
          }
        );
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing product webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
}

