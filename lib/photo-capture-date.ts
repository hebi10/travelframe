const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}:\d{2})$/;
const EXIF_OFFSET = /^[+-]\d{2}:\d{2}$/;

export const getExifPhotoCapturedAt = (exif: Record<string, unknown> | null | undefined) => {
  const date = exif?.DateTimeOriginal ?? exif?.DateTimeDigitized ?? exif?.DateTime;
  if (typeof date !== "string") return undefined;
  const match = EXIF_DATE.exec(date.trim());
  if (!match) return undefined;
  const [, year, month, day, time] = match;
  const local = `${year}-${month}-${day}T${time}`;
  const validation = new Date(`${local}Z`);
  if (!Number.isFinite(validation.getTime()) || validation.toISOString().slice(0, 19) !== local) return undefined;

  const offset = exif?.OffsetTimeOriginal ?? exif?.OffsetTimeDigitized ?? exif?.OffsetTime;
  if (typeof offset === "string" && offset.trim() && !EXIF_OFFSET.test(offset)) return undefined;
  const hasOffset = typeof offset === "string" && EXIF_OFFSET.test(offset);
  const timestamp = new Date(hasOffset ? `${local}${offset}` : local);
  if (!Number.isFinite(timestamp.getTime())) return undefined;
  if (!hasOffset && (
    timestamp.getFullYear() !== validation.getUTCFullYear() ||
    timestamp.getMonth() !== validation.getUTCMonth() ||
    timestamp.getDate() !== validation.getUTCDate() ||
    timestamp.getHours() !== validation.getUTCHours() ||
    timestamp.getMinutes() !== validation.getUTCMinutes() ||
    timestamp.getSeconds() !== validation.getUTCSeconds()
  )) return undefined;
  return timestamp.toISOString();
};
