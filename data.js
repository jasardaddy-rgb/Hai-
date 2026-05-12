function generateCase() {

  const templates = [
    {
      q: "一个人经历了失踪事件",
      a: "他被社会系统删除身份，但仍然活着",
      tags: ["身份", "系统", "存在"]
    },
    {
      q: "一个人喝汤后崩溃",
      a: "童年创伤记忆被触发",
      tags: ["记忆", "创伤"]
    },
    {
      q: "镜子里出现另一个自己",
      a: "精神分裂导致幻觉",
      tags: ["心理", "幻觉"]
    }
  ];

  return templates[Math.floor(Math.random()*templates.length)];
}

let current = generateCase();
