# Refactor: Replace Tesseract.js with HuggingFace Vision API

> Scope: replace Layer 2 (local Wasm OCR) with an API call to the HuggingFace Inference Router  
> Model: `Qwen/Qwen2.5-VL-7B-Instruct` (vision-language model)  
> Endpoint: `https://router.huggingface.co/v1/chat/completions`  

---

## 1. Why Switch

Tesseract.js runs in the browser (Wasm/CPU) — correct in principle but limited in practice:

- Downloads ~14 MB of model files on first use
- Poor accuracy on blurry, skewed, or glare-affected images
- No understanding of card layout context

`Qwen2.5-VL-7B-Instruct` is a vision-language model — it receives an image and returns structured text based on a prompt. Accuracy is significantly higher, especially for Vietnamese ID cards.

**Main trade-off:** the image is sent to HuggingFace (no longer offline). Users must be informed.

---

## 2. Architecture Change

### Before (Tesseract Wasm)

```
Image → preprocess → TesseractProvider (Wasm, local) → rawText → extractor → JSON
```

### After (HF Vision API)

```
Image → preprocess → HuggingFaceVisionProvider (API call) → rawText → extractor → JSON
```

`pipeline.ts` and `extractor.ts` **stay unchanged**. Only the provider is swapped.

---

## 3. Files to Create / Modify

### 3.1 Create: `providers/hf-vision.ts`

This file implements the `OcrProvider` interface (already defined in `types.ts`).

**Flow:**

1. Receive `image: Blob`
2. Convert to base64 data URL using `FileReader.readAsDataURL`
3. Call `POST https://router.huggingface.co/v1/chat/completions`
4. In the body: set `image_url.url` to the base64 data URL (no need to host the image publicly)
5. Prompt the model to return a specific JSON structure
6. Parse `choices[0].message.content` → return `OcrResult`

**Request body structure:**

```
{
  model: "Qwen/Qwen2.5-VL-7B-Instruct:featherless-ai",
  stream: false,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "<prompt>" },
        { type: "image_url", image_url: { url: "<base64 data url>" } }
      ]
    }
  ]
}
```

**Recommended prompt** (structured extraction):

```
This is a Vietnamese national ID card (CCCD/CMND). Extract the following fields and return valid JSON only, with no additional text:

{
  "full_name": "...",
  "dob": "DD/MM/YYYY",
  "gender": "Male | Female",
  "nationality": "...",
  "hometown": "...",
  "address": "...",
  "id_number": "...",
  "issue_date": "DD/MM/YYYY",
  "expiry_date": "DD/MM/YYYY",
  "id_type": "CCCD | CMND"
}

If a field cannot be read, set its value to null.
```

**Response handling:**

- Model returns a JSON string inside `content` → `JSON.parse(content)`
- If parsing fails → fallback: use `content` as `rawText`, pass through `extractor.ts` as usual
- Set `averageConfidence = 0.95` (hardcoded — the API does not return a confidence score)
- Set `engine = 'hf-vision'`

**Important note on base64 conversion:**

```typescript
// Use FileReader instead of URL.createObjectURL
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

The resulting data URL looks like `data:image/png;base64,iVBORw0KGgo...` — this is the value placed in `image_url.url`.

---

### 3.2 Modify: `types.ts`

Add `'hf-vision'` to the `engine` union type:

```typescript
// Before
engine: 'tesseract' | 'paddle' | 'vision-api' | 'azure' | 'google-doc-ai';

