import { randomUUID } from "crypto";
import { readDb, mutateDb } from "./store";

function applyFilters(rows, filters) {
  return rows.filter((row) =>
    filters.every((f) => {
      if (f.type === "eq") return row[f.column] === f.value;
      if (f.type === "in") return f.values.includes(row[f.column]);
      return true;
    })
  );
}

function applyOrder(rows, orders) {
  if (!orders.length) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const av = a[order.column];
      const bv = b[order.column];
      if (av === bv) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : 1;
      return order.ascending ? cmp : -cmp;
    }
    return 0;
  });
}

function project(row, columns) {
  if (!columns || columns === "*" || columns.trim() === "*") return { ...row };
  const fields = columns.split(",").map((c) => c.trim()).filter(Boolean);
  const out = {};
  for (const field of fields) {
    // Nested select like users(name, role) — expand if FK shape later
    if (field.includes("(")) continue;
    out[field] = row[field];
  }
  return Object.keys(out).length ? out : { ...row };
}

function expandNested(row, selectArg, db) {
  if (!selectArg || !selectArg.includes("(")) return row;

  const result = { ...row };

  // users(name) / users(name, role)
  if (selectArg.includes("users(") && row.user_id) {
    const user = db.users.find((u) => u.id === row.user_id);
    const wantRole = selectArg.includes("role");
    result.users = user
      ? wantRole
        ? { name: user.name, role: user.role }
        : { name: user.name }
      : null;
  }

  // sales_office_allocations(sales_office, units)
  if (selectArg.includes("sales_office_allocations(") && row.sales_office_allocation_id) {
    const office = db.sales_office_allocations.find((o) => o.id === row.sales_office_allocation_id);
    result.sales_office_allocations = office
      ? { sales_office: office.sales_office, units: office.units }
      : null;
  }

  // targets(brand) / targets(planning_period_id)
  if (selectArg.includes("targets(") && row.target_id) {
    const target = db.targets.find((t) => t.id === row.target_id);
    if (target) {
      const nested = {};
      if (selectArg.includes("brand")) nested.brand = target.brand;
      if (selectArg.includes("planning_period_id")) nested.planning_period_id = target.planning_period_id;
      result.targets = nested;
    } else {
      result.targets = null;
    }
  }

  return result;
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orders = [];
    this.selectArg = "*";
    this.countExact = false;
    this.headOnly = false;
    this.singleMode = null;
    this.limitCount = null;
    this.mutation = null;
  }

  select(columns = "*", options = {}) {
    this.selectArg = columns;
    if (options.count === "exact") this.countExact = true;
    if (options.head) this.headOnly = true;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: "in", column, values: values || [] });
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  insert(payload) {
    this.mutation = { type: "insert", payload };
    return this;
  }

  update(payload) {
    this.mutation = { type: "update", payload };
    return this;
  }

  delete() {
    this.mutation = { type: "delete" };
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    try {
      if (this.mutation) {
        return await this.executeMutation();
      }
      return await this.executeSelect();
    } catch (err) {
      return { data: null, error: { message: err.message }, count: null };
    }
  }

  async executeSelect() {
    const db = await readDb();
    const table = db[this.table] || [];
    let rows = applyOrder(applyFilters(table, this.filters), this.orders);

    if (this.limitCount != null) {
      rows = rows.slice(0, this.limitCount);
    }

    const count = this.countExact ? rows.length : null;

    if (this.headOnly) {
      return { data: null, error: null, count };
    }

    const mapped = rows.map((row) => {
      const expanded = expandNested(row, this.selectArg, db);
      return project(expanded, this.selectArg.includes("(") ? "*" : this.selectArg);
    });

    // Keep nested relations even when projecting *
    const withRelations = rows.map((row, i) => {
      const expanded = expandNested(row, this.selectArg, db);
      if (this.selectArg.includes("(")) return expanded;
      return mapped[i];
    });

    if (this.singleMode === "single") {
      if (withRelations.length === 0) {
        return { data: null, error: { message: "Not found", code: "PGRST116" }, count };
      }
      return { data: withRelations[0], error: null, count };
    }

    if (this.singleMode === "maybe") {
      return { data: withRelations[0] || null, error: null, count };
    }

    return { data: withRelations, error: null, count };
  }

  async executeMutation() {
    if (this.mutation.type === "insert") {
      return mutateDb((db) => {
        if (!db[this.table]) db[this.table] = [];
        const rows = Array.isArray(this.mutation.payload)
          ? this.mutation.payload
          : [this.mutation.payload];

        const inserted = rows.map((row) => {
          const next = {
            ...row,
            id: row.id || randomUUID(),
            created_at: row.created_at || new Date().toISOString(),
          };
          if (
            this.table === "planning_periods" ||
            this.table === "targets" ||
            this.table.includes("allocation")
          ) {
            next.updated_at = row.updated_at || new Date().toISOString();
          }
          db[this.table].push(next);
          return next;
        });

        if (this.singleMode) {
          return { data: inserted[0], error: null };
        }
        return { data: inserted, error: null };
      });
    }

    if (this.mutation.type === "update") {
      return mutateDb((db) => {
        const table = db[this.table] || [];
        const updated = [];
        for (let i = 0; i < table.length; i++) {
          const match = applyFilters([table[i]], this.filters).length > 0;
          if (!match) continue;
          table[i] = {
            ...table[i],
            ...this.mutation.payload,
            updated_at: new Date().toISOString(),
          };
          updated.push(table[i]);
        }

        if (this.singleMode) {
          return { data: updated[0] || null, error: updated[0] ? null : { message: "Not found" } };
        }
        return { data: updated, error: null };
      });
    }

    if (this.mutation.type === "delete") {
      return mutateDb((db) => {
        const table = db[this.table] || [];
        const remaining = [];
        let deleted = 0;
        for (const row of table) {
          const match = applyFilters([row], this.filters).length > 0;
          if (match) deleted += 1;
          else remaining.push(row);
        }
        db[this.table] = remaining;
        return { data: null, error: null, count: deleted };
      });
    }

    return { data: null, error: { message: "Unknown mutation" } };
  }
}

export function createLocalClient(sessionUserId = null) {
  return {
    from(table) {
      return new QueryBuilder(table);
    },
    auth: {
      async getUser() {
        if (!sessionUserId) return { data: { user: null }, error: null };
        const db = await readDb();
        const user = db.users.find((u) => u.id === sessionUserId);
        if (!user) return { data: { user: null }, error: null };
        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
            },
          },
          error: null,
        };
      },
      async signInWithPassword() {
        return {
          data: null,
          error: { message: "Use /api/auth/login" },
        };
      },
      async signOut() {
        return { error: null };
      },
    },
  };
}
