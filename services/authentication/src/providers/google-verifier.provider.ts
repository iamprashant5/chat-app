import {inject, Provider} from '@loopback/context';
import {service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {
  GoogleSignUpFn,
  SignUpBindings,
  UserRepository,
} from '@sourceloop/authentication-service';
import {ILogger, LOGGER} from '@sourceloop/core';
import {AuthErrorKeys, VerifyFunction} from 'loopback4-authentication';
import {UserService} from '../services/user.service';

export class GoogleOauth2VerifyProvider
  implements Provider<VerifyFunction.GoogleAuthFn>
{
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @service(UserService)
    public userService: UserService,
    @inject(SignUpBindings.GOOGLE_SIGN_UP_PROVIDER)
    private readonly signupProvider: GoogleSignUpFn,
    @inject(LOGGER.LOGGER_INJECT)
    public logger: ILogger,
  ) {}

  value(): VerifyFunction.GoogleAuthFn {
    return async (accessToken, refreshToken, profile) => {
      this.logger.info('[GoogleOauth2VerifyProvider] Invoked');
      const data = (profile as any)._json;
      let user: any = await this.userRepository.findOne({
        where: {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          email: data.email,
        },
      });

      if (!user) {
        user = await this.signupProvider(profile);
        this.logger.info('[GoogleOauth2VerifyProvider] New User Created');
      }

      if (!user) {
        throw new HttpErrors.Unauthorized(AuthErrorKeys.InvalidCredentials);
      }
      return user;
    };
  }
}
