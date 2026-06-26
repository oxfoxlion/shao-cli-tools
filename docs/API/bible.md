# 聖經閱讀 API 文件

Base URL：`/bible`

## 版本參數

以下端點支援 `?version=` query 參數（預設 `cuv`）：

| 值 | 說明 | 來源 |
|----|------|------|
| `cuv` | 和合本（繁體中文，預設） | 本機 DB |
| `kjv` | King James Version | 本機 DB |
| `esv` | English Standard Version | Crossway API（需設定 `ESV_API_KEY`） |

`version` 同時影響回傳的書卷名稱（`name`）與節次文字（`text`）。`cuv` 回傳中文書卷名；`kjv` / `esv` 回傳英文書卷名。

---

## ESV 使用規範（Crossway API v3）

> 使用 `version=esv` 的前端與後端開發者均須遵守以下規範。

### 版權聲明

前端**每次顯示 ESV 文字時**必須附上版權聲明：

```
Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®),
copyright © 2001 by Crossway, a publishing ministry of Good News Publishers.
Used by permission. All rights reserved.
```

API 回應中的 `version=esv` 章節資料已附帶 `copyright` 欄位，前端請直接顯示。

### 使用限制

| 項目 | 限制 |
|------|------|
| 用途 | **僅限非商業使用** |
| 單次查詢上限 | 500 節，或半本書（取較少者） |
| 單頁顯示上限 | 500 節，或半本書（取較少者） |
| 本機儲存上限 | 500 節，或半本書（取較少者）—— **本服務不在 DB 儲存 ESV 文字** |
| 轉發上限 | 500 節，且不得超過該書 50%、也不得超過轉發內容總字數 50% |

### 頻率限制

| 時間窗口 | 上限 |
|---------|------|
| 每分鐘 | 60 次 |
| 每小時 | 1,000 次 |
| 每天 | 5,000 次 |

超過限制時 API 將被 throttle，回傳 429。

---

## 認證機制

共用 `good_calendar_session` Cookie（同一組帳號）。需要登入的端點在說明中標示 **🔒 需登入**。

跨域前端需設定：

```js
fetch(url, { credentials: "include" })
```

---

## 資料型別

### Book

```json
{
  "id": "john",
  "name": "約翰福音",
  "testament": "new",
  "chapters": 21
}
```

`testament`：`"old"` 舊約 / `"new"` 新約。`name` 隨 `version` 不同回傳中文或英文。

### Verse

```json
{
  "verse": 1,
  "text": "起初，神創造天地。"
}
```

### Chapter

```json
{
  "book_id": "gen",
  "book_name": "創世記",
  "chapter": 1,
  "version": "cuv",
  "verses": [ { ...Verse } ]
}
```

`version=esv` 時額外附帶：

```json
{
  "copyright": "Scripture quotations are from the ESV® Bible...",
  ...
}
```

前端顯示 ESV 文字時**必須**一併顯示 `copyright` 內容。

### SearchVerse

```json
{
  "book_id": "john",
  "book_name": "約翰福音",
  "chapter": 3,
  "verse": 16,
  "text": "「神愛世人，甚至將他的獨生子賜給他們...」"
}
```

> **注意**：`version=esv` 時搜尋結果來自 Crossway API，`book_id` 固定為 `null`，僅有 `book_name`（英文）。

### Plan

```json
{
  "id": "one-year",
  "title": "一年讀完聖經",
  "description": "每天約 3 章，一年走完舊約與新約全本",
  "total_days": 365
}
```

可用計劃 ID：

| id | 名稱 | 天數 |
|----|------|------|
| `one-year` | 一年讀完聖經 | 365 |
| `new-testament-90` | 新約 90 天 | 90 |
| `psalms-30` | 詩篇 30 天 | 30 |
| `four-gospels-45` | 四福音書 45 天 | 45 |

### DayReading

