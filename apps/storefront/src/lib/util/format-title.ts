// Los titulos importados de Intcomex suelen venir con palabras en MAYUSCULAS ("ASUS TARJETA VIDEO ...").
// Aqui se pasan a formato normal sin tocar siglas, marcas ni codigos de modelo.

const KEEP_UPPER = new Set([
  "AMD", "ASUS", "MSI", "ROG", "TUF", "RGB", "ARGB", "USB", "SSD", "HDD", "LED", "OLED", "LCD", "RAM",
  "DDR", "ATX", "HDMI", "PCIE", "NVME", "CPU", "GPU", "LGA", "IPS", "FHD", "QHD", "UHD", "WIFI", "LAN",
  "WAN", "UPS", "NVR", "DVR", "POE", "KVM", "DIMM", "SODIMM", "HDR", "RAID", "SATA", "M.2", "AIO",
  "LTE", "VGA", "DVI", "NAS", "CCTV", "IP", "TV", "PC", "HP", "LG", "TP-LINK", "D-LINK", "EXPO", "NVIDIA",
])

const isShoutedWord = (word: string) => /^[A-ZÁÉÍÓÚÑÜ]{4,}$/.test(word) && !KEEP_UPPER.has(word)

const capitalize = (word: string) => word.charAt(0) + word.slice(1).toLowerCase()

export const formatTitle = (title: string | null | undefined): string => {
  if (!title) {
    return ""
  }
  return title
    .trim()
    .split(/\s+/)
    .map((word) => (isShoutedWord(word) ? capitalize(word) : word))
    .join(" ")
}
