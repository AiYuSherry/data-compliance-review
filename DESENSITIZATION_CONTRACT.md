# 数据脱敏处理接口契约

> 本契约描述独立产品功能线“数据脱敏处理”。它不参与合规风险审查，不生成整改任务，不改变现有审查输出契约。

## 1. 核心数据流

```
用户上传/粘贴待脱敏数据
    ↓
POST /api/desensitize → 返回 task_id
    ↓
SSE /api/progress/{task_id} → 实时进度
    ↓
GET /desensitize/result/{task_id} → 脱敏结果页
```

任务状态中必须包含：

```json
{
  "product_type": "desensitize",
  "status": "completed",
  "result": {
    "desensitized_output": "output/{task_id}/desensitized_output.*",
    "desensitization_report": "output/{task_id}/desensitization_report.json",
    "desensitization_report_md": "output/{task_id}/desensitization_report.md",
    "retention_note": "output/{task_id}/original_retention_note.txt"
  }
}
```

## 2. 输入范围

- 文本粘贴
- 文本文档与配置：`txt`、`md`、`markdown`、`log`、`rtf`、`html`、`htm`、`xml`、`yaml`、`yml`、`toml`、`ini`、`cfg`、`conf`、`env`
- Office/PDF/演示文档：`doc`、`docx`、`pdf`、`pptx`
- 结构化数据：`csv`、`tsv`、`xlsx`、`xls`、`ods`、`json`、`jsonl`、`ndjson`
- 图片：`png`、`jpg`、`jpeg`、`webp`、`bmp`、`tif`、`tiff`

图片和扫描型 PDF 依赖 OCR。macOS 本机需要安装系统 `tesseract`；缺失时图片任务应明确失败，文本、文档、表格任务不受影响。

## 3. 脱敏策略

默认策略为保留格式打码：尽量保留数据形态、字段可读性和基础分析价值，但隐藏主体敏感信息。

| 类型 | 替换值 |
| --- | --- |
| 手机号 | `138****5678` |
| 邮箱 | `te***@example.com` |
| 身份证/证件号 | `110***********1234` |
| 银行卡 | `622202*********1234` |
| IP 地址 | `192.***.***.1` |
| 地址/位置 | `北京市**********8号` |
| 人名 | `张*` |
| 密钥/口令 | `[API_KEY]` / `[PRIVATE_KEY]` |

## 4. 输出文件

| 文件名 | 说明 |
| --- | --- |
| `desensitized_output.*` | 脱敏后的主文件，尽量保留原输入结构 |
| `desensitization_report.json` | 机器可读处理报告 |
| `desensitization_report.md` | 给用户阅读的脱敏说明 |
| `original_retention_note.txt` | 原文件本地留存与残余风险说明 |

下载接口：

- `GET /api/desensitize/download/{task_id}/desensitized_output`
- `GET /api/desensitize/download/{task_id}/desensitization_report`
- `GET /api/desensitize/download/{task_id}/desensitization_report_md`
- `GET /api/desensitize/download/{task_id}/retention_note`

## 5. 报告 JSON Schema

```json
{
  "task_id": "abcd1234",
  "document_name": "用户调研数据",
  "input_name": "survey.xlsx",
  "input_type": "table",
  "status": "completed",
  "strategy": "format_preserving_mask",
  "engine": {
    "presidio_available": true,
    "custom_chinese_rules_enabled": true
  },
  "summary": {
    "total_findings": 12,
    "entity_counts": {
      "PHONE_NUMBER": 5,
      "EMAIL_ADDRESS": 4
    },
    "surface_counts": {
      "xlsx_cell": 9,
      "text": 3
    }
  },
  "output": {
    "file_name": "desensitized_output.xlsx",
    "relative_name": "desensitized_output.xlsx"
  },
  "findings": [
    {
      "entity_type": "PHONE_NUMBER",
      "start": 0,
      "end": 11,
      "score": 0.96,
      "replacement": "138****5678",
      "surface": "xlsx_cell",
      "locator": "Sheet1!phone2",
      "preview": "13***78"
    }
  ],
  "warnings": [],
  "residual_risk": "自动脱敏不能保证识别全部敏感信息，正式外发前仍建议抽样复核。"
}
```

## 6. 错误口径

- 不支持的文件类型：返回 `400` 和 `不支持的脱敏文件类型`
- 图片/OCR 依赖缺失：任务失败，错误信息包含 `tesseract`
- 表格依赖缺失：任务失败，错误信息说明需要 `pandas` / `openpyxl` / `xlrd` / `odfpy`
- PPTX 依赖缺失：任务失败，错误信息说明需要 `python-pptx`
- 自动识别结果只作为脱敏辅助，不承诺覆盖全部敏感信息
