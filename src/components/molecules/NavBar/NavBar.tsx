import React, { useState, useMemo } from "react";
import firebase from "firebase/app";
import "./NavBar.scss";
import "./playa.scss";
import { Link } from "react-router-dom";
import { faTicketAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { isChatValid } from "validation";
import { OverlayTrigger, Popover } from "react-bootstrap";
import PrivateChatModal from "components/organisms/PrivateChatModal";
import { ProfilePopoverContent } from "components/organisms/ProfileModal";
import UpcomingTickets from "components/molecules/UpcomingTickets";
import { useUser } from "hooks/useUser";
import AuthenticationModal from "components/organisms/AuthenticationModal";
import {
  DEFAULT_PROFILE_IMAGE,
  SPARKLEVERSE_LOGO_URL,
  PLAYA_VENUE_NAME,
  DEFAULT_REDIRECT_URL,
} from "settings";
import { useSelector } from "hooks/useSelector";
import OnlineStats from "../OnlineStats";

interface PropsType {
  redirectionUrl?: string;
}

const NavBar: React.FunctionComponent<PropsType> = ({ redirectionUrl }) => {
  const { user, profile } = useUser();
  const { venue, privateChats } = useSelector((state) => ({
    venue: state.firestore.data.currentVenue,
    privateChats: state.firestore.ordered.privatechats,
  }));

  const now = firebase.firestore.Timestamp.fromDate(new Date());
  const futureUpcoming =
    venue?.events?.filter((e) => e.ts_utc.valueOf() > now.valueOf()) ?? []; //@debt typing does this exist?

  const hasUpcomingEvents = futureUpcoming && futureUpcoming.length > 0;

  const [isAuthenticationModalOpen, setIsAuthenticationModalOpen] = useState(
    false
  );

  const ticketsPopover = (
    <Popover id="popover-basic">
      <Popover.Content>
        <UpcomingTickets events={futureUpcoming} />
      </Popover.Content>
    </Popover>
  );

  const chatPopover = (
    <Popover id="popover-basic">
      <Popover.Content>
        <PrivateChatModal />
      </Popover.Content>
    </Popover>
  );

  const profilePopover = (
    <Popover id="profile-popover">
      <Popover.Content>
        <ProfilePopoverContent />
      </Popover.Content>
    </Popover>
  );

  const numberOfUnreadMessages = useMemo(() => {
    return (
      privateChats &&
      user &&
      privateChats
        .filter(isChatValid)
        .filter((chat) => chat.to === user.uid && chat.isRead === false).length
    );
  }, [privateChats, user]);

  return (
    <>
      <header>
        <div className="navbar navbar_playa">
          <div className="navbar-container">
            <div className="navbar-logo">
              <Link to={redirectionUrl || "/"}>
                <img
                  src={SPARKLEVERSE_LOGO_URL}
                  alt="Logo"
                  className="logo-img"
                />
              </Link>
              <div className="button-container create-button-container">
                <Link to="/admin" className="create-button">
                  Create/Edit
                </Link>
              </div>
            </div>
            {user ? (
              <>
                {venue?.name === PLAYA_VENUE_NAME ? (
                  <div className="navbar-dropdown-middle">
                    <OnlineStats />
                  </div>
                ) : (
                  <span
                    onClick={() =>
                      (window.location.href = DEFAULT_REDIRECT_URL)
                    }
                    className="playa-link"
                  >
                    Go to playa
                  </span>
                )}
                <div className="navbar-links" style={{ width: 500 }}>
                  {hasUpcomingEvents && (
                    <OverlayTrigger
                      trigger="click"
                      placement="bottom-end"
                      overlay={ticketsPopover}
                      rootClose={true}
                    >
                      <span className="tickets-icon">
                        <FontAwesomeIcon icon={faTicketAlt} />
                      </span>
                    </OverlayTrigger>
                  )}
                  {profile && (
                    <OverlayTrigger
                      trigger="click"
                      placement="bottom-end"
                      overlay={chatPopover}
                      rootClose={true}
                    >
                      <span className="private-chat-icon">
                        {!!numberOfUnreadMessages &&
                          numberOfUnreadMessages > 0 && (
                            <div className="notification-card">
                              {numberOfUnreadMessages}
                            </div>
                          )}
                        <div className="navbar-link-message"></div>
                      </span>
                    </OverlayTrigger>
                  )}
                  <OverlayTrigger
                    trigger="click"
                    placement="bottom-end"
                    overlay={profilePopover}
                    rootClose={true}
                  >
                    <div className="navbar-link-profile">
                      <img
                        src={profile?.pictureUrl || DEFAULT_PROFILE_IMAGE}
                        className="profile-icon"
                        alt="avatar"
                        width="40"
                        height="40"
                      />
                    </div>
                  </OverlayTrigger>
                </div>
              </>
            ) : (
              <div
                className="log-in-button"
                style={{ marginTop: "20px" }}
                onClick={() => setIsAuthenticationModalOpen(true)}
              >
                Log in
              </div>
            )}
          </div>
        </div>
      </header>
      <AuthenticationModal
        show={isAuthenticationModalOpen}
        onHide={() => setIsAuthenticationModalOpen(false)}
        showAuth="login"
      />
    </>
  );
};

export default NavBar;
