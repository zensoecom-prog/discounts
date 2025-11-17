import { useLoaderData } from "react-router";
import { Page, Card, Button, Text, Banner, Badge, EmptyState, InlineStack, BlockStack, Box } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { getCampaigns } from "../models/campaign.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const campaigns = await getCampaigns(shop);
  const activeCampaigns = campaigns.filter((c) => c.active).length;
  const inactiveCampaigns = campaigns.length - activeCampaigns;

  return {
    shop,
    totalCampaigns: campaigns.length,
    activeCampaigns,
    inactiveCampaigns,
    campaigns: campaigns.slice(0, 5),
  };
};

export default function Index() {
  const { totalCampaigns, activeCampaigns, inactiveCampaigns, campaigns } = useLoaderData();

  return (
    <Page
      title="Sneakerzone Discount App"
      primaryAction={{
        content: "Nouvelle campagne",
        url: "/app/campaigns/new",
      }}
    >
      <BlockStack gap="500">
        <Banner
          title="Bienvenue dans Sneakerzone Discount App !"
          status="info"
        >
          <p>
            Gérez vos campagnes de discount avec une logique avancée. 
            Créez votre première campagne pour commencer à optimiser vos prix automatiquement.
          </p>
        </Banner>

        {totalCampaigns === 0 ? (
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
          <>
            <BlockStack gap="400">
              <InlineStack gap="400">
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h2" tone="subdued">
                      Campagnes totales
                    </Text>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="heading2xl" as="p">
                        {totalCampaigns}
                      </Text>
                      <Badge tone="info">Total</Badge>
                    </InlineStack>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h2" tone="subdued">
                      Campagnes actives
                    </Text>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="heading2xl" as="p" tone="success">
                        {activeCampaigns}
                      </Text>
                      {activeCampaigns > 0 ? (
                        <Badge status="success">Actives</Badge>
                      ) : (
                        <Badge>Inactives</Badge>
                      )}
                    </InlineStack>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h2" tone="subdued">
                      Campagnes inactives
                    </Text>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="heading2xl" as="p" tone="subdued">
                        {inactiveCampaigns}
                      </Text>
                      {inactiveCampaigns > 0 && <Badge>Inactives</Badge>}
                    </InlineStack>
                  </BlockStack>
                </Card>
              </InlineStack>

              {campaigns.length > 0 && (
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingMd" as="h2">
                        Campagnes récentes
                      </Text>
                      <Button url="/app/campaigns" plain>
                        Voir toutes
                      </Button>
                    </InlineStack>
                    <BlockStack gap="200">
                      {campaigns.map((campaign) => (
                        <Box key={campaign.id} paddingBlockStart="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <InlineStack gap="200" blockAlign="center">
                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                  {campaign.name}
                                </Text>
                                <Badge status={campaign.active ? "success" : undefined}>
                                  {campaign.active ? "Active" : "Inactive"}
                                </Badge>
                              </InlineStack>
                              {campaign.description && (
                                <Text as="p" tone="subdued" variant="bodySm">
                                  {campaign.description}
                                </Text>
                              )}
                            </BlockStack>
                            <Button url={`/app/campaigns/${campaign.id}`} plain>
                              Voir
                            </Button>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          </>
        )}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Fonctionnalités principales
            </Text>
            <BlockStack gap="300">
              <Box>
                <Text variant="headingSm" as="h3">
                  Multi-campagnes
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Plusieurs campagnes peuvent s'appliquer au même produit. 
                  Le système choisit automatiquement le prix le plus bas pour vos clients.
                </Text>
              </Box>

              <Box>
                <Text variant="headingSm" as="h3">
                  Types de discount flexibles
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Pourcentage, montant fixe, ou prix fixe. Chaque campagne peut 
                  cibler des produits spécifiques ou des collections entières.
                </Text>
              </Box>

              <Box>
                <Text variant="headingSm" as="h3">
                  Gestion intelligente
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Option Instock pour activer le discount uniquement si le produit 
                  est en stock. Option Tracking pour suivre ou ignorer les mises à jour 
                  automatiques de prix.
                </Text>
              </Box>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
