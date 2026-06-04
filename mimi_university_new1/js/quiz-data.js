// ==================== 粉丝门禁题库 ====================
const QUIZ_DATA = [
    // ===== 互动细节题(Q) =====
    { id:"Q01", type:"Q", question:"田雷平时叫梓渝什么？", options:["月月","田大雷","大渝","渝哥"], answer:0 },
    { id:"Q02", type:"Q", question:"梓渝生气时叫田雷什么？", options:["哥哥","老公","田雷","大雷哥"], answer:2 },
    { id:"Q03", type:"Q", question:"梓渝撒娇时叫田雷什么？", options:["田雷","田大雷","大雷","哥哥"], answer:1 },
    { id:"Q04", type:"Q", question:"梓渝害羞时叫田雷什么？", options:["田大雷","哥哥","田雷","宝宝"], answer:1 },
    { id:"Q05", type:"Q", question:"田栩宁的身高是多少？", options:["185cm","188cm","190cm","192cm"], answer:2 },
    { id:"Q06", type:"Q", question:"梓渝的身高是多少？", options:["178cm","180cm","182cm","176cm"], answer:1 },
    { id:"Q07", type:"Q", question:"田栩宁是哪里人？", options:["北京","上海","山东","河南"], answer:2 },
    { id:"Q08", type:"Q", question:"梓渝是哪里人？", options:["南京","连云港","杭州","苏州"], answer:1 },
    { id:"Q09", type:"Q", question:"田雷对梓渝的昵称不包括哪个？", options:["月月","宝宝","朋朋","小渝"], answer:3 },
    { id:"Q10", type:"Q", question:"田栩宁的别名是什么？", options:["田雷","小宁","阿栩","宁宁"], answer:0 },
    { id:"Q11", type:"Q", question:"梓渝的本名是什么？", options:["郑朋","张朋","郑渝","张渝"], answer:0 },
    { id:"Q12", type:"Q", question:"这对CP中谁更高？", options:["梓渝","田栩宁","一样高","不确定"], answer:1 },
    { id:"Q13", type:"Q", question:"田栩宁和梓渝的关系定位是？", options:["同学","同事","CP/搭档","陌生人"], answer:2 },
    { id:"Q14", type:"Q", question:"田雷的体型特点是什么？", options:["小巧玲珑","瘦弱","山东大汉","微胖"], answer:2 },
    { id:"Q15", type:"Q", question:"梓渝的性格特点是？", options:["外柔内刚，嘴硬炸毛","温柔乖巧","沉默寡言","活泼开朗"], answer:0 },
    { id:"Q16", type:"Q", question:"田雷对梓渝的态度是？", options:["偏执占有欲强但嘴硬心软","冷漠疏离","无所谓","厌烦"], answer:0 },
    { id:"Q17", type:"Q", question:"梓渝和田栩宁谁更容易炸毛？", options:["田栩宁","梓渝","都一样","都不会"], answer:1 },
    { id:"Q18", type:"Q", question:"田雷对梓渝吃醋的表现是？", options:["直接发火","嘴硬但明显不高兴","完全不在意","默默哭泣"], answer:1 },
    // ===== 情感倾向题(E) =====
    { id:"E01", type:"E", question:"看到田栩宁和梓渝一起出现在活动上，你的反应是？", options:["磕到了！！！","只想看其中一个","关我什么事","觉得尴尬"], answer:0 },
    { id:"E02", type:"E", question:"梓渝夸田栩宁的时候，你的感受？", options:["他俩好甜呜呜呜","不想看这个人的脸","假的，蹭热度","毫无感觉"], answer:0 },
    { id:"E03", type:"E", question:"看到两人的互动视频，你会？", options:["反复观看截图保存","只看自己喜欢的那个人","觉得无聊划走","吐槽他们"], answer:0 },
    { id:"E04", type:"E", question:"如果有人说这对CP不好，你会？", options:["据理力争保护他们","无所谓","跟着一起说不好","默默退出群聊"], answer:0 },
    { id:"E05", type:"E", question:"你觉得磕CP最重要的是什么？", options:["两个人的真情实感","其中一个人够帅","跟风好玩","无聊消遣"], answer:0 },
    { id:"E06", type:"E", question:"看到两人分开活动，你的想法是？", options:["期待下次同框","终于只看一个人了","无所谓","希望他们永远不要同框"], answer:0 },
    { id:"E07", type:"E", question:"你会因为一个人而去讨厌另一个人吗？", options:["绝对不会！两个人都爱","会，我只喜欢一个","看情况","本来就不喜欢"], answer:0 },
    { id:"E08", type:"E", question:"你对他们互动的期待是？", options:["越多越好，甜死我","只有一个人出现就行","不期待","看到就烦"], answer:0 },
    { id:"E09", type:"E", question:"你觉得两人关系最珍贵的部分是？", options:["彼此信任和默契","其中一个人的颜值","营业感","不确定"], answer:0 },
    { id:"E10", type:"E", question:"如果只能关注一个人，你会？", options:["做不到，我两个都要","果断选我最爱的那个","都不关注","随便选一个"], answer:0 },
    { id:"E11", type:"E", question:"有人说其中一个人的坏话，你会？", options:["两个都是我的心肝，护到底","无所谓反正我只粉另一个","跟着说坏话","默默划走"], answer:0 },
    { id:"E12", type:"E", question:"看到CP超话有人发黑帖，你会？", options:["举报+反驳，守护超话环境","无所谓","偷偷点赞","一起发黑帖"], answer:0 },
    // ===== 圈内知识题(K) =====
    { id:"K01", type:"K", question:"\"甜玉米\"指的是什么？", options:["栩你渝生CP粉","一种零食","唯粉的昵称","路人"], answer:0 },
    { id:"K02", type:"K", question:"\"栩你渝生\"是什么意思？", options:["田栩宁和梓渝的CP名","一种祝福语","微博超话名","粉丝群名"], answer:0 },
    { id:"K03", type:"K", question:"CP粉丝群里的\"女儿\"是什么意思？", options:["粉丝以CP女儿身份自居","CP有个女儿","粉丝的小孩","虚拟角色"], answer:0 },
    { id:"K04", type:"K", question:"栩你渝生超话的粉丝群体叫什么？", options:["甜玉米","小甜饼","磕糖人","CP粉"], answer:0 },
    { id:"K05", type:"K", question:"以下哪个不是CP粉会做的事？", options:["同时喜爱两个人","剪两人的CP向视频","只给一个人打榜花钱","磕两人的互动"], answer:2 },
    { id:"K06", type:"K", question:"什么是\"乳科\"？", options:["一边骂CP一边磕的黑粉","乳制品爱好者","温柔的妈妈粉","科研人员"], answer:0 },
    { id:"K07", type:"K", question:"什么是\"唯粉\"？", options:["只粉其中一个人的粉丝","唯一的粉丝","非常专一的CP粉","独特风格的粉丝"], answer:0 },
    { id:"K08", type:"K", question:"迷迷宇宙是什么？", options:["栩你渝生CP粉丝的课程表网页","一个游戏","微博超话","明星工作室"], answer:0 },
    { id:"K09", type:"K", question:"CP粉最讨厌看到什么？", options:["有人挑拨离间说CP不好","两人的甜蜜互动","超话更新太快","视频太长"], answer:0 },
    { id:"K10", type:"K", question:"米米是谁？", options:["CP粉丝自居的\"女儿\"称呼","田栩宁的小名","梓渝的宠物","一个NPC"], answer:0 },
    { id:"K11", type:"K", question:"栩你渝生CP由哪两个人组成？", options:["田栩宁和梓渝","田雷和郑朋","两个虚构角色","不确定"], answer:0 },
    { id:"K12", type:"K", question:"CP超话里\"磕到了\"是什么意思？", options:["看到了甜蜜互动很高兴","撞到了东西","吵架了","饿了想吃东西"], answer:0 },
    { id:"K13", type:"K", question:"以下哪个行为最像甜玉米？", options:["看到两人同框就尖叫","只给一个人投票","在超话发黑帖","从不在超话发言"], answer:0 },
    { id:"K14", type:"K", question:"进入迷迷宇宙需要什么条件？", options:["栩你渝生超话7级以上","微博粉丝1000以上","付费会员","不需要任何条件"], answer:0 },
];

// 随机抽取N道题（保证三类都有）
function getRandomQuiz(count) {
    count = count || 3;
    var types = ['Q', 'E', 'K'];
    var result = [];
    for (var i = 0; i < types.length; i++) {
        var pool = QUIZ_DATA.filter(function(q) { return q.type === types[i]; });
        var idx = Math.floor(Math.random() * pool.length);
        result.push(pool[idx]);
    }
    while (result.length < count) {
        var idx2 = Math.floor(Math.random() * QUIZ_DATA.length);
        if (!result.find(function(r) { return r.id === QUIZ_DATA[idx2].id; })) {
            result.push(QUIZ_DATA[idx2]);
        }
    }
    return result.sort(function() { return Math.random() - 0.5; });
}
