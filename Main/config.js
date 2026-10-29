// サイト全体の設定。ここだけ書き換えれば各ページに反映されます。
window.TABUSABA = {
  // Web側API(Cloudflare Workers など)のURL。末尾の / は付けない。
  // 空のままだと「お試しモード」になり、作成した問題はJSONで表示されるだけになります。
  // 例: "https://api.tabusaba.example.workers.dev"
  API_BASE: "https://tabusaba-api.wanchan0tabu.workers.dev",

  // 早押しクイズのジャンル(並び順のまま表示されます)
  GENRES: [
    "一般常識", "国語・ことば", "理科", "社会・地理", "歴史",
    "数学", "英語", "マインクラフト", "ゲーム", "アニメ・漫画",
    "スポーツ", "音楽", "雑学", "たぶ鯖"
  ],

  QUIZ: {
    QUESTION_MAX: 20,    // 問題文の最大文字数
    TAGS_MAX: 5,         // タグの最大個数
    TAG_LEN_MAX: 12,     // タグ1つの最大文字数
    ALT_MAX: 5,          // 別解の最大個数
    REVEAL_MS: 150       // 出題プレビューで1文字を出す間隔(ミリ秒)
  }
};
