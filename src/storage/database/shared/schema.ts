import { pgTable, serial, varchar, text, integer, boolean, timestamp, numeric, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表 - 存储通过门禁验证的粉丝信息
export const users = pgTable(
	"users",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		weibo_uid: varchar("weibo_uid", { length: 32 }).notNull().unique(),
		weibo_name: varchar("weibo_name", { length: 128 }),
		avatar_url: text("avatar_url"),
		chaohua_level: integer("chaohua_level").default(0),
		is_admin: boolean("is_admin").default(false).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("users_weibo_uid_idx").on(table.weibo_uid),
	]
);

// 小作坊商品表
export const workshopProducts = pgTable(
	"workshop_products",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		seller_id: varchar("seller_id", { length: 36 }).notNull().references(() => users.id),
		title: varchar("title", { length: 200 }).notNull(),
		description: text("description"),
		image_key: text("image_key"),
		price: numeric("price", { precision: 10, scale: 2 }),
		stock: integer("stock").default(0),
		category: varchar("category", { length: 50 }),
		status: varchar("status", { length: 20 }).default("active").notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("workshop_products_seller_id_idx").on(table.seller_id),
		index("workshop_products_status_idx").on(table.status),
		index("workshop_products_created_at_idx").on(table.created_at),
	]
);

// 团长申请表
export const leaderApplications = pgTable(
	"leader_applications",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		applicant_id: varchar("applicant_id", { length: 36 }).notNull().references(() => users.id),
		weibo_name: varchar("weibo_name", { length: 128 }),
		reason: text("reason"),
		contact: varchar("contact", { length: 200 }),
		status: varchar("status", { length: 20 }).default("pending").notNull(),
		review_note: text("review_note"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("leader_applications_applicant_id_idx").on(table.applicant_id),
		index("leader_applications_status_idx").on(table.status),
	]
);
