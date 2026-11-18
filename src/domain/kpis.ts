/** Numbers as the campus reads them (es-CO: comma decimals, dot thousands). */
export const formatNumber = (value: number, digits = 1) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
