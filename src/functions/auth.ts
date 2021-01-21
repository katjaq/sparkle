import firebase from "firebase/app";
import { accessTokenKey } from "utils/localStorage";

type CheckAccessTypes = {
  venueId: string;
  password?: string;
  email?: string;
  code?: string;
  token?: string;
};

export const checkAccess = async (data: CheckAccessTypes) =>
  await firebase.functions().httpsCallable("access-checkAccess")(data);

export const setLocalStorageToken = (venueId: string, token: string) =>
  localStorage.setItem(accessTokenKey(venueId), token);

export const getLocalStorageToken = (venueId: string) =>
  localStorage.getItem(accessTokenKey(venueId));
