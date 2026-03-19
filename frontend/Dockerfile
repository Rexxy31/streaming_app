# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Pass build-time environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADMIN_EMAIL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ADMIN_EMAIL=$NEXT_PUBLIC_ADMIN_EMAIL

# Debug: verify env vars are present (showing only lengths for security)
RUN echo "URL length: ${#NEXT_PUBLIC_SUPABASE_URL}" && \
    echo "Key length: ${#NEXT_PUBLIC_SUPABASE_ANON_KEY}" && \
    echo "API URL length: ${#NEXT_PUBLIC_API_URL}"

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
