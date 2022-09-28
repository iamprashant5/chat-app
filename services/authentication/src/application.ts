import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import {
  AuthenticationServiceComponent,
  SignUpBindings,
} from '@sourceloop/authentication-service';
import {
  BearerVerifierBindings,
  BearerVerifierComponent,
  BearerVerifierConfig,
  BearerVerifierType,
  CoreComponent,
  SECURITY_SCHEME_SPEC,
  ServiceSequence,
} from '@sourceloop/core';
import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';
import {Strategies} from 'loopback4-authentication';
import {
  AuthorizationBindings,
  AuthorizationComponent,
} from 'loopback4-authorization';
import * as path from 'path';
import {BearerTokenVerifyProvider} from './providers/bearer-verifier.provider';
import {GoogleSignupProvider} from './providers/google-signup.provider';
import {GoogleOauth2VerifyProvider} from './providers/google-verifier.provider';

export {ApplicationConfig};

export class AuthenticationApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    const port = 3000;
    dotenv.config({
      path: '.env',
    });
    dotenvExt.load({
      schema: '.env',
      errorOnMissing: true,
      includeProcessEnv: true,
    });
    options.rest = options.rest ?? {};
    options.rest.basePath = process.env.BASE_PATH ?? '';
    options.rest.port = +(process.env.PORT ?? port);
    options.rest.host = process.env.HOST;
    options.rest.cors = {
      origin: '*',
    };
    options.rest.openApiSpec = {
      endpointMapping: {
        [`${options.rest.basePath}/openapi.json`]: {
          version: '3.0.0',
          format: 'json',
        },
      },
    };

    super(options);
    this.component(CoreComponent);

    // Set up the custom sequence
    this.sequence(ServiceSequence);

    this.component(AuthenticationServiceComponent);

    // Add bearer verifier component
    this.bind(BearerVerifierBindings.Config).to({
      type: BearerVerifierType.service,
    } as BearerVerifierConfig);
    this.component(BearerVerifierComponent);

    this.bind(Strategies.Passport.GOOGLE_OAUTH2_VERIFIER).toProvider(
      GoogleOauth2VerifyProvider,
    );
    this.bind(SignUpBindings.GOOGLE_SIGN_UP_PROVIDER).toProvider(
      GoogleSignupProvider,
    );
    this.bind(Strategies.Passport.BEARER_TOKEN_VERIFIER).toProvider(
      BearerTokenVerifyProvider,
    );

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    this.component(RestExplorerComponent);
    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });

    // Add authorization component
    this.bind(AuthorizationBindings.CONFIG).to({
      allowAlwaysPaths: ['/explorer', '/openapi.json'],
    });
    this.component(AuthorizationComponent);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };

    this.api({
      openapi: '3.0.0',
      info: {
        title: 'authentication',
        version: '1.0.0',
      },
      paths: {},
      components: {
        securitySchemes: SECURITY_SCHEME_SPEC,
      },
      servers: [{url: '/'}],
    });
  }
}