```json
{
  "day": 1,
  "passages": [
    { "book_id": "gen", "book_name": "創世記", "chapter": 1 },
    { "book_id": "gen", "book_name": "創世記", "chapter": 2 }
  ]
}
```

### UserPlan

```json
{
  "id": "uuid",
  "plan_id": "one-year",
  "start_date": "2026-06-25",
  "is_active": true,
  "created_at": "ISO 8601 datetime",
  "plan": { ...Plan }
}
```

### Annotation

```json
{
  "id": "uuid",
  "book_id": "john",
  "chapter": 3,
  "verse": 16,
  "note": "神愛世人的經典節次",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

---

## 書卷與章節 `/bible`

### GET /bible/books

列出全部 66 本書卷。

**Query Parameters**

| 參數 | 必填 | 說明 |
|------|------|------|
| `version` | 否 | `cuv`（預設）、`kjv`、`esv` |

**Response 200**

```json
{
  "books": [ { ...Book } ]
}
```

---

### GET /bible/books/:bookId

取得單一書卷資訊。

**Path Parameter**：`bookId`（例：`gen`、`john`、`ps`）

**Query Parameters**

| 參數 | 必填 | 說明 |
|------|------|------|
| `version` | 否 | `cuv`（預設）、`kjv`、`esv` |

**Response 200**

```json
{
  "book": { ...Book }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到書卷 |

---

### GET /bible/books/:bookId/chapters/:chapter

取得指定章節的所有節次。

**Path Parameters**

| 參數 | 說明 |
|------|------|
| `bookId` | 書卷 ID（例：`john`） |
| `chapter` | 章次（正整數） |

**Query Parameters**

| 參數 | 必填 | 說明 |
|------|------|------|
| `version` | 否 | `cuv`（預設）、`kjv`、`esv` |

**Response 200**

```json
{
  "chapter": { ...Chapter }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到書卷、章次超出範圍，或 DB 尚無該版本資料 |
| 500 | `version=esv` 時 Crossway API 呼叫失敗（金鑰無效等） |

---

### GET /bible/search

搜尋包含關鍵字的節次，最多回傳 100 筆。

`version=esv` 時透過 Crossway 搜尋 API，其餘版本查詢本機 DB（LIKE 搜尋）。

**Query Parameters**

| 參數 | 必填 | 說明 |
|------|------|------|
| `q` | 是 | 關鍵字，至少 2 個字 |
| `version` | 否 | `cuv`（預設）、`kjv`、`esv` |
| `book` | 否 | 限定書卷 ID，多個以逗號分隔（例：`gen,ex`）。`version=esv` 時忽略此參數 |
| `limit` | 否 | 回傳筆數上限，預設 20，最大 100 |

**Response 200**

```json
{
  "keyword": "神愛世人",
  "count": 1,
  "verses": [ { ...SearchVerse } ]
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | 關鍵字少於 2 個字 |
| 500 | `version=esv` 時 Crossway API 呼叫失敗 |

---

## 讀經計劃（公開）`/bible/plans`

### GET /bible/plans

列出所有內建讀經計劃。

**Response 200**

```json
{
  "plans": [ { ...Plan } ]
}
```

---

### GET /bible/plans/:planId

取得指定計劃的基本資訊。

**Response 200**

```json
{
  "plan": { ...Plan }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到計劃 |

---

### GET /bible/plans/:planId/day/:day

取得某計劃第 N 天要讀的段落（不需登入，可用於預覽計劃內容）。

**Path Parameters**

| 參數 | 說明 |
|------|------|
| `planId` | 計劃 ID |
| `day` | 第幾天（1 起算） |

**Response 200**

```json
{
  "reading": { ...DayReading }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到計劃，或 day 超出範圍 |

---

## 個人讀經計劃 🔒 `/bible/user/plans`

以下端點皆需登入，未登入回傳 `401`。

### GET /bible/user/plans

取得目前使用者的所有讀經計劃。

**Response 200**

```json
{
  "plans": [ { ...UserPlan } ]
}
```

---

### POST /bible/user/plans

開始一個新的讀經計劃。

**Request Body**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `plan_id` | string | 計劃 ID |
| `start_date` | string | 開始日期，`YYYY-MM-DD` |

**Response 201**

```json
{
  "plan": { ...UserPlan }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | `plan_id` 未提供；`start_date` 格式錯誤 |
| 404 | 找不到指定計劃 |

---

### DELETE /bible/user/plans/:userPlanId

停用（放棄）一個讀經計劃。不會刪除已記錄的進度。

**Response 200**

```json
{ "deactivated": true }
```

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到計劃（或不屬於目前使用者） |

---

### GET /bible/user/plans/:userPlanId/today

取得今天應讀的段落，以及目前整體進度。

**Response 200**

```json
{
  "current_day": 12,
  "total_days": 365,
  "reading": { ...DayReading },
  "completed_days": [1, 2, 3, 5, 6, 7, 8, 10, 11]
}
```

| 欄位 | 說明 |
|------|------|
| `current_day` | 根據 `start_date` 算出的今日天數（可能超過 `total_days`） |
| `completed_days` | 已標記完成的天數列表 |

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到計劃 |

---

### POST /bible/user/plans/:userPlanId/progress

標記某天已完成閱讀。重複標記同一天不會報錯。

**Request Body**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `day_number` | number | 要標記的天數（正整數） |

**Response 200**

```json
{
  "day_number": 12,
  "already_completed": false,
  "completed_at": "2026-06-25T10:30:00.000Z"
}
```

`already_completed: true` 表示之前已標記過，`completed_at` 此時為 `null`。

**Error**

| HTTP | 情境 |
|------|------|
| 400 | `day_number` 非正整數 |
| 404 | 找不到計劃 |

---

## 節次註記 🔒 `/bible/user/annotations`

以下端點皆需登入，未登入回傳 `401`。

### GET /bible/user/annotations

取得使用者的所有節次註記，可依書卷/章節篩選。

**Query Parameters**

| 參數 | 必填 | 說明 |
|------|------|------|
| `book` | 否 | 書卷 ID（例：`john`） |
| `chapter` | 否 | 章次（需同時提供 `book`） |

**Response 200**

```json
{
  "annotations": [ { ...Annotation } ]
}
```

---

### POST /bible/user/annotations

新增一則節次註記。

**Request Body**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `book_id` | string | 書卷 ID |
| `chapter` | number | 章次（正整數） |
| `verse` | number | 節次（正整數） |
| `note` | string | 內容，1–1000 字 |

**Response 201**

```json
{
  "annotation": { ...Annotation }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | 欄位格式不正確；書卷不存在；內容超過 1000 字 |

---

### PATCH /bible/user/annotations/:id

更新一則節次註記的內容。

**Request Body**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `note` | string | 新的內容，1–1000 字 |

**Response 200**

```json
{
  "annotation": { ...Annotation }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | 內容格式不正確 |
| 404 | 找不到指定註記 |

---

### DELETE /bible/user/annotations/:id

刪除一則節次註記。

**Response 200**

```json
{ "deleted": true }
```

**Error**

| HTTP | 情境 |
|------|------|
| 404 | 找不到指定註記 |

---

## 書卷 ID 對照表

### 舊約

| ID | 中文書名 | 英文書名 | 章數 |
|----|---------|---------|------|
| `gen` | 創世記 | Genesis | 50 |
| `ex` | 出埃及記 | Exodus | 40 |
| `lev` | 利未記 | Leviticus | 27 |
| `num` | 民數記 | Numbers | 36 |
| `deut` | 申命記 | Deuteronomy | 34 |
| `josh` | 約書亞記 | Joshua | 24 |
| `judg` | 士師記 | Judges | 21 |
| `ruth` | 路得記 | Ruth | 4 |
| `1sam` | 撒母耳記上 | 1 Samuel | 31 |
| `2sam` | 撒母耳記下 | 2 Samuel | 24 |
| `1kgs` | 列王紀上 | 1 Kings | 22 |
| `2kgs` | 列王紀下 | 2 Kings | 25 |
| `1chr` | 歷代志上 | 1 Chronicles | 29 |
| `2chr` | 歷代志下 | 2 Chronicles | 36 |
| `ezra` | 以斯拉記 | Ezra | 10 |
| `neh` | 尼希米記 | Nehemiah | 13 |
| `esth` | 以斯帖記 | Esther | 10 |
| `job` | 約伯記 | Job | 42 |
| `ps` | 詩篇 | Psalms | 150 |
| `prov` | 箴言 | Proverbs | 31 |
| `eccl` | 傳道書 | Ecclesiastes | 12 |
| `song` | 雅歌 | Song of Solomon | 8 |
| `isa` | 以賽亞書 | Isaiah | 66 |
| `jer` | 耶利米書 | Jeremiah | 52 |
| `lam` | 耶利米哀歌 | Lamentations | 5 |
| `ezek` | 以西結書 | Ezekiel | 48 |
| `dan` | 但以理書 | Daniel | 12 |
| `hos` | 何西阿書 | Hosea | 14 |
| `joel` | 約珥書 | Joel | 3 |
| `amos` | 阿摩司書 | Amos | 9 |
| `obad` | 俄巴底亞書 | Obadiah | 1 |
| `jonah` | 約拿書 | Jonah | 4 |
| `mic` | 彌迦書 | Micah | 7 |
| `nah` | 那鴻書 | Nahum | 3 |
| `hab` | 哈巴谷書 | Habakkuk | 3 |
| `zeph` | 西番雅書 | Zephaniah | 3 |
| `hag` | 哈該書 | Haggai | 2 |
| `zech` | 撒迦利亞書 | Zechariah | 14 |
| `mal` | 瑪拉基書 | Malachi | 4 |

### 新約

| ID | 中文書名 | 英文書名 | 章數 |
|----|---------|---------|------|
| `matt` | 馬太福音 | Matthew | 28 |
| `mark` | 馬可福音 | Mark | 16 |
| `luke` | 路加福音 | Luke | 24 |
| `john` | 約翰福音 | John | 21 |
| `acts` | 使徒行傳 | Acts | 28 |
| `rom` | 羅馬書 | Romans | 16 |
| `1cor` | 哥林多前書 | 1 Corinthians | 16 |
| `2cor` | 哥林多後書 | 2 Corinthians | 13 |
| `gal` | 加拉太書 | Galatians | 6 |
| `eph` | 以弗所書 | Ephesians | 6 |
| `phil` | 腓立比書 | Philippians | 4 |
| `col` | 歌羅西書 | Colossians | 4 |
| `1thess` | 帖撒羅尼迦前書 | 1 Thessalonians | 5 |
| `2thess` | 帖撒羅尼迦後書 | 2 Thessalonians | 3 |
| `1tim` | 提摩太前書 | 1 Timothy | 6 |
| `2tim` | 提摩太後書 | 2 Timothy | 4 |
| `titus` | 提多書 | Titus | 3 |
| `phlm` | 腓利門書 | Philemon | 1 |
| `heb` | 希伯來書 | Hebrews | 13 |
| `jas` | 雅各書 | James | 5 |
| `1pet` | 彼得前書 | 1 Peter | 5 |
| `2pet` | 彼得後書 | 2 Peter | 3 |
| `1jn` | 約翰一書 | 1 John | 5 |
| `2jn` | 約翰二書 | 2 John | 1 |
| `3jn` | 約翰三書 | 3 John | 1 |
| `jude` | 猶大書 | Jude | 1 |
| `rev` | 啟示錄 | Revelation | 22 |
