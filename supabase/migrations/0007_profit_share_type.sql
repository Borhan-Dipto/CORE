-- 0007: new ledger type for profit credited to a partner's capital (non-cash).
-- Separate migration: a new enum value must be committed before it is used.
alter type public.txn_type add value if not exists 'profit_share';
