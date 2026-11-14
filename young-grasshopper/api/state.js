import{identity,sameOrigin,provider,parseBody,failure}from'../lib/account.js';
import{validState}from'../lib/workspace.js';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 if(!['GET','PUT'].includes(req.method))return failure(res,405,'Method not allowed.');
 if(req.method==='PUT'&&!sameOrigin(req))return failure(res,403,'Request origin rejected.');
 const s=await identity(req);if(!s)return failure(res,401,'Please sign in to access your cards.');
 if(req.method==='GET'){const r=await provider(`/rest/v1/study_workspaces?user_id=eq.${encodeURIComponent(s.user.id)}&select=state,version`,{token:s.token});if(!r.ok)return failure(res,503,'Could not load cards. Check database setup.');return res.status(200).json(r.data[0]||{state:{cards:[],logs:[],goal:10},version:0});}
 const b=parseBody(req);if(!Number.isInteger(b.version)||b.version<0||!validState(b.state)||JSON.stringify(b.state).length>2500000)return failure(res,400,'Invalid workspace or size limit exceeded.');
 const r=await provider('/rest/v1/rpc/save_workspace',{method:'POST',token:s.token,body:{p_state:b.state,p_version:b.version}});
 if(!r.ok)return failure(res,r.data?.code==='40001'?409:503,r.data?.code==='40001'?'Your cards changed on another device. Export your unsynced work before reloading.':'Could not save cards. Please retry.');
 return res.status(200).json({version:r.data});
 }catch{return failure(res,503,'Could not reach your workspace. Your local changes are retained in this tab.');}}
