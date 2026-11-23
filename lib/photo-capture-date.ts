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
  const timezone = typeof offset === "string" && EXIF_OFFSET.test(offset) ? offset : "+09:00";
  const timestamp = new Date(`${local}${timezone}`);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined;
};
