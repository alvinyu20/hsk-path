/* HSK 1 content for Shanlu.
 *
 * Everything the learner sees as Chinese lives in this file, so it can be reviewed in one place.
 * Each level gets its own file (hsk1.js, later hsk2.js and hsk3.js).
 * Status of this content: checked by AI against a community HSK dataset (levels, pinyin) and read through
 * once as a teacher would. It has NOT been reviewed by a human teacher yet.
 */
window.HSK1 = (function () {
  const TEST_Q = [
    { type:'type', kicker:'Type it', prompt:'Type the pinyin for this word', big:'水', placeholder:'Pinyin, for example shui', accepts:['shui'], reveal:'shuǐ · water', explain:'Tone marks are optional for now. The third tone dips and then rises.' },
    { type:'listen', kicker:'Listen', prompt:'Which word did you hear?', audio:'茶', options:[{ id:'a', label:'吃' }, { id:'b', label:'茶' }, { id:'c', label:'书' }, { id:'d', label:'喝' }], correct:'b', reveal:'茶 · chá · tea', explain:'茶 rises (second tone). 吃 chī is high and flat (first tone).' },
    { type:'order', kicker:'Build it', prompt:'Put the words in order: I want to drink tea.', tiles:['茶', '喝', '我', '想'], seq:[2, 3, 1, 0], reveal:'我想喝茶。', explain:'Subject, then 想, then the verb, then the object.' },
    { type:'cloze', kicker:'Fill it', prompt:'Type the missing word', big:'今天天气很___。', sub:'Today the weather is very ___. (good)', placeholder:'Pinyin or character', accepts:['hao', '好'], reveal:'好 · hǎo', explain:'Adjectives do not need 是. 很 + adjective is enough.' },
    { type:'mc', kicker:'Meaning', prompt:'What does this word mean?', big:'学校', options:[{ id:'a', label:'student' }, { id:'b', label:'school' }, { id:'c', label:'to study' }, { id:'d', label:'teacher' }], correct:'b', reveal:'学校 · xuéxiào · school', explain:'学生 is a student, 学习 is to study, 老师 is a teacher.' }
  ];

  const GRAM_Q = [
    { type:'order', kicker:'Build it', prompt:'Ask: Do you like tea?', tiles:['吗', '茶', '你', '喜欢'], seq:[2, 3, 1, 0], reveal:'你喜欢茶吗？', explain:'Say the statement, then add 吗 at the end.' },
    { type:'spot', kicker:'Spot the mistake', prompt:'Tap the word that does not belong', tokens:['你', '叫', '什么', '名字', '吗'], punct:'？', spot:4, reveal:'你叫什么名字？', explain:'什么 already asks the question (what), so 吗 is not needed.' },
    { type:'cloze', kicker:'Fill it', prompt:'Make it a yes/no question', big:'他是你的老师___？', sub:'Is he your teacher?', placeholder:'Pinyin or character', accepts:['ma', '吗'], reveal:'吗 · ma', explain:'吗 turns a statement into a yes/no question.' },
    { type:'order', kicker:'Build it', prompt:'Ask: Is she your friend?', tiles:['朋友', '吗', '她', '你', '的', '是'], seq:[2, 5, 3, 4, 0, 1], reveal:'她是你的朋友吗？', explain:'Statement order stays the same. 吗 goes last.' }
  ];

  // Only the first lesson exists so far. The rest are planned and will be added after they are checked.
  const GRAM_POINTS = [
    ['Yes/no questions with 吗', 'cur', 'Ready'],
    ['是 sentences', '', 'Soon'], ['不 for negation', '', 'Soon'], ['的 for possession', '', 'Soon'], ['有 and 没有', '', 'Soon'],
    ['Question words: 什么, 谁, 哪儿', '', 'Soon'], ['在 for location', '', 'Soon'], ['想 + verb', '', 'Soon'], ['Measure word 个', '', 'Soon']
  ];
  const GRAM_EX = [
    { zh:'你是老师吗？', py:'Nǐ shì lǎoshī ma?', en:'Are you a teacher?' },
    { zh:'他喜欢茶吗？', py:'Tā xǐhuan chá ma?', en:'Does he like tea?' },
    { zh:'你想喝水吗？', py:'Nǐ xiǎng hē shuǐ ma?', en:'Do you want to drink water?' }
  ];

  // Scripted café conversation (practice script, no analysis)
  const AI = [
    { zh:'你好！你想喝什么？', py:'Nǐ hǎo! Nǐ xiǎng hē shénme?', en:'Hello! What would you like to drink?' },
    { zh:'好的。你喝热茶吗？', py:'Hǎo de. Nǐ hē rè chá ma?', en:'Okay. Do you want hot tea?' },
    { zh:'好的。你吃东西吗？', py:'Hǎo de. Nǐ chī dōngxi ma?', en:'Okay. Will you eat anything?' },
    { zh:'好。十块钱。', py:'Hǎo. Shí kuài qián.', en:'Okay. Ten yuan.' },
    { zh:'不客气！再见！', py:'Bú kèqi! Zàijiàn!', en:"You're welcome! Goodbye!" }
  ];
  const YOU = [
    { zh:'我想喝茶。', py:'Wǒ xiǎng hē chá.', en:'I would like some tea.' },
    { zh:'是的，我喝热茶。', py:'Shì de, wǒ hē rè chá.', en:'Yes, I will have hot tea.' },
    { zh:'我不吃东西，谢谢。', py:'Wǒ bù chī dōngxi, xièxie.', en:"I won't eat anything, thanks." },
    { zh:'好的，谢谢！', py:'Hǎo de, xièxie!', en:'Okay, thank you!' }
  ];
  const SPEAK_GOALS = ['Order a drink', 'Answer a question about it', 'Politely turn down food', 'Pay and say thanks'];
  const SPEAK_WORDS = [['想', 'xiǎng'], ['喝', 'hē'], ['茶', 'chá'], ['热', 'rè'], ['不', 'bù'], ['东西', 'dōngxi']];
  const SPEAK_SCENARIOS = [
    { glyph:'茶', title:'Order a drink', sub:'Café, 5 turns', ready:true },
    { glyph:'介', title:'Introduce yourself', sub:'Names, where you are from', ready:false },
    { glyph:'钱', title:'Ask the price', sub:'Shop, 4 turns', ready:false },
    { glyph:'哪', title:'Ask where something is', sub:'Street, 5 turns', ready:false }
  ];
  const PHRASES = [
    { zh:'请说慢一点儿。', py:'Qǐng shuō màn yìdiǎnr.', en:'Please speak a little slower.' },
    { zh:'请再说一遍。', py:'Qǐng zài shuō yí biàn.', en:'Please say it one more time.' }
  ];

  const CLIPS = [
    { zh:'你想喝什么？', en:'What do you want to drink?',
      words:[{ key:'ni', py:'nǐ', zh:'你' }, { key:'xiang', py:'xiǎng', zh:'想' }, { key:'he', py:'hē', zh:'喝' }, { key:'shenme', py:'shénme', zh:'什么' }],
      notes:['Two third tones in a row: 你 nǐ sounds like ní before 想 xiǎng.', '什么 shénme is said quickly, and the 么 gets very light.'] },
    { zh:'今天天气很好。', en:'The weather is very nice today.',
      words:[{ key:'jintian', py:'jīntiān', zh:'今天' }, { key:'tianqi', py:'tiānqì', zh:'天气' }, { key:'hen', py:'hěn', zh:'很' }, { key:'hao', py:'hǎo', zh:'好' }],
      notes:['很 hěn before 好 hǎo: two third tones, so 很 sounds like hén.', '今天 and 天气 are short and run together at normal speed.'] },
    { zh:'我想买一个杯子。', en:'I want to buy a cup.',
      words:[{ key:'wo', py:'wǒ', zh:'我' }, { key:'xiang', py:'xiǎng', zh:'想' }, { key:'mai', py:'mǎi', zh:'买' }, { key:'yi', py:'yí', zh:'一' }, { key:'ge', py:'gè', zh:'个' }, { key:'beizi', py:'bēizi', zh:'杯子' }],
      notes:['一 becomes yí before the fourth tone 个.', '个 is often said short and light, almost like "ge".'] },
    { zh:'你在哪儿工作？', en:'Where do you work?',
      words:[{ key:'ni', py:'nǐ', zh:'你' }, { key:'zai', py:'zài', zh:'在' }, { key:'nar', py:'nǎr', zh:'哪儿' }, { key:'gongzuo', py:'gōngzuò', zh:'工作' }],
      notes:['哪儿 nǎr is one beat: the 儿 merges into the syllable.', 'Listen for 在 zài as a quick falling tone between two longer words.'] }
  ];
  const TONES = [
    { zh:'妈', py:'mā', label:'High and flat' },
    { zh:'麻', py:'má', label:'Rising' },
    { zh:'马', py:'mǎ', label:'Dips, then rises' },
    { zh:'骂', py:'mà', label:'Falling' }
  ];

  const HUBS = [
    { hub:'电', py:'diàn', en:'electric, electricity', words:[
      { zh:'电话', py:'diànhuà', en:'telephone', parts:[['电', 'electric'], ['话', 'speech']] },
      { zh:'电脑', py:'diànnǎo', en:'computer', parts:[['电', 'electric'], ['脑', 'brain']] },
      { zh:'电视', py:'diànshì', en:'television', parts:[['电', 'electric'], ['视', 'vision']] },
      { zh:'电影', py:'diànyǐng', en:'movie', parts:[['电', 'electric'], ['影', 'shadow, image']] } ],
      gaps:[
        { en:'I watch TV in the evening.', zh:'我晚上看___。', ans:'电视' },
        { en:'He is making a phone call.', zh:'他在打___。', ans:'电话' }
      ] },
    { hub:'学', py:'xué', en:'to study, to learn', words:[
      { zh:'学习', py:'xuéxí', en:'to study', parts:[['学', 'study'], ['习', 'practice']] },
      { zh:'学生', py:'xuésheng', en:'student', parts:[['学', 'study'], ['生', 'life, person']] },
      { zh:'学校', py:'xuéxiào', en:'school', parts:[['学', 'study'], ['校', 'school']] },
      { zh:'同学', py:'tóngxué', en:'classmate', parts:[['同', 'same'], ['学', 'study']] } ],
      gaps:[
        { en:'I study Chinese.', zh:'我___汉语。', ans:'学习' },
        { en:'He is my classmate.', zh:'他是我的___。', ans:'同学' }
      ] },
    { hub:'天', py:'tiān', en:'day, sky', words:[
      { zh:'今天', py:'jīntiān', en:'today', parts:[['今', 'now, this'], ['天', 'day']] },
      { zh:'明天', py:'míngtiān', en:'tomorrow', parts:[['明', 'next, bright'], ['天', 'day']] },
      { zh:'昨天', py:'zuótiān', en:'yesterday', parts:[['昨', 'yesterday'], ['天', 'day']] },
      { zh:'天气', py:'tiānqì', en:'weather', parts:[['天', 'sky'], ['气', 'air']] } ],
      gaps:[
        { en:'The weather is nice today.', zh:'今天___很好。', ans:'天气' },
        { en:'I was at home yesterday.', zh:'我___在家。', ans:'昨天' }
      ] }
  ];
  const OPPS = [
    { a:{ zh:'大', py:'dà', en:'big' }, b:{ zh:'小', py:'xiǎo', en:'small' }, note:'Both work with 很: 很大, 很小.' },
    { a:{ zh:'多', py:'duō', en:'many, much' }, b:{ zh:'少', py:'shǎo', en:'few, little' }, note:'Put them together and you get 多少 (duōshao), "how many" or "how much".' },
    { a:{ zh:'冷', py:'lěng', en:'cold' }, b:{ zh:'热', py:'rè', en:'hot' }, note:'Both describe weather and drinks: 很冷, 热茶.' },
    { a:{ zh:'早上', py:'zǎoshang', en:'morning, early in the day' }, b:{ zh:'晚上', py:'wǎnshang', en:'evening, night' }, note:'Same 上 ending. 早 (early) and 晚 (late) are what change.' },
    { a:{ zh:'上午', py:'shàngwǔ', en:'morning' }, b:{ zh:'下午', py:'xiàwǔ', en:'afternoon' }, note:'Same 午 (noon). 上 (up) and 下 (down) give before and after noon.' },
    { a:{ zh:'来', py:'lái', en:'to come' }, b:{ zh:'去', py:'qù', en:'to go' }, note:'来 comes toward the speaker, 去 goes away from them.' }
  ];
  const TOPICS = [
    { name:'At the café', to:'speak', cta:'Use these in the café conversation',
      sentence:{ zh:'我想喝水，不想吃米饭。', py:'Wǒ xiǎng hē shuǐ, bù xiǎng chī mǐfàn.', en:"I want to drink water, and I don't want to eat rice." },
      words:[
        { zh:'茶', py:'chá', en:'tea' }, { zh:'水', py:'shuǐ', en:'water' }, { zh:'喝', py:'hē', en:'to drink' },
        { zh:'吃', py:'chī', en:'to eat' }, { zh:'钱', py:'qián', en:'money' },
        { zh:'杯子', py:'bēizi', en:'cup' }, { zh:'米饭', py:'mǐfàn', en:'cooked rice' } ] },
    { name:'At school', to:'review', cta:'Review your words',
      sentence:{ zh:'学生在学校写字。', py:'Xuésheng zài xuéxiào xiě zì.', en:'The students write characters at school.' },
      words:[
        { zh:'老师', py:'lǎoshī', en:'teacher' }, { zh:'学生', py:'xuésheng', en:'student' }, { zh:'书', py:'shū', en:'book' },
        { zh:'读', py:'dú', en:'to read' }, { zh:'写', py:'xiě', en:'to write' },
        { zh:'学校', py:'xuéxiào', en:'school' }, { zh:'同学', py:'tóngxué', en:'classmate' } ] }
  ];

  // Words that are not part of a web above but are part of HSK 1.
  const EXTRA_WORDS = [
    { zh:'朋友', py:'péngyou', en:'friend' },
    { zh:'喜欢', py:'xǐhuan', en:'to like' },
    { zh:'谢谢', py:'xièxie', en:'thanks, thank you' },
    { zh:'买', py:'mǎi', en:'to buy' },
    { zh:'医院', py:'yīyuàn', en:'hospital' }
  ];

  // One example sentence per word, using only HSK 1 vocabulary (checked by tools/audit-content.js).
  const EX = {
    '电话':{ zh:'他在打电话。', py:'Tā zài dǎ diànhuà.', en:'He is making a phone call.' },
    '电脑':{ zh:'这是我的电脑。', py:'Zhè shì wǒ de diànnǎo.', en:'This is my computer.' },
    '电视':{ zh:'我晚上看电视。', py:'Wǒ wǎnshang kàn diànshì.', en:'I watch TV in the evening.' },
    '电影':{ zh:'我喜欢看电影。', py:'Wǒ xǐhuan kàn diànyǐng.', en:'I like watching movies.' },
    '学习':{ zh:'我学习汉语。', py:'Wǒ xuéxí Hànyǔ.', en:'I study Chinese.' },
    '学生':{ zh:'他是学生。', py:'Tā shì xuésheng.', en:'He is a student.' },
    '学校':{ zh:'我去学校。', py:'Wǒ qù xuéxiào.', en:'I go to school.' },
    '同学':{ zh:'他是我的同学。', py:'Tā shì wǒ de tóngxué.', en:'He is my classmate.' },
    '今天':{ zh:'今天很冷。', py:'Jīntiān hěn lěng.', en:'It is very cold today.' },
    '明天':{ zh:'明天你去学校吗？', py:'Míngtiān nǐ qù xuéxiào ma?', en:'Are you going to school tomorrow?' },
    '昨天':{ zh:'我昨天在家。', py:'Wǒ zuótiān zài jiā.', en:'I was at home yesterday.' },
    '天气':{ zh:'今天天气很好。', py:'Jīntiān tiānqì hěn hǎo.', en:'The weather is very nice today.' },
    '大':{ zh:'这个杯子很大。', py:'Zhège bēizi hěn dà.', en:'This cup is very big.' },
    '小':{ zh:'这个杯子很小。', py:'Zhège bēizi hěn xiǎo.', en:'This cup is very small.' },
    '多':{ zh:'学校里有很多学生。', py:'Xuéxiào li yǒu hěn duō xuésheng.', en:'There are many students at the school.' },
    '少':{ zh:'我的钱很少。', py:'Wǒ de qián hěn shǎo.', en:'I have very little money.' },
    '冷':{ zh:'我不喜欢冷水。', py:'Wǒ bù xǐhuan lěng shuǐ.', en:"I don't like cold water." },
    '热':{ zh:'我想喝热茶。', py:'Wǒ xiǎng hē rè chá.', en:'I want to drink hot tea.' },
    '早上':{ zh:'我早上喝茶。', py:'Wǒ zǎoshang hē chá.', en:'I drink tea in the morning.' },
    '晚上':{ zh:'你晚上去哪儿？', py:'Nǐ wǎnshang qù nǎr?', en:'Where are you going this evening?' },
    '上午':{ zh:'我上午在学校。', py:'Wǒ shàngwǔ zài xuéxiào.', en:'I am at school in the morning.' },
    '下午':{ zh:'下午你在家吗？', py:'Xiàwǔ nǐ zài jiā ma?', en:'Are you at home in the afternoon?' },
    '来':{ zh:'你明天来学校吗？', py:'Nǐ míngtiān lái xuéxiào ma?', en:'Are you coming to school tomorrow?' },
    '去':{ zh:'我去商店。', py:'Wǒ qù shāngdiàn.', en:'I am going to the store.' },
    '茶':{ zh:'我喜欢喝茶。', py:'Wǒ xǐhuan hē chá.', en:'I like drinking tea.' },
    '水':{ zh:'我想喝水。', py:'Wǒ xiǎng hē shuǐ.', en:'I want to drink water.' },
    '喝':{ zh:'我想喝茶。', py:'Wǒ xiǎng hē chá.', en:'I want to drink tea.' },
    '吃':{ zh:'我想吃米饭。', py:'Wǒ xiǎng chī mǐfàn.', en:'I want to eat rice.' },
    '钱':{ zh:'多少钱？', py:'Duōshao qián?', en:'How much is it?' },
    '杯子':{ zh:'这是我的杯子。', py:'Zhè shì wǒ de bēizi.', en:'This is my cup.' },
    '米饭':{ zh:'你吃米饭吗？', py:'Nǐ chī mǐfàn ma?', en:'Do you eat rice?' },
    '老师':{ zh:'她是我的老师。', py:'Tā shì wǒ de lǎoshī.', en:'She is my teacher.' },
    '书':{ zh:'这是我的书。', py:'Zhè shì wǒ de shū.', en:'This is my book.' },
    '读':{ zh:'他在读书。', py:'Tā zài dú shū.', en:'He is reading.' },
    '写':{ zh:'我在写字。', py:'Wǒ zài xiě zì.', en:'I am writing characters.' },
    '朋友':{ zh:'他是我的朋友。', py:'Tā shì wǒ de péngyou.', en:'He is my friend.' },
    '喜欢':{ zh:'我喜欢苹果。', py:'Wǒ xǐhuan píngguǒ.', en:'I like apples.' },
    '谢谢':{ zh:'谢谢你！', py:'Xièxie nǐ!', en:'Thank you!' },
    '买':{ zh:'我想买书。', py:'Wǒ xiǎng mǎi shū.', en:'I want to buy a book.' },
    '医院':{ zh:'他在医院。', py:'Tā zài yīyuàn.', en:'He is at the hospital.' }
  };

  return { TEST_Q, GRAM_Q, GRAM_POINTS, GRAM_EX, AI, YOU, SPEAK_GOALS, SPEAK_WORDS, SPEAK_SCENARIOS, PHRASES, CLIPS, TONES, HUBS, OPPS, TOPICS, EXTRA_WORDS, EX };
})();
