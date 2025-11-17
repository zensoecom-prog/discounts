import { useLoaderData } from "react-router";
import { Page, Card, Text, Badge, InlineStack, BlockStack, Box } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { getCampaign } from "../models/campaign.js";
import { formatDiscountValue } from "../lib/discount/utils.js";

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const campaignId = params.id;

  const campaign = await getCampaign(campaignId);

  if (!campaign || campaign.shop !== shop) {
    throw new Response("Campagne non trouvée", { status: 404 });
  }

  return { campaign, shop };
};

function getDiscountTypeLabel(type) {
  switch (type) {
    case "PERCENTAGE":
      return "Pourcentage";
    case "FIXED":
      return "Montant fixe";
    case "FIXED_PRICE":
      return "Prix fixe";
    default:
      return type;
  }
}

export default function CampaignDetailPage() {
  const { campaign } = useLoaderData();

  const {
    id,
    name,
    description,
    discountType,
    discountValue,
    instock,
    tracking,
    active,
    products,
    collections,
    createdAt,
    updatedAt,
  } = campaign;

  return (
    <Page
      title={name}
      backAction={{ url: "/app/campaigns" }}
    >
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingLg" as="h2">
                  {name}
                </Text>
                {active ? (
                  <Badge status="success">Active</Badge>
                ) : (
                  <Badge>Inactive</Badge>
                )}
                <Badge>{getDiscountTypeLabel(discountType)}</Badge>
                <Text variant="headingMd" tone="subdued">
                  {formatDiscountValue(discountType, discountValue)}
                </Text>
                {instock && <Badge>Instock</Badge>}
                {!tracking && <Badge tone="warning">Prix locké</Badge>}
              </InlineStack>
            </InlineStack>

            {description && (
              <Text as="p" tone="subdued">{description}</Text>
            )}

            <BlockStack gap="200">
              <Box>
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  Créée le
                </Text>
                <Text as="p" tone="subdued">
                  {new Date(createdAt).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Box>

              <Box>
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  Modifiée le
                </Text>
                <Text as="p" tone="subdued">
                  {new Date(updatedAt).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Box>

              <Box>
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  Cibles
                </Text>
                <Text as="p" tone="subdued">
                  {products.length} {products.length === 1 ? "produit" : "produits"} •{" "}
                  {collections.length} {collections.length === 1 ? "collection" : "collections"}
                </Text>
              </Box>
            </BlockStack>
          </BlockStack>
        </Card>

        {products.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Produits ({products.length})
              </Text>
              <BlockStack gap="200">
                {products.map((product) => (
                  <Box key={product.id}>
                    <Text variant="bodyMd" fontWeight="semibold">
                      {product.productId}
                    </Text>
                    {product.variantId && (
                      <Text as="p" tone="subdued" variant="bodySm">
                        Variante: {product.variantId}
                      </Text>
                    )}
                  </Box>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {collections.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Collections ({collections.length})
              </Text>
              <BlockStack gap="200">
                {collections.map((collection) => (
                  <Box key={collection.id}>
                    <Text variant="bodyMd" fontWeight="semibold">
                      {collection.collectionId}
                    </Text>
                  </Box>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {products.length === 0 && collections.length === 0 && (
          <Card>
            <Text as="p" tone="subdued">
              Cette campagne n'a pas encore de produits ou de collections assignés.
            </Text>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
