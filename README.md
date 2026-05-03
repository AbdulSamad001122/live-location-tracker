# video Demo
https://youtube.com/shorts/AWhOl2SVzQI

# Realtime Location Tracker

A high-performance location tracking system that broadcasts user movements in real time. This project combines the power of WebSockets for low-latency communication, Apache Kafka for reliable event streaming, and MongoDB for persistent historical data storage. It is fully secured using the OpenID Connect (OIDC) protocol to ensure that only authenticated users can share or view location data.

## Key Features

*   **Real-time Tracking**: Broadcasts location updates to all connected users instantly.
*   **5-Second Refresh**: Automatically updates and sends the user's current coordinates every 5 seconds.
*   **Interactive Map**: Uses Leaflet.js to render markers for all active users.
*   **Secure Auth**: Integrated with OIDC for authenticated-only access.
*   **Scalable Ingestion**: Uses Apache Kafka to decouple tracking from storage.

## Tech Stack

The architecture is built on a modern JavaScript stack designed for scale and reliability:

*   **Backend:** Node.js with Express for the API and server logic.
*   **Realtime:** Socket.io for bidirectional communication between clients and the server.
*   **Event Streaming:** Apache Kafka (via KafkaJS) to decouple location ingestion from processing.
*   **Database:** MongoDB with Mongoose for storing location logs and user data.
*   **Frontend:** Vanilla JavaScript with Leaflet.js for interactive map rendering.
*   **Authentication:** OIDC (OpenID Connect) for secure user identity management.
*   **Infrastructure:** Docker Compose for local orchestration of Kafka and MongoDB.

## Setup Steps

Follow these steps to get the environment running on your local machine:

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/AbdulSamad001122/live-location-tracker.git
    cd live-location-tracker
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Spin up Infrastructure**
    Make sure you have Docker installed and running. This will start Kafka and MongoDB containers.
    ```bash
    docker-compose up -d
    ```

4.  **Configure Environment Variables**
    Copy the example environment file and fill in your OIDC credentials (see the Environment Variables section below).
    ```bash
    cp .env.example .env
    ```

5.  **Run the Application**
    You need to run both the main server and the database processor.
    *   Start the server (Terminal 1):
        ```bash
        npm run dev
        ```
    *   Start the database processor (Terminal 2):
        ```bash
        npm run processor
        ```

6.  **Access the App**
    Open `http://localhost:8000` in your browser.

## Environment Variables

Your `.env` file should contain the following keys:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port the Express server will listen on. | `8000` |
| `MONGO_URI` | Connection string for your MongoDB instance. | `mongodb://localhost:27019/location_tracker` |
| `KAFKA_BROKER` | Address of the Kafka broker. | `localhost:9092` |
| `KAFKA_USERNAME` | (Optional) Username for SASL authentication. | - |
| `KAFKA_PASSWORD` | (Optional) Password for SASL authentication. | - |
| `OIDC_CLIENT_ID` | Your OIDC application client ID. | Required |
| `OIDC_CLIENT_SECRET` | Your OIDC application client secret. | Required |
| `OIDC_AUTH_ENDPOINT` | The URL for the OIDC authorization screen. | Required |
| `OIDC_TOKEN_ENDPOINT` | The URL for exchanging codes for tokens. | Required |
| `OIDC_USERINFO_ENDPOINT`| The URL to fetch user profile details. | Required |
| `OIDC_REDIRECT_URI` | The authorized callback URL for your app. | `http://localhost:8000/` |

## OIDC Auth Setup

The application uses the **Authorization Code Flow** for security:

1.  **Authorization Request:** When a user clicks "Login", the app redirects them to the `OIDC_AUTH_ENDPOINT` with the `client_id`, `scope` (openid profile email), and `redirect_uri`.
2.  **Callback handling:** After login, the provider redirects back to the app with a `code` in the URL.
3.  **Token Exchange:** The frontend sends this code to the `/api/callback` endpoint on our server. The server then communicates directly with the `OIDC_TOKEN_ENDPOINT` (using the `client_secret`) to retrieve an `access_token`.
4.  **Socket Authentication:** This `access_token` is passed during the Socket.io handshake. The server validates the token against the `OIDC_USERINFO_ENDPOINT` before allowing the connection.

## Socket Event Flow

Communication between the client and server happens through specific events:

*   **`client:send-location-to-server`**: The client emits this event every 5 seconds using the browser's Geolocation API. It sends `{ latitude, longitude }`.
*   **`server:send-new-location-to-users`**: The server broadcasts this event to all connected clients after a location update has been successfully processed through Kafka. It contains the user's ID, name, and coordinates.
*   **`user-disconnect`**: When a user leaves, the server broadcasts their ID so the frontend can remove their marker from the map.

## Kafka Event Flow

Kafka acts as the backbone for location data, ensuring that high volumes of updates don't overwhelm the database:

1.  **Producer:** The main `server.js` acts as a Kafka producer. Every time it receives a location via a socket, it pushes a message into the `location-updates` topic.
2.  **Topic:** `location-updates` is a single partition topic (by default) that holds the stream of coordinate data.
3.  **Consumers:**
    *   **Realtime Broadcast:** The `server.js` consumer listens to the topic and immediately emits the data back to all web users via Socket.io.
    *   **Database Processor:** The `database-processor.js` runs as a separate service, consuming the same topic to batch and save coordinates into MongoDB for historical tracking.

## Demo Video

[Watch the project in action here!](https://your-demo-link-here.com)

## Assumptions and Limitations

*   **Single Partition:** The Kafka topic is currently configured with one partition, which works for local development but would need scaling for massive concurrent users.
*   **Browser Precision:** Location accuracy is entirely dependent on the user's hardware and browser permissions.
*   **Security:** While tokens are verified, the implementation assumes the OIDC provider is reachable and responsive at all times.
*   **Redundancy:** Currently, both the server and the processor save to the database in certain configurations. In a strict production environment, only the dedicated processor should handle writes.
