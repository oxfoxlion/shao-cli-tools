# 邵的工具包 — AI Agent 開發規範

使用 Node.js 開發的個人終端機工具 CLI。

## 技術棧

- Runtime：Node.js 20+
- 模組系統：ESM（`"type": "module"`，使用 `import/export`）
- 語言：TypeScript（strict mode，source 在 `src/`，build 輸出到 `dist/`）
- HTTP Client：Node 20 內建 `fetch`（無需額外套件）
- 終端機顏色：`chalk`
- 終端機輸入：Node 內建 `readline` + raw mode stdin
- 測試框架：Vitest
- 套件管理：npm（鎖檔 `package-lock.json`）
- 發佈：npm registry，name: `@oxfoxlion/shao-cli-tools`

## 常用指令

```bash
npm run dev          # ts-node / tsx 直接執行 src/index.ts（開發用）
npm run build        # tsc 型別檢查 + 輸出 dist/
npm run start        # node dist/index.js（執行 build 後的版本）
npm run test         # Vitest 單元測試
npm run test:watch   # Vitest watch mode
npm run lint         # ESLint 檢查
```

發佈相關：
```bash
npm run build && npm publish --access public
npx @oxfoxlion/shao-cli-tools@latest   # 使用者執行方式
```

## Repository Layout

```
shao-cli-tools/
  package.json
  tsconfig.json
  src/
    index.ts                  ← 入口，頂層選單
    lib/
      api.ts                  ← fetch wrapper（base URL + cookie header）
      session.ts              ← 本地 session 讀寫（~/.config/shao/session.json）
      screen.ts               ← 清屏、游標工具
      input.ts                ← stdin raw mode，鍵盤事件
    features/
      games/
        index.ts              ← 遊戲選單
        client.ts             ← game-service API client
        player.ts             ← 遊戲主迴圈
      goodthing/
        index.ts              ← 好事選單
        client.ts             ← good-calendar API client
        views.ts              ← 列表、新增、個人資料畫面
  dist/                       ← tsc build 輸出（不納入版本控制）
  tests/
    unit/                     ← Vitest 單元測試（*.test.ts）
  docs/
    sdd/                      ← 設計文件
```

## 文件優先序

文件規格發生衝突時，依下列順序判定：

1. `docs/sdd/sdd.md`：功能、畫面、流程設計的最高依據。
2. `docs/API/`：後端 API 契約的最高依據（各功能獨立檔案）。
   - `docs/API/game-api.md`：遊戲服務 API
   - `docs/API/goodthing.md`：小小好事 API

`docs/sdd/idea.md` 只保留原始構想草稿，不具現行規範效力。

---

## 後端連線規範

Base URL：`https://backend.instantcheeseshao.com`

| 功能 | 路由前綴 |
|------|---------|
| 遊戲 | `/game_service` |
| 小小好事 | `/good_calendar` |

`src/lib/api.ts` 統一處理：
- 設定 `Content-Type: application/json`
- 從 `~/.config/shao/session.json` 讀出 cookie，自動帶入每個請求
- 回應 401 時通知呼叫端觸發重新登入流程
- fetch 失敗時顯示錯誤訊息，不讓 process crash

---

## 認證設計

game-service 不需認證。good-calendar 使用 cookie-based session（暱稱 + 6 位 PIN）。

Session 儲存路徑：`~/.config/shao/session.json`

```json
{
  "good_calendar_session": "<token>"
}
```

---

## 開發流程

### 分支與合併流程

- 每一個新功能或修復都必須使用獨立 Git branch 開發，不要直接在 `main` 上開發。
- 開始實作前，AI agent 必須先提供建議 branch 名稱，等使用者完成切分支後再開始改檔。
- branch 命名使用 Conventional Commit 風格，例如 `feat/games-menu`、`fix/session-read`。

### Git 操作

- 功能完成後，AI agent **不直接執行** `git add`、`git commit` 或 `git push`；除非使用者明確要求。
- 功能完成後，AI agent 必須提供：
  - 目前 branch 名稱
  - 建議 commit message（Conventional Commits，英文）
  - PR title 與 description（繁體中文）
  - 提醒使用者確認 branch 再執行 Git 操作
