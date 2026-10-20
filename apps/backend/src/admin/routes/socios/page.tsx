import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Users } from "@medusajs/icons"
import {
  Alert,
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

import { Tile, TileGrid } from "../../components/tile"
import { api, useApi } from "../../lib/api"
import { clp, dateTime, periodLabel } from "../../lib/format"

type Totals = {
  grossMargin: number
  gatewayFees: number
  reversals: number
  expenses: number
  adjustments: number
  netProfit: number
  deficitIn: number
  distributable: number
  deficitOut: number
}

type Payout = {
  id?: string
  partner: string
  name?: string
  partner_name?: string
  percent: number
  amount: number
  status?: string
  paid_at?: string | null
  reference?: string | null
}

type Summary = {
  period: string
  status: "open" | "closed"
  isCurrent: boolean
  totals: Totals
  payouts: Payout[]
  closedPayouts: Payout[]
  projectedFixedCosts: { description: string; amount: number }[]
  entries: { id: string; kind: string; amount: number; description: string; order_id: string | null; created_at: string }[]
  pending: { orders: number; expectedContribution: number }
  gatewayFeeConfigured: boolean
}

type Periods = { periods: { period: string; status: string }[]; currentPeriod: string }

type Settings = {
  partnerA: { key: "a"; name: string; percent: number }
  partnerB: { key: "b"; name: string; percent: number }
  gatewayFeePercent: number
  gatewayFeeFixed: number
  gatewayFeeReportedWithIva: boolean
  holdDays: number
  carryDeficit: boolean
  fixedCosts: { name: string; amount: number }[]
}

const KIND_LABEL: Record<string, string> = {
  margin: "Margen de pedido",
  gateway_fee: "Comisión pasarela",
  reversal: "Reversa",
  expense: "Gasto",
  adjustment: "Ajuste",
}

const num = (value: string) => {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : 0
}

const SociosPage = () => {
  const prompt = usePrompt()
  const periods = useApi<Periods>("/admin/ledger/periods")
  const [period, setPeriod] = useState<string | null>(null)
  const selected = period ?? periods.data?.currentPeriod ?? null
  const summary = useApi<Summary>(selected ? `/admin/ledger/summary?period=${selected}` : null)
  const settingsApi = useApi<{ settings: Settings }>("/admin/ledger/settings")

  const [busy, setBusy] = useState<string | null>(null)
  const [expense, setExpense] = useState({ kind: "expense", amount: "", description: "" })
  const [references, setReferences] = useState<Record<string, string>>({})
  const [form, setForm] = useState<Settings | null>(null)

  useEffect(() => {
    if (settingsApi.data) {
      setForm(settingsApi.data.settings)
    }
  }, [settingsApi.data])

  const refresh = async () => {
    await Promise.all([periods.reload(), summary.reload(), settingsApi.reload()])
  }

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(success)
      await refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const data = summary.data
  const closed = data?.status === "closed"
  const totals = data?.totals

  const closePeriod = async () => {
    if (!data) {
      return
    }
    const force = data.isCurrent
    const ok = await prompt({
      title: `Cerrar ${periodLabel(data.period)}`,
      description: force
        ? "Este mes todavía no termina. Al cerrarlo se congelan los totales y se generan los pagos a los socios; los movimientos posteriores pasarán al mes siguiente."
        : "Se registran los costos fijos pendientes, se congelan los totales y se generan los pagos a los socios. Esta acción no se puede deshacer.",
      confirmText: "Cerrar período",
      cancelText: "Cancelar",
    })
    if (ok) {
      await run("close", () => api(`/admin/ledger/periods/${data.period}/close`, { method: "POST", body: { force } }), "Período cerrado")
    }
  }

  const addEntry = async () => {
    const amount = num(expense.amount)
    await run(
      "entry",
      () =>
        api("/admin/ledger/entries", {
          method: "POST",
          body: { kind: expense.kind, amount, description: expense.description, period: selected },
        }),
      "Movimiento registrado",
    )
    setExpense({ ...expense, amount: "", description: "" })
  }

  const saveSettings = () =>
    form && run("settings", () => api("/admin/ledger/settings", { method: "POST", body: form }), "Configuración guardada")

  const options = periods.data?.periods ?? []

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-col gap-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Heading level="h1">Socios y ledger</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Utilidad neta mensual y su reparto. Todo en CLP neto, sin IVA.
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[240px]">
              <Select value={selected ?? undefined} onValueChange={setPeriod} size="small">
                <Select.Trigger>
                  <Select.Value placeholder="Período" />
                </Select.Trigger>
                <Select.Content>
                  {options.map((item) => (
                    <Select.Item key={item.period} value={item.period}>
                      {periodLabel(item.period)} {item.status === "closed" ? "(cerrado)" : ""}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            {selected ? (
              <a href={`/admin/ledger/export?period=${selected}`}>
                <Button size="small" variant="secondary">
                  Exportar CSV
                </Button>
              </a>
            ) : null}
            <Button
              size="small"
              variant="secondary"
              isLoading={busy === "release"}
              onClick={() => run("release", () => api("/admin/ledger/release", { method: "POST" }), "Utilidad reconocida al día")}
            >
              Reconocer utilidad
            </Button>
            <Button size="small" disabled={closed || !data} isLoading={busy === "close"} onClick={closePeriod}>
              {closed ? "Período cerrado" : "Cerrar período"}
            </Button>
          </div>
        </div>

        {data && !data.gatewayFeeConfigured ? (
          <Alert variant="warning">
            No está configurada la comisión de Flow: la utilidad se calcula sin ese costo. Configúrala más abajo.
          </Alert>
        ) : null}
        {summary.error ? <Alert variant="error">{summary.error}</Alert> : null}

        <div className="flex items-center gap-2">
          <Badge color={closed ? "green" : "blue"}>{closed ? "Cerrado" : "Abierto (proyección)"}</Badge>
          {data?.projectedFixedCosts.length ? (
            <Text size="xsmall" className="text-ui-fg-muted">
              Incluye costos fijos que se registrarán al cerrar:{" "}
              {data.projectedFixedCosts.map((item) => `${item.description} ${clp(-item.amount)}`).join(", ")}
            </Text>
          ) : null}
        </div>

        <TileGrid>
          <Tile
            label="Utilidad neta del mes"
            value={clp(totals?.netProfit)}
            tone={(totals?.netProfit ?? 0) < 0 ? "negative" : "default"}
          />
          <Tile label="A repartir" value={clp(totals?.distributable)} hint={totals?.deficitIn ? `Tras recuperar ${clp(totals.deficitIn)} de pérdida` : undefined} />
          {(data?.payouts ?? []).map((payout) => (
            <Tile
              key={payout.partner}
              label={`${payout.name ?? payout.partner_name} (${payout.percent}%)`}
              value={clp(payout.amount)}
              hint={payout.status === "projected" ? "Proyectado" : payout.status === "paid" ? "Pagado" : "Por pagar"}
            />
          ))}
          {!closed ? (
            <Tile
              label="Por reconocer"
              value={clp(data?.pending.expectedContribution)}
              hint={`${data?.pending.orders ?? 0} pedido(s) esperando entrega y plazo de retracto`}
            />
          ) : null}
          {totals?.deficitOut ? (
            <Tile label="Pérdida que se arrastra" value={clp(totals.deficitOut)} tone="negative" hint="Se descuenta del próximo mes" />
          ) : null}
        </TileGrid>
      </Container>

      <div className="grid gap-4 xl:grid-cols-2">
        <Container className="flex flex-col gap-y-3 p-6">
          <Heading level="h2">Cómo se llega a la utilidad</Heading>
          <Table>
            <Table.Body>
              {[
                ["Margen de pedidos", totals?.grossMargin],
                ["Comisión de pasarela", totals?.gatewayFees],
                ["Reversas por devoluciones", totals?.reversals],
                ["Gastos y costos fijos", totals?.expenses],
                ["Ajustes", totals?.adjustments],
              ].map(([label, value]) => (
                <Table.Row key={label as string}>
                  <Table.Cell>{label}</Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{clp(value as number | undefined)}</Table.Cell>
                </Table.Row>
              ))}
              <Table.Row>
                <Table.Cell className="font-medium">Utilidad neta</Table.Cell>
                <Table.Cell className="text-right font-medium tabular-nums">{clp(totals?.netProfit)}</Table.Cell>
              </Table.Row>
              {totals?.deficitIn ? (
                <Table.Row>
                  <Table.Cell>Pérdida de meses anteriores</Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{clp(-totals.deficitIn)}</Table.Cell>
                </Table.Row>
              ) : null}
              <Table.Row>
                <Table.Cell className="font-medium">A repartir entre los socios</Table.Cell>
                <Table.Cell className="text-right font-medium tabular-nums">{clp(totals?.distributable)}</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </Container>

        <Container className="flex flex-col gap-y-3 p-6">
          <Heading level="h2">Pagos a socios</Heading>
          {closed ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Socio</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Monto</Table.HeaderCell>
                  <Table.HeaderCell>Estado</Table.HeaderCell>
                  <Table.HeaderCell>Folio</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(data?.closedPayouts ?? []).map((payout) => (
                  <Table.Row key={payout.id}>
                    <Table.Cell>{payout.partner_name}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{clp(payout.amount)}</Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={payout.status === "paid" ? "green" : "orange"}>
                        {payout.status === "paid" ? "Pagado" : "Por pagar"}
                      </Badge>
                      {payout.paid_at ? <div className="text-xs text-ui-fg-muted">{dateTime(payout.paid_at)}</div> : null}
                    </Table.Cell>
                    <Table.Cell>
                      {payout.status === "paid" ? (
                        payout.reference ?? "-"
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            size="small"
                            placeholder="Folio transferencia"
                            value={references[payout.id as string] ?? ""}
                            onChange={(event) => setReferences({ ...references, [payout.id as string]: event.target.value })}
                          />
                          <Button
                            size="small"
                            variant="secondary"
                            isLoading={busy === `pay-${payout.id}`}
                            onClick={() =>
                              run(
                                `pay-${payout.id}`,
                                () =>
                                  api(`/admin/ledger/payouts/${payout.id}/pay`, {
                                    method: "POST",
                                    body: { reference: references[payout.id as string] ?? "" },
                                  }),
                                "Pago marcado como pagado",
                              )
                            }
                          >
                            Marcar pagado
                          </Button>
                        </div>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
                {data && data.closedPayouts.length === 0 ? (
                  <Table.Row>
                    <Table.Cell>No hubo utilidad que repartir este mes.</Table.Cell>
                  </Table.Row>
                ) : null}
              </Table.Body>
            </Table>
          ) : (
            <>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Socio</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">%</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Proyección</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(data?.payouts ?? []).map((payout) => (
                    <Table.Row key={payout.partner}>
                      <Table.Cell>{payout.name ?? payout.partner_name}</Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{payout.percent}%</Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{clp(payout.amount)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
              <Text size="xsmall" className="text-ui-fg-muted">
                Los pagos se generan al cerrar el período, con la utilidad real de ese momento.
              </Text>
            </>
          )}
        </Container>
      </div>

      <Container className="flex flex-col gap-y-3 p-6">
        <Heading level="h2">Movimientos del período</Heading>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Fecha</Table.HeaderCell>
              <Table.HeaderCell>Tipo</Table.HeaderCell>
              <Table.HeaderCell>Descripción</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Monto (neto)</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(data?.entries ?? []).map((entry) => (
              <Table.Row key={entry.id}>
                <Table.Cell>{dateTime(entry.created_at)}</Table.Cell>
                <Table.Cell>
                  <Badge size="2xsmall" color={entry.amount >= 0 ? "green" : "grey"}>
                    {KIND_LABEL[entry.kind] ?? entry.kind}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{entry.description}</Table.Cell>
                <Table.Cell className={`text-right tabular-nums ${entry.amount < 0 ? "text-ui-fg-subtle" : ""}`}>
                  {clp(entry.amount)}
                </Table.Cell>
              </Table.Row>
            ))}
            {data && data.entries.length === 0 ? (
              <Table.Row>
                <Table.Cell>Aún no hay movimientos en este período.</Table.Cell>
              </Table.Row>
            ) : null}
          </Table.Body>
        </Table>

        {!closed ? (
          <div className="grid items-end gap-3 border-t border-ui-border-base pt-4 md:grid-cols-[160px_160px_1fr_auto]">
            <div className="flex flex-col gap-y-1">
              <Label size="small">Tipo</Label>
              <Select value={expense.kind} onValueChange={(kind) => setExpense({ ...expense, kind })} size="small">
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="expense">Gasto</Select.Item>
                  <Select.Item value="adjustment">Ajuste (+/-)</Select.Item>
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="small">Monto CLP (neto)</Label>
              <Input
                size="small"
                inputMode="decimal"
                placeholder={expense.kind === "expense" ? "15000" : "-5000 o 5000"}
                value={expense.amount}
                onChange={(event) => setExpense({ ...expense, amount: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="small">Descripción</Label>
              <Input
                size="small"
                placeholder="Ej: Hosting VPS"
                value={expense.description}
                onChange={(event) => setExpense({ ...expense, description: event.target.value })}
              />
            </div>
            <Button
              size="small"
              isLoading={busy === "entry"}
              disabled={!expense.description.trim() || num(expense.amount) === 0}
              onClick={addEntry}
            >
              Registrar
            </Button>
          </div>
        ) : null}
      </Container>

      <Container className="flex flex-col gap-y-4 p-6">
        <div>
          <Heading level="h2">Configuración del reparto</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Los cambios aplican a los pedidos que se registren desde ahora y a los cierres futuros. Cuando un pago
            trae la comisión real de Flow se usa ese valor; el porcentaje estimado solo se aplica si no viene.
          </Text>
        </div>

        {form ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Socio A">
                <Input size="small" value={form.partnerA.name} onChange={(e) => setForm({ ...form, partnerA: { ...form.partnerA, name: e.target.value } })} />
              </Field>
              <Field label="Porcentaje socio A (%)">
                <Input size="small" inputMode="decimal" value={String(form.partnerA.percent)} onChange={(e) => setForm({ ...form, partnerA: { ...form.partnerA, percent: num(e.target.value) } })} />
              </Field>
              <Field label="Socio B">
                <Input size="small" value={form.partnerB.name} onChange={(e) => setForm({ ...form, partnerB: { ...form.partnerB, name: e.target.value } })} />
              </Field>
              <Field label="Porcentaje socio B (%)">
                <Input size="small" inputMode="decimal" value={String(form.partnerB.percent)} onChange={(e) => setForm({ ...form, partnerB: { ...form.partnerB, percent: num(e.target.value) } })} />
              </Field>
              <Field label="Comisión Flow estimada (% sin IVA)">
                <Input size="small" inputMode="decimal" value={String(form.gatewayFeePercent)} onChange={(e) => setForm({ ...form, gatewayFeePercent: num(e.target.value) })} />
              </Field>
              <Field label="Cargo fijo por transacción (CLP)">
                <Input size="small" inputMode="decimal" value={String(form.gatewayFeeFixed)} onChange={(e) => setForm({ ...form, gatewayFeeFixed: num(e.target.value) })} />
              </Field>
              <Field label="Días tras la entrega (retracto)">
                <Input size="small" inputMode="numeric" value={String(form.holdDays)} onChange={(e) => setForm({ ...form, holdDays: Math.max(0, Math.round(num(e.target.value))) })} />
              </Field>
              <div className="flex items-end gap-3 pb-1">
                <Switch
                  checked={form.gatewayFeeReportedWithIva}
                  onCheckedChange={(checked) => setForm({ ...form, gatewayFeeReportedWithIva: checked })}
                />
                <Label size="small">La comisión que informa Flow en cada pago incluye IVA</Label>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch checked={form.carryDeficit} onCheckedChange={(checked) => setForm({ ...form, carryDeficit: checked })} />
                <Label size="small">Arrastrar pérdidas al mes siguiente</Label>
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Text size="small" weight="plus">
                Costos fijos mensuales (CLP netos, se registran solos al cerrar)
              </Text>
              {form.fixedCosts.map((cost, index) => (
                <div key={index} className="grid items-center gap-3 md:grid-cols-[1fr_180px_auto]">
                  <Input
                    size="small"
                    value={cost.name}
                    onChange={(e) => setForm({ ...form, fixedCosts: form.fixedCosts.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)) })}
                  />
                  <Input
                    size="small"
                    inputMode="decimal"
                    value={String(cost.amount)}
                    onChange={(e) => setForm({ ...form, fixedCosts: form.fixedCosts.map((c, i) => (i === index ? { ...c, amount: num(e.target.value) } : c)) })}
                  />
                  <Button size="small" variant="transparent" onClick={() => setForm({ ...form, fixedCosts: form.fixedCosts.filter((_, i) => i !== index) })}>
                    Quitar
                  </Button>
                </div>
              ))}
              <div>
                <Button size="small" variant="secondary" onClick={() => setForm({ ...form, fixedCosts: [...form.fixedCosts, { name: "", amount: 0 }] })}>
                  Agregar costo fijo
                </Button>
              </div>
            </div>

            <div>
              <Button size="small" isLoading={busy === "settings"} onClick={saveSettings}>
                Guardar configuración
              </Button>
            </div>
          </>
        ) : null}
      </Container>
    </div>
  )
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-y-1">
    <Label size="small">{label}</Label>
    {children}
  </div>
)

export const config = defineRouteConfig({
  label: "Socios y ledger",
  icon: Users,
})

export default SociosPage
