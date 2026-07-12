export const DEFAULT_WORKFLOW_SOURCE = `import {
  csvCreate,
  docxFillFields,
  idCardOcr,
  pdfReport,
} from '@symflow/runtime';
import type { WorkflowFile } from '@symflow/runtime';

export interface Input {
  /** Choose a CCCD image file, or pass a URL in code mode. */
  image: WorkflowFile;

  /** Choose a DOCX template file, or pass a URL/base64 value in code mode. */
  template: WorkflowFile;
}

export async function main(input: Input) {
  const ocr = await idCardOcr({
    image: input.image,
    fields: [
      'full_name',
      'dob',
      'gender',
      'nationality',
      'hometown',
      'address',
      'id_number',
      'issue_date',
      'expiry_date',
      'id_type',
    ],
  });

  const row = {
    ...ocr.fields,
    confidence: ocr.confidence,
    engine_used: ocr.engine_used,
  };

  const filledDoc = await docxFillFields({
    template: input.template,
    values: ocr.fields,
  });

  const { csv } = await csvCreate({
    rows: [row],
  });

  const pdf = await pdfReport({
    title: \`ID Card OCR - \${row.full_name ?? 'Unknown'}\`,
    filename: 'id-card-report.pdf',
    rows: [row],
    csv,
    content: \`
# ID Card OCR Report

## Extracted Fields

- Full name: \${row.full_name ?? ''}
- ID Number: \${row.id_number ?? ''}
- ID Type: \${row.id_type ?? ''}
- Date of Birth: \${row.dob ?? ''}
- Gender: \${row.gender ?? ''}
- Nationality: \${row.nationality ?? ''}
- Hometown: \${row.hometown ?? ''}
- Address: \${row.address ?? ''}
- Issue Date: \${row.issue_date ?? ''}
- Expiry Date: \${row.expiry_date ?? ''}

---

OCR Confidence: \${ocr.confidence}

Engine: \${ocr.engine_used}

---

## DOCX Fill Result

Filled fields: \${filledDoc.filled_count}

Summary:
\${filledDoc.summary}

\${
  filledDoc.unmatched_fields.length > 0
    ? \`### Unmatched Fields

\${filledDoc.unmatched_fields.map((field) => \`- \${field}\`).join('\\n')}
\`
    : ''
}

---

## Raw OCR Text

\${ocr.raw_text}
\`,
  });

  return {
    fields: ocr.fields,
    confidence: ocr.confidence,
    engine_used: ocr.engine_used,
    docx: filledDoc.docx_base64,
    filled_count: filledDoc.filled_count,
    unmatched_fields: filledDoc.unmatched_fields,
    fill_summary: filledDoc.summary,
    csv,
    pdf,
  };
}
`;

export const DEFAULT_RUN_INPUT_SOURCE = `import type { main } from './workflow';

type WorkflowInput = Parameters<typeof main>[0];

const input: WorkflowInput = {
  image: '',
  template: ''
};

export default input;
`;
