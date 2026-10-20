import { CHILE_REGIONS } from "@lib/util/chile"
import NativeSelect, { NativeSelectProps } from "@modules/common/components/native-select"
import { forwardRef } from "react"

// Selector de las 16 regiones de Chile. El valor es el código ISO (cl-rm, cl-vs...), que es el que
// usan las zonas de despacho para ofrecer Santiago o Regiones.
const ChileRegionSelect = forwardRef<HTMLSelectElement, Omit<NativeSelectProps, "children" | "placeholder">>(
  (props, ref) => (
    <NativeSelect ref={ref} placeholder="Región" {...props}>
      {CHILE_REGIONS.map((region) => (
        <option key={region.code} value={region.code}>
          {region.name}
        </option>
      ))}
    </NativeSelect>
  )
)

ChileRegionSelect.displayName = "ChileRegionSelect"

export default ChileRegionSelect
