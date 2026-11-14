import {fsrs,createEmptyCard,Rating,State} from './vendor/ts-fsrs-5.4.2.mjs';
export const DAY=86400000;
export const SCHEDULER_CONFIG=Object.freeze({request_retention:0.9,maximum_interval:36500,enable_fuzz:false,enable_short_term:true,learning_steps:['1m','10m'],relearning_steps:['10m']});
const engine=fsrs(SCHEDULER_CONFIG);
const grades={again:Rating.Again,hard:Rating.Hard,good:Rating.Good,easy:Rating.Easy};
export const REVIEW_CHOICES=Object.freeze([
 {rating:'again',label:'Missed',hint:'I couldn’t recall it',color:'red',key:'1'},
 {rating:'hard',label:'Iffy',hint:'Correct, with hesitation',color:'yellow',key:'2'},
 {rating:'good',label:'Got it',hint:'I recalled it correctly',color:'green',key:'3'}
]);
const finite=(n,max=1e15)=>Number.isFinite(n)&&n>=0&&n<=max;
const integer=(n,max=1e9)=>Number.isInteger(n)&&finite(n,max);
export function validScheduler(s){const c=s?.card;return s?.engine==='fsrs-6'&&s?.version===1&&!!c&&finite(c.due)&&finite(c.stability,1e9)&&finite(c.difficulty,10)&&finite(c.elapsed_days,1e7)&&finite(c.scheduled_days,36500)&&integer(c.learning_steps)&&integer(c.reps)&&integer(c.lapses)&&[0,1,2,3].includes(c.state)&&(c.last_review===undefined||finite(c.last_review))&&(c.state===State.New||(c.stability>0&&c.difficulty>=1&&finite(c.last_review)));}
const serialize=c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v instanceof Date?v.getTime():v]));
export function freshScheduler(now=Date.now()){return {engine:'fsrs-6',version:1,card:serialize(createEmptyCard(now))};}
function memory(card,now){const s=card.scheduler||freshScheduler(now);if(!validScheduler(s))throw Error('Invalid FSRS memory state.');return {...s.card,due:new Date(s.card.due),...(s.card.last_review!==undefined?{last_review:new Date(s.card.last_review)}:{})};}
// One engine call produces both the persisted memory and its audit log.
export function reviewCard(card,rating,now=Date.now()){
 if(!(rating in grades))throw Error('Invalid rating');
 if(!finite(now))throw Error('Invalid review time');
 const before=memory(card,now);if(before.last_review&&now<before.last_review.getTime())throw Error('Device clock is earlier than the last review. Check your clock.');
 const result=engine.next(before,new Date(now),grades[rating]);
 const next={...card,scheduler:{engine:'fsrs-6',version:1,card:serialize(result.card)},due:result.card.due.getTime(),interval:(result.card.due.getTime()-now)/DAY,reviews:(card.reviews||0)+1,lapses:(card.lapses||0)+(rating==='again'?1:0)};
 return {card:next,log:{at:now,cardId:card.id,rating,engine:'fsrs-6',library:'ts-fsrs@5.4.2',retention:SCHEDULER_CONFIG.request_retention,fsrs:serialize(result.log),before:serialize(before),after:serialize(result.card)}};
}
export function schedule(card,rating,now=Date.now()){return reviewCard(card,rating,now).card;}
// Preview and commit use the same deterministic engine; due time is measured from each rating.
export function previewReviews(card,now=Date.now()){return Object.fromEntries(REVIEW_CHOICES.map(c=>[c.rating,reviewCard(card,c.rating,now)]));}
export function intervalLabel(milliseconds){const minutes=Math.max(1,Math.round(milliseconds/60000));if(minutes<60)return `${minutes} min`;const hours=Math.round(milliseconds/3600000);if(hours<24)return `${hours} ${hours===1?'hour':'hours'}`;const days=Math.max(1,Math.round(milliseconds/DAY));return `${days} ${days===1?'day':'days'}`;}
export function validateCard(c){return !!c&&['question','answer','why','trap','variant','variantAnswer','source','topic'].every(k=>typeof c[k]==='string'&&c[k].length<=20000)&&c.question.trim().length>0&&c.answer.trim().length>0&&(!c.scheduler||validScheduler(c.scheduler));}
const priority=c=>[State.Learning,State.Relearning].includes(c.scheduler?.card.state)?0:c.scheduler?.card.state===State.Review?1:2;
export function dueCards(cards,now=Date.now()){return cards.filter(c=>!c.suspended&&c.due<=now).sort((a,b)=>priority(a)-priority(b)||a.due-b.due);}
export function variantFor(c){return (c.reviews||0)%2===1&&c.variant?{question:c.variant,answer:c.variantAnswer,variant:true}:{question:c.question,answer:c.answer,variant:false};}
export function normalizeImport(data){if(!data||data.version!==1||!Array.isArray(data.cards)||data.cards.length>10000||!data.cards.every(validateCard))throw Error('Use a version 1 backup with valid cards and schedules.');return data.cards.map(c=>({...c,id:crypto.randomUUID(),due:finite(c.due)?c.due:Date.now(),reviews:Math.max(0,Math.floor(Number(c.reviews)||0)),interval:Math.max(0,Number(c.interval)||0),lapses:Math.max(0,Math.floor(Number(c.lapses)||0)),suspended:!!c.suspended}));}
// Old reviews can seed FSRS, but old multiplier intervals are never passed off as FSRS history.
export function migrateWorkspace(workspace,now=Date.now()){
 let changed=false;const history=new Map();for(const l of workspace.logs||[]){if(!finite(l.at)||l.at>now||!grades[l.rating])continue;if(!history.has(l.cardId))history.set(l.cardId,[]);history.get(l.cardId).push(l);}
 const cards=workspace.cards.map(c=>{if(c.scheduler){if(!validScheduler(c.scheduler))throw Error('Invalid stored FSRS schedule. Export your data before repairing.');return c;}changed=true;const logs=(history.get(c.id)||[]).sort((a,b)=>a.at-b.at);let m=createEmptyCard(logs[0]?.at??now);for(const l of logs)m=engine.next(m,new Date(l.at),grades[l.rating]).card;return {...c,scheduler:{engine:'fsrs-6',version:1,migratedFrom:logs.length?'legacy-review-history':'legacy-without-history',card:{...serialize(m),due:c.due}}};});
 return {state:{...workspace,cards},changed};
}
export function createStudySession(cards,goal,now=Date.now()){const due=dueCards(cards,now),learning=due.filter(c=>priority(c)===0),others=due.filter(c=>priority(c)!==0).slice(0,Math.max(1,goal));return {queue:[...learning,...others].map(c=>c.id),current:null,reviewed:0,revealed:false,preview:null};}
export function sessionCard(session,cards,now=Date.now()){if(session.current)return cards.find(c=>c.id===session.current);const ids=new Set(session.queue);return dueCards(cards,now).find(c=>ids.has(c.id));}
export function finishSessionReview(session,card){session.queue=session.queue.filter(id=>id!==card.id);if([State.Learning,State.Relearning].includes(card.scheduler?.card.state))session.queue.push(card.id);session.current=null;session.preview=null;session.revealed=false;session.reviewed++;}
