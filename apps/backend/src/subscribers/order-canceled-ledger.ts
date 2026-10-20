import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { LEDGER_MODULE } from "../modules/ledger"
import { reverseOrder } from "../modules/ledger/operations"
import type LedgerModuleService from "../modules/ledger/service"

// Un pedido cancelado deja de contar en el ledger: se anula si aún no se reconocía su utilidad
// o se registra una reversa si ya estaba reconocida.
export default async function orderCanceledLedgerHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const ledger: LedgerModuleService = container.resolve(LEDGER_MODULE)
  await reverseOrder(ledger, data.id)
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
