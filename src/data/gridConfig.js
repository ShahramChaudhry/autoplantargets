/**
 * Per-division grid layout configuration.
 * includeSalesOffices: true  → rows = Model × Sales Office
 * includeSalesOffices: false → rows = Model only
 *
 * Swap these flags to change Honda (or any division) without new components.
 */
export const divisionGridConfig = {
  Toyota: {
    includeSalesOffices: true,
  },
  Honda: {
    // Set to true to enable Model × Sales Office for Honda without UI changes
    includeSalesOffices: false,
  },
};
