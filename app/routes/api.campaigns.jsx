import { authenticate } from "../shopify.server.js";
import { getCampaigns, createCampaign } from "../models/campaign.js";

/**
 * GET /api/campaigns - Liste toutes les campagnes
 */
export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const campaigns = await getCampaigns(shop);
    return Response.json({ campaigns });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return Response.json({ error: "Erreur lors de la récupération des campagnes" }, { status: 500 });
  }
}

/**
 * POST /api/campaigns - Crée une nouvelle campagne
 */
export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const body = await request.json();
    const { name, description, discountType, discountValue, instock, tracking, active, startDate, endDate } = body;

    // Validation
    if (!name || !discountType || discountValue === undefined) {
      return Response.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const campaign = await createCampaign({
      shop,
      name,
      description,
      discountType,
      discountValue: parseFloat(discountValue),
      instock: instock || false,
      tracking: tracking !== undefined ? tracking : true,
      active: active !== undefined ? active : true,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    return Response.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return Response.json({ error: "Erreur lors de la création de la campagne" }, { status: 500 });
  }
}

