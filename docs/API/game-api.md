# Game Service API

Base URL: `https://backend.instantcheeseshao.com/game_service`

---

## GET /games

列出所有可用遊戲。

**Response**
每筆記錄包含 `hasLeaderboard` 欄位，表示該遊戲是否支援排行榜。

```json
[
  { "id": "adventure",   "title": "找貓咪",         "description": "探索不同地圖，找回你失蹤的貓咪。",                                             "hasLeaderboard": false },
  { "id": "bomber",      "title": "CLI Bomber Mini", "description": "Move through a small grid, place bombs, and clear enemies.",             "hasLeaderboard": false },
  { "id": "breakout",    "title": "打磚塊",           "description": "移動板子反彈球，消滅所有磚塊。有 3 條命。",                                   "hasLeaderboard": true  },
  { "id": "bunker",      "title": "末日碉堡",         "description": "核戰後，獨自進入廢棄軍事碉堡，用 CLI 知識重啟 AI 系統 ARIA。",              "hasLeaderboard": false },
  { "id": "cardodge",    "title": "公路閃避",         "description": "在三線公路上高速行駛，左右閃避迎面而來的車輛，撐越久分數越高。",            "hasLeaderboard": true  },
  { "id": "coup",        "title": "Coup",             "description": "虛張聲勢，騙倒所有對手。最後存活者獲勝。",                                   "hasLeaderboard": false },
  { "id": "frogger",     "title": "青蛙過河",         "description": "控制青蛙跳過車流、河流，安全到達對岸的蓮花座。",                            "hasLeaderboard": false },
  { "id": "gomoku",      "title": "Gomoku",           "description": "Play five-in-a-row against a simple CPU.",                             "hasLeaderboard": false },
  { "id": "huarong",     "title": "華容道",            "description": "滑動棋子，讓曹操從下方出口逃出。每局隨機生成。",                            "hasLeaderboard": true  },
  { "id": "incan",       "title": "印加寶藏",         "description": "在古老神廟中搶奪寶石，見好就收——共 5 輪推開心遊戲。",                      "hasLeaderboard": false },
  { "id": "maze",        "title": "Maze",             "description": "Explore a growing maze through a fixed-size viewport.",                "hasLeaderboard": false },
  { "id": "minesweeper", "title": "踩地雷",           "description": "翻開所有非地雷格子，踩到地雷就輸了。",                                      "hasLeaderboard": true  },
  { "id": "shortcut",    "title": "Vim Story Lab",    "description": "Practice tiny Vim commands inside story buffers.",                    "hasLeaderboard": false },
  { "id": "snake",       "title": "貪吃蛇",           "description": "控制蛇吃食物成長，碰到牆壁或自己的身體就結束。",                            "hasLeaderboard": true  },
  { "id": "sokoban",     "title": "Sokoban",          "description": "Push every box onto a target tile.",                                   "hasLeaderboard": false },
  { "id": "tetris",      "title": "俄羅斯方塊",        "description": "讓方塊填滿整行消除，堆到頂就結束。",                                       "hasLeaderboard": true  },
  { "id": "sudoku",      "title": "數獨",              "description": "在 9×9 格中填入 1-9，使每行、每列、每個 3×3 區塊都不重複。",              "hasLeaderboard": false }
]
```

---

## POST /games/:gameId/sessions

開始一局新遊戲，回傳 session ID 和第一個畫面。

**Path params**
| 參數 | 說明 |
|------|------|
| gameId | 遊戲 ID，見上方清單 |

**Body（選填）**
```json
{ "nickname": "玩家名稱" }
```

| 欄位 | 說明 |
|------|------|
| nickname | 玩家暱稱，最長 20 字元。省略或空白時預設為 `"匿名"`。用於遊戲結束後寫入排行榜。 |

**Response**
```json
{
  "sessionId": "870dc63a-be64-45db-ad16-b6eb4474540d",
  "frame": "Maze  Lv:1  21x15  Moves:0...\n+---+\n...",
  "tick": 1
}
```

---

## POST /sessions/:sessionId/input

送入按鍵，回傳新畫面。Session 無效時回傳 404。

**Body**
```json
{ "key": "d" }
```

**Response（遊戲進行中）**
```json
{
  "frame": "Maze  Lv:1  21x15  Moves:1...",
  "tick": 2,
  "over": false,
  "result": null
}
```

**Response（遊戲結束）**
```json
{
  "frame": "...",
  "tick": 15,
  "over": true,
  "result": "win"
}
```

> 送 `"quit"` 作為 key 可提前結束遊戲，回傳 `{ "quit": true }`。
>
> 送 `"?"` 作為 key 可顯示遊戲說明，`frame` 會回傳說明文字。說明顯示中，再送任意 key 即可關閉並回到遊戲畫面（該 key 不會被遊戲處理）。

---

## GET /sessions/:sessionId/frame

取得目前畫面（不送入按鍵）。適用於 AI 計時更新的遊戲（目前：bomber、frogger、cardodge、snake、tetris、breakout）。

**Response**
```json
{
  "frame": "HP:♥♥♥  CLI Bomber Mini\n...",
  "tick": 8
}
```

---

## Session 管理

- Session 閒置 **10 分鐘**後自動清除
- 一局結束（`over: true`）後 session 自動刪除，不需要手動清理
- 同一個 gameId 可同時開多個 session（不同玩家）

---

## GET /games/:gameId/leaderboard

取得指定遊戲的排行榜（前 10 名）。只有 `hasLeaderboard: true` 的遊戲才支援此端點。

**Path params**
| 參數 | 說明 |
|------|------|
| gameId | 遊戲 ID |

