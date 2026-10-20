import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Alert, Badge, Button, Container, Heading, Input, Select, Table, Text, toast, usePrompt } from "@medusajs/ui"
import { useMemo, useState } from "react"

import { BarChart } from "../../components/bar-chart"
import { Tile, TileGrid } from "../../components/tile"
import { api, useApi } from "../../lib/api"
import { clp, dateTime, percent, shortDate } from "../../lib/format"

type Summary = {
  days: number
  kpis: {
    orders: number
    grossSales: number
    netSales: number
    avgTicket: number
    productRevenueNet: number
    grossMargin: number
    marginPercent: number
    expectedContribution: number
    gatewayFees: number
    pendingPlacement: number
  }
  daily: { date: string; orders: number; grossSales: number }[]
  recentOrders: {
    id: string
    displayId: number
    createdAt: string
    email: string | null
    total: number
    status: string
    intcomex: { state: string; number: string | null; status: string | null; error: string | null } | null
    ledger: { state: string; grossMargin?: number; contribution?: number } | null
    document: {
      id: string
      kind: string
      state: string
      folio: number | null
      siiStatus: string | null
      url: string | null
      error: string | null
      retryable: boolean
      emailed: boolean
      voided: boolean
    } | null
  }[]
  billing: { mode: "real" | "simulado"; environment: string | null; emisorConfigured: boolean; failed: number; pending: number }
  email: { configured: boolean; host: string | null; from: string | null }
  intcomex: {
    mode: "real" | "simulado"
    environment: string | null
    fx: { rate: number; date: string; source: string } | null
    lastRuns: { kind: string; status: string; started_at?: string; error?: string | null }[]
    catalogUnmapped: number
    catalogLowStock: number
    ordersFailed: number
  }
  alerts: { level: "critical" | "warning" | "info"; message: string }[]
}

const RUN_LABEL: Record<string, string> = { catalog: "Catálogo", prices: "Precios", inventory: "Inventario" }
const RUN_COLOR = { success: "green", failed: "red", running: "blue", never: "grey" } as const

const ICX_STATE = {
  placed: { label: "Colocado", color: "green" },
  pending: { label: "Colocando", color: "orange" },
  failed: { label: "Falló", color: "red" },
} as const

const LEDGER_STATE = {
  pending: { label: "Por reconocer", color: "grey" },
  earned: { label: "Reconocida", color: "green" },
  reversed: { label: "Revertida", color: "red" },
  void: { label: "Anulada", color: "grey" },
} as const

const DOC_LABEL: Record<string, string> = { boleta: "Boleta", factura: "Factura", nota_credito: "Nota de crédito" }

const alertVariant = { critical: "error", warning: "warning", info: "info" } as const

