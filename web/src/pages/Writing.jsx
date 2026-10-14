import React, { useEffect, useState } from 'react'

// ============================================================
// 写作弹药库（#/writing）
// 五环回路 + 选题库 8 题（可勾选）+ 洞见卡四格模板（可填写）
// 数据持久化到 localStorage（wk- 前缀）
// ============================================================

const TOPICS = [
  { id: 1, title: '衔接不是抢跑', desc: '改写综述三即可。素材齐备：小学常考满分、初一突然变差；99% 的孩子不适合超前学。现成的一篇。', src: '综述三' },
  { id: 2, title: '中等生输的不是智力，是三个习惯', desc: '综述三「产品哲学」扩写：学法三短板 → 每个短板配一个现象案例 → 一个可执行的补救动作。', src: '综述三' },
  { id: 3, title: '为什么我只做六年级', desc: '创业叙事：窄定位、避开对手、约 8000 用户 ≈ 300 万营收、录播 + 工具化。用「研究对手的唯一意义是避开」做钩子。', src: '素材库' },
  { id: 4, title: '我不学 AI 工具，我攒我的 Harness', desc: '综述二现身说法：AGENTS.md、协作日志、多 Agent 分工、每周巡检——四层全在跑。标题自带反直觉点。', src: '综述二' },
  { id: 5, title: '学习不是收藏，是改造结构', desc: '综述一扩写：从「收藏了一堆学习方法却没用」切入 → 结构改造靠输出 → 给一个 SRL 闭环小实验。', src: '综述一' },
  { id: 6, title: '为什么你总是“看着很努力”却没进步', desc: '进阶选题：前向传播（收藏、听课、摘抄）vs 反向传播（输出、撞现实、修正）。金句库里有现成弹药。', src: '金句库' },
  { id: 7, title: '服务那个“没人督促就不学”的孩子', desc: '张力 4 的产品设计题，最该亲手写的一篇：录播形态怎么服务中等生而不变成客服。AI 给不了答案，你的教学经验可以。', src: '产品设计' },
  { id: 8, title: 'AI 拉平知识后，什么才是硬生产力', desc: '观点库素材扩写：知识不再稀缺，内在稳定性（深度工作 + 规律作息）才是底座。适合写给焦虑的同行/家长。', src: '观点库' },
]

const INSIGHT_FIELDS = [
  { key: 'phenomenon', label: '现象', hint: '我看到什么？一句话讲清事实，具体到别人能“看见”。' },
  { key: 'mechanism', label: '机制', hint: '为什么会这样？给因果链条或底层原理——这是最该下功夫的一格。' },
  { key: 'contrast', label: '反直觉点', hint: '多数人以为 A，实际是 B。落差越大，文章越有张力。' },
  { key: 'boundary', label: '边界条件', hint: '什么时候不成立？主动给自己挑刺，承认边界才显成熟。' },
]

const LOOP = [
  { step: '① 素材库 · 矿', desc: '67 篇原文\n只读不整理', color: '#6B7280' },
  { step: '② 综述库 · 炉', desc: '一簇压成一页\n综合=观点生成机', color: '#2B59C3' },
  { step: '③ 洞见库 · 器', desc: '自己想透的定论\n判断=洞见的来源', color: '#7C5CF0' },
  { step: '④ 文章 · 出口', desc: '反向传播\n写着写着才想透', color: '#E0623C' },
  { step: '⑤ 反馈 · 回炉', desc: '验证→提拔进洞见库\n打脸→改写重发', color: '#2F9E5B' },
]

function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? def } catch (e) { return def }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch (e) { /* ignore */ }
}

