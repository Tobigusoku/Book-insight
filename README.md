# Book Insight

書籍を検索して「積読」「読了」を記録する、個人開発の読書記録アプリです。Webアプリの基礎を学びながら、バックエンド・データベース・データ活用まで段階的に作ることを目指しています。

> 開発中です。画面はExpress APIを通じて本を記録し、ローカルのPostgreSQLに保存します。以前のサーバーメモリと `localStorage` の記録は移行・読み込みしません。

## 現在できること

- 国立国会図書館サーチの OpenSearch APIで本を検索し、候補からタイトル・著者を入力できます。NDL由来の著者名は末尾の生没年と姓・名のコンマを整えます。見つからない本は手入力できます。
- 検索候補にISBNがあれば、Open Libraryの書影を検索結果に表示します。候補を選んで登録すると書影URLも記録に保存し、一覧で表示します。画像がない・取得できない場合は代替表示にします。
- 本を積読または読了として登録し、一覧表示、タイトル・著者の編集、削除ができます。一覧では本を押すと状態・評価・読了時期・メモと操作ボタンが開きます。
- 積読・読了のどちらにも任意のメモを記録・編集でき、読了への変更時にも引き継ぎます。読了した本には1〜5の評価と読了時期（年月日・年のみ・不明）を記録・編集できます。
- 画面からExpress APIを呼び、`POST /api/books` で登録、`GET /api/books` で一覧取得、`PATCH /api/books/:id` で更新、`DELETE /api/books/:id` で削除できます。登録後は一覧を再取得してサーバーの記録と同期します。通信失敗時はエラーを表示し、登録後の一覧取得だけが失敗した場合は再読み込みを案内します。
- 本の記録はPostgreSQLに保存し、APIサーバーを再起動しても残ります。

## 技術構成

| 領域 | 現在使用している技術 |
| --- | --- |
| 画面 | React、JavaScript/JSX、Vite、CSS |
| 書籍検索・書影 | 国立国会図書館サーチ OpenSearch API、Open Library Covers |
| API | Node.js、Express、pg |
| テスト | Vitest、React Testing Library、jsdom、PostgreSQLを使うHTTP APIテスト |
| 保存 | PostgreSQL（ローカルではDockerで起動） |

現状のデータの流れは次のとおりです。

```text
ブラウザ（React） ──検索──> 国立国会図書館サーチ
       │                         └─ ISBNからOpen Libraryの書影URLを生成
       └──記録の操作──> Express API（POST・GET・PATCH・DELETE /api/books） <──> PostgreSQL
```

PostgreSQL用のテーブル定義は `db/schema.sql` に、制約の確認用SQLは `db/schema.test.sql` にあります。APIはDBへ接続済みです。分析・推薦、他メディアへの拡張は未実装です。

## ローカルで動かす

Node.js、npm、Docker Desktopが必要です。リポジトリのルートで依存関係をインストールします。

```bash
npm ci
```

初回はPostgreSQLコンテナとテスト用DBを作り、両方にテーブルを作成します。`YOUR_LOCAL_PASSWORD`は自分のローカル用パスワードに置き換えてください。以下はWindowsの`cmd`で、リポジトリのルートから実行する例です。

```cmd
docker run --name book-insight-postgres -e POSTGRES_PASSWORD=YOUR_LOCAL_PASSWORD -e POSTGRES_DB=book_insight -p 127.0.0.1:5432:5432 -v book-insight-pgdata:/var/lib/postgresql/data -d postgres:17
docker exec book-insight-postgres createdb -U postgres book_insight_test
docker exec -i book-insight-postgres psql -U postgres -d book_insight -v ON_ERROR_STOP=1 < db\schema.sql
docker exec -i book-insight-postgres psql -U postgres -d book_insight_test -v ON_ERROR_STOP=1 < db\schema.sql
```

