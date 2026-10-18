/** Account bindings verified against the active production users.
 * Permissions never depend on a client-provided name or role.
 */
export function bonusPermissions(
  user: { username?: string; status?: string } | null | undefined,
) {
  const active = user?.status === "active";
  return {
    canReview: Boolean(
      active && ["lilei", "yilin"].includes(user?.username || ""),
    ),
    canPay: Boolean(active && user?.username === "lilei"),
  };
}
