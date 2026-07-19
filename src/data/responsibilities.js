/**
 * MVP responsibility scopes — who can see which Division / Sales Offices.
 * null / "all" means unrestricted within that dimension.
 * Later: replace with Databricks role / territory tables.
 */
export const userResponsibilities = {
  "demand@autoplan.com": {
    divisions: "all",
    offices: "all",
  },
  "b2bdirector@autoplan.com": {
    divisions: "all",
    offices: "all",
  },
  "md@autoplan.com": {
    divisions: "all",
    offices: "all",
  },
  "npm@autoplan.com": {
    divisions: "all",
    offices: "all",
  },
  // Branch Manager: all offices so they can allocate every office NPM filled
  "branchmanager@autoplan.com": {
    divisions: "all",
    offices: "all",
  },
};

export function getResponsibility(user) {
  if (!user?.email) {
    return { divisions: "all", offices: "all" };
  }
  return (
    userResponsibilities[user.email.toLowerCase()] || {
      divisions: "all",
      offices: "all",
    }
  );
}
