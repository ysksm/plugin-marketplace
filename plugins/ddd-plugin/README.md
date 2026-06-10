# ddd-plugin

TypeScript の DDD ドメイン層をクラスなしで実装するためのガイドスキル。
Eric Evans『Domain-Driven Design』/ Vaughn Vernon『Implementing Domain-Driven Design』の戦術的パターンを、
ブランド型・コンパニオンオブジェクト・判別 Union・Result 型による関数型スタイルで実装する規約を定義する。

## スキル

| スキル | 説明 |
|--------|------|
| `/implement-domain` | DDD ドメイン層の実装規約（ファイル命名・各パターンのテンプレート・レビューチェックリスト） |

## v2.0.0 の主な内容

- **Result 型による関数型エラーハンドリング** — ドメイン層から throw しない。エラーは判別 Union
- **判別 Union による状態モデリング** — 不正な状態遷移を型エラーにする（make illegal states unrepresentable）
- **Domain Event**（Vernon Ch.8）— 状態変更操作が `{ aggregate, events }` を返す
- **Vernon の集約設計4原則**（IDDD Ch.10）— 小さい集約・ID 参照・結果整合性
- **コレクション指向 Repository**（Vernon Ch.12）— `save`/`findById`/`nextId`。生成責務は Factory へ
- **Specification パターン**（Evans Ch.10、任意採用）
- **レビューチェックリスト** — 既存ドメイン層の監査にも使える

関連プラグイン: [ddd-visualizer-plugin](../ddd-visualizer-plugin/README.md) — このスキルで実装したドメインを AST 解析して ER 図・レイヤー図として可視化する。

## スキルを使わずプロンプトとして使う

プラグイン / スキルをインストールできない環境では、[prompts/implement-domain.prompt.md](../../prompts/implement-domain.prompt.md) の中身をそのまま AI アシスタントに貼り付けることで、このスキルと同等の規約で実装できる。詳細は [prompts/README.md](../../prompts/README.md) を参照。

## インストール

### 1. マーケットプレイスを登録する（初回のみ）

```bash
claude plugin marketplace add /path/to/plugin-marketplace
```

GitHub リポジトリから登録する場合:

```bash
claude plugin marketplace add ysksm/plugin-marketplace
```

### 2. プラグインをインストールする

```bash
claude plugin install ddd-plugin@plugin-marketplace
```

インストールはユーザースコープで行われ、全プロジェクトで `/implement-domain` が使えるようになる。

### アップデート

```bash
claude plugin update ddd-plugin@plugin-marketplace
```

### アンインストール

```bash
claude plugin uninstall ddd-plugin@plugin-marketplace
```
