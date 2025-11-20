import { useLoaderData, useFetcher, useActionData } from "react-router";
import { Page, Card, Button, Text, Badge, EmptyState, InlineStack, BlockStack, Box, Modal, TextField, Select, Checkbox, Banner, FormLayout, Divider, Tabs, ResourceList, ResourceItem, Popover, ActionList, Thumbnail } from "@shopify/polaris";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { getCampaigns } from "../models/campaign.js";
import { formatDiscountValue } from "../lib/discount/utils.js";
import { getShopifyCollections } from "../lib/shopify/collections.js";
import { getShopifyProducts } from "../lib/shopify/products.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const [campaigns, collections, products] = await Promise.all([
    getCampaigns(shop),
    getShopifyCollections(admin),
    getShopifyProducts(admin),
  ]);

  // Log pour vérifier que les campagnes sont bien chargées avec leurs relations
  console.log("=== LOADER DEBUG ===");
  campaigns.forEach((campaign) => {
    console.log(`Campaign ${campaign.id} (${campaign.name}):`, {
      productsCount: campaign.products?.length || 0,
      collectionsCount: campaign.collections?.length || 0,
      products: campaign.products?.map(p => p.productId) || [],
      collections: campaign.collections?.map(c => c.collectionId) || []
    });
  });
  console.log("=== END LOADER DEBUG ===");

  return { campaigns, collections, products, shop };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name");
    const description = formData.get("description");
    const discountType = formData.get("discountType");
    const discountValue = formData.get("discountValue");
    const instock = formData.get("instock") === "on";
    const tracking = formData.get("tracking") === "on";
    const startDate = formData.get("startDate") || null;
    const endDate = formData.get("endDate") || null;

    if (!name || !discountType || !discountValue) {
      return { error: "Please fill in all required fields", intent: "create" };
    }

    try {
      const { createCampaign, addProductsToCampaign, addCollectionsToCampaign } = await import("../models/campaign.js");
      
      // Créer la campagne
      const campaign = await createCampaign({
        shop,
        name,
        description: description || null,
        discountType,
        discountValue: parseFloat(discountValue),
        instock,
        tracking,
        active: true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      });

      // Ajouter les produits sélectionnés
      // Utiliser JSON pour récupérer les tableaux (plus fiable que FormData.getAll)
      let productIds = [];
      const productsJson = formData.get("productsJson");
      if (productsJson) {
        try {
          productIds = JSON.parse(productsJson);
        } catch (e) {
          console.error("Error parsing productsJson:", e);
        }
      }
      // Fallback sur FormData.getAll si JSON n'est pas disponible
      if (productIds.length === 0) {
        productIds = formData.getAll("products");
      }
      
      console.log("=== CREATE CAMPAIGN DEBUG ===");
      console.log("Product IDs from formData:", productIds, "Count:", productIds.length);
      console.log("All FormData entries:", Array.from(formData.entries()).map(([k, v]) => `${k}: ${typeof v === 'string' && v.length > 100 ? v.substring(0, 100) + '...' : v}`));
      
      if (productIds.length > 0) {
        const products = productIds.map((productId) => ({
          productId: String(productId).trim(),
          variantId: null, // Produit entier
        }));
        console.log("Adding products to campaign:", products);
        console.log("Campaign ID:", campaign.id);
        try {
          const result = await addProductsToCampaign(campaign.id, products);
          console.log("Products added result:", result);
          console.log("Products count:", result.count || "unknown");
          
          // Vérifier immédiatement après l'ajout
          const { getCampaign } = await import("../models/campaign.js");
          const checkCampaign = await getCampaign(campaign.id);
          console.log("Immediate check after addProductsToCampaign:", {
            campaignId: checkCampaign.id,
            productsCount: checkCampaign.products?.length || 0,
            products: checkCampaign.products?.map(p => p.productId) || []
          });
        } catch (error) {
          console.error("Error adding products:", error);
          console.error("Error stack:", error.stack);
          throw error;
        }
      } else {
        console.log("No products to add");
      }

      // Ajouter les collections sélectionnées
      // Utiliser JSON pour récupérer les tableaux (plus fiable que FormData.getAll)
      let selectedCollections = [];
      const collectionsJson = formData.get("collectionsJson");
      if (collectionsJson) {
        try {
          selectedCollections = JSON.parse(collectionsJson);
        } catch (e) {
          console.error("Error parsing collectionsJson:", e);
        }
      }
      // Fallback sur FormData.getAll si JSON n'est pas disponible
      if (selectedCollections.length === 0) {
        selectedCollections = formData.getAll("collections");
      }
      
      console.log("Collection IDs from formData:", selectedCollections, "Count:", selectedCollections.length);
      
      if (selectedCollections.length > 0) {
        const collections = selectedCollections.map((collectionId) => ({
          collectionId: String(collectionId).trim(),
        }));
        console.log("Adding collections to campaign:", collections);
        try {
          const result = await addCollectionsToCampaign(campaign.id, collections);
          console.log("Collections added result:", result);
          console.log("Collections count:", result.count || "unknown");
        } catch (error) {
          console.error("Error adding collections:", error);
          throw error;
        }
      } else {
        console.log("No collections to add");
      }
      
      // Vérifier que les données sont bien sauvegardées
      const { getCampaign } = await import("../models/campaign.js");
      const updatedCampaign = await getCampaign(campaign.id);
      console.log("Campaign after adding products/collections:", {
        id: updatedCampaign.id,
        productsCount: updatedCampaign.products.length,
        collectionsCount: updatedCampaign.collections.length,
        products: updatedCampaign.products.map(p => p.productId),
        collections: updatedCampaign.collections.map(c => c.collectionId)
      });
      console.log("=== END DEBUG ===");

      // Recalculer les prix pour tous les produits affectés par cette campagne
      // Cela garantit que les prix sont corrects avec toutes les campagnes actives
      // et que le prix le plus bas est toujours appliqué
      try {
        const { recalculateProductPrices } = await import("../lib/discount/recalculatePrices.js");
        await recalculateProductPrices(shop, admin, campaign.id);
      } catch (error) {
        console.error("Erreur lors du recalcul des prix:", error);
        // On continue même si le recalcul échoue
      }

      return { success: true, intent: "create" };
    } catch (error) {
      console.error("Error creating campaign:", error);
      return { error: "Error creating campaign", intent: "create" };
    }
  }

  if (intent === "toggle-active") {
    const campaignId = formData.get("campaignId");
    const { updateCampaign, getCampaign } = await import("../models/campaign.js");
    const campaign = await getCampaign(campaignId);
    if (!campaign || campaign.shop !== shop) {
      return { error: "Campaign not found", intent: "toggle-active" };
    }
    
    // IMPORTANT: Récupérer les produits/collections AVANT de désactiver la campagne
    // pour pouvoir recalculer les prix correctement
    const productIds = campaign.products.map(p => p.productId);
    const collectionIds = campaign.collections.map(c => c.collectionId);
    
    const newActiveState = !campaign.active;
    
    // Si on désactive la campagne, recalculer AVANT de mettre à jour
    // Si on active la campagne, mettre à jour puis recalculer
    if (!newActiveState) {
      // Désactivation : recalculer AVANT de mettre à jour pour restaurer les prix
      try {
        const { recalculateProductPrices } = await import("../lib/discount/recalculatePrices.js");
        await recalculateProductPrices(shop, admin, campaignId);
      } catch (error) {
        console.error("Erreur lors du recalcul des prix avant désactivation:", error);
      }
    }
    
    // Mettre à jour le statut de la campagne
    await updateCampaign(campaignId, { active: newActiveState });
    
    // Si on active la campagne, recalculer APRÈS la mise à jour
    if (newActiveState) {
      try {
        const { recalculateProductPrices } = await import("../lib/discount/recalculatePrices.js");
        await recalculateProductPrices(shop, admin, campaignId);
      } catch (error) {
        console.error("Erreur lors du recalcul des prix après activation:", error);
      }
    }
    
    return { success: true, intent: "toggle-active" };
  }

  if (intent === "update") {
    const campaignId = formData.get("campaignId");
    const name = formData.get("name");
    const description = formData.get("description");
    const discountType = formData.get("discountType");
    const discountValue = formData.get("discountValue");
    const instock = formData.get("instock") === "on";
    const tracking = formData.get("tracking") === "on";
    const startDate = formData.get("startDate") || null;
    const endDate = formData.get("endDate") || null;

    if (!name || !discountType || !discountValue) {
      return { error: "Please fill in all required fields", intent: "update" };
    }

    try {
      const { updateCampaign, getCampaign, removeProductsFromCampaign, removeCollectionsFromCampaign, addProductsToCampaign, addCollectionsToCampaign } = await import("../models/campaign.js");
      const campaign = await getCampaign(campaignId);
      if (!campaign || campaign.shop !== shop) {
        return { error: "Campaign not found", intent: "update" };
      }

      // Mettre à jour la campagne
      await updateCampaign(campaignId, {
        name,
        description: description || null,
        discountType,
        discountValue: parseFloat(discountValue),
        instock,
        tracking,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      });

      // Supprimer tous les produits et collections existants
      if (campaign.products.length > 0) {
        await removeProductsFromCampaign(campaignId, campaign.products.map(p => p.productId));
      }
      if (campaign.collections.length > 0) {
        await removeCollectionsFromCampaign(campaignId, campaign.collections.map(c => c.collectionId));
      }

      // Ajouter les nouveaux produits sélectionnés
      // Utiliser JSON pour récupérer les tableaux
      let productIds = [];
      const productsJson = formData.get("productsJson");
      if (productsJson) {
        try {
          productIds = JSON.parse(productsJson);
        } catch (e) {
          console.error("Error parsing productsJson:", e);
        }
      }
      // Fallback sur FormData.getAll si JSON n'est pas disponible
      if (productIds.length === 0) {
        productIds = formData.getAll("products");
      }
      
      if (productIds.length > 0) {
        const products = productIds.map((productId) => ({
          productId: String(productId).trim(),
          variantId: null,
        }));
        await addProductsToCampaign(campaignId, products);
      }

      // Ajouter les nouvelles collections sélectionnées
      // Utiliser JSON pour récupérer les tableaux
      let selectedCollections = [];
      const collectionsJson = formData.get("collectionsJson");
      if (collectionsJson) {
        try {
          selectedCollections = JSON.parse(collectionsJson);
        } catch (e) {
          console.error("Error parsing collectionsJson:", e);
        }
      }
      // Fallback sur FormData.getAll si JSON n'est pas disponible
      if (selectedCollections.length === 0) {
        selectedCollections = formData.getAll("collections");
      }
      
      if (selectedCollections.length > 0) {
        const collections = selectedCollections.map((collectionId) => ({
          collectionId: String(collectionId).trim(),
        }));
        await addCollectionsToCampaign(campaignId, collections);
      }

      // Recalculer les prix pour tous les produits affectés par cette campagne
      // Cela garantit que les prix sont corrects avec toutes les campagnes actives
      // et que le prix le plus bas est toujours appliqué
      try {
        const { recalculateProductPrices } = await import("../lib/discount/recalculatePrices.js");
        await recalculateProductPrices(shop, admin, campaignId);
      } catch (error) {
        console.error("Erreur lors du recalcul des prix:", error);
        // On continue même si le recalcul échoue
      }

      return { success: true, intent: "update" };
    } catch (error) {
      console.error("Error updating campaign:", error);
      return { error: "Error updating campaign", intent: "update" };
    }
  }

  if (intent === "delete") {
    const campaignId = formData.get("campaignId");
    const { deleteCampaign, getCampaign } = await import("../models/campaign.js");
    const campaign = await getCampaign(campaignId);
    if (!campaign || campaign.shop !== shop) {
      return { error: "Campaign not found", intent: "delete" };
    }
    
    // Recalculer les prix AVANT de supprimer la campagne
    // pour restaurer les prix originaux ou appliquer les autres campagnes actives
    try {
      const { recalculateProductPrices } = await import("../lib/discount/recalculatePrices.js");
      await recalculateProductPrices(shop, admin, campaignId);
    } catch (error) {
      console.error("Erreur lors du recalcul des prix avant suppression:", error);
    }
    
    // Supprimer la campagne (cela supprimera aussi les prix lockés via onDelete: Cascade)
    await deleteCampaign(campaignId);
    
    return { success: true, intent: "delete" };
  }

  return { error: "Unknown action" };
};


