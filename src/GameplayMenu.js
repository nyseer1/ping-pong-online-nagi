import './components/TitleScreen.css';
import { Outlet, Link } from "react-router-dom";



function GameplayMenu () {
  return (
    <>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Gameplay Menu</title>
        <link rel="stylesheet" type="text/css" href="TitleScreen.css" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65" crossOrigin="anonymous"></link>

      </head>
      <div className="background-menu">
      
        <div className="App-header">

          {/* play button with embedded link */}
          <Link to={`../Gameplay`}><button className="button">P1 VS. CPU</button></Link>
        
          {/* back button */}
      <div className="back">
          <Link to={`../`}><button className="button">Home</button></Link>
      </div>  
        </div>
        
      </div>
    </>
  );
}



export default GameplayMenu;