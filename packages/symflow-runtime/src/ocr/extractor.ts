import type { IdCardFields } from './types';

export function extractIdCardFields(rawText: string): IdCardFields {
  const lines = normalizeLines(rawText);
  const joined = lines.join(' ');
  const result: IdCardFields = {
    id_type: detectIdType(joined)
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] ?? '';

    if (!result.id_number) {
      const idNumber = extractIdNumber(line) ?? extractIdNumber(next);
      if (idNumber) {
        result.id_number = idNumber;
      }
    }

    if (!result.full_name) {
      const name = extractValueAfterLabel(line, /họ\s*(?:và\s*)?tên|full\s*name/i, next);
      if (name) result.full_name = normalizeName(name);
    }

    if (!result.dob) {
      const dob = extractDateAfterLabel(line, /ngày\s*sinh|date\s*of\s*birth|dob/i, next);
      if (dob) result.dob = dob;
    }

    if (!result.gender) {
      const gender = extractGender(line, next);
      if (gender) result.gender = gender;
    }

    if (!result.nationality) {
      const nationality = extractValueAfterLabel(line, /quốc\s*tịch|nationality/i, next);
      if (nationality) result.nationality = cleanupText(nationality);
    }

    if (!result.hometown) {
      const hometown = extractValueAfterLabel(line, /quê\s*quán|place\s*of\s*origin/i, next);
      if (hometown) result.hometown = cleanupText(hometown);
    }

    if (!result.address) {
      const address = extractValueAfterLabel(line, /nơi\s*thường\s*trú|place\s*of\s*residence/i, next);
      if (address) result.address = cleanupText(address);
    }

    if (!result.issue_date) {
      const issueDate = extractDateAfterLabel(line, /ngày\s*cấp|date\s*of\s*issue/i, next);
      if (issueDate) result.issue_date = issueDate;
    }

    if (!result.expiry_date) {
      const expiryDate = extractDateAfterLabel(line, /có\s*giá\s*trị\s*đến|ngày\s*hết\s*hạn|expiry|valid\s*until/i, next);
      if (expiryDate) result.expiry_date = expiryDate;
    }
  }

  return result;
}

function normalizeLines(rawText: string): string[] {
  return rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectIdType(text: string): IdCardFields['id_type'] {
  const normalized = fold(text).toUpperCase();
  if (normalized.includes('CAN CUOC CONG DAN') || normalized.includes('CITIZEN IDENTITY') || normalized.includes('CCCD')) {
    return 'CCCD';
  }
  if (normalized.includes('CHUNG MINH NHAN DAN') || normalized.includes('CMND')) {
    return 'CMND';
  }
  if (normalized.includes('HO CHIEU') || normalized.includes('PASSPORT')) {
    return 'PASSPORT';
  }
  return 'UNKNOWN';
}

function extractIdNumber(line: string): string | undefined {
  const normalized = line.replace(/[OQ]/g, '0').replace(/[Il]/g, '1');
  const match = normalized.match(/\b(\d{9}|\d{12})\b/);
  return match?.[1];
}

function extractValueAfterLabel(line: string, label: RegExp, next: string): string | undefined {
  if (!label.test(line)) return undefined;

  const strippedLabel = line.replace(label, '').replace(/^[:\-–\s]+/, '').trim();
  if (strippedLabel) return strippedLabel;

  const inline = line.split(/[:\-–]/).slice(1).join(' ').trim();
  if (inline) return inline;

  return next || undefined;
}

function extractDateAfterLabel(line: string, label: RegExp, next: string): string | undefined {
  if (!label.test(line)) return undefined;
  const source = [line, next].filter(Boolean).join(' ');
  const match = source.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (!match) return undefined;
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function extractGender(line: string, next: string): IdCardFields['gender'] | undefined {
  if (!/giới\s*tính|sex|gender/i.test(line)) return undefined;
  const source = `${line} ${next}`;
  if (/\bnam\b/i.test(source)) return 'Nam';
  if (/\b(nữ|nu)\b/i.test(source)) return 'Nữ';
  return undefined;
}

function normalizeName(value: string): string {
  return cleanupText(value)
    .replace(/[^A-ZÀ-Ỹa-zà-ỹ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function cleanupText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
