# 小小好事 API 文件

Base URL：`/good_calendar`

## 認證機制

登入後伺服器會設定 `good_calendar_session` HttpOnly Cookie（有效期 30 天），後續所有需要登入的請求只要帶上 Cookie 即可，無需另外帶 token header。

跨域前端需設定：

```js
fetch(url, { credentials: "include" })
```

---

## 資料型別

### User

```json
{
  "id": "uuid",
  "nickname": "string",
  "created_at": "ISO 8601 datetime",
  "last_login_at": "ISO 8601 datetime | null"
}
```

### Entry

```json
{
  "id": "uuid",
  "user_id": "uuid | null",
  "nickname": "string",
  "content": "string",
  "date": "YYYY-MM-DD",
  "mood_temperature": 1,
  "hide_from_global_feed": false,
  "skip_discord_notification": false,
  "created_at": "ISO 8601 datetime"
}
```

### StreakSummary

```json
{
  "current_streak": 3,
  "longest_streak": 14,
  "next_badge_days": 28,
  "badges": [
    { "days": 7,   "earned": true  },
    { "days": 14,  "earned": true  },
    { "days": 28,  "earned": false },
    { "days": 50,  "earned": false },
    { "days": 100, "earned": false }
  ]
}
```

`next_badge_days`：下一個尚未達成的徽章天數；已全部達成時為 `null`。  
Streak 計算只採用「entry_date 與當天台灣時間相同」的紀錄（即當天補記不計入）。

---

## 認證 `/good_calendar/auth`

### POST /good_calendar/auth/register

以暱稱 + 6 位數字 PIN 註冊。

**Request Body**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `nickname` | string | 1–10 字 |
| `pin` | string | 恰好 6 位數字 |

**Response 201**

