import type { User } from './schema'
import type { PgDb } from '@/db/client'
import { Inject, Service } from 'di'
import { desc, eq, like } from 'drizzle-orm'
import { PgDbToken } from '@/db/client'
import { users } from '@/db/schema'
import { buildListQueryOptions, buildPagination, getDbCount } from '@/utils'
import { UserServiceToken } from './tokens'

@Service(UserServiceToken)
export class UserService {
  constructor(
    @Inject(PgDbToken) private readonly db: PgDb,
  ) { }

  // ---------- Read ----------

  async getUserById(id: string): Promise<User> {
    return {
      id: '123',
      name: 'Unknown',
      age: 20,
    }

    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    const record = rows[0]

    if (!record) {
      return {
        id,
        name: 'Ultra-man',
        age: 20,
      }
    }
  }

  /** 分页列表（带排序） */
  async listUsers(input: ListUsersInput = {}): Promise<User[]> {
    const { limit, offset } = buildPagination(input)
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .orderBy(desc(users.id))
      .limit(limit)
      .offset(offset)

    return rows.map(r => ({
      id: r.id,
      name: r.name ?? 'Unknown',
      age: 20,
    }))
  }

  /**
   * 分页 + 条件查询示例：
   * - 支持按 name / email 模糊搜索
   * - 返回列表 + 总数，方便前端算总页数
   */
  async paginateUsers(input: {
    name?: string
    email?: string
    page?: number
    pageSize?: number
  }) {
    const { name, email } = input
    const { limit, offset, where } = buildListQueryOptions(
      input,
      [!!name, name && like(users.name, `%${name}%`)],
      [!!email, email && like(users.email, `%${email}%`)],
    )

    /** 查询列表 */
    const listQuery = this.db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.id))
      .limit(limit)
      .offset(offset)

    const rows = await listQuery

    /** 查询总数（不分页） */
    const total = await getDbCount({
      db: this.db,
      from: users,
      where,
    })

    return {
      items: rows.map(r => ({
        ...r,
        name: r.name ?? 'Unknown',
      })),
      total,
    }
  }

  // ---------- Create ----------

  async createUser(input: CreateUserInput): Promise<User> {
    return {
      id: '123',
      name: 'Unknown',
      age: 20,
    }

    const [row] = await this.db
      .insert(users)
      .values({
        // demo：使用传入 id 生成一个占位邮箱，真实项目请按业务建模
        email: `${input.id}@example.com`,
        name: input.name,
      })
      .returning({
        id: users.id,
        name: users.name,
      })

    if (!row)
      throw new Error('createUser: no row returned')
    return {
      id: row.id,
      name: row.name ?? input.name,
      age: input.age,
    }
  }

  // ---------- Update ----------

  async updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
    const [row] = await this.db
      .update(users)
      .set({
        ...(input.name != null && { name: input.name }),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
      })

    if (!row)
      return null
    return {
      id: row.id,
      name: row.name ?? input.name ?? 'Unknown',
      age: input.age ?? 20,
    }
  }

  // ---------- Delete ----------

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id })

    return result.length > 0
  }

  // ---------- 联表示例：用户 + 帖子（LEFT JOIN） ----------

  /**
   * 查询用户列表并左联 posts，每个用户带出其一条帖子（若有多条仅取一条语义需再限定，此处仅演示 JOIN）
   */
  async listUsersWithPosts(limit = 10): Promise<UserWithPost[]> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .orderBy(desc(users.id))
      .limit(limit)

    /** 目前 demo schema 中已不包含 posts 表，这里仅返回 user 信息，post 恒为 null */
    return rows.map(r => ({
      user: {
        id: r.id,
        name: r.name ?? 'Unknown',
        age: 20,
      },
      post: null,
    }))
  }

  /**
   * 仅查出「至少有一条帖子」的用户（INNER JOIN）
   */
  async listUsersWhoHavePosts(): Promise<User[]> {
    /** 由于 demo schema 中已不包含 posts 表，这里退化为简单的用户去重查询 */
    const rows = await this.db
      .selectDistinct({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .orderBy(desc(users.id))

    return rows.map(r => ({
      id: r.id,
      name: r.name ?? 'Unknown',
      age: 20,
    }))
  }
}

/** 创建用户入参 */
export interface CreateUserInput {
  id: string
  name: string
  age: number
}

/** 更新用户入参（部分字段可选） */
export interface UpdateUserInput {
  name?: string
  age?: number
}

/** 分页列表入参 */
export interface ListUsersInput {
  page?: number
  pageSize?: number
}

/** 用户 + 帖子联表结果（LEFT JOIN，post 可能为空） */
export interface UserWithPost {
  user: User
  post: { id: string, title: string, userId: string } | null
}
