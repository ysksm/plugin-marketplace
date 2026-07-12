# react-ddd-superpowers

React + TypeScript + Vite で DDD 開発の**全工程**を規律あるワークフローとして回すためのスキルセット。
superpowers スタイルで工程ごとにスキルを分割し、オーケストレーターが束ねる。

技術規約:

- ドメイン層・アプリケーション層は **ブランド型 + コンパニオンオブジェクト**(クラス禁止)
- **Repository 実装のみ class 使用可**(インフラ層)
- **DIP** — Repository インターフェースはドメイン層、具象はコンポジションルートで注入
- **DI** — React Context によるコンポジションルート、ユースケースはファクトリ関数
- **TDD** — 失敗するテストなしにプロダクションコードを書かない(Vitest)
- **敵対的レビュー** — 独立サブエージェントが多視点で攻撃、反証に耐えた指摘のみ採用
- **仕様の事前確認** — 曖昧点は実装前に AskUserQuestion で確認し文書化

## スキル

| スキル | フェーズ | 説明 |
|--------|---------|------|
| `/ddd-workflow` | 全体 | オーケストレーター。仕様確認 → 設計 → TDD → 敵対的レビューの順に兄弟スキルへ委譲 |
| `/clarify-spec` | Phase 1 | 曖昧点の洗い出し・ユーザー確認・仕様書化(`docs/specs/`) |
| `/design-domain` | Phase 2 | レイヤー設計・ブランド型/コンパニオン・Repository class・DI/DIP コンポジションルート |
| `/tdd-cycle` | Phase 3 | Vitest による Red-Green-Refactor。InMemory Repository、層別テスト戦略 |
| `/adversarial-review` | Phase 4 | 5 視点の並列レビュアーによる攻撃 → 反証 → テストファーストで修正ループ |

関連プラグイン:
- [ddd-plugin](../ddd-plugin/README.md) — ドメイン層の詳細な実装規約(VO / Entity / Aggregate / Event の各テンプレート)。`design-domain` はこの規約を前提にする
- [angular-ddd-superpowers](../angular-ddd-superpowers/README.md) — 同ワークフローの Angular 版

## インストール

### 1. マーケットプレイスを登録する(初回のみ)

```bash
claude plugin marketplace add /path/to/plugin-marketplace
```

GitHub リポジトリから登録する場合:

```bash
claude plugin marketplace add ysksm/plugin-marketplace
```

### 2. プラグインをインストールする

```bash
claude plugin install react-ddd-superpowers@plugin-marketplace
```

### アップデート / アンインストール

```bash
claude plugin update react-ddd-superpowers@plugin-marketplace
claude plugin uninstall react-ddd-superpowers@plugin-marketplace
```

## 使い方

機能開発を始めるときに `/ddd-workflow` を起動するだけでよい。個別フェーズだけ使いたい場合(例: 既存コードのレビューだけ)は各スキルを直接起動する。
