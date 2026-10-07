export interface MailTeamSeatMember {
  userId: string | null;
}

export interface MailTeamSeatAssignment {
  assignedUserId: string | null;
}

/** Mail seats are distinct mailbox members plus distinct shared-inbox assignees. */
export function canAssignMailTeamSeat(
  userId: string,
  seatLimit: number | null,
  members: readonly MailTeamSeatMember[],
  assignments: readonly MailTeamSeatAssignment[],
): boolean {
  if (seatLimit == null) return true;

  const usedSeats = new Set<string>();
  for (const member of members) {
    if (member.userId) usedSeats.add(member.userId);
  }
  for (const assignment of assignments) {
    if (assignment.assignedUserId) usedSeats.add(assignment.assignedUserId);
  }

  return usedSeats.has(userId) || usedSeats.size < seatLimit;
}
