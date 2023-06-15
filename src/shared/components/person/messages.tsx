import { Component, linkEvent } from "inferno";
import {
  CommentReplyView,
  CommentReportResponse,
  CommentSortType,
  CommentView,
  CreatePrivateMessage,
  CreatePrivateMessageReport,
  DeletePrivateMessage,
  EditPrivateMessage,
  GetPrivateMessages,
  GetSiteResponse,
  MarkPrivateMessageAsRead,
  PersonMentionView,
  PrivateMessageReportResponse,
  PrivateMessageResponse,
  PrivateMessageView,
  PrivateMessagesResponse,
  PurgeItemResponse,
} from "lemmy-js-client";
import { i18n } from "../../i18next";
import { InitialFetchRequest } from "../../interfaces";
import { UserService } from "../../services";
import { FirstLoadService } from "../../services/FirstLoadService";
import { HttpService, RequestState } from "../../services/HttpService";
import {
  editPrivateMessage,
  fetchLimit,
  myAuth,
  myAuthRequired,
  relTags,
  setIsoData,
  toast,
} from "../../utils";
import { HtmlTags } from "../common/html-tags";
import { Icon, Spinner } from "../common/icon";
import { Paginator } from "../common/paginator";
import { PrivateMessage } from "../private_message/private-message";

enum ReplyEnum {
  Reply,
  Mention,
  Message,
}
type ReplyType = {
  id: number;
  type_: ReplyEnum;
  view: CommentView | PrivateMessageView | PersonMentionView | CommentReplyView;
  published: string;
};

interface MessagesState {
  messagesRes: RequestState<PrivateMessagesResponse>;
  sort: CommentSortType;
  page: number;
  siteRes: GetSiteResponse;
  isIsomorphic: boolean;
  recipient: number | null;
}

export class Messages extends Component<any, MessagesState> {
  private isoData = setIsoData(this.context);
  state: MessagesState = {
    sort: "New",
    page: 1,
    siteRes: this.isoData.site_res,
    messagesRes: { state: "empty" },
    isIsomorphic: false,
    recipient: null,
  };

  constructor(props: any, context: any) {
    super(props, context);

    this.handlePageChange = this.handlePageChange.bind(this);
    this.handleRecipientClick = this.handleRecipientClick.bind(this);

    this.handleDeleteMessage = this.handleDeleteMessage.bind(this);
    this.handleMarkMessageAsRead = this.handleMarkMessageAsRead.bind(this);
    this.handleMessageReport = this.handleMessageReport.bind(this);
    this.handleCreateMessage = this.handleCreateMessage.bind(this);
    this.handleEditMessage = this.handleEditMessage.bind(this);

    // Only fetch the data if coming from another route
    if (FirstLoadService.isFirstLoad) {
      const [messagesRes] = this.isoData.routeData;

      this.state = {
        ...this.state,
        messagesRes,
        isIsomorphic: true,
      };
    }
  }

  async componentDidMount() {
    await this.refetch();
  }

  get documentTitle(): string {
    const mui = UserService.Instance.myUserInfo;
    return mui
      ? `@${mui.local_user_view.person.name} ${i18n.t("messages")} - ${
          this.state.siteRes.site_view.site.name
        }`
      : "";
  }

  render() {
    const auth = myAuth();
    const inboxRss = auth ? `/feeds/inbox/${auth}.xml` : undefined;
    return (
      <div className="container-lg">
        <div className="row mb-4">
          <div className="col">
            <HtmlTags
              title={this.documentTitle}
              path={this.context.router.route.match.url}
            />

            <h5 className="mb-2">
              {i18n.t("messages")}
              {inboxRss && (
                <small>
                  <a href={inboxRss} title="RSS" rel={relTags}>
                    <Icon icon="rss" classes="ml-2 text-muted small" />
                  </a>
                  <link
                    rel="alternate"
                    type="application/atom+xml"
                    href={inboxRss}
                  />
                </small>
              )}
            </h5>
          </div>
        </div>
        <div className="row">
          <div className="col-2">{this.recipientList()}</div>
          <div className="col">
            {this.messages()}
            <Paginator
              page={this.state.page}
              onChange={this.handlePageChange}
            />
          </div>
        </div>
      </div>
    );
  }

  async handleRecipientClick(message: PrivateMessageView, event: any) {
    event.preventDefault();

    this.setState({
      recipient: message.recipient.id,
    });
  }

  replyToReplyType(r: CommentReplyView): ReplyType {
    return {
      id: r.comment_reply.id,
      type_: ReplyEnum.Reply,
      view: r,
      published: r.comment.published,
    };
  }

  mentionToReplyType(r: PersonMentionView): ReplyType {
    return {
      id: r.person_mention.id,
      type_: ReplyEnum.Mention,
      view: r,
      published: r.comment.published,
    };
  }

  messageToReplyType(r: PrivateMessageView): ReplyType {
    return {
      id: r.private_message.id,
      type_: ReplyEnum.Message,
      view: r,
      published: r.private_message.published,
    };
  }

