import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createProductCategoriesWorkflow,
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  deleteCollectionsWorkflow,
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
  deleteRegionsWorkflow,
  deleteShippingOptionsWorkflow,
  deleteStockLocationsWorkflow,
  deleteTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

// Valores iniciales: USD 3 (Santiago) y USD 6 (regiones) al TC referencial, mas $1.000.
// Los reemplaza el job shipping-prices-sync con el tipo de cambio del dia.
const SHIPPING_SANTIAGO_CLP = 3850;
const SHIPPING_REGIONES_CLP = 6700;

// ISO 3166-2:CL — Región Metropolitana vs. las otras 15 regiones.
const PROVINCE_RM = "cl-rm";
const PROVINCES_REGIONES = [
  "cl-ai", "cl-an", "cl-ap", "cl-ar", "cl-at", "cl-bi", "cl-co", "cl-li",
  "cl-ll", "cl-lr", "cl-ma", "cl-ml", "cl-nb", "cl-ta", "cl-vs",
];

const CATEGORIES: { name: string; handle: string; children: [string, string][] }[] = [
  {
    name: "Gaming",
    handle: "gaming",
    children: [
      ["Tarjetas de video", "tarjetas-de-video"],
      ["Procesadores", "procesadores"],
      ["Placas madre", "placas-madre"],
      ["Memoria RAM", "memoria-ram"],
      ["Almacenamiento", "almacenamiento"],
      ["Fuentes de poder", "fuentes-de-poder"],
      ["Gabinetes", "gabinetes"],
      ["Refrigeración", "refrigeracion"],
      ["Monitores gamer", "monitores-gamer"],
      ["Teclados", "teclados"],
      ["Mouse", "mouse"],
      ["Audífonos", "audifonos"],
      ["Sillas gamer", "sillas-gamer"],
    ],
  },
  {
    name: "PC y Notebooks",
    handle: "pc-y-notebooks",
    children: [
      ["Notebooks", "notebooks"],
      ["Computadores de escritorio", "computadores-de-escritorio"],
      ["Monitores", "monitores"],
      ["Impresoras", "impresoras"],
      ["Accesorios", "accesorios"],
    ],
  },
  {
    name: "Redes",
    handle: "redes",
    children: [
      ["Routers", "routers"],
      ["Switches", "switches"],
      ["Access Points", "access-points"],
      ["Cableado estructurado", "cableado-estructurado"],
    ],
  },
  {
    name: "Seguridad y CCTV",
    handle: "seguridad-y-cctv",
    children: [
      ["Cámaras IP", "camaras-ip"],
      ["Grabadores NVR/DVR", "grabadores-nvr-dvr"],
      ["Control de acceso", "control-de-acceso"],
      ["Alarmas", "alarmas"],
    ],
  },
];