export default function CampaignsPage() {
  const { campaigns, collections, products } = useLoaderData();
  const actionData = useActionData();
  const fetcher = useFetcher();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [instock, setInstock] = useState(false);
  const [tracking, setTracking] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [detailCampaign, setDetailCampaign] = useState(null);
  const [targetTab, setTargetTab] = useState(0); // 0 = Collections, 1 = Produits
  const [productSearch, setProductSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [popoverActive, setPopoverActive] = useState({});
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ campaignId: null, open: false });

  // Fonction pour réinitialiser le formulaire
  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setDiscountType("PERCENTAGE");
    setDiscountValue("");
    setInstock(false);
    setTracking(true);
    setSelectedProducts([]);
    setSelectedCollections([]);
    setStartDate("");
    setEndDate("");
    setProductSearch("");
    setCollectionSearch("");
    setTargetTab(0);
    setEditingCampaignId(null);
  }, []);

  // Réinitialiser le formulaire après succès de création
  useEffect(() => {
    if (actionData?.success && actionData?.intent === "create") {
      console.log("Campaign created successfully, reloading page...");
      resetForm();
      setShowCreateModal(false);
      // Utiliser fetcher.load() pour recharger les données au lieu de window.location.reload()
      // Cela évite de perdre l'état et permet de recharger uniquement les données
      setTimeout(() => {
        fetcher.load("/app/campaigns");
        // Recharger aussi la page complète pour être sûr
        window.location.reload();
      }, 1500); // Délai plus long pour s'assurer que la DB est à jour
    }
  }, [actionData, resetForm, fetcher]);

  // Réinitialiser le formulaire après succès d'édition
  useEffect(() => {
    if (actionData?.success && actionData?.intent === "update") {
      resetForm();
      setShowEditModal(false);
      // Recharger la page pour voir les modifications
      window.location.reload();
    }
  }, [actionData, resetForm]);

  // Recharger après toggle ou delete
  useEffect(() => {
    if (actionData?.success && (actionData?.intent === "toggle-active" || actionData?.intent === "delete")) {
      window.location.reload();
    }
  }, [actionData]);

  // Filtrer les produits et collections selon la recherche
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const searchLower = productSearch.toLowerCase();
    return products.filter((p) => p.title.toLowerCase().includes(searchLower));
  }, [products, productSearch]);

  const filteredCollections = useMemo(() => {
    if (!collectionSearch) return collections;
    const searchLower = collectionSearch.toLowerCase();
    return collections.filter((c) => c.title.toLowerCase().includes(searchLower));
  }, [collections, collectionSearch]);

  const handleToggleActive = useCallback((campaignId) => {
    const formData = new FormData();
    formData.append("intent", "toggle-active");
    formData.append("campaignId", campaignId);
    fetcher.submit(formData, { method: "post" });
    setPopoverActive({});
  }, [fetcher]);

  const handleDeleteClick = useCallback((campaignId) => {
    setDeleteConfirmModal({ campaignId, open: true });
    setPopoverActive({});
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirmModal.campaignId) {
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("campaignId", deleteConfirmModal.campaignId);
      fetcher.submit(formData, { method: "post" });
      setDeleteConfirmModal({ campaignId: null, open: false });
    }
  }, [deleteConfirmModal.campaignId, fetcher]);

  const handleCreateSubmit = useCallback(() => {
    console.log("handleCreateSubmit called with:", {
      selectedProducts,
      selectedCollections,
      productsCount: selectedProducts.length,
      collectionsCount: selectedCollections.length
    });
    
    // Utiliser JSON pour envoyer les données complexes (tableaux)
    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("name", name);
    formData.append("description", description);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    formData.append("instock", instock ? "on" : "off");
    formData.append("tracking", tracking ? "on" : "off");
    if (startDate) formData.append("startDate", startDate);
    if (endDate) formData.append("endDate", endDate);
    
    // Envoyer les produits et collections en JSON pour éviter les problèmes avec FormData
    formData.append("productsJson", JSON.stringify(selectedProducts));
    formData.append("collectionsJson", JSON.stringify(selectedCollections));
    
    console.log("Submitting campaign with:", {
      products: selectedProducts.length,
      collections: selectedCollections.length,
      productIds: selectedProducts,
      collectionIds: selectedCollections,
      productsJson: JSON.stringify(selectedProducts),
      collectionsJson: JSON.stringify(selectedCollections)
    });
    
    fetcher.submit(formData, { method: "post" });
  }, [name, description, discountType, discountValue, instock, tracking, startDate, endDate, selectedProducts, selectedCollections, fetcher]);

  const handleEditSubmit = useCallback(() => {
    if (!editingCampaignId) return;
    
    const formData = new FormData();
    formData.append("intent", "update");
    formData.append("campaignId", editingCampaignId);
    formData.append("name", name);
    formData.append("description", description);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    formData.append("instock", instock ? "on" : "off");
    formData.append("tracking", tracking ? "on" : "off");
    if (startDate) formData.append("startDate", startDate);
    if (endDate) formData.append("endDate", endDate);
    
        // Ajouter les produits et collections en JSON
        formData.append("productsJson", JSON.stringify(selectedProducts));
        formData.append("collectionsJson", JSON.stringify(selectedCollections));
    
    fetcher.submit(formData, { method: "post" });
  }, [editingCampaignId, name, description, discountType, discountValue, instock, tracking, startDate, endDate, selectedProducts, selectedCollections, fetcher]);

  const handleEditCampaign = useCallback((campaignId) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;
    
    setEditingCampaignId(campaignId);
    setName(campaign.name);
    setDescription(campaign.description || "");
    setDiscountType(campaign.discountType);
    setDiscountValue(campaign.discountValue.toString());
    setInstock(campaign.instock);
    setTracking(campaign.tracking);
    setStartDate(campaign.startDate ? new Date(campaign.startDate).toISOString().slice(0, 16) : "");
    setEndDate(campaign.endDate ? new Date(campaign.endDate).toISOString().slice(0, 16) : "");
    setSelectedProducts(campaign.products.map(p => p.productId));
    setSelectedCollections(campaign.collections.map(c => c.collectionId));
    setShowEditModal(true);
    setPopoverActive({});
  }, [campaigns]);

  const toggleProductSelection = useCallback((productId) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const toggleCollectionSelection = useCallback((collectionId) => {
    setSelectedCollections((prev) =>
      prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId]
    );
  }, []);

  const tabs = [
    {
      id: "collections",
      content: `Collections (${selectedCollections.length})`,
      panelID: "collections-panel",
    },
    {
      id: "products",
      content: `Products (${selectedProducts.length})`,
      panelID: "products-panel",
    },
  ];

  const handleViewCampaign = useCallback((campaignId) => {
    setSelectedCampaignId(campaignId);
    // Charger la campagne depuis les données déjà disponibles
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      setDetailCampaign(campaign);
    }
  }, [campaigns]);

  function getDiscountTypeLabel(type) {
    switch (type) {
      case "PERCENTAGE":
        return "Percentage";
      case "FIXED":
        return "Fixed Amount";
      case "FIXED_PRICE":
        return "Fixed Price";
      default:
        return type;
    }
  }

  // Composant pour ajouter le texte "Tout sélectionner" dans le header du ResourceList
  function SelectAllTextLabel({ containerId }) {
    useEffect(() => {
      const addSelectAllText = () => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const headerWrapper = container.querySelector('.Polaris-ResourceList__HeaderWrapper');
        if (!headerWrapper) return;

        // Vérifier si le texte existe déjà
        const existingText = headerWrapper.querySelector('.select-all-text-label');
        if (existingText) return;

        const checkableButtonWrapper = headerWrapper.querySelector('.Polaris-ResourceList__CheckableButtonWrapper');
        if (!checkableButtonWrapper) return;

        // Créer l'élément texte
        const textElement = document.createElement('span');
        textElement.className = 'select-all-text-label';
        textElement.textContent = 'Select All';
        textElement.style.fontWeight = 'bold';
        textElement.style.color = 'var(--p-text-subdued)';
        textElement.style.marginLeft = '12px';
        textElement.style.fontSize = '14px';
        textElement.style.display = 'inline-block';

        // Ajouter le texte après la checkbox wrapper
        checkableButtonWrapper.appendChild(textElement);
      };

      // Essayer immédiatement
      addSelectAllText();

      // Essayer après un court délai pour s'assurer que le DOM est rendu
      const timeout = setTimeout(addSelectAllText, 100);
      const timeout2 = setTimeout(addSelectAllText, 500);

      return () => {
        clearTimeout(timeout);
        clearTimeout(timeout2);
      };
    }, [containerId]);

    return null;
  }

  const handleOpenCreateModal = useCallback(() => {
    resetForm();
    setShowCreateModal(true);
  }, [resetForm]);

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, [resetForm]);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    resetForm();
  }, [resetForm]);

  const createModalMarkup = (
    <Modal
      open={showCreateModal}
      onClose={handleCloseCreateModal}
      title="New Campaign"
      primaryAction={{
        content: "Create",
        onAction: handleCreateSubmit,
        loading: fetcher.state === "submitting",
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: handleCloseCreateModal,
        },
      ]}
    >
      <Modal.Section>
        {(actionData?.error && actionData?.intent === "create") && (
          <Banner status="critical" onDismiss={() => {}}>
            <p>{actionData.error}</p>
          </Banner>
        )}
        <BlockStack gap="400">
          <FormLayout>
            <TextField
              label="Campaign Name"
              value={name}
              onChange={setName}
              requiredIndicator
              helpText="A descriptive name to identify this campaign"
              placeholder="Ex: Black Friday 2024"
            />
            
            <TextField
              label="Description"
              value={description}
              onChange={setDescription}
              multiline={3}
              helpText="Optional campaign description"
              placeholder="Describe the purpose of this campaign..."
            />
            
            <Select
              label="Discount Type"
              options={[
                { label: "Percentage (%)", value: "PERCENTAGE" },
                { label: "Fixed Amount (DKK)", value: "FIXED" },
                { label: "Fixed Price (DKK)", value: "FIXED_PRICE" },
              ]}
              value={discountType}
              onChange={setDiscountType}
              requiredIndicator
              helpText="Choose the type of discount to apply"
            />
            
            <TextField
              label="Value"
              type="number"
              step="0.01"
              value={discountValue}
              onChange={setDiscountValue}
              requiredIndicator
              helpText="Ex: 25 for 25%, or 100 for 100 DKK"
            />
            
            <Checkbox
              label="Instock"
              checked={instock}
              onChange={setInstock}
              helpText="Discount will only be active if the product is in stock"
            />
            
            <Checkbox
              label="Tracking"
              checked={tracking}
              onChange={setTracking}
              helpText="If enabled, discount will follow automatic price updates"
            />
            
            <TextField
              label="Start Date (optional)"
              type="datetime-local"
              value={startDate}
              onChange={setStartDate}
              helpText="Campaign start date and time"
            />
            
            <TextField
              label="End Date (optional)"
              type="datetime-local"
              value={endDate}
              onChange={setEndDate}
              helpText="Campaign end date and time"
            />
          </FormLayout>
          
          <Divider />
          
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">Campaign Targets</Text>
            <Text as="p" tone="subdued">
              Select the products and/or collections this campaign will apply to.
              You can leave this empty to create a campaign without targets (to assign later).
            </Text>
            
            <Tabs tabs={tabs} selected={targetTab} onSelect={setTargetTab}>
              {targetTab === 0 && (
                <Box paddingBlockStart="400">
                  <BlockStack gap="300">
                    <TextField
                      label="Search collections"
                      value={collectionSearch}
                      onChange={setCollectionSearch}
                      placeholder="Type to search..."
                      clearButton
                      onClearButtonClick={() => setCollectionSearch("")}
                    />
                    <Box id="collections-resource-list" maxHeight="400px" style={{ overflowY: "auto", border: "1px solid var(--p-border-subdued)", borderRadius: "6px" }}>
                      <SelectAllTextLabel containerId="collections-resource-list" />
                      <ResourceList
                        resourceName={{ singular: "collection", plural: "collections" }}
                        items={filteredCollections}
                        selectedItems={selectedCollections}
                        onSelectionChange={(selected) => {
                          setSelectedCollections(selected);
                        }}
                        selectable
                        renderItem={(item) => {
                          const { id, title, image, imageAlt } = item;
                          return (
                            <ResourceItem
                              id={id}
                              accessibilityLabel={`Collection ${title}`}
                              media={
                                <Thumbnail
                                  source={image || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
                                  alt={imageAlt || title}
                                  size="small"
                                />
                              }
                              name={title}
                            >
                              <Text variant="bodyMd" fontWeight="semibold" as="p">
                                {title}
                              </Text>
                            </ResourceItem>
                          );
                        }}
                      />
                    </Box>
                    {selectedCollections.length > 0 && (
                      <Box paddingBlockStart="300">
                        <Text variant="bodySm" fontWeight="semibold">Selected Collections ({selectedCollections.length}):</Text>
                        <BlockStack gap="300">
                          {selectedCollections.map((id) => {
                            const col = collections.find((c) => c.id === id);
                            return (
                              <Card key={id}>
                                <InlineStack gap="300" blockAlign="center">
                                  {col?.image && (
                                    <Thumbnail
                                      source={col.image}
                                      alt={col.imageAlt || col.title}
                                      size="small"
                                    />
                                  )}
                                  <Box>
                                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                                      {col?.title || id}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Button
                                      plain
                                      destructive
                                      onClick={() => toggleCollectionSelection(id)}
                                    >
                                      Remove
                                    </Button>
                                  </Box>
                                </InlineStack>
                              </Card>
                            );
                          })}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                </Box>
              )}
              
              {targetTab === 1 && (
                <Box paddingBlockStart="400">
                  <BlockStack gap="300">
                    <TextField
                      label="Search products"
                      value={productSearch}
                      onChange={setProductSearch}
                      placeholder="Type to search..."
                      clearButton
                      onClearButtonClick={() => setProductSearch("")}
                    />
                    <Box id="products-resource-list" maxHeight="400px" style={{ overflowY: "auto", border: "1px solid var(--p-border-subdued)", borderRadius: "6px", position: "relative" }}>
                      <SelectAllTextLabel containerId="products-resource-list" />
                      <ResourceList
                        resourceName={{ singular: "product", plural: "products" }}
                        items={filteredProducts}
                        selectedItems={selectedProducts}
                        onSelectionChange={(selected) => {
                          setSelectedProducts(selected);
                        }}
                        selectable
                        renderItem={(item) => {
                          const { id, title, featuredImage, imageAlt, defaultPrice } = item;
                          return (
                            <ResourceItem
                              id={id}
                              accessibilityLabel={`Product ${title}`}
                              media={
                                <Thumbnail
                                  source={featuredImage || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
                                  alt={imageAlt || title}
                                  size="medium"
                                />
                              }
                              name={title}
                            >
                              <BlockStack gap="100">
                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                  {title}
                                </Text>
                                {defaultPrice && (
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    {parseFloat(defaultPrice).toFixed(2)} DKK
                                  </Text>
                                )}
                              </BlockStack>
                            </ResourceItem>
                          );
                        }}
                      />
                    </Box>
                    {selectedProducts.length > 0 && (
                      <Box paddingBlockStart="300">
                        <Text variant="bodySm" fontWeight="semibold">Selected Products ({selectedProducts.length}):</Text>
                        <BlockStack gap="300">
                          {selectedProducts.map((id) => {
                            const product = products.find((p) => p.id === id);
                            return (
                              <Card key={id}>
                                <InlineStack gap="300" blockAlign="center">
                                  {product?.featuredImage && (
                                    <Thumbnail
                                      source={product.featuredImage}
                                      alt={product.imageAlt || product.title}
                                      size="small"
                                    />
                                  )}
                                  <Box>
                                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                                      {product?.title || id}
                                    </Text>
                                    {product?.defaultPrice && (
                                      <Text variant="bodySm" tone="subdued" as="p">
                                        Price: {parseFloat(product.defaultPrice).toFixed(2)} DKK
                                      </Text>
                                    )}
                                  </Box>
                                  <Box>
                                    <Button
                                      plain
                                      destructive
                                      onClick={() => toggleProductSelection(id)}
                                    >
                                      Remove
                                    </Button>
                                  </Box>
                                </InlineStack>
                              </Card>
                            );
                          })}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                </Box>
              )}
            </Tabs>
          </BlockStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );

  const editModalMarkup = (
    <Modal
      open={showEditModal}
      onClose={handleCloseEditModal}
      title="Edit Campaign"
      primaryAction={{
        content: "Save",
        onAction: handleEditSubmit,
        loading: fetcher.state === "submitting",
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: handleCloseEditModal,
        },
      ]}
    >
      <Modal.Section>
        {(actionData?.error && actionData?.intent === "update") && (
          <Banner status="critical" onDismiss={() => {}}>
            <p>{actionData.error}</p>
          </Banner>
        )}
        <BlockStack gap="400">
          <FormLayout>
            <TextField
              label="Campaign Name"
              value={name}
              onChange={setName}
              requiredIndicator
              helpText="A descriptive name to identify this campaign"
              placeholder="Ex: Black Friday 2024"
            />
            
            <TextField
              label="Description"
              value={description}
              onChange={setDescription}
              multiline={3}
              helpText="Optional campaign description"
              placeholder="Describe the purpose of this campaign..."
            />
            
            <Select
              label="Discount Type"
              options={[
                { label: "Percentage (%)", value: "PERCENTAGE" },
                { label: "Fixed Amount (DKK)", value: "FIXED" },
                { label: "Fixed Price (DKK)", value: "FIXED_PRICE" },
              ]}
              value={discountType}
              onChange={setDiscountType}
              requiredIndicator
              helpText="Choose the type of discount to apply"
            />
            
            <TextField
              label="Value"
              type="number"
              step="0.01"
              value={discountValue}
              onChange={setDiscountValue}
              requiredIndicator
              helpText="Ex: 25 for 25%, or 100 for 100 DKK"
            />
            
            <Checkbox
              label="Instock"
              checked={instock}
              onChange={setInstock}
              helpText="Discount will only be active if the product is in stock"
            />
            
            <Checkbox
              label="Tracking"
              checked={tracking}
              onChange={setTracking}
              helpText="If enabled, discount will follow automatic price updates"
            />
            
            <TextField
              label="Start Date (optional)"
              type="datetime-local"
              value={startDate}
              onChange={setStartDate}
              helpText="Campaign start date and time"
            />
            
            <TextField
              label="End Date (optional)"
              type="datetime-local"
              value={endDate}
              onChange={setEndDate}
              helpText="Campaign end date and time"
            />
          </FormLayout>
          
          <Divider />
          
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">Campaign Targets</Text>
            <Text as="p" tone="subdued">
              Select the products and/or collections this campaign will apply to.
              You can leave this empty to create a campaign without targets (to assign later).
            </Text>
            
            <Tabs tabs={tabs} selected={targetTab} onSelect={setTargetTab}>
              {targetTab === 0 && (
                <Box paddingBlockStart="400">
                  <BlockStack gap="300">
                    <TextField
                      label="Search collections"
                      value={collectionSearch}
                      onChange={setCollectionSearch}
                      placeholder="Type to search..."
                      clearButton
                      onClearButtonClick={() => setCollectionSearch("")}
                    />
                    <Box id="edit-collections-resource-list" maxHeight="400px" style={{ overflowY: "auto", border: "1px solid var(--p-border-subdued)", borderRadius: "6px" }}>
                      <SelectAllTextLabel containerId="edit-collections-resource-list" />
                      <ResourceList
                        resourceName={{ singular: "collection", plural: "collections" }}
                        items={filteredCollections}
                        selectedItems={selectedCollections}
                        onSelectionChange={(selected) => {
                          setSelectedCollections(selected);
                        }}
                        selectable
                        renderItem={(item) => {
                          const { id, title, image, imageAlt } = item;
                          return (
                            <ResourceItem
                              id={id}
                              accessibilityLabel={`Collection ${title}`}
                              media={
                                <Thumbnail
                                  source={image || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
                                  alt={imageAlt || title}
                                  size="small"
                                />
                              }
                              name={title}
                            >
                              <Text variant="bodyMd" fontWeight="semibold" as="p">
                                {title}
                              </Text>
                            </ResourceItem>
                          );
                        }}
                      />
                    </Box>
                    {selectedCollections.length > 0 && (
                      <Box paddingBlockStart="300">
                        <Text variant="bodySm" fontWeight="semibold">Selected Collections ({selectedCollections.length}):</Text>
                        <BlockStack gap="300">
                          {selectedCollections.map((id) => {
                            const col = collections.find((c) => c.id === id);
                            return (
                              <Card key={id}>
                                <InlineStack gap="300" blockAlign="center">
                                  {col?.image && (
                                    <Thumbnail
                                      source={col.image}
                                      alt={col.imageAlt || col.title}
                                      size="small"
                                    />
                                  )}
                                  <Box>
                                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                                      {col?.title || id}
                                    </Text>
                                  </Box>
                                  <Box>
                                    <Button
                                      plain
                                      destructive
                                      onClick={() => toggleCollectionSelection(id)}
                                    >
                                      Remove
                                    </Button>
                                  </Box>
                                </InlineStack>
                              </Card>
                            );
                          })}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                </Box>
              )}
              
              {targetTab === 1 && (
                <Box paddingBlockStart="400">
                  <BlockStack gap="300">
                    <TextField
                      label="Search products"
                      value={productSearch}
                      onChange={setProductSearch}
                      placeholder="Type to search..."
                      clearButton
                      onClearButtonClick={() => setProductSearch("")}
                    />
                    <Box id="edit-products-resource-list" maxHeight="400px" style={{ overflowY: "auto", border: "1px solid var(--p-border-subdued)", borderRadius: "6px", position: "relative" }}>
                      <SelectAllTextLabel containerId="edit-products-resource-list" />
                      <ResourceList
                        resourceName={{ singular: "product", plural: "products" }}
                        items={filteredProducts}
                        selectedItems={selectedProducts}
                        onSelectionChange={(selected) => {
                          setSelectedProducts(selected);
                        }}
                        selectable
                        renderItem={(item) => {
                          const { id, title, featuredImage, imageAlt, defaultPrice } = item;
                          return (
                            <ResourceItem
                              id={id}
                              accessibilityLabel={`Product ${title}`}
                              media={
                                <Thumbnail
                                  source={featuredImage || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
                                  alt={imageAlt || title}
                                  size="medium"
                                />
                              }
                              name={title}
                            >
                              <BlockStack gap="100">
                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                  {title}
                                </Text>
                                {defaultPrice && (
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    {parseFloat(defaultPrice).toFixed(2)} DKK
                                  </Text>
                                )}
                              </BlockStack>
                            </ResourceItem>
                          );
                        }}
                      />
                    </Box>
                    {selectedProducts.length > 0 && (
                      <Box paddingBlockStart="300">
                        <Text variant="bodySm" fontWeight="semibold">Selected Products ({selectedProducts.length}):</Text>
                        <BlockStack gap="300">
                          {selectedProducts.map((id) => {
                            const product = products.find((p) => p.id === id);
                            return (
                              <Card key={id}>
                                <InlineStack gap="300" blockAlign="center">
                                  {product?.featuredImage && (
                                    <Thumbnail
                                      source={product.featuredImage}
                                      alt={product.imageAlt || product.title}
                                      size="small"
                                    />
                                  )}
                                  <Box>
                                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                                      {product?.title || id}
                                    </Text>
                                    {product?.defaultPrice && (
                                      <Text variant="bodySm" tone="subdued" as="p">
                                        Price: {parseFloat(product.defaultPrice).toFixed(2)} DKK
                                      </Text>
                                    )}
                                  </Box>
                                  <Box>
                                    <Button
                                      plain
                                      destructive
                                      onClick={() => toggleProductSelection(id)}
                                    >
                                      Remove
                                    </Button>
                                  </Box>
                                </InlineStack>
                              </Card>
                            );
                          })}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                </Box>
              )}
            </Tabs>
          </BlockStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );

  const detailModalMarkup = detailCampaign && (
    <Modal
      open={selectedCampaignId !== null}
      onClose={() => {
        setSelectedCampaignId(null);
        setDetailCampaign(null);
      }}
      title={detailCampaign.name}
      primaryAction={{
        content: "Edit",
        onAction: () => {
          setSelectedCampaignId(null);
          setDetailCampaign(null);
          handleEditCampaign(detailCampaign.id);
        },
      }}
      secondaryActions={[
        {
          content: "Close",
          onAction: () => {
            setSelectedCampaignId(null);
            setDetailCampaign(null);
          },
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Badge status={detailCampaign.active ? "success" : "info"}>
              {detailCampaign.active ? "Active" : "Inactive"}
            </Badge>
            <Badge>{getDiscountTypeLabel(detailCampaign.discountType)}</Badge>
            <Text variant="headingMd" tone="subdued">
              {formatDiscountValue(detailCampaign.discountType, detailCampaign.discountValue)}
            </Text>
            {detailCampaign.instock && <Badge>Instock</Badge>}
            {!detailCampaign.tracking && <Badge tone="warning">Price Locked</Badge>}
          </InlineStack>

          {detailCampaign.description && (
            <>
              <Divider />
              <Text as="p" tone="subdued">{detailCampaign.description}</Text>
            </>
          )}

          <Divider />

          <BlockStack gap="200">
            <Text variant="headingSm" as="h3">Information</Text>
            <Text as="p">
              <strong>Created:</strong> {new Date(detailCampaign.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text as="p">
              <strong>Updated:</strong> {new Date(detailCampaign.updatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text as="p">
              <strong>Targets:</strong> {detailCampaign.products.length} {detailCampaign.products.length === 1 ? "product" : "products"} •{" "}
              {detailCampaign.collections.length} {detailCampaign.collections.length === 1 ? "collection" : "collections"}
            </Text>
            {detailCampaign.startDate && (
              <Text as="p">
                <strong>Start Date:</strong> {new Date(detailCampaign.startDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
            {detailCampaign.endDate && (
              <Text as="p">
                <strong>End Date:</strong> {new Date(detailCampaign.endDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </BlockStack>

          {detailCampaign.products.length > 0 && (
            <>
              <Divider />
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Products ({detailCampaign.products.length})</Text>
                {detailCampaign.products.map((product) => {
                  const productInfo = products.find((p) => p.id === product.productId);
                  return (
                    <Text key={product.id} as="p" tone="subdued">
                      {productInfo ? productInfo.title : product.productId}
                      {product.variantId && ` - Variant: ${product.variantId}`}
                    </Text>
                  );
                })}
              </BlockStack>
            </>
          )}

          {detailCampaign.collections.length > 0 && (
            <>
              <Divider />
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Collections ({detailCampaign.collections.length})</Text>
                {detailCampaign.collections.map((collection) => {
                  const collectionInfo = collections.find((c) => c.id === collection.collectionId);
                  return (
                    <Text key={collection.id} as="p" tone="subdued">
                      {collectionInfo ? collectionInfo.title : collection.collectionId}
                    </Text>
                  );
                })}
              </BlockStack>
            </>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );

  return (
    <Page
      title="Discount Campaigns"
      primaryAction={{
        content: "New Campaign",
        onAction: handleOpenCreateModal,
      }}
    >
      {createModalMarkup}
      {editModalMarkup}
      {detailModalMarkup}
      
      <Modal
        open={deleteConfirmModal.open}
        onClose={() => setDeleteConfirmModal({ campaignId: null, open: false })}
        title="Delete Campaign"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: handleDeleteConfirm,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setDeleteConfirmModal({ campaignId: null, open: false }),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete this campaign? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
      
      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            heading="Create your first campaign"
            action={{
              content: "Create Campaign",
              onAction: handleOpenCreateModal,
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Discount campaigns allow you to manage reductions on your products 
              with advanced price calculation logic.
            </p>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <BlockStack gap="400">
            {campaigns.map((campaign) => {
              // S'assurer que products et collections sont bien des tableaux
              const productsArray = Array.isArray(campaign.products) ? campaign.products : [];
              const collectionsArray = Array.isArray(campaign.collections) ? campaign.collections : [];
              const targetCount = productsArray.length + collectionsArray.length;
              
              // Log pour déboguer
              if (targetCount === 0 && (productsArray.length > 0 || collectionsArray.length > 0)) {
                console.log("Campaign display debug:", {
                  id: campaign.id,
                  name: campaign.name,
                  products: campaign.products,
                  collections: campaign.collections,
                  productsArray,
                  collectionsArray,
                  targetCount
                });
              }
              
              return (
                <Box key={campaign.id} paddingBlockStart="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Button plain onClick={() => handleViewCampaign(campaign.id)}>
                          <Text variant="headingMd" as="span">
                            {campaign.name}
                          </Text>
                        </Button>
                        {campaign.active ? (
                          <Badge status="success">Active</Badge>
                        ) : (
                          <Badge>Inactive</Badge>
                        )}
                        {campaign.startDate && (
                          <Badge tone="info">
                            From {new Date(campaign.startDate).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })}
                          </Badge>
                        )}
                        {campaign.endDate && (
                          <Badge tone="info">
                            Until {new Date(campaign.endDate).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })}
                          </Badge>
                        )}
                      </InlineStack>
                      <InlineStack gap="200">
                        <Popover
                          active={popoverActive[campaign.id] || false}
                          activator={
                            <Button
                              onClick={() => setPopoverActive({ [campaign.id]: !popoverActive[campaign.id] })}
                              disclosure
                            >
                              Actions
                            </Button>
                          }
                          onClose={() => setPopoverActive({})}
                        >
                          <ActionList
                            items={[
                              {
                                content: "Edit",
                                onAction: () => handleEditCampaign(campaign.id),
                              },
                              {
                                content: campaign.active ? "Deactivate" : "Activate",
                                onAction: () => handleToggleActive(campaign.id),
                              },
                              {
                                content: "Delete",
                                destructive: true,
                                onAction: () => handleDeleteClick(campaign.id),
                              },
                            ]}
                          />
                        </Popover>
                        <Button plain onClick={() => handleViewCampaign(campaign.id)}>
                          View
                        </Button>
                      </InlineStack>
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
                      {!campaign.tracking && <Badge tone="warning">Price Locked</Badge>}
                      <Text tone="subdued">
                        {targetCount} {targetCount === 1 ? "target" : "targets"}
                      </Text>
                    </InlineStack>
                    
                    <Text tone="subdued" variant="bodySm">
                      Created on {new Date(campaign.createdAt).toLocaleDateString("en-US", {
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
