import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { sendStaffInvite } from "../lib/emails/send"

// Medusa emite invite.created al invitar desde Settings > Users y invite.resent al reenviar (con token nuevo).
// El correo lleva el enlace donde la persona crea su clave; si el envío falla, sendEmail lo registra y la
// invitación sigue válida (el enlace se puede copiar desde el admin).
export default async function staffInviteEmailHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await sendStaffInvite(container, data.id)
}

export const config: SubscriberConfig = {
  event: ["invite.created", "invite.resent"],
}
