import JSZip from 'jszip';
import type { TaskFn, TaskMeta } from '../types';

type JsonObject = Record<string, unknown>;

export interface DocxFillFieldsInput {
  template: string;
  values: JsonObject;
  mapping?: Record<string, string>;
}

export interface DocxFillFieldsOutput {
  docx_base64: string;
  filled_count: number;
  unmatched_fields: string[];
  summary: string;
}

type FillCandidate = {
  label: string;
  kind: 'placeholder' | 'content-control' | 'label';
};

type Mapping = Record<string, string>;

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOCX_XML_PART_PATTERN =
  /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;

const PLACEHOLDER_PATTERN =
  /(\{\{\s*([^{}]+?)\s*\}\}|\[\[\s*([^\[\]]+?)\s*\]\]|<<\s*([^<>]+?)\s*>>|\$\{\s*([^{}]+?)\s*\})/g;
const INLINE_BLANK_PATTERN = /([^:：\n\r]{1,80})[:：]([ \t._\-…·]{2,})/g;

const DEFAULT_LABEL_ALIASES: Record<string, string[]> = {
  full_name: ['full name', 'fullname', 'name', 'ho ten', 'ho va ten', 'ten day du', 'ong', 'ba'],
  fullname: ['full name', 'fullname', 'name', 'ho ten', 'ho va ten', 'ten day du', 'ong', 'ba'],
  fullName: ['full name', 'fullname', 'name', 'ho ten', 'ho va ten', 'ten day du', 'ong', 'ba'],
  dob: ['dob', 'date of birth', 'birth date', 'ngay sinh', 'sinh ngay'],
  gender: ['gender', 'sex', 'gioi tinh'],
  nationality: ['nationality', 'quoc tich'],
  hometown: ['hometown', 'place of origin', 'que quan', 'nguyen quan'],
  address: ['address', 'residence', 'noi thuong tru', 'thuong tru', 'dia chi', 'dia chi thuong tru'],
  id_number: ['id number', 'identity number', 'cccd', 'cmnd', 'so cccd', 'so cmnd', 'so dinh danh', 'can cuoc so', 'cccd can cuoc so'],
  idNumber: ['id number', 'identity number', 'cccd', 'cmnd', 'so cccd', 'so cmnd', 'so dinh danh', 'can cuoc so', 'cccd can cuoc so'],
  issue_date: ['issue date', 'date of issue', 'ngay cap'],
  issueDate: ['issue date', 'date of issue', 'ngay cap'],
  expiry_date: ['expiry date', 'expiration date', 'valid until', 'co gia tri den', 'ngay het han', 'het han'],
  expiryDate: ['expiry date', 'expiration date', 'valid until', 'co gia tri den', 'ngay het han', 'het han'],
  id_type: ['id type', 'document type', 'loai giay to'],
  phone: ['phone', 'phone number', 'mobile', 'so dien thoai', 'dien thoai'],
  age: ['age', 'tuoi']
};

export const docxFillFields: TaskFn<DocxFillFieldsInput, DocxFillFieldsOutput> = async (input) => {
  if (!input || typeof input !== 'object') {
    throw new Error('docx_fill_fields expects an object input');
  }
  if (typeof input.template !== 'string' || !input.template.trim()) {
    throw new Error('docx_fill_fields.template must be a base64 or data URL .docx string');
  }
  if (!input.values || typeof input.values !== 'object' || Array.isArray(input.values)) {
    throw new Error('docx_fill_fields.values must be an object');
  }

  const normalizedValues = normalizeValues(input.values);
  const templateBytes = await templateToBytes(input.template);
  const zip = await JSZip.loadAsync(templateBytes);
  const parts = Object.keys(zip.files).filter((name) => DOCX_XML_PART_PATTERN.test(name));
  if (!parts.includes('word/document.xml')) {
    throw new Error('Invalid .docx: word/document.xml was not found');
  }

  const documents = await Promise.all(parts.map(async (name) => {
    const xml = await zip.file(name)?.async('string');
    return xml ? { name, doc: parseXml(xml) } : undefined;
  }));
  const parsedParts = documents.filter(Boolean) as Array<{ name: string; doc: Document }>;

  const candidates = uniqueCandidates(parsedParts.flatMap(({ doc }) => extractCandidates(doc)));
  const mapping = await buildMapping(candidates, normalizedValues, input.mapping);
  const filledKeys = new Set<string>();
  let filledCount = 0;

  for (const { name, doc } of parsedParts) {
    const result = fillXmlDocument(doc, normalizedValues, mapping);
    if (result.filledCount > 0) {
      filledCount += result.filledCount;
      for (const key of result.filledKeys) filledKeys.add(key);
      zip.file(name, serializeXml(doc));
    }
  }

  const output = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const fillableKeys = Object.entries(normalizedValues)
    .filter(([, value]) => value.trim())
    .map(([key]) => key);
  const unmatchedFields = fillableKeys.filter((key) => !filledKeys.has(key));

  return {
    docx_base64: bytesToBase64(output),
    filled_count: filledCount,
    unmatched_fields: unmatchedFields,
    summary: `Filled ${filledCount} field${filledCount === 1 ? '' : 's'} in the DOCX template.`
  };
};

