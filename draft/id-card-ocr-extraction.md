# Task: Trích Xuất Thông Tin Thẻ CCCD / CMND Từ Ảnh

> Phiên bản: 1.0  
> Trạng thái: Draft  
> Phạm vi: Client-side OCR trên browser (WebAssembly) + fallback server-side  

---

## 1. Mục tiêu

Xây dựng một **OCR node** trong Symflow có khả năng:

1. Nhận đầu vào là ảnh thẻ CCCD hoặc CMND (chụp từ camera hoặc upload file).  
2. Trích xuất các trường thông tin cá nhân chuẩn hóa.  
3. Trả kết quả dưới dạng JSON có thể kết nối sang các node tiếp theo trong workflow.  

**Các trường cần trích xuất:**

| Trường | Tên hiển thị | Ví dụ |
|---|---|---|
| `full_name` | Họ và tên | NGUYỄN VĂN AN |
| `dob` | Ngày sinh | 01/01/1990 |
| `gender` | Giới tính | Nam |
| `nationality` | Quốc tịch | Việt Nam |
| `hometown` | Quê quán | Hà Nội |
| `address` | Nơi thường trú | 123 Đường ABC, Quận 1, TP.HCM |
| `id_number` | Số CCCD / CMND | 012345678901 |
| `issue_date` | Ngày cấp | 01/06/2021 |
| `expiry_date` | Ngày hết hạn | 01/01/2031 |
| `id_type` | Loại giấy tờ | CCCD / CMND, ... |

---

## 2. Chiến lược xử lý nhiều tầng (Layered Strategy)

Xử lý OCR theo pipeline 3 tầng, ưu tiên chạy local trước để bảo vệ dữ liệu nhạy cảm:

```
┌──────────────────────────────────────────────┐
│              Image Input                     │
└─────────────────┬────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────┐
│   Tầng 1: Tiền xử lý ảnh (Client-side)       │
│   - Resize về ≤ 1600px cạnh dài              │
│   - Chuyển grayscale                         │
│   - Tăng contrast (histogram equalization)   │
│   - Auto-rotate dựa trên EXIF               │
└─────────────────┬────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────┐
│   Tầng 2: Local OCR (Wasm — không rời máy)   │
│   - Tesseract.js (Wasm) + ngôn ngữ vie+eng   │
│   - confidence_score = avg confidence words  │
└────────┬─────────────────────────┬───────────┘
         │                         │
  score ≥ 0.85               score < 0.85
         │                         │
         ▼                         ▼
┌─────────────────┐    ┌───────────────────────┐
│ Tầng 3A: Regex  │    │ Tầng 3B: Server OCR   │
│ Field Extractor │    │ (cần user đồng ý gửi) │
│ (client-side)   │    │ Google Vision / Azure │
└────────┬────────┘    └──────────┬────────────┘
         │                        │
         └───────────┬────────────┘
                     ▼
           ┌──────────────────┐
           │   JSON Output    │
           │ { full_name,     │
           │   dob, id_number │
           │   address, ... } │
           └──────────────────┘
```

---

## 3. Kiến trúc kỹ thuật

### 3.1 Interface chuẩn hóa

```typescript
// packages/symflow-runtime/src/ocr/types.ts

export interface OcrWord {
  text: string;
  confidence: number;       // 0–1
  bbox: { x: number; y: number; w: number; h: number };
}

export interface OcrResult {
  rawText: string;
  words: OcrWord[];
  averageConfidence: number;
  engine: 'tesseract' | 'paddle' | 'vision-api' | 'azure' | 'google-doc-ai';
}

export interface IdCardFields {
  full_name?: string;
  dob?: string;           // ISO 8601: YYYY-MM-DD
  gender?: string;
  nationality?: string;
  hometown?: string;
  address?: string;
  id_number?: string;
  issue_date?: string;    // ISO 8601: YYYY-MM-DD
  expiry_date?: string;   // ISO 8601: YYYY-MM-DD
  id_type?: 'CCCD' | 'CMND' | 'PASSPORT' | 'UNKNOWN';
}

export interface OcrProvider {
  readonly engineName: string;
  recognize(image: Blob, lang?: string): Promise<OcrResult>;
}
```

### 3.2 Cây thư mục

```
packages/symflow-runtime/src/ocr/
├── types.ts               ← Interface, kiểu dữ liệu
├── preprocess.ts          ← Tiền xử lý ảnh qua Canvas API
├── providers/
│   ├── tesseract.ts       ← TesseractProvider (WebAssembly)
│   ├── vision-api.ts      ← GoogleVisionProvider (server proxy)
│   └── azure.ts           ← AzureDocumentProvider (server proxy)
├── extractor.ts           ← Regex + rule-based field extraction
├── pipeline.ts            ← Điều phối 3 tầng, quyết định fallback
└── index.ts               ← Export public API
```

