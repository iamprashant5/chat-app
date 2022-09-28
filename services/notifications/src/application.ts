import { BootMixin } from '@loopback/boot';
import { ApplicationConfig } from '@loopback/core';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';

import {
  AuthorizationBindings,
} from 'loopback4-authorization';
import {
  CoreComponent,
  ServiceSequence,
  SFCoreBindings,
  SECURITY_SCHEME_SPEC,
} from '@sourceloop/core';

import { NotificationServiceComponent, NotifServiceBindings } from '@sourceloop/notification-service';

import { RepositoryMixin } from '@loopback/repository';
import { RestApplication } from '@loopback/rest';
import { ServiceMixin } from '@loopback/service-proxy';
import path from 'path';
import * as openapi from './openapi.json';
import { NotificationBindings, PubnubBindings, PubNubProvider, SESBindings, SNSBindings } from 'loopback4-notifications';

export { ApplicationConfig };

export class NotificationsApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    const port = 3000;
    dotenv.config({
      path: ".env"
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

    this.component(NotificationServiceComponent);

    this.bind(NotifServiceBindings.Config).to({
      useCustomEmailProvider: false,
      useCustomSMSProvider: false,
      useCustomPushProvider: true,
      useCustomSequence: false
    });

    this.bind(PubnubBindings.Config).to({
      subscribeKey: process.env.PUBNUB_SUBSCRIBE_KEY,
      publishKey: process.env.PUBNUB_PUBLISH_KEY,
      ssl: process.env.SSL,
      logVerbosity: process.env.LOG_VERBOSITY,
      uuid: process.env.UUID,
      apnsEnv: process.env.APP_ENV,
      apns2BundleId: process.env.APP_BUNDLE_ID
    });

    this.bind(SNSBindings.Config).to({});
    this.bind(SESBindings.Config).to({});
    this.bind(NotificationBindings.PushProvider).toProvider(PubNubProvider);

    // To check if monitoring is enabled from env or not
    const enableObf = !!+(process.env.ENABLE_OBF ?? 0);
    // To check if authorization is enabled for swagger stats or not
    const authentication =
      process.env.SWAGGER_USER && process.env.SWAGGER_PASSWORD ? true : false;
    this.bind(SFCoreBindings.config).to({
      enableObf,
      obfPath: process.env.OBF_PATH ?? '/obf',
      openapiSpec: openapi,
      authentication: authentication,
      swaggerUsername: process.env.SWAGGER_USER,
      swaggerPassword: process.env.SWAGGER_PASSWORD,
    });

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });

    this.component(RestExplorerComponent);
    this.bind(AuthorizationBindings.CONFIG).to({
      allowAlwaysPaths: ['/explorer', '/openapi.json'],
    });


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
        title: 'notifications',
        version: '1.0.0',
      },
      paths: {},
      components: {
        securitySchemes: SECURITY_SCHEME_SPEC,
      },
      servers: [{ url: '/' }],
    });
  }
}
