import { Metadata } from "next"
import { Suspense } from "react"

import VerifyAccount from "@modules/account/components/verify-account"

export const metadata: Metadata = {
  title: "Verifica tu correo",
  description: "Verifica tu correo para completar tu registro.",
}

export default function VerifyAccountPage() {
  return (
    <div className="w-full flex justify-center px-8 py-12">
      <Suspense
        fallback={
          <p className="text-base-regular text-ui-fg-base">
            Verificando tu correo...
          </p>
        }
      >
        <VerifyAccount />
      </Suspense>
    </div>
  )
}
