import { Provider, ValueOrPromise } from "@loopback/context";
import { RequestContext } from "@loopback/rest";
import { IAuthUserWithPermissions } from "@sourceloop/core";

export class CurrentUserProvider implements Provider<IAuthUserWithPermissions> {
    
    value(): any {
        
        return {
            "clientId": "test_client_id",
            "userId": "c91b09fc-2ec9-4287-cc6f-9a1dbf3958b8",
            "userTenantId": "7c5b8b2e-6406-b037-7ca6-62af3ba4d83b",
            "iat": 1653992279,
            "exp": 1653999459,
            "aud": "test_client_id",
            "iss": "test",
            "permissions": [
              "ViewMessage",
              "CreateMessage",
              "UpdateMessage",
              "DeleteMessage",
              "CreateMessageRecipient",
              "ViewMessageRecipient",
              "UpdateMessageRecipient",
              "DeleteMessageRecipient",
              "ViewNotification",
              "CreateNotification",
              "UpdateNotification",
              "DeleteNotification",
              "CanGetNotificationAccess"
            ]
          }
    }

}