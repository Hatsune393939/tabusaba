// サイト全体の設定。ここだけ書き換えれば各ページに反映されます。
window.TABUSABA = {
  // Web側API(Cloudflare Workers)のURL。末尾の / は付けない。
  // 空にすると「お試しモード」になり、作成した問題はJSONで表示されるだけになります。
  API_BASE: "https://tabusaba-api.wanchan0tabu.workers.dev",

  // 早押しクイズのジャンルは Main/genres.json で管理しています

  QUIZ: {
    QUESTION_MAX: 32,    // 問題文の最大文字数(Workers側の src/index.js の QUESTION_MAX と揃える)
    TAGS_MAX: 5,         // タグの最大個数
    TAG_LEN_MAX: 12,     // タグ1つの最大文字数
    ALT_MAX: 5,          // 別解の最大個数
    REVEAL_MS: 150       // 出題プレビューで1文字を出す間隔(ミリ秒)
  }
};
