// Medusa entrega los montos como objetos BigNumber ({ numeric }). Los módulos de la tienda trabajan
// con números simples (CLP entero), así que se convierten al cargar los datos.
export const toNumber = (value: unknown): number => {
  if (typeof value === "object" && value !== null && "numeric" in value) {
    return Number((value as { numeric: number }).numeric)
  }
  return Number(value ?? 0)
}