const DashboardPage = () => {
  const [days, setDays] = useState("30")
  const [busy, setBusy] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)
  const [testTo, setTestTo] = useState("")
  const prompt = usePrompt()
  const { data, error, loading, reload } = useApi<Summary>(`/admin/cyprotech/summary?days=${days}`, 60_000)

  const bars = useMemo(
    () =>
      (data?.daily ?? []).map((day) => ({
        key: day.date,
        label: shortDate(`${day.date}T12:00:00Z`),
        value: day.grossSales,
        detail: `${day.orders} pedido${day.orders === 1 ? "" : "s"}`,
      })),
    [data],
  )

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(success)
      await reload()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const sync = (kind: string, dryRun = false) =>
    run(
      `sync-${kind}-${dryRun}`,
      () => api("/admin/intcomex/sync", { method: "POST", body: { kind, dryRun } }),
      dryRun ? `Simulación de ${RUN_LABEL[kind].toLowerCase()} lista` : `Sincronización de ${RUN_LABEL[kind].toLowerCase()} iniciada`,
    )

  const place = (orderId: string) =>
    run(`place-${orderId}`, () => api(`/admin/intcomex/orders/${orderId}/place`, { method: "POST" }), "Pedido colocado en Intcomex")

  const issueDocument = (orderId: string, force = false) =>
    run(
      `doc-${orderId}`,
      () => api(`/admin/billing/orders/${orderId}/issue`, { method: "POST", body: { force } }),
      "Documento emitido",
    )

  const voidDocument = async (documentId: string, label: string) => {
    const ok = await prompt({
      title: `Anular ${label}`,
      description:
        "Se emite una nota de crédito que anula el documento ante el SII. Es una acción tributaria y no se puede deshacer.",
      confirmText: "Emitir nota de crédito",
      cancelText: "Cancelar",
    })
    if (ok) {
      await run(
        `void-${documentId}`,
        () =>
          api(`/admin/billing/documents/${documentId}/credit-note`, {
            method: "POST",
            body: { reason: "Anula documento por devolución" },
          }),
        "Nota de crédito emitida",
      )
    }
  }

  const sendTestEmail = () =>
    run(
      "test-email",
      () => api("/admin/notifications/test", { method: "POST", body: { to: testTo, template: "order-confirmed" } }),
      `Correo de prueba enviado a ${testTo}`,
    )

  if (error && !data) {
    return (
      <Container>
        <Alert variant="error">No se pudo cargar el dashboard: {error}</Alert>
      </Container>
    )
  }

  const kpis = data?.kpis

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-col gap-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Heading level="h1">Control Cyprotech</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Ventas, márgenes y pedidos de Intcomex en un solo lugar.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-[150px]">
              <Select value={days} onValueChange={setDays} size="small">
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {[
                    ["7", "Últimos 7 días"],
                    ["30", "Últimos 30 días"],
                    ["90", "Últimos 90 días"],
                    ["365", "Último año"],
                  ].map(([value, label]) => (
                    <Select.Item key={value} value={value}>
                      {label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <Button size="small" variant="secondary" onClick={() => reload()} isLoading={loading}>
              Actualizar
            </Button>
          </div>
        </div>

        {data?.alerts.length ? (
          <div className="flex flex-col gap-y-2">
            {data.alerts.map((alert) => (
              <Alert key={alert.message} variant={alertVariant[alert.level]}>
                {alert.message}
              </Alert>
            ))}
          </div>
        ) : null}

        <TileGrid>
          <Tile label="Ventas (con IVA)" value={clp(kpis?.grossSales)} hint={`${kpis?.orders ?? 0} pedidos`} />
          <Tile label="Ventas netas" value={clp(kpis?.netSales)} hint="Sin IVA" />
          <Tile label="Ticket promedio" value={clp(kpis?.avgTicket)} hint="Con IVA" />
          <Tile
            label="Margen bruto"
            value={clp(kpis?.grossMargin)}
            hint={`${percent(kpis?.marginPercent)} de la venta de productos`}
          />
          <Tile
            label="Comisión pasarela"
            value={clp(kpis?.gatewayFees)}
            hint="Estimada sobre lo cobrado"
          />
          <Tile
            label="Utilidad antes de costos fijos"
            value={clp(kpis?.expectedContribution)}
            tone={(kpis?.expectedContribution ?? 0) < 0 ? "negative" : "default"}
            hint="Margen menos comisión"
          />
        </TileGrid>
      </Container>

      <Container className="flex flex-col gap-y-3 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h2">Ventas por día</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              CLP, IVA incluido, hora de Chile
            </Text>
          </div>
          <Button size="small" variant="transparent" onClick={() => setShowTable((value) => !value)}>
            {showTable ? "Ver gráfico" : "Ver tabla"}
          </Button>
        </div>
        {showTable ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Día</Table.HeaderCell>
                <Table.HeaderCell>Pedidos</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Ventas</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {[...(data?.daily ?? [])]
                .reverse()
                .filter((day) => day.orders > 0)
                .map((day) => (
                  <Table.Row key={day.date}>
                    <Table.Cell>{day.date}</Table.Cell>
                    <Table.Cell>{day.orders}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{clp(day.grossSales)}</Table.Cell>
                  </Table.Row>
                ))}
            </Table.Body>
          </Table>
        ) : (
          <BarChart
            bars={bars}
            format={clp}
            ariaLabel={`Ventas diarias de los últimos ${days} días, ${clp(kpis?.grossSales)} en total`}
          />
        )}
      </Container>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Container className="flex flex-col gap-y-3 p-6">
          <Heading level="h2">Pedidos recientes</Heading>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Pedido</Table.HeaderCell>
                <Table.HeaderCell>Fecha</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                <Table.HeaderCell>Intcomex</Table.HeaderCell>
                <Table.HeaderCell>Documento</Table.HeaderCell>
                <Table.HeaderCell>Utilidad</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Margen</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(data?.recentOrders ?? []).map((order) => {
                const icx = order.intcomex ? ICX_STATE[order.intcomex.state as keyof typeof ICX_STATE] : null
                const led = order.ledger ? LEDGER_STATE[order.ledger.state as keyof typeof LEDGER_STATE] : null
                const canPlace = !order.intcomex || order.intcomex.state === "failed"
                return (
                  <Table.Row key={order.id}>
                    <Table.Cell>
                      <a className="text-ui-fg-interactive hover:underline" href={`/app/orders/${order.id}`}>
                        #{order.displayId}
                      </a>
                      <div className="text-xs text-ui-fg-muted">{order.email ?? ""}</div>
                    </Table.Cell>
                    <Table.Cell>{dateTime(order.createdAt)}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{clp(order.total)}</Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={icx?.color ?? "grey"}>
                        {icx?.label ?? "Sin colocar"}
                      </Badge>
                      {order.intcomex?.number ? (
                        <div className="text-xs text-ui-fg-muted">{order.intcomex.number}</div>
                      ) : null}
                      {order.intcomex?.error ? (
                        <div className="max-w-[220px] truncate text-xs text-ui-fg-error" title={order.intcomex.error}>
                          {order.intcomex.error}
                        </div>
                      ) : null}
                    </Table.Cell>
                    <Table.Cell>
                      {order.document ? (
                        <div className="flex flex-col gap-y-0.5">
                          <div className="flex items-center gap-x-1.5">
                            <Badge
                              size="2xsmall"
                              color={order.document.state === "issued" ? "green" : order.document.state === "failed" ? "red" : "orange"}
                            >
                              {order.document.state === "issued"
                                ? `${DOC_LABEL[order.document.kind] ?? "Documento"} N° ${order.document.folio}`
                                : order.document.state === "failed"
                                  ? "Falló"
                                  : "Emitiendo"}
                            </Badge>
                            {order.document.voided ? (
                              <Badge size="2xsmall" color="grey">
                                Anulada
                              </Badge>
                            ) : null}
                          </div>
                          {order.document.state === "issued" ? (
                            <div className="flex items-center gap-x-2 text-xs text-ui-fg-muted">
                              {order.document.url ? (
                                <a className="text-ui-fg-interactive hover:underline" href={order.document.url} target="_blank" rel="noreferrer">
                                  PDF
                                </a>
                              ) : null}
                              <span>{order.document.siiStatus ?? ""}</span>
                              {order.document.emailed ? <span>Enviada</span> : <span className="text-ui-fg-error">Sin enviar</span>}
                              {!order.document.voided ? (
                                <button
                                  className="text-ui-fg-subtle hover:text-ui-fg-error hover:underline"
                                  onClick={() =>
                                    voidDocument(order.document!.id, `${DOC_LABEL[order.document!.kind]} N° ${order.document!.folio}`)
                                  }
                                >
                                  Anular
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {order.document.error ? (
                            <div className="max-w-[200px] truncate text-xs text-ui-fg-error" title={order.document.error}>
                              {order.document.error}
                            </div>
                          ) : null}
                          {order.document.state === "failed" ? (
                            <Button
                              size="small"
                              variant="secondary"
                              isLoading={busy === `doc-${order.id}`}
                              onClick={() => issueDocument(order.id, !order.document!.retryable)}
                            >
                              Reintentar
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <Badge size="2xsmall" color="grey">
                          Sin documento
                        </Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {led ? (
                        <Badge size="2xsmall" color={led.color}>
                          {led.label}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{clp(order.ledger?.contribution)}</Table.Cell>
                    <Table.Cell className="text-right">
                      {canPlace ? (
                        <Button
                          size="small"
                          variant="secondary"
                          isLoading={busy === `place-${order.id}`}
                          onClick={() => place(order.id)}
                        >
                          {order.intcomex ? "Reintentar" : "Colocar"}
                        </Button>
                      ) : null}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
              {data && data.recentOrders.length === 0 ? (
                <Table.Row>
                  <Table.Cell>Aún no hay pedidos.</Table.Cell>
                </Table.Row>
              ) : null}
            </Table.Body>
          </Table>
          <Text size="xsmall" className="text-ui-fg-muted">
            "Margen" es la utilidad del pedido después de la comisión de la pasarela, antes de costos fijos.
          </Text>
        </Container>

        <Container className="flex flex-col gap-y-4 p-6">
          <div className="flex items-center justify-between">
            <Heading level="h2">Intcomex</Heading>
            <Badge color={data?.intcomex.mode === "real" ? "green" : "orange"}>
              {data?.intcomex.mode === "real" ? `Real (${data.intcomex.environment})` : "Simulado"}
            </Badge>
          </div>

          <div className="flex flex-col gap-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ui-fg-subtle">Dólar</span>
              <span className="tabular-nums">
                {data?.intcomex.fx ? `${clp(data.intcomex.fx.rate)} (${data.intcomex.fx.date})` : "-"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ui-fg-subtle">Sin categoría (borrador)</span>
              <span className="tabular-nums">{data?.intcomex.catalogUnmapped ?? "-"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ui-fg-subtle">Bajo stock mínimo</span>
              <span className="tabular-nums">{data?.intcomex.catalogLowStock ?? "-"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ui-fg-subtle">Pedidos fallidos</span>
              <span className={`tabular-nums ${data?.intcomex.ordersFailed ? "text-ui-fg-error" : ""}`}>
                {data?.intcomex.ordersFailed ?? "-"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-3">
            <Text size="small" weight="plus">
              Sincronizaciones
            </Text>
            {(data?.intcomex.lastRuns ?? []).map((item) => (
              <div key={item.kind} className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm">{RUN_LABEL[item.kind]}</span>
                  <span className="text-xs text-ui-fg-muted">
                    {item.started_at ? dateTime(item.started_at) : "Nunca"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge size="2xsmall" color={RUN_COLOR[item.status as keyof typeof RUN_COLOR] ?? "grey"}>
                    {{ success: "OK", failed: "Falló", running: "En curso", never: "Sin datos" }[item.status] ?? item.status}
                  </Badge>
                  <Button
                    size="small"
                    variant="secondary"
                    isLoading={busy === `sync-${item.kind}-false`}
                    onClick={() => sync(item.kind)}
                  >
                    Sincronizar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Container>

        <Container className="flex flex-col gap-y-4 p-6 xl:col-start-2">
          <Heading level="h2">Documentos y correos</Heading>
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ui-fg-subtle">Boleta electrónica</span>
              <Badge color={data?.billing.mode === "real" ? "green" : "orange"}>
                {data?.billing.mode === "real" ? `Real (${data.billing.environment})` : "Simulado"}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ui-fg-subtle">Emitiendo</span>
              <span className="tabular-nums">{data?.billing.pending ?? "-"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ui-fg-subtle">Fallidos</span>
              <span className={`tabular-nums ${data?.billing.failed ? "text-ui-fg-error" : ""}`}>{data?.billing.failed ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ui-fg-subtle">Correo</span>
              <Badge color={data?.email.configured ? "green" : "red"}>{data?.email.host ?? "Sin configurar"}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-3">
            <Text size="small" weight="plus">
              Enviar correo de prueba
            </Text>
            <div className="flex gap-2">
              <Input size="small" type="email" placeholder="tu@correo.cl" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
              <Button size="small" variant="secondary" disabled={!testTo.includes("@")} isLoading={busy === "test-email"} onClick={sendTestEmail}>
                Enviar
              </Button>
            </div>
          </div>
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Control Cyprotech",
  icon: ChartBar,
})

export default DashboardPage
