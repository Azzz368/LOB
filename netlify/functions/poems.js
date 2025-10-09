import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // 兜底数据（首次使用或 Blob Store 为空时）
  const fallback = {
    poems: [
      {
        author: "Pablo Neruda",
        lines: [
          "Leaning into the afternoons I cast my sad nets towards your oceanic eyes.",
          "There in the highest blaze my solitude lengthens and flames, its arms turning like a drowning man's.",
          "I sent out red signals across your absent eyes that move like the sea near a lighthouse.",
          "You keep only darkness, my distant female, from your regard sometimes the coast of dread emerges.",
          "Leaning into the afternoons I fling my sad nets to the sea that beats on your marine eyes.",
          "The birds peck at the first stars that flash like my soul when I love you.",
          "The night on its shadowy mare shedding blue tassels over the land."
        ],
        translations: {
          "Leaning into the afternoons I cast my sad nets towards your oceanic eyes.": "倚身在暮色里，我朝你海洋般的双眼投掷我哀伤的网。",
          "There in the highest blaze my solitude lengthens and flames, its arms turning like a drowning man's.": "我的孤独，在极度的光亮中绵延不绝，化为火焰，双臂漫天飞舞仿佛将遭海难淹没。",
          "I sent out red signals across your absent eyes that move like the sea near a lighthouse.": "越过你失神的双眼，我送出红色的信号，你的双眼泛起涟漪，如靠近灯塔的海洋。",
          "You keep only darkness, my distant female, from your regard sometimes the coast of dread emerges.": "你保有黑暗，我远方的女子，在你的注视之下有时恐惧的海岸浮现。",
          "Leaning into the afternoons I fling my sad nets to the sea that beats on your marine eyes.": "倚身在暮色，在拍打你海洋般双眼的海上，我掷出我哀伤的网。",
          "The birds peck at the first stars that flash like my soul when I love you.": "夜晚的鸟群啄食第一阵群星，像爱著你的我的灵魂，闪烁著。",
          "The night on its shadowy mare shedding blue tassels over the land.": "夜在年阴郁的马上奔驰，在大地上撒下蓝色的穗须。"
        }
      }
    ],
    updatedAt: new Date().toISOString()
  };

  try {
    // 优先从 Netlify Blob Store 读取
    const store = getStore({
      name: "poems-data",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN || context.env?.NETLIFY_TOKEN
    });
    
    const data = await store.get("poems", { type: "json" });
    
    if (data && data.poems && data.poems.length > 0) {
      return new Response(JSON.stringify(data), {
        headers: { 
          "Content-Type": "application/json; charset=utf-8", 
          "Cache-Control": "no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  } catch (e) {
    console.warn('Blob Store read error:', e);
  }

  // 如果 Blob Store 为空，尝试外部 JSON URL（可选）
  const POEMS_JSON_URL = process.env.POEMS_JSON_URL;
  if (POEMS_JSON_URL) {
    try {
      const r = await fetch(POEMS_JSON_URL, { cache: "no-store" });
      if (r.ok) {
        const json = await r.json();
        return new Response(JSON.stringify(json), {
          headers: { 
            "Content-Type": "application/json", 
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    } catch (e) {
      console.warn('External JSON fetch error:', e);
    }
  }

  // 最终回退到内置示例数据
  return new Response(JSON.stringify(fallback), {
    headers: { 
      "Content-Type": "application/json; charset=utf-8", 
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
