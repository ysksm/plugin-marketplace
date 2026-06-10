# ddd-visualizer-plugin

TypeScript の DDD コードベースを AST 解析し、アーキテクチャを可視化するプラグイン。
[ddd-plugin](../ddd-plugin/README.md) の規約（ブランド型・コンパニオンオブジェクト・レイヤードディレクトリ）で実装されたコードを最も正確に解析できるが、一般的なレイヤードアーキテクチャの TS プロジェクトでも動作する。

## スキル

| スキル | 説明 |
|--------|------|
| `/visualize-domain` | AST 解析 → インタラクティブビューア + Mermaid markdown 生成 |

## 成果物

### 1. インタラクティブ HTML ビューア（自己完結・サーバ不要）

- **レイヤー図**: Presentation / Application / Domain / Infrastructure / DI をカラム表示し、bounded context ごとにグループ化。import / implements 依存を矢印で描画
- **ドメインモデル図 (ER)**: Aggregate → Entity → Value Object をプロパティ付きカードで表示。保持関係（has）をフィールド名ラベル付きで描画
- フィルタ（レイヤー / コンテキスト / 種別 / エッジ種）・検索・ノードクリックで依存ハイライト + 詳細パネル
- **SVG 保存**と **Mermaid 出力**（現在のフィルタ状態を反映 — 議論したい範囲だけ切り出せる）
- 単一 HTML ファイルなので Slack 添付・社内共有がそのままできる。CDN 依存なし（オフライン可）

### 2. Mermaid markdown（PR 添付用）

GitHub の PR / Issue に貼るとそのままレンダリングされる:

- レイヤー依存 `flowchart`（context ごとに subgraph）
- ドメインモデル `classDiagram`（プロパティ・操作・`<<aggregate>>` 等のステレオタイプ付き）

## スクリプトを直接使う

```bash
# 1. AST 解析 → domain-model.json
node scripts/analyze.mjs ./src --name my-app --out domain-model.json

# 2. ビューア + Mermaid 生成
node scripts/generate-viewer.mjs domain-model.json --out-dir docs/architecture
```

`typescript` は対象プロジェクトの `node_modules` から解決される（プロジェクトの TS バージョンに追従）。

### 分類の補正

パス規約に合わないプロジェクトは `ddd-viz.config.json` で補正:

```json
{
  "exclude": ["legacy/", "generated/"],
  "layerHints": { "features": "presentation", "server": "infrastructure" }
}
```

```bash
node scripts/analyze.mjs ./src --config ddd-viz.config.json
```

## インストール

```bash
claude plugin marketplace add ysksm/plugin-marketplace
claude plugin install ddd-visualizer-plugin@plugin-marketplace
```
