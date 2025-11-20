/**
 * Récupère tous les produits depuis Shopify
 */
export async function getShopifyProducts(admin) {
  const products = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
        query getProducts($cursor: String) {
          products(first: 250, after: $cursor) {
            edges {
              node {
                id
                title
                handle
                featuredImage {
                  url
                  altText
                }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      price
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      {
        variables: {
          cursor,
        },
      }
    );

    const data = await response.json();
    const edges = data.data?.products?.edges || [];
    
    products.push(...edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
      featuredImage: e.node.featuredImage?.url || null,
      imageAlt: e.node.featuredImage?.altText || e.node.title,
      defaultVariantId: e.node.variants.edges[0]?.node.id || null,
      defaultPrice: e.node.variants.edges[0]?.node.price || null,
    })));

    hasNextPage = data.data?.products?.pageInfo?.hasNextPage || false;
    cursor = data.data?.products?.pageInfo?.endCursor;
  }

  return products;
}

