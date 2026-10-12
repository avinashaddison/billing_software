import { useAuth } from "@/hooks/use-auth";
const BASE=import.meta.env.BASE_URL.replace(/\/$/,"");
export type ManualKeyState={currentKey:string|null;generatedAt:string|null};
export type ManualApproval={approvalToken:string;expiresAt:string};
export class ManualAccessApiError extends Error {
  constructor(message:string,public status:number,public code?:string) { super(message); }
}
async function request<T>(path:string,body?:unknown):Promise<T> {
  const res=await fetch(`${BASE}/api/manual-billing/${path}`,{
    method:body===undefined?"GET":"POST",credentials:"include",cache:"no-store",
    headers:body===undefined?undefined:{"Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    let d:{error?:string;code?:string}={};
    try { d=await res.json(); } catch {}
    throw new ManualAccessApiError(d.error??"Could not verify manual billing access. Try again online.",res.status,d.code);
  }
  return res.json();
}
export const manualAccessApi={
  current:()=>request<ManualKeyState>("access-key"),
  regenerate:()=>request<ManualKeyState>("access-key",{}),
  approve:(key:string)=>request<ManualApproval>("authorize",{key}),
  validate:(approvalToken:string)=>request<{valid:boolean}>("validate",{approvalToken}),
};
function storageKey() {
  const auth=useAuth.getState();
  // Actor-scoped, not login-scoped: an unconfirmed committed sale must remain
  // recoverable after re-authentication, rather than asking for a fresh grant.
  return `manual-billing-approval:${auth.staffId}`;
}
export function currentManualApproval():ManualApproval|null {
  try {
    const value=JSON.parse(sessionStorage.getItem(storageKey())??"null") as ManualApproval|null;
    if (!value || typeof value.approvalToken!=="string" || !/^[A-Za-z0-9_-]{43}$/.test(value.approvalToken)
      || !Number.isFinite(Date.parse(value.expiresAt))) return null;
    return value;
  } catch { return null; }
}
export function saveManualApproval(value:ManualApproval) { sessionStorage.setItem(storageKey(),JSON.stringify(value)); }
export function clearManualApproval() { sessionStorage.removeItem(storageKey()); }
