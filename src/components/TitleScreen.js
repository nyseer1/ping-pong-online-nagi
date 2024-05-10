import './TitleScreen.css';
import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";

function TitleScreen() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate(); // Hook for programmatic navigation

  const handlePlay = () => {
    if (username) {
      navigate("/Lobby", { state: { username } }); // Pass username to Lobby
    } else {
      alert("Please enter a username.");
    }
  };

  return (
    <>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Title Screen</title>
        <link rel="stylesheet" type="text/css" href="TitleScreen.css" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65" crossOrigin="anonymous"></link>
      </head>
      <div className="title-screen">
        <div className="App-background">
          <div className="App-header">
            <label htmlFor="username">Enter Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <button className="button" onClick={handlePlay}>Play!</button>
          </div>
        </div>
      </div>
    </>
  );
}

export default TitleScreen;
