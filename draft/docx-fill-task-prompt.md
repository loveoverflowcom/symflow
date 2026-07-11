# Prompt: thêm task fill DOCX từ dữ liệu và kết quả idCard

## Mục tiêu

Thêm một task mới vào hệ thống Symflow để nhận một file .docx template và một nhóm dữ liệu như:

```json
{
  "fullname": "A B C",
  "age": 1212,
  "address": "",
  "phone": "0123456789"
}
```

Sau đó:
- phân tích nội dung trong file .docx,
- tìm các placeholder / label / field tương ứng trong tài liệu,
- nếu khớp với một trường nào đó trong dữ liệu đầu vào thì tự điền vào file .docx,
- trả về file .docx đã được fill dữ liệu.

Task này có thể dùng kết quả của task idCard làm đầu vào. Ví dụ:

```json
{
  "template": "<base64 hoặc data url của file .docx>",
  "values": {
    "fullname": "A B C",
    "age": 1212,
    "address": "",
    "phone": "0123456789"
  }
}
```

## Yêu cầu chức năng

1. Nhận đầu vào là một file .docx.
2. Nhận thêm một object dữ liệu chứa các thông tin cần fill.
3. Dùng Gemini API để:
   - nhận diện các label/placeholder trong docx,
   - map label đó với key trong object dữ liệu,
   - quyết định giá trị nào nên điền vào đâu.
4. Điền dữ liệu vào file .docx mà vẫn giữ được:
   - text,
   - bảng,
   - form field / content control,
   - blank / placeholder cũ nếu giá trị đầu vào rỗng.
5. Trả về file .docx mới đã được fill.

## Prompt để đưa cho AI/code assistant

Bạn hãy thêm một task mới vào repo Symflow với tên là `docx_fill_fields`.

### Mục tiêu
- Thêm một task để fill dữ liệu vào file .docx từ một object đầu vào.
- Task này nên có thể dùng dữ liệu từ task `id_card_ocr` hoặc từ bất kỳ task nào trả về object JSON.
- Nếu trong tài liệu có các label như `Họ và tên`, `Ngày sinh`, `Địa chỉ`, `Số điện thoại`, ... thì phải tự động map với các key trong object đầu vào và điền giá trị tương ứng.
- Nếu một trường trong object là rỗng hoặc không có dữ liệu thì giữ nguyên placeholder / blank / form control.

### Input schema đề xuất
```json
{
  "type": "object",
  "properties": {
    "template": {
      "type": "string",
      "description": "Base64 hoặc data URL của file .docx"
    },
    "values": {
      "type": "object",
      "description": "Object chứa dữ liệu cần fill, ví dụ fullname, age, address"
    },
    "mapping": {
      "type": "object",
      "description": "Optional mapping giữa label trong docx và key trong values"
    }
  },
  "required": ["template", "values"]
}
```

### Output schema đề xuất
```json
{
  "type": "object",
  "properties": {
    "docx_base64": { "type": "string" },
    "filled_count": { "type": "number" },
    "unmatched_fields": { "type": "array", "items": { "type": "string" } },
    "summary": { "type": "string" }
  },
  "required": ["docx_base64", "filled_count", "unmatched_fields", "summary"]
}
```

### Yêu cầu kỹ thuật
- Hỗ trợ file .docx, không phải .doc.
- Dùng Gemini API để phân tích label và mapping.
- Nếu không dùng Gemini được, task vẫn phải fallback bằng cách dùng heuristic matching (ví dụ normalize text, lower-case, remove dấu, so sánh từ khóa).
- Không làm mất cấu trúc document: tables, headers, footers, comments, form fields phải được giữ nguyên.
- Có thể dùng Python script bên trong task để xử lý .docx vì thao tác với OOXML dễ hơn ở Python (`python-docx` hoặc thư viện zip/xml trực tiếp).
- Nếu task chạy trong runtime Node/TS, có thể gọi Python subprocess từ task implementation.

## Những chỗ cần sửa trong repo

### 1. Thêm task mới
File nên được thêm hoặc chỉnh tại:
- [packages/symflow-runtime/src/tasks/local.ts](packages/symflow-runtime/src/tasks/local.ts)
- hoặc tạo file mới như:
  - [packages/symflow-runtime/src/tasks/docx-fill.ts](packages/symflow-runtime/src/tasks/docx-fill.ts)

### 2. Đăng ký task vào runtime
Chỉnh các file:
- [packages/symflow-runtime/src/index.ts](packages/symflow-runtime/src/index.ts)
- [services/symflow-web/src/lib/runtime.ts](services/symflow-web/src/lib/runtime.ts)

Đảm bảo task mới được export và đăng ký vào registry để có thể gọi từ workflow.

### 3. Thêm xử lý Gemini API
Có thể tái sử dụng pattern từ:
- [packages/symflow-runtime/src/ocr/providers/gemini-vision.ts](packages/symflow-runtime/src/ocr/providers/gemini-vision.ts)
- [services/symflow-api/src/routes.rs](services/symflow-api/src/routes.rs)

Yêu cầu:
- truyền prompt cho Gemini để nó nhận diện placeholder/field trong docx,
- trả về JSON mapping giữa label và field key.

### 4. Xử lý file .docx
Cần có logic để:
- decode base64/data URL,
- lưu tạm file .docx,
- đọc nội dung XML của document.xml,
- điền dữ liệu vào text hoặc content control,
- zip lại thành file .docx mới,
- trả về base64 của file output.

## Gợi ý triển khai thực tế

### Cách dùng với kết quả từ task idCard
Giả sử task `id_card_ocr` trả về:

```json
{
  "fields": {
    "full_name": "A B C",
    "dob": "12/12/1212",
    "address": ""
  }
}
```

Thì task mới có thể nhận đầu vào như:

```json
{
  "template": "<base64>",
  "values": {
    "fullname": "A B C",
    "age": 1212,
    "address": ""
  }
}
```

Hoặc dùng mapping:

```json
{
  "mapping": {
    "Họ và tên": "fullname",
    "Ngày sinh": "age",
    "Địa chỉ": "address"
  }
}
```

## Kết luận

Task này nên được triển khai như một task mới trong runtime, có thể dùng dữ liệu từ `id_card_ocr` làm đầu vào, gọi Gemini API để nhận diện và map field trong file .docx, rồi trả về một file .docx mới đã được điền dữ liệu.
