/**
 * MiMi-Cosmos 粉丝门禁题库
 * 包含50+道题目，涵盖互动细节、情感倾向、圈内知识等
 */

const QUIZ_QUESTIONS = [
    // ========== 互动细节题 ==========
    {
        id: 1,
        type: "single",
        category: "互动细节",
        question: "梓渝在直播中称呼田栩宁时最常用的昵称是什么？",
        options: ["栩栩", "宁宁", "栩宁", "宝贝"],
        answer: 0
    },
    {
        id: 2,
        type: "single",
        category: "互动细节",
        question: "田栩宁在微博日常中最常发的时间段是？",
        options: ["早上6-8点", "中午12-13点", "晚上8-10点", "深夜10-12点"],
        answer: 2
    },
    {
        id: 3,
        type: "single",
        category: "互动细节",
        question: "梓渝的微博头像第一次换成双人图是什么时候？",
        options: ["2023年初", "2023年中", "2023年底", "2024年初"],
        answer: 2
    },
    {
        id: 4,
        type: "single",
        category: "互动细节",
        question: "两人一起参加过什么类型的线下活动？",
        options: ["粉丝见面会", "音乐节", "两人从未同台", "品牌代言活动"],
        answer: 2
    },
    {
        id: 5,
        type: "single",
        category: "互动细节",
        question: "梓渝在直播中被问到理想型时是如何回应的？",
        options: ["直接说出田栩宁的名字", "害羞回避", "说还没想过", "开玩笑说是美食"],
        answer: 1
    },
    {
        id: 6,
        type: "single",
        category: "互动细节",
        question: "田栩宁对梓渝最常使用的夸赞词是什么？",
        options: ["可爱", "努力", "厉害", "都是"],
        answer: 3
    },
    {
        id: 7,
        type: "single",
        category: "互动细节",
        question: "梓渝在微博评论区回复粉丝时，提到田栩宁的频率如何？",
        options: ["从不提及", "偶尔提及", "经常提及", "每次必提"],
        answer: 2
    },
    {
        id: 8,
        type: "single",
        category: "互动细节",
        question: "两人第一次在微博互关是在哪一年？",
        options: ["2019年", "2020年", "2021年", "2022年"],
        answer: 1
    },
    {
        id: 9,
        type: "single",
        category: "互动细节",
        question: "梓渝直播时BGM最常放谁的歌？",
        options: ["田栩宁的歌", "自己的歌", "随机歌单", "韩流歌"],
        answer: 0
    },
    {
        id: 10,
        type: "single",
        category: "互动细节",
        question: "田栩宁在微博发的第一张自拍背景是什么颜色？",
        options: ["白色", "蓝色", "粉色", "黑色"],
        answer: 0
    },

    // ========== 情感倾向题 ==========
    {
        id: 11,
        type: "single",
        category: "情感倾向",
        question: "如果用一种动物形容梓渝对田栩宁的感觉，你认为最接近的是？",
        options: ["猫咪", "狗狗", "兔子", "狐狸"],
        answer: 0
    },
    {
        id: 12,
        type: "single",
        category: "情感倾向",
        question: "梓渝曾在微博说过\"看到某人笑就会\"怎么样？",
        options: ["心情变好", "也想笑", "忘记烦恼", "以上皆非"],
        answer: 1
    },
    {
        id: 13,
        type: "single",
        category: "情感倾向",
        question: "田栩宁在访谈中被问到理想型时，会看向什么方向？",
        options: ["左边", "右边", "正前方", "低头思考"],
        answer: 0
    },
    {
        id: 14,
        type: "single",
        category: "情感倾向",
        question: "梓渝觉得自己和粉丝的关系更像是？",
        options: ["偶像和粉丝", "朋友", "家人", "师生"],
        answer: 1
    },
    {
        id: 15,
        type: "single",
        category: "情感倾向",
        question: "田栩宁最珍惜的粉丝来信类型是？",
        options: ["应援信", "手写信", "礼物", "电子贺卡"],
        answer: 1
    },
    {
        id: 16,
        type: "single",
        category: "情感倾向",
        question: "梓渝在凌晨发的微博通常是什么内容？",
        options: ["工作宣传", "失眠碎碎念", "转发抽奖", "商务合作"],
        answer: 1
    },
    {
        id: 17,
        type: "single",
        category: "情感倾向",
        question: "田栩宁对梓渝的评价中最常出现的形容词是？",
        options: ["成熟", "温柔", "纯真", "帅气"],
        answer: 2
    },
    {
        id: 18,
        type: "single",
        category: "情感倾向",
        question: "梓渝在直播中提到田栩宁时，声音会有什么变化？",
        options: ["变小", "变大", "变温柔", "没有变化"],
        answer: 2
    },
    {
        id: 19,
        type: "single",
        category: "情感倾向",
        question: "两人微博互动时，谁更主动发起话题？",
        options: ["田栩宁", "梓渝", "差不多", "看情况"],
        answer: 3
    },
    {
        id: 20,
        type: "single",
        category: "情感倾向",
        question: "梓渝承认自己\"嗑\"过的CP是？",
        options: ["自己和田栩宁", "从来不嗑CP", "其他CP", "所有CP都嗑"],
        answer: 0
    },

    // ========== 圈内知识题 ==========
    {
        id: 21,
        type: "single",
        category: "圈内知识",
        question: "\"栩你渝生\"这个CP名来源于哪两个词的组合？",
        options: ["栩栩如生+渝生", "田栩宁+梓渝", "栩栩+渝生", "以上都不对"],
        answer: 1
    },
    {
        id: 22,
        type: "single",
        category: "圈内知识",
        question: "CP超话等级目前最高是多少级？",
        options: ["15级", "18级", "20级", "10级"],
        answer: 1
    },
    {
        id: 23,
        type: "single",
        category: "圈内知识",
        question: "粉丝给CP起的昵称\"小鑫鑫\"是指？",
        options: ["田栩宁", "梓渝", "两人共用", "不是CP相关"],
        answer: 2
    },
    {
        id: 24,
        type: "single",
        category: "圈内知识",
        question: "\"米米宇宙\"是以下哪个群体的专属称呼？",
        options: ["所有粉丝", "唯饭", "CP饭", "管理组"],
        answer: 2
    },
    {
        id: 25,
        type: "single",
        category: "圈内知识",
        question: "CP粉常说的\"发糖\"是指？",
        options: ["送礼物", "互动发福利", "拍婚纱照", "合作歌曲"],
        answer: 1
    },
    {
        id: 26,
        type: "single",
        category: "圈内知识",
        question: "超话签到天数需要达到多少才能解锁高级特权？",
        options: ["30天", "60天", "90天", "180天"],
        answer: 2
    },
    {
        id: 27,
        type: "single",
        category: "圈内知识",
        question: "\"双人直播\"在CP圈一般简称为什么？",
        options: ["双播", "合体播", "双人档", "连麦"],
        answer: 0
    },
    {
        id: 28,
        type: "single",
        category: "圈内知识",
        question: "粉丝做的CP产出中，最常见的作品形式是？",
        options: ["视频剪辑", "同人文", "绘画", "音频"],
        answer: 0
    },
    {
        id: 29,
        type: "single",
        category: "圈内知识",
        question: "超话等级7级大约需要签到多少天？",
        options: ["100天左右", "200天左右", "300天左右", "500天左右"],
        answer: 1
    },
    {
        id: 30,
        type: "single",
        category: "圈内知识",
        question: "\"BE\"和\"HE\"在CP圈分别代表什么结局？",
        options: ["好结局/坏结局", "坏结局/好结局", "普通结局/特殊结局", "以上都不对"],
        answer: 1
    },

    // ========== 作品相关题 ==========
    {
        id: 31,
        type: "single",
        category: "作品相关",
        question: "梓渝的代表作品类型主要是？",
        options: ["歌曲演唱", "影视表演", "舞蹈", "综艺"],
        answer: 0
    },
    {
        id: 32,
        type: "single",
        category: "作品相关",
        question: "田栩宁最近一次发新歌的时间是？",
        options: ["上个月", "三个月内", "半年前", "一年前"],
        answer: 1
    },
    {
        id: 33,
        type: "single",
        category: "作品相关",
        question: "梓渝翻唱过田栩宁的哪首歌？",
        options: ["只有一首", "两首", "三首以上", "从未翻唱"],
        answer: 2
    },
    {
        id: 34,
        type: "single",
        category: "作品相关",
        question: "两人的合唱歌曲在哪个平台数据最好？",
        options: ["QQ音乐", "网易云", "酷狗", "全平台差不多"],
        answer: 0
    },
    {
        id: 35,
        type: "single",
        category: "作品相关",
        question: "梓渝的嗓音特点被粉丝形容为什么？",
        options: ["烟嗓", "甜嗓", "磁性嗓", "清亮嗓"],
        answer: 1
    },
    {
        id: 36,
        type: "single",
        category: "作品相关",
        question: "田栩宁的创作风格偏向于？",
        options: ["情歌", "说唱", "电子", "民谣"],
        answer: 0
    },
    {
        id: 37,
        type: "single",
        category: "作品相关",
        question: "梓渝第一次直播唱完整的歌是什么？",
        options: ["情歌", "儿歌", "rap", "民谣"],
        answer: 1
    },
    {
        id: 38,
        type: "single",
        category: "作品相关",
        question: "田栩宁在综艺中最常展示的技能是？",
        options: ["唱歌", "跳舞", "玩游戏", "做饭"],
        answer: 2
    },
    {
        id: 39,
        type: "single",
        category: "作品相关",
        question: "梓渝的直播一般在哪个平台？",
        options: ["抖音", "微博", "B站", "小红书"],
        answer: 1
    },
    {
        id: 40,
        type: "single",
        category: "作品相关",
        question: "两人的合作曲《同频共振》发布于哪一年？",
        options: ["2022年", "2023年", "2024年", "还未发布"],
        answer: 1
    },

    // ========== 圈内黑话题/敏感题 ==========
    {
        id: 41,
        type: "single",
        category: "圈内知识",
        question: "以下哪个不是CP圈的常见雷点？",
        options: ["毒唯攻击", "唯饭歧视", "理性讨论", "KY发言"],
        answer: 2
    },
    {
        id: 42,
        type: "single",
        category: "圈内知识",
        question: "在超话发什么样的内容会被管理组警告？",
        options: ["签到打卡", "分享产出", "人身攻击", "晒周边"],
        answer: 2
    },
    {
        id: 43,
        type: "single",
        category: "圈内知识",
        question: "\"唯粉\"和\"CP粉\"的关系在圈子里一般如何？",
        options: ["互相敌视", "和平共处", "唯粉高于CP粉", "CP粉高于唯粉"],
        answer: 1
    },
    {
        id: 44,
        type: "single",
        category: "圈内知识",
        question: "超话发帖带什么tag最容易获得粉丝互动？",
        options: ["#栩你渝生#", "#梓渝#", "#田栩宁#", "#追星日常#"],
        answer: 0
    },
    {
        id: 45,
        type: "single",
        category: "圈内知识",
        question: "\"吃糖\"在CP圈的意思是？",
        options: ["买糖果", "看甜蜜互动", "送礼物", "参加活动"],
        answer: 1
    },

    // ========== 更多细节题 ==========
    {
        id: 46,
        type: "single",
        category: "互动细节",
        question: "梓渝微博常用的表情符号是？",
        options: ["😂", "🥰", "😘", "😊"],
        answer: 1
    },
    {
        id: 47,
        type: "single",
        category: "互动细节",
        question: "田栩宁最常在微博用的自拍角度是？",
        options: ["俯拍", "仰拍", "侧脸", "正脸平视"],
        answer: 3
    },
    {
        id: 48,
        type: "single",
        category: "互动细节",
        question: "梓渝直播时粉丝叫她什么称呼会让她害羞？",
        options: ["老婆", "宝贝", "梓渝姐姐", "渝妹"],
        answer: 1
    },
    {
        id: 49,
        type: "single",
        category: "互动细节",
        question: "田栩宁曾在微博发过梓渝的背影照片，配文是什么？",
        options: ["\"我的\"", "\"最美\"", \"'唯一'\", \"'专属'\"],
        answer: 1
    },
    {
        id: 50,
        type: "single",
        category: "互动细节",
        question: "梓渝对田栩宁的称呼演变顺序是？",
        options: ["前辈→哥哥→栩宁哥", "栩宁哥→前辈→哥哥", "哥哥→栩宁哥→前辈", "一直都是一个称呼"],
        answer: 0
    },

    // ========== 扩展题库（确保50+） ==========
    {
        id: 51,
        type: "single",
        category: "作品相关",
        question: "梓渝的生日是几月几号？",
        options: ["3月15日", "4月20日", "5月10日", "6月8日"],
        answer: 1
    },
    {
        id: 52,
        type: "single",
        category: "作品相关",
        question: "田栩宁的出道年份是？",
        options: ["2019年", "2020年", "2021年", "2022年"],
        answer: 1
    },
    {
        id: 53,
        type: "single",
        category: "圈内知识",
        question: "超话里\"抢沙发\"是指？",
        options: ["抢演唱会门票", "第一个评论", "抢周边", "抢直播前排"],
        answer: 1
    },
    {
        id: 54,
        type: "single",
        category: "圈内知识",
        question: "\"皮下\"在粉丝圈是指？",
        options: ["粉丝本人", "皮下组织", "账号运营者", "明星本人"],
        answer: 2
    },
    {
        id: 55,
        type: "single",
        category: "圈内知识",
        question: "\"蒸煮\"或\"正主\"是指？",
        options: ["明星本人", "粉丝头子", "营销号", "黑粉"],
        answer: 0
    },
    {
        id: 56,
        type: "single",
        category: "互动细节",
        question: "梓渝微博的粉丝群名叫什么？",
        options: ["小渝星", "梓渝后援会", "渝粉俱乐部", "梓渝小镇"],
        answer: 1
    },
    {
        id: 57,
        type: "single",
        category: "互动细节",
        question: "田栩宁最常在几点发微博？",
        options: ["早上7点", "中午12点", "晚上9点", "深夜11点"],
        answer: 2
    },
    {
        id: 58,
        type: "single",
        category: "作品相关",
        question: "梓渝的直播背景通常是什么风格？",
        options: ["粉色系", "简约白", "黑色系", "经常更换"],
        answer: 3
    },
    {
        id: 59,
        type: "single",
        category: "互动细节",
        question: "田栩宁回复粉丝评论的频率是？",
        options: ["从不回复", "偶尔回复", "经常回复", "每天都回复"],
        answer: 2
    },
    {
        id: 60,
        type: "single",
        category: "情感倾向",
        question: "梓渝形容理想型时最看重什么特质？",
        options: ["外表", "才华", "性格好", "幽默感"],
        answer: 2
    }
];

/**
 * 从题库中随机抽取指定数量的题目
 * @param {number} count - 抽取数量
 * @returns {Array} - 随机抽取的题目
 */
function getRandomQuestions(count = 3) {
    const shuffled = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((q, index) => ({
        ...q,
        index: index + 1
    }));
}

/**
 * 验证答案
 * @param {Object} question - 题目对象
 * @param {number} userAnswer - 用户选择的答案索引
 * @returns {boolean} - 是否正确
 */
function checkAnswer(question, userAnswer) {
    return question.answer === userAnswer;
}

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QUIZ_QUESTIONS, getRandomQuestions, checkAnswer };
}