export const docxFillFieldsMeta: TaskMeta = {
  name: 'docx_fill_fields',
  label: 'Fill DOCX Fields',
  description: 'Fill a .docx template from JSON values using Gemini label mapping with heuristic fallback.',
  category: 'document',
  runtime: 'local',
  input_schema: {
    type: 'object',
    properties: {
      template: {
        type: 'string',
        description: 'Base64 or data URL of the .docx template.'
      },
      values: {
        type: 'object',
        description: 'Object containing values to fill into the template.'
      },
      mapping: {
        type: 'object',
        description: 'Optional mapping from DOCX label/placeholder text to a key in values.'
      }
    },
    required: ['template', 'values']
  },
  output_schema: {
    type: 'object',
    properties: {
      docx_base64: { type: 'string' },
      filled_count: { type: 'number' },
      unmatched_fields: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' }
    },
    required: ['docx_base64', 'filled_count', 'unmatched_fields', 'summary']
  }
};

async function buildMapping(
  candidates: FillCandidate[],
  values: Record<string, string>,
  explicitMapping?: Record<string, string>
): Promise<Mapping> {
  const mapping: Mapping = {};
  for (const [label, key] of Object.entries(explicitMapping ?? {})) {
    if (key in values) mapping[normalizeLabel(label)] = key;
  }

  const heuristic = heuristicMapping(candidates, values);
  Object.assign(heuristic, mapping);

  const gemini = await geminiMapping(candidates, values).catch(() => ({} as Mapping));
  for (const [label, key] of Object.entries(gemini)) {
    if (key in values) heuristic[normalizeLabel(label)] = key;
  }

  Object.assign(heuristic, mapping);
  return heuristic;
}

async function geminiMapping(candidates: FillCandidate[], values: Record<string, string>): Promise<Mapping> {
  if (typeof fetch !== 'function' || candidates.length === 0) return {};

  const labels = candidates.map((candidate) => candidate.label).slice(0, 120);
  const keys = Object.keys(values);
  const valuePreview = Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => [key, value.slice(0, 80)])
  );
  const response = await fetch('/api/ocr/proxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: [
                'You are mapping DOCX contract labels/placeholders to JSON value keys for a document fill task.',
                'Return valid JSON only in this shape: {"mapping":{"document label":"value_key"}}.',
                'Only map when the label clearly corresponds to a key. Do not invent keys.',
                'Vietnamese examples: "Ông", "Bà", "Họ và tên" -> full_name; "Ngày sinh" -> dob; "Giới tính" -> gender; "Quốc tịch" -> nationality; "CCCD/Căn cước số" -> id_number; "Địa chỉ thường trú" -> address.',
                `Labels: ${JSON.stringify(labels)}`,
                `Value keys: ${JSON.stringify(keys)}`,
                `Value preview: ${JSON.stringify(valuePreview)}`
              ].join('\n')
            }
          ]
        }
      ],
      generationConfig: { response_mime_type: 'application/json' }
    })
  });
  if (!response.ok) return {};

  const data = await response.json().catch(() => ({}));
  const text = normalizeGeminiText(data);
  const parsed = parseJsonObject(text);
  const rawMapping = parsed?.mapping && typeof parsed.mapping === 'object'
    ? parsed.mapping as Record<string, unknown>
    : parsed ?? {};

  const mapping: Mapping = {};
  for (const [label, key] of Object.entries(rawMapping)) {
    if (typeof key === 'string' && key in values) mapping[normalizeLabel(label)] = key;
  }
  return mapping;
}

