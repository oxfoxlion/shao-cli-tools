# 邵的工具包 — 軟體設計文件 (SDD)

**版本：** v1.3  
**日期：** 2026-06-26  
**狀態：** 現行規範  
**涵蓋功能：** 遊戲、小小好事、聖經閱讀  

> API 端點、request/response 結構、欄位定義以 `docs/API/` 為唯一依據：
> - 遊戲：[`docs/API/game-api.md`](../API/game-api.md)
> - 小小好事：[`docs/API/goodthing.md`](../API/goodthing.md)
> - 聖經閱讀：[`docs/API/bible.md`](../API/bible.md)

---

## 目錄

1. [概覽](#1-概覽)
2. [系統架構](#2-系統架構)
3. [Repository Layout](#3-repository-layout)
4. [後端連線](#4-後端連線)
5. [認證設計](#5-認證設計)
6. [功能一：遊戲](#6-功能一遊戲)
7. [功能二：小小好事](#7-功能二小小好事)
8. [功能三：聖經閱讀](#8-功能三聖經閱讀)
9. [技術限制與已知邊界](#9-技術限制與已知邊界)
10. [未來版本規劃](#10-未來版本規劃)

---

## 1. 概覽

邵的工具包是一個個人用的終端機 CLI 工具。啟動後透過選單操作個人常用功能，連接後端服務。

### 安裝與執行

```sh
# 直接執行（推薦，自動下載最新版）
npx @oxfoxlion/shao-cli-tools@latest

# 全域安裝後執行
npm install -g @oxfoxlion/shao-cli-tools
shao-cli-tools
```

需要 **Node.js 20+**。

### 頂層選單

啟動後進入主選單，上下鍵移動，Enter 確認，`q` / `Ctrl+C` 離開：

```
邵的工具包 v1.0

  ▶ 遊戲
    小小好事
    ──────────
    離開

↑↓ 移動  Enter 選擇  q 離開
```

---

## 2. 系統架構

```
使用者終端機
     │
     ▼
  index.ts（頂層選單）
     │
     ├─ features/games/        ← 遊戲功能
     │       └─ client.ts      ← 呼叫 game-service API
     │
     └─ features/goodthing/    ← 小小好事功能
             └─ client.ts      ← 呼叫 good-calendar API
                     │
                     ▼
         https://backend.instantcheeseshao.com
         ├─ /game_service/*
         └─ /good_calendar/*
```

共用基礎層（`src/lib/`）：

| 模組 | 職責 |
|------|------|
| `api.ts` | fetch wrapper，注入 cookie、處理 401 |
| `session.ts` | 讀寫 `~/.config/shao/session.json` |
| `screen.ts` | 清屏、游標控制、ANSI escape |
| `input.ts` | stdin raw mode，鍵盤事件解析 |

---

## 3. Repository Layout

```
shao-cli-tools/
  package.json              ← name: "@oxfoxlion/shao-cli-tools"
                               bin: { "shao-cli-tools": "./dist/index.js" }
                               type: "module"
  tsconfig.json
  src/
    index.ts                ← 入口，頂層選單
    lib/
      api.ts                ← fetch wrapper（base URL + cookie header）
      session.ts            ← 本地 session 讀寫
      screen.ts             ← 清屏、游標工具
      input.ts              ← stdin raw mode，鍵盤事件
    features/
      games/
        index.ts            ← 遊戲選單
        client.ts           ← game-service API client
        player.ts           ← 遊戲主迴圈（回合制 / 即時）
      goodthing/
        index.ts            ← 好事選單（含登入流程）
        client.ts           ← good-calendar API client
        views.ts            ← 列表、新增、我的紀錄畫面
  dist/                     ← tsc 輸出（.gitignore）
  tests/
    unit/                   ← Vitest 單元測試
  docs/
    API/
      game-api.md           ← 遊戲 API 規格（唯一依據）
      goodthing.md          ← 小小好事 API 規格（唯一依據）
    sdd/
      sdd.md                ← 本文件（現行規範）
      idea.md               ← 原始構想草稿（僅供參考）
```

---

## 4. 後端連線

**Base URL：** `https://backend.instantcheeseshao.com`

| 功能 | 路由前綴 |
|------|---------|
| 遊戲 | `/game_service` |
| 小小好事 | `/good_calendar` |

### `lib/api.ts` 職責

- 統一設定 `Content-Type: application/json`
- 從 session 讀出 cookie，以 `Cookie` header 帶入每個請求
- 回應 401 時 throw `AuthError`，由呼叫端觸發重新登入
- `fetch` 失敗（網路錯誤）時 throw `NetworkError`，顯示錯誤訊息，不 crash

---

## 5. 認證設計

game-service **不需要**認證。  
good-calendar 使用 **cookie-based session**（暱稱 + 6 位 PIN）。

### 本地 Session 儲存

路徑：`~/.config/shao/session.json`

```json
{
  "good_calendar_session": "<cookie-token>"
}
```

### 登入流程

```
進入小小好事
  │
  └─ GET /good_calendar/auth/me
       ├─ 200 → 已登入，進入功能選單
       └─ 401 → 顯示選擇
                   ├─ 登入：POST /good_calendar/auth/login  { nickname, pin }
                   │          → 成功：Set-Cookie 取出 token，寫入 session.json
                   │          → 失敗（401）：顯示錯誤，重新輸入
                   └─ 註冊：POST /good_calendar/auth/register  { nickname, pin }
                              → 成功：同上，寫入 session.json 後進入功能選單
                              → 失敗（409 暱稱重複）：顯示錯誤，重新輸入
```

### 登出流程

```
選擇「登出」
  → POST /good_calendar/auth/logout
  → 刪除 session.json 中的 good_calendar_session
  → 回到小小好事入口（顯示未登入狀態）
```

---

## 6. 功能一：遊戲

> 完整 API 規格見 [`docs/API/game-api.md`](../API/game-api.md)。

### 主迴圈設計

開局後觀察 tick 是否在 500ms 內自動遞增：

- tick 自動遞增 → **即時遊戲**，啟動 poll 迴圈
- tick 不變 → **回合制**，等待按鍵

**回合制：**
```
開局 → 渲染第一個 frame → 等待按鍵
  │
  └─ 按鍵 → POST /input { key } → 渲染回傳的 frame → 等待按鍵（重複）
```

**即時遊戲（兩個並行迴圈）：**
```
開局 → 渲染第一個 frame → stdin raw mode
  │
  ├─ [按鍵迴圈] 偵測到鍵 → POST /input { key } → 有 frame 就渲染
  │
  └─ [Poll 迴圈] 每 80ms → GET /frame → tick 有變才重繪
```

重繪時用 `\x1b[H`（游標移至左上角）覆蓋，不清屏，避免閃爍。

### 遊戲結束

收到 `over: true` 時：

1. 清除 poll 計時器
2. 顯示結果（win / loss）
3. 若 `hasLeaderboard: true`，顯示排行榜
4. 提示「按任意鍵回選單」，等待後回遊戲選單

### 提前離開

送出 key `"quit"` → 收到 `{ quit: true }` → 直接回遊戲選單（不顯示結果）。

### 按鍵轉換規則

CLI 在 raw mode 下只轉換以下特殊按鍵，其餘字元小寫後原樣送出：

| 原始事件 | 送出字串 |
|---------|---------|
| 方向鍵上 | `up` |
| 方向鍵下 | `down` |
| 方向鍵左 | `left` |
| 方向鍵右 | `right` |
| Enter | `enter` |
| Escape | `escape` |
| Backspace | `backspace` |
| Space | `space` |
| 其他單字元 | 原字元（小寫） |

---

## 7. 功能二：小小好事

> 完整 API 規格見 [`docs/API/goodthing.md`](../API/goodthing.md)。

### 功能選單（已登入）

```
小小好事

  ▶ 瀏覽今日好事
    新增好事
    我的紀錄
    ──────────
    登出
    回上層

↑↓ 移動  Enter 選擇  q 回上層
```

### 新增好事流程

逐步輸入，每步驟可按 `q` 取消：

```
步驟 1：日期
  預設今天（YYYY-MM-DD），可手動輸入
  限制：上個月 1 日 ～ 今天
  Enter 確認，留空採用預設值

步驟 2：心情溫度
  輸入 1–10，預設 5
  Enter 確認

步驟 3：好事內容
  自由輸入，最多 280 字
  Backspace 刪除，固定寬度自動折行顯示
  Enter 確認（Ctrl+Enter 換行，若終端機支援）

步驟 4：確認送出
  顯示摘要
  Enter 確認送出，q 取消
```

### 我的紀錄畫面

```
我的小小好事

🔥 連續 5 天  ｜  最長 14 天  ｜  下一個徽章：28 天
徽章：[✓] 7天  [✓] 14天  [ ] 28天  [ ] 50天  [ ] 100天

本月已記錄：12 筆

最近 10 筆：
  2026-06-24  ★8  今天發現咖啡廳有新口味
  2026-06-23  ★6  幫同事解決了一個難題
  ...

q 回選單
```

資料來源：`GET /good_calendar/auth/profile?month=YYYY-MM`，欄位對應：

| 畫面元素 | API 欄位 |
|---------|---------|
| 連續天數 | `profile.streak_summary.current_streak` |
| 最長 | `profile.streak_summary.longest_streak` |
| 下一個徽章 | `profile.streak_summary.next_badge_days`（`null` 時顯示「全部達成」） |
| 徽章清單 | `profile.streak_summary.badges` |
| 本月已記錄 | `profile.month_entries.length` |
| 最近 10 筆 | `profile.recent_entries`（`mood_temperature` 對應 ★ 數） |

### 瀏覽公開好事

```
今日好事

  2026-06-24  ★8  小明：今天天氣很好
  2026-06-24  ★7  小華：咖啡特別香
  ...

j/k 滾動  q 回選單
```

資料來源：`GET /good_calendar/entries`，最新在前，每頁 20 筆，`j/k` 滾動載入更多。

---

## 8. 功能三：聖經閱讀

> 完整 API 規格見 [`docs/API/bible.md`](../API/bible.md)。

### 主選單

```
聖經閱讀

  ▶ 瀏覽書卷
    搜尋節次
    讀經計劃（需登入）
    節次註記（需登入）
    切換版本 [和合本]
    ──────────
    回上層

↑↓/j/k 移動  Enter 選擇  q 返回
```

### 版本選擇

支援三種版本，可從「切換版本」選單切換，影響書卷名稱及節次文字：

| 版本 | 說明 |
|------|------|
| `cuv`（預設）| 和合本，繁體中文 |
| `kjv` | King James Version |
| `esv` | English Standard Version（需後端設定 ESV_API_KEY） |

顯示 ESV 文字時，`chapter.copyright` 欄位會附帶版權聲明，UI 必須在章節末顯示。

### 瀏覽書卷流程

```
選擇書卷（舊約 / 新約分區，可滾動，j/k 移動）
  → 選擇章節（方格排列，← → ↑↓ 移動）
  → 閱讀章節（j/k 滾動，a 新增節次註記，q 返回）
```

在章節頁標題顯示 `[版本標籤]`；ESV 頁面底部附帶版權聲明。

### 搜尋流程

```
輸入關鍵字（至少 2 字）
  → 依目前版本搜尋，顯示書卷:章:節 + 文字預覽（j/k 滾動）
```

ESV 搜尋結果的 `book_id` 為 `null`，僅有 `book_name`。

### 讀經計劃流程（需登入）

```
顯示我的計劃（進行中）+ ＋ 開始新計劃
  → 查看我的計劃 → 顯示今日段落 → 點選段落進入章節閱讀 / c 標記完成
  → 開始新計劃 → 選擇內建計劃 → 輸入開始日期 → 建立
```

認證共用 `good_calendar_session`（同小小好事帳號）。

### 節次註記（需登入）

```
顯示全部節次註記（書卷:章:節 + 備註預覽，j/k 移動）
  → d 刪除
在閱讀章節時按 a 可直接新增對應節次的註記
```

---

## 9. 技術限制與已知邊界

| 項目 | 說明 |
|------|------|
| 多行文字輸入 | raw mode 下需自製 backspace、字元計數、折行顯示 |
| 好事內容換行 | CLI 以固定寬度自動折行顯示；`Ctrl+Enter` 插入換行（終端機行為不一，需實測） |
| 終端機最小寬度 | 建議 80 欄，低於此寬度部分遊戲 frame 可能跑版 |
| Session 過期 | API 回 401 時清除本地 token，重新引導登入 |
| 離線 | fetch 失敗時顯示錯誤訊息，不 crash |
| npx 快取 | `npx @latest` 每次都會確認最新版；全域安裝則需手動 `npm update` |

---

## 10. 未來版本規劃

| 功能 | 需要後端配合 | 說明 |
|------|:-----------:|------|
| 記帳 | ✅ | 需新開 REST endpoint（目前只有 LINE bot） |
| 寫部落格文章 | ✅ | 需新開 |
| 12 週打卡 | ✅ | 需新開（或擴充 event-creator） |