- 已 push 到受保護分支的 commit 不應使用 amend / force push 修改。

#### 分支命名
- 格式：`[類型]/[功能描述]`
- 範例：`feat/games-menu`、`feat/goodthing-auth`、`fix/session-401`

#### Commit Message（英文）
- 格式：Conventional Commits
- 範例：
  ```
  feat(games): implement game list and session start flow
  feat(goodthing): add login/register flow with session storage
  fix(api): handle 401 response and trigger re-login
  ```

#### PR 標題與描述（繁體中文）
- 描述範例：
  ```
  ## 變更內容
  - 實作遊戲選單，包含清單顯示與選擇開局。

  ## 影響檔案
  - `src/features/games/index.ts`
  - `src/features/games/client.ts`

  ## 驗證項目
  - [x] npm run build 通過（0 TypeScript error）
  - [x] npm run lint 通過
  - [x] npm run start 手動測試主要流程
  ```

### 實作前確認

- 是否已閱讀 `docs/sdd/idea.md` 對應的功能設計
- 是否會新增依賴、調整技術棧

### 實作後必做（在向使用者回報前完成）

1. **自行執行 `npm run build`**：TypeScript 型別錯誤立刻修，直到 0 error 為止。
2. **自行執行 `npm run lint`**：修到 0 error 為止。
3. 執行 `npm run start` 手動驗證主要流程（終端機輸出、鍵盤操作、API 呼叫）。
4. 確認通過後，向使用者回報並請求操作驗證。

### 實作後回報

- 修改了哪些檔案
- `npm run build && npm run lint` 結果（通過 / 修正了哪些錯誤）
- 手動驗證結果（主要流程是否正常）
- 若未執行測試，需說明原因

---

## 開發規範

### 命名規範

- 變數與函式：camelCase（`getUserName`）
- 型別與介面：PascalCase（`GameSession`、`GoodEntry`）
- 常數：UPPER_SNAKE_CASE（`BASE_URL`）
- 檔案名稱：camelCase（`apiClient.ts`、`sessionStore.ts`）
- 布林值：`is` / `has` / `should` 前綴（`isLoggedIn`、`hasError`）

### 目錄規範

| 目錄 | 用途 |
|------|------|
| `src/lib/` | 通用基礎工具（api、session、screen、input） |
| `src/features/games/` | 遊戲功能模組 |
| `src/features/goodthing/` | 小小好事功能模組 |
| `dist/` | tsc build 輸出（.gitignore，不納入版控） |
| `tests/unit/` | Vitest 單元測試 |
| `docs/sdd/` | 設計文件 |

### TypeScript 規範

- 禁止使用 `any`，必要時使用 `unknown` 搭配型別守衛
- 使用 `interface` 定義物件型別，使用 `type` 定義聯合型別或工具型別
- 所有匯出的函式都必須標註回傳型別
- strict mode 已啟用，不得關閉任何 strict 選項

### 錯誤處理

- `fetch` 失敗（網路錯誤、超時）必須 catch，顯示可讀的錯誤訊息，不讓 process crash
- API 回傳 401 時，清除本地 session token 並引導重新登入
- 終端機相關錯誤（raw mode 設定失敗）需有 fallback 提示

---

## 測試規範

使用 **Vitest** 進行單元測試。

| 類型 | 目錄 | 命名 |
|------|------|------|
| 單元測試 | `tests/unit/` | `*.test.ts` |

### 需要優先補測試的範圍

- `src/lib/api.ts`：401 處理、cookie 注入邏輯
- `src/lib/session.ts`：token 讀寫、檔案不存在時的 fallback
- 按鍵轉換對照表（raw mode 按鍵 → 送出字串）

---

## 套件導入規則

不得未經確認自行導入新依賴。

若需要新增套件，需先說明：

- 套件用途
- 為什麼 Node 內建或現有套件不足
- 對 bundle size（`npx` 下載體積）與維護成本的影響

本專案統一使用 npm，不要新增 `pnpm-lock.yaml`、`yarn.lock` 或其他鎖檔。

---

## 回應規範

- 一律使用繁體中文回應
- commit message 使用 Conventional Commits 格式，描述使用英文
- PR 的標題與描述使用繁體中文
- 程式碼中的變數名稱與註解使用英文