function fillXmlDocument(
  doc: Document,
  values: Record<string, string>,
  mapping: Mapping
): { filledCount: number; filledKeys: Set<string> } {
  const filledKeys = new Set<string>();
  let filledCount = 0;

  for (const sdt of elementsByName(doc, 'sdt')) {
    const label = contentControlLabel(sdt);
    const key = label ? mapping[normalizeLabel(label)] ?? bestKeyForLabel(label, values) : undefined;
    if (!key || !values[key].trim()) continue;
    if (replaceTextInElement(sdt, values[key], { onlyIfBlankOrPlaceholder: true })) {
      filledCount += 1;
      filledKeys.add(key);
    }
  }

  for (const textNode of textElements(doc)) {
    const original = textNode.textContent ?? '';
    const replaced = original.replace(PLACEHOLDER_PATTERN, (match, _whole, a, b, c, d) => {
      const label = String(a ?? b ?? c ?? d ?? '').trim();
      const key = mapping[normalizeLabel(label)] ?? bestKeyForLabel(label, values);
      if (!key || !values[key].trim()) return match;
      filledKeys.add(key);
      filledCount += 1;
      return values[key];
    });
    if (replaced !== original) textNode.textContent = replaced;
  }

  for (const row of elementsByName(doc, 'tr')) {
    const cells = directChildElements(row, 'tc');
    if (cells.length < 2) continue;
    const label = elementText(cells[0]);
    const key = mapping[normalizeLabel(label)] ?? bestKeyForLabel(label, values);
    if (!key || !values[key].trim()) continue;
    if (replaceTextInElement(cells[1], values[key], { onlyIfBlankOrPlaceholder: true })) {
      filledCount += 1;
      filledKeys.add(key);
    }
  }

  for (const paragraph of elementsByName(doc, 'p')) {
    const inlineResult = replaceInlineLabelBlanks(paragraph, values, mapping);
    if (inlineResult.filledCount > 0) {
      filledCount += inlineResult.filledCount;
      for (const key of inlineResult.filledKeys) filledKeys.add(key);
    }

    const label = labelBeforeBlank(elementText(paragraph));
    if (!label) continue;
    const key = mapping[normalizeLabel(label)] ?? bestKeyForLabel(label, values);
    if (!key || !values[key].trim()) continue;
    if (replaceTrailingBlank(paragraph, values[key])) {
      filledCount += 1;
      filledKeys.add(key);
    }
  }

  return { filledCount, filledKeys };
}

function extractCandidates(doc: Document): FillCandidate[] {
  const candidates: FillCandidate[] = [];

  for (const textNode of textElements(doc)) {
    const text = textNode.textContent ?? '';
    for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
      const label = String(match[2] ?? match[3] ?? match[4] ?? match[5] ?? '').trim();
      if (label) candidates.push({ label, kind: 'placeholder' });
    }
  }

  for (const sdt of elementsByName(doc, 'sdt')) {
    const label = contentControlLabel(sdt);
    if (label) candidates.push({ label, kind: 'content-control' });
  }

  for (const row of elementsByName(doc, 'tr')) {
    const cells = directChildElements(row, 'tc');
    if (cells.length >= 2) {
      const label = elementText(cells[0]).replace(/[:：]\s*$/, '').trim();
      if (label) candidates.push({ label, kind: 'label' });
    }
  }

  for (const paragraph of elementsByName(doc, 'p')) {
    for (const label of inlineBlankLabels(elementText(paragraph))) {
      candidates.push({ label, kind: 'label' });
    }

    const label = labelBeforeBlank(elementText(paragraph));
    if (label) candidates.push({ label, kind: 'label' });
  }

  return candidates;
}

