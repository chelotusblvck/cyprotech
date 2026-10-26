import { detectBrand, isGamer } from "../brands"

describe("detectBrand", () => {
  it.each([
    ["Kingston Fury Memoria RAM 8GB", "Kingston Fury", "Kingston", "Fury"],
    ["Kingston ValueRam Memoria RAM 16GB", "Kingston ValueRam", "Kingston", "ValueRam"],
    ["KNG Fury Memoria RAM 16GB 5600MT/S", null, "Kingston", "Fury"],
    ["KNG SSD 1TB M.2", null, "Kingston", null],
    ["Asus ROG Mon XG27AQDPG 27in OLED", "ROG", "ASUS", "ROG"],
    ["ASUS FUENTE DE PODER TUF-GAMING-750G-EVO", "ASUS", "ASUS", null],
    ["Logitech Audifono H390 Blanco", "Logitech", "Logitech", null],
    ["Primus Gaming Mouse Gladius", "Primus Gaming", "Primus Gaming", null],
  ])("%s", (title, brand, expectedBrand, expectedLine) => {
    expect(detectBrand({ title, brand })).toEqual({ brand: expectedBrand, line: expectedLine })
  })

  it("no confunde prefijos parciales", () => {
    expect(detectBrand({ title: "Msiwhatever cable" })).toBeNull()
    expect(detectBrand({ title: "Producto sin marca conocida" })).toBeNull()
  })
})

describe("isGamer", () => {
  it.each([
    ["Logitech Mouse Gamer Inalam G502 X Plus Negro", "Logitech"],
    ["Logitech Teclado Gamer G915 X TKL Lightspeed", "Logitech"],
    ["Kingston Fury Memoria RAM 8GB 3200MHZ DDR4 DIMM Beast Black", "Kingston Fury"],
    ["KNG Fury Memoria RAM 16GB 5600MT/S DDR5 DIMM RGB EXPO", null],
    ["Xiaomi monitor 27 G27i IPS 1920x1080 200Hz HDMI/DP", "Xiaomi"],
    ["ASUS TARJETA VIDEO DUAL-RTX5060TI-O16G-EVO", "ASUS"],
    ["HyperX Cloud Stinger 2 Core Headset", "HyperX"],
    ["Razer Teclado Huntsman Mini", "Razer"],
    ["Asus ROG Mon XG27AQDPG", "ROG"],
    ["Kingston SSD Interno 1024GB Renegade G5 M.2 NVME", "Kingston"],
  ])("gamer: %s", (title, brand) => {
    expect(isGamer({ title, brand })).toBe(true)
  })

  it.each([
    ["Logitech Audifono H390 Blanco", "Logitech"],
    ["Logitech Teclado inalambrico MX Mechanical Espanol", "Logitech"],
    ["Kingston SSD Interno 480GB SATA A400", "Kingston"],
    ["Kingston ValueRam Memoria RAM 16GB 3200MHz DDR4 DIMM", "Kingston ValueRam"],
    ["MSI TARJETA MADRE A520M-A PRO DDR4", "MSI"],
    ["AMD Procesador Ryzen 5 8400F 6 Core 4.7GHz 22MB AM5", "AMD"],
    ["HIK Monitor E-LED HD 21.45 pulgadas 16/7 HDMI-VGA", null],
  ])("no gamer: %s", (title, brand) => {
    expect(isGamer({ title, brand })).toBe(false)
  })
})
