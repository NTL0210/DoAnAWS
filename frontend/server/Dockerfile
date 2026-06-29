# Voice Signaling Server — Socket.IO
# Build: docker build -t voice-signaling-server .
# Run:   docker run -d -p 3001:3001 --name signaling voice-signaling-server

FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy the signaling server source
COPY signaling.js .

EXPOSE 3001

CMD ["node", "signaling.js"]