---

## 4. Triển khai chi tiết từng tầng

### 4.1 Tiền xử lý ảnh — `preprocess.ts`

```typescript
// packages/symflow-runtime/src/ocr/preprocess.ts

export interface PreprocessOptions {
  maxDimension?: number;    // default 1600
  grayscale?: boolean;      // default true
  contrastBoost?: number;   // default 1.4
}

export async function preprocessImage(
  file: File | Blob,
  opts: PreprocessOptions = {}
): Promise<Blob> {
  const { maxDimension = 1600, grayscale = true, contrastBoost = 1.4 } = opts;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  canvas.width  = Math.round(bitmap.width  * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  if (grayscale) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      // Luminance formula + contrast boost
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = Math.min(255, v * contrastBoost);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return new Promise(resolve =>
    canvas.toBlob(b => resolve(b!), 'image/png')
  );
}
```

### 4.2 Tesseract Provider — `providers/tesseract.ts`

```typescript
// packages/symflow-runtime/src/ocr/providers/tesseract.ts
import Tesseract from 'tesseract.js';
import type { OcrProvider, OcrResult } from '../types';

export class TesseractProvider implements OcrProvider {
  readonly engineName = 'tesseract';
  private workerPromise: Promise<Tesseract.Worker> | null = null;

  private getWorker(): Promise<Tesseract.Worker> {
    if (!this.workerPromise) {
      this.workerPromise = Tesseract.createWorker('vie+eng', 1, {
        cachePath: '/tesseract-models', // cache vào IndexedDB
        logger: () => {},
      });
    }
    return this.workerPromise;
  }

  async recognize(image: Blob): Promise<OcrResult> {
    const worker = await this.getWorker();
    const url = URL.createObjectURL(image);
    try {
      const { data } = await worker.recognize(url);
      const words = data.words.map(w => ({
        text: w.text,
        confidence: w.confidence / 100,
        bbox: {
          x: w.bbox.x0, y: w.bbox.y0,
          w: w.bbox.x1 - w.bbox.x0,
          h: w.bbox.y1 - w.bbox.y0
        },
      }));
      const avgConf = words.length
        ? words.reduce((s, w) => s + w.confidence, 0) / words.length
        : 0;
      return { rawText: data.text, words, averageConfidence: avgConf, engine: 'tesseract' };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async destroy() {
    if (this.workerPromise) (await this.workerPromise).terminate();
  }
}
```

---

### 4.3 Field Extractor — `extractor.ts`

Trích xuất dựa trên regex theo layout thẻ CCCD Việt Nam:

```typescript
// packages/symflow-runtime/src/ocr/extractor.ts
import type { IdCardFields } from './types';

function parseDate(raw: string): string | undefined {
  const m = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (!m) return undefined;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function detectIdType(text: string): IdCardFields['id_type'] {
  const u = text.toUpperCase();
  if (u.includes('CĂN CƯỚC CÔNG DÂN') || u.includes('CITIZEN IDENTITY')) return 'CCCD';
  if (u.includes('CHỨNG MINH NHÂN DÂN')) return 'CMND';
  if (u.includes('HỘ CHIẾU') || u.includes('PASSPORT')) return 'PASSPORT';
  return 'UNKNOWN';
}

export function extractIdCardFields(rawText: string): IdCardFields {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const joined = lines.join(' ');
  const result: IdCardFields = { id_type: detectIdType(joined) };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';

    // Số CCCD 12 số hoặc CMND 9 số
    if (!result.id_number) {
      const m = line.match(/\b(\d{9}|\d{12})\b/);
      if (m) result.id_number = m[1];
    }

    // Họ và tên
    if (/họ\s*(và\s*)?tên|full\s*name/i.test(line) && next) {
      result.full_name = next.replace(/[^A-ZÀ-Ỹa-zà-ỹ\s]/g, '').trim().toUpperCase();
    }

    // Ngày sinh
    if (/ngày\s*sinh|date\s*of\s*birth|dob/i.test(line)) {
      const raw = next || line;
      result.dob = parseDate(raw.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/)?.[0] ?? '');
    }

    // Giới tính
    if (/giới\s*tính|sex|gender/i.test(line)) {
      if (/nam\b/i.test(next || line)) result.gender = 'Nam';
      else if (/nữ\b/i.test(next || line)) result.gender = 'Nữ';
    }

    // Quê quán
    if (/quê\s*quán|place\s*of\s*origin/i.test(line) && next) {
      result.hometown = next;
    }

    // Nơi thường trú
    if (/nơi\s*thường\s*trú|place\s*of\s*residence/i.test(line) && next) {
      result.address = next;
    }

    // Ngày cấp
    if (/ngày\s*cấp|date\s*of\s*issue/i.test(line)) {
      const m = (next || line).match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/);
      if (m) result.issue_date = parseDate(m[0]);
    }

    // Ngày hết hạn
    if (/có\s*giá\s*trị\s*đến|ngày\s*hết\s*hạn|expiry|valid\s*until/i.test(line)) {
      const m = (next || line).match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/);
      if (m) result.expiry_date = parseDate(m[0]);
    }
  }

  return result;
}
```

