# Books 功能 — CLI 前端串接指南

CLI 直接呼叫外部 API，不經過後端。

| 用途 | 來源 | 需要 API key |
|------|------|:----------:|
| 搜尋 + 書籍詳情 | Gutendex (`gutendex.com`) | 否 |
| 書本全文（.txt） | Project Gutenberg (`gutenberg.org`) | 否 |

---

## 1. 搜尋書籍

```
GET https://gutendex.com/books?search={q}&languages={lang}&page={page}
```

| 參數 | 說明 |
|------|------|
| `search` | 關鍵字（書名、作者） |
| `languages` | 語言代碼，可省略（`en`、`zh` 等） |
| `page` | 頁碼，每頁 32 筆，預設 1 |

**Response**

```json
{
  "count": 1234,
  "next": "https://gutendex.com/books?page=2&search=...",
  "results": [
    {
      "id": 2701,
      "title": "Moby Dick; Or, The Whale",
      "authors": [{ "name": "Melville, Herman", "birth_year": 1819 }],
      "languages": ["en"],
      "formats": {
        "text/plain; charset=utf-8": "https://www.gutenberg.org/files/2701/2701-0.txt",
        "text/html": "...",
        "application/epub+zip": "..."
      }
    }
  ]
}
```

`next` 非 null 代表還有下一頁。

---

## 2. 取得文字 URL

從 `formats` 依優先序挑選純文字 URL：

```ts
function getTextUrl(formats: Record<string, string>): string | null {
  for (const key of [
    'text/plain; charset=utf-8',
    'text/plain; charset=us-ascii',
    'text/plain',
  ]) {
    if (formats[key]) return formats[key]
  }
  return null
}
```

回傳 `null` 代表此書無可閱讀版本，不顯示閱讀入口。

---

## 3. 取得書籍詳情

```
GET https://gutendex.com/books/{id}
```

Response 結構同搜尋結果單筆，含完整 `formats`、`subjects`。

---

## 4. 抓取全文並分頁

一次下載全部行：

```ts
const res = await fetch(textUrl)
const lines = (await res.text()).split('\n')
```

CLI 根據終端高度切 viewport，client-side 滾動：

```ts
const viewHeight = process.stdout.rows - 3
const view = lines.slice(offset, offset + viewHeight)
```

| 按鍵 | 動作 |
|------|------|
| `j` / ↓ | offset += 1 |
| `k` / ↑ | offset -= 1 |
| `d` | offset += viewHeight（PgDn） |
| `u` | offset -= viewHeight（PgUp） |
| `g` | offset = 0（首行） |
| `G` | offset = lines.length - viewHeight（末行） |
| `q` | 離開閱讀 |

offset 需 clamp：`Math.max(0, Math.min(offset, lines.length - viewHeight))`

---

## 5. Feature 結構

```
features/books/
  index.ts    ← 書庫選單、搜尋流程
  client.ts   ← searchBooks、getBook、fetchLines、getTextUrl
  views.ts    ← 搜尋結果列表、書籍詳情
  reader.ts   ← 全文滾動閱讀器
```

---

## 6. 錯誤處理

| 情境 | 做法 |
|------|------|
| `fetch` 拋出 TypeError（離線 / DNS 失敗） | 顯示「無法連線，請確認網路」，不 crash |
| `!res.ok`（4xx / 5xx） | 顯示 HTTP 狀態碼，提示「按任意鍵返回」 |
| `getTextUrl` 回傳 null | 書籍詳情頁顯示「此書無純文字版本」，無閱讀入口 |
