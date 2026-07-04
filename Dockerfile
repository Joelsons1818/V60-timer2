# Use Nginx to serve the static files
FROM nginx:alpine

# Copy the build output to Nginx html directory
COPY dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