### 4.4 Pipeline điều phối — `pipeline.ts`

```typescript
// packages/symflow-runtime/src/ocr/pipeline.ts
import { preprocessImage } from './preprocess';
import { TesseractProvider } from './providers/tesseract';
import { extractIdCardFields } from './extractor';
import type { IdCardFields, OcrProvider } from './types';

export interface PipelineOptions {
  confidenceThreshold?: number;          // default 0.85
  serverFallbackProvider?: OcrProvider;  // nếu không set → không fallback lên server
  onProgress?: (stage: string) => void;
}

export async function runIdCardOcrPipeline(
  file: File | Blob,
  opts: PipelineOptions = {}
): Promise<{ fields: IdCardFields; confidence: number; engine: string }> {
  const { confidenceThreshold = 0.85, serverFallbackProvider, onProgress } = opts;

  onProgress?.('Đang tiền xử lý ảnh...');
  const processed = await preprocessImage(file);

  onProgress?.('Đang nhận dạng chữ (local)...');
  const localProvider = new TesseractProvider();
  const localResult = await localProvider.recognize(processed);

  let ocrResult = localResult;

  if (localResult.averageConfidence < confidenceThreshold && serverFallbackProvider) {
    onProgress?.('Ảnh khó đọc — đang dùng OCR server...');
    // Gửi ảnh gốc (không qua preprocess) để server tự xử lý
    ocrResult = await serverFallbackProvider.recognize(file);
  }

  onProgress?.('Đang trích xuất thông tin...');
  const fields = extractIdCardFields(ocrResult.rawText);

  return {
    fields,
    confidence: ocrResult.averageConfidence,
    engine: ocrResult.engine,
  };
}
```

---

## 5. Tích hợp vào Symflow Node

### 5.1 JSON DSL Node definition

```json
{
  "id": "extract_id_card",
  "type": "id_card_ocr",
  "inputs": {
    "image": { "from": "upload_step.output.file" }
  },
  "config": {
    "confidence_threshold": 0.85,
    "fallback_provider": "none",
    "fields": ["full_name", "dob", "id_number", "address"]
  },
  "outputs": {
    "fields": "object",
    "confidence": "number",
    "engine_used": "string"
  }
}
```

### 5.2 Svelte Component — `IdCardOcrNode.svelte`

```svelte
<!-- services/symflow-web/src/lib/components/nodes/IdCardOcrNode.svelte -->
<script lang="ts">
  import { runIdCardOcrPipeline } from '$lib/ocr/pipeline';
  import type { IdCardFields } from '$lib/ocr/types';

  export let onResult: (fields: IdCardFields) => void;

  let status = '';
  let confidence = 0;
  let engine = '';
  let fields: IdCardFields = {};

  async function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const result = await runIdCardOcrPipeline(file, {
      onProgress: (s) => (status = s),
    });
    fields = result.fields;
    confidence = result.confidence;
    engine = result.engine;
    onResult(fields);
  }
</script>

<div class="ocr-node">
  <input type="file" accept="image/*" on:change={handleFile} capture="environment" />
  {#if status}<p class="status">{status}</p>{/if}
  {#if fields.id_number}
    <dl class="fields">
      {#each Object.entries(fields).filter(([, v]) => v) as [key, val]}
        <dt>{key}</dt><dd>{val}</dd>
      {/each}
    </dl>
    <p class="meta">
      Confidence: {(confidence * 100).toFixed(1)}% · Engine: {engine}
    </p>
  {/if}
</div>
```

---

## 6. Phụ thuộc (Dependencies)

### 6.1 NPM packages cần thêm

```bash
# packages/symflow-runtime/
npm install tesseract.js@^5

# services/symflow-web/ (nếu dùng trực tiếp trong UI)
npm install tesseract.js@^5
```

> Tesseract.js v5 tải `vie.traineddata` (~4 MB) và `eng.traineddata` (~10 MB).  
> Sau lần đầu, model được cache trong IndexedDB — không cần tải lại.

### 6.2 Vite config — cho phép Worker và tắt optimization

```typescript
// services/symflow-web/vite.config.ts — thêm vào defineConfig({...})
worker: {
  format: 'es',
},
optimizeDeps: {
  exclude: ['tesseract.js'],
},
```

---

## 7. Tương thích trình duyệt

