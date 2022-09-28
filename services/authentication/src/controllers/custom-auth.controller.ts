import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  get,
  HttpErrors,
  param,
  Request,
  Response,
  RestBindings,
} from '@loopback/rest';
import {
  AuthClientRepository,
  AuthCodeBindings,
  AuthenticationBindings,
  CodeWriterFn,
  RoleRepository,
  UserTenantRepository,
} from '@sourceloop/authentication-service';
import {
  AuthUser,
  TokenResponse,
} from '@sourceloop/authentication-service/dist/modules/auth';
import {
  CONTENT_TYPE,
  ILogger,
  LOGGER,
  STATUS_CODE,
  X_TS_TYPE,
} from '@sourceloop/core';
import * as jwt from 'jsonwebtoken';
import {authenticate, AuthErrorKeys, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';

const queryGen = (from: 'body' | 'query') => {
  return (req: Request) => {
    return {
      state: `client_id=${req[from].client_id}`,
    };
  };
};


export class CustomAuthController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private readonly req: Request,
    @repository(AuthClientRepository)
    public authClientRepository: AuthClientRepository,
    @repository(UserTenantRepository)
    public utRepository: UserTenantRepository,
    @repository(RoleRepository)
    public rolesRepository: RoleRepository,
    @inject(LOGGER.LOGGER_INJECT) public logger: ILogger,
  ) {}

  @authenticate(
    STRATEGY.GOOGLE_OAUTH2,
    {
      accessType: 'offline',
      scope: ['profile', 'email'],
      authorizationURL: process.env.GOOGLE_AUTH_URL,
      callbackURL: process.env.GOOGLE_AUTH_CALLBACK_URL,
      clientID: process.env.GOOGLE_AUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
      tokenURL: process.env.GOOGLE_AUTH_TOKEN_URL,
    },
    queryGen('query'),
  )
  @authorize({permissions: ['*']})
  @get('/auth/google-auth-redirect', {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Google Redirect Token Response',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {[X_TS_TYPE]: TokenResponse},
          },
        },
      },
    },
  })
  async googleCallback(
    @param.query.string('code') code: string,
    @param.query.string('state') state: string,
    @inject(RestBindings.Http.RESPONSE) response: Response,
    @inject(AuthCodeBindings.CODEWRITER_PROVIDER)
    googleCodeWriter: CodeWriterFn,
    @inject(AuthenticationBindings.CURRENT_USER)
    user: AuthUser | undefined,
  ): Promise<void> {
    const clientId = new URLSearchParams(state).get('client_id');
    if (!clientId || !user) {
      throw new HttpErrors.Unauthorized(AuthErrorKeys.ClientInvalid);
    }
    const client = await this.authClientRepository.findOne({
      where: {
        clientId,
      },
    });
    if (!client || !client.redirectUrl) {
      throw new HttpErrors.Unauthorized(AuthErrorKeys.ClientInvalid);
    }
    try {
      const userTenant = await this.utRepository.findOne({
        where: {userId: user.id},
      });
      user.userTenantId = userTenant?.id;

      const role = await this.rolesRepository.findOne({
        where: {id: userTenant?.roleId},
      });
      user.permissions = role?.permissions!;

      const payload = {...user};

      const token = await googleCodeWriter(
        jwt.sign(payload, client.secret, {
          expiresIn: client.authCodeExpiration,
          audience: clientId,
          issuer: process.env.JWT_ISSUER,
          algorithm: 'HS256',
        }),
      );
      response.redirect(`${client.redirectUrl}?code=${token}`);
    } catch (error) {
      this.logger.error(error);
      throw new HttpErrors.Unauthorized(AuthErrorKeys.InvalidCredentials);
    }
  }
}
