# Build Stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code and config files
COPY . .

# Build the production bundle
RUN npm run build

# Production Stage
FROM nginx:1.25-alpine

# Copy compiled static assets from build stage to Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
