import { authenticate } from "../shopify.server.js";
import { getCampaign, updateCampaign, deleteCampaign } from "../models/campaign.js";
import { recalculateCampaignProducts } from "../lib/discount/discountEngine.js";

/**
 * GET /api/campaigns/:id - Récupère une campagne
 */
export async function loader({ request, params }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const campaignId = params.id;

  try {
    const campaign = await getCampaign(campaignId);

    if (!campaign || campaign.shop !== shop) {
      return Response.json({ error: "Campagne non trouvée" }, { status: 404 });
    }

    return Response.json({ campaign });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return Response.json({ error: "Erreur lors de la récupération de la campagne" }, { status: 500 });
  }
}

/**
 * PUT /api/campaigns/:id - Met à jour une campagne
 * DELETE /api/campaigns/:id - Supprime une campagne
 */
export async function action({ request, params }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const campaignId = params.id;

  try {
    const campaign = await getCampaign(campaignId);

    if (!campaign || campaign.shop !== shop) {
      return Response.json({ error: "Campagne non trouvée" }, { status: 404 });
    }

    const method = request.method;

    if (method === "DELETE") {
      await deleteCampaign(campaignId);
      return Response.json({ success: true });
    }

    if (method === "PUT") {
      const body = await request.json();
      const updatedCampaign = await updateCampaign(campaignId, body);

      // Recalculer les prix si la campagne a été modifiée
      await recalculateCampaignProducts(campaignId);

      return Response.json({ campaign: updatedCampaign });
    }

    return Response.json({ error: "Méthode non autorisée" }, { status: 405 });
  } catch (error) {
    console.error("Error updating/deleting campaign:", error);
    return Response.json({ error: "Erreur lors de la mise à jour/suppression de la campagne" }, { status: 500 });
  }
}

