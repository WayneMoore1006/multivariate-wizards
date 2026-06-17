const fs=require('fs');
const REF=require('./data/reference-gallery.json');
const projPath='client/public/questions.json';
const proj=JSON.parse(fs.readFileSync(projPath,'utf8'));

const norm=s=>(s||'').toLowerCase()
  .replace(/[_\u2574\u2500\u2015\u23af]+/g,' ')   // blanks -> space
  .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const bg=s=>{const m=new Map();for(let i=0;i<s.length-1;i++){const g=s.substr(i,2);m.set(g,(m.get(g)||0)+1);}return m;};
const dice=(a,b)=>{a=norm(a);b=norm(b);if(a===b)return 1;if(a.length<2||b.length<2)return 0;const x=bg(a),y=bg(b);let i=0;for(const[g,c]of x)if(y.has(g))i+=Math.min(c,y.get(g));return 2*i/((a.length-1)+(b.length-1));};
const ansNorm=s=>norm(String(s).replace(/[①②③④⑤]/g,' ').replace(/（[^）]*）/g,' ').replace(/\([^)]*\)/g,' '));

function bestRef(q){
  let best=null,bestScore=0;
  for(const r of REF){
    const sim=dice(q.questionEn, r.en);
    // answer overlap
    const pa=ansNorm(q.answers.join(' '));
    const ra=ansNorm(r.answerZH+' '+r.answerEN+' '+(r.blanks||[]).flat().join(' '));
    const ansHit = pa && ra && (ra.includes(pa)||pa.includes(ra) || q.answers.some(a=>{const na=ansNorm(a);return na&&ra.includes(na);}));
    let score=sim + (ansHit?0.25:0);
    if(score>bestScore){bestScore=score;best=r;}
  }
  return {best,score:bestScore};
}

// template fallback
const chTopic={Ch5:'多元迴歸 (Multiple Regression)',Ch6:'MANOVA 與實驗設計',Ch7:'判別分析 (Discriminant Analysis)',Ch8:'Logistic Regression',Ch9:'結構方程模式 (SEM)',Ch10:'驗證性因素分析 (CFA)',Ch11:'SEM',Ch12:'量表 (Scales)'};
function tmplZh(q){const t=chTopic[q.chapter]||(q.tags&&q.tags[0])||'多變量分析';return `本題考的是 ${q.chapter}・${t} 的核心概念，正確答案為「${q.answers.join(' / ')}」。題幹描述的正是此概念的定義或判準，建議連同章節重點一起記憶。`;}
function tmplEn(q){return `This ${q.chapter} item tests a core concept of ${ (q.tags&&q.tags[0])||'multivariate analysis'}. The correct answer is "${q.answers.join(' / ')}". The stem paraphrases this term's definition — a frequently tested point.`;}

let matched=0;
const out=proj.map(q=>{
  const {best,score}=bestRef(q);
  const good = best && score>=0.62;
  if(good) matched++;
  // merge accepted answers with ref blanks
  let accepted=q.acceptedAnswers ? q.acceptedAnswers.map(a=>a.slice()) : q.answers.map(a=>[a]);
  if(good && Array.isArray(best.blanks)){
    best.blanks.forEach((vs,i)=>{ if(!accepted[i])accepted[i]=[]; for(const v of vs){ if(!accepted[i].some(x=>norm(x)===norm(v))) accepted[i].push(v);} });
  }
  const questionZh = good && best.zh ? best.zh : (q.questionZh && !/填空題（共/.test(q.questionZh) ? q.questionZh : tmplZh(q));
  const explanationZh = good && best.explainZH ? best.explainZH : tmplZh(q);
  const explanationEn = good && best.explainEN ? best.explainEN : tmplEn(q);
  return {...q, acceptedAnswers:accepted, questionZh, explanationZh, explanationEn};
});

fs.writeFileSync(projPath, JSON.stringify(out,null,2));
fs.writeFileSync('data/questions.bilingual.json', JSON.stringify(out,null,2));
console.log('total',out.length,'matched to reference',matched,'('+Math.round(matched/out.length*100)+'%)');
console.log('sample enriched:');
const s=out.find(x=>/Hit ratio/i.test(x.answers.join()));
console.log(JSON.stringify({id:s.id,questionZh:s.questionZh,explanationZh:s.explanationZh.slice(0,60)+'…',accepted:s.acceptedAnswers},null,1));
