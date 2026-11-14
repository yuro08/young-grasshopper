import{configured,sameOrigin,cookies,setSession,provider,identity,parseBody,failure}from'../lib/account.js';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 if(!configured())return res.status(200).json({configured:false,user:null});
 if(req.method==='GET'){const s=await identity(req);return res.status(200).json({configured:true,user:s?{id:s.user.id,email:s.user.email}:null});}
 if(req.method!=='POST')return failure(res,405,'Method not allowed.');
 if(!sameOrigin(req))return failure(res,403,'Request origin rejected.');
 const b=parseBody(req),action=b.action;
 if(action==='logout'){const s=await identity(req);if(s)await provider('/auth/v1/logout',{method:'POST',token:s.token});setSession(res,null);return res.status(200).json({ok:true});}
 if(action==='refresh'){const refresh_token=cookies(req).yg_refresh;if(!refresh_token)return failure(res,401,'Please sign in again.');const r=await provider('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token}});if(!r.ok){setSession(res,null);return failure(res,401,'Your session expired. Please sign in again.');}setSession(res,r.data);return res.status(200).json({ok:true});}
 if(action==='exchange'){if(typeof b.access_token!=='string'||typeof b.refresh_token!=='string'||b.access_token.length>12000||b.refresh_token.length>12000)return failure(res,400,'Invalid confirmation link.');const r=await provider('/auth/v1/user',{token:b.access_token});if(!r.ok)return failure(res,401,'This link expired. Request a new one.');setSession(res,b);return res.status(200).json({ok:true});}
 if(action==='password'){const s=await identity(req);if(!s)return failure(res,401,'Please open a fresh recovery link.');if(typeof b.password!=='string'||b.password.length<12||b.password.length>128)return failure(res,400,'Use a password of 12–128 characters.');const r=await provider('/auth/v1/user',{method:'PUT',token:s.token,body:{password:b.password}});return r.ok?res.status(200).json({ok:true}):failure(res,400,'Could not change password. Request a new recovery link.');}
 if(typeof b.email!=='string'||b.email.length>254||!b.email.includes('@'))return failure(res,400,'Enter a valid email address.');
 const redirect=`${process.env.APP_URL||`http://${req.headers.host}`}/auth-callback.html`;
 if(action==='recover'){await provider(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:{email:b.email}});return res.status(200).json({message:'If this address has an account, a recovery email is on its way.'});}
 if(!['login','signup'].includes(action))return failure(res,400,'Unknown action.');
 if(typeof b.password!=='string'||b.password.length>128||(action==='signup'&&b.password.length<12))return failure(res,400,'Use a password of 12–128 characters.');
 const r=await provider(action==='signup'?`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`:'/auth/v1/token?grant_type=password',{method:'POST',body:{email:b.email,password:b.password}});
 if(!r.ok)return failure(res,400,action==='login'?'Unable to sign in. Check your details and confirm your email.':'Unable to create account. Try again later, or sign in if you already have an account.');
 if(r.data.access_token)setSession(res,r.data);
 return res.status(200).json({message:r.data.access_token?'Welcome back.':'Check your email to confirm your account, then sign in.'});
 }catch{return failure(res,503,'Account service is temporarily unavailable. Please retry.');}}
