# PDF Upload Limit Research

Date: 2026-06-17

Purpose: review how adjacent PDF learning, PDF chat, and document AI services describe upload limits so Clever Monkey does not over-explain image-content PDF failures as a simple page-count problem.

## Short Conclusion

The user's concern is correct: for PDFs whose page content must be read visually or by OCR, page count alone is a weak predictor.

Current public policies usually combine several constraints:

- file size
- page count
- extracted text or token budget
- visual/OCR availability
- per-page visual complexity, including image resolution, page dimensions, dense tables, charts, or graphics
- timeout and processing mode, especially synchronous vs background/batch processing

The safest product direction is to keep a conservative hard limit for now, but explain it as an operational safety limit rather than as a universal "PDF page limit". The UI should eventually show a compact preflight diagnosis: page count, file size, text-layer detection, and why this file is expensive to process.

## Service Policies Checked

| Service | Public limit shape | Notes for scanned/image-content PDFs |
| --- | --- | --- |
| Gemini API document processing | PDF up to 50MB or 1000 pages; applies to inline and Files API. Gemini says each page is equivalent to 258 tokens and pages are scaled to max 3072 x 3072. | Our current OCR path depends on this family of limits. A 35MB / 500-page file can still fail below the hard 50MB/1000-page ceiling if internal representation, generation output, recitation, timeout, or density becomes the bottleneck. |
| Gemini Files API | Per-file upload storage can be much larger, but docs still state PDF use in generateContent is limited to 50MB. | Important distinction: successful file upload does not mean successful PDF understanding. |
| ChatGPT / OpenAI ChatGPT uploads | 512MB per file, 2M tokens per text/document file. Non-Enterprise document handling is text-based; embedded images in PDFs are discarded except Enterprise Visual Retrieval. | The policy separates raw upload size from text/token processing and visual retrieval availability. This supports telling users that text PDFs and image-content PDFs are different workloads. |
| Claude chat / project uploads | Chat upload 500MB per file, up to 20 files; project file 30MB. PDFs under 100 pages can include visual elements; large PDFs are advised to be split. | Claude docs explicitly say dense PDFs with small fonts, tables, or heavy graphics can fill context before the page limit, and that each page can be processed as an image. |
| NotebookLM | 500,000 words per source, 200MB file size, 50 sources per notebook. | NotebookLM frames source size by words and file size, not page count. This is a text-oriented policy and is less useful for scanned PDFs unless OCR text exists. |
| Adobe Acrobat AI Assistant | Less than 100MB, up to 600 pages; AI Assistant does not support images or complex vector graphics. | Even a PDF-native product exposes both file and page caps and separately disclaims certain visual content. |
| ChatPDF API | 2,000 pages or 32MB per file. | High page count is allowed only with tight MB cap, which implies a text-oriented or lightweight PDF assumption. |
| AskYourPDF | Free: 100 pages / 15MB. Premium: 2,500 pages / 31MB. Pro: 6,000 pages / 877MB. OCR support starts in paid plans. | Page and MB caps vary together by plan. OCR is a separate capability, not an assumed default for every PDF. |
| Paperpal Chat PDF | Free: 100 pages / 20MB, 5 files/month. Prime: 500 pages / 100MB, 250 files/month. | Academic PDF chat tools still publish both page and file limits. |
| ChatDOC | FAQ exposes per-page token limits: hard limit 14,000 tokens on any page and soft limit of only 10 pages above 10,000 tokens. Free plan has small page limits; Pro has OCR quota. | This is the clearest competitor evidence that page information density matters. |
| PDF.ai API | No page-count limit in some plans, but upload file size caps and a 60-second timeout for PDFs with many pages. | "No page limit" still has file size and timeout constraints. |
| Azure Document Intelligence | Standard tier: max 500MB document size and 2,000 pages for analysis; free tier only first 2 pages. Billing is page-based. | Dedicated OCR infrastructure can handle more, but it is explicitly quota/cost governed. |
| Google Cloud Document AI | Synchronous requests do not support documents above 10 pages for certain processors; batch can process documents up to 200 pages. Pricing is page-based. | Serious OCR pipelines move large work to batch/background processing and cost control. |

## What This Means For Clever Monkey

The current 50-page limit is defensible as a conservative operational cap because the real-file evidence is 50 pages success and 80/100 pages failure. But the user-facing explanation should not imply that "50 pages is the natural PDF limit".

Better framing:

