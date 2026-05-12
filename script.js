let score = 0;
let memory = [];
let aiReadyChecked = false;

function addBubble(role, text) {
  const chat = document.getElementById("chat");
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

function setButtonsDisabled(disabled) {
  const buttons = document.querySelectorAll("button");
  buttons.forEach((button) => {
    if (button.innerText.includes("新案件")) return;
    button.disabled = disabled;
  });
}

function renderStatus(text) {
  setAIStatus(text);
}

// 🎲 初始化
function load() {
  current = generateCase();
  score = 0;
  memory = [];

  document.getElementById("story").innerHTML = "❓ " + current.q;
  document.getElementById("chat").innerHTML = "";
  document.getElementById("q").value = "";
  renderStatus("AI：准备加载免费模型");

  addBubble("system", "系统：新案件已生成，开始提问吧。");

  if (!aiReadyChecked) {
    aiReadyChecked = true;
    getFreeAI();
  }
}

load();

function summarizeMemory() {
  if (!memory.length) return "无";
  return memory.slice(-6).join("；");
}

// 💬 提问
async function ask() {
  const input = document.getElementById("q");
  const q = input.value.trim();
  if (!q) return;

  memory.push(q);
  input.value = "";

  addBubble("user", q);
  addBubble("system", "AI：思考中...");
  setButtonsDisabled(true);

  try {
    const res = await judgeQuestion(q);
    removeLastSystemBubble();
    addBubble("ai", `AI：${res.text}`);
    score += res.score;
  } catch (error) {
    console.warn("AI 判断失败，已使用兜底回复：", error);
    removeLastSystemBubble();
    const fallback = aiJudge(analyze(q));
    addBubble("ai", `AI：${fallback.text}`);
    score += fallback.score;
  } finally {
    setButtonsDisabled(false);
  }
}

function removeLastSystemBubble() {
  const chat = document.getElementById("chat");
  const last = chat.lastElementChild;
  if (last && last.classList.contains("system") && last.textContent === "AI：思考中...") {
    chat.removeChild(last);
  }
}

async function judgeQuestion(question) {
  const aiResult = await judgeWithFreeAI(question, current.a, summarizeMemory());
  if (aiResult) return aiResult;

  const type = analyze(question);
  return aiJudge(type);
}

// 🔓 判断是否通关
function reveal() {
  const success = checkWin(memory.join(""), current.a);

  if (success) {
    win();
  } else {
    addBubble("system", "你还没有完全接近真相。");
  }
}

// 🎉 胜利结局🔥
function win() {
  addBubble("ai", `🎉 真相解锁成功！
🧠 ${current.a}
🏆 推理等级：侦探大师
🔥 评分：${score}`);
}

// 💡 提示
async function hint() {
  const aiHint = await hintWithFreeAI(score, current.q, current.a, summarizeMemory());
  if (aiHint) {
    addBubble("ai", `提示：${aiHint}`);
    return;
  }

  if (score < 5) addBubble("system", "提示：关注事件本质。");
  else if (score < 10) addBubble("system", "提示：身份 / 记忆是关键。");
  else addBubble("system", "提示：你已经很接近真相。");
}

// 🔄 下一题
function next() {
  load();
}
