# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Run stage
FROM node:20-alpine AS runner
WORKDIR /app

# Copy built app and necessary files
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Set environment variables with defaults
ENV PORT=3000
EXPOSE ${PORT}

CMD ["npm", "start"]