// After
engine: 'tesseract' | 'hf-vision' | 'paddle' | 'vision-api' | 'azure' | 'google-doc-ai';
```

---

### 3.3 Modify: `pipeline.ts`

Replace `TesseractProvider` with `HuggingFaceVisionProvider` as the primary provider.

Replace this:

```typescript
const localProvider = new TesseractProvider();
const localResult = await localProvider.recognize(processed);
```

With:

```typescript
const provider = new HuggingFaceVisionProvider({ token: opts.hfToken });
const localResult = await provider.recognize(processed);
```

Update `PipelineOptions` to accept `hfToken`:

```typescript
export interface PipelineOptions {
  hfToken: string;                       // required when using the HF provider
  confidenceThreshold?: number;
  serverFallbackProvider?: OcrProvider;
  onProgress?: (stage: string) => void;
}
```

---

### 3.4 Handling HF_TOKEN — never expose it in the frontend bundle

`HF_TOKEN` is a secret and must **not** be hardcoded into the frontend bundle. Two options:

**Option A — Proxy through the Symflow API (recommended):**

```
Browser → POST /api/ocr/proxy → Symflow API (Rust) → HF API
```

- The frontend calls the internal endpoint `/api/ocr/proxy` without knowing the token
- The Rust backend holds `HF_TOKEN` as an environment variable
- The backend forwards the request to HuggingFace

Changes required:
- Add endpoint `POST /api/ocr/proxy` in `symflow-api`
- Frontend calls `/api/ocr/proxy` instead of `router.huggingface.co` directly

**Option B — User-supplied token:**

- Let the user paste their own `HF_TOKEN` in the Settings UI
- Store in `sessionStorage` (not `localStorage`)
- Frontend passes the token via `PipelineOptions.hfToken`
- Token is cleared when the user closes the tab

Option B is simpler to start with but shifts the burden of token management to the user.

---

### 3.5 Modify: `IdCardOcrNode.svelte`

Pass `hfToken` into `runIdCardOcrPipeline`:

```svelte
<!-- receive token from store or props -->
export let hfToken: string;

const result = await runIdCardOcrPipeline(file, {
  hfToken,
  onProgress: (s) => (status = s),
});
```

Add a disclosure notice before calling: *"This image will be sent to HuggingFace for processing."*

---

## 4. File Diff Summary

| File | Action | What changes |
|---|---|---|
| `providers/hf-vision.ts` | **Create** | Implement `OcrProvider` calling the HF API |
| `providers/tesseract.ts` | Keep as-is | Still usable as an offline fallback |
| `types.ts` | **Minor edit** | Add `'hf-vision'` to the `engine` union |
| `pipeline.ts` | **Edit** | Use `HuggingFaceVisionProvider` as primary, add `hfToken` to options |
| `extractor.ts` | No change | Regex logic still used to parse failed JSON or rawText |
| `preprocess.ts` | No change | Still resizes/grayscales before the API call |
| `IdCardOcrNode.svelte` | **Minor edit** | Pass `hfToken`, add disclosure UI |
| `symflow-api` (Rust) | Optional | If using Option A: add `/api/ocr/proxy` endpoint |

---

## 5. Implementation Checklist

- [ ] Create `providers/hf-vision.ts` with `HuggingFaceVisionProvider`
- [ ] Add `blobToDataUrl` helper (can go in `preprocess.ts` or a new `utils.ts`)
- [ ] Add `'hf-vision'` to the `engine` union in `types.ts`
- [ ] Update `pipeline.ts` — swap primary provider + add `hfToken` to options
- [ ] Decide on Option A or B for token handling, then implement
- [ ] Update `IdCardOcrNode.svelte` — pass token + add disclosure message
- [ ] Test with a real or synthetic ID card image to confirm JSON output structure
- [ ] Handle the case where the model returns text instead of plain JSON (extract JSON from markdown code fence if needed)

---

## 6. Notes on Response Format

`Qwen2.5-VL` sometimes wraps JSON inside a markdown code fence:

````
```json
{ "full_name": "...", ... }
```
````

Handle this case:

```typescript
function parseModelResponse(content: string): IdCardFields | null {
  // Try direct parse first
  try { return JSON.parse(content); } catch {}

  // Try extracting from a markdown code block
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }

  // Fallback: return null, let extractor.ts handle content as rawText
  return null;
}
```
