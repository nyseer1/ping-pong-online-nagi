import React, { useEffect, useRef, useState, useLayoutEffect, startTransition } from 'react';
import { Outlet, Link, useLocation } from "react-router-dom";
import { debounce } from 'lodash';
import io from 'socket.io-client';
import './index.css';
import './Gameplay.css';
import { is } from '@babel/types';

const { num } = require('./components/difiiculty.js');

//stores difficulty setting temporarily for pause feature
var temp = "";

var paused = false;
var hitCount = 0;

const Gameplay = () => {
    const [time, setTime] = useState(5);
    const [visible, setVisible] = useState(true);
    const [gameActive, setGameActive] = useState(false);
    const [countdownActive, setCountdownActive] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);

    const location = useLocation(); // get mode from lobby
    const { role } = location.state || 'joiner';//default to joiner
    const mode = location.state?.mode || 'multiplayer';//default to multiplayer
    const urlRoomId = location.pathname.split('/')[2];
    const [roomId, setRoomId] = useState(urlRoomId);// get room id from url
    const [isCPUmode, setIsCPUMode] = useState(mode === 'cpu');
    const [ready, setReady] = useState(false);

    const socket = useRef(null);// socket connection
    const canvasRef = useRef();// set up canvas 

    const [gameState, setGameState] = useState({
        ballX: 500, ballY: 300, paddle1Y: 350, paddle2Y: 350,
        player1Score: 0, player2Score: 0, winner: false
    });

    const animationFrameId = useRef(null);

    useEffect(() => {
        const countdownInterval = setInterval(updateCountdown, 1000);
        return () => clearInterval(countdownInterval); // Clear interval on component unmount
    }, [ready]);

    // Visibility on difficulty buttons
    useEffect(() => {
        document.addEventListener('keydown', detectKeyDown, true)
    }, [])

    const detectKeyDown = (e) => {
        console.log("key clicked " + e.key);
        // console.log("pausing game now");
        if(e.key == "p" && num.dif != "off"){
            handlePause();
        }

    }

    useEffect(() => {
        const newSocket = io('http://localhost:4000');
        socket.current = newSocket;
        // console.log("Socket initialized and connecting...");
        // console.log("Mode in useEffect:", mode);

        newSocket.on('connect', () => {
            if (isCPUmode) {
                console.log("CPU mode activated");
            } else {
                console.log('Connected to server. Socket ID:', newSocket.id); // This should log a valid socket ID
                newSocket.emit('joinRoom', roomId);
            }
        });

        newSocket.on('cpuGameStarted', ({ roomId }) => {
            console.log(`CPU game started in room: ${roomId}`);
            setRoomId(roomId);
            setCountdownActive(true); // Activate the game
            // Use roomId for game management
        });

        newSocket.on('playerReady', () => {
            console.log("Acknowledged player ready from server.");
            setReady(true);
        });

        // Listen for player count updates
        newSocket.on('playerCount', ({ count }) => {
            console.log(`Number of players in room: ${count}`);
        });

        newSocket.on('stopCountdown', () => {
            console.log("Countdown stopped by server.");
            setCountdownActive(false); // Stop the countdown
            setTime(5); // Reset the countdown
        });


        // Listen for game updates
        newSocket.on('gameUpdate', (newGameState) => {
            setGameState(newGameState);
            if (newGameState.player1Score >= WINNING_SCORE || newGameState.player2Score >= WINNING_SCORE) {
                console.log("Setting winner to true");
                setWinner(true); // Set winner to true to show the replay button
                setGameActive(false); //turn the game back off
            }
        });

        return () => {
            newSocket.off('cpuGameStarted');
            newSocket.off('playerCount');
            newSocket.off('playerReady');
            newSocket.off('startCountdown');
            newSocket.off('stopCountdown');
            newSocket.off('gameUpdate');
            newSocket.disconnect();
        };
    }, [isCPUmode]);

    useEffect(() => {
        let interval = null;
        let gameStarted = false;

        if (countdownActive) {
            interval = setInterval(() => {
                setTime((prevTime) => {
                    const newTime = prevTime - 1;
                    if (newTime > 0) {
                        return newTime;  // Continue countdown
                    } else {
                        clearInterval(interval); // Stop the interval at zero
                        if (!gameStarted) {
                            console.log("Countdown finished. Game should start now.");
                            setGameActive(true); // Activate the game
                            setCountdownActive(false); // Deactivate the countdown
                            if (roomId) {
                                console.log("Emitting startGame with roomId:", roomId);
                                socket.current.emit('startGame', roomId);
                                gameStarted = true;
                            } else {
                                console.log("Room ID not defined. Cannot start game.");
                            }
                        }
                        // Signal the server to start the game
                        return 0;  // Keep at zero until reset
                    }
                });
            }, 1000);
        } else {
            clearInterval(interval);
            setTime(5); // Reset the countdown if not active
        }

        return () => clearInterval(interval); // Cleanup interval on component unmount
    }, [countdownActive, roomId, setGameActive, setTime]);



    // Listen for countdown start signal from the server
    useEffect(() => {
        const handleStartCountdown = () => {
            console.log("Countdown started by server.");
            setCountdownActive(true);
            setTime(5);  // Reset the countdown time
        };

        socket.current.on('startCountdown', handleStartCountdown);

        return () => {
            socket.current.off('startCountdown', handleStartCountdown);
        };
    }, []);

    const handleReady = () => {
        if (socket.current) {
            console.log('Ready button clicked by', socket.current.id);
            setPlayerReady(true);
            socket.current.emit('playerReady', roomId);
        } else {
            console.log("socket not initialized");
        }
    };

    function updateCountdown() {
        if (ready && playerReady) {
            setTime(currentTime => {
                if (currentTime > 1) {
                    setVisible(false); // Hide the buttons as countdown proceeds
                    return currentTime - 1;
                } else {
                    // Countdown has finished, start the game
                    num.dif = temp; // Set the difficulty
                    setGameActive(true); // Activate the game
                }
            });
        }
    }

    const activateCountdown = (difficulty) => {
        console.log('startCPUGame with difficulty:', difficulty)
        setVisible(false); // Hide difficulty buttons during countdown
        setGameActive(false);
        setTime(5);
        temp = difficulty;
        setCountdownActive(true);

        // Emit an event to the server to initialize the CPU game with the selected difficulty
        socket.current.emit('startCPUGame', { difficulty });

    }

    // Debounced function for emitting paddle movements
    const emitPaddleMove = useRef(debounce((y, roomId, paddle) => {
        //console.log("Emitting Paddle Move:", { y, roomId, paddle });
        if (isCPUmode && paddle === 'right') {
            // In CPU mode, do not emit movements for the right paddle
            return;
        }
        socket.current.emit('paddleMove', { y, roomId, paddle });
    }, 5)).current;

    // set replay button
    const buttonReplay = useRef();

    // frame counter
    const [counter, setCounter] = useState(0);

    // table width and height
    const TABLE_WIDTH = 1000;
    const TABLE_HEIGHT = 600;


    //ball speed and cpu speed modifier for difficulties
    var speedModifier = 0;
    var accuracy = 0;

    // ball x and y positions; vertical and horizontaly speed
    const [ballX, setBallX] = useState(500);
    const [ballY, setBallY] = useState(300);
    const [ballSpeedX, setBallSpeedX] = useState(15);
    const [ballSpeedY, setBallSpeedY] = useState(15);

    // paddles for player 1 and 2; constant paddle size
    const [paddle1Y, setPaddle1Y] = useState(350);
    const [paddle2Y, setPaddle2Y] = useState(350);
    const PADDLE_HEIGHT = 100; //starts from top then adds to bottom
    const PADDLE_THICKNESS = 10;

    // mouse movement
    const [mousePosition, setMousePosition] = useState({ x: null, y: null });

    // player scoring; winning score is 3
    const [player1Score, setPlayer1Score] = useState(0);
    const [player2Score, setPlayer2Score] = useState(0);
    const [winner, setWinner] = useState(false);
    const WINNING_SCORE = 3;

    // function for ball movement
    const ballMovement = () => {
        // sets ball velocity
        if (num.dif != "off") {
            setBallX(x => x += ballSpeedX * speedModifier + hitCount / 4);
            setBallY(y => y += ballSpeedY * speedModifier + hitCount / 4);
        }
    };
    const collision = () => {
        console.log("collision in gameplay");
        // when ball reaches top or bottom of screen, reverse direction
        if (ballY + ballSpeedY < 0 || ballY + ballSpeedY > TABLE_HEIGHT) {
            setBallSpeedY(-ballSpeedY);
        }

        // when ball collides with cpu. (if the ballY is at the same height as the top of the cpu paddle or lower,
        //and ballY at the same height as the bottom of the cpu paddle or higher, then collide with it,
        //+ or - 20 to the paddle height range to add leniency to the collision tracking)
        //
        if (ballX > TABLE_WIDTH && ballY >= paddle2Y - 30 && ballY <= paddle2Y + PADDLE_HEIGHT + 30) {
            setBallX(x => x - 20);
            setBallSpeedX(speedX => speedX * -1);
            let deltaY = ballY - (paddle2Y + PADDLE_HEIGHT / 2);
            setBallSpeedY(deltaY * (Math.random() < 0.5 ? -.5 : .5));
            hitCount++;
        }
        //when ball collides with player, same logic as cpu collision 
        else if (ballX < 0 && ballY > paddle1Y - 30 && ballY < paddle1Y + PADDLE_HEIGHT + 40) {
            setBallX(x => x + 20);
            setBallSpeedX(speedX => speedX * -1);
            let deltaY = ballY - (paddle1Y + PADDLE_HEIGHT / 2);
            setBallSpeedY(deltaY * (Math.random() < 0.5 ? -.5 : .5));

            hitCount++;
        }

        //when ball reaches left or right edge, add a point and reset
        else if (ballX < 0) {
            setPlayer2Score(s => s + 1);
            ballReset();
            hitCount = 0;
        }
        else if (ballX > TABLE_WIDTH) {
            setPlayer1Score(s => s + 1);
            ballReset();
            hitCount = 0;
        }
    }
    // when wall collision occurs
    const ballReset = () => {
        setBallX(500);
        setBallY(300);
        setBallSpeedX(-ballSpeedX);
    }

    //computer movement
    const computerMovement = () => {
        if (isCPUmode) {
            // Check which difficulty is selected and adjust the CPU paddle movement accordingly
            switch (num.dif) {
                case "easy":
                    moveCPUPaddle(0.3, 0.3); // Lower speed and accuracy for easy mode
                    break;
                case "normal":
                    moveCPUPaddle(0.43, 0.2); // Medium speed and accuracy for normal mode
                    break;
                case "hard":
                    moveCPUPaddle(0.7, 0.1); // Higher speed and accuracy for hard mode
                    break;
                default:
                    // Default behavior if no difficulty is selected
                    moveCPUPaddle(0.3, 0.3); // You can adjust these values as needed
            }
        }
    };

    const moveCPUPaddle = (speedModifier, accuracy) => {
        // Implement the logic to move the CPU paddle based on the ball's position and the given speed and accuracy
        const paddleCenter = paddle2Y + PADDLE_HEIGHT / 2;
        if (ballY > paddleCenter && Math.random() < accuracy) {
            setPaddle2Y(y => Math.min(y + speedModifier * 5, TABLE_HEIGHT - PADDLE_HEIGHT));
        } else if (ballY < paddleCenter && Math.random() < accuracy) {
            setPaddle2Y(y => Math.max(y - speedModifier * 5, 0));
        }
    };


    const replay = () => {
        if (winner) {
            setPlayer1Score(0);
            setPlayer2Score(0);
            setWinner(false);
            num.dif = "off";
            activateCountdown(temp);

            socket.current.emit('requestReplay', roomId);
        }

    };

    const replayChangeDif = () => {
        if (winner) {
            setPlayer1Score(0);
            setPlayer2Score(0);
            setWinner(false);
            num.dif = "off";
            setVisible(false);
            socket.current.emit('requestReplay', roomId);
        }
    }

    const handlePause = () => {
        paused = !paused;
        console.log("paused " + paused);
        if (!paused) {
            console.log("Game resumed with difficulty:", temp);
            activateCountdown(temp); // Resume with the previous difficulty setting
        } else {
            temp = num.dif; // Save the current difficulty setting before pausing
            num.dif = "off";
            console.log("Game paused, difficulty was:", temp);
        }

        // Send pause/resume signal to server
        socket.current.emit('togglePause', roomId, paused);

    }

    // used to animate canvas and sets frame counter
    useLayoutEffect(() => {
        let timerId;
        const animate = () => {
            setCounter(c => c + 1);
            timerId = requestAnimationFrame(animate);
            if (winner) cancelAnimationFrame(timerId);
        };
        timerId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(timerId);
    }, [winner])

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        canvas.width = TABLE_WIDTH;
        canvas.height = TABLE_HEIGHT;

        // Draw the static parts of the game board
        context.fillStyle = '#00A650'; // Green table
        context.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

        context.fillStyle = '#FFFFFF'; // White net
        for (let i = 0; i < TABLE_HEIGHT; i += 30) {
            context.fillRect(TABLE_WIDTH / 2 - 1, i, 2, 15);
        }
    }, []);

    //draw canvas
    useEffect(() => {
        if (!gameActive) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // //function to draw the game
        const drawGame = () => {
            context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

            //Draw the static and dynamic elements
            drawStaticElements(context);
            drawDynamicElements(context);

            animationFrameId.current = requestAnimationFrame(drawGame);
        };

        drawGame();

        // player movement
        const updateMousePosition = event => {
            //console.log("updateMousePosition");
            const rect = canvas.getBoundingClientRect();
            const newY = event.clientY - rect.top;
            const adjustedY = Math.max(0, Math.min(newY - PADDLE_HEIGHT / 2, TABLE_HEIGHT - PADDLE_HEIGHT));
            if (!isCPUmode) {
                // In multiplayer mode, emit paddle movement to the server
                emitPaddleMove(newY, roomId, role === 'creator' ? 'left' : 'right');
            } else {
                // In CPU mode, directly update the paddle position without emitting to the server
                emitPaddleMove(adjustedY, roomId, 'left');
            }
        };
        canvas.addEventListener('mousemove', updateMousePosition);
        return () => {
            cancelAnimationFrame(animationFrameId);
            canvas.removeEventListener('mousemove', updateMousePosition);
        };

    }, [gameState, paddle1Y, roomId, role, emitPaddleMove, isCPUmode, gameActive]);

    useEffect(() => {
        if (player1Score >= WINNING_SCORE || player2Score >= WINNING_SCORE) {
            setWinner(true);
            cancelAnimationFrame(animationFrameId.current);
        }
    }, [player1Score, player2Score]);

    const drawStaticElements = (context) => {
        // Draw table and net
        context.fillStyle = '#00A650';
        context.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
        context.fillStyle = '#FFFFFF';
        for (let i = 0; i < TABLE_HEIGHT; i += 30) {
            context.fillRect(TABLE_WIDTH / 2, i, 2, 25);
        }
    };

    const drawDynamicElements = (context) => {
        // Draw paddles and ball
        context.fillRect(0, gameState.paddle1Y, PADDLE_THICKNESS, PADDLE_HEIGHT);
        context.fillRect(TABLE_WIDTH - PADDLE_THICKNESS, gameState.paddle2Y, PADDLE_THICKNESS, PADDLE_HEIGHT);
        context.beginPath();
        context.arc(gameState.ballX, gameState.ballY, 10, 0, Math.PI * 2, true);
        context.fill();
    };

    return (
        <div className="container">
            <div className="d-flex justify-content-between mt-5">
                {!countdownActive && !playerReady && !isCPUmode && (<button onClick={handleReady} >Ready</button>
                )}

            </div>
            {/* back button */}
            <div className="back">
                {/* testing buttons */}
                <div className="d-flex justify-content-between mt-5"></div>
                <Link to={`../Lobby`}><button className="btn btn-home">Home</button></Link>
                <Link to="/">
                    <button className="btn btn-red">Quit</button>
                </Link>

                {/* Difficulty Buttons: Only show when in CPU mode */}
                {isCPUmode && !gameActive && visible && (
                    <div>
                        <header className="game-lobby-header">
                            <h1 className="game-lobby-title">Choose a difficulty</h1>
                        </header>
                        <div className="game-buttons">
                            <button className="btn btn-green" onClick={() => activateCountdown('easy')}>Easy</button>
                            <button className="btn btn-orange" onClick={() => activateCountdown('normal')}>Normal</button>
                            <button className="btn btn-red" onClick={() => activateCountdown('hard')}>Hard</button>
                        </div>
                        
                        <p>(Press any button to pause the game)</p>
                    </div>
                )}
            </div>

            {/* countdown */}
            {countdownActive && (
                <div className="centered">
                    <p id='countdown'>{time}</p>
                </div>
            )}

            <div className='score'>
                <h1>{gameState.player1Score}</h1>
                <h2 className='gameState.winner'> {winner ? 'Game over!' : ''} </h2>
                <h1>{gameState.player2Score}</h1>
            </div>

            {/* gameplay */}

            <div className="canvas-container">
                <canvas ref={canvasRef} />
            </div>


            {/* replay buttons */}
            {isCPUmode && winner && (
                <div className="d-flex justify-content-between mt-5">
                    {winner && <button className='btn btn-green' onClick={replay} ref={buttonReplay}>Replay?</button>}
                    {winner && <button className='btn btn-orange' onClick={replayChangeDif} ref={buttonReplay}>Change Difficulty</button>}
                </div>
            )}

            {/* pause buttons */}

            {isCPUmode && gameActive && (
                <div className="pause-buttons mt-5">
                    {!paused ? (
                        <button className='btn btn-purple lowered' onClick={handlePause}>Pause</button>
                    ) : (
                        <button className='btn btn-purple lowered' onClick={handlePause}>Resume</button>
                    )}
                </div>
            )}
        </div>
    );
}

export default Gameplay;