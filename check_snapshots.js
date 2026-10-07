const fs = require('fs');
const s = fs.readFileSync('/home/user/Doubao/chats/38444168961292802/skill-center/Skill管理中心.html', 'utf8');
function grab(name) {
  const re = new RegExp('const ' + name + ' = (\\[.*?\\]);', 's');
  const m = s.match(re);
  if (!m) throw new Error('block not found: ' + name);
  return m[1];
}
const L = new Function('return ' + grab('SKILL_LEDGER'))();
const R = new Function('return ' + grab('RECOMMEND_RECS'))();
const C = new Function('return ' + grab('CASE_LEDGER'))();
console.log('JS syntax OK: ledger=' + L.length + ' recs=' + R.length + ' cases=' + C.length);
const today = R.filter(r => String(r.batch).startsWith('2026-10-04'));
console.log('today recs: ' + today.length);
today.forEach(t => console.log('  ' + t.skill + ' | ' + t.hot));