- Text-layer PDFs: page count is usually not the meaningful limit. They are extracted locally and should be governed by extracted text size/token budget and browser performance.
- Page content that must be read from images: page count is only one factor. File size, image resolution, page dimensions, dense visual layout, tables, charts, and OCR output length all affect processing.
- Large image-content PDFs should be treated as a background OCR workload with progress, timeout logging, and split/chunk recommendations.

## Recommended Product Policy

For the next iteration, do not replace page count with file size alone. Use a layered policy:

1. Detect text layer first.
   - If enough text is extractable locally, let the text-PDF path handle it.
   - Explain that this file is processed as text, not OCR.

2. For image-content PDFs, apply hard safety guards.
   - Keep current page cap at 50 until 60-70 page retests produce successful logs.
   - Add an explicit file-size guard aligned with Gemini PDF understanding: 50MB max for image-content PDF OCR.
   - Keep room for a lower operational warning threshold, such as 35-40MB, because successful upload is not the same as successful OCR.

3. Add a risk explanation rather than only a rejection number.
   - Example: "이 PDF는 페이지 안의 글자를 이미지로 읽어야 해서 처리량이 큽니다. 같은 50페이지라도 스캔 해상도, 표/그림 밀도, 판형, 파일 용량에 따라 실패할 수 있습니다."
   - Then show detected values: pages, MB, text-layer probe result.

4. Log and display additional preflight metrics.
   - pageCount
   - fileSizeMB
   - bytesPerPage
   - extractedTextProbeChars
   - image-content classification reason
   - eventual OCR duration and last progress stage

5. Long term: chunk OCR rather than relying on a single whole-document OCR call.
   - Preserve the existing `queued -> ocr_ready -> done/error` contract.
   - Start with feature-flagged page-range chunks.
   - Cache per-page or per-range OCR results to avoid repeated cost.

## Implementation Note

Implemented on 2026-06-17:

- `utils/pdfPreflightCheck.ts` keeps the 50-page ceiling for image-content PDFs.
- It now also rejects image-content PDFs over 50MB before storage upload.
- Preflight diagnostics now include `fileSizeBytes`, `bytesPerPage`, and risk flags for files near the OCR size limit or with high bytes per page.
- Text-layer PDFs remain exempt from these image-content OCR guards.

## Suggested User Copy

For hard rejection:

> 이 PDF는 페이지의 내용을 이미지로 읽어야 하는 형식이라 처리량이 큽니다. 현재 안정적인 처리를 위해 이런 PDF는 50페이지 이하로 나누어 업로드해 주세요. 같은 페이지 수라도 스캔 해상도, 표/그림 밀도, 판형, 파일 용량에 따라 처리 시간이 크게 달라질 수 있습니다.

For warning before upload:

> 이 파일은 텍스트를 바로 추출하기 어렵고, 페이지 이미지를 분석해야 할 가능성이 높습니다. 큰 파일은 처리 시간이 길거나 실패할 수 있으니 단원/장 단위로 나누면 더 안정적입니다.

## Sources

- Gemini API document processing: https://ai.google.dev/gemini-api/docs/document-processing
- Gemini Files API: https://ai.google.dev/gemini-api/docs/files
- OpenAI File Uploads FAQ: https://help.openai.com/en/articles/8555545-file-uploads-faq
- Claude file upload help: https://support.claude.com/en/articles/8241126-upload-files-to-claude
- Claude PDF support: https://platform.claude.com/docs/en/build-with-claude/pdf-support
- Claude vision docs: https://platform.claude.com/docs/en/build-with-claude/vision
- NotebookLM FAQ: https://support.google.com/notebooklm/answer/16269187
- Adobe Acrobat AI technical requirements: https://helpx.adobe.com/acrobat/desktop/use-acrobat-ai/get-started-with-generative-ai/ai-tech-requirements.html
- ChatPDF API docs: https://www.chatpdf.com/docs/api/backend
- AskYourPDF pricing: https://askyourpdf.com/pricing
- Paperpal Chat PDF limits: https://support.paperpal.com/support/solutions/articles/3000135639-does-paperpal-chat-pdf-have-any-file-limits-
- ChatDOC FAQ: https://chatdoc.com/blog/chatdoc-faqs/
- PDF.ai API limits: https://api.pdf.ai/v1/api-limits
- Azure Document Intelligence limits: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits
- Google Cloud Document AI pricing and batch note: https://cloud.google.com/document-ai/pricing
- PDF Association AI and PDF FAQ: https://pdfa.org/faq-ai-and-pdf/