| Tính năng | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| WebAssembly | ✅ | ✅ | ✅ | ✅ |
| `createImageBitmap` | ✅ | ✅ | ✅ v15+ | ✅ |
| IndexedDB (model cache) | ✅ | ✅ | ✅ | ✅ |
| `capture="environment"` | ✅ | ✅ | ✅ | ✅ |
| WebGPU (tương lai) | ✅ v113+ | Partial | ❌ | ✅ v113+ |

Tesseract.js Wasm chạy hoàn toàn trên CPU — không cần WebGPU, tương thích rộng.

---

## 8. Bảo mật và Quyền riêng tư

- **Tầng 1 & 2 (local)**: ảnh **không rời thiết bị** người dùng. Không có request nào đến server.
- **Tầng 3B (server fallback)**: chỉ kích hoạt khi:
  - confidence < threshold VÀ
  - Người dùng đã bật tùy chọn trong settings VÀ
  - Hiển thị dialog xác nhận rõ ràng: *"Ảnh sẽ được gửi lên server để xử lý. Bạn có đồng ý không?"*
- Không lưu ảnh vào `localStorage` hay `IndexedDB`. Chỉ lưu model weights.
- Kết quả JSON (fields) nên được xóa khỏi memory sau khi workflow hoàn thành nếu không cần persist.
- Không log giá trị `id_number`, `dob` ra console trong production build.

---

## 9. Các trường hợp cạnh (Edge Cases)

| Tình huống | Xử lý đề xuất |
|---|---|
| Ảnh bị mờ, lóa sáng | confidence thấp → hiển thị cảnh báo, gợi ý chụp lại |
| Ảnh chụp nghiêng > 15° | Thêm bước deskew trước preprocess (dùng OpenCV.js) |
| CMND 9 số vs CCCD 12 số | Regex phân biệt theo độ dài |
| Thẻ nước ngoài / hộ chiếu | `id_type = UNKNOWN`, trả `rawText` để xử lý thủ công |
| File không phải ảnh | Validate MIME type trước khi đưa vào pipeline |
| Ảnh PNG có nền trong suốt | Merge lên nền trắng trước khi grayscale |
| Số CCCD bị OCR nhầm O↔0, l↔1 | Post-process: replace O→0 trong chuỗi số |

---

## 10. Task Checklist

### 10.1 Frontend / TypeScript

- [ ] Tạo `packages/symflow-runtime/src/ocr/types.ts`
- [ ] Tạo `packages/symflow-runtime/src/ocr/preprocess.ts`
- [ ] Tạo `packages/symflow-runtime/src/ocr/providers/tesseract.ts`
- [ ] Tạo `packages/symflow-runtime/src/ocr/extractor.ts`
- [ ] Tạo `packages/symflow-runtime/src/ocr/pipeline.ts`
- [ ] Tạo `packages/symflow-runtime/src/ocr/index.ts` — export public API
- [ ] `npm install tesseract.js@^5` vào `packages/symflow-runtime`
- [ ] Cập nhật `services/symflow-web/vite.config.ts`
- [ ] Tạo `services/symflow-web/src/lib/components/nodes/IdCardOcrNode.svelte`
- [ ] Đăng ký node type `id_card_ocr` vào node registry của Symflow

### 10.2 Backend / Rust (chỉ cần nếu bật server fallback)

- [ ] Thêm migration `0006_create_ocr_results.sql`
- [ ] Tạo endpoint `POST /api/ocr/id-card` — nhận `multipart/form-data`, trả JSON fields
- [ ] Tích hợp provider: Google Vision API hoặc Azure Document Intelligence
- [ ] Đảm bảo ảnh không lưu vĩnh viễn — xử lý in-memory, không ghi disk

### 10.3 Testing

- [ ] Unit test `extractor.ts` với các text mẫu từ CCCD thật / synthetic
- [ ] Integration test pipeline với ảnh thẻ mẫu (dùng ảnh synthetic, không dùng ảnh thật)
- [ ] Benchmark thời gian chạy trên mobile mid-range (mục tiêu: < 3 giây end-to-end)
- [ ] Test fallback logic khi confidence < threshold

---

## 11. Mở rộng tương lai

- **WebGPU acceleration**: khi WebGPU stable trên Safari, chuyển sang `onnxruntime-web` với backend WebGPU — tăng tốc OCR ~5–10x.
- **PaddleOCR ONNX**: chuyển đổi PaddleOCR sang ONNX, chạy qua `onnxruntime-web` — độ chính xác cao hơn Tesseract trên tiếng Việt in hoa.
- **Camera live preview**: tích hợp camera stream với auto-capture khi detect thẻ trong khung hình (TensorFlow.js object detection).
- **MRZ parsing**: đọc Machine Readable Zone ở đáy hộ chiếu bằng regex tiêu chuẩn ICAO 9303.
- **Provider plugin system**: chuẩn hóa `OcrProvider` như một Symflow plugin — người dùng tự cài thêm engine mà không cần rebuild core.
