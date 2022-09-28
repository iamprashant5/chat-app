import { inject, Provider } from "@loopback/context";
import { getService } from "@loopback/service-proxy";
import { AuthenticateDataSource } from "../datasources";

export interface AuthenticateService {

    authGoogle(clientData: any): Promise<any>;
    authGoogleRedirect(code: string, state: string): Promise<any>;

}

export class AuthenticateServiceProvider
  implements Provider<AuthenticateService>
{
  constructor(
    @inject("datasources.authenticate")
    protected dataSource: AuthenticateDataSource = new AuthenticateDataSource()
  ) {}
  value(): Promise<AuthenticateService> {
    return getService(this.dataSource);
  }
}