```json
{
  "message": "註冊成功",
  "user": { ...User }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | 暱稱超過 10 字或為空；PIN 非 6 位數字 |
| 409 | 暱稱已被使用 |

---

### POST /good_calendar/auth/login

以暱稱 + PIN 登入。

**Request Body**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `nickname` | string | 1–10 字 |
| `pin` | string | 恰好 6 位數字 |

**Response 200**

```json
{
  "message": "登入成功",
  "user": { ...User }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | 暱稱或 PIN 格式不正確 |
| 401 | 暱稱或 PIN 錯誤 |

---

### GET /good_calendar/auth/google/start

導向 Google OAuth 授權頁面（302 redirect）。CLI 不使用此端點。

---

### POST /good_calendar/auth/logout

清除 session，清除 Cookie。

**Response 200**

```json
{ "message": "已登出" }
```

---

### GET /good_calendar/auth/me

取得目前登入的使用者。

**Response 200**

```json
{
  "user": { ...User }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 401 | 未登入或 session 已過期 |

---

### GET /good_calendar/auth/profile

取得使用者個人資料與好事統計。需登入。

**Query Parameters**

| 參數 | 必填 | 說明 |
|------|------|------|
| `month` | 否 | `YYYY-MM`，預設為當月 |

**Response 200**

```json
{
  "user": { ...User },
  "profile": {
    "month": "2026-06",
    "total_entries": 42,
    "last_entry_at": "2026-06-25T10:00:00.000Z",
    "active_dates_this_month": ["2026-06-01", "2026-06-03"],
    "month_entries": [ { ...Entry } ],
    "recent_entries": [ { ...Entry } ],
    "streak_summary": { ...StreakSummary }
  }
}
```

| 欄位 | 說明 |
|------|------|
| `active_dates_this_month` | 指定月份中有紀錄的日期（去重），可用於日曆標記 |
| `month_entries` | 指定月份的所有紀錄（包含 hide_from_global_feed） |
| `recent_entries` | 最近 10 筆紀錄 |

**Error**

| HTTP | 情境 |
|------|------|
| 401 | 未登入 |

---

### PATCH /good_calendar/auth/nickname

更新暱稱。需登入。

**Request Body**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `nickname` | string | 1–10 字 |

**Response 200**

```json
{
  "message": "暱稱已更新",
  "user": { ...User }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | 暱稱格式不正確 |
| 401 | 未登入 |
| 409 | 暱稱已被其他人使用 |

---

### PATCH /good_calendar/auth/pin

更換 PIN。需登入。換 PIN 後其他裝置的 session 會被登出（保留當前 session）。

**Request Body**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `currentPin` | string | 目前的 6 位數字 PIN |
| `newPin` | string | 新的 6 位數字 PIN |

**Response 200**

```json
{ "message": "PIN 已更新" }
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | PIN 格式不正確；新舊 PIN 相同 |
| 401 | 未登入；目前 PIN 錯誤 |
| 404 | 找不到使用者 |

---

## 好事紀錄 `/good_calendar/entries`

### GET /good_calendar/entries

取得公開好事紀錄（不含 `hide_from_global_feed = true` 的項目），依日期與建立時間降冪排列。

**不需登入。**

**Response 200**

```json
{
  "entries": [ { ...Entry } ]
}
```

---

### POST /good_calendar/entries

新增一筆好事紀錄。

**認證**：不強制登入，但登入狀態下會自動帶入使用者資訊（nickname 取自 session，`user_id` 會綁定）。

**Request Body**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `content` | string | 是 | 好事內容，1–280 字 |
| `date` | string | 是 | `YYYY-MM-DD`，限本月或上月，不可超過今天 |
| `nickname` | string | 否* | 未登入時必填，1–10 字 |
| `mood_temperature` | number | 否 | 1–10，預設 5 |
| `hide_from_global_feed` | boolean | 否 | `true` 時不出現在公開列表，預設 `false` |
| `skip_discord_notification` | boolean | 否 | `true` 時不送 Discord 通知，預設 `false` |

> *登入狀態下 `nickname` 欄位會被忽略，強制使用 session 內的暱稱。

**日期限制**：只接受「上個月 1 日」到「今天（台灣時間）」之間的日期。

**Response 201**

```json
{
  "entry": { ...Entry },
  "created": true,
  "notification": {
    "sent": true
  }
}
```

`notification.sent`：Discord 通知是否成功送出。  
`notification.reason`（`sent: false` 時）：`"disabled_by_user"` / `"missing_bot_token"` / `"missing_channel_id"` / `"discord_<status_code>"`

**Error**

| HTTP | 情境 |
|------|------|
| 400 | 暱稱、內容、日期格式不正確；心情溫度超出範圍；日期超出允許區間 |

---

### PATCH /good_calendar/entries/:entryId

編輯自己的好事紀錄。需登入，且只能編輯自己的紀錄。

**Path Parameter**：`entryId`（UUID）

**Request Body**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `content` | string | 是 | 1–280 字 |
| `date` | string | 是 | `YYYY-MM-DD`，限本月或上月，不可超過今天 |
| `mood_temperature` | number | 否 | 1–10，預設 5 |
| `hide_from_global_feed` | boolean | 否 | 預設 `false` |

**Response 200**

```json
{
  "entry": { ...Entry }
}
```

**Error**

| HTTP | 情境 |
|------|------|
| 400 | 內容、日期格式不正確；心情溫度超出範圍；日期超出允許區間 |
| 401 | 未登入 |
| 403 | 不是自己的紀錄 |
| 404 | 找不到指定紀錄 |

---

### DELETE /good_calendar/entries/:entryId

刪除自己的好事紀錄。需登入，且只能刪除自己的紀錄。

**Path Parameter**：`entryId`（UUID）

**Response 200**

```json
{ "deleted": true }
```

**Error**

| HTTP | 情境 |
|------|------|
| 401 | 未登入 |
| 403 | 不是自己的紀錄 |
| 404 | 找不到指定紀錄 |