function heuristicMapping(candidates: FillCandidate[], values: Record<string, string>): Mapping {
  const mapping: Mapping = {};
  for (const candidate of candidates) {
    const key = bestKeyForLabel(candidate.label, values);
    if (key) mapping[normalizeLabel(candidate.label)] = key;
  }
  return mapping;
}

function bestKeyForLabel(label: string, values: Record<string, string>): string | undefined {
  const normalizedLabel = normalizeLabel(label);
  const compactLabel = compactLabelText(normalizedLabel);
  if (!normalizedLabel) return undefined;

  const keys = Object.keys(values);
  for (const key of keys) {
    const normalizedKey = normalizeLabel(key);
    if (normalizedKey === normalizedLabel || compactLabelText(normalizedKey) === compactLabel) return key;
  }

  for (const key of keys) {
    const normalizedKey = normalizeLabel(key);
    const compactKey = compactLabelText(normalizedKey);
    if (
      normalizedLabel.includes(normalizedKey) ||
      normalizedKey.includes(normalizedLabel) ||
      compactLabel.includes(compactKey) ||
      compactKey.includes(compactLabel)
    ) return key;
  }

  for (const key of keys) {
    const aliases = DEFAULT_LABEL_ALIASES[key] ?? [];
    if (aliases.some((alias) => aliasMatchesLabel(alias, normalizedLabel))) return key;
  }

  return undefined;
}

function aliasMatchesLabel(alias: string, normalizedLabel: string): boolean {
  const normalizedAlias = normalizeLabel(alias);
  if (!normalizedAlias) return false;

  if (compactLabelText(normalizedAlias).length <= 3) {
    return normalizedLabel.split(/\s+/).includes(normalizedAlias);
  }

  return normalizedLabel.includes(normalizedAlias);
}

function replaceTextInElement(
  element: Element,
  value: string,
  options: { onlyIfBlankOrPlaceholder: boolean }
): boolean {
  const texts = textElements(element);
  if (texts.length === 0) return false;

  const current = texts.map((node) => node.textContent ?? '').join('');
  const canReplace =
    !options.onlyIfBlankOrPlaceholder ||
    !current.trim() ||
    PLACEHOLDER_PATTERN.test(current) ||
    /^[_\-\s.:：]+$/.test(current);
  PLACEHOLDER_PATTERN.lastIndex = 0;
  if (!canReplace) return false;

  texts[0].textContent = value;
  for (const text of texts.slice(1)) text.textContent = '';
  return true;
}

function replaceInlineLabelBlanks(
  paragraph: Element,
  values: Record<string, string>,
  mapping: Mapping
): { filledCount: number; filledKeys: Set<string> } {
  const texts = textElements(paragraph);
  const fullText = texts.map((node) => node.textContent ?? '').join('');
  const replacements: Array<{ start: number; end: number; value: string; key: string }> = [];
  const filledKeys = new Set<string>();

  for (const match of fullText.matchAll(INLINE_BLANK_PATTERN)) {
    const label = match[1].trim();
    const blank = match[2];
    const key = mapping[normalizeLabel(label)] ?? bestKeyForLabel(label, values);
    if (!key || !values[key].trim()) continue;

    const blankStart = match.index + match[0].length - blank.length;
    const blankEnd = blankStart + blank.length;
    replacements.push({ start: blankStart, end: blankEnd, value: values[key], key });
  }

  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    replaceTextRange(texts, replacement.start, replacement.end, replacement.value);
    filledKeys.add(replacement.key);
  }

  return { filledCount: replacements.length, filledKeys };
}

function replaceTextRange(texts: Element[], start: number, end: number, value: string): void {
  let offset = 0;
  let inserted = false;

  for (const text of texts) {
    const current = text.textContent ?? '';
    const segmentStart = offset;
    const segmentEnd = offset + current.length;
    offset = segmentEnd;

    if (segmentEnd <= start || segmentStart >= end) continue;

    const localStart = Math.max(0, start - segmentStart);
    const localEnd = Math.min(current.length, end - segmentStart);
    const before = current.slice(0, localStart);
    const after = current.slice(localEnd);

    if (!inserted) {
      text.textContent = before + value + (segmentEnd >= end ? after : '');
      inserted = true;
    } else {
      text.textContent = segmentEnd >= end ? after : '';
    }
  }
}

