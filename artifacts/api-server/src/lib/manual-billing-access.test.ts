import { describe,it,expect,vi } from "vitest";
vi.mock("@workspace/db",()=>({db:{},authUsersTable:{},staffProfilesTable:{}}));
import { encryptAccessKey,decryptAccessKey,generateAccessKey,keyMatches,digest,normalizeKey,billFingerprint } from "./manual-billing-access";
const secret="isolated-fixture-encryption-secret-not-a-real-credential";
describe("manual billing key cryptography",()=>{
  it("generates distinct readable high entropy keys",()=>{
    const a=generateAccessKey(),b=generateAccessKey();
    expect(a).toMatch(/^MB(?:-[0-9A-F]{4}){4}$/); expect(a).not.toBe(b);
  });
  it("normalizes typed separators and case without accepting malformed keys",()=>{
    const key="MB-1234-ABCD-5678-EF90";
    expect(keyMatches("mb 1234 abcd 5678 ef90",digest(normalizeKey(key)))).toBe(true);
    expect(keyMatches("MB-1234-ABCD-5678-EF91",digest(normalizeKey(key)))).toBe(false);
    expect(keyMatches({},digest(normalizeKey(key)))).toBe(false);
  });
  it("stores authenticated ciphertext, not plaintext, with random IVs",()=>{
    const key=generateAccessKey(),a=encryptAccessKey(key,"shop-a",secret),b=encryptAccessKey(key,"shop-a",secret);
    expect(a).not.toBe(b); expect(a).not.toContain(key);
    expect(decryptAccessKey(a,"shop-a",secret)).toBe(key);
  });
  it("refuses another tenant, a changed secret or tampered ciphertext",()=>{
    const a=encryptAccessKey(generateAccessKey(),"shop-a",secret);
    expect(()=>decryptAccessKey(a,"shop-b",secret)).toThrow();
    expect(()=>decryptAccessKey(a,"shop-a",secret+"wrong")).toThrow();
    const parts=a.split("."); parts[2]=Buffer.from("corrupt").toString("base64");
    expect(()=>decryptAccessKey(parts.join("."),"shop-a",secret)).toThrow();
    expect(()=>encryptAccessKey("any",null,"")).toThrow();
  });
  it("fingerprints the exact bill, ignores token and property order",()=>{
    const a={items:[{name:"Test",price:100,quantity:1}],paymentMode:"cash",customerPhone:"9999999999"};
    expect(billFingerprint(a)).toBe(billFingerprint({customerPhone:"9999999999",paymentMode:"cash",items:[{quantity:1,price:100,name:"Test"}],manualAccessToken:"different"}));
    expect(billFingerprint(a)).not.toBe(billFingerprint({...a,paymentMode:"upi"}));
    expect(billFingerprint(a)).not.toBe(billFingerprint({...a,items:[{name:"Test",price:101,quantity:1}]}));
  });
});