export default function Writing() {
  const [done, setDone] = useState([])          // 已勾选题
  const [card, setCard] = useState({})          // 洞见卡内容
  const [, force] = useState(0)

  useEffect(() => {
    setDone(load('wk-topics', []))
    setCard(load('wk-insight', {}))
  }, [])

  const toggle = (id) => {
    const next = done.includes(id) ? done.filter(x => x !== id) : [...done, id]
    setDone(next); save('wk-topics', next); force(x => x + 1)
  }
  const setField = (k, v) => {
    const next = { ...card, [k]: v }
    setCard(next); save('wk-insight', next); force(x => x + 1)
  }
  const copyCard = () => {
    const txt = INSIGHT_FIELDS.map(f => `【${f.label}】\n${card[f.key] || '（待填）'}`).join('\n\n')
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {})
    alert('洞见卡已复制到剪贴板，可粘贴进文档/公众号编辑器')
  }

  const filled = INSIGHT_FIELDS.filter(f => card[f.key] && card[f.key].trim()).length

  return (
    <div>
      {/* ===== 页头 ===== */}
      <div className="pd-head">
        <div className="pd-title-row">
          <div>
            <div className="pd-tag">写作弹药库</div>
            <h2 className="pd-title">写作系统 · 弹药与选题</h2>
            <div className="pd-desc">素材是矿，综述是炉，洞见是器，文章是最后一道工序——把矿炼成能拿出去的东西。</div>
          </div>
          <div className="pd-ov">
            <div className="pd-ov-cell"><span>选题</span><b>{done.length}/{TOPICS.length} 已选</b></div>
            <div className="pd-ov-cell"><span>洞见卡</span><b>{filled}/4 格已填</b></div>
          </div>
        </div>
      </div>

      {/* ===== 五环回路 ===== */}
      <div className="pd-card">
        <div className="pd-sec-head"><b>系统回路 · 五环</b><span>写作系统 = 知识流水线，文章是每一次反向传播的落点</span></div>
        <div className="wk-loop">
          {LOOP.map((l, i) => (
            <React.Fragment key={l.step}>
              {i > 0 && <span className="wk-arrow">→</span>}
              <div className="wk-node">
                <b style={{ color: l.color }}>{l.step}</b>
                <span>{l.desc.split('\n')[0]}<br />{l.desc.split('\n')[1] || ''}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div className="pd-note">写，是这一切的出口，也是唯一能反过来改造矿的东西。</div>
      </div>

      {/* ===== 选题库 ===== */}
      <div className="pd-card">
        <div className="pd-sec-head"><b>选题库 · 即刻可写 8 题</b><span>每一条张力就是一篇待写的文章 · 先写这些，别另找新题</span></div>
        <div className="wk-topics">
          {TOPICS.map(t => {
            const on = done.includes(t.id)
            return (
              <div key={t.id} className={'wk-topic' + (on ? ' done' : '')} onClick={() => toggle(t.id)}>
                <span className={'wk-chk' + (on ? ' on' : '')}>{on ? '✓' : ''}</span>
                <div className="wk-topic-body">
                  <div className="wk-topic-tt">{t.id}. {t.title}</div>
                  <div className="wk-topic-desc">{t.desc}</div>
                  <span className="wk-topic-src">{t.src}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ===== 洞见卡 ===== */}
      <div className="pd-card">
        <div className="pd-sec-head"><b>洞见卡 · 四格模板</b><span>四格填满，观点自成——这四格也是你文章论证的四段</span></div>
        <div className="pd-note">洞见不是灵光一闪，是一张可以反复填写的卡。填满后点「复制洞见卡」，粘贴进写作草稿即可扩成文章。</div>
        <div className="wk-insight">
          {INSIGHT_FIELDS.map(f => (
            <div key={f.key} className="wk-field">
              <div className="wk-field-tt">{f.label} <em>{f.hint}</em></div>
              <textarea value={card[f.key] || ''} rows={f.key === 'mechanism' ? 4 : 3}
                onChange={e => setField(f.key, e.target.value)}
                placeholder={f.hint} />
            </div>
          ))}
        </div>
        <div className="wk-insight-actions">
          <button className="btn primary" disabled={filled < 4} onClick={copyCard}>复制洞见卡（{filled}/4 格）</button>
          {filled < 4 && <span className="pd-note">四格填满才能复制——写不满就说明还没想透，继续想。</span>}
        </div>
      </div>

      {/* ===== 认知矿藏 ===== */}
      <div className="pd-card">
        <div className="pd-sec-head"><b>认知矿藏 · 弹药库</b><span>写前先取弹药，填不满素材格就先补再动笔</span></div>
        <div className="wk-links">
          <a className="wk-link" href="https://my.feishu.cn/docx/EBUQdeZWNomOhPxS4xmcyAOanWe" target="_blank" rel="noreferrer">
            <span className="wk-link-ic">◆</span><div><b>认知矿藏 · 学习与复盘集</b><span>金句集 / 案例集 / 观点集五大簇 / 综述库 / 洞见集 / 留白张力</span></div><em>打开 →</em>
          </a>
          <a className="wk-link" href="https://my.feishu.cn/base/EYsTbpdyvaZIefshKT2cTZTTnIf" target="_blank" rel="noreferrer">
            <span className="wk-link-ic">▤</span><div><b>写作台账（多维表格）</b><span>选题→写作中→待发布→已发布→反馈回炉 · 三个视图（看板/日历/待写清单）</span></div><em>打开 →</em>
          </a>
        </div>
      </div>
    </div>
  )
}
