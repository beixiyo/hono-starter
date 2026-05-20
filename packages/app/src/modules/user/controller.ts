import type { CreateUserBody } from './route'
import type { UserService } from './service'
import { Body, Controller, Inject, Params } from 'di'
import { Get, Post } from '@/core'
import { createUserRoute, getUserRoute } from './route'
import { UserServiceToken } from './tokens'

@Controller('/users')
export class UserController {
  constructor(
    @Inject(UserServiceToken) private readonly userService: UserService,
  ) { }

  @Get('/{id}', getUserRoute)
  async getUser(
    @Params('id') id: string,
  ) {
    const user = await this.userService.getUserById(id)
    return user
  }

  @Post('/', createUserRoute)
  async createUser(
    @Body() body: CreateUserBody,
  ) {
    const user = await this.userService.createUser(body)
    return user
  }
}
