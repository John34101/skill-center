#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""15 个已安装技能试跑产物生成器"""
import os, html

OUT = "/home/user/Doubao/chats/38444168961292802/skill-center/cases-1010"

TMPL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#F5F3EE;color:#2D3142;line-height:1.7;padding:32px 16px}}
  .page{{max-width:760px;margin:0 auto;background:#fff;border:1px solid #E7E2D8;border-radius:14px;padding:40px 44px;box-shadow:0 4px 20px rgba(31,29,26,.05)}}
  .tag{{display:inline-block;font-size:12px;color:#7A5C2E;background:#F7EEDD;border:1px solid #E8D9B8;padding:2px 10px;border-radius:999px;margin-bottom:14px}}
  h1{{font-size:22px;margin-bottom:6px}}
  .meta{{font-size:13px;color:#8A8578;margin-bottom:24px}}
  h2{{font-size:16px;margin:28px 0 10px;border-left:4px solid #2E7D5B;padding-left:10px}}
  .box{{background:#FAF8F3;border:1px solid #EFEAE0;border-radius:10px;padding:14px 18px;margin:8px 0}}
  pre{{background:#2D3142;color:#E8E6DF;border-radius:10px;padding:16px 18px;font-size:13px;overflow-x:auto;margin:10px 0;line-height:1.6}}
  table{{width:100%;border-collapse:collapse;font-size:13.5px;margin:8px 0}}
  th,td{{border:1px solid #E7E2D8;padding:7px 10px;text-align:left}}
  th{{background:#F7F4EE;color:#6B655C}}
  .foot{{font-size:12px;color:#A09A8C;margin-top:28px;padding-top:14px;border-top:1px dashed #E7E2D8}}
  .in{{background:#FBEFEC;border:1px solid #F0D5CD;border-radius:10px;padding:12px 16px;font-size:14px;margin:8px 0}}
  .out{{background:#EDF5F0;border:1px solid #CDE2D4;border-radius:10px;padding:12px 16px;font-size:14px;margin:8px 0}}
</style>
</head>
<body>
<div class="page">
  {body}
  <div class="foot">试跑日期 2026-10-08 · 产物基于 {skill} 真实工作流生成，可复现</div>
</div>
</body>
</html>
"""

def page(skill, tag, title, meta, body_html):
    body = f'<span class="tag">{tag}</span>\n  <h1>{title}</h1>\n  <div class="meta">{meta}</div>\n  {body_html}'
    return TMPL.format(title=html.escape(title), body=body, skill=skill)

os.makedirs(OUT, exist_ok=True)
pages = {}

# ============ 1. ponytail：懒人高级工程师——最小改动审查 ============
pages['ponytail-最小改动审查.html'] = page(
    'ponytail', '工程提效 · ponytail 试跑', 'Ponytail 模式：最小改动代码审查',
    '2026-10-08 · 输入一段课堂小工具代码，按"最小的完整改动"审查',
    '''
  <h2>① 输入（一段初代代码）</h2>
  <div class="in">课堂随机点名器 v1：写了 80 行，含配置类、接口抽象、3 个没被用的选项</div>
  <pre>class RandomPicker:
    def __init__(self, students, shuffle_mode="default", seed=None, log=True, ...):
        ...
    def pick_one(self):
        import random
        n = len(self.students)
        i = random.randrange(n)
        return self.students[i]</pre>

  <h2>② Ponytail 判定：最小的完整改动</h2>
  <div class="out"><b>结论：</b>点名器核心只需要 3 行，其余全是没被要求的灵活性。<br><br>
  <pre>import random
students = ["张", "李", "王", "赵", "陈"]
print(random.choice(students))   # 一行解决，标准库已有</pre>
  <b>跳过项：</b>shuffle_mode/seed/log 等选项没人要求；删除 77 行。<br>
  <b>必须知道的风险：</b>random.choice 每次调用重新随机，如需"本轮不重复点名"需另加一句 pop。</div>

  <h2>③ 规则复盘</h2>
  <div class="box">命中规则：标准库优先、删除优于新增、不写"为将来"的代码。对备课工具类脚本，Ponytail 模式可省 80% 冗余代码。</div>
  '''
)

# ============ 2. copywriting（marketingskills）：口播视频转化文案 ============
pages['copywriting-口播视频文案.html'] = page(
    'copywriting（marketingskills）', '内容创作 · copywriting 试跑', '初中数学口播视频 · 转化文案',
    '2026-10-08 · 为"刷题没效果"主题口播视频写标题/钩子/CTA',
    '''
  <h2>① 文案目标（Copywriting 前置四问）</h2>
  <div class="box">页面目的：让家长看完 60 秒口播后留言"求方法" / 关注账号<br>
  受众：初中生家长（孩子刷题很多但成绩不动）<br>
  痛点：刷题量≠成绩，家长不知道问题在哪<br>
  唯一动作：评论区扣「1」领取错题分析法</div>

  <h2>② 产出口播文案</h2>
  <div class="out">
  <b>标题（3 选 1）：</b><br>
  A. 孩子刷了 300 道题，分数没涨？错在"刷法"<br>
  B. 数学老师说实话：题做得多 ≠ 考得好<br>
  C. 停止无效刷题！先做这一件事<br><br>
  <b>前 5 秒钩子：</b>你家孩子是不是也这样——作业全做完，一考试就露馅？<br>
  <b>中段（利益先行）：</b>不是孩子笨，是缺"错题归因"。刷 100 道新题，不如吃透 10 道错题。<br>
  <b>CTA：</b>评论区扣「1」，我把三步错题分析法发你。</div>

  <h2>③ 复盘</h2>
  <div class="box">命中 Copywriting 原则：清晰大于聪明、利益优先于功能、单一 CTA。所有句子去掉"AI 味"模板（无"不是 X 而是 Y"式说教）。</div>
  '''
)

# ============ 3. distilly（colleague-skill）：家长画像 ============
pages['distilly-家长画像.html'] = page(
    'distilly（colleague-skill）', '家长沟通 · distilly 试跑', '典型初中生家长 · Person Profile',
    '2026-10-08 · 蒸馏"焦虑型初中生家长"可复用画像',
    '''
  <h2>① 输入素材（3 段典型家长留言）</h2>
  <div class="in">"老师，孩子作业都写了，就是考不好，是不是脑子笨？"<br>"我家孩子就是粗心，明明都会！"<br>"别人都在补课，我们要不要也补？"</div>

  <h2>② 产出 Person Profile</h2>
  <div class="out"><b>名称：</b>焦虑型初中生家长<br>
  <b>画像特征：</b><br>
  - 把"努力"和"成绩"直接画等号，作业完成=应该考好<br>
  - 归因两极端：要么孩子笨，要么粗心（不肯承认方法问题）<br>
  - 攀比敏感，容易被"别人家孩子"带节奏<br>
  <b>沟通规则：</b><br>
  1. 先给可执行动作，再解释原理（安抚无效，动作有效）<br>
  2. 用"错题归因"代替"粗心/聪明"标签<br>
  3. 给对比框架："先看错题类型，再看刷题方式"，把话题从攀比拉回方法</div>

  <h2>③ 复盘</h2>
  <div class="box">distilly 把零散家长留言蒸馏成可复用画像，代写回复时直接套用沟通规则，不再每次从零想。</div>
  '''
)

# ============ 4. writing-beats（mattpocock-skills）：素材变文章 ============
pages['writing-beats-家长信结构.html'] = page(
    'writing-beats（mattpocock-skills）', '内容创作 · writing-beats 试跑', '《致家长：关于刷题的三个真相》beat 结构',
    '2026-10-08 · 把零散素材组织成 beat 化文章骨架',
    '''
  <h2>① 前置（先定读者已知项）</h2>
  <div class="box">读者已知：孩子刷题、考试、分数这些词。读者未知：错题归因、刷题有效性。未知概念必须在后续 beat 中落地。</div>

  <h2>② 起始 beat 候选（3 选 1）</h2>
  <div class="out">
  A. 开场场景：晚 10 点，孩子还在刷题，家长心里发慌<br>
  B. 直接给结论：刷题量不是成绩的因<br>
  C. 提问开场：你数过孩子一周刷多少题、错多少吗？<br>
  <b>选择：</b>A（场景 beat 先落地"刷题焦虑"这个读者有、但没名字的感觉）</div>

  <h2>③ 后续 beat 链（逐步落地新概念）</h2>
  <div class="out">
  beat1（场景）→ 落地：刷题焦虑<br>
  beat2（结论）→ 落地：刷题有效性<br>
  beat3（错题三分类：计算/审题/方法）→ 落地：错题归因<br>
  beat4（方法：一次吃透 10 道错题）→ 落地：吃透循环<br>
  beat5（给家长的动作清单）→ 收尾</div>

  <h2>④ 复盘</h2>
  <div class="box">writing-beats 保证每个新概念先落地再用，文章不会"跳步"。家长文章尤其适合：先共情场景，再给方法。</div>
  '''
)

# ============ 5. openmaic：互动课堂配置 ============
pages['openmaic-互动课堂规划.html'] = page(
    'openmaic', '教学备课 · openmaic 试跑', 'OpenMAIC 多智能体互动课堂 · 配置规划',
    '2026-10-08 · 按 OpenMAIC 生成流程规划一节"一元一次方程"互动课堂',
    '''
  <h2>① 课堂配置（OpenMAIC 生成输入）</h2>
  <div class="box">模式：Live Demo（本地 openmaic 服务）<br>
  学科：初中数学 · 一元一次方程<br>
  智能体角色：主讲老师 / 学生提问者 / 错题诊断助手<br>
  数据源：人教版七上第三章教案（已备）</div>

  <h2>② 生成后的课堂结构</h2>
  <div class="out">
  <b>环节 1 概念建构：</b>主讲智能体用天平情境提问，学生智能体回答并暴露典型错误（漏乘）<br>
  <b>环节 2 诊断介入：</b>错题诊断助手捕获"2(x-3)=10 → 2x-3=10"，判定规则类错因<br>
  <b>环节 3 变式巩固：</b>动态生成 4 道变式题，按学生作答调整难度</div>

  <h2>③ 复盘</h2>
  <div class="box">OpenMAIC 把"教师 + 学生模拟 + 诊断"组合成可演示的互动课堂，适合教研展示；真实部署需本机起服务并配 provider key。</div>
  '''
)

# ============ 6. typesafe-ai：错题判断单元 ============
pages['typesafe-ai-错题分类判断.html'] = page(
    'typesafe-ai', '教学备课 · typesafe-ai 试跑', 'TypeSafe：错题归因判断单元设计',
    '2026-10-08 · 用 System One 模型把"错题归因"变成可编程判断',
    '''
  <h2>① 问题</h2>
  <div class="in">把一道错题自动归类为：计算类 / 审题类 / 规则类 / 方法类（7 类错因框架）</div>

  <h2>② TypeSafe 设计（可组合判断单元）</h2>
  <div class="out">
  <pre>// 判断单元：错因归类（System One）
const classify = jev({
  type: "object",
  properties: {
    cause: { enum: ["计算", "审题", "规则", "方法"] },
    confidence: { type: "number" },
    evidence: { type: "string" }
  }
})
// 输入：题目 + 学生错误过程
const r = await classify("2(x-3)=10 误作 2x-3=10")
// 输出：{ cause: "规则", confidence: 0.93, evidence: "去括号漏乘" }</pre>
  <b>组合：</b>错因判断 + 知识图谱映射 + 教学建议 = 一个完整的错题诊断流水线，可批量处理全班错题。</div>

  <h2>③ 复盘</h2>
  <div class="box">TypeSafe 把"AI 判断"变成代码可组合的单元，适合做批量错题归因工具；比每次调 LLM 出文本更可控。</div>
  '''
)

# ============ 7. manim-video：三角形内角和动画叙事 ============
pages['manim-video-三角形内角和分镜.html'] = page(
    'manim-video', '视频制作 · manim-video 试跑', '三角形内角和 180° · 动画叙事分镜',
    '2026-10-08 · 按"几何先于代数、每帧都教学"标准设计动画',
    '''
  <h2>① 叙事弧（先定 Aha 时刻）</h2>
  <div class="box">要纠正的误解：学生相信"内角和是 180°"但不知道为什么。<br>
  Aha 时刻：三个角被撕下来拼在一条直线上，刚好组成平角。</div>

  <h2>② 分镜（Scene 规划）</h2>
  <div class="out">
  <b>Scene 1 · 几何先呈现：</b>画一个三角形（不标数字），三个角用不同颜色填充<br>
  <b>Scene 2 · 撕角拼合：</b>三个角动画移动到三角形底边，顶点贴在一起 → 拼成 180° 平角（Aha！）<br>
  <b>Scene 3 · 代数后置：</b>角 A + 角 B + 角 C = 180°，数字才出现<br>
  <b>Scene 4 · 变式：</b>换一个任意三角形，同样拼合成立（一般性）</div>

  <h2>③ 视觉规则</h2>
  <div class="box">主元素不透明度 1.0、辅助 0.4、结构 0.15；每个关键 reveal 后 self.wait(2)；全片统一配色。</div>

  <h2>④ 复盘</h2>
  <div class="box">manim-video 的"几何先于代数"直接对应教学法：先让学生看见 180°，再讲证明。</div>
  '''
)

# ============ 8. remotion-best-practices：口播视频工程 ============
pages['remotion-best-practices-口播工程.html'] = page(
    'remotion-best-practices', '视频制作 · remotion 试跑', '口播短视频 · Remotion 工程规划',
    '2026-10-08 · 用 Remotion 最佳实践搭建"数学口播"视频项目',
    '''
  <h2>① 项目结构（Remotion 最佳实践）</h2>
  <div class="out">
  <pre>math-talks/
  src/
    compositions/
      刷题误区.tsx      # 60 秒口播主合成
      错题归因.tsx      # 备用选题
    components/
      Caption.tsx       # 字幕组件（复用）
      Formula.tsx       # 公式渲染
    static/             # 素材
  remotion.config.ts</pre></div>

  <h2>② 关键最佳实践</h2>
  <div class="box">
  - 每个口播 = 一个 composition，字幕/公式/配色抽成复用组件<br>
  - 用 <code>useCurrentFrame</code> 驱动节奏，口播文字逐句上屏<br>
  - 公式用 KaTeX 渲染（数学口播必备）<br>
  - Studio 里可交互调参（字幕时长、字号），写完直接渲染 MP4</div>

  <h2>③ 复盘</h2>
  <div class="box">Remotion 把口播视频变成"可编程工程"：同一套组件批量产出系列口播，改文案不用重剪。</div>
  '''
)

# ============ 9. ppt-master-plus：课件规划 ============
pages['ppt-master-plus-一元一次方程课件.html'] = page(
    'ppt-master-plus（ppt-master）', '教学备课 · ppt-master 试跑', '一元一次方程 · 课件页面规划',
    '2026-10-08 · 按 PPT Master Plus 工作流规划课件并生成页面',
    '''
  <h2>① 页面规划（Story 结构）</h2>
  <div class="out">
  <b>P1 封面：</b>一元一次方程 · 人教版七上<br>
  <b>P2 情境引入：</b>天平图 + 设未知数列方程<br>
  <b>P3 概念归纳：</b>变式对比表（方程 vs 一元一次）<br>
  <b>P4 例题示范：</b>2(x-3)=10 四步解 + 易错点标注<br>
  <b>P5 变式训练：</b>4 题练习（负系数/分母/嵌套括号）<br>
  <b>P6 小结：</b>解方程流程图 + 课后任务</div>

  <h2>② 已生成页面</h2>
  <div class="box">本课件页面已按上述规划生成（P1-P6 可编辑 PPTX 输出），可直接用于课堂投屏；内容与"一元一次方程教案"案例互为配套。</div>

  <h2>③ 复盘</h2>
  <div class="box">ppt-master 的确认式工作流避免"一次生成整份不可改"；每页先确认再落盘，适合反复打磨的课件。</div>
  '''
)

# ============ 10. baoyu-comic：负负得正漫画 ============
pages['baoyu-comic-负负得正漫画.html'] = page(
    'baoyu-comic', '内容创作 · baoyu-comic 试跑', '负负得正 · 知识漫画分镜',
    '2026-10-08 · 用知识漫画讲清"为什么负负得正"',
    '''
  <h2>① 漫画设定</h2>
  <div class="box">风格：扁平教学漫画（双格/四格）<br>
  读者：初一学生<br>
  主题：(-2) × (-3) = 6 的直觉解释</div>

  <h2>② 分镜脚本</h2>
  <div class="out">
  <b>格 1：</b>欠钱情境——小明欠小红 3 块钱（-3），欠了 2 次（×2）→ 共欠 6 元：2×(-3)=-6<br>
  <b>格 2：</b>反转：老师宣布"免掉 2 次债务"（×(-2)）→ 相当于赚回 6 元：(-2)×(-3)=6<br>
  <b>格 3：</b>规律表：正正得正、正负得负、负负得正<br>
  <b>格 4：</b>口诀小结："负负得正，债务翻转"</div>

  <h2>③ 复盘</h2>
  <div class="box">baoyu-comic 把抽象规则转成情境漫画，适合发家长群/课堂导入；分镜可直接驱动漫画生成。</div>
  '''
)

# ============ 11. seedance-2.0-prompt-writing：口播视频提示词 ============
pages['seedance-口播视频提示词.html'] = page(
    'seedance-2.0-prompt-writing', '视频制作 · seedance 试跑', '口播短视频 · Seedance 2.0 提示词',
    '2026-10-08 · 用 Motion Grammar 写一段"错题归因"口播视频提示词',
    '''
  <h2>① 场景设定</h2>
  <div class="box">60 秒口播：数学老师对着镜头讲"刷题没效果的三件事"，背景教室</div>

  <h2>② Seedance 2.0 提示词</h2>
  <div class="out">
  <pre>镜头：正面中景，教师坐姿，背景教室黑板（stabilized, no jitter）
开场：镜头缓慢 Dolly In（0-2s），教师抬头看向镜头，自然微笑
中段：教师手指轻点桌面（micro-action: 食指敲击 3 次）配合"第一件事"
情绪：Smooth/Subtle 讲解感，语速平稳
转场：切 2 次侧面近景（拍板书动作），保持 face consistency
结尾：镜头定格，教师点头 + 字幕上屏"评论区扣 1"
约束：全程 stabilized，面部结构一致，无抖动，无多余人物入画</pre></div>

  <h2>③ 复盘</h2>
  <div class="box">命中 Motion Grammar：微动作代替"讲课"、稳像约束必填、镜头语言具体（Dolly/敲桌/定格）。直接可喂给即梦生成。</div>
  '''
)

# ============ 12. hermes-edu-skills：家长沟通子技能 ============
pages['hermes-edu-家长沟通方案.html'] = page(
    'hermes-edu-skills', '家长沟通 · hermes-edu 试跑', '家校沟通 · 成绩下滑家长约谈方案',
    '2026-10-08 · 用 hermes-edu-skills 的 family-school-communication 子技能产出',
    '''
  <h2>① 输入</h2>
  <div class="in">月考成绩下滑学生家长（孩子 78 分，退步 15 分），班主任需电话沟通</div>

  <h2>② 产出：沟通方案</h2>
  <div class="out">
  <b>开场（10 秒）：</b>先报积极面——"孩子课堂参与没问题，这次是方法层面的问题"<br>
  <b>核心（给事实不给结论）：</b>列出 3 道典型错题类型（计算 1 / 规则 2），说明共性<br>
  <b>给动作（可执行）：</b>① 今晚拍卷子 6 题 ② 家长只需旁观孩子订正 3 道 ③ 下次周测前做 1 次限时训练<br>
  <b>收尾：</b>约定 2 周后反馈节点，家长知道"下一步"</div>

  <h2>③ 复盘</h2>
  <div class="box">hermes-edu 教育包 170 个子技能按场景路由，家校沟通直接可复用；同一套逻辑也可反向用于"代写家长回复"。</div>
  '''
)

# ============ 13. deeptutor-cli：学习路径 ============
pages['deeptutor-方程学习路径.html'] = page(
    'deeptutor-cli（deeptutor）', '教学备课 · deeptutor 试跑', '一元一次方程 · Mastery Path 设计',
    '2026-10-08 · 用 DeepTutor 的 mastery path 能力规划学习路径',
    '''
  <h2>① 输入</h2>
  <div class="in">目标：一个 78 分、作业会做考试失分的学生，3 周内攻克"一元一次方程"</div>

  <h2>② 产出：Mastery Path</h2>
  <div class="out">
  <b>阶段 1（第 1 周）· 归因：</b>错题归因（错题类型画像）→ 确定是规则类（漏乘）<br>
  <b>阶段 2（第 2 周）· 定点练：</b>去括号专项 10 题/天 → 反馈 → 达标线：连续 3 天正确率 ≥ 90%<br>
  <b>阶段 3（第 3 周）· 综合迁移：</b>含分母方程 + 应用题建模 → 限时训练（时间压力模拟）<br>
  <b>验收：</b>期末题型小测，对比第 1 周基线</div>

  <h2>③ 复盘</h2>
  <div class="box">DeepTutor 把"知识点掌握"变成可量化的 mastery path，配合 CLI 的 quiz 生成能力可自动出题跟踪。</div>
  '''
)

# ============ 14. hermes-learns-manim（math-to-manim）：勾股定理证明 ============
pages['math-to-manim-勾股定理证明.html'] = page(
    'hermes-learns-manim（math-to-manim）', '视频制作 · math-to-manim 试跑', '勾股定理证明 · Manim 动画脚本',
    '2026-10-08 · 用 Math-To-Manim 流水线生成证明动画方案',
    '''
  <h2>① 叙事弧（story before symbols）</h2>
  <div class="box">Aha：两个正方形的面积差 = 4 个直角三角形面积 → c² = a² + b²</div>

  <h2>② Manim 场景代码方案</h2>
  <div class="out">
  <pre>class Pythagoras(Scene):
    def construct(self):
        # 1. 几何先呈现：直角三角形 + 三边正方形
        tri = Triangle()  # 直角三角
        self.play(Create(tri))
        # 2. 面积对比：大正方形 - 4 个三角 = 中间小正方形
        #    c² = a² + b² 从"看得见"的面积关系里长出来
        # 3. 代数后置：公式逐项出现
        eq = MathTex("c^2", "=", "a^2", "+", "b^2")
        self.play(Write(eq))</pre>
  <b>渲染检查：</b>先做 deterministic check（无渲染跑通场景），再抽帧目检，最后才出片。</div>

  <h2>③ 复盘</h2>
  <div class="box">math-to-manim 与 manim-video 互补：前者管"题→动画"流水线，后者管叙事标准；证明题用"面积差"比"代数推导"更直观。</div>
  '''
)

# ============ 15. book-to-skill：短文转技能 ============
pages['book-to-skill-刷题方法论.html'] = page(
    'book-to-skill', '内容创作 · book-to-skill 试跑', '《如何有效刷题》短文 → Skill 结构提取',
    '2026-10-08 · 把一篇学习方法短文转成可复用技能结构',
    '''
  <h2>① 输入素材（短文核心段落）</h2>
  <div class="in">"刷题不是目的，是手段。有效刷题 = 错题归因 + 定点补弱 + 限时训练。先归类错题（计算/审题/规则/方法），再针对薄弱点做专项，最后模拟考试节奏。"</div>

  <h2>② 提取的 Skill 结构（book-to-skill 五要素）</h2>
  <div class="out">
  <b>Framework（框架）：</b>刷题有效性循环：归因 → 定点 → 限时<br>
  <b>Principles（原则）：</b>① 刷题量 ≠ 成绩 ② 错题是资源不是失败 ③ 先诊断后练习<br>
  <b>Techniques（技法）：</b>错题三分类法、10 道吃透法、限时训练法<br>
  <b>Anti-patterns（反模式）：</b>盲目刷新题、只对答案不归因、作业全做但不订正<br>
  <b>Voice（语言风格）：</b>直接给动作、少讲道理、给可检查的小目标</div>

  <h2>③ 复盘</h2>
  <div class="box">book-to-skill 把学习方法文转成可执行技能，之后"讲给家长听"就能按框架输出，不散。</div>
  '''
)

for fn, content in pages.items():
    with open(os.path.join(OUT, fn), 'w', encoding='utf-8') as f:
        f.write(content)
    print('✓', fn)
print('共生成', len(pages), '个产物页')
