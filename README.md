# shao-cli-tools

邵的個人終端機工具 CLI。

```
npx @oxfoxlion/shao-cli-tools@latest
```

## 功能

### 遊戲
終端機小遊戲。

### 小小好事
記錄每天的一件小好事，支援查看今日大家的好事、新增紀錄、個人連續天數與徽章。

需要帳號（暱稱 + 6 位 PIN）。

### 聖經閱讀
在終端機閱讀聖經、搜尋節次、追蹤讀經計劃、新增節次註記。

| 功能 | 說明 |
|------|------|
| 瀏覽書卷 | 舊約 / 新約分組，選章後逐節閱讀 |
| 搜尋節次 | 關鍵字搜尋，顯示書卷、章:節與經文 |
| 讀經計劃 | 開始計劃、查看今日進度、標記完成 |
| 節次註記 | 閱讀時按 `a` 新增，可瀏覽與刪除 |

讀經計劃與節次註記需要登入（共用小小好事帳號）。

## 操作方式

| 按鍵 | 動作 |
|------|------|
| `↑` / `↓` / `j` / `k` | 上下移動 |
| `Enter` | 選擇 |
| `q` / `Ctrl+C` | 返回 / 離開 |

## 開發

```bash
npm install
npm run dev      # 直接執行 src/
npm run build    # TypeScript 編譯
npm run test     # 單元測試
```

需要 Node.js 20+。

## 發布

```bash
npm run release:patch   # 修正（1.0.x）
npm run release:minor   # 新功能（1.x.0）
npm run release:major   # 破壞性變更（x.0.0）
```

每個指令會自動完成：bumping 版本號、發布到 npm registry、push commit 與 tag 到 GitHub。
