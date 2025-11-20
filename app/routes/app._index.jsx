import { useLoaderData } from "react-router";
import { Page, Card, Button, Text, Badge, InlineStack, BlockStack, Box, List } from "@shopify/polaris";
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
    >
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingLg" as="h2">
              Welcome to Sneakerzone Discount App
            </Text>
            <Text as="p" variant="bodyMd">
              Automatically manage product discounts and pricing with advanced multi-campaign logic. 
              Create discount campaigns that apply to specific products or entire collections, 
              and let the system automatically calculate the best price for your customers.
            </Text>
          </BlockStack>
        </Card>

        <BlockStack gap="400">
          <InlineStack gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2" tone="subdued">
                  Total Campaigns
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
                  Active Campaigns
                </Text>
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="heading2xl" as="p" tone="success">
                    {activeCampaigns}
                  </Text>
                  {activeCampaigns > 0 ? (
                    <Badge status="success">Active</Badge>
                  ) : (
                    <Badge>Inactive</Badge>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2" tone="subdued">
                  Inactive Campaigns
                </Text>
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="heading2xl" as="p" tone="subdued">
                    {inactiveCampaigns}
                  </Text>
                  {inactiveCampaigns > 0 && <Badge>Inactive</Badge>}
                </InlineStack>
              </BlockStack>
            </Card>
          </InlineStack>

          {campaigns.length > 0 && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    Recent Campaigns
                  </Text>
                  <Button url="/app/campaigns" plain>
                    View All
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
                        <Button url="/app/campaigns" plain>
                          View
                        </Button>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          )}
        </BlockStack>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingLg" as="h2">
              How It Works
            </Text>
            <BlockStack gap="300">
              <Box>
                <Text variant="headingSm" as="h3">
                  Multi-Campaign Support
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Multiple campaigns can apply to the same product. The system automatically 
                  selects the lowest price from all active campaigns, ensuring your customers 
                  always see the best deal.
                </Text>
              </Box>

              <Box>
                <Text variant="headingSm" as="h3">
                  Flexible Discount Types
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Choose from three discount types:
                </Text>
                <List type="bullet">
                  <List.Item>
                    <Text as="span" fontWeight="semibold">Percentage:</Text> Apply a percentage discount (e.g., 20% off)
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">Fixed Amount:</Text> Subtract a fixed amount (e.g., 10 DKK off)
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">Fixed Price:</Text> Set a specific price (e.g., 50 DKK)
                  </List.Item>
                </List>
              </Box>

              <Box>
                <Text variant="headingSm" as="h3">
                  Target Products & Collections
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Assign campaigns to specific products or entire collections. You can select 
                  multiple products and collections per campaign, or leave them empty to 
                  assign targets later.
                </Text>
              </Box>

              <Box>
                <Text variant="headingSm" as="h3">
                  Advanced Options
                </Text>
                <List type="bullet">
                  <List.Item>
                    <Text as="span" fontWeight="semibold">Instock:</Text> When enabled, the discount only applies 
                    if the product is in stock. If stock runs out, the discount is automatically removed.
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">Tracking:</Text> When enabled, discounts recalculate 
                    automatically when product base prices change. When disabled, the discounted price is locked 
                    and won't change even if the base price updates.
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">Start/End Dates:</Text> Schedule campaigns to start 
                    and end at specific dates and times.
                  </List.Item>
                </List>
              </Box>

              <Box>
                <Text variant="headingSm" as="h3">
                  Automatic Price Updates
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Prices are automatically updated in Shopify when:
                </Text>
                <List type="bullet">
                  <List.Item>A campaign is created, updated, activated, or deactivated</List.Item>
                  <List.Item>Product inventory levels change (if Instock is enabled)</List.Item>
                  <List.Item>Product base prices change (if Tracking is enabled)</List.Item>
                </List>
                <Text as="p" tone="subdued" variant="bodySm" paddingBlockStart="200">
                  The system always calculates prices based on the original base price (compare_at_price), 
                  ensuring discounts are applied correctly even when multiple campaigns overlap.
                </Text>
              </Box>
            </BlockStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text variant="headingLg" as="h2">
              Getting Started
            </Text>
            <BlockStack gap="300">
              <Box>
                <Text variant="headingSm" as="h3">
                  1. Create a Campaign
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Click "New Campaign" to create your first discount campaign. Give it a name, 
                  choose a discount type and value, and configure your options.
                </Text>
              </Box>

              <Box>
                <Text variant="headingSm" as="h3">
                  2. Select Targets
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Choose which products or collections should receive the discount. You can search 
                  and select multiple items, or use "Select All" to quickly select everything.
                </Text>
              </Box>

              <Box>
                <Text variant="headingSm" as="h3">
                  3. Activate & Monitor
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Once created, activate your campaign. Prices will be automatically updated in 
                  Shopify. You can edit, deactivate, or delete campaigns at any time, and prices 
                  will be recalculated accordingly.
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
