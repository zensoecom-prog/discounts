import { useLoaderData } from "react-router";
import { Page, Card, Button, Text, Badge, EmptyState, InlineStack, BlockStack, Box } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { getCampaigns } from "../models/campaign.js";
import { formatDiscountValue } from "../lib/discount/utils.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const campaigns = await getCampaigns(shop);

  return { campaigns, shop };
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

export default function CampaignsPage() {
  const { campaigns } = useLoaderData();

  return (
    <Page
      title="Campagnes de Discount"
      primaryAction={{
        content: "Nouvelle campagne",
        url: "/app/campaigns/new",
      }}
    >
      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            heading="Créez votre première campagne"
            action={{
              content: "Créer une campagne",
              url: "/app/campaigns/new",
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Les campagnes de discount vous permettent de gérer les réductions 
              sur vos produits avec une logique avancée de calcul de prix.
            </p>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <BlockStack gap="400">
            {campaigns.map((campaign) => {
              const targetCount = campaign.products.length + campaign.collections.length;
              
              return (
                <Box key={campaign.id} paddingBlockStart="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Button url={`/app/campaigns/${campaign.id}`} plain>
                          <Text variant="headingMd" as="span">
                            {campaign.name}
                          </Text>
                        </Button>
                        {campaign.active ? (
                          <Badge status="success">Active</Badge>
                        ) : (
                          <Badge>Inactive</Badge>
                        )}
                      </InlineStack>
                      <Button url={`/app/campaigns/${campaign.id}`} plain>
                        Voir
                      </Button>
                    </InlineStack>
                    
                    {campaign.description && (
                      <Text as="p" tone="subdued">{campaign.description}</Text>
                    )}
                    
                    <InlineStack gap="200">
                      <Badge>{getDiscountTypeLabel(campaign.discountType)}</Badge>
                      <Text tone="subdued">
                        {formatDiscountValue(campaign.discountType, campaign.discountValue)}
                      </Text>
                      {campaign.instock && <Badge>Instock</Badge>}
                      {!campaign.tracking && <Badge tone="warning">Prix locké</Badge>}
                      <Text tone="subdued">
                        {targetCount} {targetCount === 1 ? "cible" : "cibles"}
                      </Text>
                    </InlineStack>
                    
                    <Text tone="subdued" variant="bodySm">
                      Créée le {new Date(campaign.createdAt).toLocaleDateString("fr-FR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                  </BlockStack>
                </Box>
              );
            })}
          </BlockStack>
        </Card>
      )}
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
