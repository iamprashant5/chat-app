// Uncomment these imports to begin using these cool features!

import { inject } from "@loopback/core";
import { CountSchema, Filter, Where } from "@loopback/repository";
import {
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  Response,
  RestBindings,
} from "@loopback/rest";
import {
  CONTENT_TYPE,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
  SuccessResponse,
} from "@sourceloop/core";
import {
  authenticate,
  AuthenticationBindings,
  AuthErrorKeys,
  STRATEGY,
} from "loopback4-authentication";
import { authorize } from "loopback4-authorization";
import { PubnubMessageRecipient, Pubnubnotification } from "../models";
import { PubnubMessage } from "../models/pubnub-message.model";
import { PermissionKey } from "../permission-key.enum";
import {
  AuthenticateService,
  Messageservice,
  Notificationservice,
} from "../services";

export class PubnubMessageController {
  constructor(
    @inject("services.Messageservice")
    private readonly messageService: Messageservice,
    @inject("services.Notificationservice")
    private readonly notifService: Notificationservice,
    @inject("services.AuthenticateService")
    private readonly authService: AuthenticateService
  ) {}

  @authenticate(STRATEGY.BEARER)
  @authorize({ permissions: [PermissionKey.ViewMessage] })
  @get("/messages", {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: "Array of Message model instances",
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: "array",
              items: getModelSchemaRef(PubnubMessage, {
                includeRelations: true,
              }),
            },
          },
        },
      },
    },
  })
  async find(
    //@inject(AuthenticationBindings.CURRENT_USER) user: IAuthUserWithPermissions,
    @param.header.string("Authorization") token: string,
    @param.query.string("ChannelID") channelID?: string,
    @param.filter(PubnubMessage) filter?: Filter<PubnubMessage>
  ): Promise<PubnubMessage[]> {
    const filter1: Filter<PubnubMessage> = {
      where: {
        channelId: channelID,
      },
      order: ["createdOn ASC"],
    };
    return this.messageService.getMessage(token, filter1);
  }

  @authenticate(STRATEGY.BEARER)
  @authorize({ permissions: [PermissionKey.CreateMessage] })
  @post("/messages", {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: "Message model instance",
        content: {
          [CONTENT_TYPE.JSON]: { schema: getModelSchemaRef(PubnubMessage) },
        },
      },
    },
  })
  async create(
    @param.header.string("Authorization") token: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRef(PubnubMessage, {
            title: "Message",
            exclude: ["id"],
          }),
        },
      },
    })
    message: PubnubMessage
  ): Promise<PubnubMessage> {
    message.channelId = message.channelId ?? message.toUserId;
    const msg = await this.messageService.createMessage(message, token);
    const msgrecipient = new PubnubMessageRecipient({
      channelId: message.channelId,
      recipientId: message.toUserId ?? message.channelId,
      messageId: msg.id,
    });
    await this.messageService.createMessageRecipients(msgrecipient, token);
    const notif = new Pubnubnotification({
      subject: message.subject,
      body: message.body,
      type: 0,
      receiver: {
        to: [
          {
            type: 0,
            id: message.channelId,
          },
        ],
      },
    });
    await this.notifService.createNotification(notif, token);

    return msg;
  }

  @authenticate(STRATEGY.BEARER)
  @authorize({ permissions: [PermissionKey.UpdateMessageRecipient] })
  @patch(`messages/{messageid}/markAsRead`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: "Message PATCH success count",
        content: { [CONTENT_TYPE.JSON]: { schema: CountSchema } },
      },
    },
  })
  async patchMessageRecipients(
    @param.header.string("Authorization") token: string,
    @param.path.string("messageid") msgId: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRef(PubnubMessageRecipient, { partial: true }),
        },
      },
    })
    messageRecipient: Partial<PubnubMessageRecipient>,
    @param.query.object("where", getWhereSchemaFor(PubnubMessageRecipient))
    where?: Where<PubnubMessageRecipient>
  ): Promise<PubnubMessageRecipient> {
    const patched = {
      isRead: true,
    };

    return this.messageService.updateMsgRecipients(msgId, patched, token);
  }

  @authenticate(STRATEGY.BEARER)
  @authorize({ permissions: ["*"] })
  @get("/userTenantId", {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: "To get the userTenantId",
        content: {
          [CONTENT_TYPE.TEXT]: {
            type: "string",
          },
        },
      },
    },
  })
  async me(
    @inject(AuthenticationBindings.CURRENT_USER, { optional: true })
    user: IAuthUserWithPermissions,
    @param.header.string("Authorization") token: string
  ): Promise<string> {
    if (user?.userTenantId) {
      return user.userTenantId;
    } else {
      return "";
    }
  }

  @authorize({ permissions: ["*"] })
  @get("/auth/google", {
    responses: {
      [STATUS_CODE.OK]: {
        description: "Google authentication",
        content: {
          [CONTENT_TYPE.FORM_URLENCODED]: {
            type: "string",
          },
        },
      },
    },
  })
  async authGoogle(@inject(RestBindings.Http.RESPONSE) response: Response) {
    const params = new URLSearchParams();
    params.append("client_id", process.env.GOOGLE_AUTH_CLIENT_ID!);
    params.append("client_secret", process.env.GOOGLE_AUTH_CLIENT_SECRET!);
    try {
      const data = await this.authService.authGoogle(params.toString());

      if (data?.statusCode === STATUS_CODE.FOUND) {
        const redirectUrl = data?.headers?.location;
        return response.redirect(redirectUrl);
      } else {
        throw new HttpErrors.Unauthorized(AuthErrorKeys.InvalidCredentials);
      }
    } catch (error) {
      throw new HttpErrors.BadRequest(AuthErrorKeys.UnknownError);
    }
  }

  @authorize({ permissions: ["*"] })
  @post("/auth/google-auth-redirect")
  async authGoogleRedirect(
    @requestBody() body: { code: string; state: string }
  ) {
    try {
      const res = await this.authService.authGoogleRedirect(
        body.code,
        body.state
      );
      const token = new URL(res.request.href).searchParams.get("code");
      return new SuccessResponse({
        token: token,
      });
    } catch (error) {
      throw new HttpErrors.Unauthorized(AuthErrorKeys.UnknownError);
    }
  }
}
