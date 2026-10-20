// Regiones de Chile con su código ISO 3166-2 en minúscula. Ese código es el que usan las zonas de
// despacho de la tienda (ver setup-chile): si el cliente escribe la región a mano no hay despacho.
export const CHILE_REGIONS: { code: string; name: string }[] = [
  { code: "cl-ap", name: "Arica y Parinacota" },
  { code: "cl-ta", name: "Tarapacá" },
  { code: "cl-an", name: "Antofagasta" },
  { code: "cl-at", name: "Atacama" },
  { code: "cl-co", name: "Coquimbo" },
  { code: "cl-vs", name: "Valparaíso" },
  { code: "cl-rm", name: "Región Metropolitana de Santiago" },
  { code: "cl-li", name: "Libertador General Bernardo O'Higgins" },
  { code: "cl-ml", name: "Maule" },
  { code: "cl-nb", name: "Ñuble" },
  { code: "cl-bi", name: "Biobío" },
  { code: "cl-ar", name: "La Araucanía" },
  { code: "cl-lr", name: "Los Ríos" },
  { code: "cl-ll", name: "Los Lagos" },
  { code: "cl-ai", name: "Aysén del General Carlos Ibáñez del Campo" },
  { code: "cl-ma", name: "Magallanes y de la Antártica Chilena" },
]

// "cl-rm" -> "Región Metropolitana de Santiago". Si no es un código conocido devuelve el texto tal cual.
export const regionLabel = (province?: string | null) => {
  if (!province) {
    return ""
  }
  return CHILE_REGIONS.find((region) => region.code === province.toLowerCase())?.name ?? province
}
