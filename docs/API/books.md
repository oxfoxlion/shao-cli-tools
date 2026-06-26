# Books Service API 文件

Base URL：`/books`  
資料來源：[Gutendex](https://gutendex.com)（Project Gutenberg JSON API，無需 API key）

---

## 概覽

後端作為 Gutendex 的代理層，同時從 gutenberg.org 抓取純文字內容並以行陣列分頁回傳。
CLI 端依 `process.stdout.rows` 決定顯示視窗大小，在後端頁內滾動；讀完才打下一頁。

---

## 資料型別

### BookSummary

```json
{
  "id": 2701,
  "title": "Moby Dick; Or, The Whale",
  "authors": ["Herman Melville"],
  "languages": ["en"],
  "hasText": true
}
```

`hasText: true` 代表後端確認此書有可用的純文字格式。

### BookDetail

```json
{
  "id": 2701,
  "title": "Moby Dick; Or, The Whale",
  "authors": ["Herman Melville"],
  "subjects": ["Whaling -- Fiction"],
  "languages": ["en"],
  "hasText": true
}
```

---

## 端點

### GET /books/search

搜尋書籍，代理 Gutendex `/books`。

**Query Parameters**

| 參數 | 必填 | 說明 |
|------|:----:|------|
| `q` | ✅ | 關鍵字（書名、作者） |
| `lang` | | 語言代碼（`en`、`zh` 等），預設不限 |
| `page` | | 第幾頁，預設 `1`（Gutendex 每頁 32 筆） |

**Response 200**

```json
{
  "count": 1234,
  "next": true,
  "results": [
    {
      "id": 2701,
      "title": "Moby Dick; Or, The Whale",
      "authors": ["Herman Melville"],
      "languages": ["en"],
      "hasText": true
    }
  ]
}
```

---

### GET /books/:id

取得單本書的詳細資訊。

**Response 200**

```json
{
  "id": 2701,
  "title": "Moby Dick; Or, The Whale",
  "authors": ["Herman Melville"],
  "subjects": ["Whaling -- Fiction"],
  "languages": ["en"],
  "hasText": true
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到書籍 |

---

### GET /books/:id/content

取得書籍內文（純文字，以行陣列回傳）。

**Query Parameters**

| 參數 | 必填 | 說明 |
|------|:----:|------|
| `page` | | 第幾頁，預設 `1` |

**分頁規則**

- 後端每頁固定回傳 **200 行**
- CLI 依 `process.stdout.rows` 切顯示視窗並滾動
- 讀完 200 行再打 `?page=2` 取下一塊

**Response 200**

```json
{
  "page": 1,
  "totalPages": 47,
  "lines": [
    "CHAPTER 1. Loomings.",
    "",
    "Call me Ishmael. Some years ago—never mind how long precisely—..."
  ]
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到書籍 |
| 400 | `page` 超出範圍，附帶 `totalPages` |
| 422 | 無純文字版本（`hasText: false`） |
| 502 | Gutendex 或 gutenberg.org 無回應 |

---

## Format Fallback

後端從 Gutendex `formats` 欄位依以下優先序挑選下載 URL：

1. `text/plain; charset=utf-8`
2. `text/plain; charset=us-ascii`
3. `text/plain`
4. 以上皆無 → 回傳 422

---

## In-Memory Cache

| 項目 | 值 |
|------|-----|
| 結構 | `Map<bookId, { lines: string[], cachedAt: number }>` |
| TTL | 60 分鐘 |
| 清理時機 | 每次讀取時檢查 `cachedAt`，過期則重新抓取 |
| 重啟後 | cache 清空，下次讀取重新從 gutenberg.org 下載 |

---

## CLI 整合流程（參考）

```
搜尋畫面 → GET /books/search?q=...
選書     → GET /books/:id          （確認 hasText）
閱讀     → GET /books/:id/content?page=1
           ↓ 拿到 200 行
           CLI 以 stdout.rows 切視窗，j/k 或 ↑↓ 滾動
           到底 → GET /books/:id/content?page=2
```
