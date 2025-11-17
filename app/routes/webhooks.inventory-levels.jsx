import { authenticate } from "../shopify.server.js";
import { calculateFinalPrice } from "../lib/discount/discountEngine.js";

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
    const basePrice = parseFloat(variant.compareAtPrice || variant.price);
    const inventoryAvailable = available > 0;
    const productCollections = variant.product.collections.edges.map((e) => e.node.id);

    // Calculer le nouveau prix
    const finalPrice = await calculateFinalPrice(
      shop,
      productId,
      variantId,
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
            id: variantId,
            price: finalPrice.toString(),
          },
        }
      );
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing inventory webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
}