  buildCombined(): ReplyType[] {
    const messages: ReplyType[] =
      this.state.messagesRes.state == "success"
        ? this.state.messagesRes.data.private_messages.map(
            this.messageToReplyType
          )
        : [];

    return messages.sort((a, b) => b.published.localeCompare(a.published));
  }

  renderReplyType(i: ReplyType) {
    return (
      <PrivateMessage
        key={i.id}
        private_message_view={i.view as PrivateMessageView}
        onDelete={this.handleDeleteMessage}
        onMarkRead={this.handleMarkMessageAsRead}
        onReport={this.handleMessageReport}
        onCreate={this.handleCreateMessage}
        onEdit={this.handleEditMessage}
      />
    );
  }

  all() {
    if (this.state.messagesRes.state == "loading") {
      return (
        <h5>
          <Spinner large />
        </h5>
      );
    } else {
      return (
        <div>{this.buildCombined().map(r => this.renderReplyType(r))}</div>
      );
    }
  }

  messages() {
    switch (this.state.messagesRes.state) {
      case "loading":
        return (
          <h5>
            <Spinner large />
          </h5>
        );
      case "success": {
        const messages = this.state.messagesRes.data.private_messages.filter(
          message => message.recipient.id === this.state.recipient
        );

        return (
          <div>
            {messages.map(pmv => (
              <PrivateMessage
                key={pmv.private_message.id}
                private_message_view={pmv}
                onDelete={this.handleDeleteMessage}
                onMarkRead={this.handleMarkMessageAsRead}
                onReport={this.handleMessageReport}
                onCreate={this.handleCreateMessage}
                onEdit={this.handleEditMessage}
              />
            ))}
          </div>
        );
      }
    }
  }

  recipientList() {
    if (this.state.messagesRes.state === "success") {
      const messages = this.state.messagesRes.data.private_messages;

      return (
        <div className="">
          {messages.map((message, key) => {
            const loggedInUserId =
              UserService.Instance.myUserInfo?.local_user_view.person.id;

            if (message.recipient.id === loggedInUserId) {
              return;
            }

            return (
              <div
                onClick={linkEvent(message, this.handleRecipientClick)}
                key={key}
              >
                {message.recipient.name}
              </div>
            );
          })}
        </div>
      );
    }
  }

  async handlePageChange(page: number) {
    this.setState({ page });
    await this.refetch();
  }

  static fetchInitialData({
    client,
    auth,
  }: InitialFetchRequest): Promise<any>[] {
    const promises: Promise<RequestState<any>>[] = [];

    if (auth) {
      const privateMessagesForm: GetPrivateMessages = {
        unread_only: true,
        page: 1,
        limit: fetchLimit,
        auth,
      };
      promises.push(client.getPrivateMessages(privateMessagesForm));
    } else {
      promises.push(Promise.resolve({ state: "empty" }));
    }

    return promises;
  }

  async refetch() {
    const page = this.state.page;
    const limit = fetchLimit;
    const auth = myAuthRequired();

    this.setState({ messagesRes: { state: "loading" } });
    this.setState({
      messagesRes: await HttpService.client.getPrivateMessages({
        unread_only: false,
        page,
        limit,
        auth,
      }),
    });
  }

  async handleDeleteMessage(form: DeletePrivateMessage) {
    const res = await HttpService.client.deletePrivateMessage(form);
    this.findAndUpdateMessage(res);
  }

  async handleEditMessage(form: EditPrivateMessage) {
    const res = await HttpService.client.editPrivateMessage(form);
    this.findAndUpdateMessage(res);
  }

  async handleMarkMessageAsRead(form: MarkPrivateMessageAsRead) {
    const res = await HttpService.client.markPrivateMessageAsRead(form);
    this.findAndUpdateMessage(res);
  }

  async handleMessageReport(form: CreatePrivateMessageReport) {
    const res = await HttpService.client.createPrivateMessageReport(form);
    this.reportToast(res);
  }

  async handleCreateMessage(form: CreatePrivateMessage) {
    const res = await HttpService.client.createPrivateMessage(form);
    this.setState(s => {
      if (s.messagesRes.state == "success" && res.state == "success") {
        s.messagesRes.data.private_messages.unshift(
          res.data.private_message_view
        );
      }

      return s;
    });
  }

  findAndUpdateMessage(res: RequestState<PrivateMessageResponse>) {
    this.setState(s => {
      if (s.messagesRes.state === "success" && res.state === "success") {
        s.messagesRes.data.private_messages = editPrivateMessage(
          res.data.private_message_view,
          s.messagesRes.data.private_messages
        );
      }
      return s;
    });
  }

  purgeItem(purgeRes: RequestState<PurgeItemResponse>) {
    if (purgeRes.state == "success") {
      toast(i18n.t("purge_success"));
      this.context.router.history.push(`/`);
    }
  }

  reportToast(
    res: RequestState<PrivateMessageReportResponse | CommentReportResponse>
  ) {
    if (res.state == "success") {
      toast(i18n.t("report_created"));
    }
  }
}