function replaceTrailingBlank(paragraph: Element, value: string): boolean {
  const texts = textElements(paragraph);
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const text = texts[index];
    const current = text.textContent ?? '';
    if (!current.trim() || /^[_\-\s.:：]+$/.test(current)) {
      text.textContent = current.replace(/[_\-\s.:：]*$/, value);
      return true;
    }
  }
  return false;
}

function inlineBlankLabels(text: string): string[] {
  return Array.from(text.matchAll(INLINE_BLANK_PATTERN), (match) => match[1].trim()).filter(Boolean);
}

function labelBeforeBlank(text: string): string | undefined {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^(.{2,80}?)[：:]\s*(?:[_\-. …·]{2,})?$/);
  return match?.[1]?.trim();
}

function contentControlLabel(sdt: Element): string | undefined {
  const props = elementsByName(sdt, 'sdtPr')[0];
  if (!props) return undefined;
  const tag = elementsByName(props, 'tag')[0];
  const alias = elementsByName(props, 'alias')[0];
  return attrValue(tag, 'val') || attrValue(alias, 'val') || undefined;
}

function uniqueCandidates(candidates: FillCandidate[]): FillCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const normalized = normalizeLabel(candidate.label);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function normalizeValues(values: JsonObject): Record<string, string> {
  const source = values.fields && typeof values.fields === 'object' && !Array.isArray(values.fields)
    ? { ...(values.fields as JsonObject), ...values }
    : values;
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === 'fields') continue;
    normalized[key] = value == null ? '' : String(value);
  }

  return normalized;
}

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactLabelText(value: string): string {
  return value.replace(/\s+/g, '');
}

function parseXml(xml: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOCX fill requires DOMParser support in the browser runtime');
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Could not parse DOCX XML part');
  }
  return doc;
}

function serializeXml(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

function textElements(root: Document | Element): Element[] {
  return elementsByName(root, 't');
}

function elementsByName(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS(WORD_NS, localName));
}

function directChildElements(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((child) => child.localName === localName);
}

function elementText(element: Element): string {
  return textElements(element).map((node) => node.textContent ?? '').join('');
}

function attrValue(element: Element | undefined, localName: string): string {
  if (!element) return '';
  for (const attr of Array.from(element.attributes)) {
    if (attr.localName === localName) return attr.value.trim();
  }
  return '';
}

function normalizeGeminiText(data: unknown): string {
  const value = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };
  return value.candidates?.[0]?.content?.parts
    ?.map((part) => typeof part.text === 'string' ? part.text : '')
    .join('\n')
    .trim() ?? '';
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(content.slice(firstBrace, lastBrace + 1));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function templateToBytes(input: string): Promise<Uint8Array> {
  const source = input.trim();
  if (/^blob:/i.test(source)) {
    return fetchBytes(source);
  }
  if (/^https?:/i.test(source)) {
    return fetchUrlBytes(source);
  }
  return base64ToBytes(source);
}

async function fetchUrlBytes(url: string): Promise<Uint8Array> {
  try {
    return await fetchBytes(url);
  } catch (directError) {
    try {
      return await fetchBytes(`/api/files/proxy?url=${encodeURIComponent(url)}`);
    } catch (proxyError) {
      const directMessage = directError instanceof Error ? directError.message : String(directError);
      const proxyMessage = proxyError instanceof Error ? proxyError.message : String(proxyError);
      throw new Error(`Could not load DOCX template URL. Direct fetch: ${directMessage}. Proxy fetch: ${proxyMessage}`);
    }
  }
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function base64ToBytes(input: string): Uint8Array {
  const base64 = input.includes(',') && /^data:/i.test(input)
    ? input.slice(input.indexOf(',') + 1)
    : input;
  const clean = base64.replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
