import { useLoaderData, useActionData, Form, redirect } from "react-router";
import { Page, Card, Button, TextField, Select, Checkbox, Banner, InlineStack, BlockStack, FormLayout } from "@shopify/polaris";
import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { createCampaign } from "../models/campaign.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  return { shop: session.shop };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description");
  const discountType = formData.get("discountType");
  const discountValue = formData.get("discountValue");
  const instock = formData.get("instock") === "on";
  const tracking = formData.get("tracking") === "on";

  if (!name || !discountType || !discountValue) {
    return { error: "Veuillez remplir tous les champs requis" };
  }

  try {
    await createCampaign({
      shop,
      name,
      description: description || null,
      discountType,
      discountValue: parseFloat(discountValue),
      instock,
      tracking,
      active: true,
    });

    return redirect("/app/campaigns");
  } catch (error) {
    console.error("Error creating campaign:", error);
    return { error: "Erreur lors de la création de la campagne" };
  }
};

export default function NewCampaignPage() {
  const { shop } = useLoaderData();
  const actionData = useActionData();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [instock, setInstock] = useState(false);
  const [tracking, setTracking] = useState(true);

  return (
    <Page
      title="Nouvelle campagne"
      backAction={{ url: "/app/campaigns" }}
    >
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner status="critical" onDismiss={() => {}}>
            <p>{actionData.error}</p>
          </Banner>
        )}

        <Form method="post">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Informations générales
              </Text>
              <FormLayout>
                <TextField
                  label="Nom de la campagne"
                  value={name}
                  onChange={setName}
                  name="name"
                  required
                  autoComplete="off"
                  helpText="Un nom descriptif pour identifier cette campagne"
                  placeholder="Ex: Black Friday 2024"
                />
                
                <TextField
                  label="Description"
                  value={description}
                  onChange={setDescription}
                  name="description"
                  multiline={4}
                  autoComplete="off"
                  helpText="Description optionnelle de la campagne"
                  placeholder="Décrivez l'objectif de cette campagne..."
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Configuration du discount
              </Text>
              <FormLayout>
                <Select
                  label="Type de discount"
                  options={[
                    { label: "Pourcentage (%)", value: "PERCENTAGE" },
                    { label: "Montant fixe (DKK)", value: "FIXED" },
                    { label: "Prix fixe (DKK)", value: "FIXED_PRICE" },
                  ]}
                  value={discountType}
                  onChange={setDiscountType}
                  name="discountType"
                  helpText={
                    discountType === "PERCENTAGE"
                      ? "Réduction en pourcentage du prix original"
                      : discountType === "FIXED"
                      ? "Montant fixe déduit du prix original"
                      : "Prix fixe cible, indépendant du prix original"
                  }
                />
                
                <TextField
                  label={
                    discountType === "PERCENTAGE"
                      ? "Pourcentage (%)"
                      : discountType === "FIXED"
                      ? "Montant (DKK)"
                      : "Prix fixe (DKK)"
                  }
                  value={discountValue}
                  onChange={setDiscountValue}
                  name="discountValue"
                  type="number"
                  required
                  autoComplete="off"
                  suffix={discountType === "PERCENTAGE" ? "%" : "DKK"}
                  helpText={
                    discountType === "PERCENTAGE"
                      ? "Ex: 25 pour une réduction de 25%"
                      : discountType === "FIXED"
                      ? "Ex: 100 pour déduire 100 DKK"
                      : "Ex: 500 pour fixer le prix à 500 DKK"
                  }
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Options avancées
              </Text>
              <FormLayout>
                <Checkbox
                  label="Instock"
                  checked={instock}
                  onChange={setInstock}
                  name="instock"
                  helpText="Le discount sera actif uniquement si le produit est en stock. Si le produit est en rupture de stock, le prix original sera restauré automatiquement."
                />

                <Checkbox
                  label="Tracking"
                  checked={tracking}
                  onChange={setTracking}
                  name="tracking"
                  helpText="Si activé, le discount suivra les mises à jour automatiques de prix. Si désactivé, le prix discounté sera locké et ne changera pas même si le prix de base change."
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <InlineStack align="end">
              <Button url="/app/campaigns">
                Annuler
              </Button>
              <Button submit primary>
                Créer la campagne
              </Button>
            </InlineStack>
          </Card>
        </Form>
      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
