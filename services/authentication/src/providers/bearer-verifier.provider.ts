import {Provider} from '@loopback/context';
import {repository} from '@loopback/repository';
import {UserRepository} from '@sourceloop/authentication-service';
import {verify} from 'jsonwebtoken';
import {VerifyFunction} from 'loopback4-authentication';

export class BearerTokenVerifyProvider
  implements Provider<VerifyFunction.BearerFn>
{
  constructor(
    @repository(UserRepository) public userRepository: UserRepository,
  ) {}

  value(): VerifyFunction.BearerFn {
    return async token => {
      const tokenInfo: any = verify(token, process.env.JWT_SECRET as string, {
        issuer: process.env.JWT_ISSUER,
      });

      const user = await this.userRepository.findOne({
        where: {
          id: (tokenInfo?.userId || tokenInfo?.user?.id) as string,
        },
      });
      return user;
    };
  }
}
