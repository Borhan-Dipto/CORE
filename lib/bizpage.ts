import "server-only";
import { canWrite, getBusiness, getT } from "@/lib/session";
import { getAccounts, getCategories, getMembers } from "@/lib/workspace";
import { resolveRange } from "@/lib/range";

/** Everything most business pages need, loaded in parallel. */
export async function loadBizPage(id: string, sp: Record<string, string> = {}) {
  const range = resolveRange(sp);
  const business = await getBusiness(id);
  const [{ lang, t }, writable, members, accounts, categories] = await Promise.all([
    getT(), canWrite(business), getMembers(id), getAccounts(id, range.to), getCategories(id),
  ]);
  const accountNames = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const partnerNames = Object.fromEntries(members.map((m) => [m.user_id, m.name]));
  const opts = {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, is_active: a.is_active })),
    categories,
    partners: members.map((m) => ({ user_id: m.user_id, name: m.name })),
  };
  return { business, lang, t, writable, members, accounts, categories, range, accountNames, partnerNames, opts };
}
