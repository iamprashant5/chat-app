import {Provider} from '@loopback/context';
import {verify} from 'jsonwebtoken';
import {IAuthUser, VerifyFunction} from 'loopback4-authentication';


export class BearerTokenVerifyProvider
  implements Provider<VerifyFunction.BearerFn> {

  value(): VerifyFunction.BearerFn {
    return async token => {
      const tokenInfo = verify(token, process.env.JWT_SECRET as string, {
        issuer: process.env.JWT_ISSUER,
      });

      return tokenInfo as IAuthUser;
    };
  }
}
