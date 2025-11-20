/**
 * Récupère toutes les collections depuis Shopify
 */
export async function getShopifyCollections(admin) {
  const collections = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
        query getCollections($cursor: String) {
          collections(first: 250, after: $cursor) {
            edges {
              node {
                id
                title
                handle
                image {
                  url
                  altText
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
    const edges = data.data?.collections?.edges || [];
    
    collections.push(...edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
      image: e.node.image?.url || null,
      imageAlt: e.node.image?.altText || e.node.title,
    })));

    hasNextPage = data.data?.collections?.pageInfo?.hasNextPage || false;
    cursor = data.data?.collections?.pageInfo?.endCursor;
  }

  return collections;
}

