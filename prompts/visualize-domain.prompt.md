あなたは TypeScript プロジェクトのアーキテクチャを可視化するエンジニアです。以下の手順に従って、対象プロジェクトを AST 解析し、ドメイン構成の可視化資料を生成してください。

---

TypeScript プロジェクトを AST 解析し、ドメイン構成を可視化する。成果物は2つ:

1. **自己完結インタラクティブ HTML ビューア** — レイヤー図(Presentation / Application / Domain / Infrastructure / DI)とドメインモデル図(ER)。フィルタ・検索・依存ハイライト・SVG/Mermaid エクスポート付き。サーバ不要、オフラインで開ける
2. **Mermaid markdown** — GitHub の PR / Issue に貼るとそのままレンダリングされる設計資料

## 手順

### 0. 解析スクリプトの取得

解析・生成スクリプトは `ysksm/plugin-marketplace` リポジトリの `plugins/ddd-visualizer-plugin/` にある。プラグインとしてインストールされていない前提で、作業ディレクトリに取得する(`generate-viewer.mjs` はスクリプトから見て `../templates/viewer.html` を参照するため、ディレクトリ構造を保つこと):

```bash
BASE=https://raw.githubusercontent.com/ysksm/plugin-marketplace/main/plugins/ddd-visualizer-plugin
mkdir -p .ddd-viz/scripts .ddd-viz/templates
curl -fsSL -o .ddd-viz/scripts/analyze.mjs        "$BASE/scripts/analyze.mjs"
curl -fsSL -o .ddd-viz/scripts/generate-viewer.mjs "$BASE/scripts/generate-viewer.mjs"
curl -fsSL -o .ddd-viz/templates/viewer.html       "$BASE/templates/viewer.html"
```

- ネットワークが使えない場合や `ysksm/plugin-marketplace` を clone 済みの場合は、clone 内の `plugins/ddd-visualizer-plugin/scripts/` を直接パス指定して実行してよい
- `.ddd-viz/` は一時的な作業用ディレクトリ。リポジトリにコミットしない(`.gitignore` に追加するか、完了後に削除する)

### 1. 解析対象の確認

- 対象の `src` ディレクトリを特定する(指定がなければプロジェクトの `src/` を探す。モノレポなら各パッケージの src を複数指定できる)
- 対象プロジェクトに `typescript` がインストールされていることを確認する(スクリプトは対象プロジェクトの `node_modules` から TS を解決して使う)

### 2. AST 解析

```bash
node .ddd-viz/scripts/analyze.mjs <srcDir> [moreSrcDirs...] \
  --name <プロジェクト名> --out domain-model.json
```

出力される `domain-model.json` の構造:

- `nodes[]` — export ごとに1ノード。`name` / `kind` / `layer` / `context` / `file` / `props`(プロパティと型)/ `methods`(コンパニオンの操作)/ `brand`(ブランド型か)/ `unionMembers`
- `edges[]` — `kind: 'import'`(モジュール依存), `'has'`(プロパティによる保持。ER のリレーションに相当), `'implements'`
- レイヤーはパスから判定: `domain/` `application/` `infrastructure/` `presentation|ui|components|pages|hooks/` `di/`
- 種別はパス規約 + AST から判定: value-object(brand 型検出)/ entity / aggregate / domain-event / domain-service / repository-interface / use-case / repository-impl / api-client / hook / component など
- `Props` / `Params` / `Input` / `Result` 等のサフィックスは `support-type`(ビューアではデフォルト非表示)

### 3. 解析結果のレビュー(インタラクティブな補正)

JSON を確認し、ユーザーに分類結果を報告する:

- `layer: "other"` のノード → パス規約に合わない配置。`ddd-viz.config.json` で補正するか提案する
- `context: null` が多い → bounded context ディレクトリが切られていない可能性。ドメインの階層化を提案する

補正用の設定ファイル(カレントに `ddd-viz.config.json` を置き `--config` で渡す):

```json
{
  "exclude": ["legacy/", "generated/"],
  "layerHints": { "features": "presentation", "server": "infrastructure" }
}
```

### 4. 成果物の生成

```bash
node .ddd-viz/scripts/generate-viewer.mjs domain-model.json --out-dir docs/architecture
```

- `<name>-domain-viewer.html` — モデル埋め込み済みビューア
- `<name>-domain-diagram.md` — Mermaid 図2点(レイヤー依存 flowchart + ドメインモデル classDiagram)

### 5. 確認と案内

- macOS なら `open <viewer>.html` でブラウザ表示を促す
- ビューアの操作: 左サイドバーでレイヤー / コンテキスト / 種別 / エッジ種をフィルタ、検索で絞り込み、ノードクリックで依存ハイライト + 詳細パネル、「Mermaid 出力」は**現在のフィルタ状態を反映した** Mermaid を生成する(議論したい範囲だけ切り出して PR に貼れる)
- PR 添付には `.md` をそのままコミットするか、ビューアで絞り込んだ Mermaid をコピーして PR 本文に貼る

## ユースケース別ガイド

| 目的 | 推奨手順 |
|------|---------|
| 設計レビュー・議論 | ビューア HTML を共有(Slack 添付可・サーバ不要)。レイヤー図でアーキテクチャ違反(UI→Infra 直接依存など)がないか目視確認 |
| PR の説明資料 | `.md` を `docs/architecture/` にコミット、または絞り込んだ Mermaid を PR 本文へ |
| 新メンバーのオンボーディング | ER ビューで集約 → エンティティ → VO の構造を見せる |
| リファクタリング検討 | 変更前後で `analyze.mjs` を実行して図を比較 |

## 注意

- 解析は構文ベース(型チェッカー非使用)なので高速だが、re-export 経由の間接依存や動的 import は追跡しない
- `node_modules` / `dist` / `*.test.ts` / `*.spec.ts` / `.d.ts` は自動除外
- レイヤー判定に失敗するノードが多い場合は、まずディレクトリ構造を ddd-plugin の規約(`src/domain/{context}/...`)に寄せることを提案する

---

## 解析対象

(ここに解析対象を記述する。例: 「このリポジトリの `packages/web/src` を解析して、成果物は `docs/architecture/` に出力」)