**Query params（選填）**
| 參數 | 說明 |
|------|------|
| difficulty | 篩選特定難度（如 `"初級"`、`"慢"`、`"高階"` 等），省略則回傳所有難度合併排名 |

**Response（成功）**
```json
{
  "gameId": "tetris",
  "metric": "score",
  "lowerIsBetter": false,
  "label": "分數",
  "entries": [
    { "rank": 1, "nickname": "玩家A", "value": 12000, "difficulty": null,  "createdAt": "2026-06-24T10:00:00.000Z" },
    { "rank": 2, "nickname": "匿名",  "value":  8500, "difficulty": null,  "createdAt": "2026-06-24T11:30:00.000Z" }
  ]
}
```

| 欄位 | 說明 |
|------|------|
| metric | 計分指標名稱（`score` / `secs` / `moves`） |
| lowerIsBetter | 分數越低越好（踩地雷、華容道）為 `true`，否則為 `false` |
| label | 中文計分欄位名稱（`分數` / `秒數` / `步數`） |
| entries[].difficulty | 遊戲難度字串；無難度分類的遊戲（tetris、breakout、cardodge）為 `null` |

**各遊戲排行榜說明**

| 遊戲 | 計分指標 | 排序 | 難度分類 |
|------|----------|------|----------|
| tetris | 分數 | 高分優先 | 無 |
| snake | 分數 | 高分優先 | 慢 / 中 / 快 |
| breakout | 分數 | 高分優先 | 無 |
| cardodge | 分數 | 高分優先 | 無 |
| minesweeper | 秒數（完成時間） | 低分優先 | 初級 / 中級 / 高級 |
| huarong | 步數（移動次數） | 低分優先 | 初階 / 中階 / 高階 |

**Error**
```json
{ "error": "leaderboard_not_supported" }   // 該遊戲不支援排行榜（HTTP 404）
```

---

## 各遊戲按鍵對照表

| 遊戲 | 按鍵 | 說明 |
|------|------|------|
| **minesweeper** | `w/s/a/d` 或 `up/down/left/right` | 移動游標 |
| | `enter` | 翻開格子 |
| | `f` | 插旗 / 取消插旗 |
| | `r` | 回難度選擇 |
| **huarong** | `w/s/a/d` 或 `up/down/left/right` | 移動游標 |
| | `enter` | 選擇／取消選擇棋子 |
| | `w/s/a/d` 或 `up/down/left/right`（選中後） | 移動棋子 |
| | `escape` | 取消選擇 |
| | `r` | 換一題（同難度隨機重新生成） |
| **maze** | `w/s/a/d` | 移動 |
| | `r` | 重置迷宮 |
| | `enter` | 下一關（過關後） |
| **bomber** | `w/s/a/d` | 移動 |
| | `bomb` 或 `" "` | 放炸彈 |
| | `p` | 暫停 |
| **sokoban** | `w/s/a/d` | 移動 |
| | `r` | 重置關卡 |
| | `n/p` | 下一/上一關 |
| | `enter` | 下一關（過關後） |
| **gomoku** | `up/down/left/right` 或 `k/j/h/l` | 移動游標 |
| | `enter` | 下棋 |
| | `r` | 重設棋盤 |
| | `d` | 切換難度 |
| **frogger** | `w/s/a/d` | 移動（上/下/左/右） |
| **cardodge** | `a` | 向左換道 |
| | `d` | 向右換道 |
| **adventure** | `up/down` 或 `w/s` | 選擇選項 |
| | `enter` | 確認 |
| | `r` | 回地圖選擇 |
| **bunker** | `up/down` 或 `w/s` | 選擇選項 |
| | `enter` | 確認 |
| | `r` | 回關卡選擇 |
| **breakout** | `a/d` 或 `left/right` | 移動板子 |
| **snake** | `1` / `2` / `3` | 開局前選速度（慢／中／快） |
| | `w/s/a/d` 或 `up/down/left/right` | 控制方向 |
| **tetris** | `a/d` 或 `left/right` | 左右移動 |
| | `w`、`↑` 或 `z` | 旋轉 |
| | `s` 或 `↓` | 加速下落 |
| | `space` 或 `enter` | 直接落底 |
| **sudoku** | `w/s/a/d` 或 `up/down/left/right` | 移動游標 |
| | `1-9` | 填入數字 |
| | `0`、`delete`、`backspace` | 清除格子 |
| | `r` | 回難度選擇 |
| **所有遊戲** | `?` | 顯示遊戲說明（任意鍵關閉） |
| **shortcut** | `j/k` | 移動游標行 |
| | `h/l` | 移動游標列 |
| | `0/$` | 行首/行尾 |
| | `dd` | 刪除整行（分兩步送：`d` 再 `d`） |
| | `x` | 刪除游標字元 |
| | `i` | 進入 insert 模式 |
| | `escape` | 回 normal 模式 |
| | `:` | 進入 command 模式 |
| | `enter`（command 模式） | 執行指令（`:submit`、`:help`、`:quit`） |
| | `backspace`（insert/command 模式） | 刪除 |

---

## CLI 按鍵整合原則

CLI 只需對少數終端機特殊按鍵做固定轉換，其餘字母鍵小寫後原樣送出：

```
方向鍵上    → "up"
方向鍵下    → "down"
方向鍵左    → "left"
方向鍵右    → "right"
Enter       → "enter"
Escape      → "escape"
Backspace   → "backspace"
Space       → "space"
其他單字元  → 原字元（小寫）
```

新增遊戲時無論 engine 用什麼按鍵，CLI 都不需要修改。
