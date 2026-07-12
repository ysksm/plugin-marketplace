---
description: Orchestrate the full DDD feature workflow for Angular + TypeScript — spec clarification, domain design, strict TDD implementation, adversarial review. Use when starting any non-trivial feature or when the user asks to "build a feature with DDD"
---

Angular + TypeScript プロジェクトで機能開発の**全工程**を規律あるワークフローとして進める。このスキルはオーケストレーターであり、各フェーズの詳細は兄弟スキルに委譲する。

## ワークフロー全体像

```
┌─ Phase 1: 仕様確認 ─────────────────────────────┐
│  clarify-spec スキルを使用                        │
│  曖昧な点を洗い出し、ユーザーに確認し、仕様を文書化   │
│  出口条件: ユーザーが仕様を承認した                  │
└──────────────────┬───────────────────────────┘
┌─ Phase 2: ドメイン設計 ──────────────┴──────────┐
│  design-domain スキルを使用                       │
│  レイヤー構成・型・集約境界・DI トークン設計を決める   │
│  出口条件: 設計をユーザーに提示し異論がない           │
└──────────────────┬───────────────────────────┘
┌─ Phase 3: TDD 実装 ─────────────────┴──────────┐
│  tdd-cycle スキルを使用                           │
│  Red → Green → Refactor を1ユニットずつ繰り返す    │
│  出口条件: 受け入れ条件が全てテストで裏付けられている  │
└──────────────────┬───────────────────────────┘
┌─ Phase 4: 敵対的レビュー ─────────────┴─────────┐
│  adversarial-review スキルを使用                  │
│  独立レビュアーが仕様逸脱・型の穴・不変条件破りを攻撃  │
│  出口条件: Confirmed な指摘がゼロになるまで修正ループ │
└──────────────────────────────────────────────┘
```

## フェーズ遷移の鉄則

- **フェーズを飛ばさない。** 「簡単だから」と Phase 1 を省略しない。曖昧さが1つもないと確認できた場合のみ、その旨を明示して Phase 2 へ進む
- **前のフェーズに戻るのは正常。** 実装中に仕様の穴を見つけたら Phase 1 に戻ってユーザーに確認する。黙って推測で埋めない
- **各フェーズの成果物を残す。** 仕様書 (`docs/specs/`)、設計メモ、テスト、レビュー結果。次のセッションでも文脈を再構築できるようにする
- **出口条件を満たすまで次に進まない。** 特に Phase 3 → 4: テストが全て通っていない状態でレビューに進まない

## このワークフローが守る技術規約(全フェーズ共通)

| 規約 | 内容 |
|------|------|
| クラス禁止(原則) | ドメイン層・アプリケーション層は `type` + コンパニオンオブジェクト。ブランド型で primitive obsession を防ぐ |
| class の例外は 2 つだけ | ① Repository 実装(インフラ層) ② Angular が class を要求するもの(Component / Directive / Pipe) |
| DIP | 依存は常に内側(ドメイン)へ向く。Repository インターフェースはドメイン層、具象の紐付けは `InjectionToken` + provider 定義のみ |
| DI | Angular DI をコンポジションルートとして使う(`app.config.ts` の providers)。ユースケースはファクトリ関数 + `useFactory` で組み立て |
| エラーは Result 型 | ドメイン・アプリケーション層は throw しない |
| TDD | テストなしのプロダクションコードを書かない |

## 進め方の実例

ユーザー「TODO の期限管理機能を追加して」と言われたら:

1. `clarify-spec` を起動 — 「期限切れの表現は? タイムゾーンは? 期限変更は誰でも可能? 通知は範囲内?」を AskUserQuestion で確認 → `docs/specs/todo-due-date.md` に文書化 → 承認を得る
2. `design-domain` を起動 — `DueDate` VO、`Todo` への状態追加(判別 Union)、`ITodoRepository` と `TODO_REPOSITORY` トークンへの影響を設計して提示
3. `tdd-cycle` を起動 — `DueDate.of` のバリデーションテストから開始し、VO → 集約 → ユースケース → コンポーネントの順に Red-Green-Refactor
4. `adversarial-review` を起動 — レビュー指摘の修正もテストファーストで行い、クリーンになったら完了報告

## 完了報告の形式

全フェーズ完了時に以下を報告する:

- 実装した受け入れ条件の一覧と対応するテスト
- レビューで見つかり修正した問題(なければ「指摘ゼロ」)
- 仕様確認で決まった重要な決定事項(ユーザーの回答)
- 残課題・スコープ外にしたもの
