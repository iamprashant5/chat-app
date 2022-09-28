import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';
import * as config from './authenticate.datasource.config.json';

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class AuthenticateDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = 'authenticate';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.authenticate', {optional: true})
    dsConfig: object = config,
  ) {
    dsConfig = Object.assign({}, dsConfig, {
      options: {baseUrl: process.env.AUTH_SERVICE_URL},
    });
    super(dsConfig);
  }
}
