import { authenticate } from "../shopify.server.js";

/**
 * GET /api/products/:id/variants - Récupère les variantes d'un produit
 */
export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const productId = params.id;

  try {
    const response = await admin.graphql(
      `#graphql
        query getProductVariants($id: ID!) {
          product(id: $id) {
            id
            title
            featuredImage {
              url
              altText
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  inventoryQuantity
                  image {
                    url
                    altText
                  }
                  selectedOptions {
                    name
                    value
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
      return Response.json({ error: "Produit non trouvé" }, { status: 404 });
    }

    const variants = product.variants.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title || "Par défaut",
      price: e.node.price,
      sku: e.node.sku,
      inventoryQuantity: e.node.inventoryQuantity,
      image: e.node.image?.url || null,
      imageAlt: e.node.image?.altText || e.node.title || "Variante",
      selectedOptions: e.node.selectedOptions,
    }));

    return Response.json({
      product: {
        id: product.id,
        title: product.title,
        featuredImage: product.featuredImage?.url || null,
        imageAlt: product.featuredImage?.altText || product.title,
      },
      variants,
    });
  } catch (error) {
    console.error("Error fetching product variants:", error);
    return Response.json(
      { error: "Erreur lors de la récupération des variantes" },
      { status: 500 }
    );
  }
}

