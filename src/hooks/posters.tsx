import React, {
  useState,
  useMemo,
  useCallback,
  useContext,
  createContext,
  useEffect,
} from "react";
import { VenueTemplate, PosterPageVenue, VenueEvent } from "types/venues";

import Fuse from "fuse.js";

import { tokeniseStringWithQuotesBySpaces } from "utils/text";
import { posterVenuesSelector } from "utils/selectors";
import { isEventLive } from "utils/event";
import { WithVenueId, WithId } from "utils/id";

import { isLoaded, useFirestoreConnect } from "./useFirestoreConnect";
import { useSelector } from "./useSelector";
import { useDebounceSearch } from "./useDebounceSearch";
import { useRelatedVenues } from "./useRelatedVenues";
import { useVenueEvents } from "./events";
import { useInterval } from "./useInterval";

import {
  DEFAULT_DISPLAYED_POSTER_PREVIEW_COUNT,
  POSTERHALL_SUBVENUE_STATUS_MS,
} from "settings";

import { useUser } from "hooks/useUser";

export const emptySavedPosters = {};

export const useConnectPosterVenues = (posterHallId: string) => {
  useFirestoreConnect(() => {
    return [
      {
        collection: "venues",
        where: [
          ["template", "==", VenueTemplate.posterpage],
          ["parentId", "==", posterHallId],
        ],
        storeAs: "posterVenues",
      },
    ];
  });
};

export const usePosterVenues = (posterHallId: string) => {
  useConnectPosterVenues(posterHallId);

  const posterVenues = useSelector(posterVenuesSelector);

  return useMemo(
    () => ({
      posterVenues: posterVenues ?? [],
      isPostersLoaded: isLoaded(posterVenues),
    }),
    [posterVenues]
  );
};

interface PostersContextState {
  posterVenues: WithId<PosterPageVenue>[];
  isPostersLoaded: boolean;
  hasHiddenPosters: boolean;
  searchInputValue: string;
  liveFilter: boolean;
  increaseDisplayedPosterCount: () => void;
  setSearchInputValue: (value: string) => void;
  setLiveFilter: (value: boolean) => void;
  bookmarkedFilter: boolean;
  setBookmarkedFilter: (value: boolean) => void;
}

export const usePosters = (posterHallId: string): PostersContextState => {
  const { posterVenues, isPostersLoaded } = usePosterVenues(posterHallId);

  const {
    searchInputValue,
    searchQuery,
    setSearchInputValue,
  } = useDebounceSearch();

  const [liveFilter, setLiveFilter] = useState<boolean>(false);
  const [displayedPostersCount, setDisplayedPostersAmount] = useState(
    DEFAULT_DISPLAYED_POSTER_PREVIEW_COUNT
  );

  const increaseDisplayedPosterCount = useCallback(() => {
    setDisplayedPostersAmount(
      (prevPostersNumber) =>
        prevPostersNumber + DEFAULT_DISPLAYED_POSTER_PREVIEW_COUNT
    );
  }, []);

  const liveFilteredPosterVenues = useMemo(
    () =>
      liveFilter
        ? posterVenues.filter((posterVenue) => posterVenue.isLive)
        : posterVenues,
    [posterVenues, liveFilter]
  );

  const [bookmarkedFilter, setBookmarkedFilter] = useState<boolean>(false);
  const { userWithId } = useUser();
  const userPosterIds = userWithId?.savedPosters ?? emptySavedPosters;

  const filteredPosterVenues = useMemo(
    () =>
      bookmarkedFilter
        ? liveFilteredPosterVenues.filter(
            (posterVenue) =>
              //@ts-ignore
              userPosterIds[posterVenue.id]?.[0] === posterVenue.id
          )
        : liveFilteredPosterVenues,
    [liveFilteredPosterVenues, bookmarkedFilter, userPosterIds]
  );

  // See https://fusejs.io/api/options.html
  const fuseVenues = useMemo(
    () =>
      new Fuse(filteredPosterVenues, {
        keys: [
          "name",
          "poster.title",
          "poster.authorName",
          "poster.categories",
          "poster.authors",
          "poster.keywords",
          "poster.introduction",
        ],
        threshold: 0.2, // 0.1 seems to be exact, default 0.6: brings too distant if anyhow related hits
        ignoreLocation: true, // default False: True - to search ignoring location of the words.
        findAllMatches: true,
      }),
    [filteredPosterVenues]
  );

  const searchedPosterVenues = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim();

    if (!normalizedSearchQuery) return filteredPosterVenues;

    const tokenisedSearchQuery = tokeniseStringWithQuotesBySpaces(
      normalizedSearchQuery
    );

    if (!tokenisedSearchQuery.length) return filteredPosterVenues;

    return fuseVenues
      .search({
        $and: tokenisedSearchQuery.map((searchToken: string) => {
          const orFields: Fuse.Expression[] = [
            { name: searchToken },
            { "poster.title": searchToken },
            { "poster.authorName": searchToken },
            { "poster.categories": searchToken },
            { "poster.authors": searchToken },
            { "poster.keywords": searchToken },
            { "poster.introduction": searchToken },
          ];

          return {
            $or: orFields,
          };
        }),
      })
      .map((fuseResult) => fuseResult.item);
  }, [searchQuery, fuseVenues, filteredPosterVenues]);

  const displayedPosterVenues = useMemo(
    () => searchedPosterVenues.slice(0, displayedPostersCount),
    [searchedPosterVenues, displayedPostersCount]
  );

  const hasHiddenPosters =
    searchedPosterVenues.length > displayedPosterVenues.length;

  return {
    posterVenues: displayedPosterVenues,
    isPostersLoaded,
    hasHiddenPosters,

    searchInputValue,
    liveFilter,
    bookmarkedFilter,

    increaseDisplayedPosterCount,
    setSearchInputValue,
    setLiveFilter,
    setBookmarkedFilter,
  } as PostersContextState;
};

