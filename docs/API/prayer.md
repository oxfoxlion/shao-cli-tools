# Prayer Journal API

Base URL：`/prayer`

## 認證

所有 endpoint 需要 `good_calendar_session` cookie（與好事日曆相同登入系統）。
未登入回傳 `401 { "message": "請先登入" }`。

---

## 禱告本 Books

### GET /prayer/books
列出目前使用者的所有禱告本。
**Response 200** `{ "books": [{ "id", "title", "description", "created_at", "updated_at" }] }`

### POST /prayer/books
新增禱告本。Body: `{ "title": "晨禱", "description"?: "..." }`
**Response 201** `{ "book": { ... } }` / **400** title 為空

### GET /prayer/books/:bookId
**Response 200** `{ "book": { ... } }` / **404**

### PUT /prayer/books/:bookId
更新標題或描述（僅更新有帶的欄位）。
**Response 200** / **404**

### DELETE /prayer/books/:bookId
刪除禱告本（連同底下所有禱告記錄）。
**Response 200** `{ "message": "已刪除" }` / **404**

---

## 禱告事項 Items

### GET /prayer/items
Query: `book_id`, `recurrence`, `is_answered`, `is_archived`（不帶時預設只顯示未封存）
**Response 200** `{ "items": [{ "id", "book_id", "title", "content", "recurrence", "recurrence_config", "is_answered", "is_archived", "created_at", "updated_at" }] }`

### POST /prayer/items
Body: `{ "title", "content"?, "book_id"?, "recurrence"?: "once|daily|weekly|monthly|custom", "recurrence_config"? }`
**Response 201** / **400**

### GET /prayer/items/:itemId
**Response 200** / **404**

### PUT /prayer/items/:itemId
更新（僅更新有帶的欄位）。**Response 200** / **400** / **404**

### DELETE /prayer/items/:itemId
**Response 200** `{ "message": "已刪除" }`

### POST /prayer/items/:itemId/answer
切換「已應允」狀態（toggle）。
**Response 200** `{ "item": { "id", "is_answered" } }` / **404**

### POST /prayer/items/:itemId/archive
切換「封存」狀態（toggle）。
**Response 200** `{ "item": { "id", "is_archived" } }` / **404**

---

## 禱告記錄 Entries

路徑前綴：`/prayer/books/:bookId/entries`

### GET /prayer/books/:bookId/entries
Query: `limit`（預設 20，最多 100）、`before`（ISO 8601，游標分頁）
**Response 200** `{ "entries": [{ "id", "book_id", "content", "prayed_at", "created_at", "updated_at" }] }`

### POST /prayer/books/:bookId/entries
Body: `{ "content"?, "prayed_at"?（ISO 8601，預設現在）, "item_ids"?: ["uuid",...] }`
**Response 201** `{ "entry": { ..., "items": [] } }` / **404**

### GET /prayer/books/:bookId/entries/:entryId
**Response 200** `{ "entry": { ..., "items": [{ "id", "title", "content", "recurrence", "is_answered" }] } }` / **404**

### PUT /prayer/books/:bookId/entries/:entryId
Body: `{ "content"?, "prayed_at"? }` **Response 200** / **404**

### DELETE /prayer/books/:bookId/entries/:entryId
**Response 200** `{ "message": "已刪除" }` / **404**

### PUT /prayer/books/:bookId/entries/:entryId/items
全量取代連結事項。Body: `{ "item_ids": ["uuid",...] }` 傳 `[]` 清除所有連結。
**Response 200** `{ "message": "已更新連結事項" }` / **403**
