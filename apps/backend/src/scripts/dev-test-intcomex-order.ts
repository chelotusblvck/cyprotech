import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrdersWorkflow } from "@medusajs/medusa/core-flows"

import { INTCOMEX_MODULE } from "../modules/intcomex"
import type IntcomexModuleService from "../modules/intcomex/service"
import { placeIntcomexOrderWorkflow } from "../workflows/place-intcomex-order"

// Prueba local: crea un pedido en Medusa con dos productos del catálogo y lo coloca en Intcomex
// (cliente simulado si no hay credenciales). Uso: npx medusa exec ./src/scripts/dev-test-intcomex-order.ts
export default async function devTestIntcomexOrder({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)

  const rows = await service.listIntcomexProducts({ sku: ["MK001GPU02", "MK011MS01"] })
  const {
    data: [region],
  } = await query.graph({ entity: "region", fields: ["id"], filters: { name: "Chile" } })
  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] })

  const { result: order } = await createOrdersWorkflow(container).run({
    input: {
      region_id: region.id,
      email: "cliente.prueba@example.com",
      currency_code: "clp",
      sales_channel_id: store.default_sales_channel_id as string,
      shipping_address: {
        first_name: "Ana",
        last_name: "Pérez",
        address_1: "Av. Providencia 1234",
        address_2: "Depto 56",
        city: "Providencia",
        province: "Región Metropolitana",
        postal_code: "7500000",
        country_code: "cl",
        phone: "+56912345678",
      },
      items: rows.map((row) => ({
        variant_id: row.medusa_variant_id as string,
        title: row.description,
        quantity: 1,
        unit_price: row.public_price as number,
      })),
      shipping_methods: [{ name: "Despacho Santiago", amount: 2900 }],
      metadata: { rut: "12.345.678-5" },
    },
  })
  logger.info(`Pedido de prueba creado: ${order.id} (#${order.display_id})`)

  const first = await placeIntcomexOrderWorkflow(container).run({ input: { orderId: order.id } })
  logger.info(`1) colocar: ${JSON.stringify(first.result)}`)
  const second = await placeIntcomexOrderWorkflow(container).run({ input: { orderId: order.id } })
  logger.info(`2) colocar de nuevo (idempotente): ${JSON.stringify(second.result)}`)

  const [record] = await service.listIntcomexOrders({ medusa_order_id: order.id })
  logger.info(`Registro: ${JSON.stringify({ state: record.state, number: record.intcomex_order_number, snapshots: record.price_snapshots })}`)
}