export const PostersContext = createContext<PostersContextState | undefined>(
  undefined
);

export interface PostersProviderProps {
  venueId: string
}
export const PostersProvider: React.FC<PostersProviderProps> = ({
  venueId,
  children,
}) => (
  <PostersContext.Provider value={usePosters(venueId)}>
    {children}
  </PostersContext.Provider>
);

export const usePostersContext = (): PostersContextState => {
  const postersContextState = useContext(PostersContext);

  if (!postersContextState) {
    throw new Error(
      "<PostersContext/> not found. Did you forget to include it in your component hierarchy?"
    );
  }

  return postersContextState;
};

export const filterLiveEvents = (
  nonPosterSubVenueEvents: WithVenueId<VenueEvent>[]
) => nonPosterSubVenueEvents.filter((event) => isEventLive(event));

export const useLiveEventNonPosterSubVenues = (posterHallId: string) => {
  const { relatedVenues } = useRelatedVenues({
    currentVenueId: posterHallId,
  });

  const nonPosterSubVenueIds = useMemo(
    () =>
      relatedVenues
        .filter(
          (relatedVenue) =>
            relatedVenue.parentId === posterHallId &&
            relatedVenue.template !== VenueTemplate.posterpage
        )
        .map((venue) => venue.id),
    [relatedVenues, posterHallId]
  );

  const { events: nonPosterSubVenueEvents, isEventsLoading } = useVenueEvents({
    venueIds: nonPosterSubVenueIds,
  });

  const [
    liveNonPosterSubVenueEvents,
    setLiveNonPosterSubVenueEvents,
  ] = useState<WithVenueId<VenueEvent>[]>();

  const updateLiveEvents = useCallback(() => {
    if (isEventsLoading) return;

    const filteredLiveEvents = filterLiveEvents(nonPosterSubVenueEvents);

    setLiveNonPosterSubVenueEvents(filteredLiveEvents);
  }, [nonPosterSubVenueEvents, isEventsLoading]);

  useEffect(() => updateLiveEvents(), [updateLiveEvents]);

  useInterval(() => {
    updateLiveEvents();
  }, POSTERHALL_SUBVENUE_STATUS_MS);

  return {
    liveNonPosterSubVenueEvents,
  };
};
