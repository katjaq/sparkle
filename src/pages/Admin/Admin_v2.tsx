import React, { useMemo, useState } from "react";
import "firebase/storage";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";

// Components
import AuthenticationModal from "components/organisms/AuthenticationModal";
import WithNavigationBar from "components/organisms/WithNavigationBar";
import VenueDetails from "./Venue/Details";

// Hooks
import { useSelector } from "hooks/useSelector";
import { useUser } from "hooks/useUser";
import useRoles from "hooks/useRoles";

// Styles
import "./Admin.scss";
import { IS_BURN } from "secrets";
import { Venue_v2 } from "types/Venue";
import { AuthOptions } from "components/organisms/AuthenticationModal/AuthenticationModal";
import AdminSidebar from "./Sidebar/Sidebar";
import { useVenueId } from "hooks/useVenueId";
import { orderedVenuesSelector } from "utils/selectors";
import { useAdminVenues } from "hooks/useAdminVenues";
import BasicInfo from "./BasicInfo";
import EntranceExperience from "./EntranceExperience";
import AdvancedSettings from "./AdvancedSettings";
import TicketingAndAccess from "./TicketingAndAccess";

import * as S from "./Admin.styles";

dayjs.extend(advancedFormat);

export type SidebarOption = {
  id: string;
  text: string;
};
enum SidebarOptions {
  dashboard = "dashboard",
  basicInfo = "basic_info",
  entranceExperience = "entrance_experience",
  advancedMapSettings = "advanced_map_settings",
  ticketingAndAccess = "ticketing_and_access",
}
const sidebarOptions: SidebarOption[] = [
  {
    id: SidebarOptions.dashboard,
    text: "Dashboard",
  },
  {
    id: SidebarOptions.basicInfo,
    text: "Basic info",
  },
  {
    id: SidebarOptions.entranceExperience,
    text: "Entrance experience",
  },
  {
    id: SidebarOptions.advancedMapSettings,
    text: "Advanced map settings",
  },
  {
    id: SidebarOptions.ticketingAndAccess,
    text: "Ticketing and access",
  },
];

const Admin_v2: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState(sidebarOptions[2].id);

  const { user } = useUser();
  const venues = useSelector(orderedVenuesSelector);
  const venueId = useVenueId();

  useAdminVenues(user!.uid);
  const selectedVenue = useMemo(() => venues?.find((v) => v.id === venueId), [
    venueId,
    venues,
  ]);

  const { roles } = useRoles();

  if (!venues || !roles) {
    return <>Loading...</>;
  }

  if (!IS_BURN && !roles.includes("admin")) {
    return <>Forbidden</>;
  }

  const renderVenueView = () => {
    switch (selectedOption) {
      case SidebarOptions.dashboard:
        return <VenueDetails venue={selectedVenue as Venue_v2} />; // Venue_v2 is incomplete with typing (lags behind latest Venue)

      case SidebarOptions.basicInfo:
        return <BasicInfo />;

      case SidebarOptions.entranceExperience:
        return <EntranceExperience venue={selectedVenue as Venue_v2} onSave={() => setSelectedOption(sidebarOptions[0].id)} />;

      case SidebarOptions.advancedMapSettings:
        return <AdvancedSettings venue={selectedVenue as Venue_v2} />;

      case SidebarOptions.ticketingAndAccess:
        return <TicketingAndAccess />;

      default:
        return null;
    }
  };

  return (
    <WithNavigationBar fullscreen>
      <S.Wrapper>
        <AdminSidebar
          sidebarOptions={sidebarOptions}
          selected={selectedOption}
          onClick={setSelectedOption}
        />

        <S.ViewWrapper>
          {selectedVenue ? (
            renderVenueView()
          ) : (
            <span className="no-venue-selected">
              Select a venue to see its details
            </span>
          )}
        </S.ViewWrapper>
      </S.Wrapper>

      <AuthenticationModal
        show={!user}
        onHide={() => {}}
        showAuth={AuthOptions.login}
      />
    </WithNavigationBar>
  );
};

export default Admin_v2;
