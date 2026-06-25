# 邵的工具包 — 軟體設計文件 (SDD)

**版本：** v0.1 draft  
**日期：** 2026-06-24  
**涵蓋功能：** 遊戲、小小好事  

---

## 概覽

邵的工具包是一個個人用的終端機工具。輸入一個指令開啟，連接後端服務，在終端機操作個人常用功能。

```sh
npx @oxfoxlion/shao-cli-tools@latest
```

或全域安裝後：

```sh
npm install -g @oxfoxlion/shao-cli-tools
shao-cli-tools
```

需要 **Node 20+**。第一次跑 npx 會下載套件並快取，之後秒開。

---

## 頂層選單

啟動後進入選單，上下鍵移動，Enter 確認，`q` / `Ctrl+C` 離開：

```
邵的工具包 v0.1

  ▶ 遊戲
    小小好事
    ──────────
    離開

↑↓ 移動  Enter 選擇  q 離開
```

---

## Repository Layout

獨立 repo，與 LineLanguageBot 分開發佈：

```
shao-cli/
  package.json              ← name: "@oxfoxlion/shao-cli-tools"，bin: { "shao-cli-tools": "./index.js" }
  index.js                  ← 入口，頂層選單
  lib/
    api.js                  ← fetch wrapper（base URL + cookie header）
    session.js              ← 本地 session 讀寫
    screen.js               ← 清屏、游標工具
    input.js                ← stdin raw mode，鍵盤事件
  features/
    games/
      index.js              ← 遊戲選單
      client.js             ← game-service API client
      player.js             ← 遊戲主迴圈
    goodthing/
      index.js              ← 好事選單
      client.js             ← good-calendar API client
      views.js              ← 列表、新增、個人資料畫面
```

---

## 後端連線

Base URL：`https://backend.instantcheeseshao.com`

| 功能 | 路由前綴 |
|------|---------|
| 遊戲 | `/game_service` |
| 小小好事 | `/good_calendar` |

`lib/api.js` 統一處理：
- 設定 `Content-Type: application/json`
- 從本地 session 讀出 cookie，自動帶入每個請求
- 回應 401 時通知呼叫端觸發重新登入流程

---

## 認證設計

game-service 不需認證。good-calendar 使用 cookie-based session（暱稱 + 6 位 PIN）。

### 本地 session 儲存

```
~/.config/shao/session.json
```

```json
{
  "good_calendar_session": "<token>"
}
```

### 登入流程

```
GET /good_calendar/auth/me
  ├─ 200 → 已登入，進入功能選單
  └─ 401 → 顯示選擇
              ├─ 登入：POST /good_calendar/auth/login  { nickname, pin }
              └─ 註冊：POST /good_calendar/auth/register  { nickname, pin }
                         → 成功後從 Set-Cookie 取出 token，寫入 session.json等ㄧㄉㄥ
```

登出時刪除 session.json 內的 token，並打 `POST /good_calendar/auth/logout`。

---

## 功能一：遊戲

### API 呼叫順序

| 步驟 | 方法 | 路徑 |
|------|------|------|
| 取遊戲清單 | GET | `/game_service/games` |
| 開局 | POST | `/game_service/games/:gameId/sessions` |
| 送按鍵 | POST | `/game_service/sessions/:sessionId/input` |
| 取目前畫面（即時遊戲） | GET | `/game_service/sessions/:sessionId/frame` |

### 回合制 vs 即時遊戲

遊戲清單 API 不直接回傳 `aiInterval`，但 CLI 只需根據行為決定策略：

- **回合制**：按鍵 → 打 `POST /input` → 渲染回傳的 frame，等下次按鍵
- **即時遊戲**：同時跑兩個迴圈：
  - **按鍵迴圈**：偵測到鍵立即打 `POST /input`，有回傳 frame 就渲染
  - **Poll 迴圈**：每 80ms 打 `GET /frame`，比對 tick，tick 有變才重繪

CLI 開局後嘗試打一次 `GET /frame`：若 tick 在 500ms 內自動遞增（不需按鍵），判定為即時遊戲，啟動 poll 迴圈。

### 畫面更新

```
開局 → 渲染第一個 frame → stdin 進入 raw mode
│
├─ [按鍵事件]
│    POST /sessions/:id/input { key }
│    → 回傳新 frame → process.stdout.write(frame)
│
└─ [poll 計時器，即時遊戲]
     GET /sessions/:id/frame
     → tick 有變 → process.stdout.write(frame)
```

重繪時用 `\x1b[H`（游標移至左上角）覆蓋，不閃爍。

### 結束

`over: true` → 顯示結果（win / loss）→ 提示「按任意鍵回選單」→ 清除 poll 計時器，回遊戲選單。

### 按鍵對照

CLI 在 raw mode 下捕捉按鍵後做以下轉換再送出：

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

## 功能二：小小好事

### API 呼叫

| 動作 | 方法 | 路徑 |
|------|------|------|
| 瀏覽公開好事 | GET | `/good_calendar/entries` |
| 新增好事 | POST | `/good_calendar/entries` |
| 我的資料 + 連續天數 | GET | `/good_calendar/auth/profile?month=YYYY-MM` |
| 編輯好事 | PATCH | `/good_calendar/entries/:entryId` |
| 刪除好事 | DELETE | `/good_calendar/entries/:entryId` |

### 功能選單（已登入）

```
小小好事

  ▶ 瀏覽今日好事
    新增好事
    我的紀錄
    ──────────
    登出
    回上層
```

### 新增好事流程

```
1. 日期      預設今天（YYYY-MM-DD），可手動輸入
             限制：上個月 1 日 ～ 今天
2. 心情溫度  輸入 1–10，預設 5
3. 好事內容  自由輸入，最多 280 字
4. 確認送出  顯示摘要，Enter 確認，q 取消
```

### 我的紀錄畫面

顯示 `GET /auth/profile` 回傳的資料：

```
我的小小好事

🔥 連續 5 天  ｜  最長 14 天  ｜  下一個徽章：28 天
徽章：[✓] 7天  [✓] 14天  [ ] 28天  [ ] 50天  [ ] 100天

本月已記錄：12 筆

最近 10 筆：
  2026-06-24  ★8  今天發現咖啡廳有新口味
  2026-06-23  ★6  幫同事解決了一個難題
  ...
```

### 瀏覽公開好事

顯示 `GET /entries` 回傳的公開紀錄，最新在前，每頁 20 筆，`j/k` 滾動。

---

## 技術限制與已知邊界

| 項目 | 說明 |
|------|------|
| 多行文字輸入 | raw mode 下需自製 backspace、游標處理 |
| 好事內容換行 | API 支援換行，CLI 輸入以 `Ctrl+Enter` 或固定寬度自動折行顯示 |
| 終端機最小寬度 | 建議 80 欄，低於此寬度部分遊戲 frame 可能跑版 |
| session 過期 | API 回 401 時清除本地 token，重新引導登入 |
| 離線 | fetch 失敗時顯示錯誤訊息，不 crash |

---

## 未來版本規劃

| 功能 | 需要後端配合 |
|------|:-----------:|
| 記帳 | ✅ 需新開 REST endpoint（目前只有 LINE bot） |
| 寫部落格文章 | ✅ 需新開 |
| 12 週打卡 | ✅ 需新開（或擴充 event-creator） |