// Regiones de Chile por código ISO 3166-2 en minúscula (el que guardan las direcciones de la tienda).
export const CHILE_REGIONS: Record<string, string> = {
  "cl-ap": "Arica y Parinacota",
  "cl-ta": "Tarapacá",
  "cl-an": "Antofagasta",
  "cl-at": "Atacama",
  "cl-co": "Coquimbo",
  "cl-vs": "Valparaíso",
  "cl-rm": "Región Metropolitana de Santiago",
  "cl-li": "Libertador General Bernardo O'Higgins",
  "cl-ml": "Maule",
  "cl-nb": "Ñuble",
  "cl-bi": "Biobío",
  "cl-ar": "La Araucanía",
  "cl-lr": "Los Ríos",
  "cl-ll": "Los Lagos",
  "cl-ai": "Aysén del General Carlos Ibáñez del Campo",
  "cl-ma": "Magallanes y de la Antártica Chilena",
}

// "cl-rm" -> nombre. Si no es un código conocido devuelve el texto tal cual.
export const regionName = (province?: string | null) =>
  province ? (CHILE_REGIONS[province.toLowerCase()] ?? province) : undefined
