import http from 'http';
import fs from "fs";
import url from "url";

// The HTML file for the chat client. Used below.
const clientHTML = fs.readFileSync("index.html");

const listOfQuestions = ["Who is President of the US?", "Where is Hitler from?"];
const listOfAnswers = ["Joe Biden", "Austria"];
let currQuestionIndex = 0;
let clients = [];

// Create a new server, and listen on port 8080.
// Connect to http://localhost:8080/ to use it.
let server = new http.Server();
server.listen(8080, "localhost", () => {
	console.log("To connect to the chat, go to http://localhost:8080/");
});

// When the server gets a new request, run this function
server.on("request", (request, response) => {
    // Parse the requested URL
    let pathname = url.parse(request.url).pathname;
    // If the request was for "/", send the client-side chat UI.
    if (pathname === "/") { // A request for the chat UI
        response.writeHead(200, {
            "Content-Type": "text/html"
        }).end(clientHTML);
    }
    // Otherwise send a 404 error for any path other than "/chat" or for
    // any method other than "GET" and "POST"
    else if (pathname !== "/quiz" ||
        (request.method !== "GET" && request.method !== "POST")) {
        response.writeHead(404).end();
    }
    // If the /chat request was a GET, then a client is connecting.
    else if (request.method === "GET") {
        acceptNewClient(request, response);
    }
    // Otherwise the /chat request is a POST of an answer
    else {
        broadcastNewMessage(request, response);
    }
});

function acceptNewClient(request, response) {
    // Remember the response object so we can send future messages to it
    clients.push(response);
    // If the client closes the connection, remove the corresponding
    // response object from the array of active clients
    request.connection.on("end", () => {
        clients.splice(clients.indexOf(response), 1);
        response.end();
    });
    // Set headers and send an initial chat event to just this one client
    response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache"
    });
    response.write("event: chat\ndata: Connected\n\n");
    // Note that we intentionally do not call response.end() here.
    // Keeping the connection open is what makes Server-Sent Events work.
}

async function broadcastNewMessage(request, response) {
    // First, read the body of the request to get the user's message
    request.setEncoding("utf8");
    let body = "";
    for await (let chunk of request) {
        body += chunk;
    }

    let reqObject = JSON.parse(body);

    // Once we've read the body send an empty response and close the connection
    response.writeHead(200).end();

    if (reqObject.answer === listOfAnswers[currQuestionIndex])
    {
        //Handle scoretable update

        currQuestionIndex++;

        let updateResponse = {newQuestion: listOfQuestions[currQuestionIndex]};

        // Format the message in text/event-stream format, prefixing each
        // line with "data: "
        let message = "data: " + JSON.stringify(updateResponse);
        // Give the message data a prefix that defines it as a "chat" event
        // and give it a double newline suffix that marks the end of the event.
        let event = `event: quizAnswer\n${message}\n\n`;
        // Now send this event to all listening clients

        clients.forEach(client => client.write(event));
    }
     
}