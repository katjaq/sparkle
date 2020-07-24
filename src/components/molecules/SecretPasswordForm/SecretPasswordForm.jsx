import React, { useState } from "react";
import { useFirebase } from "react-redux-firebase";
import { useParams } from "react-router-dom";
import "./SecretPasswordForm.scss";

const SecretPasswordForm = ({ buttonText = "Join the party" }) => {
  const firebase = useFirebase();
  const { venueId } = useParams();

  const [invalidPassword, setInvalidPassword] = useState();
  const [error, setError] = useState();
  const [password, setPassword] = useState();
  const [message, setMessage] = useState();

  function passwordChanged(e) {
    setPassword(e.target.value);
    setInvalidPassword(false);
    setError(false);
  }

  function passwordSubmitted(e) {
    e.preventDefault();
    setMessage("Checking password...");

    const checkPassword = firebase.functions().httpsCallable("checkPassword");
    checkPassword({ config: venueId, password: password })
      .then(() => {
        setInvalidPassword(false);
        setMessage("Password OK! Proceeding...");

        firebase
          .auth()
          .signInAnonymously()
          // window.location forces the reload so a request is sent to firebase to retrieve the users
          // if we use history.push, the users are never fetched and the application keeps on repeating the Account creation flow
          .then(() => (window.location = `/login?venueId=${venueId}`))
          .catch((error) => {
            setError(true);
          });
      })
      .catch(() => {
        setInvalidPassword(true);
        setMessage(null);
      });
  }

  return (
    <form className="secret-password-form" onSubmit={passwordSubmitted}>
      <p className="small-text">
        Got an invite? Join in with the secret password
      </p>
      <input
        className={
          "secret-password-input " + (invalidPassword ? " is-invalid" : "")
        }
        required
        placeholder="password"
        autoFocus
        onChange={passwordChanged}
        id="password"
      />
      <input
        className="btn btn-primary btn-block btn-centered"
        type="submit"
        value={buttonText}
      />
      <div className="form-group">
        {message && <small>{message}</small>}
        {invalidPassword && (
          <small className="error-message">Wrong password!</small>
        )}
        {error && <small className="error-message">An error occured</small>}
      </div>
    </form>
  );
};

export default SecretPasswordForm;
