export const runtime = "nodejs";

interface Voice {
  id: string;
  name: string;
  category: string;
  instruct: boolean;
  timestamp: boolean;
}

// Source: https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list
const COSYVOICE_V3_FLASH_VOICES: Voice[] = [
  // 置顶推荐
  { id: "longanxuan_v3", name: "龙安宣 · 经典直播女", category: "直播", instruct: false, timestamp: true },
  // 社交陪伴 - 标杆音色
  { id: "longanyang", name: "龙安洋 · 阳光男声", category: "社交陪伴", instruct: true, timestamp: true },
  { id: "longanhuan", name: "龙安欢 · 活泼女声", category: "社交陪伴", instruct: true, timestamp: true },
  // 童声
  { id: "longhuhu_v3", name: "龙呼呼 · 天真女童", category: "童声", instruct: true, timestamp: true },
  // 智能玩具 / 儿童故事机
  { id: "longpaopao_v3", name: "龙泡泡 · 活力童声", category: "儿童", instruct: false, timestamp: true },
  { id: "longjielidou_v3", name: "龙杰力豆 · 阳光男童", category: "儿童", instruct: false, timestamp: true },
  { id: "longxian_v3", name: "龙仙 · 可爱女童", category: "儿童", instruct: false, timestamp: true },
  { id: "longling_v3", name: "龙铃 · 天真女童", category: "儿童", instruct: false, timestamp: true },
  // 儿童有声书
  { id: "longshanshan_v3", name: "龙闪闪 · 故事童声", category: "有声书", instruct: false, timestamp: true },
  { id: "longniuniu_v3", name: "龙牛牛 · 阳光男童", category: "有声书", instruct: false, timestamp: true },
  // 方言
  { id: "longjiaxin_v3", name: "龙嘉欣 · 粤语女声", category: "方言", instruct: false, timestamp: true },
  { id: "longjiayi_v3", name: "龙嘉怡 · 粤语女声", category: "方言", instruct: false, timestamp: true },
  { id: "longanyue_v3", name: "龙安粤 · 粤语男声", category: "方言", instruct: false, timestamp: true },
  { id: "longlaotie_v3", name: "龙老铁 · 东北男声", category: "方言", instruct: false, timestamp: true },
  { id: "longshange_v3", name: "龙陕哥 · 陕西男声", category: "方言", instruct: false, timestamp: true },
  { id: "longanmin_v3", name: "龙安闽 · 闽南女声", category: "方言", instruct: false, timestamp: true },
  // 出海营销
  { id: "loongkyong_v3", name: "loongkyong · 韩语女声", category: "外语", instruct: false, timestamp: true },
  { id: "loongriko_v3", name: "Riko · 日语女声", category: "外语", instruct: false, timestamp: true },
  { id: "loongtomoka_v3", name: "loongtomoka · 日语女声", category: "外语", instruct: false, timestamp: true },
  // 诗词朗诵
  { id: "longfei_v3", name: "龙飞 · 诗词朗诵", category: "专业", instruct: false, timestamp: true },
  // 电话销售 / 客服
  { id: "longyingxiao_v3", name: "龙应笑 · 电销女声", category: "客服", instruct: false, timestamp: true },
  { id: "longyingxun_v3", name: "龙应询 · 客服男声", category: "客服", instruct: false, timestamp: true },
  { id: "longyingjing_v3", name: "龙应静 · 客服女声", category: "客服", instruct: false, timestamp: true },
  { id: "longyingling_v3", name: "龙应聆 · 温柔客服", category: "客服", instruct: false, timestamp: true },
  { id: "longyingtao_v3", name: "龙应桃 · 甜美客服", category: "客服", instruct: false, timestamp: true },
  // 语音助手
  { id: "longxiaochun_v3", name: "龙小淳 · 温柔助手", category: "助手", instruct: false, timestamp: true },
  { id: "longxiaoxia_v3", name: "龙小夏 · 活力助手", category: "助手", instruct: false, timestamp: true },
  { id: "longyumi_v3", name: "YUMI · 元气助手", category: "助手", instruct: false, timestamp: true },
  { id: "longanyun_v3", name: "龙安昀 · 知性助手", category: "助手", instruct: false, timestamp: true },
  { id: "longanwen_v3", name: "龙安温 · 温暖男声", category: "助手", instruct: false, timestamp: true },
  { id: "longanli_v3", name: "龙安莉 · 亲切女声", category: "助手", instruct: false, timestamp: true },
  { id: "longanlang_v3", name: "龙安朗 · 标准男声", category: "助手", instruct: false, timestamp: true },
  { id: "longyingmu_v3", name: "龙应沐 · 沉稳男声", category: "助手", instruct: false, timestamp: true },
  // 社交陪伴（扩展）
  { id: "longantai_v3", name: "龙安台 · 台湾女声", category: "社交陪伴", instruct: false, timestamp: true },
  { id: "longhua_v3", name: "龙华 · 甜美女声", category: "社交陪伴", instruct: false, timestamp: true },
  { id: "longcheng_v3", name: "龙橙 · 阳光男声", category: "社交陪伴", instruct: false, timestamp: true },
  { id: "longze_v3", name: "龙泽 · 温暖男声", category: "社交陪伴", instruct: false, timestamp: true },
  { id: "longzhe_v3", name: "龙哲 · 暖心男声", category: "社交陪伴", instruct: false, timestamp: true },
];

const MODEL_VOICES: Record<string, Voice[]> = {
  "cosyvoice-v3-flash": COSYVOICE_V3_FLASH_VOICES,
  "cosyvoice-v3-plus": COSYVOICE_V3_FLASH_VOICES, // same voice set
};

export async function POST(req: Request) {
  try {
    const { model } = await req.json();

    // v3.5 models only support custom cloned voices
    if (model?.includes("v3.5")) {
      return Response.json({
        voices: [],
        message: "该模型仅支持自定义克隆音色，不支持预置音色。请使用 cosyvoice-v3-flash 或 cosyvoice-v2。",
      });
    }

    const voices = MODEL_VOICES[model] || COSYVOICE_V3_FLASH_VOICES;
    return Response.json({ voices });
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取音色列表失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
