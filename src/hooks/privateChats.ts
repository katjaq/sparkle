import { useCallback, useEffect, useMemo, useState } from "react";

import {
  sendPrivateMessage,
  setChatMessageRead,
  deletePrivateMessage,
} from "api/chat";

import { useChatSidebarControls } from "hooks/chatSidebar";

import { privateChatMessagesSelector } from "utils/selectors";
import {
  chatSort,
  buildMessage,
  getPreviewChatMessageToDisplay,
  getMessageToDisplay,
  getPreviewChatMessage,
} from "utils/chat";
import { WithId, withId } from "utils/id";

import { PreviewChatMessageMap, PrivateChatMessage } from "types/chat";
import { ChatTypes } from "types/chat";

import { isLoaded, useFirestoreConnect } from "./useFirestoreConnect";
import { useSelector } from "./useSelector";
import { useUser } from "./useUser";
import { useRecentWorldUsers, useWorldUsersById } from "./users";
import useSound from "use-sound";
import { NEW_MESSAGE_SOUND } from "settings";

export const useConnectPrivateChatMessages = () => {
  const { user } = useUser();

  useFirestoreConnect(() => {
    if (!user?.uid) return [];

    return [
      {
        collection: "privatechats",
        doc: user.uid,
        subcollections: [{ collection: "chats" }],
        storeAs: "privateChatMessages",
      },
    ];
  });
};

export const usePrivateChatMessages = () => {
  useConnectPrivateChatMessages();

  const privateChatMessages = useSelector(privateChatMessagesSelector);
  const { user } = useUser();
  const userId = user?.uid;

  const { chatSettings } = useChatSidebarControls();

  const [play] = useSound(NEW_MESSAGE_SOUND, {
    // `interrupt` ensures that if the sound starts again before it's
    // ended, it will truncate it. Otherwise, the sound can overlap.
    interrupt: true,
  });

  const [privateChatMessagesState, setPrivateChatMessagesState] = useState(
    privateChatMessages
  );

  const chatWithUser =
    chatSettings.openedChatType === ChatTypes.PRIVATE_CHAT
      ? chatSettings.recipientId
      : undefined;

  useEffect(() => {
    const newMessage = privateChatMessages?.filter(
      ({ id: id1 }) =>
        !privateChatMessagesState?.some(({ id: id2 }) => id2 === id1)
    );

    if (privateChatMessagesState === undefined) {
      setPrivateChatMessagesState(privateChatMessages);
    }

    if (
      privateChatMessages !== undefined &&
      privateChatMessagesState !== undefined &&
      newMessage !== undefined &&
      newMessage.length !== 0 &&
      privateChatMessages.length !== privateChatMessagesState.length &&
      !newMessage[0].isRead &&
      newMessage[0].from !== userId
    ) {
      setPrivateChatMessagesState(privateChatMessages);

      if (chatWithUser === undefined) {
        play();
      } else if (chatWithUser !== newMessage[0].from) {
        play();
      }
    }
  }, [
    privateChatMessages,
    chatWithUser,
    play,
    privateChatMessagesState,
    userId,
  ]);

  return useMemo(
    () => ({
      privateChatMessages: privateChatMessages ?? [],
      isUserPrivateChatsLoaded: isLoaded(privateChatMessages),
    }),
    [privateChatMessages]
  );
};

export const usePrivateChatPreviews = () => {
  const { user } = useUser();
  const { worldUsersById } = useWorldUsersById();
  const {
    privateChatMessages,
    isUserPrivateChatsLoaded,
  } = usePrivateChatMessages();

  const userId = user?.uid;

  const privateChatPreviewsMap = useMemo(
    () =>
      privateChatMessages.reduce<PreviewChatMessageMap>((acc, message) => {
        if (!userId) return acc;

        const { from: fromUserId, to: toUserId } = message;

        // Either `from` author or `to` author is Me. Filter me out
        const counterPartyUserId =
          fromUserId === userId ? toUserId : fromUserId;

        const counterPartyUser = worldUsersById[counterPartyUserId];

        // Filter out not existent users
        if (!counterPartyUser) return acc;

        if (counterPartyUserId in acc) {
          const previousMessage = acc[counterPartyUserId];

          // If the message is older, replace it with the more recent one
          if (previousMessage.ts_utc > message.ts_utc) return acc;

          return {
            ...acc,
            [counterPartyUserId]: getPreviewChatMessage({
              message,
              user: withId(counterPartyUser, counterPartyUserId),
            }),
          };
        }

        return {
          ...acc,
          [counterPartyUserId]: getPreviewChatMessage({
            message,
            user: withId(counterPartyUser, counterPartyUserId),
          }),
        };
      }, {}),
    [privateChatMessages, userId, worldUsersById]
  );

  return useMemo(
    () => ({
      privateChatPreviews: Object.values(privateChatPreviewsMap)
        .sort(chatSort)
        .map((message) =>
          getPreviewChatMessageToDisplay({ message, myUserId: userId })
        ),
      isPrivateChatPreviewsLoaded: isUserPrivateChatsLoaded,
    }),
    [privateChatPreviewsMap, userId, isUserPrivateChatsLoaded]
  );
};

export const useOnlineUsersToDisplay = () => {
  const { recentWorldUsers } = useRecentWorldUsers();
  const { user } = useUser();

  const userId = user?.uid;

  // Filter out self
  return useMemo(() => recentWorldUsers.filter((user) => user.id !== userId), [
    recentWorldUsers,
    userId,
  ]);
};

export const useNumberOfUnreadChats = () => {
  const { user } = useUser();
  const { privateChatPreviews } = usePrivateChatPreviews();

  const userId = user?.uid;

  return useMemo(
    () =>
      privateChatPreviews.filter(
        (chatPreview) => !chatPreview.isRead && chatPreview.from !== userId
      ).length,
    [privateChatPreviews, userId]
  );
};

export const useRecipientChat = (recipientId: string) => {
  const { worldUsersById } = useWorldUsersById();
  const { privateChatMessages } = usePrivateChatMessages();
  const { user } = useUser();

  const userId = user?.uid;
  const recipient = worldUsersById[recipientId];

  const sendMessageToSelectedRecipient = useCallback(
    (text: string) => {
      if (!userId) return;

      const message = buildMessage<PrivateChatMessage>({
        from: userId,
        text,
        to: recipientId,
      });

      sendPrivateMessage(message);
    },
    [userId, recipientId]
  );

  const messagesToDisplay = useMemo(
    () =>
      privateChatMessages
        .filter(
          (message) =>
            message.deleted !== true &&
            (message.to === recipientId || message.from === recipientId)
        )
        .sort(chatSort)
        .map((message) =>
          getMessageToDisplay<WithId<PrivateChatMessage>>({
            message,
            usersById: worldUsersById,
            myUserId: userId,
          })
        ),
    [privateChatMessages, recipientId, worldUsersById, userId]
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!userId) return;

      deletePrivateMessage({ userId, messageId });
    },
    [userId]
  );

  const markMessageRead = useCallback(
    (messageId: string) => {
      if (!userId) return;

      setChatMessageRead({ userId, messageId });
    },
    [userId]
  );

  return {
    sendMessageToSelectedRecipient,
    deleteMessage,
    markMessageRead,
    messagesToDisplay,
    recipient,
  };
};
