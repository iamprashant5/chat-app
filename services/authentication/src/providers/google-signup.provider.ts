import {inject, Provider, Setter} from '@loopback/context';
import {service} from '@loopback/core';
import {
  AuthenticationBindings,
  GoogleSignUpFn,
} from '@sourceloop/authentication-service';
import {ILogger, LOGGER} from '@sourceloop/core';
import {UserService} from '../services/user.service';
export class GoogleSignupProvider implements Provider<GoogleSignUpFn> {
  constructor(
    @inject.setter(AuthenticationBindings.CURRENT_USER)
    public setCurrentUser: Setter<any>,
    @service(UserService)
    public userService: UserService,
    @inject(LOGGER.LOGGER_INJECT)
    public logger: ILogger,
  ) {}

  value(): any {
    return async (profile: any) => this.action(profile);
  }

  async action(profile: any) {
    this.logger.info('[GoogleSignupProvider] Invoked');
    const user = profile._json;
    user.username = user.email;
    user.firstName = user.given_name;
    user.lastName = user.family_name;
    user.tenantId = user?.tenantId || process.env.DEFAULT_TENANT_ID;
    user.clientId = user?.clientId || process.env.GOOGLE_AUTH_CLIENT_ID;
    user.roleId = user?.roleId || process.env.DEFAULT_ROLE_ID;
    user.password = '';
    const options = {};
    await this.setCurrentUser(user);

    return await this.userService.createUser(user, options);
  }
}