2回目以降、コンテナが停止していれば `docker start book-insight-postgres` で再開します。`.env.example` を `.env.local` にコピーして `YOUR_PASSWORD` を同じパスワードに変更してください。`.env.local` はGitの管理対象外です。DBの構造を変える場合、このSQLをそのまま再実行せず、変更用のSQLを別途用意します。

2つのターミナルで、それぞれAPIサーバーとViteを起動します。

```bash
npm run dev:server
```

```bash
npm run dev
```

Viteが表示するURL（通常は `http://localhost:5173/`）で画面を開きます。開発中の `/api` リクエストはViteから通常 `http://localhost:3001` のAPIサーバーへ転送されます。`POST /api/books` はJSONの `title` と `author` が必須で、`status` は省略すると積読です。任意の `coverUrl` はHTTP(S)のURLまたは `null` を受け付けます。`memo` は積読・読了のどちらにも指定でき、省略時は空文字列です。読了の場合は `rating`（1〜5、省略時3）と `readDate`（年月日・年のみ・`null`）も指定できます。成功時は `201` と作成した本、入力不正や壊れたJSONには `400` を返します。`GET /api/books` は登録順の一覧を `200` で返し、未登録なら空の配列を返します。

`PATCH /api/books/:id` は変更したい項目だけをJSONで指定します。タイトル・著者・書影URL・メモの修正、積読から読了への変更、読了時の評価・読了時期の修正に対応します。成功時は更新後の本を `200` で返し、不正な値は `400`、対象がなければ `404` です。読了から積読へは戻せません。`DELETE /api/books/:id` は指定した本を削除し、成功時は本文なしの `204`、IDが不正なら `400`、対象がなければ `404` を返します。

読了として登録するJSONの例です。年のみは `{ "precision": "year", "value": "2020" }`、年月日は `precision` を `day`、`value` を `YYYY-MM-DD` にします。不明なら `readDate` は `null` です。積読には `rating` と `readDate` を指定しませんが、`memo` は指定できます。

```json
{
  "title": "雪国",
  "author": "川端康成",
  "status": "read",
  "rating": 5,
  "readDate": { "precision": "year", "value": "2020" },
  "memo": "また読みたい",
  "coverUrl": null
}
```

## テストと確認

```bash
npm test -- --run
npm run lint
npm run build
```

画面のテストは外部検索APIと書籍APIの応答をモックします。APIのテストは `book_insight_test` の本を各テストの前に消してから、実際のHTTPリクエストでCRUD、入力エラー、サーバー再起動後の保存を確認します。テスト用DBには残したい記録を入れないでください。

## 今後の方向

次はAPIからSQLを実行する流れとDB接続・エラー処理を理解し、保存の動作を手元で確認します。ReactとExpressの役割分担は維持します。書影の手元画像による追加・差し替え、分析や推薦、機械学習、他メディア対応は必要性を見て判断します。

### 友人からのフィードバックと公開方針

書籍版の基本機能とDB保存が安定した後、ローカルで動く一人用アプリを友人に見たり触ったりしてもらい、使い勝手や欲しい画面・機能について意見を聞きます。友人自身の記録を保存できるようにすることや、インターネット公開は前提としません。

ホスティング候補は、Reactのビルド成果物とExpressをRenderで配信し、PostgreSQLをNeonで運用する構成です。これは確定構成ではなく、導入時に無料枠・休止と復帰・ストレージ上限・データ保持・バックアップ・費用を公式情報で再確認します。フロントエンドとバックエンドはコード上の責務を分離したまま、同一ホストで配信する案も検討します。GitHub PagesやAWSの採用は必須ではありません。

将来、友人の個別の読書記録をクラウドへ保存する場合は、先に認証・利用者ごとのデータ分離・アクセス制御を設計します。現時点で公開や認証を実装する予定はありません。

詳しい要件は [REQUIREMENTS.md](REQUIREMENTS.md)、開発順序と学習方針は [ROADMAP.md](ROADMAP.md) にまとめています。
