# ddd-plugin

TypeScript の DDD ドメイン層をクラスなしで実装するためのガイドスキル。
ブランド型・コンパニオンオブジェクトパターンによる Value Object / Entity / Aggregate / Domain Service の実装規約を定義する。

## スキル

| スキル | 説明 |
|--------|------|
| `/implement-domain` | DDD ドメイン層の実装規約（ファイル命名・各パターンのテンプレート） |

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
