// 免费 AI 模型：浏览器本地推理，首次会下载模型，之后会走缓存
const FREE_AI_MODEL = "onnx-community/Qwen2.5-1.5B-Instruct";
const FALLBACK_AI_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct-ONNX";

let freeAIPipeline = null;
let freeAIPromise = null;
let fallbackAIPipeline = null;

function setAIStatus(text) {
  const el = document.getElementById("ai-status");
  if (el) el.textContent = text;
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function stripFence(text) {
  return text
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

async function loadPipeline(modelId) {
  const { pipeline } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1");
  return pipeline("text-generation", modelId, {
    dtype: "q4",
  });
}

async function getFreeAI() {
  if (freeAIPipeline) return freeAIPipeline;
  if (!freeAIPromise) {
    freeAIPromise = (async () => {
      setAIStatus("AI：正在加载增强模型，首次会比较慢");
      try {
        freeAIPipeline = await loadPipeline(FREE_AI_MODEL);
        setAIStatus("AI：增强模型已就绪");
        return freeAIPipeline;
      } catch (error) {
        console.warn("增强模型加载失败，尝试更轻量模型：", error);
        try {
          setAIStatus("AI：增强模型失败，正在切换轻量模型");
          fallbackAIPipeline = await loadPipeline(FALLBACK_AI_MODEL);
          freeAIPipeline = fallbackAIPipeline;
          setAIStatus("AI：轻量模型已就绪");
          return fallbackAIPipeline;
        } catch (fallbackError) {
          console.warn("轻量模型也失败，已切回规则引擎：", fallbackError);
          setAIStatus("AI：模型加载失败，已使用规则引擎");
          freeAIPipeline = null;
          fallbackAIPipeline = null;
          freeAIPromise = null;
          return null;
        }
      }
    })();
  }

  return freeAIPromise;
}

function buildJudgePrompt(question, answer, memoryText) {
  return [
    "你是一个中文海龟汤AI裁判，要像一个冷静但有点戏剧感的侦探。",
    "你只输出 JSON，不要输出任何多余解释。",
    'JSON 格式必须是: {"text":"...","score":0-5,"tone":"short"}',
    "规则：",
    "1. text 必须是中文，像真人裁判的短回复，12到30字，允许带一个表情符号。",
    "2. score 0-5，越接近真相分越高。",
    "3. tone 固定填 short。",
    `真相：${answer}`,
    `玩家当前问题：${question}`,
    `历史提问：${memoryText || "无"}`,
  ].join("\n");
}

function buildHintPrompt(score, question, answer, memoryText) {
  return [
    "你是中文海龟汤提示助手，要像在和玩家聊天。",
    "只输出一句中文短提示，不要泄露完整真相。",
    "提示要自然、像真人说话，20字以内。",
    `当前分数：${score}`,
    `当前题目：${question}`,
    `历史提问：${memoryText || "无"}`,
    `真相：${answer}`,
  ].join("\n");
}

async function judgeWithFreeAI(question, answer, memoryText) {
  const pipe = await getFreeAI();
  if (!pipe) return null;

  try {
    const prompt = buildJudgePrompt(question, answer, memoryText);
    const output = await pipe(prompt, {
      max_new_tokens: 96,
      temperature: 0.25,
      top_p: 0.92,
      return_full_text: false,
    });

    const generated = stripFence(Array.isArray(output)
      ? (output[0]?.generated_text || "")
      : (output?.generated_text || ""));

    const parsed = extractJSON(generated);
    if (parsed && typeof parsed.text === "string") {
      const score = Number.isFinite(parsed.score) ? parsed.score : 0;
      return {
        text: parsed.text.trim(),
        score: Math.max(0, Math.min(5, Math.round(score))),
      };
    }

    if (generated) {
      return {
        text: generated.split("\n")[0].slice(0, 40),
        score: 2,
      };
    }
  } catch (error) {
    console.warn("免费模型判断失败，已切回规则引擎：", error);
  }

  return null;
}

async function hintWithFreeAI(score, question, answer, memoryText) {
  const pipe = await getFreeAI();
  if (!pipe) return null;

  try {
    const prompt = buildHintPrompt(score, question, answer, memoryText);
    const output = await pipe(prompt, {
      max_new_tokens: 48,
      temperature: 0.45,
      top_p: 0.9,
      return_full_text: false,
    });

    const generated = stripFence(Array.isArray(output)
      ? (output[0]?.generated_text || "")
      : (output?.generated_text || ""));

    return generated.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  } catch (error) {
    console.warn("免费模型提示失败，已切回规则引擎：", error);
    return null;
  }
}

// 🧠 语义理解（核心AI模拟，保留作为回退）
function analyze(q) {
  if (/死|杀|自杀/.test(q)) return "death";
  if (/镜子|影子|幻觉/.test(q)) return "illusion";
  if (/身份|存在/.test(q)) return "identity";
  if (/记忆|童年/.test(q)) return "memory";
  if (/系统|数据/.test(q)) return "system";
  return "unknown";
}

// 🤖 AI推理反馈（规则引擎回退）
function aiJudge(type) {
  switch (type) {
    case "identity":
      return { text: "🟢 你正在接近核心真相", score: 4 };
    case "memory":
      return { text: "🔥 关键结构线索", score: 5 };
    case "system":
      return { text: "🧠 高级逻辑方向", score: 5 };
    case "illusion":
      return { text: "🟡 感知层线索", score: 3 };
    case "death":
      return { text: "🟡 部分相关", score: 2 };
    default:
      return { text: "❌ 无关信息", score: -1 };
  }
}

// 🧠 相似度判断（是否猜对）
function checkWin(q, answer) {
  const keywords = answer.split("");
  let hit = 0;
  keywords.forEach((k) => {
    if (q.includes(k)) hit++;
  });
  return hit > 3;
}