export default async function setupChile({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillment = container.resolve(Modules.FULFILLMENT);
  const pricing = container.resolve(Modules.PRICING);

  const ids = async (entity: string) =>
    (await query.graph({ entity, fields: ["id"] })).data.map((r: any) => r.id);

  const {
    data: [store],
  } = await query.graph({
    entity: "store",
    fields: ["id", "default_sales_channel_id"],
  });
  const salesChannelId = store.default_sales_channel_id as string;

  // Este script borra productos, categorías, regiones y despachos: solo corre sobre una tienda sin configurar.
  const chile = (await query.graph({ entity: "region", fields: ["id", "name"], filters: { name: "Chile" } })).data
  if (chile.length && process.env.SETUP_FORCE !== "true") {
    logger.warn("La tienda ya está configurada (existe la región Chile): no se borra nada. Usa SETUP_FORCE=true solo si es intencional.")
    return
  }

  logger.info("Limpiando datos de demostración...");
  const productIds = await ids("product");
  if (productIds.length) {
    await deleteProductsWorkflow(container).run({ input: { ids: productIds } });
  }
  const collectionIds = await ids("product_collection");
  if (collectionIds.length) {
    await deleteCollectionsWorkflow(container).run({ input: { ids: collectionIds } });
  }
  const categoryIds = await ids("product_category");
  if (categoryIds.length) {
    await deleteProductCategoriesWorkflow(container).run({ input: categoryIds });
  }
  const shippingOptionIds = await ids("shipping_option");
  if (shippingOptionIds.length) {
    await deleteShippingOptionsWorkflow(container).run({ input: { ids: shippingOptionIds } });
  }
  const stockLocationIds = await ids("stock_location");
  if (stockLocationIds.length) {
    await deleteStockLocationsWorkflow(container).run({ input: { ids: stockLocationIds } });
  }
  const oldFulfillmentSets = await ids("fulfillment_set");
  if (oldFulfillmentSets.length) {
    await fulfillment.deleteFulfillmentSets(oldFulfillmentSets);
  }
  const regionIds = (
    await query.graph({ entity: "region", fields: ["id", "name"] })
  ).data
    .filter((r: any) => r.name !== "Chile")
    .map((r: any) => r.id);
  if (regionIds.length) {
    await deleteRegionsWorkflow(container).run({ input: { ids: regionIds } });
  }
  const taxRegionIds = (
    await query.graph({ entity: "tax_region", fields: ["id", "country_code"] })
  ).data
    .filter((t: any) => t.country_code !== "cl")
    .map((t: any) => t.id);
  if (taxRegionIds.length) {
    await deleteTaxRegionsWorkflow(container).run({ input: { ids: taxRegionIds } });
  }

  logger.info("Configurando moneda CLP...");
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Cyprotech",
        supported_currencies: [
          { currency_code: "clp", is_default: true },
          { currency_code: "usd" },
        ],
      },
    },
  });

  logger.info("Creando región Chile...");
  let {
    data: [region],
  } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { name: "Chile" },
  });
  if (!region) {
    ({
      result: [region],
    } = (await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Chile",
            currency_code: "clp",
            countries: ["cl"],
            // Flow es el medio de pago real; el manual solo sirve para pruebas y no se ofrece en producción.
            payment_providers:
              process.env.NODE_ENV === "production" ? ["pp_flow_flow"] : ["pp_flow_flow", "pp_system_default"],
          },
        ],
      },
    })) as unknown as { result: (typeof region)[] });
  }

  const { data: existingTax } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
    filters: { country_code: "cl" },
  });
  if (!existingTax.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "cl",
          provider_id: "tp_system",
          default_tax_rate: { name: "IVA", code: "iva", rate: 19 },
        },
      ],
    });
  }

  // Los precios publicados son con IVA incluido. Medusa crea la preferencia
  // al crear la región; solo se marca como tax-inclusive.
  const [preference] = await pricing.listPricePreferences({
    attribute: "region_id",
    value: region.id,
  });
  if (preference) {
    await pricing.updatePricePreferences(preference.id, { is_tax_inclusive: true });
  } else {
    await pricing.createPricePreferences({
      attribute: "region_id",
      value: region.id,
      is_tax_inclusive: true,
    });
  }

  // También a nivel de moneda: los precios en CLP se cargan siempre con IVA incluido.
  const [currencyPreference] = await pricing.listPricePreferences({
    attribute: "currency_code",
    value: "clp",
  });
  if (currencyPreference) {
    await pricing.updatePricePreferences(currencyPreference.id, { is_tax_inclusive: true });
  } else {
    await pricing.createPricePreferences({
      attribute: "currency_code",
      value: "clp",
      is_tax_inclusive: true,
    });
  }

  logger.info("Creando bodega y zonas de despacho...");
  const {
    result: [stockLocation],
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: "Intcomex (despacho directo)",
          address: { city: "Santiago", country_code: "CL", address_1: "" },
        },
      ],
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });

  const {
    data: [shippingProfile],
  } = await query.graph({ entity: "shipping_profile", fields: ["id"] });

  const fulfillmentSet = await fulfillment.createFulfillmentSets({
    name: "Despacho Intcomex",
    type: "shipping",
    service_zones: [
      {
        name: "Santiago (RM)",
        geo_zones: [{ country_code: "cl", type: "province", province_code: PROVINCE_RM }],
      },
      {
        name: "Regiones",
        geo_zones: PROVINCES_REGIONES.map((province_code) => ({
          country_code: "cl",
          type: "province" as const,
          province_code,
        })),
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });

  const rules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
    { attribute: "is_return", value: "false", operator: "eq" as const },
  ];
  const [zoneRM, zoneRegiones] = fulfillmentSet.service_zones;

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Despacho Santiago",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: zoneRM.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Santiago",
          description: "2-4 días hábiles.",
          code: "santiago",
        },
        prices: [{ currency_code: "clp", amount: SHIPPING_SANTIAGO_CLP }],
        rules,
      },
      {
        name: "Despacho Regiones",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: zoneRegiones.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Regiones",
          description: "4-6 días hábiles.",
          code: "regiones",
        },
        prices: [{ currency_code: "clp", amount: SHIPPING_REGIONES_CLP }],
        rules,
      },
    ],
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannelId] },
  });

  logger.info("Creando categorías...");
  const { result: parents } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: CATEGORIES.map((c) => ({
        name: c.name,
        handle: c.handle,
        is_active: true,
      })),
    },
  });
  await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: CATEGORIES.flatMap((c, i) =>
        c.children.map(([name, handle]) => ({
          name,
          handle,
          is_active: true,
          parent_category_id: parents[i].id,
        }))
      ),
    },
  });

  logger.info("Región Chile lista (CLP, IVA 19% incluido, 2 zonas de despacho).");
}
