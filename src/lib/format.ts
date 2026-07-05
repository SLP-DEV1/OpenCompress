export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
  const sign = bytes < 0 ? '-' : '';
  const absolute = Math.abs(bytes);
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(absolute) / Math.log(1024)), units.length - 1);
  const value = absolute / 1024 ** exponent;
  return `${sign}${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatSavings(percent: number): string {
  if (!Number.isFinite(percent)) return '0%';
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded > 0 ? '-' : rounded < 0 ? '+' : ''}${Math.abs(rounded)}%`;
}

export function supportedFile(file: File): boolean {
  return /image\/(jpe?g|png|webp|gif|tiff?|bmp|x-ms-bmp)/i.test(file.type) || /\.(jpe?g|png|webp|gif|tiff?|bmp)$/i.test(file.name);
}
