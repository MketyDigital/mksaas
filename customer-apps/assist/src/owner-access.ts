export type OwnerClaim = {
  customerId: string;
  tokenId: string;
  tokenHash: string;
  userId: string;
  sessionId: string;
  sessionHash: string;
  now: number;
  expiresAt: number;
};

/** D1.batch executes the insert and consumption in one transaction. */
export async function claimOwnerAccess(db: D1Database, claim: OwnerClaim): Promise<boolean> {
  const results = await db.batch([
    db.prepare(
      `INSERT INTO sessions (id,token_hash,user_id,customer_id,expires_at,created_at,last_seen_at)
       SELECT ?,?,st.user_id,st.customer_id,?,?,? FROM setup_tokens st
       JOIN customer_users cu ON cu.customer_id=st.customer_id AND cu.user_id=st.user_id AND cu.role='owner'
       JOIN users u ON u.id=st.user_id AND u.status='active'
       WHERE st.id=? AND st.customer_id=? AND st.user_id=? AND st.token_hash=?
         AND st.consumed_at IS NULL AND st.expires_at>?`,
    ).bind(claim.sessionId, claim.sessionHash, claim.expiresAt, claim.now, claim.now,
      claim.tokenId, claim.customerId, claim.userId, claim.tokenHash, claim.now),
    db.prepare(
      `UPDATE setup_tokens SET consumed_at=? WHERE id=? AND customer_id=?
       AND consumed_at IS NULL AND EXISTS (SELECT 1 FROM sessions WHERE id=? AND token_hash=?)`,
    ).bind(claim.now, claim.tokenId, claim.customerId, claim.sessionId, claim.sessionHash),
  ]);
  return Number(results[0]?.meta?.changes) === 1 && Number(results[1]?.meta?.changes) === 1;
}
