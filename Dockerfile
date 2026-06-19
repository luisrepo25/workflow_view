# Stage 1: Build the Angular application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install -g npm@10.9.4 && npm install

# Copy the rest of the application code
COPY . .

# Build the application for production
# Note: Ensure the project name in angular.json matches the dist folder path
RUN npm run build -- --configuration production

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the build output from the build stage to the nginx html directory
# Angular 17+ uses dist/<project-name>/browser
COPY --from=build /app/dist/workflow_view/browser /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
