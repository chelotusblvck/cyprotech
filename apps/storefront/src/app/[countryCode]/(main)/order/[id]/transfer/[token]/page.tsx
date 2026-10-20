import { Heading, Text } from "@modules/common/components/ui"
import TransferActions from "@modules/order/components/transfer-actions"
import TransferImage from "@modules/order/components/transfer-image"

export default async function TransferPage({
  params,
}: {
  params: { id: string; token: string }
}) {
  const { id, token } = params

  return (
    <div className="flex flex-col gap-y-4 items-start w-2/5 mx-auto mt-10 mb-20">
      <TransferImage />
      <div className="flex flex-col gap-y-6">
        <Heading level="h1" className="text-xl text-zinc-900">
          Transfer request for order {id}
        </Heading>
        <Text className="text-zinc-600">
          You&#39;ve received a request to transfer ownership of your order ({id}).
          Si estás de acuerdo con esta solicitud, puedes aprobar la transferencia con el botón de abajo.
        </Text>
        <div className="w-full h-px bg-zinc-200" />
        <Text className="text-zinc-600">
          Si aceptas, el nuevo titular asumirá todas las responsabilidades y permisos asociados a este pedido.
        </Text>
        <Text className="text-zinc-600">
          Si no reconoces esta solicitud o quieres conservar la titularidad, no necesitas hacer nada más.
        </Text>
        <div className="w-full h-px bg-zinc-200" />
        <TransferActions id={id} token={token} />
      </div>
    </div>
  )
}
