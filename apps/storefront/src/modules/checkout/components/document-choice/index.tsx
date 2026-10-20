"use client"

import { normalizeRut } from "@lib/util/rut"
import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import { clx } from "@modules/common/components/ui"
import React, { useState } from "react"

type DocumentMeta = {
  type?: "boleta" | "factura"
  rut?: string
  razonSocial?: string
  giro?: string
  direccion?: string
  comuna?: string
}

const OPTIONS = [
  {
    value: "boleta",
    title: "Boleta",
    text: "Para compras personales. El RUT es opcional.",
  },
  {
    value: "factura",
    title: "Factura",
    text: "Para empresas. Necesitamos los datos tributarios.",
  },
] as const

// Qué documento tributario quiere el cliente. Se envía junto con la dirección y se guarda en el
// carrito; al confirmarse el pago se emite la boleta o la factura electrónica.
const DocumentChoice = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const saved = ((cart?.metadata as { document?: DocumentMeta } | null)?.document ?? {}) as DocumentMeta
  const [type, setType] = useState<"boleta" | "factura">(saved.type ?? "boleta")
  const [rut, setRut] = useState(saved.rut ?? "")
  const rutInvalid = rut.trim() !== "" && normalizeRut(rut) === null

  return (
    <div className="mt-8">
      <h3 className="mb-1 font-display text-xl font-semibold uppercase tracking-wide text-ui-fg-base">
        Documento tributario
      </h3>
      <p className="mb-4 text-small-regular text-ui-fg-subtle">
        Te lo enviamos por correo apenas confirmemos tu pago.
      </p>

      <div role="radiogroup" className="grid gap-3 small:grid-cols-2">
        {OPTIONS.map((option) => {
          const active = type === option.value
          return (
            <label
              key={option.value}
              className={clx(
                "glow-hover flex cursor-pointer flex-col gap-1 rounded-rounded border px-5 py-4",
                active ? "border-vio-300 bg-vio-900/30 glow-violet" : "border-ui-border-base bg-ui-bg-base"
              )}
            >
              <input
                type="radio"
                name="document_type"
                value={option.value}
                checked={active}
                onChange={() => setType(option.value)}
                className="sr-only"
                data-testid={`document-${option.value}`}
              />
              <span className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-ui-fg-base">
                <span
                  className={clx(
                    "inline-block h-3 w-3 rounded-full border",
                    active ? "border-neon-magenta bg-neon-magenta shadow-[0_0_8px_#ff2bd6]" : "border-ui-border-strong"
                  )}
                  aria-hidden="true"
                />
                {option.title}
              </span>
              <span className="text-small-regular text-ui-fg-subtle">{option.text}</span>
            </label>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 small:grid-cols-2">
        <div>
          <Input
            label={type === "factura" ? "RUT de la empresa" : "RUT (opcional)"}
            name="document_rut"
            value={rut}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRut(event.target.value)}
            required={type === "factura"}
            autoComplete="off"
            data-testid="document-rut-input"
          />
          {rutInvalid ? (
            <p className="mt-1 text-small-regular text-ui-fg-error" data-testid="document-rut-error">
              Revisa el RUT: el dígito verificador no coincide.
            </p>
          ) : null}
        </div>

        {type === "factura" ? (
          <>
            <Input
              label="Razón social"
              name="document_razon_social"
              defaultValue={saved.razonSocial ?? ""}
              required
              autoComplete="organization"
              data-testid="document-razon-social-input"
            />
            <Input
              label="Giro"
              name="document_giro"
              defaultValue={saved.giro ?? ""}
              required
              data-testid="document-giro-input"
            />
            <Input
              label="Dirección de la empresa"
              name="document_direccion"
              defaultValue={saved.direccion ?? ""}
              required
              data-testid="document-direccion-input"
            />
            <Input
              label="Comuna"
              name="document_comuna"
              defaultValue={saved.comuna ?? ""}
              required
              data-testid="document-comuna-input"
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

export default DocumentChoice
