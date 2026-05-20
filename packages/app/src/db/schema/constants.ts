import { pgSchema } from 'drizzle-orm/pg-core'

/**
 * CREATE SCHEMA IF NOT EXISTS "dashboard";
 */
export const dashboard = pgSchema('dashboard')
