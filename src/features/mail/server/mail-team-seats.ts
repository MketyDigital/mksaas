import { and, eq, isNotNull, ne } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { mailMailboxMembers, mailThreads } from '@/shared/db/schema';

/**
 * Mail seats are distinct mailbox members plus distinct shared-inbox assignees.
 * Tenant membership alone does not consume a Mail seat. Passing the current
 * thread excludes its previous assignee while checking a reassignment.
 */
export async function canAssignMailTeamSeat(
  tenantId: string,
  userId: string,
  seatLimit: number | null,
  excludingThreadId?: string,
): Promise<boolean> {
  if (seatLimit == null) return true;

  const threadConditions = [
    eq(mailThreads.tenantId, tenantId),
    isNotNull(mailThreads.assignedUserId),
  ];
  if (excludingThreadId) threadConditions.push(ne(mailThreads.id, excludingThreadId));

  const [members, assignments] = await Promise.all([
    db.query.mailMailboxMembers.findMany({
      where: eq(mailMailboxMembers.tenantId, tenantId),
      columns: { userId: true },
    }),
    db.query.mailThreads.findMany({
      where: and(...threadConditions),
      columns: { assignedUserId: true },
    }),
  ]);

  const usedSeats = new Set<string>();
  for (const member of members) {
    if (member.userId) usedSeats.add(member.userId);
  }
  for (const assignment of assignments) {
    if (assignment.assignedUserId) usedSeats.add(assignment.assignedUserId);
  }

  return usedSeats.has(userId) || usedSeats.size < seatLimit;
}
